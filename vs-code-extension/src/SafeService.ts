/**
 * SafeService - the crypto/data boundary for the AS Notes password safe.
 *
 * No VS Code imports (mirrors EncryptionService). Wraps `kdbxweb` so the rest
 * of the extension never touches KDBX internals directly, and supplies the
 * Argon2 implementation kdbxweb needs (it ships none) via `hash-wasm`.
 *
 * ## Why KDBX, and how it differs from EncryptionService
 *
 * Encrypted notes use a proprietary AES-256-GCM line format with a fixed,
 * global PBKDF2 salt (deterministic key, no interop). The safe is deliberately
 * the opposite: the interoperable KeePass KDBX 4 format, with a random per-file
 * salt and Argon2id, so a `.kdbx` written here opens in KeePassXC and vice
 * versa, and identical passwords never yield identical keys. See ADR-0003.
 *
 * ## Preservation invariant
 *
 * kdbxweb parses the *entire* entry (custom fields, TOTP, attachments, history,
 * icons, tags) into its object model. Callers MUST edit that live object in
 * place via the mutators here - never rebuild an entry from a known field set -
 * so fields this UI doesn't model round-trip untouched. See ADR-0003.
 *
 * ## Where this runs
 *
 * The extension host (Node), never the webview. The webview only ever receives
 * the `EntryView` for the entry currently on screen, so the full decrypted
 * database is never shipped into a DOM.
 */

import * as kdbxweb from 'kdbxweb';
import { argon2d, argon2id } from 'hash-wasm';
import { createHmac } from 'crypto';

// ── Argon2 wiring ────────────────────────────────────────────────────────────

let argon2Configured = false;

/**
 * Register the Argon2 implementation with kdbxweb (idempotent). kdbxweb passes
 * `memory` already in KiB (it divides the header's byte value by 1024 before
 * calling), which is exactly what hash-wasm's `memorySize` expects.
 */
