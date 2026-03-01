import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WikilinkService } from './WikilinkService.js';
import { WikilinkFileService } from './WikilinkFileService.js';
import { WikilinkDecorationManager } from './WikilinkDecorationManager.js';
import { WikilinkDocumentLinkProvider } from './WikilinkDocumentLinkProvider.js';
import { WikilinkHoverProvider } from './WikilinkHoverProvider.js';
import { WikilinkRenameTracker } from './WikilinkRenameTracker.js';
import { IndexService } from './IndexService.js';
import { IndexScanner } from './IndexScanner.js';
import { WikilinkCompletionProvider } from './WikilinkCompletionProvider.js';
import { wikilinkPlugin, type WikilinkResolverFn } from './MarkdownItWikilinkPlugin.js';
import { getPathDistance } from './PathUtils.js';

const MARKDOWN_SELECTOR: vscode.DocumentSelector = { language: 'markdown' };
const ASNOTES_DIR = '.asnotes';
const INDEX_DB = 'index.db';

/** Disposables registered in full mode — cleared on deactivation or mode transition. */
let fullModeDisposables: vscode.Disposable[] = [];

/** Status bar item shown in both passive and full mode. */
let statusBarItem: vscode.StatusBarItem;

/** Index service instance — alive while in full mode. */
let indexService: IndexService | undefined;

/** Index scanner instance — alive while in full mode. */
let indexScanner: IndexScanner | undefined;

/** Periodic scan interval handle. */
let periodicScanHandle: ReturnType<typeof setInterval> | undefined;

/** Debounce handle for the live-buffer re-index on text change. */
let completionDebounceHandle: ReturnType<typeof setTimeout> | undefined;

/** Completion provider instance — alive while in full mode. */
let completionProvider: WikilinkCompletionProvider | undefined;

/** Stored extension context — needed for mode transitions. */
let extensionContext: vscode.ExtensionContext | undefined;

// ── Activation ─────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<{ extendMarkdownIt: (md: any) => any }> {
    extensionContext = context;

    // Status bar — always present
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    context.subscriptions.push(statusBarItem);

    // Register commands — always available (init can be called from passive mode)
    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.initWorkspace', () => initWorkspace(context)),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.rebuildIndex', () => rebuildIndex()),
    );

    // Build the API return value (markdown-it plugin) before mode setup
    // so it's available regardless of which code path we take.
    // CRITICAL: This must always be returned, even if enterFullMode() fails,
    // so that VS Code's markdown preview can pick up the wikilink plugin.
    const apiReturn = { extendMarkdownIt: createExtendMarkdownIt() };

    // Check for .asnotes/ in workspace root
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        setPassiveMode('No workspace folder open');
        return apiReturn;
    }

    const asnotesDir = path.join(workspaceRoot.fsPath, ASNOTES_DIR);
    if (fs.existsSync(asnotesDir)) {
        // Fire-and-forget: don't block activation on full mode setup.
        // VS Code's markdown preview awaits activate() before calling
        // extendMarkdownIt — if we block here on DB init + stale scan,
        // the preview hangs waiting and never renders wikilinks.
        enterFullMode(context, workspaceRoot).catch(err => {
            console.error('as-notes: failed to enter full mode, falling back to passive', err);
            setPassiveMode('Index initialisation failed');
        });
    } else {
        setPassiveMode();
    }

    return apiReturn;
}

export function deactivate(): void {
    // Persist DB before shutdown (only if .asnotes/ still exists)
    if (indexService?.isOpen) {
        safeSaveToFile();
        indexService?.close();
    }
    clearPeriodicScan();
    disposeFullMode();
}

// ── Passive mode ───────────────────────────────────────────────────────────

function setPassiveMode(reason?: string): void {
    const text = reason ?? 'AS Notes: not initialised';
    statusBarItem.text = `$(circle-slash) ${text}`;
    statusBarItem.tooltip = 'Click to initialise AS Notes in this workspace';
    statusBarItem.command = 'as-notes.initWorkspace';
    statusBarItem.show();
}

// ── Full mode ──────────────────────────────────────────────────────────────

