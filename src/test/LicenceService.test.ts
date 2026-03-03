import { describe, it, expect } from 'vitest';
import { validateLicenceKey, isValidStatus, type LicenceStatus } from '../LicenceService.js';

// Helper: constructs a valid 24-char key with exactly 12 lower + 12 upper.
const VALID_KEY = 'abcdefghijklABCDEFGHIJKL'; // 12 lower + 12 upper = 24 chars

describe('validateLicenceKey', () => {

    // ── not-entered ──────────────────────────────────────────────────────────

    it('returns not-entered for empty string', () => {
        expect(validateLicenceKey('')).toBe('not-entered');
    });

    it('returns not-entered for whitespace-only string', () => {
        expect(validateLicenceKey('   ')).toBe('not-entered');
    });

    it('returns not-entered for tab-only string', () => {
        expect(validateLicenceKey('\t')).toBe('not-entered');
    });

    // ── valid ────────────────────────────────────────────────────────────────

    it('returns valid for exactly 24 chars with 12 lower + 12 upper', () => {
        expect(validateLicenceKey(VALID_KEY)).toBe('valid');
    });

    it('returns valid for a different arrangement of 12 lower + 12 upper', () => {
        // Interleaved lower and upper
        const key = 'aAbBcCdDeEfFgGhHiIjJkKlL'; // 12 lower (a-l) + 12 upper (A-L)
        expect(validateLicenceKey(key)).toBe('valid');
    });

    // ── invalid — length ─────────────────────────────────────────────────────

    it('returns invalid for 23-char key (one short)', () => {
        const key = 'abcdefghijklABCDEFGHIJK'; // 23 chars
        expect(key.length).toBe(23);
        expect(validateLicenceKey(key)).toBe('invalid');
    });

    it('returns invalid for 25-char key (one over)', () => {
        const key = 'abcdefghijklABCDEFGHIJKLM'; // 25 chars
        expect(key.length).toBe(25);
        expect(validateLicenceKey(key)).toBe('invalid');
    });

    it('returns invalid for 1-char key', () => {
        expect(validateLicenceKey('a')).toBe('invalid');
    });

    // ── invalid — wrong lower/upper ratio ────────────────────────────────────

    it('returns invalid when all 24 chars are lowercase', () => {
        const key = 'abcdefghijklmnopqrstuvwx'; // 24 lower, 0 upper
        expect(key.length).toBe(24);
        expect(validateLicenceKey(key)).toBe('invalid');
    });

    it('returns invalid when all 24 chars are uppercase', () => {
        const key = 'ABCDEFGHIJKLMNOPQRSTUVWX'; // 0 lower, 24 upper
        expect(key.length).toBe(24);
        expect(validateLicenceKey(key)).toBe('invalid');
    });

    it('returns invalid for 13 lower + 11 upper (24 chars total)', () => {
        const key = 'abcdefghijklmABCDEFGHIJK'; // 13 lower + 11 upper
        expect(key.length).toBe(24);
        expect(validateLicenceKey(key)).toBe('invalid');
    });

    it('returns invalid for 11 lower + 13 upper (24 chars total)', () => {
        const key = 'abcdefghijkABCDEFGHIJKLM'; // 11 lower + 13 upper
        expect(key.length).toBe(24);
        expect(validateLicenceKey(key)).toBe('invalid');
    });

    // ── invalid — non-alpha characters ───────────────────────────────────────

    it('returns invalid when key contains digits', () => {
        // Replace last two chars of VALID_KEY with digits so length stays 24
        const key = 'abcdefghijklABCDEFGHIJ12'; // 24 chars, but 2 digits
        expect(key.length).toBe(24);
        expect(validateLicenceKey(key)).toBe('invalid');
    });

    it('returns invalid when key contains a space', () => {
        const key = 'abcdefghijklABCDEFGHIJ L'; // 24 chars, contains space
        expect(key.length).toBe(24);
        expect(validateLicenceKey(key)).toBe('invalid');
    });

    it('returns invalid when key contains a symbol', () => {
        const key = 'abcdefghijklABCDEFGHIJ-L'; // 24 chars, contains hyphen
        expect(key.length).toBe(24);
        expect(validateLicenceKey(key)).toBe('invalid');
    });

});

describe('isValidStatus', () => {

    it('returns true for valid', () => {
        expect(isValidStatus('valid')).toBe(true);
    });

    it('returns false for invalid', () => {
        expect(isValidStatus('invalid')).toBe(false);
    });

    it('returns false for not-entered', () => {
        expect(isValidStatus('not-entered')).toBe(false);
    });

    it('type-checks as LicenceStatus', () => {
        const s: LicenceStatus = validateLicenceKey(VALID_KEY);
        expect(isValidStatus(s)).toBe(true);
    });

});