export function configureArgon2(): void {
    if (argon2Configured) {
        return;
    }
    kdbxweb.CryptoEngine.setArgon2Impl(
        async (password, salt, memory, iterations, length, parallelism, type) => {
            const hashFn = type === kdbxweb.CryptoEngine.Argon2TypeArgon2id ? argon2id : argon2d;
            const hash = await hashFn({
                password: new Uint8Array(password),
                salt: new Uint8Array(salt),
                parallelism,
                iterations,
                memorySize: memory, // already KiB
                hashLength: length,
                outputType: 'binary',
            });
            // Return a standalone ArrayBuffer (hash-wasm may return a view).
            return bytesToArrayBuffer(hash);
        },
    );
    argon2Configured = true;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Argon2id parameters for newly created safes. Stronger than kdbxweb's weak
 *  defaults (Argon2d, 1 MiB, 2 iterations); comparable to KeePassXC. Stored in
 *  the file, so these bind at creation time. */
export const NEW_SAFE_KDF = {
    /** Memory in bytes; must be a multiple of 1024. 64 MiB. */
    memoryBytes: 64 * 1024 * 1024,
    iterations: 10,
    parallelism: 2,
};

const STANDARD_FIELDS = ['Title', 'UserName', 'Password', 'URL', 'Notes'] as const;

// ── Types (the UI read model) ────────────────────────────────────────────────

export interface TotpConfig {
    secretBase32: string;
    digits: number;
    period: number;
    algorithm: 'SHA1' | 'SHA256' | 'SHA512';
}

export interface EntryView {
    /** kdbxweb UUID string - the stable handle the UI passes back to mutate. */
    uuid: string;
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    /** Custom (non-standard) string fields, name → plaintext. */
    customFields: Record<string, string>;
    tags: string[];
    /** Attachment names only (bytes are fetched on demand, never bulk-shipped). */
    attachmentNames: string[];
    totp: TotpConfig | null;
    /** The raw authenticator key stored in the `otp` field (otpauth URI or bare secret). */
    authenticatorKey: string;
    /** Number of prior versions retained in the entry's history. */
    historyCount: number;
    /** Prior versions, newest last, for browse/restore. */
    history: HistoryVersion[];
    expires: boolean;
    expiryTime: number | null;
    /** Standard KDBX icon index (0–68). */
    icon: number;
    /** UUID of the group this entry currently lives in. */
    groupUuid: string;
    /** All groups in the safe (for the editor's move-to-group selector). */
    groups: GroupRef[];
}

export interface HistoryVersion {
    index: number;
    title: string;
    username: string;
    modified: number | null;
}

export interface GroupRef {
    uuid: string;
    /** Human-readable path, e.g. "Root / Email". */
    path: string;
}

// ── Open / create / save ─────────────────────────────────────────────────────

/** Copy any byte view into a standalone (non-shared) ArrayBuffer. */
function bytesToArrayBuffer(data: Uint8Array): ArrayBuffer {
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    return ab;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
    return bytesToArrayBuffer(data);
}

/** Build KDBX composite-key credentials from a master password and optional key file. */
export function makeCredentials(password: string, keyFile?: Uint8Array | null): kdbxweb.Credentials {
    const pv = kdbxweb.ProtectedValue.fromString(password);
    return new kdbxweb.Credentials(pv, keyFile ? toArrayBuffer(keyFile) : null);
}

/**
 * The composite key did not open the safe. Distinct from a corrupt-file error so
 * callers can offer to attach a key file - a safe that needs one and a wrong
 * password are indistinguishable from here.
 */
export class SafeInvalidKeyError extends Error {
    constructor() {
        super('Could not unlock the safe. The master password or key file is incorrect.');
        this.name = 'SafeInvalidKeyError';
    }
}

/**
 * Open an existing safe. Throws a friendly error on a wrong password/key file or
 * a corrupt file (the two are indistinguishable - both fail the HMAC).
 */
export async function openSafe(
    data: Uint8Array,
    password: string,
    keyFile?: Uint8Array | null,
): Promise<kdbxweb.Kdbx> {
    configureArgon2();
    const credentials = makeCredentials(password, keyFile);
    try {
        return await kdbxweb.Kdbx.load(toArrayBuffer(data), credentials);
    } catch (err) {
        const code = (err as kdbxweb.KdbxError)?.code;
        if (code === kdbxweb.Consts.ErrorCodes.InvalidKey) {
            throw new SafeInvalidKeyError();
        }
        throw new Error(
            `Could not open the safe: ${(err as Error)?.message ?? 'unknown error'}.`,
        );
    }
}

/** Create a new empty safe as KDBX 4 with Argon2id and strong KDF parameters. */
export function createSafe(
    name: string,
    password: string,
    keyFile?: Uint8Array | null,
): kdbxweb.Kdbx {
    configureArgon2();
    const db = kdbxweb.Kdbx.create(makeCredentials(password, keyFile), name);
    db.setVersion(4);
    db.setKdf(kdbxweb.Consts.KdfId.Argon2id);
    const params = db.header.kdfParameters;
    if (params) {
        const VT = kdbxweb.VarDictionary.ValueType;
        params.set('M', VT.UInt64, kdbxweb.Int64.from(NEW_SAFE_KDF.memoryBytes));
        params.set('I', VT.UInt64, kdbxweb.Int64.from(NEW_SAFE_KDF.iterations));
        params.set('P', VT.UInt32, NEW_SAFE_KDF.parallelism);
    }
    return db;
}

/** Serialise a safe to bytes ready to write to disk. */
export async function saveSafe(db: kdbxweb.Kdbx): Promise<Uint8Array> {
    const buf = await db.save();
    return new Uint8Array(buf);
}

/** Generate a fresh KeePass-format random key file (interoperable with KeePassXC). */
export async function generateKeyFile(): Promise<Uint8Array> {
    return kdbxweb.Credentials.createRandomKeyFile();
}

// ── Reading ──────────────────────────────────────────────────────────────────

export function fieldTextOf(value: kdbxweb.KdbxEntryField | undefined): string {
    if (value == null) {
        return '';
    }
    if (value instanceof kdbxweb.ProtectedValue) {
        return value.getText();
    }
    return String(value);
}

/** Internal short alias for readability within this module. */
const fieldText = fieldTextOf;

/** Project a kdbxweb entry into the plain read model sent to the UI. */
export function entryToView(entry: kdbxweb.KdbxEntry): EntryView {
    const customFields: Record<string, string> = {};
    for (const [name, value] of entry.fields) {
        if (!STANDARD_FIELDS.includes(name as typeof STANDARD_FIELDS[number]) && name !== 'otp') {
            customFields[name] = fieldText(value);
        }
    }
    return {
        uuid: entry.uuid.id,
        title: fieldText(entry.fields.get('Title')),
        username: fieldText(entry.fields.get('UserName')),
        password: fieldText(entry.fields.get('Password')),
        url: fieldText(entry.fields.get('URL')),
        notes: fieldText(entry.fields.get('Notes')),
        customFields,
        tags: [...entry.tags],
        attachmentNames: [...entry.binaries.keys()],
        totp: readTotp(entry),
        authenticatorKey: fieldText(entry.fields.get('otp')),
        historyCount: entry.history.length,
        history: entry.history.map((h, index) => ({
            index,
            title: fieldTextOf(h.fields.get('Title')),
            username: fieldTextOf(h.fields.get('UserName')),
            modified: h.times.lastModTime ? h.times.lastModTime.getTime() : null,
        })),
        expires: entry.times.expires ?? false,
        expiryTime: entry.times.expiryTime ? entry.times.expiryTime.getTime() : null,
        icon: entry.icon ?? 0,
        groupUuid: entry.parentGroup?.uuid.id ?? '',
        groups: [], // populated by the panel (needs the whole database)
    };
}

// ── Draft (buffered edits - committed to the entry only on save) ─────────────

/**
 * A mutable working copy of an entry's editable state. The editor mutates a
 * Draft; nothing reaches the KDBX entry (or disk) until `applyDraft` runs on
 * save. This gives a document-style edit-then-save flow with a clear dirty
 * state, instead of mutating the entry on every keystroke.
 */
export interface Draft {
    /** Field name → plaintext (Title, UserName, Password, URL, Notes, custom, otp, …). */
    values: Record<string, string>;
    /** Field names that should be stored protected. */
    protectedFields: string[];
    tags: string[];
    icon: number;
    expires: boolean;
    expiryTime: number | null;
    groupUuid: string;
    /** New attachments to add on save, name → bytes. */
    addedAttachments: Record<string, Uint8Array>;
    /** Existing attachment names to remove on save. */
    removedAttachments: string[];
}

/** Build a Draft from an entry's current state. */
export function createDraft(entry: kdbxweb.KdbxEntry): Draft {
    const values: Record<string, string> = {};
    const protectedFields: string[] = [];
    for (const [name, value] of entry.fields) {
        values[name] = fieldText(value);
        if (value instanceof kdbxweb.ProtectedValue) {
            protectedFields.push(name);
        }
    }
    return {
        values,
        protectedFields,
        tags: [...entry.tags],
        icon: entry.icon ?? 0,
        expires: entry.times.expires ?? false,
        expiryTime: entry.times.expiryTime ? entry.times.expiryTime.getTime() : null,
        groupUuid: entry.parentGroup?.uuid.id ?? '',
        addedAttachments: {},
        removedAttachments: [],
    };
}

/** Project a Draft (plus the entry's unbuffered parts) into the editor read model. */
export function draftToView(db: kdbxweb.Kdbx, entry: kdbxweb.KdbxEntry, draft: Draft): EntryView {
    const customFields: Record<string, string> = {};
    for (const [name, value] of Object.entries(draft.values)) {
        if (!STANDARD_FIELDS.includes(name as typeof STANDARD_FIELDS[number]) && name !== 'otp') {
            customFields[name] = value;
        }
    }
    const attachmentNames = [
        ...[...entry.binaries.keys()].filter((n) => !draft.removedAttachments.includes(n)),
        ...Object.keys(draft.addedAttachments),
    ];
    return {
        uuid: entry.uuid.id,
        title: draft.values['Title'] ?? '',
        username: draft.values['UserName'] ?? '',
        password: draft.values['Password'] ?? '',
        url: draft.values['URL'] ?? '',
        notes: draft.values['Notes'] ?? '',
        customFields,
        tags: [...draft.tags],
        attachmentNames,
        totp: totpConfigFromRaw(draft.values['otp'] ?? ''),
        authenticatorKey: draft.values['otp'] ?? '',
        historyCount: entry.history.length,
        history: entry.history.map((h, index) => ({
            index,
            title: fieldText(h.fields.get('Title')),
            username: fieldText(h.fields.get('UserName')),
            modified: h.times.lastModTime ? h.times.lastModTime.getTime() : null,
        })),
        expires: draft.expires,
        expiryTime: draft.expiryTime,
        icon: draft.icon,
        groupUuid: draft.groupUuid,
        groups: listGroups(db),
    };
}

/** Commit a Draft to the entry (in place), including attachments and group move. */
export async function applyDraft(
    db: kdbxweb.Kdbx,
    entry: kdbxweb.KdbxEntry,
    draft: Draft,
): Promise<void> {
    // Fields: remove any the draft dropped, then set/overwrite the rest.
    const desired = new Set(Object.keys(draft.values));
    for (const existing of [...entry.fields.keys()]) {
        if (!desired.has(existing)) {
            entry.fields.delete(existing);
        }
    }
    const protectedSet = new Set([...draft.protectedFields, 'Password', 'otp']);
    for (const [name, value] of Object.entries(draft.values)) {
        entry.fields.set(
            name,
            protectedSet.has(name) ? kdbxweb.ProtectedValue.fromString(value) : value,
        );
    }

    entry.tags = [...draft.tags];
    entry.icon = draft.icon;
    entry.times.expires = draft.expires;
    entry.times.expiryTime = draft.expires && draft.expiryTime ? new Date(draft.expiryTime) : undefined;

    for (const name of draft.removedAttachments) {
        entry.binaries.delete(name);
    }
    for (const [name, bytes] of Object.entries(draft.addedAttachments)) {
        const binary = await db.createBinary(bytesToArrayBuffer(bytes));
        entry.binaries.set(name, binary);
    }

    entry.times.update();

    if (draft.groupUuid && entry.parentGroup?.uuid.id !== draft.groupUuid) {
        const target = db.getGroup(draft.groupUuid);
        if (target) {
            db.move(entry, target);
        }
    }
}

/** Parse a raw authenticator key (otpauth URI or bare base32) into a TOTP config. */
export function totpConfigFromRaw(raw: string): TotpConfig | null {
    const s = raw.trim();
    if (s.startsWith('otpauth://')) {
        return parseOtpauth(s);
    }
    return s ? parseBareBase32(s) : null;
}

/** List every group in the safe as { uuid, path } (Recycle Bin excluded). */
export function listGroups(db: kdbxweb.Kdbx): GroupRef[] {
    const out: GroupRef[] = [];
    const recycleBinUuid = db.meta.recycleBinUuid?.id;
    const walk = (group: kdbxweb.KdbxGroup, prefix: string) => {
        const path = prefix ? `${prefix} / ${group.name}` : group.name || 'Root';
        out.push({ uuid: group.uuid.id, path });
        for (const sub of group.groups) {
            if (sub.uuid.id !== recycleBinUuid) {
                walk(sub, path);
            }
        }
    };
    walk(db.getDefaultGroup(), '');
    return out;
}

/** Find an entry anywhere in the database by its UUID string. */
export function findEntry(db: kdbxweb.Kdbx, uuidId: string): kdbxweb.KdbxEntry | undefined {
    const walk = (group: kdbxweb.KdbxGroup): kdbxweb.KdbxEntry | undefined => {
        for (const entry of group.entries) {
            if (entry.uuid.id === uuidId) {
                return entry;
            }
        }
        for (const sub of group.groups) {
            const found = walk(sub);
            if (found) {
                return found;
            }
        }
        return undefined;
    };
    return walk(db.getDefaultGroup());
}

/** Read an attachment's decrypted bytes by name, or undefined if absent. */
export function entryAttachment(entry: kdbxweb.KdbxEntry, name: string): Uint8Array | undefined {
    const binary = entry.binaries.get(name);
    if (binary == null) {
        return undefined;
    }
    // KdbxBinary may be an ArrayBuffer, a Uint8Array, a ProtectedValue, or a
    // { value } ref wrapper; normalise to raw bytes.
    const value = (binary as { value?: unknown }).value ?? binary;
    if (value instanceof kdbxweb.ProtectedValue) {
        return value.getBinary();
    }
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }
    if (value instanceof Uint8Array) {
        return value;
    }
    return undefined;
}

