import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WikilinkService, wikilinkPlugin, type WikilinkResolverFn } from 'as-notes-common';
import { WikilinkFileService } from './WikilinkFileService.js';
import { WikilinkDecorationManager } from './WikilinkDecorationManager.js';
import { WikilinkDocumentLinkProvider } from './WikilinkDocumentLinkProvider.js';
import { WikilinkHoverProvider } from './WikilinkHoverProvider.js';
import { WikilinkRenameTracker } from './WikilinkRenameTracker.js';
import { IndexService } from './IndexService.js';
import { IndexScanner } from './IndexScanner.js';
import { WikilinkCompletionProvider } from './WikilinkCompletionProvider.js';
import { getPathDistance, sanitiseFileName } from './PathUtils.js';
import { toggleTodoLine } from './TodoToggleService.js';
import { TaskPanelProvider } from './TaskPanelProvider.js';
import { BacklinkPanelProvider } from './BacklinkPanelProvider.js';
import {
    computeJournalPaths,
    applyTemplate,
    DEFAULT_TEMPLATE,
    TEMPLATE_FILENAME,
} from './JournalService.js';
import { isValidStatus, type LicenceStatus } from './LicenceService.js';
import { activateWithServer } from './LicenceActivationService.js';
import * as EncryptionService from './EncryptionService.js';
import { ensurePreCommitHook } from './GitHookService.js';
import { applyAssetPathSettings } from './ImageDropProvider.js';
import { LogService, NO_OP_LOGGER } from './LogService.js';
import { findInnermostOpenBracket } from './CompletionUtils.js';
import { IgnoreService } from './IgnoreService.js';
import { SlashCommandProvider } from './SlashCommandProvider.js';
import { openDatePicker } from './DatePickerService.js';
import { generateTable, addColumns, addRows, formatTable, removeCurrentRow, removeCurrentColumn, removeRowsAbove, removeRowsBelow, removeColumnsRight, removeColumnsLeft } from './TableService.js';

const MARKDOWN_SELECTOR: vscode.DocumentSelector = { language: 'markdown' };
const ASNOTES_DIR = '.asnotes';
const INDEX_DB = 'index.db';
const IGNORE_FILE = '.asnotesignore';

/** Default content written to `.asnotesignore` on first workspace initialisation. */
const DEFAULT_IGNORE_CONTENT = [
    '# AS Notes ignore file — uses .gitignore pattern syntax.',
    '# Paths matching these patterns are excluded from the AS Notes index.',
    '# See https://github.com/appsoftwareltd/as-notes#asnotesignore for recommended patterns.',
    '#',
    '# Logseq metadata and backup directories',
    'logseq/',
    '#',
    '# Obsidian metadata and trash directories',
    '.obsidian/',
    '.trash/',
    '#',
    '# Node.js dependencies',
    'node_modules/',
    '',
].join('\n');

/** Disposables registered in full mode — cleared on deactivation or mode transition. */
let fullModeDisposables: vscode.Disposable[] = [];

/** Ignore service for .asnotesignore pattern matching — alive while in full mode. */
let ignoreService: IgnoreService | undefined;

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

/** Task panel provider instance — alive while in full mode. */
let taskPanelProvider: TaskPanelProvider | undefined;

/** Backlink panel provider instance — alive while in full mode. */
let backlinkPanelProvider: BacklinkPanelProvider | undefined;

/** Log service instance — alive while in full mode. */
let logService: LogService = NO_OP_LOGGER;

/** Stored extension context — needed for mode transitions. */
let extensionContext: vscode.ExtensionContext | undefined;

/** Current licence validation result — updated on activation and config change. */
let licenceStatus: LicenceStatus = 'not-entered';

/** True only when running as the official appsoftwareltd.as-notes build. 
 *  This is deliberately a **deterrent, not a lock** - The legal protection is the licence; the ID check is friction on misuse and a clear indication to the user that the version violates licence terms.
*/
const OFFICIAL_EXTENSION_ID = 'appsoftwareltd.as-notes';
let isOfficialBuild = false;

/**
 * Returns true when a valid Pro licence key is configured AND the extension
 * is running as the official published build. Unofficial forks will never
 * pass this check regardless of licence key.
 */
export function isProLicenced(): boolean {
    return isOfficialBuild && isValidStatus(licenceStatus);
}

// ── Activation ─────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<{ extendMarkdownIt: (md: any) => any }> {
    extensionContext = context;
    isOfficialBuild = context.extension.id === OFFICIAL_EXTENSION_ID;

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
    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.cleanWorkspace', () => cleanWorkspace()),
    );

    // Validate licence key on activation (checks stored token first, then local rule).
    // Fire-and-forget: result is stored in licenceStatus; we show a warning if invalid.
    const rawKey = vscode.workspace.getConfiguration('as-notes').get<string>('licenceKey', '');
    activateWithServer(rawKey, context).then((status) => {
        licenceStatus = status;
        if (licenceStatus === 'invalid') {
            vscode.window.showWarningMessage(
                'AS Notes: The configured licence key is invalid. Pro features are disabled.',
            );
        }
        updateFullModeStatusBar();
    }).catch((err) => {
        console.warn('as-notes: licence activation check failed:', err);
    });

    // Re-validate whenever the licence key setting changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (!e.affectsConfiguration('as-notes.licenceKey')) { return; }
            const newKey = vscode.workspace.getConfiguration('as-notes').get<string>('licenceKey', '');
            activateWithServer(newKey, context).then((status) => {
                licenceStatus = status;
                if (licenceStatus === 'invalid') {
                    vscode.window.showWarningMessage(
                        'AS Notes: The configured licence key is invalid. Pro features are disabled.',
                    );
                }
                updateFullModeStatusBar();
            }).catch((err) => {
                console.warn('as-notes: licence re-validation failed:', err);
            });
        }),
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

// ── Todo toggle ────────────────────────────────────────────────────────────

