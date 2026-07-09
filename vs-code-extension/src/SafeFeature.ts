/**
 * SafeFeature - wires the password safe into VS Code: session, sidebar tree,
 * attachment service, editor panels, and every command. Registered once from
 * extension activation (full mode). Owns the `as-notes.safe.unlocked` context
 * key that drives menu visibility.
 */

import * as vscode from 'vscode';
import { homedir } from 'os';
import { join } from 'path';
import { LogService } from './LogService';
import { SafeSessionService } from './SafeSessionService';
import { SafeTreeProvider, SafeNode, SafeDragAndDropController } from './SafeTreeProvider';
import { SafeAttachmentService } from './SafeAttachmentService';
import { SafeEditorPanel } from './SafeEditorPanel';
import { copyEphemeral } from './safeClipboard';
import {
    createSafe,
    saveSafe,
    generateKeyFile,
    fieldTextOf,
    readTotp,
    computeTotp,
} from './SafeService';
import type * as kdbxweb from 'kdbxweb';

/** The currently-registered session, for the deactivate-time flush. */
let activeSession: SafeSessionService | undefined;

/**
 * Best-effort save on window close / extension shutdown. VS Code awaits the
 * deactivate promise (briefly), so an unlocked safe with unsaved changes is
 * persisted when autoSaveOnLock is on. Not guaranteed on a crash.
 */
export async function flushSafeSessionForShutdown(): Promise<void> {
    const session = activeSession;
    if (!session?.isUnlocked) {
        return;
    }
    if (!vscode.workspace.getConfiguration('as-notes.safe').get<boolean>('autoSaveOnLock', true)) {
        return;
    }
    try {
        // Commit any open editor drafts (can't prompt during shutdown), then write.
        if (await SafeEditorPanel.commitDirtyDrafts(session)) {
            session.markDirty();
        }
        if (session.isDirty) {
            await session.save();
        }
    } catch {
        /* best effort on shutdown */
    }
}