/** Attach a file to an entry, registering the binary in the database. */
export async function addAttachment(
    db: kdbxweb.Kdbx,
    entry: kdbxweb.KdbxEntry,
    name: string,
    bytes: Uint8Array,
): Promise<void> {
    const binary = await db.createBinary(bytesToArrayBuffer(bytes));
    entry.binaries.set(name, binary);
    entry.times.update();
}

/** Remove an attachment from an entry by name. Returns true if it existed. */
export function removeAttachment(entry: kdbxweb.KdbxEntry, name: string): boolean {
    if (!entry.binaries.has(name)) {
        return false;
    }
    entry.binaries.delete(name);
    entry.times.update();
    return true;
}

/** Rename a custom field, preserving its (possibly protected) value. */
export function renameField(entry: kdbxweb.KdbxEntry, oldName: string, newName: string): boolean {
    const target = newName.trim();
    if (!target || oldName === target || !entry.fields.has(oldName) || entry.fields.has(target)) {
        return false;
    }
    const value = entry.fields.get(oldName)!;
    entry.fields.delete(oldName);
    entry.fields.set(target, value);
    entry.times.update();
    return true;
}

/** Set (or clear) an entry's expiry. */
export function setExpiry(entry: kdbxweb.KdbxEntry, expires: boolean, expiryMs: number | null): void {
    entry.times.expires = expires;
    entry.times.expiryTime = expires && expiryMs ? new Date(expiryMs) : undefined;
    entry.times.update();
}

