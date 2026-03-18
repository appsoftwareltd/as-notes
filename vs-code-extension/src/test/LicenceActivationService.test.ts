import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock vscode module (must be before importing the service) ──────────────

const mockSecrets = new Map<string, string>();
const secretStorageMock = {
    get: vi.fn(async (key: string) => mockSecrets.get(key)),
    store: vi.fn(async (key: string, value: string) => { mockSecrets.set(key, value); }),
    delete: vi.fn(async (key: string) => { mockSecrets.delete(key); }),
};

vi.mock('vscode', () => ({
    env: { machineId: 'test-machine-id' },
    version: '1.95.0',
}), { virtual: true });

// ── Helpers ────────────────────────────────────────────────────────────────

const VALID_KEY = 'ASNO-A1B2-C3D4-E5F6-7890';

/**
 * Build a minimal JWT token with the given payload claims.
 * No real signing — just base64url-encoded header.payload.signature.
 */
function buildTestJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.fake-signature`;
}

function futureUnix(days: number): number {
    return Math.floor((Date.now() + days * 86_400_000) / 1000);
}

function pastUnix(days: number): number {
    return Math.floor((Date.now() - days * 86_400_000) / 1000);
}

function buildContext(): { secrets: typeof secretStorageMock; extension: { id: string } } {
    return {
        secrets: secretStorageMock,
        extension: { id: 'appsoftwareltd.as-notes' },
    } as any;
}

// ── Import the module under test (after mocks) ────────────────────────────

import { activateWithServer, validateWithServer } from '../LicenceActivationService.js';

// ── Test suites ────────────────────────────────────────────────────────────

describe('activateWithServer', () => {

    beforeEach(() => {
        mockSecrets.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns not-entered for empty key and clears secrets', async () => {
        mockSecrets.set('as-notes.activationToken', 'old-token');
        const result = await activateWithServer('', buildContext() as any);
        expect(result.status).toBe('not-entered');
        expect(result.product).toBeNull();
        expect(mockSecrets.has('as-notes.activationToken')).toBe(false);
    });

    it('returns invalid for malformed key', async () => {
        const result = await activateWithServer('bad-key', buildContext() as any);
        expect(result.status).toBe('invalid');
        expect(result.product).toBeNull();
    });

    it('uses cached token when present, matching key, and not expired', async () => {
        const token = buildTestJwt({
            sub: 'user1',
            licenceKey: VALID_KEY,
            product: 'pro_editor',
            exp: futureUnix(30),
        });
        const state = JSON.stringify({ status: 'valid', product: 'pro_editor' });
        mockSecrets.set('as-notes.activationToken', token);
        mockSecrets.set('as-notes.licenceKey', VALID_KEY);
        mockSecrets.set('as-notes.lastValidated', Date.now().toString());
        mockSecrets.set('as-notes.licenceState', state);

        const result = await activateWithServer(VALID_KEY, buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_editor');
    });

    it('calls server when cached token is for a different key', async () => {
        const token = buildTestJwt({
            product: 'pro_editor',
            exp: futureUnix(30),
        });
        mockSecrets.set('as-notes.activationToken', token);
        mockSecrets.set('as-notes.licenceKey', 'ASNO-1111-2222-3333-4444');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        // Mock fetch — return a successful activation
        const newToken = buildTestJwt({
            product: 'pro_ai_sync',
            exp: futureUnix(365),
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ token: newToken, expiresAt: '2027-03-16T12:00:00.000Z' }),
        }));

        const result = await activateWithServer(VALID_KEY, buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_ai_sync');
        expect(mockSecrets.get('as-notes.activationToken')).toBe(newToken);
        expect(mockSecrets.get('as-notes.licenceKey')).toBe(VALID_KEY);

        vi.unstubAllGlobals();
    });

    it('calls server on successful activation and persists state', async () => {
        const serverToken = buildTestJwt({
            product: 'pro_editor',
            exp: futureUnix(365),
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ token: serverToken, expiresAt: '2027-03-16T12:00:00.000Z' }),
        }));

        const result = await activateWithServer(VALID_KEY, buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_editor');
        expect(mockSecrets.get('as-notes.activationToken')).toBe(serverToken);

        vi.unstubAllGlobals();
    });

    it('returns invalid and clears state on 403 (revoked)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ error: 'This licence key has been revoked' }),
        }));

        const result = await activateWithServer(VALID_KEY, buildContext() as any);
        expect(result.status).toBe('invalid');
        expect(mockSecrets.has('as-notes.activationToken')).toBe(false);

        vi.unstubAllGlobals();
    });

    it('returns invalid and clears state on 404 (not found)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ error: 'Licence key not found' }),
        }));

        const result = await activateWithServer(VALID_KEY, buildContext() as any);
        expect(result.status).toBe('invalid');

        vi.unstubAllGlobals();
    });

    it('applies grace period when server is unreachable and within 7 days', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const now = Date.now();
        const token = buildTestJwt({
            product: 'pro_editor',
            exp: pastUnix(1), // expired
        });
        mockSecrets.set('as-notes.activationToken', token);
        mockSecrets.set('as-notes.licenceKey', VALID_KEY);
        mockSecrets.set('as-notes.lastValidated', (now - 2 * 86_400_000).toString()); // 2 days ago
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        const resultPromise = activateWithServer(VALID_KEY, buildContext() as any);
        // Advance past all retry delays (1s + 4s + 16s)
        await vi.advanceTimersByTimeAsync(25_000);
        const result = await resultPromise;
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_editor');

        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('returns not-entered when grace period exceeded', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const now = Date.now();
        const token = buildTestJwt({
            product: 'pro_editor',
            exp: pastUnix(1),
        });
        mockSecrets.set('as-notes.activationToken', token);
        mockSecrets.set('as-notes.licenceKey', VALID_KEY);
        mockSecrets.set('as-notes.lastValidated', (now - 8 * 86_400_000).toString()); // 8 days ago
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        const resultPromise = activateWithServer(VALID_KEY, buildContext() as any);
        await vi.advanceTimersByTimeAsync(25_000);
        const result = await resultPromise;
        expect(result.status).toBe('not-entered'); // falls back to default
        expect(result.product).toBeNull();

        vi.unstubAllGlobals();
        vi.useRealTimers();
    });
});

describe('validateWithServer', () => {

    beforeEach(() => {
        mockSecrets.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns not-entered when no persisted key/token', async () => {
        const result = await validateWithServer(buildContext() as any);
        expect(result.status).toBe('not-entered');
    });

    it('returns valid and updates lastValidated on successful validation', async () => {
        const token = buildTestJwt({ product: 'pro_ai_sync', exp: futureUnix(365) });
        mockSecrets.set('as-notes.activationToken', token);
        mockSecrets.set('as-notes.licenceKey', VALID_KEY);
        mockSecrets.set('as-notes.lastValidated', (Date.now() - 86_400_000).toString());

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                valid: true,
                product: 'pro_ai_sync',
                revoked: false,
                issuedAt: '2026-03-16T12:00:00.000Z',
            }),
        }));

        const result = await validateWithServer(buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_ai_sync');

        // lastValidated should be updated
        const lv = parseInt(mockSecrets.get('as-notes.lastValidated')!, 10);
        expect(lv).toBeGreaterThan(Date.now() - 5_000);

        vi.unstubAllGlobals();
    });

    it('returns invalid and clears state when licence is revoked', async () => {
        const token = buildTestJwt({ product: 'pro_editor', exp: futureUnix(365) });
        mockSecrets.set('as-notes.activationToken', token);
        mockSecrets.set('as-notes.licenceKey', VALID_KEY);

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                valid: false,
                product: 'pro_editor',
                revoked: true,
                issuedAt: '2026-03-16T12:00:00.000Z',
            }),
        }));

        const result = await validateWithServer(buildContext() as any);
        expect(result.status).toBe('invalid');
        expect(mockSecrets.has('as-notes.activationToken')).toBe(false);

        vi.unstubAllGlobals();
    });

    it('applies grace period when server unreachable during validation', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const now = Date.now();
        const token = buildTestJwt({ product: 'pro_editor', exp: futureUnix(365) });
        mockSecrets.set('as-notes.activationToken', token);
        mockSecrets.set('as-notes.licenceKey', VALID_KEY);
        mockSecrets.set('as-notes.lastValidated', (now - 86_400_000).toString()); // 1 day ago
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        const resultPromise = validateWithServer(buildContext() as any);
        await vi.advanceTimersByTimeAsync(25_000);
        const result = await resultPromise;
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_editor');

        vi.unstubAllGlobals();
        vi.useRealTimers();
    });
});
