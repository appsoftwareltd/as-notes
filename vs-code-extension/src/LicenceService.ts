/**
 * LicenceService — pure logic for AS Notes licence key validation and
 * product-tier helpers.
 *
 * No VS Code imports. All format-validation rules are encapsulated here.
 * The activation service handles server communication; this module only
 * deals with local format checks, types, and tier logic.
 *
 * Licence key format: ASNO-XXXX-XXXX-XXXX-XXXX
 *   - Prefix: ASNO-
 *   - 4 segments of 4 hex characters (case-insensitive on input)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type LicenceStatus = 'valid' | 'invalid' | 'not-entered';

export type LicenceProduct = 'pro_editor' | 'pro_ai_sync';

export interface LicenceState {
    status: LicenceStatus;
    product: LicenceProduct | null; // null when status !== 'valid'
    serverUnreachable?: boolean;    // true when the result is from cache/grace because the server could not be reached
}

// ── Format validation ──────────────────────────────────────────────────────

const LICENCE_KEY_REGEX = /^ASNO-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i;

/**
 * Validate a licence key format and return its status.
 *
 * - `'not-entered'` — key is empty or whitespace only
 * - `'valid'`       — key matches `ASNO-XXXX-XXXX-XXXX-XXXX` (hex segments)
 * - `'invalid'`     — key is present but fails format validation
 *
 * This is a local pre-flight check only — the server is the authority on
 * whether a key is actually activated and not revoked.
 */
export function validateLicenceKeyFormat(key: string): LicenceStatus {
    if (!key || key.trim().length === 0) {
        return 'not-entered';
    }

    return LICENCE_KEY_REGEX.test(key.trim()) ? 'valid' : 'invalid';
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
