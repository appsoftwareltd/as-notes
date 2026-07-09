/**
 * SafeSessionService - owns the *unlocked* safe for the lifetime of a session.
 *
 * Holds the decrypted `kdbxweb.Kdbx` in the extension host (never the webview),
 * resolves the safe and key-file paths from `workspaceState` (per-machine,
 * unsynced - see ADR-0004), and enforces the lock lifecycle: auto-lock on idle,
 * dirty-gated saves, and a full wipe on lock. UI layers (tree, editor panel)
 * read the live db through this service and never cache decrypted state.
 */

import * as vscode from 'vscode';
import type * as kdbxweb from 'kdbxweb';
import { LogService } from './LogService';
import { openSafe, saveSafe } from './SafeService';

export type LockReason = 'manual' | 'idle' | 'window' | 'error';

export class SafeSessionService {
    private _db: kdbxweb.Kdbx | null = null;
    private _dirty = false;
    private _idleTimer: NodeJS.Timeout | undefined;

    private readonly _onDidChangeState = new vscode.EventEmitter<void>();
    /** Fires whenever the safe locks or unlocks, so views can refresh. */
    readonly onDidChangeState = this._onDidChangeState.event;

    /**
     * Optional hook run just before a save-on-lock, while the db is still open -
     * used to commit open editor drafts so they aren't lost when the safe locks.
     */
    onBeforeSaveOnLock: (() => Promise<void>) | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly log: LogService,
    ) {}

    // ── State ────────────────────────────────────────────────────────────────

    get isUnlocked(): boolean {
        return this._db !== null;
    }

    get isDirty(): boolean {
        return this._dirty;
    }

    /** The live decrypted database. Throws if the safe is locked. */
    get db(): kdbxweb.Kdbx {
        if (!this._db) {
            throw new Error('The safe is locked.');
        }
        return this._db;
    }

    // ── Paths (workspaceState - per-machine, never committed) ─────────────────

    getSafePath(): string | undefined {
        return this.context.workspaceState.get<string>('as-notes.safe.path');
    }

    async setSafePath(path: string): Promise<void> {
        await this.context.workspaceState.update('as-notes.safe.path', path);
    }

    getKeyFilePath(): string | undefined {
        return this.context.workspaceState.get<string>('as-notes.safe.keyFilePath');
    }

    async setKeyFilePath(path: string | undefined): Promise<void> {
        await this.context.workspaceState.update('as-notes.safe.keyFilePath', path);
    }

    // ── Config ────────────────────────────────────────────────────────────────

    private config() {
        const c = vscode.workspace.getConfiguration('as-notes.safe');
        return {
            autoLock: c.get<boolean>('autoLock', true),
            autoSaveOnLock: c.get<boolean>('autoSaveOnLock', true),
            autoLockTimeoutSeconds: c.get<number>('autoLockTimeoutSeconds', 300),
        };
    }

    // ── Unlock ────────────────────────────────────────────────────────────────

    /**
     * Prompt for the master password and unlock the safe at the configured path.
     * Returns true on success. Reuses the key file at the stored path if set.
     */
    async unlock(): Promise<boolean> {
        const safePath = this.getSafePath();
        if (!safePath) {
            vscode.window.showWarningMessage('AS Notes: No safe selected. Run "Select Safe File" first.');
            return false;
        }

        // First time opening this safe: make sure the user has a backup, since
        // AS Notes edits the .kdbx file in place.
        if (!(await this.confirmBackup(safePath))) {
            return false;
        }

        let bytes: Uint8Array;
        try {
            bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(safePath));
        } catch {
            vscode.window.showErrorMessage(
                `AS Notes: Could not read the safe at ${safePath}. It may have moved - re-select it.`,
            );
            return false;
        }

        const keyFile = await this.readKeyFile();
        if (keyFile === 'error') {
            return false;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Master password for the safe',
            password: true,
            ignoreFocusOut: true,
        });
        if (password === undefined) {
            return false; // cancelled
        }

        try {
            // Argon2 derivation takes a moment - show a spinner in the safe view.
            this._db = await vscode.window.withProgress(
                { location: { viewId: 'as-notes-safe' }, title: 'Unlocking safe…' },
                () => openSafe(bytes, password, keyFile ?? undefined),
            );
        } catch (err) {
            vscode.window.showErrorMessage(`AS Notes: ${(err as Error).message}`);
            return false;
        }

        this._dirty = false;
        this.resetIdleTimer();
        this._onDidChangeState.fire();
        this.log.info('safe', 'unlocked');
        return true;
    }

    /**
     * Adopt an already-decrypted db (e.g. one just created) as the session.
     * Pass `dirty` true if it has not yet been written to disk; the create flow
     * persists first and adopts clean.
     */
    adopt(db: kdbxweb.Kdbx, dirty = false): void {
        this._db = db;
        this._dirty = dirty;
        this.resetIdleTimer();
        this._onDidChangeState.fire();
        this.log.info('safe', 'adopted new safe');
    }

    /**
     * On the first open of a given safe file, require the user to confirm they
     * have a backup (AS Notes writes changes to the file in place). The
     * acknowledgement is remembered per file path, machine-wide.
     */
    private async confirmBackup(safePath: string): Promise<boolean> {
        const acknowledged = this.context.globalState.get<string[]>('as-notes.safe.backupAck', []);
        if (acknowledged.includes(safePath)) {
            return true;
        }
        const choice = await vscode.window.showWarningMessage(
            'You are opening this KeePass safe in AS Notes for the first time. '
            + 'AS Notes saves changes directly to the .kdbx file. Make sure you have a backup of it '
            + 'before you continue, in case anything goes wrong.',
            { modal: true, detail: safePath },
            'I have a backup - open',
        );
        if (choice !== 'I have a backup - open') {
            return false;
        }
        await this.acknowledgeSafe(safePath);
        return true;
    }

    /** Record that the user has acknowledged the backup warning for a safe. */
    async acknowledgeSafe(safePath: string): Promise<void> {
        const acknowledged = this.context.globalState.get<string[]>('as-notes.safe.backupAck', []);
        if (!acknowledged.includes(safePath)) {
            await this.context.globalState.update('as-notes.safe.backupAck', [...acknowledged, safePath]);
        }
    }

    /** Read the key file bytes from the stored path, or null if none configured. */
    private async readKeyFile(): Promise<Uint8Array | null | 'error'> {
        const keyPath = this.getKeyFilePath();
        if (!keyPath) {
            return null;
        }
        try {
            return await vscode.workspace.fs.readFile(vscode.Uri.file(keyPath));
        } catch {
            vscode.window.showErrorMessage(
                `AS Notes: Could not read the key file at ${keyPath}. Re-select it or clear it.`,
            );
            return 'error';
        }
    }

    // ── Save ──────────────────────────────────────────────────────────────────

    markDirty(): void {
        this._dirty = true;
    }

    /** Persist to disk only if there are genuine changes (dirty-gated). */
    async save(force = false): Promise<void> {
        if (!this._db || (!this._dirty && !force)) {
            return;
        }
        const safePath = this.getSafePath();
        if (!safePath) {
            return;
        }
        const bytes = await saveSafe(this._db);
        await vscode.workspace.fs.writeFile(vscode.Uri.file(safePath), bytes);
        this._dirty = false;
        this.log.info('safe', 'saved');
    }

    // ── Lock ──────────────────────────────────────────────────────────────────

    /**
     * Lock the safe: optionally save first, then wipe the decrypted db and stop
     * the idle timer. `save` defaults to the autoSaveOnLock setting; callers that
     * have already resolved a present-user save/discard prompt pass it explicitly.
     */
    async lock(reason: LockReason = 'manual', save?: boolean): Promise<void> {
        if (!this._db) {
            return;
        }
        const shouldSave = save ?? this.config().autoSaveOnLock;
        if (shouldSave && this.onBeforeSaveOnLock) {
            try {
                await this.onBeforeSaveOnLock(); // commit editor drafts before wiping
            } catch (err) {
                this.log.error('safe', `pre-lock commit failed: ${(err as Error).message}`);
            }
        }
        if (shouldSave && this._dirty) {
            try {
                await this.save();
            } catch (err) {
                this.log.error('safe', `save-on-lock failed: ${(err as Error).message}`);
                vscode.window.showErrorMessage(
                    `AS Notes: Failed to save the safe before locking - ${(err as Error).message}`,
                );
            }
        }
        this._db = null;
        this._dirty = false;
        this.clearIdleTimer();
        this._onDidChangeState.fire();
        this.log.info('safe', `locked (${reason})`);
    }

    // ── Idle auto-lock ────────────────────────────────────────────────────────

    /** Call on any user interaction with the safe to defer the idle lock. */
    touch(): void {
        if (this._db) {
            this.resetIdleTimer();
        }
    }

    private resetIdleTimer(): void {
        this.clearIdleTimer();
        const { autoLock, autoLockTimeoutSeconds } = this.config();
        if (!autoLock) {
            return;
        }
        const ms = Math.max(10, autoLockTimeoutSeconds) * 1000;
        this._idleTimer = setTimeout(() => {
            // Idle means the user is absent, so no save/discard prompt is possible;
            // honour autoSaveOnLock unattended (save) or discard.
            void this.lock('idle');
        }, ms);
    }

    private clearIdleTimer(): void {
        if (this._idleTimer) {
            clearTimeout(this._idleTimer);
            this._idleTimer = undefined;
        }
    }

    dispose(): void {
        this.clearIdleTimer();
        this._db = null;
        this._onDidChangeState.dispose();
    }
}
