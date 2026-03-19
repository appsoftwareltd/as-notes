import * as vscode from 'vscode';
import { IndexService } from './IndexService.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SearchEntry {
    label: string;
    detail: string;
    pagePath: string;
    pageFileName: string;
    kind: 'page' | 'alias' | 'forward';
}

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * VS Code WebviewViewProvider that displays a wikilink/alias search bar
 * in the AS Notes sidebar above the Tasks view.
 *
 * - Autocomplete dropdown filters all indexed pages, aliases, and forward-
 *   referenced (uncreated) pages as the user types
 * - Selection + Enter (or "Go To" button) navigates to the file
 * - Forward references show a "New" indicator
 */
export class SearchPanelProvider implements vscode.WebviewViewProvider {
    static readonly VIEW_ID = 'as-notes-search';

    private _view?: vscode.WebviewView;
    private _fileService?: { navigateToFile(targetUri: vscode.Uri, pageFileName: string, sourceUri?: vscode.Uri): Promise<void> };
    private _notesRootUri?: vscode.Uri;

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _indexService: IndexService,
    ) { }

    /** Set the notes root URI for file navigation. */
    setNotesRootUri(uri: vscode.Uri): void {
        this._notesRootUri = uri;
    }

    /** Inject the file service once it's available (after index is ready). */
    setFileService(fileService: { navigateToFile(targetUri: vscode.Uri, pageFileName: string, sourceUri?: vscode.Uri): Promise<void> }): void {
        this._fileService = fileService;
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
        this._sendEntries();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Resend updated entries to the webview. Call after index changes. */
    refresh(): void {
        this._sendEntries();
    }

    // ── Private ────────────────────────────────────────────────────────────

    private _sendEntries(): void {
        if (!this._view) { return; }
        const entries = this._buildEntries();
        this._view.webview.postMessage({ type: 'update', entries });
    }

    private _buildEntries(): SearchEntry[] {
        if (!this._indexService.isOpen) { return []; }

        const entries: SearchEntry[] = [];

        // Pages — use filename stem as label, directory as detail
        for (const page of this._indexService.getAllPages()) {
            const stem = page.filename.replace(/\.md$/i, '');
            const dir = page.path.replace(/[/\\][^/\\]+$/, '') || '.';
            entries.push({
                label: stem,
                detail: dir === '.' ? '' : dir,
                pagePath: page.path,
                pageFileName: stem,
                kind: 'page',
            });
        }

        // Aliases — label is the alias name, detail shows "→ canonical stem"
        for (const alias of this._indexService.getAllAliases()) {
            const canonicalStem = alias.canonical_filename.replace(/\.md$/i, '');
            entries.push({
                label: alias.alias_name,
                detail: `→ ${canonicalStem}`,
                pagePath: alias.canonical_path,
                pageFileName: alias.alias_filename.replace(/\.md$/i, ''),
                kind: 'alias',
            });
        }

        // Forward references — uncreated pages
        for (const fwd of this._indexService.getForwardReferencedPages()) {
            entries.push({
                label: fwd.page_name,
                detail: '',
                pagePath: '',
                pageFileName: fwd.page_filename,
                kind: 'forward',
            });
        }

        return entries;
    }

    private async _handleMessage(msg: Record<string, unknown>): Promise<void> {
        if (msg.type !== 'navigateTo') { return; }

        const pageFileName = msg.pageFileName as string;
        const pagePath = msg.pagePath as string;
        const kind = msg.kind as string;

        const rootUri = this._notesRootUri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!rootUri) { return; }

        if (kind === 'forward' || !pagePath) {
            // Forward reference -- create file via navigateToFile
            if (this._fileService) {
                const targetUri = vscode.Uri.joinPath(rootUri, `${pageFileName}.md`);
                await this._fileService.navigateToFile(targetUri, pageFileName);
            }
        } else {
            // Existing page or alias -- open the file directly
            const fileUri = vscode.Uri.joinPath(rootUri, pagePath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
        }
    }

    private _buildHtml(webview: vscode.Webview): string {
        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'search.js'),
        );
        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'search.css'),
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
