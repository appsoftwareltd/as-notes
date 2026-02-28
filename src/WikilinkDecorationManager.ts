import * as vscode from 'vscode';
import { Wikilink } from './Wikilink.js';
import { WikilinkService } from './WikilinkService.js';

/**
 * Manages wikilink decorations in the editor.
 *
 * - Default decoration: subtle blue text for all wikilink ranges
 * - Active decoration: distinct blue highlight for the specific link under cursor
 *
 * When the cursor is positioned within a nested wikilink, only the innermost
 * link is highlighted with the active style; the remaining wikilink text
 * reverts to normal editor colour.
 */
export class WikilinkDecorationManager implements vscode.Disposable {
    private readonly wikilinkService: WikilinkService;
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

    constructor(wikilinkService: WikilinkService) {
        this.wikilinkService = wikilinkService;

        // React to text changes, editor switches, and cursor movement
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e)),
            vscode.window.onDidChangeActiveTextEditor((editor) => this.onActiveEditorChanged(editor)),
            vscode.window.onDidChangeTextEditorSelection((e) => this.onSelectionChanged(e)),
        );

        // Decorate the currently active editor on startup
        if (vscode.window.activeTextEditor) {
            this.updateDecorations(vscode.window.activeTextEditor);
        }
    }

    dispose(): void {
        this.defaultDecorationType.dispose();
        this.activeDecorationType.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    // ── Event handlers ─────────────────────────────────────────────────

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === event.document) {
            this.updateDecorations(editor);
        }
    }

    private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
        if (editor) {
            this.updateDecorations(editor);
        }
    }

    private onSelectionChanged(event: vscode.TextEditorSelectionChangeEvent): void {
        this.updateDecorations(event.textEditor);
    }

    // ── Decoration logic ───────────────────────────────────────────────

    /**
     * Parse all wikilinks from the document and apply decorations.
     *
     * Uses non-overlapping segments so nested wikilink decorations don't
     * conflict. The innermost wikilink under the primary cursor gets the
     * "active" decoration; all other segments get the "default" decoration.
     */
    private updateDecorations(editor: vscode.TextEditor): void {
        if (!isMarkdownDocument(editor.document)) {
            return;
        }

        const cursorPosition = editor.selection.active;
        const defaultRanges: vscode.Range[] = [];
        const activeRanges: vscode.Range[] = [];

        for (let lineIndex = 0; lineIndex < editor.document.lineCount; lineIndex++) {
            const line = editor.document.lineAt(lineIndex);
            const wikilinks = this.wikilinkService.extractWikilinks(line.text);

            if (wikilinks.length === 0) {
                continue;
            }

            // Determine the active wikilink on the cursor line
            let activeWikilink: Wikilink | undefined;
            if (lineIndex === cursorPosition.line) {
                activeWikilink = this.wikilinkService.findInnermostWikilinkAtOffset(
                    wikilinks,
                    cursorPosition.character,
                );
            }

            // Use non-overlapping segments so decorations don't conflict
            const segments = this.wikilinkService.computeLinkSegments(wikilinks);

            for (const segment of segments) {
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
