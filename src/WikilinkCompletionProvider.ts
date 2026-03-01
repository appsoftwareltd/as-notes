import * as vscode from 'vscode';
import * as path from 'path';
import { IndexService } from './IndexService.js';
import { findInnermostOpenBracket, findMatchingCloseBracket, isLineInsideFrontMatter } from './CompletionUtils.js';

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
    private cachedItems: vscode.CompletionItem[] = [];
    private dirty = true;

    constructor(private readonly indexService: IndexService) { }

    /**
     * Mark the cache as stale. Call this after index updates (save, scan, rename).
     */
    refresh(): void {
        this.dirty = true;
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext,
    ): vscode.CompletionItem[] | undefined {
        // Suppress inside front matter
        const lines: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }
        if (isLineInsideFrontMatter(lines, position.line)) {
            return undefined;
        }

        // Find the innermost [[ before the cursor on this line
        const lineText = document.lineAt(position.line).text;
        const textUpToCursor = lineText.substring(0, position.character);
        const bracketCol = findInnermostOpenBracket(textUpToCursor);

        if (bracketCol === -1) {
            return undefined;
        }

        // Rebuild cache if stale
        if (this.dirty) {
            this.rebuildCache();
            this.dirty = false;
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

        // Clone items with the computed range
        return this.cachedItems.map(item => {
            const clone = new vscode.CompletionItem(item.label, item.kind);
            clone.detail = item.detail;
            clone.sortText = item.sortText;
            clone.filterText = item.filterText;
            clone.insertText = item.insertText;
            clone.range = range;
            return clone;
        });
    }

    /**
     * Rebuild the cached completion items from the index.
     */
    private rebuildCache(): void {
        this.cachedItems = [];

        if (!this.indexService.isOpen) {
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

        // Page completion items
        for (const page of pages) {
            const stem = page.filename.endsWith('.md')
                ? page.filename.slice(0, -3)
                : page.filename.endsWith('.markdown')
                    ? page.filename.slice(0, -9)
                    : page.filename;

            const item = new vscode.CompletionItem(stem, vscode.CompletionItemKind.File);

            // Show path for disambiguation when multiple pages share the same filename
            const isDuplicate = (filenameCount.get(page.filename.toLowerCase()) ?? 0) > 1;
            const dir = path.dirname(page.path);
            item.detail = isDuplicate && dir !== '.' ? dir : undefined;

            // Sort pages before aliases (0-prefix)
            item.sortText = `0-${stem.toLowerCase()}`;
            item.filterText = stem;
            item.insertText = `${stem}]]`;

            this.cachedItems.push(item);
        }

        // Forward-reference completion items (pages linked to but not yet created).
        // Sort between real pages (0-) and aliases (2-).
        const forwardRefs = this.indexService.getForwardReferencedPages();
        for (const ref of forwardRefs) {
            const item = new vscode.CompletionItem(ref.page_name, vscode.CompletionItemKind.File);
            item.detail = 'not yet created';
            item.sortText = `1-${ref.page_name.toLowerCase()}`;
            item.filterText = ref.page_name;
            item.insertText = `${ref.page_name}]]`;
            this.cachedItems.push(item);
        }

        // Alias completion items
        for (const alias of aliases) {
            const canonicalStem = alias.canonical_filename.endsWith('.md')
                ? alias.canonical_filename.slice(0, -3)
                : alias.canonical_filename;

            const item = new vscode.CompletionItem(alias.alias_name, vscode.CompletionItemKind.Reference);
            item.detail = `→ ${canonicalStem}`;

            // Sort aliases after forward refs (2-prefix)
            item.sortText = `2-${alias.alias_name.toLowerCase()}`;
            item.filterText = alias.alias_name;
            item.insertText = `${alias.alias_name}]]`;

            this.cachedItems.push(item);
        }
    }
}
