import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WikilinkService, wikilinkPlugin, type WikilinkResolverFn } from 'as-notes-common';
import { WikilinkFileService } from './WikilinkFileService.js';
import { WikilinkDecorationManager } from './WikilinkDecorationManager.js';
import { handleExplorerRenameRefactors } from './WikilinkExplorerRenameRefactorService.js';
import { WikilinkDocumentLinkProvider } from './WikilinkDocumentLinkProvider.js';
import { WikilinkHoverProvider } from './WikilinkHoverProvider.js';
import { WikilinkRenameTracker } from './WikilinkRenameTracker.js';
import { IndexService } from './IndexService.js';
import { IndexScanner } from './IndexScanner.js';
import { WikilinkCompletionProvider } from './WikilinkCompletionProvider.js';
import { getPathDistance, sanitiseFileName } from './PathUtils.js';
import { toggleTodoLine } from './TodoToggleService.js';
import { TaskPanelProvider } from './TaskPanelProvider.js';
import { SearchPanelProvider } from './SearchPanelProvider.js';
import { BacklinkPanelProvider } from './BacklinkPanelProvider.js';
import {
    computeJournalPaths,
    normaliseJournalFolder,
} from './JournalService.js';
import {
    applyTemplatePlaceholders,
    computeTemplateFolderPath,
    DEFAULT_JOURNAL_TEMPLATE,
    JOURNAL_TEMPLATE_FILENAME,
    CURSOR_SENTINEL,
    type TemplateContext,
} from './TemplateService.js';
import {
    hasProEditorAccess,
    hasProAiSyncAccess,
    defaultLicenceState,
    type LicenceState,
} from './LicenceService.js';
import { activateLicenceKey, checkServerForRevocation, verifyLicenceFromSettings, migrateOldSecrets } from './LicenceActivationService.js';
import * as EncryptionService from './EncryptionService.js';
import { ensurePreCommitHook } from './GitHookService.js';
import { applyAssetPathSettings } from './ImageDropProvider.js';
import { LogService, NO_OP_LOGGER } from './LogService.js';
import { findInnermostOpenBracket, hasNewCompleteWikilink } from './CompletionUtils.js';
import { IgnoreService } from './IgnoreService.js';
import { SlashCommandProvider } from './SlashCommandProvider.js';
import { openDatePicker } from './DatePickerService.js';
import { insertTaskDueDate, insertTaskCompletionDate, insertTagAtTaskStart } from './TaskHashtagService.js';
import { toggleFrontMatterField, cycleFrontMatterField, publishToHtml, configurePublish } from './PublishService.js';
import { generateTable, addColumns, addRows, formatTable, removeCurrentRow, removeCurrentColumn, removeRowsAbove, removeRowsBelow, removeColumnsRight, removeColumnsLeft } from './TableService.js';
import { isOnBulletLine, getOutlinerEnterInsert, toggleOutlinerTodoLine, isCodeFenceOpen, getCodeFenceEnterInsert, formatOutlinerPaste, isStandaloneCodeFenceOpen, getStandaloneCodeFenceEnterInsert, isClosingCodeFenceLine, getClosingFenceBulletInsert, isCodeFenceUnbalanced, getMaxOutlinerIndent } from './OutlinerService.js';
import { KanbanStore } from './KanbanStore.js';
import { KanbanBoardConfigStore } from './KanbanBoardConfigStore.js';
import { KanbanEditorPanel } from './KanbanEditorPanel.js';
import { KanbanSidebarProvider } from './KanbanSidebarProvider.js';
import { CalendarPanelProvider } from './CalendarPanelProvider.js';
import type { Priority } from './KanbanTypes.js';
import { computeNotesRootPaths, toNotesRelativePath, isInsideNotesRoot, type NotesRootPaths } from './NotesRootService.js';
import { InlineEditorManager } from './inline-editor/InlineEditorManager.js';
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

/**
 * Command IDs registered inside `enterFullMode()`. Passive-mode stubs are
 * registered for each of these in `activate()` so that VS Code never shows
 * a cryptic "command not found" error when the workspace is not initialised.
 * The stubs are stored in `fullModeDisposables` and automatically disposed
 * when `enterFullMode()` calls `disposeFullMode()`.
 */
const FULL_MODE_COMMAND_IDS: string[] = [
    'as-notes.toggleTaskPanel',
    'as-notes.toggleShowTodoOnly',
    'as-notes.openDatePicker',
    'as-notes.insertTaskDueDate',
    'as-notes.insertTaskCompletionDate',
    'as-notes.insertTaskHashtag',
    'as-notes.insertTable',
    'as-notes.tableAddColumn',
    'as-notes.tableAddRow',
    'as-notes.tableFormat',
    'as-notes.tableRemoveRow',
    'as-notes.tableRemoveColumn',
    'as-notes.tableRemoveRowsAbove',
    'as-notes.tableRemoveRowsBelow',
    'as-notes.tableRemoveColumnsRight',
    'as-notes.tableRemoveColumnsLeft',
    'as-notes.toggleTodo',
    'as-notes.showBacklinks',
    'as-notes.navigateToPage',
    'as-notes.viewBacklinks',
    'as-notes.viewBacklinksForPage',
    'as-notes.openDailyJournal',
    'as-notes.renameJournalFiles',
    'as-notes.setEncryptionKey',
    'as-notes.clearEncryptionKey',
    'as-notes.encryptNotes',
    'as-notes.decryptNotes',
    'as-notes.createEncryptedFile',
    'as-notes.createEncryptedJournalNote',
    'as-notes.encryptCurrentNote',
    'as-notes.decryptCurrentNote',
    'as-notes.navigateToTask',
    'as-notes.navigateWikilink',
    'as-notes.openKanbanBoard',
    'as-notes.newKanbanCard',
    'as-notes.selectKanbanBoard',
    'as-notes.switchKanbanBoard',
    'as-notes.createKanbanBoard',
    'as-notes.deleteKanbanBoard',
    'as-notes.renameKanbanBoard',
    'as-notes.convertTaskToKanbanCard',
    'as-notes.insertTemplate',
    'as-notes.togglePublic',
    'as-notes.cycleLayout',
    'as-notes.toggleRetina',
    'as-notes.toggleAssets',
    'as-notes.publishToHtml',
    'as-notes.configurePublish',
    'as-notes.toggleInlineEditor',
    'as-notes.navigateToAnchor',
];

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

/** Search panel provider instance — alive while in full mode. */
let searchPanelProvider: SearchPanelProvider | undefined;

/** Kanban store instance — alive while in full mode. */
let kanbanStore: KanbanStore | undefined;
/** Kanban board config store instance — alive while in full mode. */
let kanbanBoardConfigStore: KanbanBoardConfigStore | undefined;
/** Kanban sidebar provider instance — alive while in full mode. */
let kanbanSidebarProvider: KanbanSidebarProvider | undefined;

/** Backlink panel provider instance -- alive while in full mode. */
let backlinkPanelProvider: BacklinkPanelProvider | undefined;

/** Calendar panel provider instance -- alive while in full mode. */
let calendarPanelProvider: CalendarPanelProvider | undefined;

/** Inline editor manager instance -- alive while in full mode. */
let inlineEditorManager: InlineEditorManager | undefined;

/** Log service instance — alive while in full mode. */
let logService: LogService = NO_OP_LOGGER;

/**
 * Resolved AS Notes root paths — set during activation / initialisation.
 * When `as-notes.rootDirectory` is empty this equals the workspace root.
 */
let notesRootPaths: NotesRootPaths | undefined;

/** AS Notes root as a VS Code URI — derived from notesRootPaths.root. */
let notesRootUri: vscode.Uri | undefined;

/** Stored extension context — needed for mode transitions. */
let extensionContext: vscode.ExtensionContext | undefined;

/** Current licence state — updated on activation, config change, and periodic validation. */
let licenceState: LicenceState = defaultLicenceState();

/** True only when running as the official appsoftwareltd.as-notes build. 
 *  This is deliberately a **deterrent, not a lock** - The legal protection is the licence; the ID check is friction on misuse and a clear indication to the user that the version violates licence terms.
*/
const OFFICIAL_EXTENSION_ID = 'appsoftwareltd.as-notes';
let isOfficialBuild = false;

