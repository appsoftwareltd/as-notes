import * as vscode from 'vscode';
import { IndexService, type TaskViewItem } from './IndexService.js';
import { toggleTodoLine } from './TodoToggleService.js';

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * VS Code WebviewViewProvider that displays tasks in the AS Notes sidebar.
 *
 * Features:
 * - Group by: Page | Priority | Due Date | Waiting (all managed in the webview)
 * - Show TODO only toggle (filter state lives in the webview)
 * - Click-to-navigate — opens the source file at the task's line
 * - Toggle task done/todo state without stealing focus
 * - Refresh on demand via `refresh()`
 */
export class TaskPanelProvider implements vscode.WebviewViewProvider {
    static readonly VIEW_ID = 'as-notes-tasks';

    private _view?: vscode.WebviewView;
    private _notesRootUri?: vscode.Uri;

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _indexService: IndexService,
    ) { }

    /** Set the notes root URI for file navigation. */
    setNotesRootUri(uri: vscode.Uri): void {
        this._notesRootUri = uri;
    }
    // ── WebviewViewProvider ────────────────────────────────────────────────

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(msg => this._handleMessage(msg));

        webviewView.webview.html = this._buildHtml(webviewView.webview);
        this._sendState();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Resend updated task data to the webview. Call after index changes. */
    refresh(): void {
        this._sendState();
    }

    // ── Private ────────────────────────────────────────────────────────────

    private _sendState(): void {
        if (!this._view) { return; }
        const tasks: TaskViewItem[] = this._indexService.isOpen
            ? this._indexService.getAllTasksForWebview()
            : [];
        this._view.webview.postMessage({ type: 'update', tasks });
    }

    private _handleMessage(msg: Record<string, unknown>): void {
        switch (msg.type) {
            case 'navigateTo':
                vscode.commands.executeCommand(
                    'as-notes.navigateToTask',
                    msg.pagePath as string,
                    msg.line as number,
                );
                break;
            case 'toggleTask': {
                const rootUri = this._notesRootUri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
                if (!rootUri) { break; }
                const pagePath = msg.pagePath as string;
                const line = msg.line as number;
                const fileUri = vscode.Uri.joinPath(rootUri, pagePath);
                vscode.workspace.openTextDocument(fileUri).then(doc => {
                    const lineText = doc.lineAt(line).text;
                    const toggled = toggleTodoLine(lineText);
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(doc.uri, doc.lineAt(line).range, toggled);
                    return vscode.workspace.applyEdit(edit).then(() => doc.save());
                }).then(undefined, err => {
                    console.warn('as-notes: failed to toggle task from panel:', err);
                });
                break;
            }
            case 'saveFilterState': {
                const { groupBy, showTodoOnly, waitingOnly } = msg as {
                    groupBy: string;
                    showTodoOnly: boolean;
                    waitingOnly: boolean;
                };
                this._context.workspaceState.update('as-notes.taskFilter.groupBy', groupBy);
                this._context.workspaceState.update('as-notes.taskFilter.showTodoOnly', showTodoOnly);
                this._context.workspaceState.update('as-notes.taskFilter.waitingOnly', waitingOnly);
                break;
            }
        }
    }

    private _buildHtml(webview: vscode.Webview): string {
        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'tasks.js'),
        );
        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'tasks.css'),
        );
        const nonce = getNonce();

        const groupBy = this._context.workspaceState.get<string>('as-notes.taskFilter.groupBy', 'page');
        const showTodoOnly = this._context.workspaceState.get<boolean>('as-notes.taskFilter.showTodoOnly', true);
        const waitingOnly = this._context.workspaceState.get<boolean>('as-notes.taskFilter.waitingOnly', false);
        const initialState = JSON.stringify({ groupBy, showTodoOnly, waitingOnly });

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${cssUri}">
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}">window.__INITIAL_FILTER_STATE__ = ${initialState};</script>
    <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