async function enterFullMode(
    context: vscode.ExtensionContext,
    workspaceRoot: vscode.Uri,
): Promise<void> {
    disposeFullMode(); // Clean up any previous full-mode state

    const dbPath = path.join(workspaceRoot.fsPath, ASNOTES_DIR, INDEX_DB);
    indexService = new IndexService(dbPath);
    await indexService.initDatabase();

    indexScanner = new IndexScanner(indexService, workspaceRoot);

    // Run stale scan on activation to catch external changes
    const summary = await indexScanner.staleScan();
    if (summary.newFiles > 0 || summary.staleFiles > 0 || summary.deletedFiles > 0) {
        indexService.saveToFile();
        console.log(
            `as-notes: stale scan — ${summary.newFiles} new, ${summary.staleFiles} stale, ${summary.deletedFiles} deleted, ${summary.unchanged} unchanged`,
        );
    }

    // Shared services
    const wikilinkService = new WikilinkService();
    const fileService = new WikilinkFileService(indexService);

    // Decoration manager
    const decorationManager = new WikilinkDecorationManager(wikilinkService);
    fullModeDisposables.push(decorationManager);

    // Document link provider — Ctrl/Cmd+Click navigation (alias-aware tooltips)
    const linkProvider = new WikilinkDocumentLinkProvider(wikilinkService, fileService, indexService);
    fullModeDisposables.push(
        vscode.languages.registerDocumentLinkProvider(MARKDOWN_SELECTOR, linkProvider),
    );

    // Hover provider — tooltip with target filename, existence, and back-link count
    const hoverProvider = new WikilinkHoverProvider(wikilinkService, fileService, indexService);
    fullModeDisposables.push(
        vscode.languages.registerHoverProvider(MARKDOWN_SELECTOR, hoverProvider),
    );

    // Rename tracker — backed by index for pre-edit state comparison
    const renameTracker = new WikilinkRenameTracker(
        wikilinkService, fileService, indexService, indexScanner,
    );
    fullModeDisposables.push(renameTracker);

    // Completion provider — wikilink autocomplete triggered by [[
    completionProvider = new WikilinkCompletionProvider(indexService);
    fullModeDisposables.push(
        vscode.languages.registerCompletionItemProvider(MARKDOWN_SELECTOR, completionProvider, '['),
    );

    // Navigation command
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.navigateWikilink', async (args: {
            targetUri: string;
            pageName: string;
            pageFileName: string;
            sourceUri: string;
        }) => {
            const targetUri = vscode.Uri.parse(args.targetUri);
            const sourceUri = vscode.Uri.parse(args.sourceUri);
            await fileService.navigateToFile(targetUri, args.pageFileName, sourceUri);
        }),
    );

    // ── Index update triggers ──────────────────────────────────────────

    // On save: re-index the saved file
    fullModeDisposables.push(
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (!isMarkdown(doc)) { return; }
            try {
                await indexScanner!.indexFile(doc.uri);
                if (!safeSaveToFile()) { return; }
                completionProvider?.refresh();
            } catch (err) {
                console.warn('as-notes: failed to index on save:', err);
            }
        }),
    );

    // On text change: debounced re-index of the live buffer so that newly
    // typed wikilinks (forward references) appear in autocomplete immediately
    // without requiring a save or editor switch.
    fullModeDisposables.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (!isMarkdown(e.document)) { return; }
            if (completionDebounceHandle !== undefined) {
                clearTimeout(completionDebounceHandle);
            }
            completionDebounceHandle = setTimeout(() => {
                completionDebounceHandle = undefined;
                const doc = e.document;
                // Skip re-indexing while a rename check is pending for this document.
                // The rename tracker needs the stale index state to detect the change;
                // refreshIndexAfterRename will re-index the file once the rename completes.
                if (renameTracker.hasPendingEdit(doc.uri.toString())) { return; }
                const relativePath = vscode.workspace.asRelativePath(doc.uri, false);
                const filename = path.basename(doc.uri.fsPath);
                indexService!.indexFileContent(relativePath, filename, doc.getText(), Date.now());
                completionProvider?.refresh();
            }, 500);
        }),
    );

    // On file create
    fullModeDisposables.push(
        vscode.workspace.onDidCreateFiles(async (e) => {
            for (const fileUri of e.files) {
                if (isMarkdownUri(fileUri)) {
                    try {
                        await indexScanner!.indexFile(fileUri);
                    } catch (err) {
                        console.warn('as-notes: failed to index created file:', err);
                    }
                }
            }
            if (!safeSaveToFile()) { return; }
            completionProvider?.refresh();
        }),
    );

    // On file delete
    fullModeDisposables.push(
        vscode.workspace.onDidDeleteFiles(async (e) => {
            let hasFolderDelete = false;
            for (const fileUri of e.files) {
                if (isMarkdownUri(fileUri)) {
                    const relativePath = vscode.workspace.asRelativePath(fileUri, false);
                    indexService!.removePage(relativePath);
                } else {
                    // A folder (or other non-markdown item) was deleted — individual
                    // file URIs inside are not surfaced by VS Code. Run a stale scan
                    // to remove any orphaned index entries.
                    hasFolderDelete = true;
                }
            }
            if (hasFolderDelete) {
                try {
                    await indexScanner!.staleScan();
                } catch (err) {
                    console.warn('as-notes: stale scan after folder delete failed:', err);
                }
            }
            if (!safeSaveToFile()) { return; }
            completionProvider?.refresh();
        }),
    );

    // On file rename
    fullModeDisposables.push(
        vscode.workspace.onDidRenameFiles(async (e) => {
            let hasFolderRename = false;
            for (const { oldUri, newUri } of e.files) {
                if (isMarkdownUri(oldUri)) {
                    const oldPath = vscode.workspace.asRelativePath(oldUri, false);
                    indexService!.removePage(oldPath);
                } else {
                    // A folder was renamed/moved — individual file URIs are not surfaced.
                    hasFolderRename = true;
                }
                if (isMarkdownUri(newUri)) {
                    try {
                        await indexScanner!.indexFile(newUri);
                    } catch (err) {
                        console.warn('as-notes: failed to index renamed file:', err);
                    }
                }
            }
            if (hasFolderRename) {
                // A stale scan reconciles old paths (orphaned in DB) and new paths
                // (files now at their moved location but not yet indexed).
                try {
                    await indexScanner!.staleScan();
                } catch (err) {
                    console.warn('as-notes: stale scan after folder rename failed:', err);
                }
            }
            if (!safeSaveToFile()) { return; }
            completionProvider?.refresh();
        }),
    );

    // On active editor change: re-index the file being left from the editor
    // buffer (not disk) so unsaved edits (e.g. new aliases in front matter)
    // are captured immediately.
    let previousEditorUri: vscode.Uri | undefined;
    fullModeDisposables.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (previousEditorUri && isMarkdownUri(previousEditorUri)) {
                try {
                    const doc = vscode.workspace.textDocuments.find(
                        d => d.uri.toString() === previousEditorUri!.toString(),
                    );
                    if (doc) {
                        const relativePath = vscode.workspace.asRelativePath(doc.uri, false);
                        const filename = path.basename(doc.uri.fsPath);
                        const content = doc.getText();
                        const stat = await vscode.workspace.fs.stat(doc.uri);
                        indexService!.indexFileContent(relativePath, filename, content, stat.mtime);
                    } else {
                        // Document already closed — fall back to disk read
                        await indexScanner!.indexFile(previousEditorUri);
                    }
                    if (!safeSaveToFile()) { return; }
                    completionProvider?.refresh();
                } catch {
                    // File may have been closed/deleted
                }
            }
            previousEditorUri = editor?.document.uri;
        }),
    );

    // Periodic scanner
    startPeriodicScan();

    // Listen for config changes to restart periodic scan
    fullModeDisposables.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('as-notes.periodicScanInterval')) {
                clearPeriodicScan();
                startPeriodicScan();
            }
        }),
    );

    // Add all full-mode disposables to context
    for (const d of fullModeDisposables) {
        context.subscriptions.push(d);
    }

    // Update status bar
    const pageCount = indexService.getAllPages().length;
    statusBarItem.text = `$(database) AS Notes (${pageCount} pages)`;
    statusBarItem.tooltip = 'Click to rebuild the AS Notes index';
    statusBarItem.command = 'as-notes.rebuildIndex';
    statusBarItem.show();
}

