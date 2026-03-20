import { describe, it, expect } from 'vitest';
import { sign, createPrivateKey, createPublicKey } from 'crypto';
import { encode } from '../CrockfordBase32.js';
import {
    verifyLicenceKeyWithPublicKey,
    PRODUCT_PRO_EDITOR,
    PRODUCT_PRO_AI_SYNC,
    type VerifyResult,
} from '../SignedLicenceService.js';

// ── Test keys (NOT production keys) ────────────────────────────────────────

const TEST_PRIVATE_KEY_HEX =
    '302e020100300506032b6570042204205e0096f5c0fa184a2b666458da8327283c02b967ee97fedca57b300aa10206bb';
const TEST_PUBLIC_KEY_HEX =
    '302a300506032b65700321008a5ec510c54a07db1c3854c12524dbbc26ec84fb8af810a9e5998663aab33296';

const KEY_PREFIX = 'ASNO-';
const SEGMENT_LENGTH = 4;

// ── Fixture helpers ────────────────────────────────────────────────────────

function generateTestKey(productId: number, serial: number, timestampUnix?: number): string {
    const payload = Buffer.alloc(9);
    payload.writeUInt8(productId, 0);
    payload.writeUInt32BE(serial, 1);
    payload.writeUInt32BE(timestampUnix ?? Math.floor(Date.now() / 1000), 5);

    const privateKey = createPrivateKey({
        key: Buffer.from(TEST_PRIVATE_KEY_HEX, 'hex'),
        format: 'der',
        type: 'pkcs8',
    });
    const signature = sign(null, payload, privateKey);
    const raw = Buffer.concat([payload, signature]);
    const encoded = encode(raw);
    const segments = encoded.match(new RegExp(`.{1,${SEGMENT_LENGTH}}`, 'g'))!;
    return KEY_PREFIX + segments.join('-');
}

function verify(key: string): VerifyResult {
    return verifyLicenceKeyWithPublicKey(key, TEST_PUBLIC_KEY_HEX);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SignedLicenceService', () => {

    // ── Valid keys ───────────────────────────────────────────────────────

    it('verifies a valid pro_editor key', () => {
        const key = generateTestKey(PRODUCT_PRO_EDITOR, 0x12345678);
        const result = verify(key);
        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.product).toBe('pro_editor');
            expect(result.serial).toBe(0x12345678);
            expect(result.issuedAt).toBeInstanceOf(Date);
        }
    });

    it('verifies a valid pro_ai_sync key', () => {
        const key = generateTestKey(PRODUCT_PRO_AI_SYNC, 0xABCDEF01);
        const result = verify(key);
        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.product).toBe('pro_ai_sync');
            expect(result.serial).toBe(0xABCDEF01);
        }
    });

    it('preserves the issuedAt timestamp', () => {
        const ts = 1700000000; // 2023-11-14
        const key = generateTestKey(PRODUCT_PRO_EDITOR, 1, ts);
        const result = verify(key);
        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.issuedAt.getTime()).toBe(ts * 1000);
        }
    });

    // ── Case insensitivity ──────────────────────────────────────────────

    it('accepts a lowercase key', () => {
        const key = generateTestKey(PRODUCT_PRO_EDITOR, 42);
        const result = verify(key.toLowerCase());
        expect(result.valid).toBe(true);
    });

    it('accepts a mixed-case key', () => {
        const key = generateTestKey(PRODUCT_PRO_EDITOR, 42);
        // Alternate chars upper/lower
        const mixed = key.split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join('');
        const result = verify(mixed);
        expect(result.valid).toBe(true);
    });

    // ── Invalid keys ────────────────────────────────────────────────────

    it('rejects a key with wrong prefix', () => {
        const key = generateTestKey(PRODUCT_PRO_EDITOR, 1);
        const tampered = 'XNOT' + key.slice(4);
        expect(verify(tampered).valid).toBe(false);
    });

    it('rejects a key with no prefix', () => {
        const key = generateTestKey(PRODUCT_PRO_EDITOR, 1);
        const noPrefix = key.slice(5); // strip ASNO-
        expect(verify(noPrefix).valid).toBe(false);
    });

    it('rejects a tampered key (flipped bit in payload)', () => {
        const key = generateTestKey(PRODUCT_PRO_EDITOR, 1);
        // Flip a character in the body (after ASNO- prefix)
        const chars = key.split('');
        const idx = 5; // first char of body
        chars[idx] = chars[idx] === '0' ? '1' : '0';
        expect(verify(chars.join('')).valid).toBe(false);
    });

    it('rejects a truncated key', () => {
        const key = generateTestKey(PRODUCT_PRO_EDITOR, 1);
        const truncated = key.slice(0, key.length - 20);
        expect(verify(truncated).valid).toBe(false);
    });

    it('rejects an empty string', () => {
        expect(verify('').valid).toBe(false);
    });

    it('rejects a random string', () => {
        expect(verify('not-a-licence-key').valid).toBe(false);
    });

    it('rejects ASNO- prefix with garbage body', () => {
        expect(verify('ASNO-0000-0000-0000-0000').valid).toBe(false);
    });

    it('rejects a key with unknown product ID', () => {
        // Product 0xFF is not defined
        const key = generateTestKey(0xFF, 1);
        expect(verify(key).valid).toBe(false);
    });

    it('rejects a key verified against the wrong public key', () => {
        const key = generateTestKey(PRODUCT_PRO_EDITOR, 1);
        // Use the production public key (different from test key)
        const PROD_KEY_HEX = '302a300506032b6570032100a583cfe4b6d886ea2e257090434a1598caa94715c682496ebe856d63d8e9584c';
        const result = verifyLicenceKeyWithPublicKey(key, PROD_KEY_HEX);
        expect(result.valid).toBe(false);
    });
});
