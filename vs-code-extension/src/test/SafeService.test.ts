import { describe, it, expect } from 'vitest';
import * as kdbxweb from 'kdbxweb';
import {
    createSafe,
    openSafe,
    saveSafe,
    generateKeyFile,
    entryToView,
    setEntryField,
    readTotp,
    computeTotp,
    base32Decode,
    NEW_SAFE_KDF,
    configureArgon2,
    addAttachment,
    removeAttachment,
    renameField,
    setExpiry,
    setIcon,
    restoreFromHistory,
    normalizeAuthenticatorKey,
    listGroups,
    createDraft,
    applyDraft,
    draftToView,
} from '../SafeService';

/** Create a safe with a single populated entry, round-trip it through bytes. */
async function roundTrip(
    build: (db: kdbxweb.Kdbx) => void | Promise<void>,
    open: { password: string; keyFile?: Uint8Array },
    create: { password: string; keyFile?: Uint8Array } = open,
): Promise<kdbxweb.Kdbx> {
    const db = createSafe('Test', create.password, create.keyFile);
    await build(db);
    const bytes = await saveSafe(db);
    return openSafe(bytes, open.password, open.keyFile);
}

describe('SafeService - create/open roundtrip', () => {
    it('creates, saves, and reopens with the correct password', async () => {
        const reopened = await roundTrip(
            (db) => {
                const entry = db.createEntry(db.getDefaultGroup());
                entry.fields.set('Title', 'Gmail');
                entry.fields.set('UserName', 'me@example.com');
                entry.fields.set('Password', kdbxweb.ProtectedValue.fromString('hunter2'));
            },
            { password: 'master-pw' },
        );
        const entry = reopened.getDefaultGroup().entries[0];
        const view = entryToView(entry);
        expect(view.title).toBe('Gmail');
        expect(view.username).toBe('me@example.com');
        expect(view.password).toBe('hunter2');
    });

    it('rejects a wrong password with a friendly error', async () => {
        const db = createSafe('Test', 'correct-pw');
        const bytes = await saveSafe(db);
        await expect(openSafe(bytes, 'wrong-pw')).rejects.toThrow(/incorrect/i);
    });

    it('creates new safes with Argon2id and strong KDF parameters', async () => {
        const db = createSafe('Test', 'pw');
        expect(db.versionMajor).toBe(4);
        const uuid = db.header.kdfParameters?.get('$UUID');
        // Argon2id UUID bytes.
        expect(kdbxweb.ByteUtils.bytesToBase64(uuid as ArrayBuffer)).toBe(kdbxweb.Consts.KdfId.Argon2id);
        expect(Number(db.header.kdfParameters?.get('M'))).toBe(NEW_SAFE_KDF.memoryBytes);
        expect(Number(db.header.kdfParameters?.get('I'))).toBe(NEW_SAFE_KDF.iterations);
        expect(Number(db.header.kdfParameters?.get('P'))).toBe(NEW_SAFE_KDF.parallelism);
    });
});

describe('SafeService - key file composite', () => {
    it('requires the key file when the safe was created with one', async () => {
        configureArgon2();
        const keyFile = await generateKeyFile();
        const db = createSafe('Test', 'pw', keyFile);
        const bytes = await saveSafe(db);

        // Correct password but missing key file must fail.
        await expect(openSafe(bytes, 'pw')).rejects.toThrow(/incorrect/i);
        // Password + key file succeeds.
        const ok = await openSafe(bytes, 'pw', keyFile);
        expect(ok.getDefaultGroup()).toBeTruthy();
    });
});

