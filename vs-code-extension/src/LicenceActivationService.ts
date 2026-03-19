/**
 * LicenceActivationService — handles licence activation and periodic
 * validation against the AS Notes licence server at asnotes.io.
 *
 * ## Flow
 *
 *   1. User enters licence key (ASNO-XXXX-XXXX-XXXX-XXXX) in settings.
 *   2. Extension calls POST /api/v1/licence/activate → server returns JWT.
 *   3. JWT is stored in VS Code's SecretStorage (OS keychain, encrypted).
 *   4. On subsequent startups, if the cached JWT is not expired the
 *      extension uses it directly. If expired, it re-activates.
 *   5. A periodic background validation (POST /api/v1/licence/validate)
 *      runs every 24 hours to detect revocation.
 *
 * ## Offline fallback
 *
 *   When the server is unreachable, the extension falls back to a
 *   format-based check: if the licence key matches the ASNO-XXXX format
 *   regex, Pro Editor access is granted with `serverUnreachable: true`.
 *   This is a temporary measure until cryptographic offline keys are
 *   implemented.
 */

import * as vscode from 'vscode';
import {
    validateLicenceKeyFormat,
    defaultLicenceState,
    invalidLicenceState,
    type LicenceState,
    type LicenceProduct,
} from './LicenceService.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SECRET_TOKEN = 'as-notes.activationToken';
const SECRET_LICENCE_KEY = 'as-notes.licenceKey';
const SECRET_LAST_VALIDATED = 'as-notes.lastValidated';
const SECRET_LICENCE_STATE = 'as-notes.licenceState';

const DEFAULT_BASE_URL = 'https://www.asnotes.io';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1_000, 4_000, 16_000];

// ── Base URL resolution ────────────────────────────────────────────────────

function getBaseUrl(): string {
    return process.env.AS_NOTES_LICENCE_SERVER_URL || DEFAULT_BASE_URL;
}

// ── JWT helpers (decode only — no signature verification) ──────────────────

interface JwtPayload {
    sub?: string;
    licenceKey?: string;
    product?: string;
    iat?: number;
    exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) { return null; }
        const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
        return JSON.parse(payload) as JwtPayload;
    } catch {
        return null;
    }
}

function isTokenExpired(token: string): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) { return true; }
    return Date.now() >= payload.exp * 1000;
}

function extractProduct(token: string): LicenceProduct | null {
    const payload = decodeJwtPayload(token);
    if (payload?.product === 'pro_editor' || payload?.product === 'pro_ai_sync') {
        return payload.product;
    }
    return null;
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function fetchWithRetry(
    url: string,
    body: Record<string, string>,
): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10_000),
            });
            // Only retry on 5xx
            if (response.status >= 500 && attempt < MAX_RETRIES) {
                lastError = new Error(`Server error ${response.status}`);
                await delay(RETRY_DELAYS_MS[attempt]);
                continue;
            }
            return response;
        } catch (err) {
            lastError = err;
            if (attempt < MAX_RETRIES) {
                await delay(RETRY_DELAYS_MS[attempt]);
            }
        }
    }
    throw lastError;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Persisted state helpers ────────────────────────────────────────────────

async function persistLicenceState(
    secrets: vscode.SecretStorage,
    token: string,
    key: string,
    state: LicenceState,
): Promise<void> {
    await secrets.store(SECRET_TOKEN, token);
    await secrets.store(SECRET_LICENCE_KEY, key);
    await secrets.store(SECRET_LAST_VALIDATED, Date.now().toString());
    await secrets.store(SECRET_LICENCE_STATE, JSON.stringify(state));
}

async function clearPersistedState(secrets: vscode.SecretStorage): Promise<void> {
    await secrets.delete(SECRET_TOKEN);
    await secrets.delete(SECRET_LICENCE_KEY);
    await secrets.delete(SECRET_LAST_VALIDATED);
    await secrets.delete(SECRET_LICENCE_STATE);
}

