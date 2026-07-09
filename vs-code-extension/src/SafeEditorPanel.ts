/**
 * SafeEditorPanel - the full entry editor, a Tailwind webview in an editor tab.
 *
 * The editor is a buffered form: every edit mutates a host-side Draft, and
 * nothing reaches the KDBX entry (or disk) until the user presses Save. The
 * panel tracks a dirty flag; closing the tab with unsaved changes prompts to
 * save or discard, and a workspace-close flush persists dirty drafts. The
 * webview only ever receives the single entry on screen (never the whole db),
 * and the live authenticator code is computed in the host and streamed.
 */

import * as vscode from 'vscode';
import { SafeSessionService } from './SafeSessionService';
import { SafeTreeProvider } from './SafeTreeProvider';
import { SafeAttachmentService } from './SafeAttachmentService';
import { copyEphemeral } from './safeClipboard';
import { basename } from 'path';
import type * as kdbxweb from 'kdbxweb';
import {
    findEntry,
    entryAttachment,
    computeTotp,
    normalizeAuthenticatorKey,
    totpConfigFromRaw,
    createDraft,
    draftToView,
    applyDraft,
    fieldTextOf,
    Draft,
} from './SafeService';

const STANDARD_FIELD_MAP: Record<string, string> = {
    title: 'Title',
    username: 'UserName',
    password: 'Password',
    url: 'URL',
    notes: 'Notes',
};

function emptyDraft(): Draft {
    return {
        values: {}, protectedFields: [], tags: [], icon: 0,
        expires: false, expiryTime: null, groupUuid: '',
        addedAttachments: {}, removedAttachments: [],
    };
}

export class SafeEditorPanel {
    private static readonly panels = new Map<string, SafeEditorPanel>();

    private draft: Draft;
    private dirty = false;
    private discardOnClose = false;
    private totpTimer: NodeJS.Timeout | undefined;
    private readonly disposables: vscode.Disposable[] = [];

