import { describe, it, expect } from 'vitest';
import { encode, decode } from '../CrockfordBase32.js';

describe('CrockfordBase32', () => {

    // ── Round-trip ───────────────────────────────────────────────────────

    it('round-trips empty data', () => {
        const data = new Uint8Array(0);
        expect(decode(encode(data))).toEqual(data);
    });

    it('round-trips a single byte', () => {
        const data = new Uint8Array([0xff]);
        const encoded = encode(data);
        expect(decode(encoded)).toEqual(data);
    });

    it('round-trips arbitrary binary data', () => {
        const data = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]);
        const encoded = encode(data);
        expect(decode(encoded)).toEqual(data);
    });

    it('round-trips 73 bytes (licence key payload + signature)', () => {
        // Simulate a real licence key binary: 9 payload + 64 signature
        const data = new Uint8Array(73);
        for (let i = 0; i < 73; i++) { data[i] = i & 0xff; }
        const encoded = encode(data);
        expect(decode(encoded)).toEqual(data);
    });

    // ── Encode specifics ────────────────────────────────────────────────

    it('encodes all zeros', () => {
        const data = new Uint8Array([0x00, 0x00]);
        expect(encode(data)).toBe('0000');
    });

    it('uses only characters from the Crockford alphabet', () => {
        const data = new Uint8Array(32);
        for (let i = 0; i < 32; i++) { data[i] = i * 8; }
        const encoded = encode(data);
        expect(encoded).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
    });

    // ── Decode specifics ─────────────────────────────────────────────────

    it('strips hyphens during decode', () => {
        const data = new Uint8Array([0x01, 0x23, 0x45]);
        const encoded = encode(data);
        const withHyphens = encoded.match(/.{1,4}/g)!.join('-');
        expect(decode(withHyphens)).toEqual(data);
    });

    it('strips whitespace during decode', () => {
        const data = new Uint8Array([0x01, 0x23, 0x45]);
        const encoded = encode(data);
        const withSpaces = encoded.match(/.{1,4}/g)!.join(' ');
        expect(decode(withSpaces)).toEqual(data);
    });

    it('is case-insensitive on decode', () => {
        const data = new Uint8Array([0xab, 0xcd, 0xef]);
        const encoded = encode(data);
        expect(decode(encoded.toLowerCase())).toEqual(data);
        expect(decode(encoded.toUpperCase())).toEqual(data);
    });

    // ── Common misreadings ───────────────────────────────────────────────

    it('treats O as 0', () => {
        expect(decode('O')).toEqual(decode('0'));
    });

    it('treats I as 1', () => {
        expect(decode('I')).toEqual(decode('1'));
    });

    it('treats L as 1', () => {
        expect(decode('L')).toEqual(decode('1'));
    });

    it('treats lowercase l as 1', () => {
        expect(decode('l')).toEqual(decode('1'));
    });

    // ── Error handling ──────────────────────────────────────────────────

    it('throws on invalid character', () => {
        expect(() => decode('ASNO!@#$')).toThrow('Invalid Crockford Base32 character');
    });

    it('throws on U (excluded from alphabet)', () => {
        expect(() => decode('U')).toThrow('Invalid Crockford Base32 character');
    });
});
