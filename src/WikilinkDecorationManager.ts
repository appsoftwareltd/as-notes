import * as vscode from 'vscode';
import { Wikilink } from './Wikilink.js';
import { WikilinkService, LinkSegment } from './WikilinkService.js';
import { LogService } from './LogService.js';

/**
 * Per-line parse cache entry.
 */
interface LineCacheEntry {
    wikilinks: Wikilink[];
    segments: LinkSegment[];
}

/**
 * Manages wikilink decorations in the editor.
 *
 * - Default decoration: subtle blue text for all wikilink ranges
 * - Active decoration: distinct blue highlight for the specific link under cursor
 *
 * When the cursor is positioned within a nested wikilink, only the innermost
 * link is highlighted with the active style; the remaining wikilink text
 * reverts to normal editor colour.
 *
 * Performance: wikilinks and segments are cached per document version. Text
 * changes trigger a debounced full re-parse; selection changes only
 * re-classify the existing cached segments, avoiding redundant parsing.
 */
export class WikilinkDecorationManager implements vscode.Disposable {
    private readonly wikilinkService: WikilinkService;
    private readonly logger: LogService;
    private readonly disposables: vscode.Disposable[] = [];

    /** Subtle blue for all wikilink text (visible but not prominent). */
    private readonly defaultDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#6699cc',
    });

    /** Bright blue + underline for the active (hovered/cursor) wikilink. */
    private readonly activeDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#4488ff',
        textDecoration: 'underline',
        fontWeight: 'bold',
    });

    /** Wikilink/segment cache keyed by document version. */
    private cacheVersion = -1;
    private cacheUri = '';
    private lineCache = new Map<number, LineCacheEntry>();

    /** Debounce handle for text-change triggered re-parses. */
    private debounceHandle: ReturnType<typeof setTimeout> | undefined;
    private static readonly DEBOUNCE_MS = 50;

    constructor(wikilinkService: WikilinkService, logger: LogService) {
        this.wikilinkService = wikilinkService;
        this.logger = logger;

        // React to text changes, editor switches, and cursor movement
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e)),
            vscode.window.onDidChangeActiveTextEditor((editor) => this.onActiveEditorChanged(editor)),
            vscode.window.onDidChangeTextEditorSelection((e) => this.onSelectionChanged(e)),
        );

        // Decorate the currently active editor on startup
        if (vscode.window.activeTextEditor) {
            this.rebuildCacheAndDecorate(vscode.window.activeTextEditor);
        }
    }

    dispose(): void {
        if (this.debounceHandle !== undefined) {
            clearTimeout(this.debounceHandle);
        }
        this.defaultDecorationType.dispose();
        this.activeDecorationType.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    // ── Event handlers ─────────────────────────────────────────────────

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== event.document) { return; }

        // Debounce: text changes fire rapidly; batch the re-parse.
        if (this.debounceHandle !== undefined) {
            clearTimeout(this.debounceHandle);
        }
        this.debounceHandle = setTimeout(() => {
            this.debounceHandle = undefined;
            const current = vscode.window.activeTextEditor;
            if (current && current.document === event.document) {
                this.rebuildCacheAndDecorate(current);
            }
        }, WikilinkDecorationManager.DEBOUNCE_MS);
    }

    private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
        if (editor) {
            this.rebuildCacheAndDecorate(editor);
        }
    }

    private onSelectionChanged(event: vscode.TextEditorSelectionChangeEvent): void {
        // Selection change on a cached document → just re-classify, no re-parse.
        // When the cache is stale (e.g. version bumped by a keystroke that also
        // fires onDocumentChanged), do nothing here — the 50 ms debounce will
        // rebuild the cache shortly.  Calling rebuildCacheAndDecorate() here
        // would bypass the debounce and cause two full re-parses per keystroke.
        const editor = event.textEditor;
        if (this.isCacheFresh(editor)) {
            this.applyDecorations(editor);
        }
    }

    // ── Cache management ───────────────────────────────────────────────

    private isCacheFresh(editor: vscode.TextEditor): boolean {
        return (
            editor.document.uri.toString() === this.cacheUri &&
            editor.document.version === this.cacheVersion
        );
    }

    /**
     * Full re-parse: rebuild the per-line wikilink/segment cache and apply
     * decorations. Called on text change (debounced) and editor switch.
     */
    private rebuildCacheAndDecorate(editor: vscode.TextEditor): void {
        if (!isMarkdownDocument(editor.document)) { return; }

        const end = this.logger.time('decor', `rebuildCache (${editor.document.lineCount} lines)`);

        this.cacheUri = editor.document.uri.toString();
        this.cacheVersion = editor.document.version;
        this.lineCache.clear();

        let totalWikilinks = 0;
        for (let lineIndex = 0; lineIndex < editor.document.lineCount; lineIndex++) {
            const lineText = editor.document.lineAt(lineIndex).text;
            const wikilinks = this.wikilinkService.extractWikilinks(lineText);
            if (wikilinks.length === 0) { continue; }

            const segments = this.wikilinkService.computeLinkSegments(wikilinks);
            this.lineCache.set(lineIndex, { wikilinks, segments });
            totalWikilinks += wikilinks.length;
        }

        this.logger.info('decor', `cached ${this.lineCache.size} lines, ${totalWikilinks} wikilinks`);
        end();

        this.applyDecorations(editor);
    }

    /**
     * Classify cached segments into default/active based on cursor position
     * and set decorations. No parsing occurs here.
     */
    private applyDecorations(editor: vscode.TextEditor): void {
        if (!isMarkdownDocument(editor.document)) { return; }

        const cursorPosition = editor.selection.active;
        const defaultRanges: vscode.Range[] = [];
        const activeRanges: vscode.Range[] = [];

        for (const [lineIndex, entry] of this.lineCache) {
            // Determine the active wikilink on the cursor line
            let activeWikilink: Wikilink | undefined;
            if (lineIndex === cursorPosition.line) {
                activeWikilink = this.wikilinkService.findInnermostWikilinkAtOffset(
                    entry.wikilinks,
                    cursorPosition.character,
                );
            }

            for (const segment of entry.segments) {
                const range = new vscode.Range(
                    lineIndex, segment.startOffset,
                    lineIndex, segment.endOffset,
                );

                if (activeWikilink && segment.wikilink === activeWikilink) {
                    activeRanges.push(range);
                } else {
                    defaultRanges.push(range);
                }
            }
        }

        editor.setDecorations(this.defaultDecorationType, defaultRanges);
        editor.setDecorations(this.activeDecorationType, activeRanges);
    }
}

/** Check whether a document is a markdown file. */
function isMarkdownDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'markdown';
}
