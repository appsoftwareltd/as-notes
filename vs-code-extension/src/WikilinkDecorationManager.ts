import * as vscode from 'vscode';
import { WikilinkService, LinkSegment } from './WikilinkService.js';
import { LogService } from './LogService.js';

/**
 * Per-line parse cache entry.
 */
interface LineCacheEntry {
    segments: LinkSegment[];
}

/**
 * Manages wikilink decorations in the editor.
 *
 * All wikilinks share a single colour — there is no separate active/hover
 * style. While the index is loading, wikilinks are shown in a muted grey
 * to indicate they are not yet navigable.
 *
 * The colour defaults to the theme's `textLink.foreground` but can be
 * overridden via the `as-notes.wikilinkColour` setting (hex string).
 * Changing the setting takes effect immediately without a reload.
 *
 * Performance: wikilinks and segments are cached per document version. Text
 * changes trigger a debounced full re-parse; selection changes are ignored
 * since all wikilinks share the same decoration.
 */
export class WikilinkDecorationManager implements vscode.Disposable {
    private readonly wikilinkService: WikilinkService;
    private readonly logger: LogService;
    private readonly disposables: vscode.Disposable[] = [];

    /** Decoration for wikilinks when the index is ready (navigable). */
    private defaultDecorationType: vscode.TextEditorDecorationType;

    /** Muted decoration shown while the index is still loading. */
    private loadingDecorationType: vscode.TextEditorDecorationType;

    /** When false, wikilinks are shown with the muted loading style. */
    private ready = false;

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

        this.defaultDecorationType = this.createDefaultDecoration();
        this.loadingDecorationType = this.createLoadingDecoration();

        // React to text changes and editor switches
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e)),
            vscode.window.onDidChangeActiveTextEditor((editor) => this.onActiveEditorChanged(editor)),
            vscode.workspace.onDidChangeConfiguration((e) => this.onConfigurationChanged(e)),
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
        this.loadingDecorationType.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    /**
     * Switch from loading to ready state — wikilinks change from muted grey
     * to their normal colour, indicating navigation is now available.
     */
    setReady(): void {
        this.ready = true;
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.applyDecorations(editor);
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

    private onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
        if (!event.affectsConfiguration('as-notes.wikilinkColour')) { return; }

        // Recreate decoration types with the new colour
        this.defaultDecorationType.dispose();
        this.loadingDecorationType.dispose();
        this.defaultDecorationType = this.createDefaultDecoration();
        this.loadingDecorationType = this.createLoadingDecoration();

        // Re-decorate the active editor
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.applyDecorations(editor);
        }
    }

    // ── Decoration type creation ───────────────────────────────────────

    private getConfiguredColour(): string | vscode.ThemeColor {
        const config = vscode.workspace.getConfiguration('as-notes');
        const hex = config.get<string>('wikilinkColour', '').trim();
        if (hex && /^#[0-9a-fA-F]{3,8}$/.test(hex)) {
            return hex;
        }
        return new vscode.ThemeColor('textLink.foreground');
    }

    private createDefaultDecoration(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            color: this.getConfiguredColour(),
        });
    }

    private createLoadingDecoration(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            color: '#888888',
        });
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
            this.lineCache.set(lineIndex, { segments });
            totalWikilinks += wikilinks.length;
        }

        this.logger.info('decor', `cached ${this.lineCache.size} lines, ${totalWikilinks} wikilinks`);
        end();

        this.applyDecorations(editor);
    }

    /**
     * Apply decorations to all cached segments. Uses the loading style
     * when the index is not ready, default style when ready.
     */
    private applyDecorations(editor: vscode.TextEditor): void {
        if (!isMarkdownDocument(editor.document)) { return; }

        const ranges: vscode.Range[] = [];

        for (const [lineIndex, entry] of this.lineCache) {
            for (const segment of entry.segments) {
                ranges.push(new vscode.Range(
                    lineIndex, segment.startOffset,
                    lineIndex, segment.endOffset,
                ));
            }
        }

        if (this.ready) {
            editor.setDecorations(this.loadingDecorationType, []);
            editor.setDecorations(this.defaultDecorationType, ranges);
        } else {
            editor.setDecorations(this.defaultDecorationType, []);
            editor.setDecorations(this.loadingDecorationType, ranges);
        }
    }
}

/** Check whether a document is a markdown file. */
function isMarkdownDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'markdown';
}