describe('SafeService - preservation invariant', () => {
    it('round-trips unmodelled data when editing one field in place', async () => {
        const reopened = await roundTrip(
            (db) => {
                const entry = db.createEntry(db.getDefaultGroup());
                entry.fields.set('Title', 'Old title');
                entry.fields.set('CustomField', 'keep-me');
                entry.fields.set('otp', 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&period=30&digits=6');
                entry.tags = ['work', 'important'];
                entry.binaries.set('secret.txt', new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer);

                // Edit ONE field via the in-place mutator.
                const changed = setEntryField(entry, 'Title', 'New title');
                expect(changed).toBe(true);
            },
            { password: 'pw' },
        );

        const entry = reopened.getDefaultGroup().entries[0];
        const view = entryToView(entry);
        expect(view.title).toBe('New title'); // the edit applied
        expect(view.customFields.CustomField).toBe('keep-me'); // unmodelled field preserved
        expect(view.tags).toEqual(['work', 'important']); // tags preserved
        expect(view.attachmentNames).toContain('secret.txt'); // attachment preserved
        expect(view.totp).not.toBeNull(); // TOTP preserved
        // setEntryField no longer snapshots history itself (the editor does that
        // once per session), so a direct field edit adds no history entry.
        expect(view.historyCount).toBe(0);
    });

    it('setEntryField reports no change when the value is identical', async () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        entry.fields.set('Title', 'Same');
        expect(setEntryField(entry, 'Title', 'Same')).toBe(false);
        expect(entry.history.length).toBe(0);
    });
});

describe('SafeService - entry mutators', () => {
    it('adds and removes attachments, preserved across save/open', async () => {
        const reopened = await roundTrip(
            async (db) => {
                const entry = db.createEntry(db.getDefaultGroup());
                await addAttachment(db, entry, 'note.txt', new Uint8Array([1, 2, 3]));
                await addAttachment(db, entry, 'gone.txt', new Uint8Array([9]));
                removeAttachment(entry, 'gone.txt');
            },
            { password: 'pw' },
        );
        const view = entryToView(reopened.getDefaultGroup().entries[0]);
        expect(view.attachmentNames).toContain('note.txt');
        expect(view.attachmentNames).not.toContain('gone.txt');
    });

    it('renames a custom field, keeping its value', () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        entry.fields.set('Old', 'value');
        expect(renameField(entry, 'Old', 'New')).toBe(true);
        expect(entry.fields.has('Old')).toBe(false);
        expect(entryToView(entry).customFields.New).toBe('value');
        // refuses to clobber an existing field
        entry.fields.set('Taken', 'x');
        expect(renameField(entry, 'New', 'Taken')).toBe(false);
    });

    it('sets and clears expiry', () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        const when = Date.UTC(2030, 0, 1);
        setExpiry(entry, true, when);
        let view = entryToView(entry);
        expect(view.expires).toBe(true);
        expect(view.expiryTime).toBe(when);
        setExpiry(entry, false, null);
        view = entryToView(entry);
        expect(view.expires).toBe(false);
        expect(view.expiryTime).toBeNull();
    });

    it('sets the icon index', () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        setIcon(entry, 12);
        expect(entryToView(entry).icon).toBe(12);
    });

    it('restores a prior version from history (reversibly)', () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        entry.fields.set('Title', 'v1');
        entry.pushHistory(); // history[0] snapshots v1 (the editor snapshots once per session)
        setEntryField(entry, 'Title', 'v2');
        expect(entry.history.length).toBe(1);

        expect(restoreFromHistory(entry, 0)).toBe(true);
        expect(entryToView(entry).title).toBe('v1'); // restored
        expect(entry.history.length).toBe(2); // v2 snapshot pushed before restore
    });
});

describe('SafeService - groups', () => {
    it('lists root and nested groups with readable paths, and moves entries', async () => {
        const reopened = await roundTrip(
            (db) => {
                const root = db.getDefaultGroup();
                const email = db.createGroup(root, 'Email');
                const work = db.createGroup(email, 'Work');
                const entry = db.createEntry(root);
                entry.fields.set('Title', 'movable');
                db.move(entry, work); // relocate root → Email/Work
            },
            { password: 'pw' },
        );

        const paths = listGroups(reopened).map((g) => g.path);
        expect(paths).toContain('Test'); // root group (named after the db)
        expect(paths).toContain('Test / Email');
        expect(paths).toContain('Test / Email / Work');

        // The moved entry is now under the "Work" group, not the root.
        const located: Array<{ title: string; group: string | undefined }> = [];
        const walk = (g: kdbxweb.KdbxGroup) => {
            for (const e of g.entries) {
                located.push({ title: String(e.fields.get('Title')), group: g.name });
            }
            g.groups.forEach(walk);
        };
        walk(reopened.getDefaultGroup());
        expect(located.find((x) => x.title === 'movable')?.group).toBe('Work');
        expect(reopened.getDefaultGroup().entries.length).toBe(0);
    });
});