function disposeFullMode(): void {
    if (completionDebounceHandle !== undefined) {
        clearTimeout(completionDebounceHandle);
        completionDebounceHandle = undefined;
    }
    for (const d of fullModeDisposables) {
        d.dispose();
    }
    fullModeDisposables = [];
}

/**
 * Tear down full mode and switch to passive mode.
 * Called when `.asnotes/` is detected as missing during a save attempt.
 */
function exitFullMode(): void {
    clearPeriodicScan();
    if (indexService?.isOpen) {
        indexService.close();
    }
    indexService = undefined;
    indexScanner = undefined;
    completionProvider = undefined;
    disposeFullMode();
    setPassiveMode();
    console.log('as-notes: .asnotes/ directory removed — switched to passive mode');
}

/**
 * Check that `.asnotes/` still exists before persisting the database.
 * If the directory has been deleted, tear down full mode and switch to passive.
 * Returns true if the save succeeded, false if we exited full mode.
 */
function safeSaveToFile(): boolean {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) { return false; }
    const asnotesDir = path.join(workspaceRoot.fsPath, ASNOTES_DIR);
    if (!fs.existsSync(asnotesDir)) {
        exitFullMode();
        return false;
    }
    indexService?.saveToFile();
    return true;
}

// ── Commands ───────────────────────────────────────────────────────────────

