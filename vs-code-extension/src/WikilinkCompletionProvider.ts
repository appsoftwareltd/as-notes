import * as vscode from 'vscode';
import * as path from 'path';
import { IndexService } from './IndexService.js';
import { findInnermostOpenBracket, findMatchingCloseBracket, isLineInsideFrontMatter, isPositionInsideCode } from './CompletionUtils.js';
import { LogService } from './LogService.js';

/**
 * Lightweight cached completion data — no VS Code object overhead.
 * CompletionItem instances are only created in the hot path.
 */
interface CachedCompletionEntry {
    label: string;
    kind: vscode.CompletionItemKind;
    detail: string | undefined;
    sortText: string;
    filterText: string;
    insertText: string;
}

/**
 * Provides autocomplete suggestions for wikilinks.
 *
 * Triggers when the user types `[[` in a markdown file. Shows all indexed pages
 * and aliases, with type-to-filter. Selecting an item inserts the page name and
 * auto-closes with `]]`.
 *
 * Nested wikilinks are supported: typing `[[` inside an existing unclosed `[[...`
 * scopes the replacement to the innermost `[[`.
 *
 * Completions are suppressed inside front matter blocks (between `---` fences).
 */
export class WikilinkCompletionProvider implements vscode.CompletionItemProvider {
    private cachedEntries: CachedCompletionEntry[] = [];

    constructor(
        private readonly indexService: IndexService,
        private readonly logger: LogService,
    ) { }

    /**
     * Rebuild the completion cache from the index. Call this after index updates
     * (save, scan, rename) so the cache is always warm when the user types `[[`.
     */
    refresh(): void {
        this.rebuildCache();
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext,
    ): vscode.CompletionList | undefined {
        const end = this.logger.time('completion', 'provideCompletionItems');

        // Suppress inside front matter
        const lines: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }
        if (isLineInsideFrontMatter(lines, position.line)) {
            end();
            return undefined;
        }
        if (isPositionInsideCode(lines, position.line, Math.max(0, position.character - 1))) {
            end();
            return undefined;
        }

        // Find the innermost [[ before the cursor on this line
        const lineText = document.lineAt(position.line).text;
        const textUpToCursor = lineText.substring(0, position.character);
        const bracketCol = findInnermostOpenBracket(textUpToCursor);

        if (bracketCol === -1) {
            end();
            return undefined;
        }

        // Set the replacement range: from after the [[ to just past the matching ]]
        // (or to the cursor if no ]] exists yet).
        const rangeStart = new vscode.Position(position.line, bracketCol + 2);
        const textAfterCursor = lineText.substring(position.character);
        const closeBracketOffset = findMatchingCloseBracket(textAfterCursor);
        const rangeEnd = closeBracketOffset !== -1
            ? new vscode.Position(position.line, position.character + closeBracketOffset)
            : position;
        const range = new vscode.Range(rangeStart, rangeEnd);

        // Build CompletionItem instances from lightweight cache
        const items = this.cachedEntries.map(entry => {
            const item = new vscode.CompletionItem(entry.label, entry.kind);
            item.detail = entry.detail;
            item.sortText = entry.sortText;
            item.filterText = entry.filterText;
            item.insertText = entry.insertText;
            item.range = range;
            return item;
        });

        this.logger.info('completion', `returning ${items.length} items`);
        end();

        // Return as CompletionList with isIncomplete: true so VS Code re-queries
        // on every keystroke (including backspace), keeping the widget alive.
        return new vscode.CompletionList(items, true);
    }

    /**
     * Rebuild the cached completion entries from the index.
     */
    private rebuildCache(): void {
        const end = this.logger.time('completion', 'rebuildCache');

        this.cachedEntries = [];

        if (!this.indexService.isOpen) {
            end();
            return;
        }

        const pages = this.indexService.getAllPages();
        const aliases = this.indexService.getAllAliases();

        // Track filenames that appear more than once (for disambiguation)
        const filenameCount = new Map<string, number>();
        for (const page of pages) {
            const lower = page.filename.toLowerCase();
            filenameCount.set(lower, (filenameCount.get(lower) ?? 0) + 1);
        }

        // Page completion entries
        for (const page of pages) {
            const stem = page.filename.endsWith('.md')
                ? page.filename.slice(0, -3)
                : page.filename.endsWith('.markdown')
                    ? page.filename.slice(0, -9)
                    : page.filename;

            const isDuplicate = (filenameCount.get(page.filename.toLowerCase()) ?? 0) > 1;
            const dir = path.dirname(page.path);

            this.cachedEntries.push({
                label: stem,
                kind: vscode.CompletionItemKind.File,
                detail: isDuplicate && dir !== '.' ? dir : undefined,
                sortText: `0-${stem.toLowerCase()}`,
                filterText: stem,
                insertText: `${stem}]]`,
            });
        }

        // Forward-reference completion entries (pages linked to but not yet created).
        const forwardRefs = this.indexService.getForwardReferencedPages();
        for (const ref of forwardRefs) {
            this.cachedEntries.push({
                label: ref.page_name,
                kind: vscode.CompletionItemKind.File,
                detail: 'not yet created',
                sortText: `1-${ref.page_name.toLowerCase()}`,
                filterText: ref.page_name,
                insertText: `${ref.page_name}]]`,
            });
        }

        // Alias completion entries
        for (const alias of aliases) {
            const canonicalStem = alias.canonical_filename.endsWith('.md')
                ? alias.canonical_filename.slice(0, -3)
                : alias.canonical_filename;

            this.cachedEntries.push({
                label: alias.alias_name,
                kind: vscode.CompletionItemKind.Reference,
                detail: `→ ${canonicalStem}`,
                sortText: `2-${alias.alias_name.toLowerCase()}`,
                filterText: alias.alias_name,
                insertText: `${alias.alias_name}]]`,
            });
        }

        this.logger.info('completion', `cache rebuilt: ${pages.length} pages, ${forwardRefs.length} fwd refs, ${aliases.length} aliases (${this.cachedEntries.length} total)`);
        end();
    }
}