function toggleTodoCommand(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    // Collect unique line numbers across all selections/cursors
    const lineNumbers = [...new Set(editor.selections.map(sel => sel.active.line))];

    editor.edit(editBuilder => {
        for (const lineNum of lineNumbers) {
            const line = editor.document.lineAt(lineNum);
            const toggled = toggleTodoLine(line.text);
            editBuilder.replace(line.range, toggled);
        }
    }).then(success => {
        if (!success || !indexService?.isOpen) { return; }
        // Re-index from the live buffer so the tasks table is updated immediately
        const doc = editor.document;
        const relativePath = vscode.workspace.asRelativePath(doc.uri, false);
        const filename = path.basename(doc.uri.fsPath);
        indexService.indexFileContent(relativePath, filename, doc.getText(), Date.now());
        taskPanelProvider?.refresh();
        backlinkPanelProvider?.refresh();
    });
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

    // Create LogService — enabled by setting or env var, requires reload to change.
    const config = vscode.workspace.getConfiguration('as-notes');
    const loggingEnabled = config.get<boolean>('enableLogging', false)
        || process.env.AS_NOTES_DEBUG === '1';
    const logDir = path.join(workspaceRoot.fsPath, ASNOTES_DIR, 'logs');
    logService = new LogService(logDir, { enabled: loggingEnabled });
    if (logService.isEnabled) {
        logService.info('extension', 'Logging activated');
    }

    const dbPath = path.join(workspaceRoot.fsPath, ASNOTES_DIR, INDEX_DB);
    indexService = new IndexService(dbPath, logService);
    logService.info('extension', 'enterFullMode: initialising database');
    const { schemaReset } = await indexService.initDatabase();

    ignoreService = new IgnoreService(path.join(workspaceRoot.fsPath, IGNORE_FILE));
    indexScanner = new IndexScanner(indexService, workspaceRoot, ignoreService, logService);

    // Shared services — WikilinkService is index-independent, so create early
    const wikilinkService = new WikilinkService();

    // Decoration manager — created before scan so wikilinks are visually
    // marked (muted grey) immediately, then switch to blue once the index
    // is ready and setReady() is called.
    const decorationManager = new WikilinkDecorationManager(wikilinkService, logService);
    fullModeDisposables.push(decorationManager);

    // Status bar: show indexing spinner
    statusBarItem.text = '$(sync~spin) AS Notes: Indexing...';
    statusBarItem.tooltip = 'Building the wikilink index';
    statusBarItem.command = undefined as unknown as string;
    statusBarItem.show();

    if (schemaReset) {
        // Schema was outdated and reset — run a full rebuild with progress notification
        logService.info('extension', 'enterFullMode: schema was reset, running full rebuild');
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'AS Notes: Rebuilding index (schema updated)',
                cancellable: false,
            },
            async (progress) => {
                const result = await indexScanner!.fullScan(progress);
                indexService!.saveToFile();
                logService!.info('extension', `enterFullMode: full rebuild complete — ${result.filesIndexed} files, ${result.linksFound} links`);
            },
        );
    } else {
        // Run stale scan on activation to catch external changes
        logService.info('extension', 'enterFullMode: running stale scan');
        const summary = await indexScanner.staleScan();
        if (summary.newFiles > 0 || summary.staleFiles > 0 || summary.deletedFiles > 0) {
            indexService.saveToFile();
            console.log(
                `as-notes: stale scan — ${summary.newFiles} new, ${summary.staleFiles} stale, ${summary.deletedFiles} deleted, ${summary.unchanged} unchanged`,
            );
        }
    }

    // Index is ready — switch decorations from muted grey to active blue
    decorationManager.setReady();
    updateFullModeStatusBar();

    const fileService = new WikilinkFileService(indexService);

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
    completionProvider = new WikilinkCompletionProvider(indexService, logService);
    completionProvider.refresh(); // Warm the cache so first [[ is instant
    fullModeDisposables.push(
        vscode.languages.registerCompletionItemProvider(MARKDOWN_SELECTOR, completionProvider, '['),
    );

    // Slash command provider — in-editor command menu triggered by /
    fullModeDisposables.push(
        vscode.languages.registerCompletionItemProvider(MARKDOWN_SELECTOR, new SlashCommandProvider(() => isProLicenced()), '/'),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.openDatePicker', () => openDatePicker()),
    );

    // ── Table commands (Pro) ───────────────────────────────────────────

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.insertTable', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const colsStr = await vscode.window.showInputBox({
                prompt: 'Number of columns',
                value: '3',
                validateInput: v => /^[1-9]\d*$/.test(v.trim()) ? null : 'Enter a positive integer',
            });
            if (colsStr === undefined) { return; }
            const rowsStr = await vscode.window.showInputBox({
                prompt: 'Number of rows (excluding header)',
                value: '3',
                validateInput: v => /^[1-9]\d*$/.test(v.trim()) ? null : 'Enter a positive integer',
            });
            if (rowsStr === undefined) { return; }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const table = generateTable(parseInt(colsStr.trim(), 10), parseInt(rowsStr.trim(), 10));
            await editor.insertSnippet(new vscode.SnippetString(table), editor.selection.active);
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.tableAddColumn', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const countStr = await vscode.window.showInputBox({
                prompt: 'Number of columns to add',
                value: '1',
                validateInput: v => /^[1-9]\d*$/.test(v.trim()) ? null : 'Enter a positive integer',
            });
            if (countStr === undefined) { return; }
            const lines: string[] = [];
            for (let i = 0; i < editor.document.lineCount; i++) {
                lines.push(editor.document.lineAt(i).text);
            }
            const result = addColumns(lines, editor.selection.active.line, editor.selection.active.character, parseInt(countStr.trim(), 10));
            if (!result) {
                vscode.window.showWarningMessage('AS Notes: Cursor is not inside a markdown table.');
                return;
            }
            await editor.edit(editBuilder => {
                const range = new vscode.Range(
                    new vscode.Position(result.startLine, 0),
                    new vscode.Position(result.endLine, lines[result.endLine].length),
                );
                editBuilder.replace(range, result.newText);
            });
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.tableAddRow', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const countStr = await vscode.window.showInputBox({
                prompt: 'Number of rows to add',
                value: '1',
                validateInput: v => /^[1-9]\d*$/.test(v.trim()) ? null : 'Enter a positive integer',
            });
            if (countStr === undefined) { return; }
            const lines: string[] = [];
            for (let i = 0; i < editor.document.lineCount; i++) {
                lines.push(editor.document.lineAt(i).text);
            }
            const result = addRows(lines, editor.selection.active.line, parseInt(countStr.trim(), 10));
            if (!result) {
                vscode.window.showWarningMessage('AS Notes: Cursor is not inside a markdown table.');
                return;
            }
            await editor.edit(editBuilder => {
                const pos = new vscode.Position(result.insertAfterLine, lines[result.insertAfterLine].length);
                editBuilder.insert(pos, '\n' + result.newText);
            });
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.tableFormat', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const lines: string[] = [];
            for (let i = 0; i < editor.document.lineCount; i++) {
                lines.push(editor.document.lineAt(i).text);
            }
            const result = formatTable(lines, editor.selection.active.line);
            if (!result) {
                vscode.window.showWarningMessage('AS Notes: Cursor is not inside a markdown table.');
                return;
            }
            await editor.edit(editBuilder => {
                const range = new vscode.Range(
                    new vscode.Position(result.startLine, 0),
                    new vscode.Position(result.endLine, lines[result.endLine].length),
                );
                editBuilder.replace(range, result.newText);
            });
        }),
    );

    // ── Table remove commands (Pro) ────────────────────────────────────

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.tableRemoveRow', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const lines: string[] = [];
            for (let i = 0; i < editor.document.lineCount; i++) {
                lines.push(editor.document.lineAt(i).text);
            }
            const result = removeCurrentRow(lines, editor.selection.active.line);
            if (!result) {
                vscode.window.showWarningMessage('AS Notes: Cannot remove the header or separator row.');
                return;
            }
            await editor.edit(editBuilder => {
                const range = new vscode.Range(
                    new vscode.Position(result.startLine, 0),
                    new vscode.Position(result.endLine, lines[result.endLine].length),
                );
                editBuilder.replace(range, result.newText);
            });
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.tableRemoveColumn', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const lines: string[] = [];
            for (let i = 0; i < editor.document.lineCount; i++) {
                lines.push(editor.document.lineAt(i).text);
            }
            const result = removeCurrentColumn(lines, editor.selection.active.line, editor.selection.active.character);
            if (!result) {
                vscode.window.showWarningMessage('AS Notes: Cannot remove column (single-column table or cursor not in table).');
                return;
            }
            await editor.edit(editBuilder => {
                const range = new vscode.Range(
                    new vscode.Position(result.startLine, 0),
                    new vscode.Position(result.endLine, lines[result.endLine].length),
                );
                editBuilder.replace(range, result.newText);
            });
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.tableRemoveRowsAbove', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const countStr = await vscode.window.showInputBox({
                prompt: 'Number of rows to remove above',
                value: '1',
                validateInput: v => /^[1-9]\d*$/.test(v.trim()) ? null : 'Enter a positive integer',
            });
            if (countStr === undefined) { return; }
            const lines: string[] = [];
            for (let i = 0; i < editor.document.lineCount; i++) {
                lines.push(editor.document.lineAt(i).text);
            }
            const result = removeRowsAbove(lines, editor.selection.active.line, parseInt(countStr.trim(), 10));
            if (!result) {
                vscode.window.showWarningMessage('AS Notes: No removable rows above the cursor.');
                return;
            }
            await editor.edit(editBuilder => {
                const range = new vscode.Range(
                    new vscode.Position(result.startLine, 0),
                    new vscode.Position(result.endLine, lines[result.endLine].length),
                );
                editBuilder.replace(range, result.newText);
            });
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.tableRemoveRowsBelow', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const countStr = await vscode.window.showInputBox({
                prompt: 'Number of rows to remove below',
                value: '1',
                validateInput: v => /^[1-9]\d*$/.test(v.trim()) ? null : 'Enter a positive integer',
            });
            if (countStr === undefined) { return; }
            const lines: string[] = [];
            for (let i = 0; i < editor.document.lineCount; i++) {
                lines.push(editor.document.lineAt(i).text);
            }
            const result = removeRowsBelow(lines, editor.selection.active.line, parseInt(countStr.trim(), 10));
            if (!result) {
                vscode.window.showWarningMessage('AS Notes: No rows below the cursor to remove.');
                return;
            }
            await editor.edit(editBuilder => {
                const range = new vscode.Range(
                    new vscode.Position(result.startLine, 0),
                    new vscode.Position(result.endLine, lines[result.endLine].length),
                );
                editBuilder.replace(range, result.newText);
            });
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.tableRemoveColumnsRight', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const countStr = await vscode.window.showInputBox({
                prompt: 'Number of columns to remove to the right',
                value: '1',
                validateInput: v => /^[1-9]\d*$/.test(v.trim()) ? null : 'Enter a positive integer',
            });
            if (countStr === undefined) { return; }
            const lines: string[] = [];
            for (let i = 0; i < editor.document.lineCount; i++) {
                lines.push(editor.document.lineAt(i).text);
            }
            const result = removeColumnsRight(lines, editor.selection.active.line, editor.selection.active.character, parseInt(countStr.trim(), 10));
            if (!result) {
                vscode.window.showWarningMessage('AS Notes: No columns to the right of the cursor to remove.');
                return;
            }
            await editor.edit(editBuilder => {
                const range = new vscode.Range(
                    new vscode.Position(result.startLine, 0),
                    new vscode.Position(result.endLine, lines[result.endLine].length),
                );
                editBuilder.replace(range, result.newText);
            });
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.tableRemoveColumnsLeft', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Table commands require a Pro licence.');
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const countStr = await vscode.window.showInputBox({
                prompt: 'Number of columns to remove to the left',
                value: '1',
                validateInput: v => /^[1-9]\d*$/.test(v.trim()) ? null : 'Enter a positive integer',
            });
            if (countStr === undefined) { return; }
            const lines: string[] = [];
            for (let i = 0; i < editor.document.lineCount; i++) {
                lines.push(editor.document.lineAt(i).text);
            }
            const result = removeColumnsLeft(lines, editor.selection.active.line, editor.selection.active.character, parseInt(countStr.trim(), 10));
            if (!result) {
                vscode.window.showWarningMessage('AS Notes: No columns to the left of the cursor to remove.');
                return;
            }
            await editor.edit(editBuilder => {
                const range = new vscode.Range(
                    new vscode.Position(result.startLine, 0),
                    new vscode.Position(result.endLine, lines[result.endLine].length),
                );
                editBuilder.replace(range, result.newText);
            });
        }),
    );

    // Configure the built-in markdown copy-files destination to use our asset path
    applyAssetPathSettings().catch(err =>
        console.warn('as-notes: failed to apply asset path settings:', err),
    );

    // Todo toggle — requires full mode (index needed for task panel sync)
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.toggleTodo', () => toggleTodoCommand()),
    );

    // Task panel — WebviewView in AS Notes sidebar
    taskPanelProvider = new TaskPanelProvider(context.extensionUri, indexService);
    const taskViewDisposable = vscode.window.registerWebviewViewProvider(
        TaskPanelProvider.VIEW_ID,
        taskPanelProvider,
        { webviewOptions: { retainContextWhenHidden: true } },
    );
    fullModeDisposables.push(taskViewDisposable);

    // Set context key so the view/keybinding `when` clauses activate
    vscode.commands.executeCommand('setContext', 'as-notes.fullMode', true);

    // Task panel commands
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.toggleTaskPanel', () => {
            vscode.commands.executeCommand('as-notes-tasks.focus');
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.toggleShowTodoOnly', () => {
            // Filter state now lives in the webview; this command is kept for
            // backward compatibility but has no effect in the webview UI.
        }),
    );

    // Backlink panel
    backlinkPanelProvider = new BacklinkPanelProvider(indexService, workspaceRoot, logService);
    fullModeDisposables.push(backlinkPanelProvider);

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.showBacklinks', () => {
            backlinkPanelProvider?.show();
        }),
    );

    // Navigate to the wikilink page under cursor (context menu).
    // Falls back silently when the cursor is not on a wikilink so the item
    // can always appear in the context menu without a stale when-clause.
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.navigateToPage', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !fileService) { return; }

            const line = editor.document.lineAt(editor.selection.active.line);
            const wikilinks = wikilinkService.extractWikilinks(line.text);
            const wikilink = wikilinkService.findInnermostWikilinkAtOffset(
                wikilinks,
                editor.selection.active.character,
            );

            if (!wikilink) { return; } // Not on a wikilink — do nothing

            const targetUri = fileService.resolveTargetUri(editor.document.uri, wikilink.pageFileName);
            await fileService.navigateToFile(targetUri, wikilink.pageFileName, editor.document.uri);
        }),
    );

    // View backlinks for the wikilink under cursor (context menu).
    // Falls back to showing backlinks for the active file when the cursor
    // is not on a wikilink — matching the tab right-click behaviour.
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.viewBacklinks', () => {
            if (!backlinkPanelProvider || !indexService) { return; }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // No active editor — just reveal the panel for whatever it last showed
                backlinkPanelProvider.show();
                return;
            }

            const line = editor.document.lineAt(editor.selection.active.line);
            const wikilinks = wikilinkService.extractWikilinks(line.text);
            const wikilink = wikilinkService.findInnermostWikilinkAtOffset(
                wikilinks,
                editor.selection.active.character,
            );

            if (!wikilink) {
                // Not on a wikilink — show backlinks for the active file
                backlinkPanelProvider.show();
                return;
            }

            // Try to find the page in the index
            const page = indexService.findPagesByFilename(wikilink.pageFileName + '.md')?.[0];
            if (page) {
                backlinkPanelProvider.showForPage(page.id, page.title);
            } else {
                // Forward reference — use page name directly
                backlinkPanelProvider.showForName(wikilink.pageName);
            }
        }),
    );

    // View backlinks for a specific wikilink passed as args — used by the hover command link.
    // Args: [{ pageFileName: string, pageName: string }]
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.viewBacklinksForPage', (args: { pageFileName: string; pageName: string }) => {
            if (!backlinkPanelProvider || !indexService || !args?.pageFileName) { return; }

            const page = indexService.findPagesByFilename(args.pageFileName + '.md')?.[0];
            if (page) {
                backlinkPanelProvider.showForPage(page.id, page.title);
            } else {
                backlinkPanelProvider.showForName(args.pageName);
            }
        }),
    );

    // Daily journal command
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.openDailyJournal', () =>
            openDailyJournal(workspaceRoot),
        ),
    );

    // ── Encryption commands (Pro) ──────────────────────────────────────

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.setEncryptionKey', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your encryption passphrase',
                password: true,
                ignoreFocusOut: true,
                placeHolder: 'Passphrase (stored securely in OS secret storage)',
            });
            if (key === undefined) { return; }
            if (key === '') {
                vscode.window.showWarningMessage('AS Notes: Passphrase cannot be empty.');
                return;
            }
            await context.secrets.store('as-notes.encryptionKey', key);
            vscode.window.showInformationMessage('AS Notes: Encryption key saved.');
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.clearEncryptionKey', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            await context.secrets.delete('as-notes.encryptionKey');
            vscode.window.showInformationMessage('AS Notes: Encryption key cleared.');
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.encryptNotes', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            const passphrase = await context.secrets.get('as-notes.encryptionKey');
            if (!passphrase) {
                vscode.window.showWarningMessage(
                    'AS Notes: No encryption key set. Run "AS Notes: Set Encryption Key" first.',
                );
                return;
            }
            const files = await vscode.workspace.findFiles('**/*.enc.md');
            let encrypted = 0;
            let skipped = 0;
            let errors = 0;
            // Derive key once to avoid 100k PBKDF2 iterations per file
            const derivedKey = EncryptionService.deriveKey(passphrase);
            for (const fileUri of files) {
                try {
                    // Use open editor buffer if available (captures unsaved edits)
                    const openDoc = vscode.workspace.textDocuments.find(
                        d => d.uri.fsPath === fileUri.fsPath,
                    );
                    const content = openDoc
                        ? openDoc.getText()
                        : Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf-8');
                    if (EncryptionService.isEncrypted(content)) { skipped++; continue; }
                    const encContent = EncryptionService.encrypt(content, passphrase, derivedKey);
                    if (openDoc) {
                        // Write back via WorkspaceEdit so the editor buffer stays in sync
                        const fullRange = new vscode.Range(
                            openDoc.positionAt(0),
                            openDoc.positionAt(openDoc.getText().length),
                        );
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(openDoc.uri, fullRange, encContent);
                        await vscode.workspace.applyEdit(edit);
                        await openDoc.save();
                    } else {
                        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(encContent, 'utf-8'));
                    }
                    encrypted++;
                } catch (err) {
                    console.warn(`as-notes: failed to encrypt ${fileUri.fsPath}:`, err);
                    errors++;
                }
            }
            const errMsg = errors > 0 ? ` ${errors} error(s).` : '';
            vscode.window.showInformationMessage(
                `AS Notes: Encrypted ${encrypted} file(s). ${skipped} already encrypted.${errMsg}`,
            );
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.decryptNotes', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            const passphrase = await context.secrets.get('as-notes.encryptionKey');
            if (!passphrase) {
                vscode.window.showWarningMessage(
                    'AS Notes: No encryption key set. Run "AS Notes: Set Encryption Key" first.',
                );
                return;
            }
            const files = await vscode.workspace.findFiles('**/*.enc.md');
            let decrypted = 0;
            let skipped = 0;
            let errors = 0;
            // Derive key once to avoid 100k PBKDF2 iterations per file
            const derivedKey = EncryptionService.deriveKey(passphrase);
            for (const fileUri of files) {
                try {
                    // Always read encrypted content from disk (authoritative source)
                    const bytes = await vscode.workspace.fs.readFile(fileUri);
                    const content = Buffer.from(bytes).toString('utf-8');
                    if (!EncryptionService.isEncrypted(content)) { skipped++; continue; }
                    const plaintext = EncryptionService.decrypt(content, passphrase, derivedKey);
                    // If the file is open in an editor, write via WorkspaceEdit to keep buffer in sync
                    const openDoc = vscode.workspace.textDocuments.find(
                        d => d.uri.fsPath === fileUri.fsPath,
                    );
                    if (openDoc) {
                        const fullRange = new vscode.Range(
                            openDoc.positionAt(0),
                            openDoc.positionAt(openDoc.getText().length),
                        );
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(openDoc.uri, fullRange, plaintext);
                        await vscode.workspace.applyEdit(edit);
                        await openDoc.save();
                    } else {
                        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(plaintext, 'utf-8'));
                    }
                    decrypted++;
                } catch (err) {
                    console.warn(`as-notes: failed to decrypt ${fileUri.fsPath}:`, err);
                    errors++;
                }
            }
            const errMsg = errors > 0 ? ` ${errors} error(s).` : '';
            vscode.window.showInformationMessage(
                `AS Notes: Decrypted ${decrypted} file(s). ${skipped} already plaintext.${errMsg}`,
            );
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.createEncryptedFile', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            const title = await vscode.window.showInputBox({
                prompt: 'Note title',
                placeHolder: 'My encrypted note',
                ignoreFocusOut: true,
            });
            if (!title) { return; }
            const filename = `${sanitiseFileName(title)}.enc.md`;
            const fileUri = vscode.Uri.joinPath(workspaceRoot, filename);
            try {
                await vscode.workspace.fs.stat(fileUri);
                // File already exists — just open it
            } catch {
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from('', 'utf-8'));
            }
            const doc = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(doc);
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.createEncryptedJournalNote', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            const config = vscode.workspace.getConfiguration('as-notes');
            const journalFolder = config.get<string>('journalFolder', 'journals');
            const paths = computeJournalPaths(
                workspaceRoot.fsPath.replace(/\\/g, '/'),
                journalFolder,
                new Date(),
            );
            // Replace trailing .md with .enc.md for an encrypted journal note
            const encFilePath = paths.journalFilePath.replace(/\.md$/, '.enc.md');
            const folderUri = vscode.Uri.file(paths.journalFolderPath);
            await vscode.workspace.fs.createDirectory(folderUri);
            const fileUri = vscode.Uri.file(encFilePath);
            try {
                await vscode.workspace.fs.stat(fileUri);
                // File already exists — just open it
            } catch {
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from('', 'utf-8'));
            }
            const doc = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(doc);
        }),
    );

    // ── Per-file encrypt / decrypt (Pro) ────────────────────────────────

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.encryptCurrentNote', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            const passphrase = await context.secrets.get('as-notes.encryptionKey');
            if (!passphrase) {
                vscode.window.showWarningMessage(
                    'AS Notes: No encryption key set. Run "AS Notes: Set Encryption Key" first.',
                );
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('AS Notes: No active editor.');
                return;
            }
            if (!editor.document.uri.fsPath.toLowerCase().endsWith('.enc.md')) {
                vscode.window.showErrorMessage('AS Notes: Current file is not an encrypted note (.enc.md).');
                return;
            }
            const content = editor.document.getText();
            if (EncryptionService.isEncrypted(content)) {
                vscode.window.showInformationMessage('AS Notes: File is already encrypted.');
                return;
            }
            const derivedKey = EncryptionService.deriveKey(passphrase);
            const encContent = EncryptionService.encrypt(content, passphrase, derivedKey);
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length),
            );
            const edit = new vscode.WorkspaceEdit();
            edit.replace(editor.document.uri, fullRange, encContent);
            await vscode.workspace.applyEdit(edit);
            await editor.document.save();
            vscode.window.showInformationMessage('AS Notes: Note encrypted.');
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.decryptCurrentNote', async () => {
            if (!isProLicenced()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            const passphrase = await context.secrets.get('as-notes.encryptionKey');
            if (!passphrase) {
                vscode.window.showWarningMessage(
                    'AS Notes: No encryption key set. Run "AS Notes: Set Encryption Key" first.',
                );
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('AS Notes: No active editor.');
                return;
            }
            if (!editor.document.uri.fsPath.toLowerCase().endsWith('.enc.md')) {
                vscode.window.showErrorMessage('AS Notes: Current file is not an encrypted note (.enc.md).');
                return;
            }
            // Always read from disk — disk is the authoritative encrypted source
            const bytes = await vscode.workspace.fs.readFile(editor.document.uri);
            const diskContent = Buffer.from(bytes).toString('utf-8');
            if (!EncryptionService.isEncrypted(diskContent)) {
                vscode.window.showInformationMessage('AS Notes: File is already plaintext.');
                return;
            }
            const derivedKey = EncryptionService.deriveKey(passphrase);
            const plaintext = EncryptionService.decrypt(diskContent, passphrase, derivedKey);
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length),
            );
            const edit = new vscode.WorkspaceEdit();
            edit.replace(editor.document.uri, fullRange, plaintext);
            await vscode.workspace.applyEdit(edit);
            await editor.document.save();
            vscode.window.showInformationMessage('AS Notes: Note decrypted.');
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.navigateToTask', async (pagePath: string, line: number) => {
            const workspaceRoot = getWorkspaceRoot();
            if (!workspaceRoot) { return; }
            const fileUri = vscode.Uri.joinPath(workspaceRoot, pagePath);
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(doc);
            const position = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }),
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
                taskPanelProvider?.refresh();
                backlinkPanelProvider?.refresh();
            } catch (err) {
                console.warn('as-notes: failed to index on save:', err);
            }
        }),
    );

    // On text change: debounced re-index of the live buffer so that newly
    // typed wikilinks (forward references) appear in autocomplete immediately
    // without requiring a save or editor switch.
    //
    // Note: completionProvider.refresh() is NOT called here — the 3 SQLite
    // queries it runs are expensive and this fires on every typing pause.
    // Forward references appear in autocomplete after the next save.
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
                const end = logService.time('debounce', 'indexFileContent + refresh');
                const relativePath = vscode.workspace.asRelativePath(doc.uri, false);
                const filename = path.basename(doc.uri.fsPath);
                indexService!.indexFileContent(relativePath, filename, doc.getText(), Date.now());
                taskPanelProvider?.refresh();
                backlinkPanelProvider?.refresh();
                end();
            }, 500);
        }),
    );

    // Re-trigger completion when the user backspaces inside a [[ ... ]] and
    // VS Code has already killed the completion session (zero matches or
    // word-boundary heuristic).  `triggerSuggest` is a no-op when the widget
    // is already visible, so this is safe to fire on every text change.
    fullModeDisposables.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (!isMarkdown(e.document)) { return; }
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document !== e.document) { return; }

            // Only act on deletions (backspace / delete key)
            const hasDeletion = e.contentChanges.some(
                c => c.rangeLength > 0 && c.text.length === 0,
            );
            if (!hasDeletion) { return; }

            const pos = editor.selection.active;
            const lineText = e.document.lineAt(pos.line).text;
            const textUpToCursor = lineText.substring(0, pos.character);
            const bracketCol = findInnermostOpenBracket(textUpToCursor);

            if (bracketCol !== -1) {
                logService.info('completion', 're-triggering suggest after backspace inside [[');
                // Defer so VS Code finishes processing the deletion first.
                setTimeout(() => {
                    vscode.commands.executeCommand('editor.action.triggerSuggest');
                }, 0);
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
            if (!safeSaveToFile()) { return; }
            completionProvider?.refresh();
            taskPanelProvider?.refresh();
            backlinkPanelProvider?.refresh();
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
            taskPanelProvider?.refresh();
            backlinkPanelProvider?.refresh();
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
            taskPanelProvider?.refresh();
            backlinkPanelProvider?.refresh();
        }),
    );

    // On active editor change: re-index the file being left from the editor
    // buffer (not disk) so unsaved edits (e.g. new aliases in front matter)
    // are captured immediately.
    //
    // The re-indexing is deferred with setTimeout(0) so the new editor's
    // decorations render first — the synchronous SQLite work would otherwise
    // block the event loop and delay decoration painting.
    //
    // completionProvider.refresh() is NOT called here — completion data is
    // global (all pages / aliases / forward refs) and switching tabs doesn't
    // change it.  Forward refs from unsaved edits appear after the next save.
    let previousEditorUri: vscode.Uri | undefined;
    fullModeDisposables.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            const uriToReindex = previousEditorUri;
            previousEditorUri = editor?.document.uri;

            if (uriToReindex && isMarkdownUri(uriToReindex)) {
                // Defer off the UI thread so the new editor paints first.
                setTimeout(async () => {
                    try {
                        const doc = vscode.workspace.textDocuments.find(
                            d => d.uri.toString() === uriToReindex.toString(),
                        );
                        if (doc) {
                            const relativePath = vscode.workspace.asRelativePath(doc.uri, false);
                            const filename = path.basename(doc.uri.fsPath);
                            const content = doc.getText();
                            const stat = await vscode.workspace.fs.stat(doc.uri);
                            indexService!.indexFileContent(relativePath, filename, content, stat.mtime);
                        } else {
                            // Document already closed — fall back to disk read
                            await indexScanner!.indexFile(uriToReindex);
                        }
                        if (!safeSaveToFile()) { return; }
                        taskPanelProvider?.refresh();
                        backlinkPanelProvider?.refresh();
                    } catch {
                        // File may have been closed/deleted
                    }
                }, 0);
            }
        }),
    );

    // Periodic scanner
    startPeriodicScan();

    // Watch .asnotesignore for changes — reload patterns and run a stale scan
    // so newly ignored files are removed from the index and un-ignored files
    // are picked up.
    const ignoreFileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, IGNORE_FILE),
    );
    const onIgnoreFileChange = (): void => {
        ignoreService?.reload();
        indexScanner?.staleScan().then((summary) => {
            if (summary.newFiles > 0 || summary.staleFiles > 0 || summary.deletedFiles > 0) {
                indexService?.saveToFile();
                completionProvider?.refresh();
                taskPanelProvider?.refresh();
                backlinkPanelProvider?.refresh();
                updateFullModeStatusBar();
            }
        }).catch(err => console.warn('as-notes: stale scan after .asnotesignore change failed:', err));
    };
    ignoreFileWatcher.onDidChange(onIgnoreFileChange);
    ignoreFileWatcher.onDidCreate(onIgnoreFileChange);
    ignoreFileWatcher.onDidDelete(onIgnoreFileChange);
    fullModeDisposables.push(ignoreFileWatcher);

    // Listen for config changes to restart periodic scan
    fullModeDisposables.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('as-notes.periodicScanInterval')) {
                clearPeriodicScan();
                startPeriodicScan();
            }
            if (e.affectsConfiguration('as-notes.assetPath')) {
                applyAssetPathSettings().catch(err =>
                    console.warn('as-notes: failed to apply asset path settings on config change:', err),
                );
            }
        }),
    );

    // Add all full-mode disposables to context
    for (const d of fullModeDisposables) {
        context.subscriptions.push(d);
    }

    // Update status bar
    updateFullModeStatusBar();
    logService.info('extension', 'enterFullMode: complete');
}