export function registerSafeFeature(
    context: vscode.ExtensionContext,
    log: LogService,
    isPro: () => boolean,
): vscode.Disposable[] {
    const session = new SafeSessionService(context, log);
    const tree = new SafeTreeProvider(session);
    const attachments = new SafeAttachmentService(log);
    attachments.sweepOrphans();

    // Before a save-on-lock, commit any open editor drafts so edits aren't lost.
    session.onBeforeSaveOnLock = async () => {
        if (await SafeEditorPanel.commitDirtyDrafts(session)) {
            session.markDirty();
        }
    };

    const disposables: vscode.Disposable[] = [session, attachments];

    // `configured` drives the welcome view (no safe vs locked safe).
    const refreshConfigured = () =>
        void vscode.commands.executeCommand(
            'setContext',
            'as-notes.safe.configured',
            !!session.getSafePath(),
        );
    refreshConfigured();

    // Context keys + editor teardown follow lock/unlock state.
    disposables.push(
        session.onDidChangeState(() => {
            void vscode.commands.executeCommand(
                'setContext',
                'as-notes.safe.unlocked',
                session.isUnlocked,
            );
            refreshConfigured();
            if (!session.isUnlocked) {
                setFilter('');
                SafeEditorPanel.closeAll();
                attachments.wipe();
            }
        }),
    );

    // Apply a tree filter and reflect whether one is active (drives the filled
    // filter icon in the view toolbar) and what it is (in the view header).
    const setFilter = (text: string) => {
        tree.setFilter(text);
        void vscode.commands.executeCommand('setContext', 'as-notes.safe.filtered', !!text.trim());
        updateHeader();
    };

    const treeView = vscode.window.createTreeView('as-notes-safe', {
        treeDataProvider: tree,
        canSelectMany: true,
        dragAndDropController: new SafeDragAndDropController(session, () => tree.refresh()),
    });
    disposables.push(treeView);

    // View header (description): shows the safe path while locked, and the active
    // filter text while unlocked and filtering. Uses description rather than
    // message so it never suppresses the welcome buttons.
    function updateHeader() {
        if (!session.isUnlocked) {
            const path = session.getSafePath();
            treeView.description = path ?? undefined;
        } else {
            treeView.description = tree.filterText ? `Filter: ${tree.filterText}` : undefined;
        }
    }
    updateHeader();
    disposables.push(session.onDidChangeState(updateHeader));

    // The safe is a Pro feature (like encrypted notes); gate every command.
    void vscode.commands.executeCommand('setContext', 'as-notes.safe.pro', isPro());
    const reg = (id: string, fn: (...args: unknown[]) => unknown) =>
        disposables.push(
            vscode.commands.registerCommand(id, (...args: unknown[]) => {
                if (!isPro()) {
                    vscode.window.showWarningMessage(
                        'AS Notes: The password safe requires a Pro licence.',
                    );
                    return;
                }
                session.touch(); // any command counts as activity
                return fn(...args);
            }),
        );

    // Expose the session for a best-effort flush on window close (see deactivate).
    activeSession = session;
    disposables.push({ dispose: () => { if (activeSession === session) { activeSession = undefined; } } });

    const requireUnlocked = (): boolean => {
        session.touch();
        if (!session.isUnlocked) {
            vscode.window.showWarningMessage('AS Notes: Unlock the safe first.');
            return false;
        }
        return true;
    };

    const entryOf = (node: unknown): kdbxweb.KdbxEntry | undefined =>
        node && (node as SafeNode).kind === 'entry' ? (node as { entry: kdbxweb.KdbxEntry }).entry : undefined;

    const groupOf = (node: unknown): kdbxweb.KdbxGroup | undefined =>
        node && (node as SafeNode).kind === 'group' ? (node as { group: kdbxweb.KdbxGroup }).group : undefined;

    const targetGroup = (node: unknown): kdbxweb.KdbxGroup => {
        if (node && (node as SafeNode).kind === 'group') {
            return (node as { group: kdbxweb.KdbxGroup }).group;
        }
        if (node && (node as SafeNode).kind === 'entry') {
            const parent = (node as { entry: kdbxweb.KdbxEntry }).entry.parentGroup;
            if (parent) {
                return parent;
            }
        }
        return session.db.getDefaultGroup();
    };

    // ── Setup / paths ─────────────────────────────────────────────────────────

    reg('as-notes.safe.selectFile', async () => {
        const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Safe',
            filters: { 'KeePass safe': ['kdbx'], 'All files': ['*'] },
        });
        if (!picked?.[0]) {
            return;
        }
        await session.setSafePath(picked[0].fsPath);
        refreshConfigured();
        updateHeader();
        vscode.window.showInformationMessage(`AS Notes: Safe set to ${picked[0].fsPath}.`);
        void vscode.commands.executeCommand('as-notes.safe.unlock');
    });

    reg('as-notes.safe.selectKeyFile', async () => {
        const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Key File',
        });
        if (!picked?.[0]) {
            return;
        }
        await session.setKeyFilePath(picked[0].fsPath);
        vscode.window.showInformationMessage('AS Notes: Key file set for this safe.');
    });

    reg('as-notes.safe.clearKeyFile', async () => {
        await session.setKeyFilePath(undefined);
        vscode.window.showInformationMessage('AS Notes: Key file cleared.');
    });

    // ── Create ────────────────────────────────────────────────────────────────

    reg('as-notes.safe.create', () => createSafeWizard(session, log, refreshConfigured));

    // ── Unlock / lock ─────────────────────────────────────────────────────────

    reg('as-notes.safe.unlock', async () => {
        if (session.isUnlocked) {
            return;
        }
        await session.unlock();
        // The tree refreshes via the session state-change event.
    });

    reg('as-notes.safe.lock', async () => {
        if (!session.isUnlocked) {
            return;
        }
        const { autoSaveOnLock } = configOf();
        if (session.isDirty && !autoSaveOnLock) {
            const choice = await vscode.window.showWarningMessage(
                'The safe has unsaved changes.',
                { modal: true },
                'Save and Lock',
                'Discard and Lock',
            );
            if (choice === 'Save and Lock') {
                await session.lock('manual', true);
            } else if (choice === 'Discard and Lock') {
                await session.lock('manual', false);
            }
            return;
        }
        await session.lock('manual');
    });

    // ── Browse / search ───────────────────────────────────────────────────────

    reg('as-notes.safe.refresh', () => tree.refresh());

    const openFilter = () => {
        if (!requireUnlocked()) {
            return;
        }
        const input = vscode.window.createInputBox();
        input.title = 'Filter Safe Entries';
        input.placeholder = 'Type to filter by title, username, or URL';
        input.value = tree.filterText;
        const clearButton: vscode.QuickInputButton = {
            iconPath: new vscode.ThemeIcon('close'),
            tooltip: 'Clear filter',
        };
        input.buttons = [clearButton];
        let debounce: NodeJS.Timeout | undefined;
        input.onDidChangeValue((value) => {
            if (debounce) {
                clearTimeout(debounce);
            }
            debounce = setTimeout(() => setFilter(value), 200); // debounced keyup
        });
        input.onDidTriggerButton((button) => {
            if (button === clearButton) {
                input.value = '';
                setFilter('');
            }
        });
        input.onDidAccept(() => input.hide());
        input.onDidHide(() => {
            if (debounce) {
                clearTimeout(debounce);
            }
            input.dispose();
        });
        input.show();
    };
    reg('as-notes.safe.search', openFilter);
    reg('as-notes.safe.searchActive', openFilter);
    reg('as-notes.safe.clearFilter', () => setFilter(''));

    // ── Copy ──────────────────────────────────────────────────────────────────

    reg('as-notes.safe.copyUsername', (node) => {
        const entry = entryOf(node);
        if (entry) {
            void copyEphemeral(fieldTextOf(entry.fields.get('UserName')), 'Username');
        }
    });

    reg('as-notes.safe.copyPassword', (node) => {
        const entry = entryOf(node);
        if (entry) {
            void copyEphemeral(fieldTextOf(entry.fields.get('Password')), 'Password');
        }
    });

    reg('as-notes.safe.copyTotp', (node) => {
        const entry = entryOf(node);
        const totp = entry ? readTotp(entry) : null;
        if (totp) {
            void copyEphemeral(computeTotp(totp, Math.floor(Date.now() / 1000)), 'One-time code');
        } else {
            vscode.window.showInformationMessage('AS Notes: This entry has no one-time code.');
        }
    });

    // ── Open / add / delete ───────────────────────────────────────────────────

    reg('as-notes.safe.openEntry', (node) => {
        const entry = entryOf(node);
        if (entry) {
            SafeEditorPanel.open(entry.uuid.id, session, tree, attachments, context.extensionUri);
        }
    });

    // Root group vs a named group, for user-facing messages/prompts.
    const groupLabel = (group: kdbxweb.KdbxGroup): string =>
        group.uuid.id === session.db.getDefaultGroup().uuid.id ? 'the root' : `"${group.name}"`;

    reg('as-notes.safe.addEntry', async (node) => {
        if (!requireUnlocked()) {
            return;
        }
        // Toolbar (no node) adds at the root; right-clicking a group adds inside it.
        // Title is left empty (the editor shows a placeholder) rather than
        // pre-filled with literal text.
        const group = targetGroup(node);
        const entry = session.db.createEntry(group);
        session.markDirty();
        tree.refresh();
        vscode.window.showInformationMessage(`AS Notes: Added a new entry to ${groupLabel(group)}.`);
        SafeEditorPanel.open(entry.uuid.id, session, tree, attachments, context.extensionUri);
    });

    reg('as-notes.safe.addGroup', async (node) => {
        if (!requireUnlocked()) {
            return;
        }
        // Toolbar (no node) adds at the root; right-clicking a group adds a subgroup.
        const parent = targetGroup(node);
        const name = await vscode.window.showInputBox({
            prompt: `New group name (created in ${groupLabel(parent)})`,
        });
        if (!name) {
            return;
        }
        session.db.createGroup(parent, name);
        session.markDirty();
        tree.refresh();
        vscode.window.showInformationMessage(`AS Notes: Created group "${name}" in ${groupLabel(parent)}.`);
    });

    reg('as-notes.safe.renameGroup', async (node) => {
        const group = groupOf(node);
        if (!group || !requireUnlocked()) {
            return;
        }
        if (group.uuid.id === session.db.getDefaultGroup().uuid.id) {
            vscode.window.showWarningMessage('AS Notes: The root group cannot be renamed.');
            return;
        }
        const name = await vscode.window.showInputBox({ prompt: 'Rename group', value: group.name });
        if (name && name !== group.name) {
            group.name = name;
            group.times.update();
            session.markDirty();
            tree.refresh();
        }
    });

    reg('as-notes.safe.deleteGroup', async (node) => {
        const group = groupOf(node);
        if (!group || !requireUnlocked()) {
            return;
        }
        if (group.uuid.id === session.db.getDefaultGroup().uuid.id) {
            vscode.window.showWarningMessage('AS Notes: The root group cannot be deleted.');
            return;
        }
        const toBin = session.db.meta.recycleBinEnabled !== false;
        const action = toBin ? 'Move to Recycle Bin' : 'Delete Permanently';
        const detail = toBin ? '' : ' This safe has no recycle bin, so it will be permanently deleted.';
        const choice = await vscode.window.showWarningMessage(
            `Delete group "${group.name}" and everything inside it?${detail}`,
            { modal: true },
            action,
        );
        if (choice !== action) {
            return;
        }
        session.db.remove(group);
        session.markDirty();
        tree.refresh();
    });

    reg('as-notes.safe.deleteEntry', async (node) => {
        const entry = entryOf(node);
        if (!entry || !requireUnlocked()) {
            return;
        }
        const title = fieldTextOf(entry.fields.get('Title')) || '(no title)';
        // db.remove moves to the Recycle Bin only when it is enabled; otherwise
        // it deletes permanently. Tell the user which will actually happen.
        const toBin = session.db.meta.recycleBinEnabled !== false;
        const action = toBin ? 'Move to Recycle Bin' : 'Delete Permanently';
        const detail = toBin
            ? ''
            : ' This safe has no recycle bin, so the entry will be permanently deleted.';
        const choice = await vscode.window.showWarningMessage(
            `Delete entry "${title}"?${detail}`,
            { modal: true },
            action,
        );
        if (choice !== action) {
            return;
        }
        session.db.remove(entry);
        session.markDirty();
        tree.refresh();
    });

    return disposables;
}

