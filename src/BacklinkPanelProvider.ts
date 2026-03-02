import * as vscode from 'vscode';
import { IndexService, type BacklinkEntry, type PageRow } from './IndexService.js';
import * as path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

interface BacklinkGroup {
    sourcePage: PageRow;
    entries: BacklinkEntry[];
}

interface NavigateMessage {
    command: 'navigate';
    pagePath: string;
    line: number;
}

type WebviewMessage = NavigateMessage;

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * Manages a webview panel that displays backlinks for a specific markdown file.
 *
 * Opens beside the active editor (ViewColumn.Beside). The panel stays locked
 * to the page it was opened for — it does not follow the active editor.
 * Triggering the command again (e.g. Ctrl+Alt+B) re-targets the panel to
 * the currently active file. A clickable link at the top lets the user
 * navigate back to the origin page after browsing through backlinks.
 */
export class BacklinkPanelProvider implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    /** The page the backlink panel is locked to. */
    private lockedUri: vscode.Uri | undefined;

    constructor(
        private indexService: IndexService,
        private workspaceRoot: vscode.Uri,
    ) { }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Show the backlinks panel. Creates a new panel if one doesn't exist,
     * otherwise reveals the existing one. Always (re-)targets the panel to
     * the currently active markdown file.
     */
    show(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside, true);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'as-notes-backlinks',
                'Backlinks',
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                },
            );

            this.panel.iconPath = new vscode.ThemeIcon('references');

            // Handle messages from the webview (click-to-navigate)
            this.disposables.push(
                this.panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
                    if (msg.command === 'navigate') {
                        this.navigateToBacklink(msg.pagePath, msg.line);
                    }
                }),
            );

            // Clean up when the panel is closed by the user
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.lockedUri = undefined;
            }, null, this.disposables);
        }

        // Lock to the currently active markdown file
        const editor = vscode.window.activeTextEditor;
        if (editor && isMarkdownUri(editor.document.uri)) {
            this.lockedUri = editor.document.uri;
        }
        this.renderForLockedUri();
    }

    /**
     * Refresh the panel content for the currently locked page.
     * Called when the index is updated (save, file events, etc.).
     * Does NOT change which page is displayed.
     */
    refresh(): void {
        if (!this.panel) { return; }
        this.renderForLockedUri();
    }

    /** Whether the panel is currently visible. */
    get isVisible(): boolean {
        return this.panel !== undefined;
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
        this.lockedUri = undefined;
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
    }

    // ── Private ────────────────────────────────────────────────────────────

    private renderForLockedUri(): void {
        if (this.lockedUri && isMarkdownUri(this.lockedUri)) {
            this.renderBacklinks(this.lockedUri);
        } else {
            this.renderNoFile();
        }
    }

    private renderBacklinks(uri: vscode.Uri): void {
        if (!this.panel || !this.indexService.isOpen) { return; }

        const relativePath = vscode.workspace.asRelativePath(uri, false);
        const page = this.indexService.getPageByPath(relativePath);

        if (!page) {
            this.panel.webview.html = this.buildHtml(
                this.getPageTitle(uri),
                null,
                '<div class="empty-state">This file is not yet indexed.</div>',
            );
            return;
        }

        const entries = this.indexService.getBacklinksIncludingAliases(page.id);

        if (entries.length === 0) {
            this.panel.webview.html = this.buildHtml(
                page.title,
                page.path,
                '<div class="empty-state">No backlinks found for this page.</div>',
            );
            return;
        }

        // Group by source page
        const groups = this.groupBySourcePage(entries);
        const html = this.renderGroups(groups, entries.length);
        this.panel.webview.html = this.buildHtml(page.title, page.path, html);
    }

    private renderNoFile(): void {
        if (!this.panel) { return; }
        this.panel.webview.html = this.buildHtml(
            'Backlinks',
            null,
            '<div class="empty-state">Open a markdown file to see its backlinks.</div>',
        );
    }

    private groupBySourcePage(entries: BacklinkEntry[]): BacklinkGroup[] {
        const map = new Map<number, BacklinkGroup>();
        for (const entry of entries) {
            const existing = map.get(entry.sourcePage.id);
            if (existing) {
                existing.entries.push(entry);
            } else {
                map.set(entry.sourcePage.id, {
                    sourcePage: entry.sourcePage,
                    entries: [entry],
                });
            }
        }
        return Array.from(map.values());
    }

    private renderGroups(groups: BacklinkGroup[], totalCount: number): string {
        const summary = `<div class="summary">${totalCount} backlink${totalCount === 1 ? '' : 's'} from ${groups.length} page${groups.length === 1 ? '' : 's'}</div>`;

        const groupsHtml = groups.map(group => {
            const title = escapeHtml(group.sourcePage.title || group.sourcePage.filename.replace(/\.md$/, ''));
            const filePath = escapeHtml(group.sourcePage.path);
            const count = group.entries.length;

            const entriesHtml = group.entries.map(entry => {
                const lineNum = entry.link.line + 1; // 1-based for display
                const context = entry.link.context || '';
                const highlightedContext = this.highlightWikilink(context, entry.link.start_col, entry.link.end_col);
                const pagePath = escapeAttr(entry.sourcePage.path);

                return `<div class="backlink-entry" data-path="${pagePath}" data-line="${entry.link.line}" onclick="navigate('${pagePath}', ${entry.link.line})">
                    <span class="line-number">L${lineNum}</span>
                    <span class="context">${highlightedContext}</span>
                </div>`;
            }).join('');

            return `<div class="backlink-group">
                <div class="group-header" data-path="${escapeAttr(group.sourcePage.path)}" data-line="0" onclick="navigate('${escapeAttr(group.sourcePage.path)}', 0)">
                    <span class="codicon codicon-file-text"></span>
                    <span class="group-title">${title}</span>
                    <span class="group-count">${count}</span>
                </div>
                <div class="group-path">${filePath}</div>
                <div class="group-entries">${entriesHtml}</div>
            </div>`;
        }).join('');

        return summary + groupsHtml;
    }

    /**
     * Highlight the wikilink within the context line using start/end column positions.
     * Escapes HTML in the non-highlighted parts.
     */
    private highlightWikilink(context: string, startCol: number, endCol: number): string {
        if (startCol < 0 || endCol <= startCol || startCol >= context.length) {
            return escapeHtml(context);
        }
        const before = escapeHtml(context.substring(0, startCol));
        const link = escapeHtml(context.substring(startCol, endCol + 1));
        const after = escapeHtml(context.substring(endCol + 1));
        return `${before}<span class="highlight">${link}</span>${after}`;
    }

    private getPageTitle(uri: vscode.Uri): string {
        const filename = path.basename(uri.fsPath);
        return filename.endsWith('.md') ? filename.slice(0, -3) : filename;
    }

    private async navigateToBacklink(pagePath: string, line: number): Promise<void> {
        try {
            const fileUri = vscode.Uri.joinPath(this.workspaceRoot, pagePath);
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            const position = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter,
            );
        } catch (err) {
            console.warn('as-notes: failed to navigate to backlink:', err);
        }
    }

    private buildHtml(pageTitle: string, originPagePath: string | null, bodyContent: string): string {
        const originLink = originPagePath
            ? `<div class="origin-link" onclick="navigate('${escapeAttr(originPagePath)}', 0)">
                    <span class="codicon codicon-arrow-left"></span>
                    <span>Backlinks for: ${escapeHtml(pageTitle)}</span>
                </div>`
            : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backlinks</title>
    <style>
        /* Reset */
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
            font-size: var(--vscode-font-size, 13px);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 12px 16px;
            line-height: 1.5;
        }

        /* Page header */
        .page-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding-bottom: 10px;
            margin-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, rgba(128,128,128,0.2)));
        }

        .page-header h1 {
            font-size: 1.15em;
            font-weight: 600;
            color: var(--vscode-foreground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Origin page link */
        .origin-link {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 8px;
            margin-bottom: 12px;
            cursor: pointer;
            border-radius: 3px;
            color: var(--vscode-textLink-foreground, #3794ff);
            font-size: 0.9em;
        }

        .origin-link:hover {
            background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
            text-decoration: underline;
        }

        .codicon-arrow-left::before {
            content: "\\ea9b";
            font-family: codicon;
            font-size: 14px;
        }

        /* Summary line */
        .summary {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground, rgba(128,128,128,0.8));
            margin-bottom: 14px;
            padding: 4px 0;
        }

        /* Empty state */
        .empty-state {
            color: var(--vscode-descriptionForeground, rgba(128,128,128,0.8));
            font-style: italic;
            padding: 20px 0;
            text-align: center;
        }

        /* Backlink group */
        .backlink-group {
            margin-bottom: 16px;
        }

        .group-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 6px;
            cursor: pointer;
            border-radius: 3px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .group-header:hover {
            background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
        }

        .group-title {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .group-count {
            font-size: 0.8em;
            font-weight: 400;
            color: var(--vscode-descriptionForeground, rgba(128,128,128,0.7));
            background: var(--vscode-badge-background, rgba(128,128,128,0.15));
            padding: 1px 6px;
            border-radius: 8px;
            min-width: 18px;
            text-align: center;
        }

        .group-path {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground, rgba(128,128,128,0.6));
            padding: 0 6px 4px 28px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Backlink entries */
        .group-entries {
            padding-left: 8px;
        }

        .backlink-entry {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 3px 6px;
            cursor: pointer;
            border-radius: 3px;
            border-left: 2px solid transparent;
        }

        .backlink-entry:hover {
            background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
            border-left-color: var(--vscode-focusBorder, #007acc);
        }

        .line-number {
            font-size: 0.8em;
            font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
            color: var(--vscode-editorLineNumber-foreground, rgba(128,128,128,0.5));
            min-width: 32px;
            text-align: right;
            flex-shrink: 0;
            padding-top: 1px;
        }

        .context {
            font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
            font-size: var(--vscode-editor-font-size, 13px);
            color: var(--vscode-editor-foreground, var(--vscode-foreground));
            white-space: pre;
            overflow: hidden;
            text-overflow: ellipsis;
            opacity: 0.85;
        }

        .context .highlight {
            color: var(--vscode-textLink-foreground, #3794ff);
            font-weight: 600;
            opacity: 1;
        }

        /* Codicon support */
        .codicon-file-text::before {
            content: "\\eb60";
            font-family: codicon;
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="page-header">
        <h1>Backlinks: ${escapeHtml(pageTitle)}</h1>
    </div>
    ${originLink}
    ${bodyContent}

    <script>
        const vscode = acquireVsCodeApi();

        function navigate(pagePath, line) {
            vscode.postMessage({
                command: 'navigate',
                pagePath: pagePath,
                line: line,
            });
        }
    </script>
</body>
</html>`;
    }
}

// ── Utility ────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;');
}

function isMarkdownUri(uri: vscode.Uri): boolean {
    const ext = path.extname(uri.fsPath).toLowerCase();
    return ext === '.md' || ext === '.markdown';
}
