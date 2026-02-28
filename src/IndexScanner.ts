import * as vscode from 'vscode';
import * as path from 'path';
import { IndexService, type ScanSummary } from './IndexService.js';

/**
 * Orchestrates filesystem scanning and delegates to IndexService for DB operations.
 * This is the VS Code-dependent layer; IndexService stays pure for testability.
 */
export class IndexScanner {

    constructor(
        private readonly indexService: IndexService,
        private readonly workspaceRoot: vscode.Uri,
    ) { }

    /**
     * Index a single file by URI. Reads content, resolves mtime, and delegates
     * to IndexService.indexFileContent().
     */
    async indexFile(uri: vscode.Uri): Promise<void> {
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        const filename = path.basename(uri.fsPath);

        const contentBytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(contentBytes).toString('utf-8');

        const stat = await vscode.workspace.fs.stat(uri);
        const mtime = stat.mtime;

        this.indexService.indexFileContent(relativePath, filename, content, mtime);
    }

    /**
     * Full scan: walk the workspace for all markdown files, index each one,
     * and remove DB entries for files no longer on disk.
     *
     * Optionally reports progress via a VS Code progress callback.
     */
    async fullScan(
        progress?: vscode.Progress<{ message?: string; increment?: number }>,
        token?: vscode.CancellationToken,
    ): Promise<{ filesIndexed: number; linksFound: number }> {
        const pattern = '**/*.{md,markdown}';
        const files = await vscode.workspace.findFiles(pattern);

        // Get all paths currently in the DB
        const existingPages = this.indexService.getAllPages();
        const existingPaths = new Set(existingPages.map(p => p.path));
        const scannedPaths = new Set<string>();

        let filesIndexed = 0;
        const total = files.length;

        for (const fileUri of files) {
            if (token?.isCancellationRequested) { break; }

            const relativePath = vscode.workspace.asRelativePath(fileUri, false);
            scannedPaths.add(relativePath);

            try {
                await this.indexFile(fileUri);
                filesIndexed++;

                if (progress) {
                    const pct = Math.round((filesIndexed / total) * 100);
                    progress.report({
                        message: `Indexing ${filesIndexed}/${total} files (${pct}%)`,
                        increment: (1 / total) * 100,
                    });
                }
            } catch (err) {
                console.warn(`as-notes: failed to index ${relativePath}:`, err);
            }
        }

        // Remove DB entries for files no longer on disk
        for (const existingPath of existingPaths) {
            if (!scannedPaths.has(existingPath)) {
                this.indexService.removePage(existingPath);
            }
        }

        // Count total links
        const allPages = this.indexService.getAllPages();
        let linksFound = 0;
        for (const page of allPages) {
            linksFound += this.indexService.getLinksForPage(page.id).length;
        }

        return { filesIndexed, linksFound };
    }

    /**
     * Stale scan: compare file mtimes against the index and re-index only
     * files that are new, modified, or deleted since last indexing.
     */
    async staleScan(
        progress?: vscode.Progress<{ message?: string; increment?: number }>,
        token?: vscode.CancellationToken,
    ): Promise<ScanSummary> {
        const pattern = '**/*.{md,markdown}';
        const files = await vscode.workspace.findFiles(pattern);

        const existingPages = this.indexService.getAllPages();
        const existingByPath = new Map(existingPages.map(p => [p.path, p]));
        const scannedPaths = new Set<string>();

        const summary: ScanSummary = {
            newFiles: 0,
            staleFiles: 0,
            deletedFiles: 0,
            unchanged: 0,
        };

        const total = files.length;
        let processed = 0;

        for (const fileUri of files) {
            if (token?.isCancellationRequested) { break; }

            const relativePath = vscode.workspace.asRelativePath(fileUri, false);
            scannedPaths.add(relativePath);

            try {
                const stat = await vscode.workspace.fs.stat(fileUri);
                const existing = existingByPath.get(relativePath);

                if (!existing) {
                    // New file — not in DB
                    await this.indexFile(fileUri);
                    summary.newFiles++;
                } else if (stat.mtime > existing.indexed_at) {
                    // Stale — file modified since last index
                    await this.indexFile(fileUri);
                    summary.staleFiles++;
                } else {
                    summary.unchanged++;
                }
            } catch (err) {
                console.warn(`as-notes: failed to scan ${relativePath}:`, err);
            }

            processed++;
            if (progress) {
                progress.report({
                    message: `Scanning ${processed}/${total} files`,
                    increment: (1 / total) * 100,
                });
            }
        }

        // Detect deleted files (in DB but not on disk)
        for (const [existingPath] of existingByPath) {
            if (!scannedPaths.has(existingPath)) {
                this.indexService.removePage(existingPath);
                summary.deletedFiles++;
            }
        }

        return summary;
    }
}