function configOf() {
    const c = vscode.workspace.getConfiguration('as-notes.safe');
    return { autoSaveOnLock: c.get<boolean>('autoSaveOnLock', true) };
}

// ── Create-safe wizard ──────────────────────────────────────────────────────

async function createSafeWizard(
    session: SafeSessionService,
    log: LogService,
    onConfigured: () => void,
): Promise<void> {
    // Step 1 - where the safe file lives.
    const target = await vscode.window.showSaveDialog({
        title: 'New Safe (step 1 of 4): choose where to save the .kdbx file',
        saveLabel: 'Create Safe Here',
        filters: { 'KeePass safe': ['kdbx'] },
        defaultUri: vscode.Uri.file(join(homedir(), 'passwords.kdbx')),
    });
    if (!target) {
        return;
    }

    // Step 2 - master password.
    const password = await vscode.window.showInputBox({
        title: 'New Safe (step 2 of 4): master password',
        prompt: 'Choose a strong master password. You will need this every time you unlock the safe - it cannot be recovered.',
        password: true,
        ignoreFocusOut: true,
    });
    if (!password) {
        return;
    }

    // Step 3 - confirm.
    const confirm = await vscode.window.showInputBox({
        title: 'New Safe (step 3 of 4): confirm master password',
        prompt: 'Re-enter the master password.',
        password: true,
        ignoreFocusOut: true,
    });
    if (confirm !== password) {
        vscode.window.showErrorMessage('AS Notes: Passwords did not match. Safe not created.');
        return;
    }

    // Step 4 - optional key file (a second factor, generated to a user-chosen path).
    let keyFile: Uint8Array | undefined;
    const wantKey = await vscode.window.showQuickPick(
        [
            {
                label: 'No key file',
                detail: 'Unlock with the master password only.',
            },
            {
                label: 'Generate a key file',
                detail: 'Adds a second factor: unlocking needs both the password AND this file. Keep it off the synced .kdbx (e.g. a USB stick). You can also use it in KeePassXC.',
            },
        ],
        {
            title: 'New Safe (step 4 of 4): key file (optional)',
            placeHolder: 'Add a key file as a second factor?',
        },
    );
    if (!wantKey) {
        return; // cancelled
    }
    if (wantKey.label === 'Generate a key file') {
        const keyTarget = await vscode.window.showSaveDialog({
            title: 'Choose where to save the generated key file',
            saveLabel: 'Save Key File',
            defaultUri: vscode.Uri.file(join(homedir(), 'keyfile.keyx')),
        });
        if (!keyTarget) {
            return;
        }
        keyFile = await generateKeyFile();
        try {
            await vscode.workspace.fs.writeFile(keyTarget, keyFile);
            await fileExists(keyTarget);
        } catch (err) {
            vscode.window.showErrorMessage(
                `AS Notes: Could not write the key file to ${keyTarget.fsPath} - ${(err as Error).message}. Safe not created.`,
            );
            return;
        }
        await session.setKeyFilePath(keyTarget.fsPath);
    } else {
        await session.setKeyFilePath(undefined);
    }

    try {
        const db = createSafe('AS Notes Safe', password, keyFile);
        const bytes = await saveSafe(db);
        await vscode.workspace.fs.writeFile(target, bytes);

        // Verify the file actually landed on disk before claiming success.
        const size = await fileExists(target);
        if (size === 0) {
            throw new Error('the file was not found on disk after writing');
        }

        await session.setSafePath(target.fsPath);
        await session.acknowledgeSafe(target.fsPath); // created here - no backup prompt on reopen
        onConfigured();
        session.adopt(db);
        vscode.window.showInformationMessage(
            `AS Notes: Safe created at ${target.fsPath} (${size} bytes). It is unlocked and ready - add your first entry.`,
        );
    } catch (err) {
        log.error('safe', `create failed: ${(err as Error).message}`);
        vscode.window.showErrorMessage(
            `AS Notes: Failed to create the safe at ${target.fsPath} - ${(err as Error).message}`,
        );
    }
}

/** Return the size of a written file, throwing if it is missing. */
async function fileExists(uri: vscode.Uri): Promise<number> {
    const stat = await vscode.workspace.fs.stat(uri);
    return stat.size;
}