async function initWorkspace(context: vscode.ExtensionContext): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('AS Notes: No workspace folder is open.');
        return;
    }

    const asnotesDir = path.join(workspaceRoot.fsPath, ASNOTES_DIR);

    if (fs.existsSync(asnotesDir)) {
        vscode.window.showInformationMessage('AS Notes: Workspace is already initialised.');
        // Ensure we're in full mode
        if (!indexService?.isOpen) {
            await enterFullMode(context, workspaceRoot);
        }
        return;
    }

    // Create .asnotes/ directory
    fs.mkdirSync(asnotesDir, { recursive: true });

    // Create .gitignore inside .asnotes/ to exclude the DB file
    fs.writeFileSync(path.join(asnotesDir, '.gitignore'), 'index.db\n');

    // Enter full mode (creates DB, runs full scan)
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'AS Notes: Initialising workspace',
            cancellable: false,
        },
        async (progress) => {
            const dbPath = path.join(asnotesDir, INDEX_DB);
            indexService = new IndexService(dbPath);
            await indexService.initDatabase();

            indexScanner = new IndexScanner(indexService, workspaceRoot);

            const result = await indexScanner.fullScan(progress);
            indexService.saveToFile();

            vscode.window.showInformationMessage(
                `AS Notes: Initialised — ${result.filesIndexed} files indexed, ${result.linksFound} links found.`,
            );
        },
    );

    // Now register providers
    await enterFullMode(context, workspaceRoot);
}

async function rebuildIndex(): Promise<void> {
    if (!indexService?.isOpen || !indexScanner) {
        vscode.window.showWarningMessage('AS Notes: Workspace is not initialised. Run "AS Notes: Initialise Workspace" first.');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'AS Notes: Rebuilding index',
            cancellable: true,
        },
        async (progress, token) => {
            indexService!.resetSchema();
            const result = await indexScanner!.fullScan(progress, token);
            indexService!.saveToFile();
            completionProvider?.refresh();

            // Update status bar
            const pageCount = indexService!.getAllPages().length;
            statusBarItem.text = `$(database) AS Notes (${pageCount} pages)`;

            vscode.window.showInformationMessage(
                `AS Notes: Rebuild complete — ${result.filesIndexed} files indexed, ${result.linksFound} links found.`,
            );
        },
    );
}

// ── Periodic scanning ──────────────────────────────────────────────────────

