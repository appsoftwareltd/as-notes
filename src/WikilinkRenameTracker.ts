import * as vscode from 'vscode';
import { Wikilink } from './Wikilink.js';
import { WikilinkService } from './WikilinkService.js';
import { WikilinkFileService } from './WikilinkFileService.js';
import type { IndexService, LinkRow } from './IndexService.js';
import type { IndexScanner } from './IndexScanner.js';

/**
 * Detected rename: a wikilink at the same position now has a different pageName.
 */
interface DetectedRename {
    oldPageName: string;
    newPageName: string;
    line: number;
    startPosition: number;
    endPosition: number;
}

/**
 * Tracks where the cursor was during editing — used to detect cursor-exit.
 */
interface PendingEditInfo {
    /** Document URI key. */
    docKey: string;
    /** Line number the cursor was on during the last edit. */
    line: number;
    /** Start position of the outermost wikilink the cursor was inside. */
    wikilinkStartPos: number;
}

/**
 * Tracks wikilink edits and offers to rename the corresponding file
 * and update all matching links across the workspace.
 *
 * Detection works by comparing the current document state against the
 * IndexService (whose link records represent the last-indexed state).
 * When a rename check fires, old links are read from the index and
 * compared by (line, start_col) to the current document's wikilinks.
 * A match at the same position with a different `pageName` is treated
 * as a rename candidate.
 *
 * ALL nesting levels are processed: editing `[[Inner]]` inside
 * `[[Outer [[Inner]] text]]` renames both the inner and outer pages.
 * Outermost renames are applied first so that workspace-wide text
 * replacements cascade correctly.
 *
 * Rename checks fire when:
 *  - The cursor moves outside the edited wikilink (click or keypress)
 *  - The user navigates away from the page (active editor change)
 */
export class WikilinkRenameTracker implements vscode.Disposable {
    private readonly wikilinkService: WikilinkService;
    private readonly fileService: WikilinkFileService;
    private readonly indexService: IndexService;
    private readonly indexScanner: IndexScanner;
    private readonly disposables: vscode.Disposable[] = [];

    /** Tracks the wikilink the cursor was inside during the most recent edit. */
    private pendingEdit: PendingEditInfo | undefined;

    /** Guards against re-entrant change events during a rename operation. */
    private isProcessing = false;

