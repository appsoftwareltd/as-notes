import { describe, it, expect } from 'vitest';
import {
    hasProEditorAccess,
    hasProAiSyncAccess,
    defaultLicenceState,
    invalidLicenceState,
    type LicenceState,
} from '../LicenceService.js';

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
