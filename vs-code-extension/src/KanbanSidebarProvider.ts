import * as vscode from 'vscode';
import type { KanbanStore } from './KanbanStore.js';
import type { KanbanBoardConfigStore } from './KanbanBoardConfigStore.js';
import { displayLane } from './KanbanTypes.js';

/**
 * Sidebar panel for the Kanban feature.
 *
 * Shows a board selector and per-lane card counts with quick-action buttons
 * (open board, new card).  The full board UI lives in KanbanEditorPanel.
 */
export class KanbanSidebarProvider implements vscode.WebviewViewProvider {
    static readonly VIEW_ID = 'as-notes-kanban';

    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _kanbanStore: KanbanStore,
        private readonly _boardConfigStore: KanbanBoardConfigStore,
    ) { }

    // ── WebviewViewProvider ──────────────────────────────────────────────

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _ctx: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(
            (msg) => this._handleMessage(msg),
            undefined,
            this._disposables,
        );

        webviewView.webview.html = this._buildHtml(webviewView.webview);
        this._sendState();

        this._disposables.push(this._kanbanStore.onDidChange(() => this._sendState()));
        this._disposables.push(this._boardConfigStore.onDidChange(() => this._sendState()));

        webviewView.onDidDispose(() => {
            for (const d of this._disposables) { d.dispose(); }
            this._disposables = [];
        });
    }

    // ── Public API ──────────────────────────────────────────────────────

    refresh(): void {
        this._sendState();
    }

    // ── Private ─────────────────────────────────────────────────────────

    private async _sendState(): Promise<void> {
        if (!this._view) { return; }

        const config = this._boardConfigStore.get();
        const cards = this._kanbanStore.getAll();
        const boardSlug = this._kanbanStore.currentBoard;
        const boardList = await this._boardConfigStore.listBoardsWithNames();

        const laneSummary = config.lanes.map((lane) => ({
            slug: lane,
            display: displayLane(lane),
            count: cards.filter((c) => c.lane === lane).length,
        }));

        this._view.webview.postMessage({
            type: 'stateUpdate',
            state: { boardSlug, boardName: config.name, laneSummary, boardCount: boardList.length, boardList },
        });
    }

    private _handleMessage(msg: Record<string, unknown>): void {
        switch (msg.type) {
            case 'ready':
                this._sendState();
                break;
            case 'openBoard':
                vscode.commands.executeCommand('as-notes.openKanbanBoard');
                break;
            case 'newCard':
                vscode.commands.executeCommand('as-notes.newKanbanCard');
                break;
            case 'switchBoard':
                vscode.commands.executeCommand('as-notes.switchKanbanBoard', msg.slug);
                break;
            case 'selectBoard':
                vscode.commands.executeCommand('as-notes.selectKanbanBoard');
                break;
            case 'createBoard':
                vscode.commands.executeCommand('as-notes.createKanbanBoard');
                break;
            case 'deleteBoard':
                vscode.commands.executeCommand('as-notes.deleteKanbanBoard');
                break;
            case 'renameBoard':
                vscode.commands.executeCommand('as-notes.renameKanbanBoard');
                break;
        }
    }

    private _buildHtml(webview: vscode.Webview): string {
        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'kanban-sidebar.js'),
        );
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 8px; }
        .board-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
        .board-name { font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
        .board-name:hover { text-decoration: underline; }
        .actions { display: flex; flex-wrap: wrap; gap: 6px; }
        .actions button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 10px; cursor: pointer; border-radius: 2px; font-size: var(--vscode-font-size); }
        .actions button:hover { background: var(--vscode-button-hoverBackground); }
        .no-board { opacity: 0.6; font-style: italic; margin-bottom: 10px; }
        .no-board-actions { margin-top: 0; }
        .btn-sm-secondary { background: var(--vscode-button-secondaryBackground) !important; color: var(--vscode-button-secondaryForeground) !important; border: none; padding: 4px 10px; cursor: pointer; border-radius: 2px; font-size: var(--vscode-font-size); }
        .btn-sm-secondary:hover { background: var(--vscode-button-secondaryHoverBackground) !important; }
        .board-switcher { margin-bottom: 6px; }
        .board-switcher-wrapper { position: relative; }
        .board-switcher-input { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 6px 8px; font-size: var(--vscode-font-size); border-radius: 2px; outline: none; }
        .board-switcher-input:focus { border-color: var(--vscode-focusBorder); }
        .board-ac-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 50; background: var(--vscode-editorSuggestWidget-background); border: 1px solid var(--vscode-editorSuggestWidget-border, var(--vscode-widget-border)); border-radius: 2px; max-height: 150px; overflow-y: auto; }
        .board-ac-option { padding: 4px 8px; cursor: pointer; font-size: var(--vscode-font-size); }
        .board-ac-option:hover, .board-ac-option-active { background: var(--vscode-list-hoverBackground); }
    </style>
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