/**
 * Shows `AS Notes (Pro)` when a valid licence is active, `AS Notes` otherwise.
 * Safe to call at any time — no-ops if the status bar item is not yet created.
 */
function updateFullModeStatusBar(): void {
    if (!indexService?.isOpen) { return; }
    const pageCount = indexService.getAllPages().length;
    const proLabel = isProLicenced() ? ' (Pro)' : '';
    statusBarItem.text = `$(database) AS Notes${proLabel} — ${pageCount} pages`;
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
    vscode.commands.executeCommand('setContext', 'as-notes.fullMode', false);
    taskPanelProvider = undefined;
    backlinkPanelProvider = undefined;
}

/**
 * Tear down full mode and switch to passive mode.
 * Called when `.asnotes/` is detected as missing during a save attempt.
 */
function exitFullMode(): void {
    logService.info('extension', 'exitFullMode: tearing down');
    clearPeriodicScan();
    if (indexService?.isOpen) {
        indexService.close();
    }
    indexService = undefined;
    indexScanner = undefined;
    ignoreService = undefined;
    completionProvider = undefined;
    logService.info('extension', 'exitFullMode: complete');
    logService = NO_OP_LOGGER;
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

    // Create .asnotesignore at workspace root if it doesn't already exist.
    ensureIgnoreFile(workspaceRoot.fsPath);

    // Install git pre-commit hook to guard against committing unencrypted .enc.md files
    ensurePreCommitHook(workspaceRoot.fsPath);

    // Configure the built-in markdown copy-files destination before entering full mode
    await applyAssetPathSettings();

    // Create LogService early so the initial full scan is instrumented
    const config = vscode.workspace.getConfiguration('as-notes');
    const loggingEnabled = config.get<boolean>('enableLogging', false)
        || process.env.AS_NOTES_DEBUG === '1';
    const logDir = path.join(asnotesDir, 'logs');
    logService = new LogService(logDir, { enabled: loggingEnabled });
    if (logService.isEnabled) {
        logService.info('extension', 'initWorkspace: logging activated');
    }

    // Enter full mode (creates DB, runs full scan)
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'AS Notes: Initialising workspace',
            cancellable: false,
        },
        async (progress) => {
            const dbPath = path.join(asnotesDir, INDEX_DB);
            logService.info('extension', 'initWorkspace: initialising database');
            indexService = new IndexService(dbPath, logService);
            await indexService.initDatabase();

            const initIgnoreService = new IgnoreService(path.join(workspaceRoot.fsPath, IGNORE_FILE)); indexScanner = new IndexScanner(indexService, workspaceRoot, initIgnoreService, logService);

            const result = await indexScanner.fullScan(progress);
            indexService.saveToFile();

            logService.info('extension', `initWorkspace: complete — ${result.filesIndexed} files, ${result.linksFound} links`);
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

    // Ensure git pre-commit hook and .asnotesignore are present (idempotent)
    const root = getWorkspaceRoot();
    if (root) {
        ensurePreCommitHook(root.fsPath);
        ensureIgnoreFile(root.fsPath);
        ignoreService?.reload();
    }

    // Re-apply asset path settings in case they were modified externally
    applyAssetPathSettings().catch(err =>
        console.warn('as-notes: failed to re-apply asset path settings on rebuild:', err),
    );

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'AS Notes: Rebuilding index',
            cancellable: true,
        },
        async (progress, token) => {
            try {
                // ── Rebuild: fresh WASM instance ───────────────────────────
                // The index database is entirely derived from the filesystem —
                // there is nothing in it that cannot be reconstructed by a
                // full scan.  resetSchema() closes the old DB, resets the
                // sql.js WASM cache, loads a fresh WASM instance with clean
                // linear memory, and creates an empty database on it.
                // This is necessary because WASM memory can only grow (never
                // shrink) and becomes fragmented after indexing ~18k files.
                // ────────────────────────────────────────────────────────────
                logService.info('extension', 'rebuildIndex: resetting schema');
                await indexService!.resetSchema();

                logService.info('extension', 'rebuildIndex: starting fullScan');
                const result = await indexScanner!.fullScan(progress, token);

                logService.info('extension', 'rebuildIndex: saving to file');
                indexService!.saveToFile();

                completionProvider?.refresh();
                taskPanelProvider?.refresh();
                backlinkPanelProvider?.refresh();

                // Update status bar
                updateFullModeStatusBar();

                vscode.window.showInformationMessage(
                    `AS Notes: Rebuild complete — ${result.filesIndexed} files indexed, ${result.linksFound} links found.`,
                );
                logService.info('extension', `rebuildIndex: complete — ${result.filesIndexed} files, ${result.linksFound} links`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error('as-notes: rebuildIndex failed:', err);
                logService.error('extension', `rebuildIndex: failed — ${msg}`);
                vscode.window.showErrorMessage(`AS Notes: Rebuild failed — ${msg}`);
            }
        },
    );
}

