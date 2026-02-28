import * as vscode from 'vscode';
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
 * Tracks wikilink edits and offers to rename the corresponding file
 * and update all matching links across the workspace.
 *
 * Detection works by maintaining a snapshot of all wikilinks in each
 * open markdown document. When a document change is debounced (2 s),
 * the old and new snapshots are compared by (line, startPosition).
 * A match at the same position with a different `pageName` is treated
 * as a rename candidate.
 *
 * Only the innermost rename is acted on when nested links change
 * (editing `[[Inner]]` inside `[[Outer [[Inner]] text]]` changes
 * both pageNames, but only the inner rename is prompted).
 */
export class WikilinkRenameTracker implements vscode.Disposable {
    private readonly wikilinkService: WikilinkService;
    private readonly fileService: WikilinkFileService;
    private readonly disposables: vscode.Disposable[] = [];

    /** Document URI → most-recent wikilink snapshots. */
    private readonly snapshots = new Map<string, WikilinkSnapshot[]>();

    /** Document URI → pending debounce timer. */
    private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    /** Guards against re-entrant change events during a rename operation. */
    private isProcessing = false;

    private static readonly DEBOUNCE_MS = 2000;

    constructor(wikilinkService: WikilinkService, fileService: WikilinkFileService) {
        this.wikilinkService = wikilinkService;
        this.fileService = fileService;

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e)),
            vscode.workspace.onDidOpenTextDocument((doc) => this.takeSnapshot(doc)),
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.takeSnapshot(editor.document);
                }
            }),
        );

        // Baseline snapshot for every open markdown document
        for (const doc of vscode.workspace.textDocuments) {
            this.takeSnapshot(doc);
        }
    }

    dispose(): void {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
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

        // Reset debounce timer
        const existing = this.debounceTimers.get(docKey);
        if (existing) {
            clearTimeout(existing);
        }

        this.debounceTimers.set(
            docKey,
            setTimeout(async () => {
                this.debounceTimers.delete(docKey);

                // Re-fetch the document — the reference in the event may be stale
                const doc = vscode.workspace.textDocuments.find(
                    (d) => d.uri.toString() === docKey,
                );
                if (doc) {
                    await this.checkForRenames(doc);
                }
            }, WikilinkRenameTracker.DEBOUNCE_MS),
        );
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
        interface DetectedRename {
            oldPageName: string;
            newPageName: string;
            line: number;
            startPosition: number;
            endPosition: number;
        }

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

        // Keep only innermost renames — editing an inner link changes the
        // outer link's pageName too; we only want to act on the inner one.
        const innermostRenames = renames.filter((r) =>
            !renames.some(
                (other) =>
                    other !== r &&
                    other.line === r.line &&
                    other.startPosition > r.startPosition &&
                    other.endPosition < r.endPosition,
            ),
        );

        // Update snapshot before prompting (prevents re-detection if the
        // user takes a while to respond to the dialog)
        this.snapshots.set(docKey, newSnapshots);

        for (const rename of innermostRenames) {
            await this.promptAndPerformRename(
                document,
                rename.oldPageName,
                rename.newPageName,
            );
        }
    }

    // ── Rename execution ───────────────────────────────────────────────

    private async promptAndPerformRename(
        document: vscode.TextDocument,
        oldPageName: string,
        newPageName: string,
    ): Promise<void> {
        const oldFileName = sanitiseFileName(oldPageName);
        const newFileName = sanitiseFileName(newPageName);

        const oldUri = await this.fileService.resolveTargetUriCaseInsensitive(
            document.uri,
            oldFileName,
        );
        const oldFileExists = await this.fileService.fileExists(oldUri);

        const message = oldFileExists
            ? `Rename "${oldPageName}" to "${newPageName}"? This will rename the file and update all matching links.`
            : `Rename all links from "[[${oldPageName}]]" to "[[${newPageName}]]"?`;

        const choice = await vscode.window.showInformationMessage(message, 'Yes', 'No');
        if (choice !== 'Yes') {
            return;
        }

        this.isProcessing = true;
        try {
            // Rename the target file if it exists
            if (oldFileExists) {
                const newUri = this.fileService.resolveTargetUri(document.uri, newFileName);
                const newFileAlreadyExists = await this.fileService.fileExists(newUri);

                if (newFileAlreadyExists) {
                    vscode.window.showWarningMessage(
                        `Cannot rename file: "${newFileName}.md" already exists.`,
                    );
                } else {
                    await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false });
                }
            }

            // Update every matching link across the workspace
            await this.updateLinksInWorkspace(oldPageName, newPageName);
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
