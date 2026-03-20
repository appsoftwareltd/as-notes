/**
 * LicenceActivationService -- handles licence activation using Ed25519
 * cryptographic offline verification, with background server notification
 * for tracking and revocation.
 *
 * ## Flow
 *
 *   1. User enters licence key (ASNO-XXXX-XXXX-...-XXXX).
 *   2. Extension verifies the Ed25519 signature locally (instant, offline).
 *   3. On success, state is persisted to SecretStorage and the user gets
 *      immediate access to Pro features.
 *   4. A background POST to the server records the activation for analytics
 *      and revocation tracking. Failure is non-blocking.
 *   5. A periodic background check (every 7 days) POSTs to the server to
 *      detect revocation.
 *
 * ## Migration
 *
 *   Old SecretStorage keys (activationToken, lastValidated) are cleaned
 *   up on first launch after upgrade via `migrateOldSecrets()`.
 */

import * as vscode from 'vscode';
import { verifyLicenceKey, type VerifyResult } from './SignedLicenceService.js';
import {
    defaultLicenceState,
    invalidLicenceState,
    type LicenceState,
    type LicenceProduct,
} from './LicenceService.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SECRET_LICENCE_KEY = 'as-notes.licenceKey';
const SECRET_LICENCE_STATE = 'as-notes.licenceState';
const SECRET_LAST_SERVER_CHECK = 'as-notes.lastServerCheck';

/** Legacy keys from the JWT-based system -- cleaned up on migration. */
const LEGACY_SECRET_KEYS = [
    'as-notes.activationToken',
    'as-notes.lastValidated',
];

const DEFAULT_BASE_URL = 'https://www.asnotes.io';

// ── Base URL resolution ────────────────────────────────────────────────────

function getBaseUrl(): string {
    return process.env.AS_NOTES_LICENCE_SERVER_URL || DEFAULT_BASE_URL;
}

// ── Persisted state helpers ────────────────────────────────────────────────

async function persistLicenceState(
    secrets: vscode.SecretStorage,
    key: string,
    state: LicenceState,
): Promise<void> {
    await secrets.store(SECRET_LICENCE_KEY, key);
    await secrets.store(SECRET_LICENCE_STATE, JSON.stringify(state));
}

async function clearPersistedState(secrets: vscode.SecretStorage): Promise<void> {
    await secrets.delete(SECRET_LICENCE_KEY);
    await secrets.delete(SECRET_LICENCE_STATE);
    await secrets.delete(SECRET_LAST_SERVER_CHECK);
}

async function loadPersistedState(secrets: vscode.SecretStorage): Promise<{
    key: string | undefined;
    state: LicenceState | undefined;
    lastServerCheck: number | undefined;
}> {
    const key = await secrets.get(SECRET_LICENCE_KEY);
    const stateStr = await secrets.get(SECRET_LICENCE_STATE);
    const lastCheckStr = await secrets.get(SECRET_LAST_SERVER_CHECK);

    return {
        key,
        state: stateStr ? JSON.parse(stateStr) as LicenceState : undefined,
        lastServerCheck: lastCheckStr ? parseInt(lastCheckStr, 10) : undefined,
    };
}

// ── Migration ──────────────────────────────────────────────────────────────

/**
 * Remove legacy SecretStorage keys from the JWT-based system.
 * Safe to call multiple times -- deleting a non-existent key is a no-op.
 */
