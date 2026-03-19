import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * VS Code WebviewViewProvider that displays a month calendar in the AS Notes
 * sidebar. Clicking a day opens (or creates) the daily journal for that date.
 */
export class CalendarPanelProvider implements vscode.WebviewViewProvider {
    static readonly VIEW_ID = 'as-notes-calendar';

    private _view?: vscode.WebviewView;
    private _notesRootUri?: vscode.Uri;
    private _journalFolder = 'journals';

    constructor(
        private readonly _context: vscode.ExtensionContext,
    ) { }

    /** Set the notes root URI used to locate the journal folder. */
    setNotesRootUri(uri: vscode.Uri): void {
        this._notesRootUri = uri;
    }

    /** Update the journal folder name (from settings). */
    setJournalFolder(folder: string): void {
        this._journalFolder = folder.trim().replace(/^[/\\]+|[/\\]+$/g, '') || 'journals';
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
        this._sendJournalDates();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Re-scan journal dates and push to the webview. */
    refresh(): void {
        this._sendJournalDates();
    }

    // ── Private ────────────────────────────────────────────────────────────

    private _sendJournalDates(): void {
        if (!this._view) { return; }
        const dates = this._scanJournalDates();
        this._view.webview.postMessage({ type: 'journalDates', dates });
    }

    /**
     * Scan the journal folder for YYYY-MM-DD.md files and return a sorted
     * array of date strings.
     */
    private _scanJournalDates(): string[] {
        const rootUri = this._notesRootUri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!rootUri) { return []; }

        const journalDir = path.join(rootUri.fsPath, this._journalFolder);
        let entries: string[];
        try {
            entries = fs.readdirSync(journalDir);
        } catch {
            return [];
        }

        const datePattern = /^(\d{4}-\d{2}-\d{2})\.md$/;
        const dates: string[] = [];
        for (const entry of entries) {
            const m = datePattern.exec(entry);
            if (m) { dates.push(m[1]); }
        }
        return dates.sort();
    }

    private _handleMessage(msg: Record<string, unknown>): void {
        switch (msg.type) {
            case 'openJournal': {
                const dateStr = msg.date as string;
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    vscode.commands.executeCommand('as-notes.openJournalForDate', dateStr);
                }
                break;
            }
            case 'ready':
                this._sendJournalDates();
                break;
        }
    }

    private _buildHtml(webview: vscode.Webview): string {
        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'calendar.js'),
        );
        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'calendar.css'),
        );
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${cssUri}">
</head>
<body>
    <div id="app"></div>
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
