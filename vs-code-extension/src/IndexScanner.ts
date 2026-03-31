import * as vscode from 'vscode';
import * as path from 'path';
import { IndexService, type ScanSummary } from './IndexService.js';
import { IgnoreService } from './IgnoreService.js';
import { LogService, NO_OP_LOGGER, formatLogError } from './LogService.js';
import { toNotesRelativePath } from './NotesRootService.js';

/**
 * Orchestrates filesystem scanning and delegates to IndexService for DB operations.
 * This is the VS Code-dependent layer; IndexService stays pure for testability.
 *
 * The `notesRoot` URI passed to the constructor determines the scanning scope.
 * All relative paths stored in the index are relative to this root.
 */
export class IndexScanner {

    private readonly logger: LogService;

    constructor(
        private readonly indexService: IndexService,
        private readonly notesRoot: vscode.Uri,
        private readonly ignoreService?: IgnoreService,
        logger?: LogService,
    ) {
        this.logger = logger ?? NO_OP_LOGGER;
    }

    /** Compute a path relative to the notes root. */
    private relativePath(uri: vscode.Uri): string {
        return toNotesRelativePath(this.notesRoot.fsPath, uri.fsPath);
    }

    /**
     * Index a single file by URI. Reads content, resolves mtime, and delegates
     * to IndexService.indexFileContent().
     *
     * `.enc.md` files are silently skipped -- they are never indexed.
     */
    async indexFile(uri: vscode.Uri): Promise<void> {
        // Encrypted files are never indexed -- their content is ciphertext.
        if (uri.fsPath.toLowerCase().endsWith('.enc.md')) { return; }
        const relativePath = this.relativePath(uri);
        // Ignored files are silently skipped.
        if (this.ignoreService?.isIgnored(relativePath)) { return; }
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
        const pattern = new vscode.RelativePattern(this.notesRoot, '**/*.{md,markdown}');
        const allFiles = await vscode.workspace.findFiles(pattern);
        // Never index encrypted files -- their content is ciphertext, not markdown.
        // Also filter out any file matching an .asnotesignore pattern.
        const files = allFiles.filter(u => {
            if (u.fsPath.toLowerCase().endsWith('.enc.md')) { return false; }
            const rel = this.relativePath(u);
            if (this.ignoreService?.isIgnored(rel)) { return false; }
            return true;
        });

        this.logger.info('IndexScanner', `fullScan: starting — ${files.length} files (${allFiles.length} total, ${allFiles.length - files.length} filtered)`);
        const end = this.logger.time('IndexScanner', 'fullScan');

        // Get all paths currently in the DB
        const existingPages = this.indexService.getAllPages();
        const existingPaths = new Set(existingPages.map(p => p.path));
        const scannedPaths = new Set<string>();

        let filesIndexed = 0;
        const total = files.length;

        for (const fileUri of files) {
            if (token?.isCancellationRequested) { break; }

            const relativePath = this.relativePath(fileUri);
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

                // Log progress every 500 files
                if (filesIndexed % 500 === 0) {
                    this.logger.info('IndexScanner', `fullScan: progress ${filesIndexed}/${total} files`);
                }
            } catch (err) {
                this.logger.warn('IndexScanner', `failed to index ${relativePath}: ${formatLogError(err)}`);
            }
        }

        // Remove DB entries for files no longer on disk
        for (const existingPath of existingPaths) {
            if (!scannedPaths.has(existingPath)) {
                this.indexService.removePage(existingPath);
            }
        }

        // Count total links — single COUNT(*) query avoids 18k+ per-page
        // queries that would stress the WASM heap after a large scan.
        const linksFound = this.indexService.getTotalLinkCount();

        end();
        this.logger.info('IndexScanner', `fullScan: complete — ${filesIndexed} files indexed, ${linksFound} links found`);
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
        const pattern = new vscode.RelativePattern(this.notesRoot, '**/*.{md,markdown}');
        const allFiles = await vscode.workspace.findFiles(pattern);
        // Never index encrypted files -- their content is ciphertext, not markdown.
        // Also filter out any file matching an .asnotesignore pattern.
        const files = allFiles.filter(u => {
            if (u.fsPath.toLowerCase().endsWith('.enc.md')) { return false; }
            const rel = this.relativePath(u);
            if (this.ignoreService?.isIgnored(rel)) { return false; }
            return true;
        });

        const existingPages = this.indexService.getAllPages();
        const existingByPath = new Map(existingPages.map(p => [p.path, p]));
        const scannedPaths = new Set<string>();

        this.logger.info('IndexScanner', `staleScan: starting — ${files.length} files on disk, ${existingPages.length} in index`);
        const end = this.logger.time('IndexScanner', 'staleScan');

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

            const relativePath = this.relativePath(fileUri);
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
                this.logger.warn('IndexScanner', `failed to scan ${relativePath}: ${formatLogError(err)}`);
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

        end();
        this.logger.info('IndexScanner', `staleScan: complete — ${summary.newFiles} new, ${summary.staleFiles} stale, ${summary.deletedFiles} deleted, ${summary.unchanged} unchanged`);
        return summary;
    }
}