/** Periodic validation timer handle — for cleanup on deactivation. */
let validationIntervalHandle: ReturnType<typeof setInterval> | undefined;

/** Periodic server check interval: 7 days. */
const VALIDATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shows a warning notification with action buttons for managing the licence.
 */
async function showLicenceWarning(): Promise<void> {
    const action = await vscode.window.showWarningMessage(
        'AS Notes: Your AS Notes licence is not valid or is expired (Pro features have been disabled).',
        'Manage Licence',
        'Enter Licence Key',
    );
    if (action === 'Manage Licence') {
        vscode.env.openExternal(vscode.Uri.parse('https://www.asnotes.io/billing'));
    } else if (action === 'Enter Licence Key') {
        vscode.commands.executeCommand('as-notes.enterLicenceKey');
    }
}

/**
 * Returns true when a valid Pro Editor (or higher) licence is active AND the
 * extension is running as the official published build.
 */
export function hasProEditor(): boolean {
    const override = process.env.AS_NOTES_LICENCE_OVERRIDE;
    if (override === 'pro_editor' || override === 'pro_ai_sync') { return true; }
    return isOfficialBuild && hasProEditorAccess(licenceState);
}

/**
 * Returns true when a valid Pro AI & Sync licence is active AND the
 * extension is running as the official published build.
 */
export function hasProAiSync(): boolean {
    const override = process.env.AS_NOTES_LICENCE_OVERRIDE;
    if (override === 'pro_ai_sync') { return true; }
    return isOfficialBuild && hasProAiSyncAccess(licenceState);
}

