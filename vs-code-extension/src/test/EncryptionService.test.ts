import { describe, it, expect } from 'vitest';
import {
    isEligibleFile,
    isEncrypted,
    deriveKey,
    encrypt,
    decrypt,
    ENCRYPTION_MARKER,
} from '../EncryptionService.js';

const PASSPHRASE = 'my-test-passphrase';
const PLAINTEXT = '# Secret Note\n\nThis is some **private** content.\n\n[[Link to another page]]';

describe('isEligibleFile', () => {

    it('returns true for .enc.md file', () => {
        expect(isEligibleFile('notes.enc.md')).toBe(true);
    });

    it('returns true for path with directory prefix', () => {
        expect(isEligibleFile('journals/2026_01_01.enc.md')).toBe(true);
    });

    it('returns true for uppercase extension (case-insensitive)', () => {
        expect(isEligibleFile('SECRET.ENC.MD')).toBe(true);
    });

    it('returns true for mixed case extension', () => {
        expect(isEligibleFile('notes.Enc.Md')).toBe(true);
    });

    it('returns false for plain .md file', () => {
        expect(isEligibleFile('notes.md')).toBe(false);
    });

    it('returns false for .enc file without .md', () => {
        expect(isEligibleFile('notes.enc')).toBe(false);
    });

    it('returns false for .markdown file', () => {
        expect(isEligibleFile('notes.markdown')).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isEligibleFile('')).toBe(false);
    });

});

describe('isEncrypted', () => {

    it('returns true for content starting with marker', () => {
        expect(isEncrypted(`${ENCRYPTION_MARKER}abc123`)).toBe(true);
    });

    it('returns false for plain markdown content', () => {
        expect(isEncrypted('# My Note\n\nSome content.')).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isEncrypted('')).toBe(false);
    });

    it('returns false for partial marker (missing colon)', () => {
        expect(isEncrypted('ASNOTES_ENC_V1')).toBe(false);
    });

    it('returns false for marker in the middle of content', () => {
        expect(isEncrypted(`# Heading\n${ENCRYPTION_MARKER}data`)).toBe(false);
    });

});

describe('deriveKey', () => {

    it('produces a 32-byte buffer', () => {
        const key = deriveKey(PASSPHRASE);
        expect(key).toBeInstanceOf(Buffer);
        expect(key.length).toBe(32);
    });

    it('same passphrase always produces the same key (deterministic)', () => {
        const key1 = deriveKey(PASSPHRASE);
        const key2 = deriveKey(PASSPHRASE);
        expect(key1.equals(key2)).toBe(true);
    });

    it('different passphrases produce different keys', () => {
        const key1 = deriveKey('passphrase-one');
        const key2 = deriveKey('passphrase-two');
        expect(key1.equals(key2)).toBe(false);
    });

    it('empty passphrase still produces a 32-byte key', () => {
        const key = deriveKey('');
        expect(key.length).toBe(32);
    });

});

describe('encrypt / decrypt', () => {

    it('roundtrip: decrypt(encrypt(plaintext)) recovers original', () => {
        const encrypted = encrypt(PLAINTEXT, PASSPHRASE);
        const recovered = decrypt(encrypted, PASSPHRASE);
        expect(recovered).toBe(PLAINTEXT);
    });

    it('encrypted result starts with marker', () => {
        const encrypted = encrypt(PLAINTEXT, PASSPHRASE);
        expect(encrypted.startsWith(ENCRYPTION_MARKER)).toBe(true);
    });

    it('encrypted result is a single line (no newlines)', () => {
        const encrypted = encrypt(PLAINTEXT, PASSPHRASE);
        expect(encrypted.includes('\n')).toBe(false);
    });

    it('encrypt produces different output each call (random nonce)', () => {
        const enc1 = encrypt(PLAINTEXT, PASSPHRASE);
        const enc2 = encrypt(PLAINTEXT, PASSPHRASE);
        expect(enc1).not.toBe(enc2);
    });

    it('roundtrip preserves empty string', () => {
        const encrypted = encrypt('', PASSPHRASE);
        expect(decrypt(encrypted, PASSPHRASE)).toBe('');
    });

    it('roundtrip preserves unicode / multi-line content', () => {
        const unicode = '# Héllo Wörld\n\n🔐 Secure note\n\nLine three.';
        expect(decrypt(encrypt(unicode, PASSPHRASE), PASSPHRASE)).toBe(unicode);
    });

});

describe('decrypt errors', () => {

    it('throws on wrong passphrase (GCM auth failure)', () => {
        const encrypted = encrypt(PLAINTEXT, PASSPHRASE);
        expect(() => decrypt(encrypted, 'wrong-passphrase')).toThrow(
            /decryption failed/i,
        );
    });

    it('throws when called on non-encrypted content (no marker)', () => {
        expect(() => decrypt('# Plain note\n\nNo encryption here.', PASSPHRASE)).toThrow(
            /not in as notes encrypted format/i,
        );
    });

    it('throws on tampered ciphertext (GCM auth failure)', () => {
        const encrypted = encrypt(PLAINTEXT, PASSPHRASE);
        // Flip a character inside the base64 payload to corrupt the ciphertext/authTag
        const markerLen = ENCRYPTION_MARKER.length;
        const payload = encrypted.slice(markerLen);
        // Change a character near the middle of the payload
        const mid = Math.floor(payload.length / 2);
        const tampered = payload.slice(0, mid) +
            (payload[mid] === 'A' ? 'B' : 'A') +
            payload.slice(mid + 1);
        const tamperedContent = `${ENCRYPTION_MARKER}${tampered}`;
        expect(() => decrypt(tamperedContent, PASSPHRASE)).toThrow();
    });

    it('throws on malformed base64 payload (too short)', () => {
        // Valid marker but payload decodes to fewer bytes than nonce + authTag minimum
        const malformed = `${ENCRYPTION_MARKER}dG9vc2hvcnQ=`; // "tooshort" in base64
        expect(() => decrypt(malformed, PASSPHRASE)).toThrow(/malformed/i);
    });

});
