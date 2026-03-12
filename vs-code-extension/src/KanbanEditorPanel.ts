import * as vscode from 'vscode';
import type { KanbanStore } from './KanbanStore.js';
import type { KanbanBoardConfigStore } from './KanbanBoardConfigStore.js';
import type { LogService } from './LogService.js';
import { NO_OP_LOGGER } from './LogService.js';
import { isProtectedLane, isReservedLane, slugifyLane, PROTECTED_LANES, ASSETS_DIR } from './KanbanTypes.js';
import type { Priority } from './KanbanTypes.js';

/** Default asset size warning threshold in bytes (10 MB). */
const DEFAULT_ASSET_SIZE_WARNING_BYTES = 10 * 1024 * 1024;

export class KanbanEditorPanel {
    public static readonly VIEW_TYPE = 'as-notes.kanbanPanel';
    public static currentPanel: KanbanEditorPanel | undefined;

    private readonly _panel: vscode.WebviewPanel;
    private readonly _logger: LogService;
    private _disposables: vscode.Disposable[] = [];
    private _webviewReady = false;
    private _pendingMessages: unknown[] = [];

    // ── Public API ───────────────────────────────────────────────────────

    public static createOrShow(
        extensionUri: vscode.Uri,
        kanbanStore: KanbanStore,
        boardConfigStore: KanbanBoardConfigStore,
        logger?: LogService,
    ): KanbanEditorPanel {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

        if (KanbanEditorPanel.currentPanel) {
            KanbanEditorPanel.currentPanel._panel.reveal(column);
            return KanbanEditorPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            KanbanEditorPanel.VIEW_TYPE,
            'Kanban Board',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
                    kanbanStore.kanbanRootUri,
                ],
            },
        );

        KanbanEditorPanel.currentPanel = new KanbanEditorPanel(
            panel, extensionUri, kanbanStore, boardConfigStore, logger,
        );
        return KanbanEditorPanel.currentPanel;
    }

    public static revive(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        kanbanStore: KanbanStore,
        boardConfigStore: KanbanBoardConfigStore,
        logger?: LogService,
    ): void {
        KanbanEditorPanel.currentPanel = new KanbanEditorPanel(
            panel, extensionUri, kanbanStore, boardConfigStore, logger,
        );
    }

    public async refresh(): Promise<void> {
        await this._sendState();
    }

    public triggerCreateModal(): void {
        const msg = { type: 'openCreateModal' };
        if (this._webviewReady) {
            this._panel.webview.postMessage(msg);
        } else {
            this._pendingMessages.push(msg);
        }
    }

    // ── Constructor ──────────────────────────────────────────────────────

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly _extensionUri: vscode.Uri,
        private readonly _kanbanStore: KanbanStore,
        private readonly _boardConfigStore: KanbanBoardConfigStore,
        logger?: LogService,
    ) {
        this._panel = panel;
        this._logger = logger ?? NO_OP_LOGGER;

        this._panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview'),
                this._kanbanStore.kanbanRootUri,
            ],
        };

        this._setWebviewHtml();

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                this._logger.info('kanbanPanel', `Message: ${message.type}`);
                await this._handleMessage(message);
            },
            undefined,
            this._disposables,
        );

        this._disposables.push(this._kanbanStore.onDidChange(() => this._sendState()));
        this._disposables.push(this._boardConfigStore.onDidChange(() => this._sendState()));
        this._panel.onDidDispose(() => this._dispose(), undefined, this._disposables);
    }

    // ── Webview HTML ─────────────────────────────────────────────────────

    private _setWebviewHtml(): void {
        const webview = this._panel.webview;

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'kanban.js'),
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'kanban.css'),
        );

        this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource}; img-src ${webview.cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${styleUri}">
    <title>Kanban Board</title>
</head>
<body>
    <div id="app"></div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    // ── State ────────────────────────────────────────────────────────────

    private async _sendState(): Promise<void> {
        const cards = this._kanbanStore.getAll()
            .sort((a, b) => {
                const sa = a.sortOrder ?? Date.parse(a.created);
                const sb = b.sortOrder ?? Date.parse(b.created);
                return sa - sb;
            });
        const config = this._boardConfigStore.get();
        const boardSlug = this._kanbanStore.currentBoard;

        // Build asset URIs for webview
        const assetBaseUri = boardSlug
            ? this._panel.webview.asWebviewUri(
                vscode.Uri.joinPath(this._kanbanStore.kanbanRootUri, boardSlug, ASSETS_DIR),
            ).toString()
            : '';

        const msg: Record<string, unknown> = {
            type: 'stateUpdate',
            state: { cards, config, boardSlug, assetBaseUri },
        };
        if (this._webviewReady) {
            await this._panel.webview.postMessage(msg);
        } else {
            this._pendingMessages.push(msg);
        }
    }

    // ── Message Handlers ─────────────────────────────────────────────────

    private async _handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'ready':
                await this._sendState();
                this._webviewReady = true;
                for (const msg of this._pendingMessages) {
                    this._panel.webview.postMessage(msg);
                }
                this._pendingMessages = [];
                break;

            case 'selectBoard':
                vscode.commands.executeCommand('as-notes.selectKanbanBoard');
                break;

            case 'moveCard': {
                const card = this._kanbanStore.get(message.cardId);
                if (card) {
                    const oldLane = card.lane;
                    const newLane = message.lane;
                    if (typeof message.sortOrder === 'number') {
                        card.sortOrder = message.sortOrder;
                    }
                    if (oldLane !== newLane) {
                        await this._kanbanStore.moveCardToLane(message.cardId, newLane);
                    } else {
                        await this._kanbanStore.save(card);
                    }
                }
                break;
            }

            case 'createCard': {
                const title = (message.title ?? '').trim();
                if (!title) { break; }
                const lane = message.lane || this._boardConfigStore.get().lanes[0] || 'todo';
                const card = this._kanbanStore.createCard(title, lane);

                // Assign sortOrder: place at end of target lane
                const laneTasks = this._kanbanStore.getAll()
                    .filter((c) => c.lane === lane)
                    .sort((a, b) => (a.sortOrder ?? Date.parse(a.created)) - (b.sortOrder ?? Date.parse(b.created)));
                const lastOrder = laneTasks.length > 0
                    ? (laneTasks[laneTasks.length - 1].sortOrder ?? Date.parse(laneTasks[laneTasks.length - 1].created))
                    : 0;
                card.sortOrder = lastOrder + 1;
                card.priority = message.priority as Priority | undefined;
                card.assignee = message.assignee as string | undefined;
                card.labels = message.labels as string[] | undefined;
                card.dueDate = message.dueDate as string | undefined;
                card.description = (message.description ?? '').trim();

                await this._kanbanStore.save(card);
                break;
            }

            case 'deleteCard':
                await this._kanbanStore.delete(message.cardId);
                break;

            case 'updateCardMeta': {
                const card = this._kanbanStore.get(message.cardId);
                if (!card) { break; }
                card.priority = message.priority as Priority | undefined;
                card.assignee = message.assignee as string | undefined;
                card.labels = message.labels as string[] | undefined;
                card.dueDate = message.dueDate as string | undefined;
                if (typeof message.description === 'string') {
                    card.description = message.description.trim();
                }
                // Auto-save pending entry text from the input field
                const pendingText = (typeof message.pendingEntry === 'string') ? message.pendingEntry.trim() : '';
                if (pendingText) {
                    if (!card.entries) { card.entries = []; }
                    const pendingAuthor = (typeof message.pendingEntryAuthor === 'string') ? message.pendingEntryAuthor.trim() || undefined : undefined;
                    card.entries.push({ author: pendingAuthor, date: new Date().toISOString(), text: pendingText });
                }
                if (message.lane && message.lane !== card.lane) {
                    await this._kanbanStore.moveCardToLane(message.cardId, message.lane);
                } else {
                    await this._kanbanStore.save(card);
                }
                break;
            }

            case 'addEntry': {
                const card = this._kanbanStore.get(message.cardId);
                if (!card) { break; }
                const entry = {
                    author: (message.author ?? '').trim() || undefined,
                    date: new Date().toISOString(),
                    text: (message.text ?? '').trim(),
                };
                if (!entry.text) { break; }
                if (!card.entries) { card.entries = []; }
                card.entries.push(entry);
                await this._kanbanStore.save(card);
                break;
            }

            case 'addLane': {
                const config = this._boardConfigStore.get();
                const laneName = await vscode.window.showInputBox({
                    prompt: 'Enter lane name',
                    placeHolder: 'Lane name',
                    validateInput: (v) => {
                        const slug = slugifyLane(v);
                        if (!slug) { return 'Name cannot be empty'; }
                        if (isProtectedLane(slug)) { return `"${slug}" is a reserved lane name`; }
                        if (isReservedLane(slug)) { return `"${slug}" is reserved and cannot be used`; }
                        if (config.lanes.includes(slug)) { return `A lane named "${slug}" already exists`; }
                        return null;
                    },
                });
                if (laneName) {
                    const slug = slugifyLane(laneName);
                    if (slug) {
                        config.lanes.push(slug);
                        await this._boardConfigStore.update({ lanes: config.lanes });
                    }
                }
                break;
            }

            case 'removeLane': {
                const config = this._boardConfigStore.get();
                const laneSlug = message.laneId as string;
                if (isProtectedLane(laneSlug)) {
                    vscode.window.showWarningMessage(`The ${laneSlug.toUpperCase()} lane cannot be removed.`);
                    break;
                }
                const laneCards = this._kanbanStore.getAll().filter((c) => c.lane === laneSlug);
                if (laneCards.length > 0) {
                    const confirm = await vscode.window.showWarningMessage(
                        `Removing this lane will delete ${laneCards.length} card${laneCards.length === 1 ? '' : 's'}. Continue?`,
                        { modal: true }, 'Yes',
                    );
                    if (confirm !== 'Yes') { break; }
                    for (const card of laneCards) {
                        await this._kanbanStore.delete(card.id);
                    }
                }
                config.lanes = config.lanes.filter((l) => l !== laneSlug);
                await this._boardConfigStore.update({ lanes: config.lanes });
                break;
            }

            case 'renameLane': {
                const config = this._boardConfigStore.get();
                const oldSlug = message.laneId as string;
                if (!config.lanes.includes(oldSlug)) { break; }
                if (isProtectedLane(oldSlug)) {
                    vscode.window.showWarningMessage(`The ${oldSlug.toUpperCase()} lane cannot be renamed.`);
                    break;
                }
                const newName = await vscode.window.showInputBox({
                    prompt: 'Rename lane',
                    value: oldSlug.replace(/-/g, ' '),
                    validateInput: (v) => {
                        const newSlug = slugifyLane(v);
                        if (!newSlug) { return 'Name cannot be empty'; }
                        if (PROTECTED_LANES.includes(newSlug)) { return `Cannot rename to "${newSlug}" — reserved`; }
                        if (isReservedLane(newSlug)) { return `"${newSlug}" is reserved`; }
                        if (newSlug !== oldSlug && config.lanes.includes(newSlug)) { return `"${newSlug}" already exists`; }
                        return null;
                    },
                });
                if (newName) {
                    const newSlug = slugifyLane(newName);
                    if (newSlug && newSlug !== oldSlug) {
                        const boardUri = vscode.Uri.joinPath(
                            this._kanbanStore.kanbanRootUri, this._kanbanStore.currentBoard,
                        );
                        const oldDir = vscode.Uri.joinPath(boardUri, oldSlug);
                        const newDir = vscode.Uri.joinPath(boardUri, newSlug);
                        try {
                            await vscode.workspace.fs.rename(oldDir, newDir, { overwrite: false });
                        } catch {
                            try { await vscode.workspace.fs.createDirectory(newDir); } catch { /* exists */ }
                        }
                        const idx = config.lanes.indexOf(oldSlug);
                        if (idx !== -1) { config.lanes[idx] = newSlug; }
                        await this._boardConfigStore.update({ lanes: config.lanes });
                        await this._kanbanStore.reload();
                    }
                }
                break;
            }

            case 'moveLane': {
                const config = this._boardConfigStore.get();
                const fromIndex = config.lanes.indexOf(message.sourceLaneId);
                const toIndex = config.lanes.indexOf(message.targetLaneId);
                if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                    const [moved] = config.lanes.splice(fromIndex, 1);
                    config.lanes.splice(toIndex, 0, moved);
                    await this._boardConfigStore.update({ lanes: config.lanes });
                }
                break;
            }

            case 'archiveCard': {
                const card = this._kanbanStore.get(message.cardId);
                if (card) {
                    await this._kanbanStore.moveCardToLane(message.cardId, 'archive');
                }
                break;
            }

            case 'addUser':
                await this._boardConfigStore.addUser(message.name);
                break;

            case 'addLabel':
                await this._boardConfigStore.addLabel(message.name);
                break;

            case 'addAsset': {
                const card = this._kanbanStore.get(message.cardId);
                if (!card) { break; }
                const fileUris = await vscode.window.showOpenDialog({
                    canSelectMany: true,
                    openLabel: 'Add Asset',
                    title: 'Select files to attach to this card',
                });
                if (!fileUris || fileUris.length === 0) { break; }
                for (const uri of fileUris) {
                    await this._checkSizeAndAddAsset(card.id, uri);
                }
                break;
            }

            case 'removeAsset': {
                await this._kanbanStore.removeAsset(message.cardId, message.filename);
                break;
            }



            case 'openAsset': {
                const card = this._kanbanStore.get(message.cardId);
                if (!card) { break; }
                const assetUri = vscode.Uri.joinPath(
                    this._kanbanStore.getCardAssetsUri(card.id), message.filename,
                );
                await vscode.commands.executeCommand('vscode.open', assetUri);
                break;
            }

            case 'openCardFile': {
                const card = this._kanbanStore.get(message.cardId);
                if (card) {
                    const uri = this._kanbanStore.getCardUri(message.cardId);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Active });
                }
                break;
            }
        }
    }

    /** Check file size and warn if it exceeds the threshold, then add the asset. */
    private async _checkSizeAndAddAsset(cardId: string, sourceUri: vscode.Uri): Promise<void> {
        const warningMB = vscode.workspace.getConfiguration('as-notes')
            .get<number>('kanbanAssetSizeWarningMB', 10);
        const warningBytes = warningMB * 1024 * 1024;

        if (warningBytes > 0) {
            try {
                const stat = await vscode.workspace.fs.stat(sourceUri);
                if (stat.size > warningBytes) {
                    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
                    const proceed = await vscode.window.showWarningMessage(
                        `This file is ${sizeMB} MB. Large files may slow down version control. Add anyway?`,
                        { modal: true }, 'Add', 'Cancel',
                    );
                    if (proceed !== 'Add') { return; }
                }
            } catch {
                // Can't stat — proceed without warning
            }
        }

        const config = this._boardConfigStore.get();
        const currentUser = config.users?.[0]; // Best guess for addedBy
        await this._kanbanStore.addAsset(cardId, sourceUri, currentUser);
    }

    // ── Dispose ──────────────────────────────────────────────────────────

    private _dispose(): void {
        KanbanEditorPanel.currentPanel = undefined;
        for (const d of this._disposables) { d.dispose(); }
        this._disposables = [];
    }
}
