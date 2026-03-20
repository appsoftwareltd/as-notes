/**
 * SignedLicenceService -- Ed25519 offline licence key verification.
 *
 * Licence key format: ASNO-XXXX-XXXX-...-XXXX (Crockford Base32, 4-char segments)
 *
 * Binary layout (73 bytes total):
 *   [0]     product ID (0x01 = pro_editor, 0x02 = pro_ai_sync)
 *   [1-4]   serial number (random uint32, big-endian)
 *   [5-8]   issue timestamp (Unix seconds, uint32, big-endian)
 *   [9-72]  Ed25519 signature (64 bytes)
 *
 * The public key is embedded in this module. Only the server holds the
 * private key. Verification is fully offline -- no network required.
 */

import { verify, createPublicKey } from 'crypto';
import { decode } from './CrockfordBase32.js';

// ── Product ID constants ───────────────────────────────────────────────────

export const PRODUCT_PRO_EDITOR = 0x01;
export const PRODUCT_PRO_AI_SYNC = 0x02;

const PRODUCT_ID_TO_NAME: Record<number, string> = {
    [PRODUCT_PRO_EDITOR]: 'pro_editor',
    [PRODUCT_PRO_AI_SYNC]: 'pro_ai_sync',
};

// ── Key parameters ────────────────────────────────────────────────────────

const PAYLOAD_SIZE = 9;
const SIGNATURE_SIZE = 64;
const KEY_PREFIX = 'ASNO-';

/**
 * Production Ed25519 public key (DER-encoded SPKI, hex).
 * This is the ONLY key that can verify production licence keys.
 */
const PRODUCTION_PUBLIC_KEY_HEX =
    '302a300506032b6570032100a583cfe4b6d886ea2e257090434a1598caa94715c682496ebe856d63d8e9584c';

// ── Verification result ────────────────────────────────────────────────────

export type VerifyResult =
    | { valid: true; product: string; serial: number; issuedAt: Date }
    | { valid: false };

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Verify a signed licence key using the embedded production public key.
 * Returns the decoded payload on success, or `{ valid: false }` on any failure.
 * Fully offline -- no network access required.
 */
export function verifyLicenceKey(key: string): VerifyResult {
    return verifyLicenceKeyWithPublicKey(key, PRODUCTION_PUBLIC_KEY_HEX);
}

/**
 * Verify a signed licence key against an arbitrary public key (hex-encoded DER SPKI).
 * Exported for testing with the test key pair.
 */
export function verifyLicenceKeyWithPublicKey(key: string, publicKeyHex: string): VerifyResult {
    try {
        // Must start with ASNO- (case-insensitive)
        if (!key.toUpperCase().startsWith(KEY_PREFIX)) {
            return { valid: false };
        }

        // Strip prefix, decode the body
        const body = key.slice(KEY_PREFIX.length);
        const raw = decode(body);

        // Must be exactly payload + signature bytes
        if (raw.length < PAYLOAD_SIZE + SIGNATURE_SIZE) {
            return { valid: false };
        }

        const payload = raw.slice(0, PAYLOAD_SIZE);
        const signature = raw.slice(PAYLOAD_SIZE, PAYLOAD_SIZE + SIGNATURE_SIZE);

        // Verify Ed25519 signature
        const publicKey = createPublicKey({
            key: Buffer.from(publicKeyHex, 'hex'),
            format: 'der',
            type: 'spki',
        });

        const isValid = verify(null, payload, publicKey, signature);
        if (!isValid) {
            return { valid: false };
        }

        // Parse payload
        const payloadBuf = Buffer.from(payload);
        const productId = payloadBuf.readUInt8(0);
        const serial = payloadBuf.readUInt32BE(1);
        const timestamp = payloadBuf.readUInt32BE(5);

        const productName = PRODUCT_ID_TO_NAME[productId];
        if (!productName) {
            return { valid: false };
        }

        return {
            valid: true,
            product: productName,
            serial,
            issuedAt: new Date(timestamp * 1000),
        };
    } catch {
        return { valid: false };
    }
}