/**
 * Clean Workspace — removes the `.asnotes/` directory, releases all in-memory
 * state, and switches to passive mode. This is a full reset that lets the user
 * re-initialise from scratch via "AS Notes: Initialise Workspace".
 *
 * `.asnotesignore` at the workspace root is intentionally preserved.
 */
async function cleanWorkspace(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('AS Notes: No workspace folder is open.');
        return;
    }

    const asnotesDir = path.join(workspaceRoot.fsPath, ASNOTES_DIR);
    if (!fs.existsSync(asnotesDir)) {
        vscode.window.showInformationMessage('AS Notes: Workspace is already clean (no .asnotes/ directory).');
        return;
    }

    const answer = await vscode.window.showWarningMessage(
        'AS Notes: This will delete the .asnotes/ directory (index database, logs, git hook config) and reset the extension. Continue?',
        { modal: true },
        'Clean Workspace',
    );
    if (answer !== 'Clean Workspace') { return; }

    logService.info('extension', 'cleanWorkspace: confirmed, tearing down');

    // Tear down all in-memory state first — closes the database handle so the
    // file can be deleted on Windows.
    exitFullMode();

    // Remove the .asnotes/ directory tree.
    try {
        fs.rmSync(asnotesDir, { recursive: true, force: true });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`AS Notes: Failed to remove .asnotes/ — ${msg}`);
        return;
    }

    vscode.window.showInformationMessage(
        'AS Notes: Workspace cleaned. Run "AS Notes: Initialise Workspace" to start fresh.',
    );
}

