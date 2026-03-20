/**
 * LicenceService -- pure logic for AS Notes licence types and
 * product-tier helpers.
 *
 * No VS Code imports. Licence key verification is handled by
 * SignedLicenceService (Ed25519 offline verification). This module
 * provides shared types, tier logic, and factory functions.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type LicenceStatus = 'valid' | 'invalid' | 'not-entered';

export type LicenceProduct = 'pro_editor' | 'pro_ai_sync';

export interface LicenceState {
    status: LicenceStatus;
    product: LicenceProduct | null; // null when status !== 'valid'
}

// ── Tier helpers ───────────────────────────────────────────────────────────

/**
 * Returns true when the licence state grants Pro Editor access.
 * Both `pro_editor` and `pro_ai_sync` products include editor features.
 */
export function hasProEditorAccess(state: LicenceState): boolean {
    return state.status === 'valid'
        && (state.product === 'pro_editor' || state.product === 'pro_ai_sync');
}

/**
 * Returns true when the licence state grants Pro AI & Sync access.
 * Only the `pro_ai_sync` product includes AI and sync features.
 */
export function hasProAiSyncAccess(state: LicenceState): boolean {
    return state.status === 'valid' && state.product === 'pro_ai_sync';
}

/**
 * Build a default (unactivated) LicenceState.
 */
export function defaultLicenceState(): LicenceState {
    return { status: 'not-entered', product: null };
}

/**
 * Build an invalid LicenceState.
 */
export function invalidLicenceState(): LicenceState {
    return { status: 'invalid', product: null };
}