/** Set an entry's standard icon index (0–68). */
export function setIcon(entry: kdbxweb.KdbxEntry, icon: number): void {
    if (entry.icon === icon) {
        return;
    }
    entry.icon = icon;
    entry.times.update();
}

/**
 * Restore a prior version's content into the entry. The current version is
 * pushed to history first, so a restore is itself reversible.
 */
export function restoreFromHistory(entry: kdbxweb.KdbxEntry, index: number): boolean {
    const version = entry.history[index];
    if (!version) {
        return false;
    }
    entry.pushHistory();
    entry.fields = new Map(version.fields);
    entry.binaries = new Map(version.binaries);
    entry.tags = [...version.tags];
    entry.icon = version.icon;
    entry.times.update();
    return true;
}

// ── Mutating (in place - preserves unmodelled data) ──────────────────────────

const PROTECTED_STANDARD = new Set(['Password']);

/**
 * Set a field on a live entry, pushing history first so the prior version is
 * retained (KDBX semantics). Passwords and any pre-protected field stay
 * protected. Returns true if the value actually changed (dirty signal).
 */
export function setEntryField(
    entry: kdbxweb.KdbxEntry,
    name: string,
    value: string,
    protect?: boolean,
): boolean {
    const current = fieldText(entry.fields.get(name));
    if (current === value) {
        return false;
    }
    // History is snapshotted once per edit session by the caller, not per field
    // change - otherwise a keystroke-per-history-entry storm results.
    const existing = entry.fields.get(name);
    const shouldProtect =
        protect ?? (PROTECTED_STANDARD.has(name) || existing instanceof kdbxweb.ProtectedValue);
    entry.fields.set(name, shouldProtect ? kdbxweb.ProtectedValue.fromString(value) : value);
    entry.times.update();
    return true;
}