// ── Daily journal ──────────────────────────────────────────────────────────

async function openDailyJournal(workspaceRoot: vscode.Uri): Promise<void> {
    const config = vscode.workspace.getConfiguration('as-notes');
    const journalFolder = config.get<string>('journalFolder', 'journals');

    const paths = computeJournalPaths(
        workspaceRoot.fsPath.replace(/\\/g, '/'),
        journalFolder,
        new Date(),
    );

    const journalUri = vscode.Uri.file(paths.journalFilePath);

    // If journal file already exists, just open it
    try {
        await vscode.workspace.fs.stat(journalUri);
        const doc = await vscode.workspace.openTextDocument(journalUri);
        await vscode.window.showTextDocument(doc);
        return;
    } catch {
        // File does not exist — proceed with creation
    }

    // Ensure the journal folder exists
    const folderUri = vscode.Uri.file(paths.journalFolderPath);
    await vscode.workspace.fs.createDirectory(folderUri);

    // Ensure the template file exists; create with default content if missing
    const templateUri = vscode.Uri.file(paths.templateFilePath);
    let templateContent: string;
    try {
        const bytes = await vscode.workspace.fs.readFile(templateUri);
        templateContent = Buffer.from(bytes).toString('utf-8');
    } catch {
        // Template doesn't exist — create it with the default
        templateContent = DEFAULT_TEMPLATE;
        await vscode.workspace.fs.writeFile(templateUri, Buffer.from(templateContent, 'utf-8'));
    }

    // Apply template and create the journal file
    const content = applyTemplate(templateContent, new Date());
    await vscode.workspace.fs.writeFile(journalUri, Buffer.from(content, 'utf-8'));

    // Index the new file immediately
    try {
        await indexScanner!.indexFile(journalUri);
        safeSaveToFile();
        completionProvider?.refresh();
        taskPanelProvider?.refresh();
        backlinkPanelProvider?.refresh();

        // Update status bar with new page count
        updateFullModeStatusBar();
    } catch (err) {
        console.warn('as-notes: failed to index new journal file:', err);
    }

    // Open the new journal file with cursor at end of content
    const doc = await vscode.workspace.openTextDocument(journalUri);
    const editor = await vscode.window.showTextDocument(doc);
    const endPos = doc.lineAt(doc.lineCount - 1).range.end;
    editor.selection = new vscode.Selection(endPos, endPos);
    editor.revealRange(new vscode.Range(endPos, endPos));
}

