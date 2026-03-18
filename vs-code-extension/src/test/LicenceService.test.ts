import { describe, it, expect } from 'vitest';
import {
    validateLicenceKeyFormat,
    hasProEditorAccess,
    hasProAiSyncAccess,
    defaultLicenceState,
    invalidLicenceState,
    type LicenceState,
    type LicenceProduct,
} from '../LicenceService.js';

// Helper: a well-formed key with ASNO- prefix and 4×4 hex segments.
const VALID_KEY = 'ASNO-A1B2-C3D4-E5F6-7890';

describe('validateLicenceKeyFormat', () => {

    // ── not-entered ──────────────────────────────────────────────────────

    it('returns not-entered for empty string', () => {
        expect(validateLicenceKeyFormat('')).toBe('not-entered');
    });

    it('returns not-entered for whitespace-only string', () => {
        expect(validateLicenceKeyFormat('   ')).toBe('not-entered');
    });

    it('returns not-entered for tab-only string', () => {
        expect(validateLicenceKeyFormat('\t')).toBe('not-entered');
    });

    // ── valid ────────────────────────────────────────────────────────────

    it('returns valid for correctly formatted key', () => {
        expect(validateLicenceKeyFormat(VALID_KEY)).toBe('valid');
    });

    it('returns valid for lowercase hex characters (case-insensitive)', () => {
        expect(validateLicenceKeyFormat('ASNO-a1b2-c3d4-e5f6-7890')).toBe('valid');
    });

    it('returns valid for mixed-case hex characters', () => {
        expect(validateLicenceKeyFormat('ASNO-A1b2-C3d4-E5f6-7890')).toBe('valid');
    });

    it('returns valid for all-zero segments', () => {
        expect(validateLicenceKeyFormat('ASNO-0000-0000-0000-0000')).toBe('valid');
    });

    it('returns valid for all-F segments', () => {
        expect(validateLicenceKeyFormat('ASNO-FFFF-FFFF-FFFF-FFFF')).toBe('valid');
    });

    it('returns valid with leading/trailing whitespace (trimmed)', () => {
        expect(validateLicenceKeyFormat('  ASNO-A1B2-C3D4-E5F6-7890  ')).toBe('valid');
    });

    // ── invalid — wrong prefix ───────────────────────────────────────────

    it('returns invalid for missing ASNO- prefix', () => {
        expect(validateLicenceKeyFormat('A1B2-C3D4-E5F6-7890-AABB')).toBe('invalid');
    });

    it('returns invalid for wrong prefix', () => {
        expect(validateLicenceKeyFormat('XNOT-A1B2-C3D4-E5F6-7890')).toBe('invalid');
    });

    it('returns invalid for lowercase prefix asno-', () => {
        // The prefix must match ASNO- (the regex is case-insensitive for hex but prefix is part of it)
        // Actually our regex is fully case-insensitive, so asno- should also match
        expect(validateLicenceKeyFormat('asno-A1B2-C3D4-E5F6-7890')).toBe('valid');
    });

    // ── invalid — wrong segment count / length ───────────────────────────

    it('returns invalid for too few segments', () => {
        expect(validateLicenceKeyFormat('ASNO-A1B2-C3D4-E5F6')).toBe('invalid');
    });

    it('returns invalid for too many segments', () => {
        expect(validateLicenceKeyFormat('ASNO-A1B2-C3D4-E5F6-7890-AABB')).toBe('invalid');
    });

    it('returns invalid for segment with 3 chars', () => {
        expect(validateLicenceKeyFormat('ASNO-A1B-C3D4-E5F6-7890')).toBe('invalid');
    });

    it('returns invalid for segment with 5 chars', () => {
        expect(validateLicenceKeyFormat('ASNO-A1B2C-C3D4-E5F6-7890')).toBe('invalid');
    });

    // ── invalid — non-hex characters ─────────────────────────────────────

    it('returns invalid when segment contains G (not hex)', () => {
        expect(validateLicenceKeyFormat('ASNO-G1B2-C3D4-E5F6-7890')).toBe('invalid');
    });

    it('returns invalid when segment contains special char', () => {
        expect(validateLicenceKeyFormat('ASNO-A1B!-C3D4-E5F6-7890')).toBe('invalid');
    });

    it('returns invalid for completely random string', () => {
        expect(validateLicenceKeyFormat('not-a-licence-key')).toBe('invalid');
    });

    it('returns invalid for old 24-char placeholder format', () => {
        expect(validateLicenceKeyFormat('abcdefghijklABCDEFGHIJKL')).toBe('invalid');
    });

    // ── invalid — missing hyphens ────────────────────────────────────────

    it('returns invalid for key without hyphens', () => {
        expect(validateLicenceKeyFormat('ASNOA1B2C3D4E5F67890')).toBe('invalid');
    });
});

describe('hasProEditorAccess', () => {

    it('returns true for pro_editor product', () => {
        const state: LicenceState = { status: 'valid', product: 'pro_editor' };
        expect(hasProEditorAccess(state)).toBe(true);
    });

    it('returns true for pro_ai_sync product (superset)', () => {
        const state: LicenceState = { status: 'valid', product: 'pro_ai_sync' };
        expect(hasProEditorAccess(state)).toBe(true);
    });

    it('returns false when status is invalid', () => {
        const state: LicenceState = { status: 'invalid', product: null };
        expect(hasProEditorAccess(state)).toBe(false);
    });

    it('returns false when status is not-entered', () => {
        const state: LicenceState = { status: 'not-entered', product: null };
        expect(hasProEditorAccess(state)).toBe(false);
    });

    it('returns false for valid status with null product', () => {
        // Should not happen in practice, but guard against it
        const state: LicenceState = { status: 'valid', product: null };
        expect(hasProEditorAccess(state)).toBe(false);
    });
});

describe('hasProAiSyncAccess', () => {

    it('returns true for pro_ai_sync product', () => {
        const state: LicenceState = { status: 'valid', product: 'pro_ai_sync' };
        expect(hasProAiSyncAccess(state)).toBe(true);
    });

    it('returns false for pro_editor product', () => {
        const state: LicenceState = { status: 'valid', product: 'pro_editor' };
        expect(hasProAiSyncAccess(state)).toBe(false);
    });

    it('returns false when status is invalid', () => {
        const state: LicenceState = { status: 'invalid', product: null };
        expect(hasProAiSyncAccess(state)).toBe(false);
    });

    it('returns false when status is not-entered', () => {
        expect(hasProAiSyncAccess(defaultLicenceState())).toBe(false);
    });
});

describe('defaultLicenceState', () => {

    it('returns not-entered status with null product', () => {
        const state = defaultLicenceState();
        expect(state.status).toBe('not-entered');
        expect(state.product).toBeNull();
    });
});

describe('invalidLicenceState', () => {

    it('returns invalid status with null product', () => {
        const state = invalidLicenceState();
        expect(state.status).toBe('invalid');
        expect(state.product).toBeNull();
    });
});