// ── TOTP (RFC 6238) ──────────────────────────────────────────────────────────

/**
 * Read a TOTP config from an entry, supporting both conventions AS Notes must
 * interoperate with: the modern KeePassXC `otp` field holding an `otpauth://`
 * URI, and the legacy TrayTOTP `TOTP Seed` + `TOTP Settings` pair.
 */
export function readTotp(entry: kdbxweb.KdbxEntry): TotpConfig | null {
    const otp = fieldText(entry.fields.get('otp')).trim();
    if (otp.startsWith('otpauth://')) {
        return parseOtpauth(otp);
    }
    if (otp) {
        // Bitwarden-style: a bare base32 secret stored directly in the otp field.
        const bare = parseBareBase32(otp);
        if (bare) {
            return bare;
        }
    }

    const seed = fieldText(entry.fields.get('TOTP Seed')).trim();
    if (seed) {
        // "TOTP Settings" is "period;digits", e.g. "30;6".
        const settings = fieldText(entry.fields.get('TOTP Settings')).trim();
        const [periodStr, digitsStr] = settings.split(';');
        return {
            secretBase32: seed.replace(/\s+/g, ''),
            period: Number(periodStr) || 30,
            digits: Number(digitsStr) || 6,
            algorithm: 'SHA1',
        };
    }
    return null;
}

