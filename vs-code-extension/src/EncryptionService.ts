/**
 * EncryptionService — pure AES-256-GCM encryption/decryption for AS Notes Pro.
 *
 * No VS Code imports. Uses Node's built-in `crypto` module — no external
 * dependencies, fully OS-agnostic.
 *
 * ## File format
 *
 * An encrypted file contains exactly one line:
 *
 *   ASNOTES_ENC_V1:<base64url(12-byte-nonce + ciphertext + 16-byte-authTag)>
 *
 * The marker prefix makes encrypted status detectable by the git pre-commit hook
 * without requiring any knowledge of the encryption key.
 *
 * ## Key derivation
 *
 * User passphrase → PBKDF2-SHA256 (100,000 iterations, fixed salt) → 32-byte key.
 * The fixed salt is intentional: it produces a deterministic key from the same
 * passphrase, so the user can re-derive it on any machine without storing the
 * derived key.
 */

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';

// ── Constants ──────────────────────────────────────────────────────────────

export const ENCRYPTION_MARKER = 'ASNOTES_ENC_V1:';

/** Fixed salt for PBKDF2 key derivation. */
const PBKDF2_SALT = Buffer.from('asnotes-enc-v1', 'utf8');

/** PBKDF2 iteration count — high enough to be meaningful, reasonable for UX. */
const PBKDF2_ITERATIONS = 100_000;

/** AES-256-GCM key length in bytes. */
const KEY_LENGTH = 32;

/** AES-GCM nonce length in bytes (96-bit recommended for GCM). */
const NONCE_LENGTH = 12;

/** AES-GCM authentication tag length in bytes. */
const AUTH_TAG_LENGTH = 16;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns true if the given file path is eligible for encryption.
 * Only `.enc.md` files (case-insensitive) are eligible.
 */
export function isEligibleFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.enc.md');
}

/**
 * Returns true if the content is already encrypted (starts with the marker).
 */
export function isEncrypted(content: string): boolean {
    return content.startsWith(ENCRYPTION_MARKER);
}

/**
 * Derive a 256-bit AES key from a passphrase using PBKDF2-SHA256.
 * Deterministic: the same passphrase always produces the same key.
 */
export function deriveKey(passphrase: string): Buffer {
    return pbkdf2Sync(passphrase, PBKDF2_SALT, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * A fresh random 12-byte nonce is generated for every call, so the same
 * plaintext encrypted twice produces different ciphertext.
 *
 * @param plaintext      - The markdown content to encrypt (UTF-8)
 * @param passphrase     - The user's passphrase
 * @param precomputedKey - Optional pre-derived key (from `deriveKey()`). Pass this
 *                         when encrypting many files with the same passphrase to
 *                         avoid running PBKDF2 on every call.
 * @returns              One-line encrypted string including the `ASNOTES_ENC_V1:` marker
 */
export function encrypt(plaintext: string, passphrase: string, precomputedKey?: Buffer): string {
    const key = precomputedKey ?? deriveKey(passphrase);
    const nonce = randomBytes(NONCE_LENGTH);

    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag(); // always 16 bytes

    // Pack: nonce (12) + ciphertext (variable) + authTag (16)
    const packed = Buffer.concat([nonce, ciphertext, authTag]);
    const encoded = packed.toString('base64url');

    return `${ENCRYPTION_MARKER}${encoded}`;
}

/**
 * Decrypt content that was encrypted by `encrypt()`.
 *
 * @param encryptedContent - The full encrypted line (including marker)
 * @param passphrase       - The user's passphrase
 * @param precomputedKey   - Optional pre-derived key (from `deriveKey()`). Pass this
 *                           when decrypting many files with the same passphrase to
 *                           avoid running PBKDF2 on every call.
 * @returns                The original plaintext (UTF-8)
 * @throws                 Descriptive error if content is not encrypted, malformed,
 *                         or the passphrase/key is wrong (GCM auth failure)
 */
export function decrypt(encryptedContent: string, passphrase: string, precomputedKey?: Buffer): string {
    if (!isEncrypted(encryptedContent)) {
        throw new Error(
            'Content is not in AS Notes encrypted format. ' +
            `Expected content starting with "${ENCRYPTION_MARKER}".`,
        );
    }

    const encoded = encryptedContent.slice(ENCRYPTION_MARKER.length).trim();
    let packed: Buffer;
    try {
        packed = Buffer.from(encoded, 'base64url');
    } catch {
        throw new Error('Encrypted content is malformed (base64url decode failed).');
    }

    const minLength = NONCE_LENGTH + AUTH_TAG_LENGTH; // nonce (12) + authTag (16); ciphertext may be 0 bytes
    if (packed.length < minLength) {
        throw new Error('Encrypted content is malformed (too short).');
    }

    const nonce = packed.subarray(0, NONCE_LENGTH);
    const authTag = packed.subarray(packed.length - AUTH_TAG_LENGTH);
    const ciphertext = packed.subarray(NONCE_LENGTH, packed.length - AUTH_TAG_LENGTH);

    const key = precomputedKey ?? deriveKey(passphrase);

    try {
        const decipher = createDecipheriv('aes-256-gcm', key, nonce);
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        return plaintext.toString('utf8');
    } catch {
        throw new Error(
            'Decryption failed. The passphrase may be incorrect, or the file may be corrupted.',
        );
    }
}
