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

// ── Activation ─────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<void> {
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

    // Check for .asnotes/ in workspace root
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        setPassiveMode('No workspace folder open');
        return;
    }

    const asnotesDir = path.join(workspaceRoot.fsPath, ASNOTES_DIR);
    if (fs.existsSync(asnotesDir)) {
        await enterFullMode(context, workspaceRoot);
    } else {
        setPassiveMode();
    }
}

export function deactivate(): void {
    // Persist DB before shutdown
    if (indexService?.isOpen) {
        indexService.saveToFile();
        indexService.close();
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
    const fileService = new WikilinkFileService();

    // Decoration manager
    const decorationManager = new WikilinkDecorationManager(wikilinkService);
    fullModeDisposables.push(decorationManager);

    // Document link provider — Ctrl/Cmd+Click navigation
    const linkProvider = new WikilinkDocumentLinkProvider(wikilinkService, fileService);
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
                indexService!.saveToFile();
            } catch (err) {
                console.warn('as-notes: failed to index on save:', err);
            }
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
            indexService!.saveToFile();
        }),
    );

    // On file delete
    fullModeDisposables.push(
        vscode.workspace.onDidDeleteFiles((e) => {
            for (const fileUri of e.files) {
                if (isMarkdownUri(fileUri)) {
                    const relativePath = vscode.workspace.asRelativePath(fileUri, false);
                    indexService!.removePage(relativePath);
                }
            }
            indexService!.saveToFile();
        }),
    );

    // On file rename
    fullModeDisposables.push(
        vscode.workspace.onDidRenameFiles(async (e) => {
            for (const { oldUri, newUri } of e.files) {
                if (isMarkdownUri(oldUri)) {
                    const oldPath = vscode.workspace.asRelativePath(oldUri, false);
                    indexService!.removePage(oldPath);
                }
                if (isMarkdownUri(newUri)) {
                    try {
                        await indexScanner!.indexFile(newUri);
                    } catch (err) {
                        console.warn('as-notes: failed to index renamed file:', err);
                    }
                }
            }
            indexService!.saveToFile();
        }),
    );

    // On active editor change: re-index the file being left
    let previousEditorUri: vscode.Uri | undefined;
    fullModeDisposables.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (previousEditorUri && isMarkdownUri(previousEditorUri)) {
                try {
                    await indexScanner!.indexFile(previousEditorUri);
                    indexService!.saveToFile();
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
    for (const d of fullModeDisposables) {
        d.dispose();
    }
    fullModeDisposables = [];
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
                indexService.saveToFile();
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