export async function migrateOldSecrets(
    secrets: vscode.SecretStorage,
): Promise<void> {
    for (const key of LEGACY_SECRET_KEYS) {
        await secrets.delete(key);
    }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Verify the licence key from VS Code settings on startup.
 *
 * Reads `as-notes.licenceKey` from configuration, verifies it
 * cryptographically (instant, offline), persists the result to
 * SecretStorage, and returns the derived LicenceState.
 *
 * This replaces `loadCachedLicenceState` -- instead of trusting a cached
 * SecretStorage value, the extension always re-derives state from the
 * canonical settings key. This eliminates race conditions with
 * SecretStorage async IPC and ensures old-format keys are immediately
 * rejected after upgrade.
 */
export async function verifyLicenceFromSettings(
    context: vscode.ExtensionContext,
): Promise<LicenceState> {
    const key = vscode.workspace.getConfiguration('as-notes').get<string>('licenceKey', '').trim();

    if (!key) {
        await clearPersistedState(context.secrets);
        return defaultLicenceState();
    }

    const result = verifyLicenceKey(key);
    if (!result.valid) {
        await clearPersistedState(context.secrets);
        return invalidLicenceState();
    }

    const product = result.product as LicenceProduct;
    const state: LicenceState = { status: 'valid', product };
    await persistLicenceState(context.secrets, key, state);
    return state;
}

/**
 * Load the cached licence state from SecretStorage without any verification.
 * Used by periodic revocation checks. Returns defaultLicenceState() if
 * nothing is cached.
 */
export async function loadCachedLicenceState(
    context: vscode.ExtensionContext,
): Promise<LicenceState> {
    const persisted = await loadPersistedState(context.secrets);
    return persisted.state ?? defaultLicenceState();
}

/**
 * Activate a licence key: verify cryptographically, persist state, and
 * fire a background server notification.
 *
 * Returns the resulting LicenceState immediately after local verification.
 * The server POST happens in the background and does not block the result.
 */
export async function activateLicenceKey(
    key: string,
    context: vscode.ExtensionContext,
): Promise<LicenceState> {
    const trimmed = key.trim();

    // Not entered -- clear persisted state.
    if (!trimmed) {
        await clearPersistedState(context.secrets);
        return defaultLicenceState();
    }

    // Verify the key cryptographically (offline, instant).
    const result = verifyLicenceKey(trimmed);
    if (!result.valid) {
        await clearPersistedState(context.secrets);
        return invalidLicenceState();
    }

    // Build and persist valid state.
    const product = result.product as LicenceProduct;
    const state: LicenceState = { status: 'valid', product };
    await persistLicenceState(context.secrets, trimmed, state);

    // Background server notification (non-blocking).
    notifyServer(trimmed, context).catch(() => {
        // Silently ignore -- server activation is best-effort.
    });

    return state;
}

/**
 * Periodic server check for revocation. Call this every 7 days.
 *
 * If the server reports the key as revoked, clears state and returns
 * an invalid LicenceState. If the server is unreachable, returns the
 * current cached state unchanged (optimistic).
 */
export async function checkServerForRevocation(
    context: vscode.ExtensionContext,
): Promise<LicenceState> {
    const persisted = await loadPersistedState(context.secrets);

    if (!persisted.key || !persisted.state || persisted.state.status !== 'valid') {
        return persisted.state ?? defaultLicenceState();
    }

    try {
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/v1/licence/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                licenceKey: persisted.key,
                deviceId: vscode.env.machineId,
                deviceInfo: `VS Code ${vscode.version} / ${getOsPlatformLabel()}`,
            }),
            signal: AbortSignal.timeout(10_000),
        });

        // Record successful server contact.
        await context.secrets.store(SECRET_LAST_SERVER_CHECK, Date.now().toString());

        if (response.ok) {
            // Server confirmed -- keep current state.
            return persisted.state;
        }

        if (response.status === 403 || response.status === 404) {
            // Revoked or not found -- invalidate.
            await clearPersistedState(context.secrets);
            return invalidLicenceState();
        }

        // Other errors -- keep current state (optimistic).
        return persisted.state;
    } catch {
        // Server unreachable -- keep current state (optimistic).
        return persisted.state;
    }
}

// ── Background server notification ─────────────────────────────────────────

async function notifyServer(
    key: string,
    context: vscode.ExtensionContext,
): Promise<void> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/licence/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            licenceKey: key,
            deviceId: vscode.env.machineId,
            deviceInfo: `VS Code ${vscode.version} / ${getOsPlatformLabel()}`,
        }),
        signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
        await context.secrets.store(SECRET_LAST_SERVER_CHECK, Date.now().toString());
    }
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
