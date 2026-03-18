import * as vscode from 'vscode';
import * as path from 'path';
import type { IndexService, PageRow } from './IndexService.js';
import { getPathDistance } from './PathUtils.js';

/**
 * Handles file resolution, existence checking, and creation for wikilink targets.
 *
 * When an IndexService is available (full mode), link resolution uses the persistent
 * index for global filename matching and alias resolution, with same-directory
 * preference and closest-folder tiebreak for disambiguation.
 *
 * Without an index (should not happen in normal operation), falls back to resolving
 * targets in the same directory as the source file.
 *
 * File resolution is case-insensitive throughout.
 */
export class WikilinkFileService {

    private indexService?: IndexService;

    constructor(indexService?: IndexService) {
        this.indexService = indexService;
    }

    /**
     * Set the index service (e.g. after initialisation).
     */
    setIndexService(indexService: IndexService): void {
        this.indexService = indexService;
    }

    /**
     * Build the URI for a wikilink target file (exact-case).
     *
     * @param sourceUri - URI of the document containing the wikilink
     * @param pageFileName - Sanitised page filename (without extension)
     * @returns URI pointing to `{sourceDir}/{pageFileName}.md`
     */
    resolveTargetUri(sourceUri: vscode.Uri, pageFileName: string): vscode.Uri {
        const sourceDir = path.dirname(sourceUri.fsPath);
        const targetPath = path.join(sourceDir, `${pageFileName}.md`);
        return vscode.Uri.file(targetPath);
    }

    /**
     * Build the URI for a **new** wikilink target file, respecting the
     * `notesFolder` and `createNotesInCurrentDirectory` settings.
     *
     * - If `createNotesInCurrentDirectory` is true AND the source file is
     *   NOT inside the journal folder: uses the source file's directory.
     * - Otherwise: uses the configured `notesFolder` (relative to workspace root).
     *
     * @param sourceUri - URI of the document containing the wikilink
     * @param pageFileName - Sanitised page filename (without extension)
     * @returns URI pointing to `{targetDir}/{pageFileName}.md`
     */
    resolveNewFileTargetUri(sourceUri: vscode.Uri, pageFileName: string): vscode.Uri {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) {
            // No workspace — fall back to source directory
            return this.resolveTargetUri(sourceUri, pageFileName);
        }

        const config = vscode.workspace.getConfiguration('as-notes');
        const createInCurrentDir = config.get<boolean>('createNotesInCurrentDirectory', false);

        if (createInCurrentDir && !this.isInsideJournalFolder(sourceUri, workspaceRoot)) {
            return this.resolveTargetUri(sourceUri, pageFileName);
        }

