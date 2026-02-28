import * as vscode from 'vscode';
import { Wikilink } from './Wikilink.js';
import { WikilinkService } from './WikilinkService.js';
import { WikilinkFileService } from './WikilinkFileService.js';

/**
 * Snapshot of a wikilink's identity and position within a document.
 * Used to detect renames by comparing snapshots before and after edits.
 */
interface WikilinkSnapshot {
    pageName: string;
    startPosition: number;
    endPosition: number;
    line: number;
}

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
 * Detection works by maintaining a snapshot of all wikilinks in each
 * open markdown document. When a rename check fires, old and new snapshots
 * are compared by (line, startPosition). A match at the same position
 * with a different `pageName` is treated as a rename candidate.
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
    private readonly disposables: vscode.Disposable[] = [];

    /** Document URI → most-recent wikilink snapshots. */
    private readonly snapshots = new Map<string, WikilinkSnapshot[]>();

    /** Tracks the wikilink the cursor was inside during the most recent edit. */
    private pendingEdit: PendingEditInfo | undefined;

    /** Guards against re-entrant change events during a rename operation. */
    private isProcessing = false;

    constructor(wikilinkService: WikilinkService, fileService: WikilinkFileService) {
        this.wikilinkService = wikilinkService;
        this.fileService = fileService;

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e)),
            vscode.workspace.onDidOpenTextDocument((doc) => this.takeSnapshot(doc)),
            vscode.window.onDidChangeActiveTextEditor((editor) => this.onActiveEditorChanged(editor)),
            vscode.window.onDidChangeTextEditorSelection((e) => this.onSelectionChanged(e)),
        );

        // Baseline snapshot for every open markdown document
        for (const doc of vscode.workspace.textDocuments) {
            this.takeSnapshot(doc);
        }
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    // ── Snapshot management ────────────────────────────────────────────

    /**
     * Record every wikilink in the document as a snapshot.
     * Called on open, on active-editor change, and after rename operations.
     */
    private takeSnapshot(document: vscode.TextDocument): void {
        if (document.languageId !== 'markdown') {
            return;
        }

        const snaps: WikilinkSnapshot[] = [];

        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;
            const wikilinks = this.wikilinkService.extractWikilinks(text);

            for (const wl of wikilinks) {
                snaps.push({
                    pageName: wl.pageName,
                    startPosition: wl.startPositionInText,
                    endPosition: wl.endPositionInText,
                    line,
                });
            }
        }

        this.snapshots.set(document.uri.toString(), snaps);
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

        // Ensure we have a baseline snapshot
        if (!this.snapshots.has(docKey)) {
            this.takeSnapshot(event.document);
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

        if (editor) {
            this.takeSnapshot(editor.document);
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
        const docKey = document.uri.toString();
        const oldSnapshots = this.snapshots.get(docKey);
        if (!oldSnapshots) {
            return;
        }

        // Index old snapshots by (line, startPosition)
        const oldMap = new Map<string, WikilinkSnapshot>();
        for (const snap of oldSnapshots) {
            oldMap.set(`${snap.line}:${snap.startPosition}`, snap);
        }

        // Build new snapshot list
        const newSnapshots: WikilinkSnapshot[] = [];
        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;
            const wikilinks = this.wikilinkService.extractWikilinks(text);

            for (const wl of wikilinks) {
                newSnapshots.push({
                    pageName: wl.pageName,
                    startPosition: wl.startPositionInText,
                    endPosition: wl.endPositionInText,
                    line,
                });
            }
        }

        // Detect renames: same (line, startPos), different pageName
        const renames: DetectedRename[] = [];

        for (const newSnap of newSnapshots) {
            const key = `${newSnap.line}:${newSnap.startPosition}`;
            const oldSnap = oldMap.get(key);

            if (oldSnap && oldSnap.pageName !== newSnap.pageName) {
                renames.push({
                    oldPageName: oldSnap.pageName,
                    newPageName: newSnap.pageName,
                    line: newSnap.line,
                    startPosition: newSnap.startPosition,
                    endPosition: newSnap.endPosition,
                });
            }
        }

        if (renames.length === 0) {
            this.snapshots.set(docKey, newSnapshots);
            return;
        }

        // Update snapshot before prompting (prevents re-detection if the
        // user takes a while to respond to the dialog)
        this.snapshots.set(docKey, newSnapshots);

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
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Rename failed: ${detail}`);
        } finally {
            this.isProcessing = false;

            // Refresh snapshots for all open docs so the new names become the baseline
            for (const doc of vscode.workspace.textDocuments) {
                this.takeSnapshot(doc);
            }
        }
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
