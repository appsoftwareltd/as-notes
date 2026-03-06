import * as vscode from 'vscode';
import { IndexService, type BacklinkChainGroup, type BacklinkChainInstance, type PageRow } from './IndexService.js';
import type { LogService } from './LogService.js';
import * as path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

interface NavigateMessage {
    command: 'navigate';
    pagePath: string;
    line: number;
}

interface ToggleGroupModeMessage {
    command: 'toggleGroupMode';
    groupByChain: boolean;
}

interface ToggleContextWrapMessage {
    command: 'toggleContextWrap';
    wrapContext: boolean;
}

type WebviewMessage = NavigateMessage | ToggleGroupModeMessage | ToggleContextWrapMessage;

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
    /** The page the backlink panel is locked to (by URI). */
    private lockedUri: vscode.Uri | undefined;
    /** The page name the backlink panel is locked to (for forward references). */
    private lockedPageName: string | undefined;
    /** The page id when targeting a known page (includes alias resolution). */
    private lockedPageId: number | undefined;
    /** Whether backlinks are grouped by chain pattern (true) or flat by page (false). */
    private groupByChain: boolean;
    /** Whether context blocks wrap text (true) or truncate to one line (false). */
    private wrapContext: boolean;

    constructor(
        private indexService: IndexService,
        private workspaceRoot: vscode.Uri,
        private logger?: LogService,
    ) {
        this.groupByChain = vscode.workspace.getConfiguration('as-notes').get<boolean>('backlinkGroupByChain', false);
        this.wrapContext = vscode.workspace.getConfiguration('as-notes').get<boolean>('backlinkWrapContext', false);
    }

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
            this.createPanel();
        }

        // Lock to the currently active markdown file
        const editor = vscode.window.activeTextEditor;
        if (editor && isMarkdownUri(editor.document.uri)) {
            this.lockedUri = editor.document.uri;
            this.lockedPageName = undefined;
            this.lockedPageId = undefined;
        }
        this.logger?.info('BacklinkPanel', `show: locked to uri="${this.lockedUri?.toString()}"`);
        void this.renderForLockedTarget(true);
    }

    /**
     * Show the backlinks panel for a specific page name (e.g. from right-click
     * on a forward reference where no page file exists). Uses
     * getBacklinkChainsByName to query by page_filename directly.
     */
    showForName(pageName: string): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside, true);
        } else {
            this.createPanel();
        }

        this.lockedUri = undefined;
        this.lockedPageName = pageName;
        this.lockedPageId = undefined;
        void this.renderForLockedTarget(true);
    }

    /**
     * Show the backlinks panel for a known page (by id). Includes alias
     * resolution for complete results.
     */
    showForPage(pageId: number, pageTitle: string): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside, true);
        } else {
            this.createPanel();
        }

        this.lockedUri = undefined;
        this.lockedPageName = pageTitle;
        this.lockedPageId = pageId;
        void this.renderForLockedTarget(true);
    }

    /**
     * Refresh the panel content for the currently locked page.
     * Called when the index is updated (save, file events, etc.).
     * Does NOT change which page is displayed.
     */
    refresh(): void {
        if (!this.panel) { return; }
        void this.renderForLockedTarget(false);
    }

    /** Whether the panel is currently visible. */
    get isVisible(): boolean {
        return this.panel !== undefined;
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
        this.lockedUri = undefined;
        this.lockedPageName = undefined;
        this.lockedPageId = undefined;
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
    }

    // ── Private ────────────────────────────────────────────────────────────

    private createPanel(): void {
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

        this.disposables.push(
            this.panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
                if (msg.command === 'navigate') {
                    this.navigateToBacklink(msg.pagePath, msg.line);
                } else if (msg.command === 'toggleGroupMode') {
                    this.groupByChain = msg.groupByChain;
                    void this.renderForLockedTarget(false);
                } else if (msg.command === 'toggleContextWrap') {
                    this.wrapContext = msg.wrapContext;
                    void this.renderForLockedTarget(false);
                }
            }),
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.lockedUri = undefined;
            this.lockedPageName = undefined;
            this.lockedPageId = undefined;
        }, null, this.disposables);
    }

    private async renderForLockedTarget(showLoading: boolean): Promise<void> {
        if (!this.panel) { return; }

        if (showLoading) {
            // Show loading spinner immediately so the panel feels responsive
            this.renderLoading();
            // Yield to let the webview paint the loading state
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (this.lockedUri && isMarkdownUri(this.lockedUri)) {
            this.renderBacklinksForUri(this.lockedUri);
        } else if (this.lockedPageId !== undefined && this.lockedPageName) {
            this.renderBacklinksForPage(this.lockedPageId, this.lockedPageName);
        } else if (this.lockedPageName) {
            this.renderBacklinksForName(this.lockedPageName);
        } else {
            this.renderNoFile();
        }
    }

    private renderLoading(): void {
        if (!this.panel) { return; }
        this.panel.webview.html = this.buildHtml(
            'Backlinks',
            null,
            '<div class="loading-state"><span class="codicon codicon-loading codicon-modifier-spin"></span> Loading backlinks\u2026</div>',
        );
    }

    private renderBacklinksForUri(uri: vscode.Uri): void {
        if (!this.panel || !this.indexService.isOpen) { return; }

        const relativePath = vscode.workspace.asRelativePath(uri, false);
        this.logger?.info('BacklinkPanel', `renderBacklinksForUri: looking up path="${relativePath}" from uri="${uri.toString()}"`);
        const page = this.indexService.getPageByPath(relativePath);

        if (page) {
            this.logger?.info('BacklinkPanel', `renderBacklinksForUri: found page id=${page.id} title="${page.title}" path="${page.path}"`);
            const groups = this.indexService.getBacklinkChains(page.id);
            this.renderChainGroups(page.title, page.path, groups);
        } else {
            // Page not in index — fall back to name-based lookup (same as forward references)
            this.logger?.info('BacklinkPanel', `renderBacklinksForUri: page NOT FOUND for path="${relativePath}", falling back to name-based lookup`);
            const pageName = this.getPageTitle(uri);
            const groups = this.indexService.getBacklinkChainsByName(pageName);
            this.renderChainGroups(pageName, null, groups);
        }
    }

    private renderBacklinksForPage(pageId: number, pageTitle: string): void {
        if (!this.panel || !this.indexService.isOpen) { return; }
        const groups = this.indexService.getBacklinkChains(pageId);
        this.renderChainGroups(pageTitle, null, groups);
    }

    private renderBacklinksForName(pageName: string): void {
        if (!this.panel || !this.indexService.isOpen) { return; }

        const groups = this.indexService.getBacklinkChainsByName(pageName);
        this.renderChainGroups(pageName, null, groups);
    }

    private renderChainGroups(pageTitle: string, originPagePath: string | null, groups: BacklinkChainGroup[]): void {
        if (!this.panel) { return; }

        if (groups.length === 0) {
            this.panel.webview.html = this.buildHtml(
                pageTitle,
                originPagePath,
                '<div class="empty-state">No backlinks found for this page.</div>',
            );
            return;
        }

        const totalInstances = groups.reduce((sum, g) => sum + g.instances.length, 0);

        if (this.groupByChain) {
            const summaryHtml = `<div class="summary">${totalInstances} backlink${totalInstances === 1 ? '' : 's'} in ${groups.length} pattern${groups.length === 1 ? '' : 's'}</div>`;
            const groupsHtml = groups.map(group => this.renderChainGroup(group)).join('');
            this.panel.webview.html = this.buildHtml(pageTitle, originPagePath, summaryHtml + groupsHtml);
        } else {
            const summaryHtml = `<div class="summary">${totalInstances} backlink${totalInstances === 1 ? '' : 's'}</div>`;
            const flatHtml = this.renderFlatInstances(groups);
            this.panel.webview.html = this.buildHtml(pageTitle, originPagePath, summaryHtml + flatHtml);
        }
    }

    private renderFlatInstances(groups: BacklinkChainGroup[]): string {
        const allInstances = groups.flatMap(g => g.instances);

        // Group instances by source page
        const byPage = new Map<string, { page: PageRow; instances: BacklinkChainInstance[] }>();
        for (const instance of allInstances) {
            const key = instance.sourcePage.path;
            let entry = byPage.get(key);
            if (!entry) {
                entry = { page: instance.sourcePage, instances: [] };
                byPage.set(key, entry);
            }
            entry.instances.push(instance);
        }

        // Sort pages: journal (YYYY_MM_DD) descending (latest first), then non-journal alphabetical
        const journalPattern = /^\d{4}_\d{2}_\d{2}$/;
        const sortedPages = [...byPage.values()].sort((a, b) => {
            const nameA = (a.page.title || a.page.filename).replace(/\.md$/, '');
            const nameB = (b.page.title || b.page.filename).replace(/\.md$/, '');
            const aJournal = journalPattern.test(nameA);
            const bJournal = journalPattern.test(nameB);
            if (aJournal && bJournal) { return nameB.localeCompare(nameA); } // descending
            if (aJournal && !bJournal) { return -1; }
            if (!aJournal && bJournal) { return 1; }
            return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
        });

        return sortedPages.map(({ page, instances }) => {
            const pageTitle = escapeHtml(page.title || page.filename.replace(/\.md$/, ''));
            const pagePath = escapeAttr(page.path);
            const instancesHtml = instances.map(instance => this.renderFlatChainInstance(instance)).join('');
            return `<div class="flat-page-group">
                <div class="instance-source" onclick="navigate('${pagePath}', 0)">
                    <span class="source-title">${pageTitle}</span>
                </div>
                ${instancesHtml}
            </div>`;
        }).join('');
    }

    private renderFlatChainInstance(instance: BacklinkChainInstance): string {
        const pagePath = escapeAttr(instance.sourcePage.path);

        const chainLinksHtml = instance.chain.map(link => {
            const lineNum = link.line + 1;
            return `<span class="instance-link" onclick="event.stopPropagation(); navigate('${pagePath}', ${link.line})">[[${escapeHtml(link.pageName)}]] <span class="line-ref">L${lineNum}</span></span>`;
        }).join('<span class="chain-arrow">\u2009\u2192\u2009</span>');

        const lastLink = instance.chain[instance.chain.length - 1];
        let contextHtml = '';
        if (lastLink?.context) {
            const contextLines = lastLink.context.split('\n');
            const wikiLinkLineIndex = contextLines.length >= 2 && lastLink.line > 0 ? 1 : 0;

            const nonEmptyLines = contextLines.filter(l => l.trimEnd().length > 0);
            const commonIndent = nonEmptyLines.length > 0
                ? Math.min(...nonEmptyLines.map(l => l.match(/^\s*/)?.[0].length ?? 0))
                : 0;
            const wikiLinkLine = contextLines[wikiLinkLineIndex] ?? '';
            const wikiLinkIndent = wikiLinkLine.match(/^\s*/)?.[0].length ?? 0;
            const colOffset = Math.min(commonIndent, wikiLinkIndent);

            const rendered = contextLines.map((line, i) => {
                const stripped = commonIndent > 0 ? line.substring(Math.min(commonIndent, line.length)) : line;
                const trimmed = stripped.trimEnd();
                if (i === wikiLinkLineIndex) {
                    const startCol = lastLink.startCol - colOffset;
                    const endCol = lastLink.endCol + 1 - colOffset;
                    const before = escapeHtml(trimmed.substring(0, startCol));
                    const highlight = escapeHtml(trimmed.substring(startCol, endCol));
                    const after = escapeHtml(trimmed.substring(endCol));
                    return `${before}<span class="context-highlight" onclick="event.stopPropagation(); navigate('${pagePath}', ${lastLink.line})">${highlight}</span>${after}`;
                }
                return escapeHtml(trimmed);
            }).join('\n');
            contextHtml = `<pre class="instance-context ${this.wrapContext ? 'context-wrap' : 'context-compact'}">${rendered}</pre>`;
        }

        return `<div class="chain-instance">
            <div class="instance-chain">${chainLinksHtml}</div>
            ${contextHtml}
        </div>`;
    }

    private renderChainGroup(group: BacklinkChainGroup): string {
        const patternHtml = group.displayPattern
            .map(name => `<span class="pattern-link">[[${escapeHtml(name)}]]</span>`)
            .join('<span class="chain-arrow">\u2009\u2192\u2009</span>');

        const count = group.instances.length;
        const groupId = group.patternKey.replace(/[^a-zA-Z0-9]/g, '_');

        const instancesHtml = group.instances
            .map(instance => this.renderChainInstance(instance))
            .join('');

        return `<div class="chain-group">
            <div class="chain-group-header" onclick="toggleGroup('${escapeAttr(groupId)}')">
                <span class="group-chevron codicon codicon-chevron-down" id="chevron-${escapeAttr(groupId)}"></span>
                <span class="chain-pattern">${patternHtml}</span>
                <span class="group-count">${count}</span>
            </div>
            <div class="chain-group-body" id="group-${escapeAttr(groupId)}">
                ${instancesHtml}
            </div>
        </div>`;
    }

    private renderChainInstance(instance: BacklinkChainInstance): string {
        const pageTitle = escapeHtml(
            instance.sourcePage.title || instance.sourcePage.filename.replace(/\.md$/, ''),
        );
        const pagePath = escapeAttr(instance.sourcePage.path);

        const chainLinksHtml = instance.chain.map(link => {
            const lineNum = link.line + 1; // 1-based for display
            return `<span class="instance-link" onclick="event.stopPropagation(); navigate('${pagePath}', ${link.line})">[[${escapeHtml(link.pageName)}]] <span class="line-ref">L${lineNum}</span></span>`;
        }).join('<span class="chain-arrow">\u2009\u2192\u2009</span>');

        // Context from the last link in the chain (the target link)
        const lastLink = instance.chain[instance.chain.length - 1];
        let contextHtml = '';
        if (lastLink?.context) {
            const contextLines = lastLink.context.split('\n');
            // The wikilink's own line is in the middle (or first if no preceding line)
            // Determine which line in the snippet is the wikilink line
            // Clamp to actual context length for single-line context (e.g. stale index entries)
            const wikiLinkLineIndex = contextLines.length >= 2 && lastLink.line > 0 ? 1 : 0;

            // Strip common leading whitespace so indented notes don't waste space
            const nonEmptyLines = contextLines.filter(l => l.trimEnd().length > 0);
            const commonIndent = nonEmptyLines.length > 0
                ? Math.min(...nonEmptyLines.map(l => l.match(/^\s*/)?.[0].length ?? 0))
                : 0;
            // Track how much we stripped so startCol/endCol still work
            const wikiLinkLine = contextLines[wikiLinkLineIndex] ?? '';
            const wikiLinkIndent = wikiLinkLine.match(/^\s*/)?.[0].length ?? 0;
            const colOffset = Math.min(commonIndent, wikiLinkIndent);

            const rendered = contextLines.map((line, i) => {
                const stripped = commonIndent > 0 ? line.substring(Math.min(commonIndent, line.length)) : line;
                const trimmed = stripped.trimEnd();
                if (i === wikiLinkLineIndex) {
                    const startCol = lastLink.startCol - colOffset;
                    const endCol = lastLink.endCol + 1 - colOffset; // endCol is inclusive, substring needs exclusive
                    const before = escapeHtml(trimmed.substring(0, startCol));
                    const highlight = escapeHtml(trimmed.substring(startCol, endCol));
                    const after = escapeHtml(trimmed.substring(endCol));
                    return `${before}<span class="context-highlight" onclick="event.stopPropagation(); navigate('${pagePath}', ${lastLink.line})">${highlight}</span>${after}`;
                }
                return escapeHtml(trimmed);
            }).join('\n');
            contextHtml = `<pre class="instance-context ${this.wrapContext ? 'context-wrap' : 'context-compact'}">${rendered}</pre>`;
        }

        return `<div class="chain-instance">
            <div class="instance-source" onclick="navigate('${pagePath}', 0)">
                <span class="source-title">${pageTitle}</span>
            </div>
            <div class="instance-chain">${chainLinksHtml}</div>
            ${contextHtml}
        </div>`;
    }

    private renderNoFile(): void {
        if (!this.panel) { return; }
        this.panel.webview.html = this.buildHtml(
            'Backlinks',
            null,
            '<div class="empty-state">Open a markdown file to see its backlinks.</div>',
        );
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
        const groupByChain = this.groupByChain;
        const wrapContext = this.wrapContext;
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
            flex: 1;
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

        /* Loading state */
        .loading-state {
            color: var(--vscode-descriptionForeground, rgba(128,128,128,0.8));
            padding: 20px 0;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .codicon-loading::before {
            content: "\\eb19";
            font-family: codicon;
            font-size: 16px;
        }

        .codicon-modifier-spin {
            animation: codicon-spin 1.5s linear infinite;
        }

        @keyframes codicon-spin {
            100% { transform: rotate(360deg); }
        }

        /* Codicon support */
        .codicon-chevron-down::before {
            content: "\\eab4";
            font-family: codicon;
            font-size: 14px;
        }

        .codicon-chevron-right::before {
            content: "\\eab6";
            font-family: codicon;
            font-size: 14px;
        }

        /* Chain group */
        .chain-group {
            margin-bottom: 14px;
        }

        /* Flat page group */
        .flat-page-group {
            margin-bottom: 14px;
        }

        .chain-group-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 8px;
            cursor: pointer;
            border-radius: 3px;
            font-weight: 600;
            color: #fff;
            background: var(--vscode-textLink-foreground, #3794ff);
            margin-bottom: 6px;
        }

        .chain-group-header:hover {
            filter: brightness(1.15);
        }

        .group-chevron {
            flex-shrink: 0;
        }

        .chain-pattern {
            flex: 1;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 2px;
            font-size: var(--vscode-editor-font-size, 13px);
        }

        .pattern-link {
            color: #fff;
        }

        .chain-arrow {
            color: var(--vscode-descriptionForeground, rgba(128,128,128,0.4));
            font-size: 0.85em;
        }

        .chain-group-header .chain-arrow {
            color: rgba(255, 255, 255, 0.7);
        }

        .group-count {
            font-size: 0.8em;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.85);
            background: rgba(255, 255, 255, 0.2);
            padding: 1px 6px;
            border-radius: 8px;
            min-width: 18px;
            text-align: center;
        }

        .chain-group-body {
            padding-left: 8px;
        }

        .chain-group-body.collapsed {
            display: none;
        }

        /* Chain instance */
        .chain-instance {
            margin-bottom: 8px;
            padding: 2px 0;
        }

        .instance-source {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 6px;
            cursor: pointer;
            border-radius: 3px;
            color: var(--vscode-foreground);
            font-weight: 500;
        }

        .instance-source:hover {
            background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
        }

        .source-title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .instance-chain {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 2px;
            padding: 2px 6px 2px 28px;
            font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
            font-size: var(--vscode-editor-font-size, 13px);
        }

        .instance-link {
            color: var(--vscode-descriptionForeground, rgba(128,128,128,0.7));
            cursor: pointer;
            padding: 1px 3px;
            border-radius: 2px;
            font-weight: 600;
        }

        .instance-link:hover {
            color: var(--vscode-textLink-foreground, #3794ff);
            background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
            text-decoration: underline;
        }

        .line-ref {
            font-size: 0.8em;
            color: #666;
        }

        .instance-context {
            margin: 4px 0 6px 28px;
            padding: 6px 10px;
            border-left: 3px solid var(--vscode-textBlockQuote-border, rgba(128,128,128,0.3));
            background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.05));
            font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
            font-size: var(--vscode-editor-font-size, 13px);
            color: #999;
            border-radius: 0 3px 3px 0;
            line-height: 1.5;
        }

        .instance-context.context-compact {
            white-space: pre;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .instance-context.context-wrap {
            white-space: pre-wrap;
            word-break: break-word;
        }

        .context-highlight {
            color: var(--vscode-textLink-foreground, #3794ff);
            font-weight: 600;
            cursor: pointer;
        }

        .context-highlight:hover {
            text-decoration: underline;
        }

        .toggle-group-mode {
            display: flex;
            align-items: center;
            gap: 0;
            border-radius: 3px;
            overflow: hidden;
            border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, rgba(128,128,128,0.3)));
            font-size: 0.8em;
            white-space: nowrap;
        }

        .toggle-segment {
            padding: 2px 8px;
            cursor: pointer;
            color: var(--vscode-descriptionForeground, rgba(128,128,128,0.7));
            transition: background 0.1s, color 0.1s;
        }

        .toggle-segment:hover {
            color: var(--vscode-foreground);
            background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
        }

        .toggle-segment.active {
            color: #fff;
            background: var(--vscode-textLink-foreground, #3794ff);
            cursor: default;
        }
    </style>
</head>
<body>
    <div class="page-header">
        <h1>Backlinks: ${escapeHtml(pageTitle)}</h1>
        <div class="toggle-group-mode">
            <span class="toggle-segment ${wrapContext ? '' : 'active'}" onclick="${wrapContext ? 'toggleContextWrap()' : ''}">Compact</span>
            <span class="toggle-segment ${wrapContext ? 'active' : ''}" onclick="${wrapContext ? '' : 'toggleContextWrap()'}">Wrap</span>
        </div>
        <div class="toggle-group-mode">
            <span class="toggle-segment ${groupByChain ? '' : 'active'}" onclick="${groupByChain ? 'toggleGroupMode()' : ''}">Flat</span>
            <span class="toggle-segment ${groupByChain ? 'active' : ''}" onclick="${groupByChain ? '' : 'toggleGroupMode()'}">Grouped</span>
        </div>
    </div>
    ${originLink}
    ${bodyContent}

    <script>
        const vscode = acquireVsCodeApi();
        let currentGroupByChain = ${groupByChain};
        let currentWrapContext = ${wrapContext};

        function navigate(pagePath, line) {
            vscode.postMessage({
                command: 'navigate',
                pagePath: pagePath,
                line: line,
            });
        }

        function toggleGroup(groupId) {
            const body = document.getElementById('group-' + groupId);
            const chevron = document.getElementById('chevron-' + groupId);
            if (body && chevron) {
                body.classList.toggle('collapsed');
                if (body.classList.contains('collapsed')) {
                    chevron.className = 'group-chevron codicon codicon-chevron-right';
                } else {
                    chevron.className = 'group-chevron codicon codicon-chevron-down';
                }
            }
            saveState();
        }

        function toggleGroupMode() {
            currentGroupByChain = !currentGroupByChain;
            saveState();
            vscode.postMessage({
                command: 'toggleGroupMode',
                groupByChain: currentGroupByChain,
            });
        }

        function toggleContextWrap() {
            currentWrapContext = !currentWrapContext;
            saveState();
            vscode.postMessage({
                command: 'toggleContextWrap',
                wrapContext: currentWrapContext,
            });
        }

        function saveState() {
            const collapsed = [];
            document.querySelectorAll('.chain-group-body.collapsed').forEach(el => {
                if (el.id) { collapsed.push(el.id); }
            });
            vscode.setState({
                scrollTop: document.documentElement.scrollTop || document.body.scrollTop,
                collapsedGroups: collapsed,
                groupByChain: currentGroupByChain,
                wrapContext: currentWrapContext,
            });
        }

        function restoreState() {
            const state = vscode.getState();
            if (!state) { return; }
            if (state.collapsedGroups) {
                state.collapsedGroups.forEach(id => {
                    const body = document.getElementById(id);
                    const chevronId = 'chevron-' + id.replace('group-', '');
                    const chevron = document.getElementById(chevronId);
                    if (body) { body.classList.add('collapsed'); }
                    if (chevron) { chevron.className = 'group-chevron codicon codicon-chevron-right'; }
                });
            }
            if (typeof state.scrollTop === 'number') {
                window.scrollTo(0, state.scrollTop);
            }
        }

        // Debounced scroll save
        let scrollTimer;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(saveState, 100);
        });

        // Restore on load
        restoreState();
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