function startPeriodicScan(): void {
    const intervalSec = vscode.workspace.getConfiguration('as-notes').get<number>('periodicScanInterval', 300);
    if (intervalSec <= 0) { return; }

    const intervalMs = intervalSec * 1000;
    periodicScanHandle = setInterval(async () => {
        if (!indexService?.isOpen || !indexScanner) { return; }
        try {
            const summary = await indexScanner.staleScan();
            if (summary.newFiles > 0 || summary.staleFiles > 0 || summary.deletedFiles > 0) {
                if (!safeSaveToFile()) { return; }
                completionProvider?.refresh();
                const pageCount = indexService.getAllPages().length;
                statusBarItem.text = `$(database) AS Notes (${pageCount} pages)`;
            }
        } catch (err) {
            console.warn('as-notes: periodic scan failed:', err);
        }
    }, intervalMs);
}

function clearPeriodicScan(): void {
    if (periodicScanHandle !== undefined) {
        clearInterval(periodicScanHandle);
        periodicScanHandle = undefined;
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getWorkspaceRoot(): vscode.Uri | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function isMarkdown(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'markdown';
}

function isMarkdownUri(uri: vscode.Uri): boolean {
    const ext = path.extname(uri.fsPath).toLowerCase();
    return ext === '.md' || ext === '.markdown';
}

// ── Markdown preview plugin ────────────────────────────────────────────────

/**
 * Create the `extendMarkdownIt` function returned by `activate()`.
 *
 * The returned function registers a markdown-it inline rule that transforms
 * `[[wikilinks]]` into clickable `<a>` links in the markdown preview. When
 * the index is available, links use subfolder and alias resolution. Otherwise,
 * they fall back to same-directory relative links.
 */
function createExtendMarkdownIt(): (md: any) => any {
    const wikilinkService = new WikilinkService();
    console.log('as-notes: createExtendMarkdownIt() called');

    const resolver: WikilinkResolverFn = (pageFileName, env) => {
        const sourcePath = getSourcePathFromEnv(env);

        if (indexService?.isOpen && sourcePath) {
            const targetFilename = `${pageFileName}.md`;

            // Direct filename match
            const directMatches = indexService.findPagesByFilename(targetFilename);
            if (directMatches.length >= 1) {
                let target = directMatches[0];
                if (directMatches.length > 1) {
                    // Disambiguate: same-directory preference, then closest folder
                    const sourceDir = path.dirname(sourcePath).replace(/\\/g, '/');
                    let bestDistance = Infinity;
                    for (const candidate of directMatches) {
                        const candidateDir = path.dirname(candidate.path).replace(/\\/g, '/');
                        if (candidateDir === sourceDir) { target = candidate; break; }
                        const d = getPathDistance(sourceDir, candidateDir);
                        if (d < bestDistance) { bestDistance = d; target = candidate; }
                    }
                }
                return relativeLink(sourcePath, target.path);
            }

            // Alias match
            const aliasPage = indexService.resolveAlias(pageFileName);
            if (aliasPage) {
                return relativeLink(sourcePath, aliasPage.path);
            }
        }

        // Fallback: same-directory relative link
        return encodeURIComponent(`${pageFileName}.md`);
    };

    return (md: any) => {
        console.log('as-notes: extendMarkdownIt() invoked by VS Code markdown preview');
        wikilinkPlugin(md, { wikilinkService, resolver });
        return md;
    };
}

/**
 * Extract the workspace-relative source path from the markdown-it render environment.
 * VS Code populates `env.currentDocument` with the URI of the file being previewed.
 */
function getSourcePathFromEnv(env: Record<string, any>): string | undefined {
    const doc = env?.currentDocument;
    if (!doc) return undefined;

    // vscode.Uri object (standard VS Code ≥1.72)
    if (typeof doc === 'object' && 'fsPath' in doc) {
        return vscode.workspace.asRelativePath(doc as vscode.Uri, false);
    }

    // URI string fallback
    if (typeof doc === 'string') {
        try {
            return vscode.workspace.asRelativePath(vscode.Uri.parse(doc), false);
        } catch {
            return undefined;
        }
    }

    return undefined;
}

/**
 * Compute a relative link from a source file to a target file, URI-encoded
 * for use in an HTML href attribute.
 */
function relativeLink(sourcePath: string, targetPath: string): string {
    const sourceDir = path.dirname(sourcePath);
    const relative = path.relative(sourceDir, targetPath).replace(/\\/g, '/');
    return relative.split('/').map(s => encodeURIComponent(s)).join('/');
}
