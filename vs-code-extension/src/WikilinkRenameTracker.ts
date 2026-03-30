import * as vscode from 'vscode';
import { Wikilink, WikilinkService } from 'as-notes-common';
import { WikilinkFileService } from './WikilinkFileService.js';
import type { IndexService, LinkRow } from './IndexService.js';
import type { IndexScanner } from './IndexScanner.js';
import { sanitiseFileName } from './PathUtils.js';
import { FrontMatterService } from 'as-notes-common';
import { toNotesRelativePath } from './NotesRootService.js';

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
    private readonly notesRootUri: vscode.Uri | undefined;
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
        notesRootUri?: vscode.Uri,
    ) {
        this.wikilinkService = wikilinkService;
        this.fileService = fileService;
        this.indexService = indexService;
        this.indexScanner = indexScanner;
        this.notesRootUri = notesRootUri;

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

    /**
     * Returns true if there is an unresolved pending edit for the given document key.
     * Used by the completion debounce in extension.ts to avoid overwriting the
     * index baseline before checkForRenames has had a chance to run.
     */
    hasPendingEdit(docKey: string): boolean {
        return this.pendingEdit?.docKey === docKey;
    }

    /**
     * Returns true when the pageName change is a nesting or un-nesting
     * operation rather than a genuine rename.
     *
     * Covers two cases:
     * 1. Full nesting/un-nesting: one pageName contains the other as `[[...]]`
     *    e.g. `[[A]]` wrapped to `[[[[A]] B]]`, or the reverse.
     * 2. Partial bracket manipulation: the user is mid-edit adding/removing
     *    brackets. After stripping leading `[` and trailing `]` from both
     *    names, the core page name is identical.
     *    e.g. pageName "Demo" vs "[Demo" from intermediate `[[[Demo]]`.
     */
    static isNestingChange(oldPageName: string, newPageName: string): boolean {
        // Full nesting/un-nesting
        if (newPageName.includes(`[[${oldPageName}]]`) ||
            oldPageName.includes(`[[${newPageName}]]`)) {
            return true;
        }

        // Partial bracket manipulation: same core name after stripping
        // leading [ and trailing ] characters
        const strip = (s: string) => s.replace(/^\[+/, '').replace(/\]+$/, '');
        const strippedOld = strip(oldPageName);
        const strippedNew = strip(newPageName);
        if (strippedOld.length > 0 && strippedOld === strippedNew) {
            return true;
        }

        return false;
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
        const relativePath = this.notesRootUri
            ? toNotesRelativePath(this.notesRootUri.fsPath, event.document.uri.fsPath)
            : vscode.workspace.asRelativePath(event.document.uri, false);
        const page = this.indexService.getPageByPath(relativePath);
        if (!page) {
            return;
        }

        // If every content change inserts text ending with ']]', this is a
        // completion-provider insertion (our CompletionItems always end with ']]').
        // In that case, do not set pendingEdit — the inserted text is not a rename.
        const isCompletionInsert = event.contentChanges.length > 0 &&
            event.contentChanges.every(c => c.text.endsWith(']]'));
        if (isCompletionInsert) {
            this.pendingEdit = undefined;
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

        const relativePath = this.notesRootUri
            ? toNotesRelativePath(this.notesRootUri.fsPath, document.uri.fsPath)
            : vscode.workspace.asRelativePath(document.uri, false);
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
                // Skip nesting/un-nesting: wrapping or unwrapping a wikilink
                // inside another is not a rename.
                if (WikilinkRenameTracker.isNestingChange(oldLink.page_name, curr.pageName)) {
                    continue;
                }
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

        await this.promptAndPerformRenames(document, renames, relativePath);
    }

    // ── Rename execution ───────────────────────────────────────────────

    /**
     * Show a single confirmation dialog for all detected renames,
     * then execute file renames and workspace-wide link updates.
     *
     * Renames are classified into two categories:
     * - **Direct link renames**: the old name matched a file directly → rename the file + update references
     * - **Alias renames**: the old name matched via alias → update front matter on canonical page + update references (no file rename)
     */
    private async promptAndPerformRenames(
        document: vscode.TextDocument,
        renames: DetectedRename[],
        relativePath: string,
    ): Promise<void> {
        // Classify each rename as alias or direct
        interface ClassifiedRename extends DetectedRename {
            isAlias: boolean;
            canonicalPageId?: number;
            canonicalPagePath?: string;
        }

        const classifiedRenames: ClassifiedRename[] = [];
        const renameDescriptions: string[] = [];
        const fileRenames: { oldUri: vscode.Uri; newUri: vscode.Uri; label: string }[] = [];

        for (const r of renames) {
            const oldFileName = sanitiseFileName(r.oldPageName);

            // Check if the old link was an alias
            const aliasResolution = this.indexService.isOpen
                ? this.indexService.resolveAlias(oldFileName)
                : undefined;

            if (aliasResolution) {
                // Alias rename — no file rename, just update front matter + references
                classifiedRenames.push({
                    ...r,
                    isAlias: true,
                    canonicalPageId: aliasResolution.id,
                    canonicalPagePath: aliasResolution.path,
                });
                renameDescriptions.push(
                    `Alias: [[${r.oldPageName}]] → [[${r.newPageName}]] (on ${aliasResolution.filename})`,
                );
            } else {
                // Direct link rename — standard file rename flow
                classifiedRenames.push({ ...r, isAlias: false });

                const newFileName = sanitiseFileName(r.newPageName);
                const oldResolution = await this.fileService.resolveTargetUriCaseInsensitive(
                    document.uri,
                    oldFileName,
                );
                const oldUri = oldResolution.uri;
                const oldFileExists = await this.fileService.fileExists(oldUri);

                if (oldFileExists) {
                    const newUri = this.fileService.resolveTargetUri(oldUri, newFileName);
                    fileRenames.push({ oldUri, newUri, label: `${oldFileName}.md → ${newFileName}.md` });
                    renameDescriptions.push(`"${oldFileName}.md" → "${newFileName}.md"`);
                } else {
                    renameDescriptions.push(`[[${r.oldPageName}]] → [[${r.newPageName}]]`);
                }
            }
        }

        const message = renames.length === 1
            ? `Rename ${renameDescriptions[0]}? This will update all matching links.`
            : `Rename ${renames.length} links?\n${renameDescriptions.join('\n')}\nThis will update all matching links.`;

        const choice = await vscode.window.showInformationMessage(message, 'Yes', 'No');
        if (choice !== 'Yes') {
            // Re-index the document so any new/changed wikilinks are captured
            const filename = relativePath.split('/').pop() ?? '';
            this.indexService.indexFileContent(relativePath, filename, document.getText(), Date.now());
            return;
        }

        this.isProcessing = true;
        try {
            // Process direct file renames (outermost first — matches rename order)
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

            // Process alias renames — update front matter on canonical pages
            for (const r of classifiedRenames) {
                if (r.isAlias && r.canonicalPagePath) {
                    await this.updateAliasFrontMatter(
                        r.canonicalPagePath,
                        r.oldPageName,
                        r.newPageName,
                    );
                }
            }

            // Update links across the workspace (outermost first)
            for (const r of renames) {
                await this.updateLinksInWorkspace(r.oldPageName, r.newPageName);
            }

            // Refresh the index
            await this.refreshIndexAfterRename(document, classifiedRenames, fileRenames);
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Rename failed: ${detail}`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Update the aliases front matter on the canonical page when an alias is renamed.
     * Opens the canonical document, applies the front matter change, and saves.
     */
    private async updateAliasFrontMatter(
        canonicalPagePath: string,
        oldAliasName: string,
        newAliasName: string,
    ): Promise<void> {
        const rootUri = this.notesRootUri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!rootUri) { return; }

        const canonicalUri = vscode.Uri.joinPath(rootUri, canonicalPagePath);
        try {
            const doc = await vscode.workspace.openTextDocument(canonicalUri);
            const content = doc.getText();

            const frontMatterService = new FrontMatterService();
            const updatedContent = frontMatterService.updateAlias(content, oldAliasName, newAliasName);

            if (updatedContent !== null) {
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    doc.lineAt(0).range.start,
                    doc.lineAt(doc.lineCount - 1).range.end,
                );
                edit.replace(canonicalUri, fullRange, updatedContent);
                await vscode.workspace.applyEdit(edit);
                await doc.save();
            }
        } catch (err) {
            console.warn(`as-notes: failed to update alias front matter for ${canonicalPagePath}:`, err);
        }
    }

    /**
     * After a rename operation, ensure the index is consistent by
     * re-indexing all files that were touched (the source document,
     * renamed files, and any files whose link text was updated).
     *
     * For alias renames, the alias record and link references are updated
     * in the index; for direct renames, the page path and link references
     * are updated.
     */
    private async refreshIndexAfterRename(
        sourceDocument: vscode.TextDocument,
        renames: (DetectedRename & { isAlias: boolean; canonicalPageId?: number })[],
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
                    const oldPath = this.notesRootUri
                        ? toNotesRelativePath(this.notesRootUri.fsPath, fr.oldUri.fsPath)
                        : vscode.workspace.asRelativePath(fr.oldUri, false);
                    this.indexService.removePage(oldPath);
                    // Index at the new path
                    await this.indexScanner.indexFile(fr.newUri);
                    indexedUris.add(fr.newUri.toString());
                } catch {
                    // Target may not exist if rename failed
                }
            }
        }

        // Update the index for each rename
        for (const r of renames) {
            const oldFileName = sanitiseFileName(r.oldPageName);
            const newFileName = sanitiseFileName(r.newPageName);

            if (r.isAlias && r.canonicalPageId !== undefined) {
                // Alias rename: update alias record + link references
                this.indexService.updateAliasRename(
                    r.oldPageName,
                    r.newPageName,
                    r.canonicalPageId,
                );

                // Re-index the canonical page so its aliases are re-read from front matter
                const canonicalPage = this.indexService.getPageById?.(r.canonicalPageId);
                if (canonicalPage) {
                    const rootUri = this.notesRootUri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
                    if (rootUri) {
                        const canonicalUri = vscode.Uri.joinPath(rootUri, canonicalPage.path);
                        if (!indexedUris.has(canonicalUri.toString())) {
                            try {
                                await this.indexScanner.indexFile(canonicalUri);
                                indexedUris.add(canonicalUri.toString());
                            } catch {
                                // Page may not exist
                            }
                        }
                    }
                }
            } else {
                // Direct rename: update page path + link references
                this.indexService.updateRename(
                    `${oldFileName}.md`,
                    r.newPageName,
                    `${newFileName}.md`,
                );
            }
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
