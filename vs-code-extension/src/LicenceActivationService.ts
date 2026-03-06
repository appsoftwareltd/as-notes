/**
 * LicenceActivationService — handles licence activation with optional server
 * verification and persistent token storage via VS Code SecretStorage.
 *
 * ## Architecture (Option A)
 *
 * The long-term design is:
 *   1. User enters licence key in settings.
 *   2. Extension calls the activation server ONCE → server records the activation
 *      and returns a signed token (Ed25519/HMAC).
 *   3. Signed token is stored in VS Code's `SecretStorage` (OS keychain, encrypted).
 *   4. On every subsequent startup the token is verified locally against the
 *      baked-in public key — no further network calls.
 *
 * ## Current state (stub — server not yet available)
 *
 * The activation server is not yet built.  This stub preserves the full
 * structure of Option A without any network call:
 *
 *   - First activation:  validates the key locally (format check only),
 *     then writes a stub token (`stub:<base64(key)>`) to SecretStorage.
 *   - Subsequent startups:  reads the stored token, checks it matches the
 *     current key, and falls back to local validation.
 *
 * **Replacing the stub:** When the server is ready, replace `_callServer()`
 * with a real HTTP call and replace `_verifyToken()` with Ed25519/HMAC
 * signature verification against the baked-in public key.  All call sites
 * remain unchanged.
 */

import * as vscode from 'vscode';
import { validateLicenceKey, type LicenceStatus } from './LicenceService.js';

const SECRET_KEY = 'as-notes.activationToken';

/**
 * Determine the licence status for the given key, using a stored activation
 * token where available.
 *
 * On the FIRST call with a valid key the result is persisted to SecretStorage
 * so subsequent calls skip re-validation.
 *
 * Call this on every activation and configuration change — it is safe to
 * call repeatedly.
 */
export async function activateWithServer(
    key: string,
    context: vscode.ExtensionContext,
): Promise<LicenceStatus> {
    // Not entered — clear any stale token and return early.
    const localStatus = validateLicenceKey(key);
    if (localStatus === 'not-entered') {
        await context.secrets.delete(SECRET_KEY);
        return 'not-entered';
    }

    // Format is invalid — no point storing or checking a token.
    if (localStatus === 'invalid') {
        await context.secrets.delete(SECRET_KEY);
        return 'invalid';
    }

    // Key is locally valid — check whether we already have a stored token for it.
    const storedToken = await context.secrets.get(SECRET_KEY);
    if (storedToken && _verifyToken(storedToken, key)) {
        // Previously activated and token still matches — no server call needed.
        return 'valid';
    }

    // No valid stored token found — run "activation" (stub: local only).
    // REPLACE THIS with a real server call when the activation API is available.
    const serverStatus = await _callServer(key);

    if (serverStatus === 'valid') {
        // Persist the token so future startups skip network/validation work.
        await context.secrets.store(SECRET_KEY, _buildToken(key));
    } else {
        await context.secrets.delete(SECRET_KEY);
    }

    return serverStatus;
}

// ── Stub internals (replace when server is available) ─────────────────────

/**
 * Stub implementation of the server call.
 *
 * REPLACE with a real HTTP request to the activation endpoint.
 * The server should record the activation and return a signed token.
 * This function should return the validated `LicenceStatus` based on the
 * server's response.
 */
async function _callServer(_key: string): Promise<LicenceStatus> {
    // TODO: replace with real HTTP call + signed token handling.
    // For now, local validation IS the "server" response.
    return validateLicenceKey(_key);
}

/**
 * Build a stub token from the key.
 *
 * REPLACE with storage of the real signed token returned by the server.
 * The real token will be an opaque string (e.g. JWT or raw Ed25519 signature)
 * that can be verified against the baked-in public key without calling home.
 */
function _buildToken(key: string): string {
    // Stub: prefix makes it obvious this is not a real server token.
    return `stub:${Buffer.from(key, 'utf8').toString('base64')}`;
}

/**
 * Verify that a stored token matches the current key.
 *
 * REPLACE with Ed25519/HMAC signature verification against the baked-in
 * public key once the server returns real tokens.
 */
function _verifyToken(token: string, key: string): boolean {
    // Stub: token is `stub:<base64(key)>` — check both prefix and key match.
    const expected = `stub:${Buffer.from(key, 'utf8').toString('base64')}`;
    return token === expected;
}
