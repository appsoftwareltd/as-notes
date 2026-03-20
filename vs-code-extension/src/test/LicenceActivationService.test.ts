import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock vscode module (must be before importing the service) ──────────────

const mockSecrets = new Map<string, string>();
const secretStorageMock = {
    get: vi.fn(async (key: string) => mockSecrets.get(key)),
    store: vi.fn(async (key: string, value: string) => { mockSecrets.set(key, value); }),
    delete: vi.fn(async (key: string) => { mockSecrets.delete(key); }),
};

let mockLicenceKeySetting = '';

vi.mock('vscode', () => ({
    env: { machineId: 'test-machine-id' },
    version: '1.95.0',
    workspace: {
        getConfiguration: () => ({
            get: (_key: string, defaultValue: string) => mockLicenceKeySetting || defaultValue,
        }),
    },
}), { virtual: true });

// ── Mock SignedLicenceService ──────────────────────────────────────────────

const mockVerifyResult = vi.fn();

vi.mock('../SignedLicenceService.js', () => ({
    verifyLicenceKey: (...args: unknown[]) => mockVerifyResult(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function buildContext(): { secrets: typeof secretStorageMock; extension: { id: string } } {
    return {
        secrets: secretStorageMock,
        extension: { id: 'appsoftwareltd.as-notes' },
    } as any;
}

function validResult(product: string = 'pro_editor') {
    return { valid: true, product, serial: 12345, issuedAt: new Date() };
}

// ── Import the module under test (after mocks) ────────────────────────────

import {
    activateLicenceKey,
    checkServerForRevocation,
    loadCachedLicenceState,
    migrateOldSecrets,
    verifyLicenceFromSettings,
} from '../LicenceActivationService.js';

// ── Test suites ────────────────────────────────────────────────────────────

describe('activateLicenceKey', () => {

    beforeEach(() => {
        mockSecrets.clear();
        vi.restoreAllMocks();
        mockVerifyResult.mockReturnValue({ valid: false });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('returns not-entered for empty key and clears secrets', async () => {
        mockSecrets.set('as-notes.licenceKey', 'old-key');
        const result = await activateLicenceKey('', buildContext() as any);
        expect(result.status).toBe('not-entered');
        expect(result.product).toBeNull();
        expect(mockSecrets.has('as-notes.licenceKey')).toBe(false);
    });

    it('returns not-entered for whitespace-only key', async () => {
        const result = await activateLicenceKey('   ', buildContext() as any);
        expect(result.status).toBe('not-entered');
    });

    it('returns invalid when crypto verification fails', async () => {
        mockVerifyResult.mockReturnValue({ valid: false });
        const result = await activateLicenceKey('ASNO-INVALID-KEY', buildContext() as any);
        expect(result.status).toBe('invalid');
        expect(result.product).toBeNull();
        expect(mockSecrets.has('as-notes.licenceKey')).toBe(false);
    });

    it('returns valid pro_editor when server confirms (200)', async () => {
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

        const result = await activateLicenceKey('ASNO-VALID-KEY', buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_editor');
    });

    it('returns valid pro_ai_sync when server confirms (200)', async () => {
        mockVerifyResult.mockReturnValue(validResult('pro_ai_sync'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

        const result = await activateLicenceKey('ASNO-VALID-KEY', buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_ai_sync');
    });

    it('returns invalid when server reports 403 (revoked)', async () => {
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

        const result = await activateLicenceKey('ASNO-VALID-KEY', buildContext() as any);
        expect(result.status).toBe('invalid');
        expect(result.product).toBeNull();
        expect(mockSecrets.has('as-notes.licenceKey')).toBe(false);
        expect(mockSecrets.has('as-notes.licenceState')).toBe(false);
    });

    it('returns invalid when server reports 404 (not found)', async () => {
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

        const result = await activateLicenceKey('ASNO-VALID-KEY', buildContext() as any);
        expect(result.status).toBe('invalid');
        expect(result.product).toBeNull();
    });

    it('returns valid when server returns 500 (optimistic)', async () => {
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

        const result = await activateLicenceKey('ASNO-VALID-KEY', buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_editor');
    });

    it('persists state to SecretStorage on success', async () => {
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

        await activateLicenceKey('ASNO-VALID-KEY', buildContext() as any);
        expect(mockSecrets.get('as-notes.licenceKey')).toBe('ASNO-VALID-KEY');
        const state = JSON.parse(mockSecrets.get('as-notes.licenceState')!);
        expect(state.status).toBe('valid');
        expect(state.product).toBe('pro_editor');
    });

    it('does not have serverUnreachable field in state', async () => {
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

        const result = await activateLicenceKey('ASNO-VALID-KEY', buildContext() as any);
        expect(result).not.toHaveProperty('serverUnreachable');
    });

    it('returns valid when server is unreachable (offline-first)', async () => {
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        const result = await activateLicenceKey('ASNO-VALID-KEY', buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_editor');
    });

    it('trims whitespace from key before verification', async () => {
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

        await activateLicenceKey('  ASNO-VALID-KEY  ', buildContext() as any);
        expect(mockVerifyResult).toHaveBeenCalledWith('ASNO-VALID-KEY');
    });

    it('clears previous state when new key is invalid', async () => {
        // Pre-populate with a valid state
        mockSecrets.set('as-notes.licenceKey', 'old-key');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        mockVerifyResult.mockReturnValue({ valid: false });
        await activateLicenceKey('ASNO-BAD-KEY', buildContext() as any);
        expect(mockSecrets.has('as-notes.licenceKey')).toBe(false);
        expect(mockSecrets.has('as-notes.licenceState')).toBe(false);
    });
});

describe('loadCachedLicenceState', () => {

    beforeEach(() => {
        mockSecrets.clear();
    });

    it('returns defaultLicenceState when nothing is cached', async () => {
        const result = await loadCachedLicenceState(buildContext() as any);
        expect(result.status).toBe('not-entered');
        expect(result.product).toBeNull();
    });

    it('returns persisted state when available', async () => {
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_ai_sync' }));
        const result = await loadCachedLicenceState(buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_ai_sync');
    });
});

describe('checkServerForRevocation', () => {

    beforeEach(() => {
        mockSecrets.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('returns defaultLicenceState when no key is persisted', async () => {
        const result = await checkServerForRevocation(buildContext() as any);
        expect(result.status).toBe('not-entered');
    });

    it('returns current state when server confirms (200 OK)', async () => {
        mockSecrets.set('as-notes.licenceKey', 'ASNO-KEY');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

        const result = await checkServerForRevocation(buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_editor');
        // lastServerCheck should be set
        expect(mockSecrets.has('as-notes.lastServerCheck')).toBe(true);
    });

    it('returns invalid and clears state on 403 (revoked)', async () => {
        mockSecrets.set('as-notes.licenceKey', 'ASNO-KEY');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

        const result = await checkServerForRevocation(buildContext() as any);
        expect(result.status).toBe('invalid');
        expect(mockSecrets.has('as-notes.licenceKey')).toBe(false);
    });

    it('returns invalid and clears state on 404 (not found)', async () => {
        mockSecrets.set('as-notes.licenceKey', 'ASNO-KEY');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

        const result = await checkServerForRevocation(buildContext() as any);
        expect(result.status).toBe('invalid');
    });

    it('returns current state when server is unreachable (optimistic)', async () => {
        mockSecrets.set('as-notes.licenceKey', 'ASNO-KEY');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_ai_sync' }));

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        const result = await checkServerForRevocation(buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_ai_sync');
    });

    it('returns current state on 500 server error (optimistic)', async () => {
        mockSecrets.set('as-notes.licenceKey', 'ASNO-KEY');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

        const result = await checkServerForRevocation(buildContext() as any);
        expect(result.status).toBe('valid');
    });
});

describe('verifyLicenceFromSettings', () => {

    beforeEach(() => {
        mockSecrets.clear();
        vi.restoreAllMocks();
        mockLicenceKeySetting = '';
        mockVerifyResult.mockReturnValue({ valid: false });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        mockLicenceKeySetting = '';
    });

    it('returns not-entered and clears secrets when setting is empty', async () => {
        mockLicenceKeySetting = '';
        mockSecrets.set('as-notes.licenceKey', 'old-key');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));

        const result = await verifyLicenceFromSettings(buildContext() as any);
        expect(result.status).toBe('not-entered');
        expect(result.product).toBeNull();
        expect(mockSecrets.has('as-notes.licenceKey')).toBe(false);
        expect(mockSecrets.has('as-notes.licenceState')).toBe(false);
    });

    it('returns invalid and clears secrets when key fails verification', async () => {
        mockLicenceKeySetting = 'ASNO-BAD-KEY';
        mockVerifyResult.mockReturnValue({ valid: false });

        const result = await verifyLicenceFromSettings(buildContext() as any);
        expect(result.status).toBe('invalid');
        expect(result.product).toBeNull();
        expect(mockSecrets.has('as-notes.licenceKey')).toBe(false);
    });

    it('returns valid pro_editor and persists state when key is valid', async () => {
        mockLicenceKeySetting = 'ASNO-VALID-KEY';
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));

        const result = await verifyLicenceFromSettings(buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_editor');
        expect(mockSecrets.get('as-notes.licenceKey')).toBe('ASNO-VALID-KEY');
        const persisted = JSON.parse(mockSecrets.get('as-notes.licenceState')!);
        expect(persisted.status).toBe('valid');
        expect(persisted.product).toBe('pro_editor');
    });

    it('returns valid pro_ai_sync when key has that product', async () => {
        mockLicenceKeySetting = 'ASNO-AI-KEY';
        mockVerifyResult.mockReturnValue(validResult('pro_ai_sync'));

        const result = await verifyLicenceFromSettings(buildContext() as any);
        expect(result.status).toBe('valid');
        expect(result.product).toBe('pro_ai_sync');
    });

    it('trims whitespace from the setting value', async () => {
        mockLicenceKeySetting = '  ASNO-VALID-KEY  ';
        mockVerifyResult.mockReturnValue(validResult('pro_editor'));

        await verifyLicenceFromSettings(buildContext() as any);
        expect(mockVerifyResult).toHaveBeenCalledWith('ASNO-VALID-KEY');
    });

    it('clears stale cached state when key is now invalid', async () => {
        // Simulate old cached valid state from pre-crypto era
        mockSecrets.set('as-notes.licenceKey', 'old-key');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));
        mockSecrets.set('as-notes.lastServerCheck', '12345');

        mockLicenceKeySetting = 'old-key';
        mockVerifyResult.mockReturnValue({ valid: false });

        const result = await verifyLicenceFromSettings(buildContext() as any);
        expect(result.status).toBe('invalid');
        expect(mockSecrets.has('as-notes.licenceKey')).toBe(false);
        expect(mockSecrets.has('as-notes.licenceState')).toBe(false);
        expect(mockSecrets.has('as-notes.lastServerCheck')).toBe(false);
    });
});

describe('migrateOldSecrets', () => {

    beforeEach(() => {
        mockSecrets.clear();
    });

    it('removes legacy activationToken and lastValidated keys', async () => {
        mockSecrets.set('as-notes.activationToken', 'old-jwt');
        mockSecrets.set('as-notes.lastValidated', '12345');

        await migrateOldSecrets(secretStorageMock as any);

        expect(mockSecrets.has('as-notes.activationToken')).toBe(false);
        expect(mockSecrets.has('as-notes.lastValidated')).toBe(false);
    });

    it('does not throw when legacy keys do not exist', async () => {
        await expect(migrateOldSecrets(secretStorageMock as any)).resolves.not.toThrow();
    });

    it('preserves new keys during migration', async () => {
        mockSecrets.set('as-notes.licenceKey', 'ASNO-KEY');
        mockSecrets.set('as-notes.licenceState', JSON.stringify({ status: 'valid', product: 'pro_editor' }));
        mockSecrets.set('as-notes.activationToken', 'old-jwt');

        await migrateOldSecrets(secretStorageMock as any);

        expect(mockSecrets.get('as-notes.licenceKey')).toBe('ASNO-KEY');
        expect(mockSecrets.has('as-notes.activationToken')).toBe(false);
    });
});