async function loadPersistedState(secrets: vscode.SecretStorage): Promise<{
    token: string | undefined;
    key: string | undefined;
    lastValidated: number | undefined;
    state: LicenceState | undefined;
}> {
    const token = await secrets.get(SECRET_TOKEN);
    const key = await secrets.get(SECRET_LICENCE_KEY);
    const lastValidatedStr = await secrets.get(SECRET_LAST_VALIDATED);
    const stateStr = await secrets.get(SECRET_LICENCE_STATE);

    return {
        token,
        key,
        lastValidated: lastValidatedStr ? parseInt(lastValidatedStr, 10) : undefined,
        state: stateStr ? JSON.parse(stateStr) as LicenceState : undefined,
    };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load the cached licence state from SecretStorage without contacting the server.
 * Used on startup to restore the previous licence state immediately.
 * Returns defaultLicenceState() if nothing is cached.
 */
export async function loadCachedLicenceState(
    context: vscode.ExtensionContext,
): Promise<LicenceState> {
    const persisted = await loadPersistedState(context.secrets);
    return persisted.state ?? defaultLicenceState();
}

/**
 * Activate a licence key against the server and return the resulting
 * LicenceState. Stores the JWT and metadata in SecretStorage.
 *
 * Safe to call repeatedly — uses cached token when available and valid.
 */
export async function activateWithServer(
    key: string,
    context: vscode.ExtensionContext,
): Promise<LicenceState> {
    // Not entered — clear persisted state.
    const formatStatus = validateLicenceKeyFormat(key);
    if (formatStatus === 'not-entered') {
        await clearPersistedState(context.secrets);
        return defaultLicenceState();
    }

    // Format invalid — clear and return immediately.
    if (formatStatus === 'invalid') {
        await clearPersistedState(context.secrets);
        return invalidLicenceState();
    }

    // Key format is valid — check cached token.
    const persisted = await loadPersistedState(context.secrets);

    // If we have a cached token for this exact key and it's not expired, reuse it.
    if (persisted.token && persisted.key === key && !isTokenExpired(persisted.token) && persisted.state) {
        return persisted.state;
    }

    // Need to activate (or re-activate) with the server.
    try {
        const baseUrl = getBaseUrl();
        const response = await fetchWithRetry(`${baseUrl}/api/v1/licence/activate`, {
            licenceKey: key,
            deviceId: vscode.env.machineId,
            deviceInfo: `VS Code ${vscode.version} / ${getOsPlatformLabel()}`,
        });

        if (response.ok) {
            const data = await response.json() as { token: string; expiresAt: string };
            const product = extractProduct(data.token);
            const state: LicenceState = {
                status: 'valid',
                product,
            };
            await persistLicenceState(context.secrets, data.token, key, state);
            return state;
        }

        // Handle specific error statuses per spec
        if (response.status === 403 || response.status === 404) {
            await clearPersistedState(context.secrets);
            return invalidLicenceState();
        }

        // 400 = extension bug, log and return invalid
        if (response.status === 400) {
            console.warn('as-notes: licence activation returned 400 (bad request) — possible extension bug');
            return invalidLicenceState();
        }

        // Other errors — fall through to grace period
        throw new Error(`Unexpected status ${response.status}`);

    } catch (err) {
        // Server unreachable or all retries exhausted — fall back to format check
        return applyFormatFallback(context.secrets, key);
    }
}

/**
 * Validate the current licence key against the server (lightweight check).
 * Returns the updated LicenceState. Call this periodically (every 24h).
 */
export async function validateWithServer(
    context: vscode.ExtensionContext,
): Promise<LicenceState> {
    const persisted = await loadPersistedState(context.secrets);

    if (!persisted.key || !persisted.token) {
        return defaultLicenceState();
    }

    try {
        const baseUrl = getBaseUrl();
        const response = await fetchWithRetry(`${baseUrl}/api/v1/licence/validate`, {
            licenceKey: persisted.key,
        });

        if (response.ok) {
            const data = await response.json() as {
                valid: boolean;
                product: string;
                revoked: boolean;
                issuedAt: string;
            };

            if (data.revoked || !data.valid) {
                await clearPersistedState(context.secrets);
                return invalidLicenceState();
            }

            // Update last validated timestamp
            const product = (data.product === 'pro_editor' || data.product === 'pro_ai_sync')
                ? data.product as LicenceProduct
                : null;
            const state: LicenceState = { status: 'valid', product };
            await context.secrets.store(SECRET_LAST_VALIDATED, Date.now().toString());
            await context.secrets.store(SECRET_LICENCE_STATE, JSON.stringify(state));
            return state;
        }

        if (response.status === 403 || response.status === 404) {
            await clearPersistedState(context.secrets);
            return invalidLicenceState();
        }

        throw new Error(`Unexpected status ${response.status}`);

    } catch {
        // Server unreachable — fall back to format check on persisted key
        return applyFormatFallback(context.secrets, persisted.key ?? '');
    }
}

// ── Offline format fallback ─────────────────────────────────────────────────

/**
 * When the server is unreachable, grant Pro Editor access if the key
 * passes the ASNO-XXXX-XXXX-XXXX-XXXX format check. This is a temporary
 * fallback until cryptographic offline keys are implemented.
 *
 * Persists the resulting state to SecretStorage so it survives restarts.
 */
async function applyFormatFallback(secrets: vscode.SecretStorage, key: string): Promise<LicenceState> {
    if (validateLicenceKeyFormat(key) === 'valid') {
        const state: LicenceState = { status: 'valid', product: 'pro_editor', serverUnreachable: true };
        await persistLicenceState(secrets, '', key, state);
        return state;
    }
    return { ...defaultLicenceState(), serverUnreachable: true };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getOsPlatformLabel(): string {
    switch (process.platform) {
        case 'win32': return 'Windows';
        case 'darwin': return 'macOS';
        case 'linux': return 'Linux';
        default: return process.platform;
    }
}