        const notesFolder = config.get<string>('notesFolder', 'notes');
        const normalised = notesFolder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
        const targetDir = normalised
            ? path.join(workspaceRoot.fsPath, normalised)
            : workspaceRoot.fsPath;
        const targetPath = path.join(targetDir, `${pageFileName}.md`);
        return vscode.Uri.file(targetPath);
    }

    /**
     * Check whether a source URI is inside the configured journal folder.
     */
    private isInsideJournalFolder(sourceUri: vscode.Uri, workspaceRoot: vscode.Uri): boolean {
        const config = vscode.workspace.getConfiguration('as-notes');
        const journalFolder = config.get<string>('journalFolder', 'journals');
        const normalised = journalFolder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
        if (!normalised) {
            return false;
        }
        const journalDir = path.join(workspaceRoot.fsPath, normalised).replace(/\\/g, '/').toLowerCase();
        const sourceDir = path.dirname(sourceUri.fsPath).replace(/\\/g, '/').toLowerCase();
        return sourceDir === journalDir || sourceDir.startsWith(journalDir + '/');
    }

    /**
     * Resolve a wikilink target using the persistent index for global resolution.
     *
     * Resolution order:
     * 1. Direct filename match in the index (case-insensitive)
     *    - Single match → return it
     *    - Multiple matches → same-directory preference, then closest-folder tiebreak
     * 2. Alias match → return the canonical page
     * 3. No match → fall through (caller decides whether to auto-create)
     *
     * @param sourceUri - URI of the source document containing the link
     * @param pageFileName - Sanitised page filename without extension (e.g. "My Page")
     * @returns Resolution result with the target page info, or undefined if no match
     */
    resolveViaIndex(
        sourceUri: vscode.Uri,
        pageFileName: string,
    ): { page: PageRow; viaAlias: boolean } | undefined {
        if (!this.indexService?.isOpen) {
            return undefined;
        }

        const targetFilename = `${pageFileName}.md`;

        // Step 1: Direct filename match
        const directMatches = this.indexService.findPagesByFilename(targetFilename);
        if (directMatches.length === 1) {
            return { page: directMatches[0], viaAlias: false };
        }
        if (directMatches.length > 1) {
            // Disambiguate: same-directory preference, then closest folder
            const sourcePath = vscode.workspace.asRelativePath(sourceUri, false);
            const best = this.pickClosest(sourcePath, directMatches);
            return { page: best, viaAlias: false };
        }

        // Step 2: Alias match
        const aliasPage = this.indexService.resolveAlias(pageFileName);
        if (aliasPage) {
            return { page: aliasPage, viaAlias: true };
        }

        return undefined;
    }

    /**
     * Resolve the URI for a wikilink target, using the index for global resolution
     * when available, falling back to case-insensitive directory scan.
     *
     * @param sourceUri - URI of the document containing the wikilink
     * @param pageFileName - Sanitised page filename (without extension)
     * @returns Object with the resolved URI and whether it was via alias
     */
    async resolveTargetUriCaseInsensitive(
        sourceUri: vscode.Uri,
        pageFileName: string,
    ): Promise<{ uri: vscode.Uri; viaAlias: boolean }> {
        // Try index-based resolution first
        const indexResult = this.resolveViaIndex(sourceUri, pageFileName);
        if (indexResult) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (workspaceRoot) {
                const resolvedUri = vscode.Uri.joinPath(workspaceRoot, indexResult.page.path);
                return { uri: resolvedUri, viaAlias: indexResult.viaAlias };
            }
        }

        // Fallback: same-directory resolution with case-insensitive scan
        const sourceDir = path.dirname(sourceUri.fsPath);
        const targetName = `${pageFileName}.md`;
        const exactUri = vscode.Uri.file(path.join(sourceDir, targetName));

        // Fast path: exact-case match
        if (await this.fileExists(exactUri)) {
            return { uri: exactUri, viaAlias: false };
        }

        // Slow path: case-insensitive directory scan
        try {
            const dirUri = vscode.Uri.file(sourceDir);
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            const targetNameLower = targetName.toLowerCase();

            for (const [name] of entries) {
                if (name.toLowerCase() === targetNameLower) {
                    return {
                        uri: vscode.Uri.file(path.join(sourceDir, name)),
                        viaAlias: false,
                    };
                }
            }
        } catch {
            // Directory read failed — fall through to exact-case URI
        }

        return { uri: exactUri, viaAlias: false };
    }

    /**
     * Navigate to a wikilink target file, creating it if it doesn't exist.
     * Uses index-aware resolution for global filename matching and alias support.
     *
     * @param targetUri - Exact-case URI of the target `.md` file (used as fallback for creation)
     * @param pageFileName - Display name for notifications
     * @param sourceUri - URI of the source document (for resolution context)
     */
    async navigateToFile(
        targetUri: vscode.Uri,
        pageFileName: string,
        sourceUri?: vscode.Uri,
    ): Promise<void> {
        let resolvedUri = targetUri;

        if (sourceUri) {
            const result = await this.resolveTargetUriCaseInsensitive(sourceUri, pageFileName);
            resolvedUri = result.uri;
        }

        const exists = await this.fileExists(resolvedUri);

        if (!exists) {
            // No match found — create in source file's directory with exact case
            await vscode.workspace.fs.writeFile(targetUri, new Uint8Array());
            vscode.window.showInformationMessage(`Created ${pageFileName}.md`);
            resolvedUri = targetUri;
        }

        const document = await vscode.workspace.openTextDocument(resolvedUri);
        await vscode.window.showTextDocument(document);
    }

    /**
     * Check whether a file exists at the given URI.
     */
    async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    // ── Path distance helpers ──────────────────────────────────────────

    /**
     * Pick the closest page to the source from a list of candidates.
     * Prefers same-directory, then smallest directory distance.
     */
    private pickClosest(sourcePath: string, candidates: PageRow[]): PageRow {
        const sourceDir = path.dirname(sourcePath).replace(/\\/g, '/');

        let best = candidates[0];
        let bestDistance = Infinity;

        for (const candidate of candidates) {
            const candidateDir = path.dirname(candidate.path).replace(/\\/g, '/');

            // Same directory is highest priority
            if (candidateDir === sourceDir) {
                return candidate;
            }

            const distance = getPathDistance(sourceDir, candidateDir);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = candidate;
            }
        }

        return best;
    }
}