/** Treat a string as a bare base32 TOTP secret (Bitwarden default 30s/6-digit/SHA1). */
function parseBareBase32(input: string): TotpConfig | null {
    const secret = input.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z2-7]+=*$/.test(secret) || base32Decode(secret).length === 0) {
        return null;
    }
    return { secretBase32: secret, digits: 6, period: 30, algorithm: 'SHA1' };
}

/**
 * Normalise an authenticator-key input (the formats Bitwarden accepts) to an
 * `otpauth://` URI for storage in the `otp` field - interoperable with
 * KeePassXC. Accepts an existing otpauth URI or a bare base32 secret (with or
 * without spaces). Returns null if the input is not a usable key.
 */
export function normalizeAuthenticatorKey(input: string): string | null {
    const s = input.trim();
    if (!s) {
        return null;
    }
    if (s.startsWith('otpauth://')) {
        return parseOtpauth(s) ? s : null;
    }
    const bare = parseBareBase32(s);
    if (bare) {
        return `otpauth://totp/AS%20Notes?secret=${bare.secretBase32}&period=30&digits=6&algorithm=SHA1`;
    }
    return null;
}

function parseOtpauth(uri: string): TotpConfig | null {
    let params: URLSearchParams;
    try {
        params = new URL(uri).searchParams;
    } catch {
        return null;
    }
    const secret = params.get('secret');
    if (!secret) {
        return null;
    }
    const algo = (params.get('algorithm') ?? 'SHA1').toUpperCase();
    return {
        secretBase32: secret.replace(/\s+/g, ''),
        digits: Number(params.get('digits')) || 6,
        period: Number(params.get('period')) || 30,
        algorithm: algo === 'SHA256' || algo === 'SHA512' ? algo : 'SHA1',
    };
}

/** Compute the current TOTP code for a config at a given unix time (seconds). */
export function computeTotp(config: TotpConfig, unixSeconds: number): string {
    const key = base32Decode(config.secretBase32);
    if (key.length === 0) {
        return '';
    }
    const counter = Math.floor(unixSeconds / config.period);

    const counterBuf = Buffer.alloc(8);
    // 64-bit big-endian counter (high word is 0 for any realistic time).
    counterBuf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
    counterBuf.writeUInt32BE(counter >>> 0, 4);

    const hmac = createHmac(config.algorithm.toLowerCase(), key).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const code = binary % 10 ** config.digits;
    return code.toString().padStart(config.digits, '0');
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decode an RFC 4648 base32 string (padding and case tolerant). */
export function base32Decode(input: string): Buffer {
    const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const char of clean) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) {
            continue; // skip stray characters rather than throw
        }
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bits -= 8;
            out.push((value >>> bits) & 0xff);
        }
    }
    return Buffer.from(out);
}