describe('SafeService - draft (buffered edits)', () => {
    it('buffers edits and only applies them to the entry on applyDraft', async () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        entry.fields.set('Title', 'original');
        entry.fields.set('Keep', 'preserved');
        entry.tags = ['a'];

        const draft = createDraft(entry);
        draft.values['Title'] = 'edited';
        draft.values['New'] = 'added';
        delete draft.values['Keep'];
        draft.tags = ['a', 'b'];
        draft.icon = 7;

        // Draft view reflects edits; the entry itself is untouched so far.
        const view = draftToView(db, entry, draft);
        expect(view.title).toBe('edited');
        expect(view.customFields.New).toBe('added');
        expect(view.customFields.Keep).toBeUndefined();
        expect(entry.fields.get('Title')).toBe('original'); // entry unchanged pre-apply

        await applyDraft(db, entry, draft);
        expect(String(entry.fields.get('Title'))).toBe('edited');
        expect(String(entry.fields.get('New'))).toBe('added');
        expect(entry.fields.has('Keep')).toBe(false);
        expect(entry.tags).toEqual(['a', 'b']);
        expect(entry.icon).toBe(7);
    });

    it('keeps the password protected after applyDraft', async () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        entry.fields.set('Password', kdbxweb.ProtectedValue.fromString('secret'));
        const draft = createDraft(entry);
        draft.values['Password'] = 'newsecret';
        await applyDraft(db, entry, draft);
        expect(entry.fields.get('Password')).toBeInstanceOf(kdbxweb.ProtectedValue);
        expect(String((entry.fields.get('Password') as kdbxweb.ProtectedValue).getText())).toBe('newsecret');
    });
});

describe('SafeService - authenticator key formats', () => {
    it('normalises a bare base32 secret (Bitwarden style) to an otpauth URI', () => {
        const uri = normalizeAuthenticatorKey('jbsw y3dp ehpk 3pxp');
        expect(uri).toBe('otpauth://totp/AS%20Notes?secret=JBSWY3DPEHPK3PXP&period=30&digits=6&algorithm=SHA1');
    });

    it('passes through a valid otpauth URI and rejects junk', () => {
        const uri = 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&period=30&digits=6';
        expect(normalizeAuthenticatorKey(uri)).toBe(uri);
        expect(normalizeAuthenticatorKey('not a key!!')).toBeNull();
        expect(normalizeAuthenticatorKey('')).toBeNull();
    });

    it('reads a bare base32 secret stored directly in the otp field', () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        entry.fields.set('otp', 'JBSWY3DPEHPK3PXP');
        const totp = readTotp(entry);
        expect(totp?.secretBase32).toBe('JBSWY3DPEHPK3PXP');
        expect(totp?.digits).toBe(6);
    });
});

describe('SafeService - TOTP', () => {
    it('parses the modern otpauth:// otp field', async () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        entry.fields.set('otp', 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&period=45&digits=8&algorithm=SHA256');
        const totp = readTotp(entry);
        expect(totp).toEqual({
            secretBase32: 'JBSWY3DPEHPK3PXP',
            period: 45,
            digits: 8,
            algorithm: 'SHA256',
        });
    });

    it('parses the legacy TOTP Seed / TOTP Settings pair', async () => {
        const db = createSafe('Test', 'pw');
        const entry = db.createEntry(db.getDefaultGroup());
        entry.fields.set('TOTP Seed', 'JBSWY3DPEHPK3PXP');
        entry.fields.set('TOTP Settings', '30;6');
        const totp = readTotp(entry);
        expect(totp?.secretBase32).toBe('JBSWY3DPEHPK3PXP');
        expect(totp?.period).toBe(30);
        expect(totp?.digits).toBe(6);
        expect(totp?.algorithm).toBe('SHA1');
    });

    it('computes the RFC 6238 SHA1 test vector', () => {
        // RFC 6238 Appendix B: seed "12345678901234567890", T=59s → 94287082 (8 digits).
        const secretBase32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
        const code = computeTotp({ secretBase32, digits: 8, period: 30, algorithm: 'SHA1' }, 59);
        expect(code).toBe('94287082');
    });

    it('decodes base32 (case/padding tolerant)', () => {
        expect(base32Decode('JBSWY3DP').toString('utf8')).toBe('Hello');
        expect(base32Decode('jbswy3dp').toString('utf8')).toBe('Hello');
    });
});