    constructor(
        wikilinkService: WikilinkService,
        fileService: WikilinkFileService,
        indexService: IndexService,
        indexScanner: IndexScanner,
    ) {
        this.wikilinkService = wikilinkService;
        this.fileService = fileService;
        this.indexService = indexService;
        this.indexScanner = indexScanner;

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e)),
            vscode.window.onDidChangeActiveTextEditor((editor) => this.onActiveEditorChanged(editor)),
            vscode.window.onDidChangeTextEditorSelection((e) => this.onSelectionChanged(e)),
        );
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    // ── Change detection ───────────────────────────────────────────────

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        if (this.isProcessing) {
            return;
        }
        if (event.document.languageId !== 'markdown') {
            return;
        }
        if (event.contentChanges.length === 0) {
            return;
        }

        const docKey = event.document.uri.toString();

        // Only track edits for files the index knows about
        const relativePath = vscode.workspace.asRelativePath(event.document.uri, false);
        const page = this.indexService.getPageByPath(relativePath);
        if (!page) {
            return;
        }

        // Track which wikilink the cursor is inside (for cursor-exit detection)
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.toString() === docKey) {
            const cursorPos = editor.selection.active;
            const lineText = event.document.lineAt(cursorPos.line).text;
            const wikilinks = this.wikilinkService.extractWikilinks(lineText);
            const outermost = this.findOutermostWikilinkAtOffset(wikilinks, cursorPos.character);

            if (outermost) {
                this.pendingEdit = {
                    docKey,
                    line: cursorPos.line,
                    wikilinkStartPos: outermost.startPositionInText,
                };
            }
        }
    }

    // ── Active editor change detection ─────────────────────────────────

    /**
     * When the user switches to a different editor, check for renames
     * in the previously active document.
     */
    private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
        if (this.pendingEdit) {
            const pendingDocKey = this.pendingEdit.docKey;
            this.pendingEdit = undefined;

            const doc = vscode.workspace.textDocuments.find(
                (d) => d.uri.toString() === pendingDocKey,
            );
            if (doc) {
                this.checkForRenames(doc);
            }
        }
    }

    // ── Cursor-exit detection ──────────────────────────────────────────

    private onSelectionChanged(event: vscode.TextEditorSelectionChangeEvent): void {
        if (this.isProcessing || !this.pendingEdit) {
            return;
        }

        const docKey = event.textEditor.document.uri.toString();
        if (docKey !== this.pendingEdit.docKey) {
            return;
        }

        const cursorPos = event.selections[0].active;
        const document = event.textEditor.document;
        const lineText = document.lineAt(cursorPos.line).text;
        const wikilinks = this.wikilinkService.extractWikilinks(lineText);
        const outermost = this.findOutermostWikilinkAtOffset(wikilinks, cursorPos.character);

        // Cursor has left the wikilink if:
        // - Cursor moved to a different line
        // - Cursor is no longer inside any wikilink
        // - Cursor is inside a different outermost wikilink
        const cursorExited =
            cursorPos.line !== this.pendingEdit.line ||
            !outermost ||
            outermost.startPositionInText !== this.pendingEdit.wikilinkStartPos;

        if (cursorExited) {
            this.pendingEdit = undefined;
            this.checkForRenames(document);
        }
    }

    // ── Helper ─────────────────────────────────────────────────────────

    /**
     * Find the outermost (largest) wikilink containing the given offset.
     */
    private findOutermostWikilinkAtOffset(
        wikilinks: Wikilink[],
        offset: number,
    ): Wikilink | undefined {
        let best: Wikilink | undefined;

        for (const wl of wikilinks) {
            if (offset >= wl.startPositionInText && offset <= wl.endPositionInText) {
                if (!best || wl.length > best.length) {
                    best = wl;
                }
            }
        }

        return best;
    }

    // ── Rename detection ───────────────────────────────────────────────

    private async checkForRenames(document: vscode.TextDocument): Promise<void> {
        if (!this.indexService.isOpen) {
            return;
        }

        const relativePath = vscode.workspace.asRelativePath(document.uri, false);
        const page = this.indexService.getPageByPath(relativePath);
        if (!page) {
            return;
        }

        // Read the last-indexed link state from the DB
        const oldLinks = this.indexService.getLinksForPage(page.id);
        if (oldLinks.length === 0) {
            return;
        }

        // Index old links by (line, start_col) for positional matching
        const oldMap = new Map<string, LinkRow>();
        for (const link of oldLinks) {
            oldMap.set(`${link.line}:${link.start_col}`, link);
        }

        // Parse the current document for wikilinks (the live/edited state)
        interface CurrentWikilink {
            pageName: string;
            startPosition: number;
            endPosition: number;
            line: number;
        }
        const currentWikilinks: CurrentWikilink[] = [];
        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;
            const wikilinks = this.wikilinkService.extractWikilinks(text);

            for (const wl of wikilinks) {
                currentWikilinks.push({
                    pageName: wl.pageName,
                    startPosition: wl.startPositionInText,
                    endPosition: wl.endPositionInText,
                    line,
                });
            }
        }

        // Detect renames: same (line, startPos), different pageName
        const renames: DetectedRename[] = [];

        for (const curr of currentWikilinks) {
            const key = `${curr.line}:${curr.startPosition}`;
            const oldLink = oldMap.get(key);

            if (oldLink && oldLink.page_name !== curr.pageName) {
                renames.push({
                    oldPageName: oldLink.page_name,
                    newPageName: curr.pageName,
                    line: curr.line,
                    startPosition: curr.startPosition,
                    endPosition: curr.endPosition,
                });
            }
        }

        if (renames.length === 0) {
            return;
        }

        // Sort outermost first (largest range) so workspace replacements
        // for outer links happen before inner ones. This is correct because
        // replacing `[[Outer [[Inner]] text]]` in other files also replaces
        // the inner portion, so the inner pass only affects files that have
        // the inner link standalone (not wrapped in the outer).
        renames.sort((a, b) =>
            (b.endPosition - b.startPosition) - (a.endPosition - a.startPosition),
        );

        await this.promptAndPerformRenames(document, renames);
    }

    // ── Rename execution ───────────────────────────────────────────────

    /**
     * Show a single confirmation dialog for all detected renames,
     * then execute file renames and workspace-wide link updates.
     */
    private async promptAndPerformRenames(
        document: vscode.TextDocument,
        renames: DetectedRename[],
    ): Promise<void> {
        // Build a user-facing summary of what will happen
        const renameDescriptions: string[] = [];
        const fileRenames: { oldUri: vscode.Uri; newUri: vscode.Uri; label: string }[] = [];

        for (const r of renames) {
            const oldFileName = sanitiseFileName(r.oldPageName);
            const newFileName = sanitiseFileName(r.newPageName);

            const oldUri = await this.fileService.resolveTargetUriCaseInsensitive(
                document.uri,
                oldFileName,
            );
            const oldFileExists = await this.fileService.fileExists(oldUri);

            if (oldFileExists) {
                const newUri = this.fileService.resolveTargetUri(document.uri, newFileName);
                fileRenames.push({ oldUri, newUri, label: `${oldFileName}.md → ${newFileName}.md` });
                renameDescriptions.push(`"${oldFileName}.md" → "${newFileName}.md"`);
            } else {
                renameDescriptions.push(`[[${r.oldPageName}]] → [[${r.newPageName}]]`);
            }
        }

        const message = renames.length === 1
            ? `Rename ${renameDescriptions[0]}? This will update all matching links.`
            : `Rename ${renames.length} links?\n${renameDescriptions.join('\n')}\nThis will update all matching links.`;

        const choice = await vscode.window.showInformationMessage(message, 'Yes', 'No');
        if (choice !== 'Yes') {
            return;
        }

        this.isProcessing = true;
        try {
            // Rename files (outermost first — matches rename order)
            for (const fr of fileRenames) {
                const newFileAlreadyExists = await this.fileService.fileExists(fr.newUri);
                if (newFileAlreadyExists) {
                    vscode.window.showWarningMessage(
                        `Cannot rename: "${fr.label}" — target already exists.`,
                    );
                } else {
                    await vscode.workspace.fs.rename(fr.oldUri, fr.newUri, { overwrite: false });
                }
            }

            // Update links across the workspace (outermost first)
            for (const r of renames) {
                await this.updateLinksInWorkspace(r.oldPageName, r.newPageName);
            }

            // Re-index all affected files so the index reflects the new state
            // before we release control. This prevents a stale-index window
            // where the next edit event could compare against outdated links.
            await this.refreshIndexAfterRename(document, renames, fileRenames);
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Rename failed: ${detail}`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * After a rename operation, ensure the index is consistent by
     * re-indexing all files that were touched (the source document,
     * renamed files, and any files whose link text was updated).
     */
    private async refreshIndexAfterRename(
        sourceDocument: vscode.TextDocument,
        renames: DetectedRename[],
        fileRenames: { oldUri: vscode.Uri; newUri: vscode.Uri; label: string }[],
    ): Promise<void> {
        if (!this.indexService.isOpen) { return; }

        const indexedUris = new Set<string>();

        // Re-index the source document
        try {
            await this.indexScanner.indexFile(sourceDocument.uri);
            indexedUris.add(sourceDocument.uri.toString());
        } catch {
            // File may have been deleted
        }

        // Re-index renamed files (at their new locations)
        for (const fr of fileRenames) {
            if (!indexedUris.has(fr.newUri.toString())) {
                try {
                    // Remove the old path from the index
                    const oldPath = vscode.workspace.asRelativePath(fr.oldUri, false);
                    this.indexService.removePage(oldPath);
                    // Index at the new path
                    await this.indexScanner.indexFile(fr.newUri);
                    indexedUris.add(fr.newUri.toString());
                } catch {
                    // Target may not exist if rename failed
                }
            }
        }

        // Update link references in the index for the renamed page names
        for (const r of renames) {
            const oldFileName = sanitiseFileName(r.oldPageName);
            const newFileName = sanitiseFileName(r.newPageName);
            this.indexService.updateRename(
                `${oldFileName}.md`,
                r.newPageName,
                `${newFileName}.md`,
            );
        }

        // Persist
        this.indexService.saveToFile();
    }

    /**
     * Replace every `[[oldPageName]]` wikilink with `[[newPageName]]`
     * across all markdown files in the workspace.
     */
    private async updateLinksInWorkspace(
        oldPageName: string,
        newPageName: string,
    ): Promise<void> {
        const mdFiles = await vscode.workspace.findFiles('**/*.{md,markdown}');
        const workspaceEdit = new vscode.WorkspaceEdit();
        const affectedUris = new Set<string>();

        for (const fileUri of mdFiles) {
            const doc = await vscode.workspace.openTextDocument(fileUri);

            for (let line = 0; line < doc.lineCount; line++) {
                const text = doc.lineAt(line).text;
                const wikilinks = this.wikilinkService.extractWikilinks(text);

                for (const wl of wikilinks) {
                    if (wl.pageName === oldPageName) {
                        const range = new vscode.Range(
                            line, wl.startPositionInText,
                            line, wl.endPositionInText + 1,
                        );
                        workspaceEdit.replace(fileUri, range, `[[${newPageName}]]`);
                        affectedUris.add(fileUri.toString());
                    }
                }
            }
        }

        if (affectedUris.size > 0) {
            await vscode.workspace.applyEdit(workspaceEdit);

            // Save affected files so the workspace is in a clean state
            for (const uriStr of affectedUris) {
                const doc = vscode.workspace.textDocuments.find(
                    (d) => d.uri.toString() === uriStr,
                );
                if (doc?.isDirty) {
                    await doc.save();
                }
            }
        }
    }
}

/** Replace characters invalid in filenames with underscores. */
function sanitiseFileName(pageName: string): string {
    const invalids = /[\/\?<>\\:\*\|":]/g;
    return pageName.replace(invalids, '_');
}