// ── Periodic scanning ──────────────────────────────────────────────────────

function startPeriodicScan(): void {
    const intervalSec = vscode.workspace.getConfiguration('as-notes').get<number>('periodicScanInterval', 300);
    if (intervalSec <= 0) { return; }

    const intervalMs = intervalSec * 1000;
    periodicScanHandle = setInterval(async () => {
        if (!indexService?.isOpen || !indexScanner) { return; }
        try {
            logService.info('extension', 'periodicScan: tick starting');
            // Ensure the git hook and .asnotesignore remain present
            const root = getWorkspaceRoot();
            if (root) {
                ensurePreCommitHook(root.fsPath);
                ensureIgnoreFile(root.fsPath);
                ignoreService?.reload();
            }

            const summary = await indexScanner.staleScan();
            if (summary.newFiles > 0 || summary.staleFiles > 0 || summary.deletedFiles > 0) {
                if (!safeSaveToFile()) { return; }
                completionProvider?.refresh();
                taskPanelProvider?.refresh();
                backlinkPanelProvider?.refresh();
                updateFullModeStatusBar();
                logService.info('extension', `periodicScan: changes detected — ${summary.newFiles} new, ${summary.staleFiles} stale, ${summary.deletedFiles} deleted`);
            } else {
                logService.info('extension', 'periodicScan: no changes');
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

/**
 * Creates `.asnotesignore` at the workspace root with default content if it
 * does not already exist. Existence is enforced; content is never overwritten.
 * Safe to call on every rebuild / periodic scan tick.
 */
function ensureIgnoreFile(workspaceRootFsPath: string): void {
    const ignoreFilePath = path.join(workspaceRootFsPath, IGNORE_FILE);
    if (!fs.existsSync(ignoreFilePath)) {
        fs.writeFileSync(ignoreFilePath, DEFAULT_IGNORE_CONTENT, 'utf-8');
    }
}

function getWorkspaceRoot(): vscode.Uri | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function isMarkdown(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'markdown' && !isEncryptedFileUri(doc.uri);
}

function isMarkdownUri(uri: vscode.Uri): boolean {
    if (isEncryptedFileUri(uri)) { return false; }
    const ext = path.extname(uri.fsPath).toLowerCase();
    return ext === '.md' || ext === '.markdown';
}

/** Returns true if the URI points to a `.enc.md` encrypted file. */
function isEncryptedFileUri(uri: vscode.Uri): boolean {
    return uri.fsPath.toLowerCase().endsWith('.enc.md');
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