// ── Activation ─────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<{ extendMarkdownIt: (md: any) => any }> {
    extensionContext = context;
    isOfficialBuild = context.extension.id === OFFICIAL_EXTENSION_ID;

    // Start with full mode disabled so the welcome view is shown
    // until enterFullMode() completes and flips this to true.
    vscode.commands.executeCommand('setContext', 'as-notes.fullMode', false);

    // Welcome view — empty tree so VS Code renders the viewsWelcome content
    // instead of a loading spinner when full mode is not active.
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('as-notes-welcome', {
            getTreeItem: () => new vscode.TreeItem(''),
            getChildren: () => [],
        }),
    );

    // Status bar — always present
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    context.subscriptions.push(statusBarItem);

    // ── Outliner mode ────────────────────────────────────────────────────────

    // Sync context key with setting on activation
    const syncOutlinerModeContext = () => {
        const enabled = vscode.workspace.getConfiguration('as-notes').get<boolean>('outlinerMode', false);
        vscode.commands.executeCommand('setContext', 'as-notes.outlinerMode', enabled);
    };
    syncOutlinerModeContext();

    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.toggleOutlinerMode', () => {
            const config = vscode.workspace.getConfiguration('as-notes');
            const current = config.get<boolean>('outlinerMode', false);
            config.update('outlinerMode', !current, vscode.ConfigurationTarget.Workspace).then(
                () => vscode.window.showInformationMessage(
                    `AS Notes: Outliner Mode ${!current ? 'enabled' : 'disabled'}.`,
                ),
            );
        }),
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('as-notes.outlinerMode')) {
                syncOutlinerModeContext();
            }
        }),
    );

    // Track whether the active cursor is on a bullet line or a code fence line
    const syncOutlinerLineContext = (editor: vscode.TextEditor | undefined) => {
        if (!editor || editor.document.languageId !== 'markdown') {
            vscode.commands.executeCommand('setContext', 'as-notes.onBulletLine', false);
            vscode.commands.executeCommand('setContext', 'as-notes.onCodeFenceLine', false);
            return;
        }
        const onBullet = editor.selections.some(
            sel => isOnBulletLine(editor.document.lineAt(sel.active.line).text),
        );
        const onCodeFence = editor.selections.some(
            sel => {
                const text = editor.document.lineAt(sel.active.line).text;
                return isStandaloneCodeFenceOpen(text) || isClosingCodeFenceLine(text);
            },
        );
        vscode.commands.executeCommand('setContext', 'as-notes.onBulletLine', onBullet);
        vscode.commands.executeCommand('setContext', 'as-notes.onCodeFenceLine', onCodeFence);
    };

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((e) => syncOutlinerLineContext(e.textEditor)),
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => syncOutlinerLineContext(editor)),
    );
    // Initialise for currently active editor
    syncOutlinerLineContext(vscode.window.activeTextEditor);

    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.outlinerEnter', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }

            // Track which selections triggered code fence skeleton insertion so we
            // can reposition cursors to the blank content line after the edit.
            let hasCodeFenceSkeleton = false;

            editor.edit(editBuilder => {
                for (const selection of editor.selections) {
                    const lineText = editor.document.lineAt(selection.active.line).text;
                    const lineEnd = new vscode.Position(
                        selection.active.line,
                        editor.document.lineAt(selection.active.line).range.end.character,
                    );

                    // 1. Bullet line ending with opening code fence → open code block
                    if (isCodeFenceOpen(lineText)) {
                        hasCodeFenceSkeleton = true;
                        editBuilder.insert(lineEnd, getCodeFenceEnterInsert(lineText));
                        continue;
                    }

                    // 2. Bullet line → new bullet at same indentation
                    const insertText = getOutlinerEnterInsert(lineText);
                    editBuilder.delete(new vscode.Range(selection.active, lineEnd));
                    editBuilder.insert(selection.active, insertText);
                }
            }).then(success => {
                if (!success || !hasCodeFenceSkeleton) { return; }
                // After code fence skeleton insertion, VS Code places the cursor at
                // the end of the closing ```. Reposition it to the blank line inside
                // the fence (one line above the closing ```).
                const newSelections: vscode.Selection[] = editor.selections.map(sel => {
                    const closingLine = sel.active.line;
                    const contentLine = closingLine > 0 ? closingLine - 1 : closingLine;
                    const contentLineLength = editor.document.lineAt(contentLine).text.length;
                    const pos = new vscode.Position(contentLine, contentLineLength);
                    return new vscode.Selection(pos, pos);
                });
                editor.selections = newSelections;
            });
        }),
    );

    // Code fence Enter — works in all markdown files regardless of outliner mode.
    // On standalone opening fences: inserts closing skeleton only when unbalanced.
    // On closing fences in outliner mode: inserts a new bullet line.
    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.codeFenceEnter', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }

            const allLines = editor.document.getText().split('\n');
            const outlinerMode = vscode.workspace.getConfiguration('as-notes').get<boolean>('outlinerMode', false);
            let hasCodeFenceSkeleton = false;

            editor.edit(editBuilder => {
                for (const selection of editor.selections) {
                    const lineText = editor.document.lineAt(selection.active.line).text;
                    const lineEnd = new vscode.Position(
                        selection.active.line,
                        editor.document.lineAt(selection.active.line).range.end.character,
                    );

                    // Closing fence of a bullet code block (checked first to avoid
                    // misidentifying it as an unbalanced standalone opener)
                    if (isClosingCodeFenceLine(lineText)) {
                        const bulletResult = getClosingFenceBulletInsert(allLines, selection.active.line);
                        if (bulletResult !== null) {
                            if (outlinerMode) {
                                editBuilder.insert(lineEnd, bulletResult);
                            } else {
                                editBuilder.insert(lineEnd, '\n');
                            }
                            continue;
                        }
                    }

                    // Standalone fence (opening with language, or bare ```)
                    if (isStandaloneCodeFenceOpen(lineText)) {
                        if (isCodeFenceUnbalanced(allLines, selection.active.line)) {
                            hasCodeFenceSkeleton = true;
                            editBuilder.insert(lineEnd, getStandaloneCodeFenceEnterInsert(lineText));
                        } else {
                            editBuilder.insert(lineEnd, '\n');
                        }
                        continue;
                    }
                }
            }).then(success => {
                if (!success || !hasCodeFenceSkeleton) { return; }
                const newSelections: vscode.Selection[] = editor.selections.map(sel => {
                    const closingLine = sel.active.line;
                    const contentLine = closingLine > 0 ? closingLine - 1 : closingLine;
                    const contentLineLength = editor.document.lineAt(contentLine).text.length;
                    const pos = new vscode.Position(contentLine, contentLineLength);
                    return new vscode.Selection(pos, pos);
                });
                editor.selections = newSelections;
            });
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.outlinerIndent', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }

            const allLines = editor.document.getText().split('\n');
            const tabSize = editor.options.tabSize as number ?? 4;

            // Only indent if every selection's bullet line would stay within
            // one tab stop of the nearest bullet above it.
            const allAllowed = editor.selections.every(sel => {
                const lineText = editor.document.lineAt(sel.active.line).text;
                const currentIndent = (lineText.match(/^(\s*)/)?.[1]?.length) ?? 0;
                const maxIndent = getMaxOutlinerIndent(allLines, sel.active.line, tabSize);
                return currentIndent + tabSize <= maxIndent;
            });

            if (allAllowed) {
                vscode.commands.executeCommand('editor.action.indentLines');
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.outlinerOutdent', () => {
            vscode.commands.executeCommand('editor.action.outdentLines');
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.outlinerPaste', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            const clipboardText = await vscode.env.clipboard.readText();
            if (!clipboardText) { return; }

            // Check if any selection is on a bullet line with multi-line clipboard
            const sel = editor.selection;
            const lineText = editor.document.lineAt(sel.active.line).text;
            const result = formatOutlinerPaste(lineText, sel.active.character, clipboardText);

            if (!result) {
                // Single-line or empty paste: fall through to default paste
                vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                return;
            }

            // Replace the entire line with the formatted multi-line bullets
            const line = editor.document.lineAt(sel.active.line);
            editor.edit(editBuilder => {
                editBuilder.replace(line.range, result.text);
            });
        }),
    );

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
    /** Validate a licence key with appropriate UI feedback. */
    function validateLicenceKeyWithUI(key: string): void {
        const activation = activateLicenceKey(key, context);

        // Only show a progress spinner if the server check takes a while.
        // Fast paths (ECONNREFUSED, local-only) resolve in <500ms and skip the spinner.
        const progressTimer = setTimeout(() => {
            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'AS Notes: Verifying licence key...' },
                () => activation,
            );
        }, 500);

        activation.then((state) => {
            clearTimeout(progressTimer);

            licenceState = state;
            if (licenceState.status === 'invalid' || licenceState.status === 'not-entered') {
                showLicenceWarning();
            } else if (licenceState.status === 'valid') {

                // Show licence activated regardless of whether licence was valid before or
                // if product has changed - the user should always see confirmation
                //
                // const previousProduct = licenceState.product;
                // const wasValid = hasProEditorAccess(licenceState);
                // ...
                // ... && (!wasValid || licenceState.product !== previousProduct)

                const tierLabel = licenceState.product === 'pro_ai_sync' ? 'Pro AI & Sync' : 'Pro Editor';
                vscode.window.showInformationMessage(`AS Notes: Licence activated - ${tierLabel} \u2714`);
            }
            updateFullModeStatusBar();
            inlineEditorManager?.refreshLicenceGate();
        }).catch((err) => {
            clearTimeout(progressTimer);
            console.warn('as-notes: licence validation failed:', err);
        });
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.enterLicenceKey', async () => {
            const currentKey = vscode.workspace.getConfiguration('as-notes').get<string>('licenceKey', '');
            const key = await vscode.window.showInputBox({
                title: 'AS Notes: Enter Licence Key',
                prompt: 'Enter your AS Notes Pro licence key (starts with ASNO-)',
                placeHolder: 'ASNO-XXXX-XXXX-...',
                value: currentKey,
                ignoreFocusOut: true,
            });
            if (key === undefined) { return; } // cancelled
            if (key === currentKey) {
                // Same key re-entered — config change won't fire, validate directly.
                validateLicenceKeyWithUI(key);
            } else {
                // Different key — update setting, config change handler will validate.
                await vscode.workspace.getConfiguration('as-notes').update('licenceKey', key, vscode.ConfigurationTarget.Global);
            }
        }),
    );

    // Clean up legacy SecretStorage keys from the JWT-based system.
    migrateOldSecrets(context.secrets).catch((err) => {
        console.warn('as-notes: failed to migrate old secrets:', err);
    });

    // Verify licence from settings on startup (instant, offline Ed25519 check).
    // This replaces cached SecretStorage lookup -- always re-derives state from
    // the canonical settings key, eliminating SecretStorage race conditions.
    verifyLicenceFromSettings(context).then((state) => {
        licenceState = state;
        updateFullModeStatusBar();
        inlineEditorManager?.refreshLicenceGate();
    }).catch((err) => {
        console.warn('as-notes: failed to verify licence from settings:', err);
    });

    // Periodic background check for revocation (every 7 days).
    validationIntervalHandle = setInterval(() => {
        checkServerForRevocation(context).then((state) => {
            const wasValid = hasProEditorAccess(licenceState);
            licenceState = state;
            if (wasValid && !hasProEditorAccess(licenceState)) {
                showLicenceWarning();
            }
            updateFullModeStatusBar();
            inlineEditorManager?.refreshLicenceGate();
        }).catch((err) => {
            console.warn('as-notes: periodic licence check failed:', err);
        });
    }, VALIDATION_INTERVAL_MS);

    // Re-validate whenever the licence key setting changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (!e.affectsConfiguration('as-notes.licenceKey')) { return; }
            const newKey = vscode.workspace.getConfiguration('as-notes').get<string>('licenceKey', '');
            validateLicenceKeyWithUI(newKey);
        }),
    );

    // Build the API return value (markdown-it plugin) before mode setup
    // so it's available regardless of which code path we take.
    // CRITICAL: This must always be returned, even if enterFullMode() fails,
    // so that VS Code's markdown preview can pick up the wikilink plugin.
    const apiReturn = { extendMarkdownIt: createExtendMarkdownIt() };

    // Register passive-mode stubs for all full-mode commands so that VS Code
    // never shows "command not found" when the workspace is not initialised.
    // These are stored in fullModeDisposables and disposed when enterFullMode()
    // replaces them with real implementations.
    for (const id of FULL_MODE_COMMAND_IDS) {
        fullModeDisposables.push(
            vscode.commands.registerCommand(id, async () => {
                const action = await vscode.window.showWarningMessage(
                    'AS Notes: Workspace not initialised. Run "AS Notes: Initialise Workspace" to get started.',
                    'Initialise',
                );
                if (action === 'Initialise') {
                    vscode.commands.executeCommand('as-notes.initWorkspace');
                }
            }),
        );
    }

    // Check for .asnotes/ — either at the configured rootDirectory or workspace root
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        setPassiveMode('No workspace folder open');
        return apiReturn;
    }

    // Resolve the AS Notes root from the rootDirectory setting
    const rootDirSetting = vscode.workspace.getConfiguration('as-notes').get<string>('rootDirectory', '');
    notesRootPaths = computeNotesRootPaths(workspaceRoot.fsPath, rootDirSetting);
    notesRootUri = vscode.Uri.file(notesRootPaths.root);

    if (fs.existsSync(notesRootPaths.asnotesDir)) {
        // Validate that the configured root directory actually exists
        if (rootDirSetting.trim() && !fs.existsSync(notesRootPaths.root)) {
            setPassiveMode('Configured root directory does not exist');
            return apiReturn;
        }
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
    if (validationIntervalHandle !== undefined) {
        clearInterval(validationIntervalHandle);
        validationIntervalHandle = undefined;
    }
    disposeFullMode();
}

// ── Todo toggle ────────────────────────────────────────────────────────────