    static open(
        entryUuid: string,
        session: SafeSessionService,
        tree: SafeTreeProvider,
        attachments: SafeAttachmentService,
        extensionUri: vscode.Uri,
    ): void {
        const existing = SafeEditorPanel.panels.get(entryUuid);
        if (existing) {
            existing.panel.reveal();
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            'as-notes.safeEntry',
            'Safe Entry',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
                retainContextWhenHidden: false, // don't keep decrypted fields in a hidden DOM
            },
        );
        SafeEditorPanel.panels.set(
            entryUuid,
            new SafeEditorPanel(panel, entryUuid, session, tree, attachments, extensionUri),
        );
    }

    /** Dispose every open editor, discarding unsaved drafts (used when the safe locks). */
    static closeAll(): void {
        for (const panel of [...SafeEditorPanel.panels.values()]) {
            panel.discardOnClose = true;
            panel.panel.dispose();
        }
    }

    /**
     * Commit any dirty drafts to their entries so a workspace-close flush can
     * persist them. Returns true if anything was applied. Called on shutdown.
     */
    static async commitDirtyDrafts(session: SafeSessionService): Promise<boolean> {
        let any = false;
        for (const panel of SafeEditorPanel.panels.values()) {
            if (panel.dirty && session.isUnlocked) {
                const entry = findEntry(session.db, panel.entryUuid);
                if (entry) {
                    entry.pushHistory();
                    await applyDraft(session.db, entry, panel.draft);
                    panel.dirty = false;
                    any = true;
                }
            }
        }
        return any;
    }

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        private readonly entryUuid: string,
        private readonly session: SafeSessionService,
        private readonly tree: SafeTreeProvider,
        private readonly attachments: SafeAttachmentService,
        extensionUri: vscode.Uri,
    ) {
        const entry = this.entry();
        this.draft = entry ? createDraft(entry) : emptyDraft();
        this.panel.webview.html = this.renderHtml(extensionUri);
        this.panel.webview.onDidReceiveMessage((m) => this.onMessage(m), null, this.disposables);
        this.panel.onDidDispose(() => void this.onClosed(), null, this.disposables);
        // Lock while this editor is open → close it (discarding the draft).
        this.disposables.push(
            this.session.onDidChangeState(() => {
                if (!this.session.isUnlocked) {
                    this.discardOnClose = true;
                    this.panel.dispose();
                }
            }),
        );
    }

    private entry(): kdbxweb.KdbxEntry | undefined {
        return this.session.isUnlocked ? findEntry(this.session.db, this.entryUuid) : undefined;
    }

    private setDirty(): void {
        this.dirty = true;
        void this.panel.webview.postMessage({ type: 'dirty', dirty: true });
    }

    // ── Messaging ─────────────────────────────────────────────────────────────

    private async onMessage(message: { type: string; [k: string]: unknown }): Promise<void> {
        this.session.touch();
        const entry = this.entry();
        if (!entry) {
            this.discardOnClose = true;
            this.panel.dispose();
            return;
        }
        const d = this.draft;

        switch (message.type) {
            case 'ready':
                this.sendEntry();
                this.startTotp();
                break;

            case 'updateField': {
                const key = STANDARD_FIELD_MAP[message.field as string];
                if (key) {
                    d.values[key] = String(message.value ?? '');
                    this.setDirty();
                }
                break;
            }

            case 'updateCustom':
                d.values[String(message.name)] = String(message.value ?? '');
                this.setDirty();
                break;

            case 'addCustomPrompt': {
                const name = (await vscode.window.showInputBox({
                    prompt: 'New field name',
                    validateInput: (v) =>
                        v.trim() in d.values ? 'A field with that name already exists.' : undefined,
                }))?.trim();
                if (name && !(name in d.values)) {
                    d.values[name] = '';
                    this.setDirty();
                    this.sendEntry();
                }
                break;
            }

            case 'removeCustom':
                if (String(message.name) in d.values) {
                    delete d.values[String(message.name)];
                    this.setDirty();
                    this.sendEntry();
                }
                break;

            case 'renameCustom': {
                const oldName = String(message.oldName);
                const newName = String(message.newName).trim();
                if (newName && !(newName in d.values) && oldName in d.values) {
                    d.values[newName] = d.values[oldName];
                    delete d.values[oldName];
                    d.protectedFields = d.protectedFields.map((f) => (f === oldName ? newName : f));
                    this.setDirty();
                    this.sendEntry();
                }
                break;
            }

            case 'setTags':
                d.tags = (message.tags as string[]).map((t) => t.trim()).filter(Boolean);
                this.setDirty();
                break;

            case 'setIcon':
                d.icon = Number(message.icon) || 0;
                this.setDirty();
                this.sendEntry();
                break;

            case 'setExpiry':
                d.expires = Boolean(message.expires);
                d.expiryTime = (message.time as number) ?? null;
                this.setDirty();
                break;

            case 'moveToGroup':
                d.groupUuid = String(message.groupUuid ?? '');
                this.setDirty();
                break;

            case 'setTotp': {
                const normalized = normalizeAuthenticatorKey(String(message.value ?? '').trim());
                if (!normalized) {
                    vscode.window.showWarningMessage(
                        'AS Notes: Not a valid authenticator key. Paste an otpauth:// URI or a base32 secret.',
                    );
                    break;
                }
                d.values['otp'] = normalized;
                if (!d.protectedFields.includes('otp')) {
                    d.protectedFields.push('otp');
                }
                this.setDirty();
                this.startTotp();
                this.sendEntry();
                break;
            }

            case 'removeTotp':
                delete d.values['otp'];
                delete d.values['TOTP Seed'];
                delete d.values['TOTP Settings'];
                this.stopTotp();
                this.setDirty();
                this.sendEntry();
                break;

            case 'restoreHistory':
                this.loadVersionIntoDraft(entry, Number(message.index));
                break;

            case 'copy': {
                const what = message.what as string;
                if (what === 'username') {
                    await copyEphemeral(d.values['UserName'] ?? '', 'Username');
                } else if (what === 'password') {
                    await copyEphemeral(d.values['Password'] ?? '', 'Password');
                } else if (what === 'totp') {
                    const totp = totpConfigFromRaw(d.values['otp'] ?? '');
                    if (totp) {
                        await copyEphemeral(computeTotp(totp, Math.floor(Date.now() / 1000)), 'One-time code');
                    }
                }
                break;
            }

            case 'openAttachment':
                await this.withAttachmentBytes(entry, String(message.name), (bytes, name) =>
                    this.attachments.open(name, bytes));
                break;

            case 'saveAttachment':
                await this.withAttachmentBytes(entry, String(message.name), (bytes, name) =>
                    this.attachments.saveAs(name, bytes));
                break;

            case 'addAttachment': {
                const picked = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel: 'Attach File',
                });
                if (picked?.[0]) {
                    const bytes = await vscode.workspace.fs.readFile(picked[0]);
                    const name = basename(picked[0].fsPath);
                    d.addedAttachments[name] = bytes;
                    d.removedAttachments = d.removedAttachments.filter((n) => n !== name);
                    this.setDirty();
                    this.sendEntry();
                }
                break;
            }

            case 'deleteAttachment': {
                const name = String(message.name);
                if (name in d.addedAttachments) {
                    delete d.addedAttachments[name];
                } else if (!d.removedAttachments.includes(name)) {
                    d.removedAttachments.push(name);
                }
                this.setDirty();
                this.sendEntry();
                break;
            }

            case 'save':
                await this.commit();
                break;
        }
    }

    /** Fetch attachment bytes, preferring a pending add, else the stored binary. */
    private async withAttachmentBytes(
        entry: kdbxweb.KdbxEntry,
        name: string,
        use: (bytes: Uint8Array, name: string) => Promise<void>,
    ): Promise<void> {
        const bytes = this.draft.addedAttachments[name] ?? entryAttachment(entry, name);
        if (bytes) {
            await use(bytes, name);
        }
    }

    private loadVersionIntoDraft(entry: kdbxweb.KdbxEntry, index: number): void {
        const version = entry.history[index];
        if (!version) {
            return;
        }
        const values: Record<string, string> = {};
        const protectedFields: string[] = [];
        for (const [name, value] of version.fields) {
            values[name] = fieldTextOf(value);
            if (typeof value !== 'string') {
                protectedFields.push(name);
            }
        }
        this.draft.values = values;
        this.draft.protectedFields = protectedFields;
        this.draft.tags = [...version.tags];
        this.draft.icon = version.icon ?? 0;
        this.setDirty();
        this.startTotp();
        this.sendEntry();
    }

    /** Commit the draft to the entry and write the file. */
    private async commit(): Promise<void> {
        const entry = this.entry();
        if (!entry) {
            return;
        }
        try {
            if (this.dirty) {
                entry.pushHistory(); // one history version per save
                await applyDraft(this.session.db, entry, this.draft);
                this.session.markDirty();
            }
            await this.session.save();
            this.draft = createDraft(entry); // resync draft with the persisted entry
            this.dirty = false;
            this.tree.refresh();
            this.sendEntry();
            void this.panel.webview.postMessage({ type: 'saved' });
            void vscode.window.showInformationMessage('AS Notes: Safe saved.');
        } catch (err) {
            vscode.window.showErrorMessage(`AS Notes: Failed to save safe - ${(err as Error).message}`);
        } finally {
            void this.panel.webview.postMessage({ type: 'saveDone' });
        }
    }

    private sendEntry(): void {
        const entry = this.entry();
        if (!entry) {
            return;
        }
        const view = draftToView(this.session.db, entry, this.draft);
        this.panel.title = view.title ? `Safe: ${view.title}` : 'Safe Entry';
        void this.panel.webview.postMessage({ type: 'entry', view, dirty: this.dirty });
    }

    // ── TOTP streaming (from the draft's pending key) ─────────────────────────

    private startTotp(): void {
        this.stopTotp();
        const tick = () => {
            const totp = totpConfigFromRaw(this.draft.values['otp'] ?? '');
            if (!totp) {
                return;
            }
            const now = Math.floor(Date.now() / 1000);
            void this.panel.webview.postMessage({
                type: 'totp',
                code: computeTotp(totp, now),
                remaining: totp.period - (now % totp.period),
                period: totp.period,
            });
        };
        tick();
        this.totpTimer = setInterval(tick, 1000);
    }

    private stopTotp(): void {
        if (this.totpTimer) {
            clearInterval(this.totpTimer);
            this.totpTimer = undefined;
        }
    }

    // ── HTML shell ────────────────────────────────────────────────────────────

    private renderHtml(extensionUri: vscode.Uri): string {
        const webview = this.panel.webview;
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'safe.js'),
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'safe.css'),
        );
        const codiconUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'codicon.css'),
        );
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource}; font-src ${webview.cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${codiconUri}">
    <link rel="stylesheet" href="${styleUri}">
    <title>Safe Entry</title>
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /** Tab closed: clean up, and (unless discarding) offer to save unsaved changes. */
    private async onClosed(): Promise<void> {
        this.stopTotp();
        SafeEditorPanel.panels.delete(this.entryUuid);
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
        if (this.discardOnClose || !this.dirty || !this.session.isUnlocked) {
            return;
        }
        const entry = findEntry(this.session.db, this.entryUuid);
        if (!entry) {
            return;
        }
        const title = this.draft.values['Title'] || '(no title)';
        const choice = await vscode.window.showWarningMessage(
            `You closed "${title}" with unsaved changes.`,
            { modal: true },
            'Save',
            'Discard',
        );
        if (choice === 'Save') {
            try {
                entry.pushHistory();
                await applyDraft(this.session.db, entry, this.draft);
                this.session.markDirty();
                await this.session.save();
                this.tree.refresh();
                void vscode.window.showInformationMessage('AS Notes: Safe saved.');
            } catch (err) {
                vscode.window.showErrorMessage(`AS Notes: Failed to save safe - ${(err as Error).message}`);
            }
        }
    }
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