function toggleTodoCommand(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    // Collect unique line numbers across all selections/cursors
    const lineNumbers = [...new Set(editor.selections.map(sel => sel.active.line))];

    const outlinerMode = vscode.workspace.getConfiguration('as-notes').get<boolean>('outlinerMode', false);

    editor.edit(editBuilder => {
        for (const lineNum of lineNumbers) {
            const line = editor.document.lineAt(lineNum);
            const toggled = outlinerMode && isOnBulletLine(line.text)
                ? toggleOutlinerTodoLine(line.text)
                : toggleTodoLine(line.text);
            editBuilder.replace(line.range, toggled);
        }
    }).then(success => {
        if (!success || !indexService?.isOpen) { return; }
        // Re-index from the live buffer so the tasks table is updated immediately
        const doc = editor.document;
        const relativePath = notesRootPaths
            ? toNotesRelativePath(notesRootPaths.root, doc.uri.fsPath)
            : vscode.workspace.asRelativePath(doc.uri, false);
        const filename = path.basename(doc.uri.fsPath);
        indexService.indexFileContent(relativePath, filename, doc.getText(), Date.now());
        taskPanelProvider?.refresh();
        searchPanelProvider?.refresh();
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

    // Ensure notes root paths are resolved
    if (!notesRootPaths || !notesRootUri) {
        const rootDirSetting = vscode.workspace.getConfiguration('as-notes').get<string>('rootDirectory', '');
        notesRootPaths = computeNotesRootPaths(workspaceRoot.fsPath, rootDirSetting);
        notesRootUri = vscode.Uri.file(notesRootPaths.root);
    }

    const nrp = notesRootPaths;
    const nrUri = notesRootUri;

    // Create LogService — enabled by setting or env var, requires reload to change.
    const config = vscode.workspace.getConfiguration('as-notes');
    const loggingEnabled = config.get<boolean>('enableLogging', false)
        || process.env.AS_NOTES_DEBUG === '1';
    logService = new LogService(nrp.logDir, { enabled: loggingEnabled });
    if (logService.isEnabled) {
        logService.info('extension', 'Logging activated');
    }

    indexService = new IndexService(nrp.databasePath, logService);
    logService.info('extension', 'enterFullMode: initialising database');
    const { schemaReset } = await indexService.initDatabase();

    // ── Ensure standard directories exist (migration for existing workspaces) ──
    const templateFolder = config.get<string>('templateFolder', 'templates');
    const templateFolderPath = computeTemplateFolderPath(
        nrp.rootUri,
        templateFolder,
    );
    fs.mkdirSync(templateFolderPath, { recursive: true });
    const journalTemplatePath = path.join(templateFolderPath, JOURNAL_TEMPLATE_FILENAME).replace(/\\/g, '/');
    if (!fs.existsSync(journalTemplatePath)) {
        fs.writeFileSync(journalTemplatePath, DEFAULT_JOURNAL_TEMPLATE, 'utf-8');
    }

    const journalFolder = config.get<string>('journalFolder', 'journals');
    const normalisedJournal = normaliseJournalFolder(journalFolder);
    if (normalisedJournal) {
        const journalFolderPath = path.join(nrp.root, normalisedJournal);
        fs.mkdirSync(journalFolderPath, { recursive: true });
    }

    const notesFolder = config.get<string>('notesFolder', 'notes');
    const normalisedNotes = notesFolder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
    if (normalisedNotes) {
        const notesFolderPath = path.join(nrp.root, normalisedNotes);
        fs.mkdirSync(notesFolderPath, { recursive: true });
    }

    ignoreService = new IgnoreService(nrp.ignoreFilePath);
    indexScanner = new IndexScanner(indexService, nrUri, ignoreService, logService);

    // Shared services — WikilinkService is index-independent, so create early
    const wikilinkService = new WikilinkService();

    // Decoration manager — created before scan so wikilinks are visually
    // marked (muted grey) immediately, then switch to blue once the index
    // is ready and setReady() is called.
    // Scoped document selector: when a rootDirectory is configured, language
    // providers only activate for markdown files inside the notes root.
    const markdownSelector: vscode.DocumentSelector = nrUri
        ? { language: 'markdown', pattern: new vscode.RelativePattern(nrUri, '**') }
        : { language: 'markdown' };

    const decorationManager = new WikilinkDecorationManager(wikilinkService, logService, nrp?.root);
    fullModeDisposables.push(decorationManager);

    // Task panel — registered early so the sidebar is visible immediately,
    // even during a long schema-reset rebuild. The provider handles an empty
    // index gracefully (returns []); refresh() is called after scan completes.
    taskPanelProvider = new TaskPanelProvider(context, indexService);
    taskPanelProvider.setNotesRootUri(nrUri);
    fullModeDisposables.push(
        vscode.window.registerWebviewViewProvider(
            TaskPanelProvider.VIEW_ID,
            taskPanelProvider,
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
    );
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

    // Search panel — wikilink/alias search bar above the tasks view.
    searchPanelProvider = new SearchPanelProvider(context, indexService);
    searchPanelProvider.setNotesRootUri(nrUri);
    fullModeDisposables.push(
        vscode.window.registerWebviewViewProvider(
            SearchPanelProvider.VIEW_ID,
            searchPanelProvider,
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
    );

    // Calendar panel -- month calendar for journal navigation.
    calendarPanelProvider = new CalendarPanelProvider(context);
    calendarPanelProvider.setNotesRootUri(nrUri);
    calendarPanelProvider.setJournalFolder(
        vscode.workspace.getConfiguration('as-notes').get<string>('journalFolder', 'journals'),
    );
    fullModeDisposables.push(
        vscode.window.registerWebviewViewProvider(
            CalendarPanelProvider.VIEW_ID,
            calendarPanelProvider,
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.toggleCalendarPanel', () => {
            vscode.commands.executeCommand('as-notes-calendar.focus');
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.openJournalForDate', (dateStr?: string) => {
            if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                openDailyJournal(nrUri);
                return;
            }
            const [y, m, d] = dateStr.split('-').map(Number);
            openDailyJournal(nrUri, new Date(y, m - 1, d));
        }),
    );

    // Kanban board — sidebar summary + editor panel for full board.
    const kanbanRootUri = vscode.Uri.joinPath(nrUri, 'kanban');
    kanbanStore = new KanbanStore(kanbanRootUri, logService);
    kanbanBoardConfigStore = new KanbanBoardConfigStore(kanbanRootUri, logService);
    kanbanSidebarProvider = new KanbanSidebarProvider(context, kanbanStore, kanbanBoardConfigStore);

    fullModeDisposables.push(
        vscode.window.registerWebviewViewProvider(
            KanbanSidebarProvider.VIEW_ID,
            kanbanSidebarProvider,
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
    );

    // Auto-select first board if available
    const boards = await kanbanBoardConfigStore.listBoards();
    if (boards.length > 0) {
        await kanbanStore.selectBoard(boards[0]);
        await kanbanBoardConfigStore.selectBoard(boards[0]);
    }

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.openKanbanBoard', () => {
            KanbanEditorPanel.createOrShow(context.extensionUri, kanbanStore!, kanbanBoardConfigStore!, logService);
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.newKanbanCard', () => {
            const panel = KanbanEditorPanel.createOrShow(context.extensionUri, kanbanStore!, kanbanBoardConfigStore!, logService);
            panel.triggerCreateModal();
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.switchKanbanBoard', async (slug?: string) => {
            if (!slug) return;
            await kanbanStore!.selectBoard(slug);
            await kanbanBoardConfigStore!.selectBoard(slug);
            KanbanEditorPanel.createOrShow(context.extensionUri, kanbanStore!, kanbanBoardConfigStore!, logService);
            kanbanSidebarProvider?.refresh();
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.selectKanbanBoard', async () => {
            const boardList = await kanbanBoardConfigStore!.listBoards();
            if (boardList.length === 0) {
                const create = await vscode.window.showInformationMessage('No boards found. Create one?', 'Create');
                if (create === 'Create') { vscode.commands.executeCommand('as-notes.createKanbanBoard'); }
                return;
            }
            const pick = await vscode.window.showQuickPick(boardList, { placeHolder: 'Select a board' });
            if (pick) {
                await kanbanStore!.selectBoard(pick);
                await kanbanBoardConfigStore!.selectBoard(pick);
                KanbanEditorPanel.currentPanel?.refresh();
                kanbanSidebarProvider?.refresh();
            }
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.createKanbanBoard', async () => {
            const name = await vscode.window.showInputBox({ prompt: 'Board name', placeHolder: 'My Board' });
            if (!name) return;
            const slug = await kanbanBoardConfigStore!.createBoard(name);
            await kanbanStore!.selectBoard(slug);
            await kanbanBoardConfigStore!.selectBoard(slug);
            KanbanEditorPanel.currentPanel?.refresh();
            kanbanSidebarProvider?.refresh();
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.deleteKanbanBoard', async () => {
            const currentSlug = kanbanStore!.currentBoard;
            if (!currentSlug) { vscode.window.showInformationMessage('No board selected.'); return; }
            const config = kanbanBoardConfigStore!.get();
            const displayName = config.name || currentSlug;
            const confirm = await vscode.window.showWarningMessage(`Delete board "${displayName}" and all its cards?`, { modal: true }, 'Delete');
            if (confirm !== 'Delete') return;
            await kanbanBoardConfigStore!.deleteBoard(currentSlug);
            const remaining = await kanbanBoardConfigStore!.listBoards();
            if (remaining.length > 0) {
                await kanbanStore!.selectBoard(remaining[0]);
                await kanbanBoardConfigStore!.selectBoard(remaining[0]);
            } else {
                await kanbanStore!.selectBoard('');
                kanbanBoardConfigStore!.clear();
            }
            KanbanEditorPanel.currentPanel?.refresh();
            kanbanSidebarProvider?.refresh();
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.renameKanbanBoard', async () => {
            const currentSlug = kanbanStore!.currentBoard;
            if (!currentSlug) { vscode.window.showInformationMessage('No board selected.'); return; }
            const config = kanbanBoardConfigStore!.get();
            const currentName = config.name || currentSlug.replace(/-/g, ' ');
            const newName = await vscode.window.showInputBox({ prompt: 'New board name', value: currentName });
            if (!newName) return;
            const newSlug = await kanbanBoardConfigStore!.renameBoard(currentSlug, newName);
            await kanbanStore!.selectBoard(newSlug);
            await kanbanBoardConfigStore!.selectBoard(newSlug);
            KanbanEditorPanel.currentPanel?.refresh();
            kanbanSidebarProvider?.refresh();
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.convertTaskToKanbanCard', async () => {
            if (!hasProEditor()) {
                vscode.window.showWarningMessage('AS Notes: Convert to Kanban Card requires a Pro licence.');
                return;
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }

            const line = editor.selection.active.line;
            const lineText = editor.document.lineAt(line).text;

            // Must be a task line
            if (!/^\s*-\s+\[[ xX]\]/.test(lineText)) { return; }

            // Reject done tasks
            if (/^\s*-\s+\[[xX]\]/.test(lineText)) {
                vscode.window.showWarningMessage('Cannot convert done tasks to Kanban cards - uncheck to convert');
                return;
            }

            // Ensure a board is selected
            if (!kanbanStore?.currentBoard) {
                vscode.window.showWarningMessage('No Kanban board selected. Please select or create a board first.');
                return;
            }

            // Strip checkbox prefix and parse task metadata
            const taskText = lineText.replace(/^\s*-\s+\[ \]\s*/, '');
            const meta = IndexService.parseTaskMeta(taskText);
            const title = meta.cleanText.trim();
            if (!title) {
                vscode.window.showWarningMessage('Task has no text to create a card from.');
                return;
            }

            const priority = meta.priority !== null ? `p${meta.priority}` as Priority : undefined;
            const dueDate = meta.dueDate ?? undefined;

            // Create card in todo lane with waiting flag
            const card = kanbanStore.createCard(title, 'todo');
            card.priority = priority;
            card.dueDate = dueDate;
            card.waiting = true;

            // Place at end of todo lane
            const todoCards = kanbanStore.getAll()
                .filter((c) => c.lane === 'todo')
                .sort((a, b) => (a.sortOrder ?? Date.parse(a.created)) - (b.sortOrder ?? Date.parse(b.created)));
            const lastOrder = todoCards.length > 0
                ? (todoCards[todoCards.length - 1].sortOrder ?? Date.parse(todoCards[todoCards.length - 1].created))
                : 0;
            card.sortOrder = lastOrder + 1;

            await kanbanStore.save(card);

            // Mark the task line as done
            const doneLine = toggleTodoLine(lineText);
            await editor.edit((editBuilder) => {
                editBuilder.replace(editor.document.lineAt(line).range, doneLine);
            });

            // Refresh kanban panel if open
            KanbanEditorPanel.currentPanel?.refresh();

            vscode.window.showInformationMessage(`Kanban card created: "${title}"`);
        }),
    );

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

    // Refresh task panel now that the index is populated
    taskPanelProvider?.refresh();
    searchPanelProvider?.refresh();

    const fileService = new WikilinkFileService(indexService, nrUri);
    searchPanelProvider?.setFileService(fileService);

    // Document link provider — Ctrl/Cmd+Click navigation (alias-aware tooltips)
    const linkProvider = new WikilinkDocumentLinkProvider(wikilinkService, fileService, indexService);
    fullModeDisposables.push(
        vscode.languages.registerDocumentLinkProvider(markdownSelector, linkProvider),
    );

    // Hover provider — tooltip with target filename, existence, and back-link count
    const hoverProvider = new WikilinkHoverProvider(wikilinkService, fileService, indexService);
    fullModeDisposables.push(
        vscode.languages.registerHoverProvider(markdownSelector, hoverProvider),
    );

    // Rename tracker — backed by index for pre-edit state comparison
    const renameTracker = new WikilinkRenameTracker(
        wikilinkService, fileService, indexService, indexScanner, nrUri,
    );
    fullModeDisposables.push(renameTracker);
    fullModeDisposables.push(
        renameTracker.onDidDeclineRename(() => {
            completionProvider?.refresh();
            taskPanelProvider?.refresh();
            searchPanelProvider?.refresh();
            backlinkPanelProvider?.refresh();
        }),
    );

    // Completion provider — wikilink autocomplete triggered by [[
    completionProvider = new WikilinkCompletionProvider(indexService, logService);
    completionProvider.refresh(); // Warm the cache so first [[ is instant
    fullModeDisposables.push(
        vscode.languages.registerCompletionItemProvider(markdownSelector, completionProvider, '['),
    );

    // Slash command provider — in-editor command menu triggered by /
    fullModeDisposables.push(
        vscode.languages.registerCompletionItemProvider(markdownSelector, new SlashCommandProvider(() => hasProEditor()), '/'),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.openDatePicker', () => openDatePicker()),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.insertTaskDueDate', () => insertTaskDueDate()),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.insertTaskCompletionDate', () => insertTaskCompletionDate()),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.insertTaskHashtag', (tag: string) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            insertTagAtTaskStart(editor, tag);
        }),
    );

    // ── Template command (Pro) ─────────────────────────────────────────

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.insertTemplate', () =>
            insertTemplate(nrUri),
        ),
    );

    // ── Publishing commands ────────────────────────────────────────────

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.togglePublic', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) { toggleFrontMatterField(editor, 'public', true); }
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.cycleLayout', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) { cycleFrontMatterField(editor, 'layout', ['docs', 'blog', 'minimal']); }
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.toggleRetina', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) { toggleFrontMatterField(editor, 'retina', true); }
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.toggleAssets', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) { toggleFrontMatterField(editor, 'assets', true); }
        }),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.publishToHtml', () => publishToHtml(notesRootPaths?.root ?? '')),
    );
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.configurePublish', () => configurePublish(notesRootPaths?.root ?? '')),
    );

    // ── Table commands (Pro) ───────────────────────────────────────────

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.insertTable', async () => {
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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

    // Set context key so the view/keybinding `when` clauses activate
    vscode.commands.executeCommand('setContext', 'as-notes.fullMode', true);

    // Backlink panel
    backlinkPanelProvider = new BacklinkPanelProvider(indexService, nrUri, logService);
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

            const targetUri = fileService.resolveNewFileTargetUri(editor.document.uri, wikilink.pageFileName);
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
            openDailyJournal(nrUri),
        ),
    );

    // Rename legacy YYYY_MM_DD journal files to YYYY-MM-DD
    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.renameJournalFiles', () =>
            renameJournalFiles(nrUri),
        ),
    );

    // ── Encryption commands (Pro) ──────────────────────────────────────

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.setEncryptionKey', async () => {
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            await context.secrets.delete('as-notes.encryptionKey');
            vscode.window.showInformationMessage('AS Notes: Encryption key cleared.');
        }),
    );

    fullModeDisposables.push(
        vscode.commands.registerCommand('as-notes.encryptNotes', async () => {
            if (!hasProEditor()) {
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
            const encPattern = nrUri
                ? new vscode.RelativePattern(nrUri, '**/*.enc.md')
                : '**/*.enc.md';
            const files = await vscode.workspace.findFiles(encPattern);
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
            if (!hasProEditor()) {
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
            const encPattern = nrUri
                ? new vscode.RelativePattern(nrUri, '**/*.enc.md')
                : '**/*.enc.md';
            const files = await vscode.workspace.findFiles(encPattern);
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
        vscode.commands.registerCommand('as-notes.createNote', async () => {
            const title = await vscode.window.showInputBox({
                prompt: 'Note title',
                placeHolder: 'My note',
                ignoreFocusOut: true,
            });
            if (!title) { return; }
            const config = vscode.workspace.getConfiguration('as-notes');
            const notesFolder = config.get<string>('notesFolder', 'notes');
            const normalised = notesFolder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
            const folderUri = normalised
                ? vscode.Uri.joinPath(nrUri, normalised)
                : nrUri;
            await vscode.workspace.fs.createDirectory(folderUri);
            const filename = `${sanitiseFileName(title)}.md`;
            const fileUri = vscode.Uri.joinPath(folderUri, filename);
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
        vscode.commands.registerCommand('as-notes.createEncryptedFile', async () => {
            if (!hasProEditor()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            const title = await vscode.window.showInputBox({
                prompt: 'Note title',
                placeHolder: 'My encrypted note',
                ignoreFocusOut: true,
            });
            if (!title) { return; }
            const config = vscode.workspace.getConfiguration('as-notes');
            const notesFolder = config.get<string>('notesFolder', 'notes');
            const normalised = notesFolder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
            const folderUri = normalised
                ? vscode.Uri.joinPath(nrUri, normalised)
                : nrUri;
            await vscode.workspace.fs.createDirectory(folderUri);
            const filename = `${sanitiseFileName(title)}.enc.md`;
            const fileUri = vscode.Uri.joinPath(folderUri, filename);
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
            if (!hasProEditor()) {
                vscode.window.showWarningMessage('AS Notes: Encryption commands require a Pro licence.');
                return;
            }
            const config = vscode.workspace.getConfiguration('as-notes');
            const journalFolder = config.get<string>('journalFolder', 'journals');
            const paths = computeJournalPaths(
                nrp.rootUri,
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
            if (!hasProEditor()) {
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
            if (!hasProEditor()) {
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
            if (!notesRootUri) { return; }
            const fileUri = vscode.Uri.joinPath(notesRootUri, pagePath);
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
            // Re-resolve the creation target using current settings so that the
            // correct notes folder is used even if the link provider cached a
            // stale URI (e.g. when the document was first opened).
            const creationUri = fileService.resolveNewFileTargetUri(sourceUri, args.pageFileName);
            await fileService.navigateToFile(creationUri, args.pageFileName, sourceUri);
        }),
    );

    // ── Index update triggers ──────────────────────────────────────────

    // On save: re-index the saved file
    fullModeDisposables.push(
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (!isMarkdown(doc)) { return; }
            if (nrp && !isInsideNotesRoot(nrp.root, doc.uri.fsPath)) { return; }
            try {
                await indexScanner!.indexFile(doc.uri);
                if (!safeSaveToFile()) { return; }
                completionProvider?.refresh();
                taskPanelProvider?.refresh();
                searchPanelProvider?.refresh();
                backlinkPanelProvider?.refresh();
            } catch (err) {
                console.warn('as-notes: failed to index on save:', err);
            }
        }),
    );

    // On text change: debounced re-index of the live buffer so that newly
    // typed wikilinks (forward references) can appear in autocomplete without
    // requiring a save or editor switch.
    //
    // To keep this cheap, the completion cache is only refreshed when the
    // current document contains a newly added complete wikilink compared to
    // the page's last indexed link set.
    fullModeDisposables.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (!isMarkdown(e.document)) { return; }
            if (nrp && !isInsideNotesRoot(nrp.root, e.document.uri.fsPath)) { return; }
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
                const relativePath = notesRootPaths
                    ? toNotesRelativePath(notesRootPaths.root, doc.uri.fsPath)
                    : vscode.workspace.asRelativePath(doc.uri, false);
                const filename = path.basename(doc.uri.fsPath);
                const page = indexService!.getPageByPath(relativePath);
                const indexedLinks = page ? indexService!.getLinksForPage(page.id) : [];
                const lines: string[] = [];
                for (let i = 0; i < doc.lineCount; i++) {
                    lines.push(doc.lineAt(i).text);
                }
                const refreshCompletion = hasNewCompleteWikilink(lines, indexedLinks, wikilinkService);

                indexService!.indexFileContent(relativePath, filename, doc.getText(), Date.now());
                if (refreshCompletion) {
                    completionProvider?.refresh();
                }
                taskPanelProvider?.refresh();
                searchPanelProvider?.refresh();
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
            if (nrp && !isInsideNotesRoot(nrp.root, e.document.uri.fsPath)) { return; }
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
                if (isMarkdownUri(fileUri) && (!nrp || isInsideNotesRoot(nrp.root, fileUri.fsPath))) {
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
            searchPanelProvider?.refresh();
            backlinkPanelProvider?.refresh();
            calendarPanelProvider?.refresh();
        }),
    );

    // On file delete
    fullModeDisposables.push(
        vscode.workspace.onDidDeleteFiles(async (e) => {
            let hasFolderDelete = false;
            for (const fileUri of e.files) {
                if (isMarkdownUri(fileUri) && (!nrp || isInsideNotesRoot(nrp.root, fileUri.fsPath))) {
                    const relativePath = notesRootPaths
                        ? toNotesRelativePath(notesRootPaths.root, fileUri.fsPath)
                        : vscode.workspace.asRelativePath(fileUri, false);
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
            searchPanelProvider?.refresh();
            backlinkPanelProvider?.refresh();
            calendarPanelProvider?.refresh();
        }),
    );

    // On file rename
    fullModeDisposables.push(
        vscode.workspace.onDidRenameFiles(async (e) => {
            let hasFolderRename = false;
            for (const { oldUri, newUri } of e.files) {
                if (isMarkdownUri(oldUri) && (!nrp || isInsideNotesRoot(nrp.root, oldUri.fsPath))) {
                    const oldPath = notesRootPaths
                        ? toNotesRelativePath(notesRootPaths.root, oldUri.fsPath)
                        : vscode.workspace.asRelativePath(oldUri, false);
                    indexService!.removePage(oldPath);
                } else {
                    // A folder was renamed/moved — individual file URIs are not surfaced.
                    hasFolderRename = true;
                }
                if (isMarkdownUri(newUri) && (!nrp || isInsideNotesRoot(nrp.root, newUri.fsPath))) {
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
            searchPanelProvider?.refresh();
            backlinkPanelProvider?.refresh();
            calendarPanelProvider?.refresh();

            await handleExplorerRenameRefactors({
                files: e.files,
                renameTrackerIsRenaming: renameTracker.isRenaming,
                wikilinkService,
                indexService: indexService!,
                indexScanner: indexScanner!,
                notesRootPath: notesRootPaths?.root,
                safeSaveToFile,
                refreshProviders: () => {
                    completionProvider?.refresh();
                    taskPanelProvider?.refresh();
                    searchPanelProvider?.refresh();
                    backlinkPanelProvider?.refresh();
                },
            });
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

            if (uriToReindex && isMarkdownUri(uriToReindex) && (!nrp || isInsideNotesRoot(nrp.root, uriToReindex.fsPath))) {
                // Defer off the UI thread so the new editor paints first.
                setTimeout(async () => {
                    try {
                        const doc = vscode.workspace.textDocuments.find(
                            d => d.uri.toString() === uriToReindex.toString(),
                        );
                        if (doc) {
                            const relativePath = notesRootPaths
                                ? toNotesRelativePath(notesRootPaths.root, doc.uri.fsPath)
                                : vscode.workspace.asRelativePath(doc.uri, false);
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
                        searchPanelProvider?.refresh();
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
        new vscode.RelativePattern(nrUri, IGNORE_FILE),
    );
    const onIgnoreFileChange = (): void => {
        ignoreService?.reload();
        indexScanner?.staleScan().then((summary) => {
            if (summary.newFiles > 0 || summary.staleFiles > 0 || summary.deletedFiles > 0) {
                indexService?.saveToFile();
                completionProvider?.refresh();
                taskPanelProvider?.refresh();
                searchPanelProvider?.refresh();
                backlinkPanelProvider?.refresh();
                calendarPanelProvider?.refresh();
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
            if (e.affectsConfiguration('as-notes.rootDirectory')) {
                vscode.window.showWarningMessage(
                    'AS Notes: The root directory setting has changed. Reload the window to apply the new root.',
                    'Reload Window',
                ).then(action => {
                    if (action === 'Reload Window') {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                });
            }
        }),
    );

    // Inline editor (Typora-like syntax shadowing)
    inlineEditorManager = new InlineEditorManager(
        context,
        markdownSelector,
        nrp?.root,
        ignoreService ? (rel) => ignoreService!.isIgnored(rel) : undefined,
        () => hasProEditor(),
    );
    fullModeDisposables.push(inlineEditorManager);

    // Apply licence gate now that the manager exists and licenceState may
    // already be populated (verifyLicenceFromSettings can resolve before
    // enterFullMode completes).
    inlineEditorManager.refreshLicenceGate();

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
    let proLabel = '';
    if (hasProEditor()) {
        proLabel = licenceState.product === 'pro_ai_sync' ? ' (Pro AI & Sync)' : ' (Pro Editor)';
    }
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
    searchPanelProvider = undefined;
    backlinkPanelProvider = undefined;
    inlineEditorManager = undefined;
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
    if (!notesRootPaths) { return false; }
    if (!fs.existsSync(notesRootPaths.asnotesDir)) {
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

    // Check if already initialised at the configured (or default) root
    const currentRootDir = vscode.workspace.getConfiguration('as-notes').get<string>('rootDirectory', '');
    const currentNrp = computeNotesRootPaths(workspaceRoot.fsPath, currentRootDir);
    if (fs.existsSync(currentNrp.asnotesDir)) {
        vscode.window.showInformationMessage('AS Notes: Workspace is already initialised.');
        if (!indexService?.isOpen) {
            await enterFullMode(context, workspaceRoot);
        }
        return;
    }

    // Directory picker: let the user choose where to place the notes root
    const WORKSPACE_ROOT_LABEL = '$(folder) Workspace root';
    const CHOOSE_SUBFOLDER_LABEL = '$(folder-opened) Choose a subfolder...';
    const pick = await vscode.window.showQuickPick(
        [
            { label: WORKSPACE_ROOT_LABEL, description: workspaceRoot.fsPath },
            { label: CHOOSE_SUBFOLDER_LABEL, description: 'Select an existing subfolder as the notes root' },
        ],
        { placeHolder: 'Where should AS Notes store its data?' },
    );
    if (!pick) { return; }

    let chosenRootDir = '';
    if (pick.label === CHOOSE_SUBFOLDER_LABEL) {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: workspaceRoot,
            openLabel: 'Select Notes Root',
        });
        if (!folders || folders.length === 0) { return; }
        const chosen = folders[0];
        // Ensure chosen folder is inside the workspace root
        const chosenNorm = chosen.fsPath.replace(/\\/g, '/').toLowerCase();
        const wsNorm = workspaceRoot.fsPath.replace(/\\/g, '/').toLowerCase();
        if (!chosenNorm.startsWith(wsNorm + '/') && chosenNorm !== wsNorm) {
            vscode.window.showErrorMessage('AS Notes: The selected folder must be inside the workspace root.');
            return;
        }
        if (chosenNorm !== wsNorm) {
            chosenRootDir = chosen.fsPath.replace(/\\/g, '/').slice(wsNorm.length + 1);
        }
    }

    // Save rootDirectory setting if a subfolder was chosen
    if (chosenRootDir) {
        await vscode.workspace.getConfiguration('as-notes').update('rootDirectory', chosenRootDir, vscode.ConfigurationTarget.Workspace);
    }

    // Compute paths for the chosen root
    const nrp = computeNotesRootPaths(workspaceRoot.fsPath, chosenRootDir);
    const nrUri = vscode.Uri.file(nrp.root);
    notesRootPaths = nrp;
    notesRootUri = nrUri;

    // Create .asnotes/ directory
    fs.mkdirSync(nrp.asnotesDir, { recursive: true });

    // Create kanban/ directory for Kanban boards
    fs.mkdirSync(path.join(nrp.root, 'kanban'), { recursive: true });

    // Create templates/ directory with default Journal.md template
    const templateConfig = vscode.workspace.getConfiguration('as-notes');
    const templateFolder = templateConfig.get<string>('templateFolder', 'templates');
    const templateFolderPath = computeTemplateFolderPath(nrp.rootUri, templateFolder);
    fs.mkdirSync(templateFolderPath, { recursive: true });
    const journalTemplatePath = `${templateFolderPath}/${JOURNAL_TEMPLATE_FILENAME}`;
    if (!fs.existsSync(journalTemplatePath)) {
        fs.writeFileSync(journalTemplatePath, DEFAULT_JOURNAL_TEMPLATE, 'utf-8');
    }

    // Create notes/ directory for new notes
    const notesFolder = templateConfig.get<string>('notesFolder', 'notes');
    const normalisedNotes = notesFolder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
    if (normalisedNotes) {
        const notesFolderPath = path.join(nrp.root, normalisedNotes);
        fs.mkdirSync(notesFolderPath, { recursive: true });
    }

    // Create .gitignore inside .asnotes/ to exclude the DB file
    fs.writeFileSync(path.join(nrp.asnotesDir, '.gitignore'), 'index.db\n');

    // Create .asnotesignore at notes root if it doesn't already exist.
    ensureIgnoreFile(nrp.root);

    // Install git pre-commit hook to guard against committing unencrypted .enc.md files
    ensurePreCommitHook(workspaceRoot.fsPath);

    // Configure the built-in markdown copy-files destination before entering full mode
    await applyAssetPathSettings();

    // Create LogService early so the initial full scan is instrumented
    const config = vscode.workspace.getConfiguration('as-notes');
    const loggingEnabled = config.get<boolean>('enableLogging', false)
        || process.env.AS_NOTES_DEBUG === '1';
    logService = new LogService(nrp.logDir, { enabled: loggingEnabled });
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
            logService.info('extension', 'initWorkspace: initialising database');
            indexService = new IndexService(nrp.databasePath, logService);
            await indexService.initDatabase();

            const initIgnoreService = new IgnoreService(nrp.ignoreFilePath);
            indexScanner = new IndexScanner(indexService, nrUri, initIgnoreService, logService);

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
    if (root && notesRootPaths) {
        ensurePreCommitHook(root.fsPath);
        ensureIgnoreFile(notesRootPaths.root);
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
                searchPanelProvider?.refresh();
                backlinkPanelProvider?.refresh();
                calendarPanelProvider?.refresh();

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

    const asnotesDir = notesRootPaths?.asnotesDir ?? path.join(workspaceRoot.fsPath, ASNOTES_DIR);
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

// ── Templates ──────────────────────────────────────────────────────────────

/**
 * Read the content of a template file from the templates directory.
 * If the file does not exist and a default is provided, create it with that content.
 * Returns the template content string, or undefined if not found and no default.
 */
async function readTemplateFile(
    templateFolderPath: string,
    filename: string,
    defaultContent?: string,
): Promise<string | undefined> {
    const filePath = `${templateFolderPath}/${filename}`;
    const fileUri = vscode.Uri.file(filePath);
    try {
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        return Buffer.from(bytes).toString('utf-8');
    } catch {
        if (defaultContent !== undefined) {
            const folderUri = vscode.Uri.file(templateFolderPath);
            await vscode.workspace.fs.createDirectory(folderUri);
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(defaultContent, 'utf-8'));
            return defaultContent;
        }
        return undefined;
    }
}

/**
 * Recursively discover all .md files under a directory.
 * Returns relative paths from the base directory (e.g. "meeting/standup.md").
 */
async function discoverTemplates(basePath: string): Promise<string[]> {
    const baseUri = vscode.Uri.file(basePath);
    const results: string[] = [];

    async function walk(dirUri: vscode.Uri, prefix: string): Promise<void> {
        let entries: [string, vscode.FileType][];
        try {
            entries = await vscode.workspace.fs.readDirectory(dirUri);
        } catch {
            return; // Directory doesn't exist or not readable
        }
        for (const [name, type] of entries) {
            if (type === vscode.FileType.Directory) {
                const childUri = vscode.Uri.joinPath(dirUri, name);
                await walk(childUri, prefix ? `${prefix}/${name}` : name);
            } else if (type === vscode.FileType.File && name.endsWith('.md')) {
                results.push(prefix ? `${prefix}/${name}` : name);
            }
        }
    }

    await walk(baseUri, '');
    return results.sort();
}

async function insertTemplate(notesRoot: vscode.Uri): Promise<void> {
    if (!hasProEditor()) {
        vscode.window.showWarningMessage('AS Notes: Templates require a Pro licence.');
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('AS Notes: Open a file to insert a template.');
        return;
    }

    const config = vscode.workspace.getConfiguration('as-notes');
    const templateFolder = config.get<string>('templateFolder', 'templates');
    const templateFolderPath = computeTemplateFolderPath(
        notesRoot.fsPath.replace(/\\/g, '/'),
        templateFolder,
    );

    const templates = await discoverTemplates(templateFolderPath);
    if (templates.length === 0) {
        vscode.window.showInformationMessage(
            `AS Notes: Create templates under ${templateFolder}/ to use this command.`,
        );
        return;
    }

    // Show QuickPick with template names (without .md extension)
    const items = templates.map((t) => ({
        label: t.replace(/\.md$/, ''),
        file: t,
    }));

    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a template to insert',
    });
    if (!pick) { return; }

    // Read the selected template
    const templateUri = vscode.Uri.file(`${templateFolderPath}/${pick.file}`);
    let templateContent: string;
    try {
        const bytes = await vscode.workspace.fs.readFile(templateUri);
        templateContent = Buffer.from(bytes).toString('utf-8');
    } catch {
        vscode.window.showErrorMessage(`AS Notes: Could not read template file: ${pick.file}`);
        return;
    }

    // Build template context
    const currentFilename = path.basename(editor.document.fileName, path.extname(editor.document.fileName));
    const ctx: TemplateContext = {
        now: new Date(),
        filename: currentFilename,
    };

    const processed = applyTemplatePlaceholders(templateContent, ctx);

    // If the template contains a cursor placeholder, use a snippet for cursor positioning
    if (processed.includes(CURSOR_SENTINEL)) {
        const snippetText = processed
            .replace(/\$/g, '\\$')  // Escape existing $ signs for snippet syntax
            .replace(CURSOR_SENTINEL, '$0');
        await editor.insertSnippet(new vscode.SnippetString(snippetText));
    } else {
        await editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, processed);
        });
    }
}

// ── Daily journal ──────────────────────────────────────────────────────────

async function openDailyJournal(notesRoot: vscode.Uri, date?: Date): Promise<void> {
    const config = vscode.workspace.getConfiguration('as-notes');
    const journalFolder = config.get<string>('journalFolder', 'journals');
    const templateFolder = config.get<string>('templateFolder', 'templates');

    const paths = computeJournalPaths(
        notesRoot.fsPath.replace(/\\/g, '/'),
        journalFolder,
        date ?? new Date(),
    );

    const journalUri = vscode.Uri.file(paths.journalFilePath);

    // If journal file already exists, just open it
    try {
        await vscode.workspace.fs.stat(journalUri);
        const doc = await vscode.workspace.openTextDocument(journalUri);
        await vscode.window.showTextDocument(doc);
        return;
    } catch {
        // File does not exist -- proceed with creation
    }

    // Ensure the journal folder exists
    const folderUri = vscode.Uri.file(paths.journalFolderPath);
    await vscode.workspace.fs.createDirectory(folderUri);

    // Read Journal.md from the templates directory (create with default if missing)
    const templateFolderPath = computeTemplateFolderPath(
        notesRoot.fsPath.replace(/\\/g, '/'),
        templateFolder,
    );
    const templateContent = await readTemplateFile(
        templateFolderPath,
        JOURNAL_TEMPLATE_FILENAME,
        DEFAULT_JOURNAL_TEMPLATE,
    );

    // Build context -- filename is the journal date filename without extension
    const journalFilenameNoExt = path.basename(paths.journalFilePath, '.md');
    const ctx: TemplateContext = {
        now: new Date(),
        filename: journalFilenameNoExt,
    };

    // Apply placeholders and strip the cursor sentinel (not useful for auto-created files)
    const content = applyTemplatePlaceholders(templateContent!, ctx).replace(CURSOR_SENTINEL, '');
    await vscode.workspace.fs.writeFile(journalUri, Buffer.from(content, 'utf-8'));

    // Index the new file immediately
    try {
        await indexScanner!.indexFile(journalUri);
        safeSaveToFile();
        completionProvider?.refresh();
        taskPanelProvider?.refresh();
        searchPanelProvider?.refresh();
        backlinkPanelProvider?.refresh();
        calendarPanelProvider?.refresh();

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

/**
 * Rename legacy YYYY_MM_DD.md journal files to YYYY-MM-DD.md format.
 * Scans the configured journal folder and renames matching files,
 * then triggers a full index rebuild.
 */
async function renameJournalFiles(notesRoot: vscode.Uri): Promise<void> {
    const config = vscode.workspace.getConfiguration('as-notes');
    const journalFolder = config.get<string>('journalFolder', 'journals');
    const normalised = normaliseJournalFolder(journalFolder);
    const base = normalised
        ? `${notesRoot.fsPath.replace(/\\/g, '/')}/${normalised}`
        : notesRoot.fsPath.replace(/\\/g, '/');

    const folderUri = vscode.Uri.file(base);

    // Check the folder exists
    try {
        await vscode.workspace.fs.stat(folderUri);
    } catch {
        vscode.window.showInformationMessage('AS Notes: Journal folder does not exist. Nothing to rename.');
        return;
    }

    // Scan for underscore-format files
    const pattern = /^\d{4}_\d{2}_\d{2}\.md$/;
    const entries = await vscode.workspace.fs.readDirectory(folderUri);
    const toRename = entries
        .filter(([name, type]) => type === vscode.FileType.File && pattern.test(name))
        .map(([name]) => name);

    if (toRename.length === 0) {
        vscode.window.showInformationMessage('AS Notes: No YYYY_MM_DD.md journal files found. Nothing to rename.');
        return;
    }

    // Modal confirmation
    const answer = await vscode.window.showWarningMessage(
        `AS Notes: This will rename ${toRename.length} journal file(s) from YYYY_MM_DD.md to YYYY-MM-DD.md format. This cannot be undone. Continue?`,
        { modal: true },
        'Rename Files',
    );
    if (answer !== 'Rename Files') { return; }

    let renamed = 0;
    let errors = 0;

    for (const oldName of toRename) {
        const newName = oldName.replace(/_/g, '-');
        const oldUri = vscode.Uri.joinPath(folderUri, oldName);
        const newUri = vscode.Uri.joinPath(folderUri, newName);
        try {
            await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false });
            renamed++;
        } catch (err) {
            console.warn(`as-notes: failed to rename ${oldName} to ${newName}:`, err);
            errors++;
        }
    }

    const errMsg = errors > 0 ? ` ${errors} error(s).` : '';
    vscode.window.showInformationMessage(
        `AS Notes: Renamed ${renamed} journal file(s).${errMsg}`,
    );

    // Rebuild index so wikilinks and backlinks reflect the new filenames
    if (renamed > 0) {
        await vscode.commands.executeCommand('as-notes.rebuildIndex');
    }
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
            }
            if (notesRootPaths) {
                ensureIgnoreFile(notesRootPaths.root);
                ignoreService?.reload();
            }

            const summary = await indexScanner.staleScan();
            if (summary.newFiles > 0 || summary.staleFiles > 0 || summary.deletedFiles > 0) {
                if (!safeSaveToFile()) { return; }
                completionProvider?.refresh();
                taskPanelProvider?.refresh();
                searchPanelProvider?.refresh();
                backlinkPanelProvider?.refresh();
                calendarPanelProvider?.refresh();
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
function ensureIgnoreFile(notesRootFsPath: string): void {
    const ignoreFilePath = path.join(notesRootFsPath, IGNORE_FILE);
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
        return notesRootPaths
            ? toNotesRelativePath(notesRootPaths.root, (doc as vscode.Uri).fsPath)
            : vscode.workspace.asRelativePath(doc as vscode.Uri, false);
    }

    // URI string fallback
    if (typeof doc === 'string') {
        try {
            const parsed = vscode.Uri.parse(doc);
            return notesRootPaths
                ? toNotesRelativePath(notesRootPaths.root, parsed.fsPath)
                : vscode.workspace.asRelativePath(parsed, false);
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
