/**
 * Tests for WikilinkRenameTracker — focused on the `hasPendingEdit` guard
 * that prevents the completion debounce from overwriting the rename baseline.
 *
 * Because WikilinkRenameTracker depends on the VS Code API, the `vscode` module
 * is stubbed via vi.mock so the constructor's event-listener registrations succeed
 * without a real VS Code extension host.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal vscode stub ───────────────────────────────────────────────────────

vi.mock('vscode', () => {
    const disposable = { dispose: vi.fn() };
    // Minimal EventEmitter stub matching the VS Code API surface
    class EventEmitter<T> {
        private listeners: ((e: T) => void)[] = [];
        event = (listener: (e: T) => void) => {
            this.listeners.push(listener);
            return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
        };
        fire(data: T) { for (const l of this.listeners) { l(data); } }
        dispose() { this.listeners = []; }
    }
    return {
        EventEmitter,
        Uri: {
            joinPath: vi.fn((...args: unknown[]) => args),
        },
        Range: class { constructor(public sl: number, public sc: number, public el: number, public ec: number) { } },
        WorkspaceEdit: class { replace() { } },
        workspace: {
            onDidChangeTextDocument: vi.fn(() => disposable),
            asRelativePath: vi.fn((uri: { fsPath?: string; toString(): string }) =>
                typeof uri === 'string' ? uri : uri.fsPath ?? uri.toString(),
            ),
            findFiles: vi.fn().mockResolvedValue([]),
            fs: {
                rename: vi.fn().mockResolvedValue(undefined),
                delete: vi.fn().mockResolvedValue(undefined),
            },
            applyEdit: vi.fn().mockResolvedValue(true),
            openTextDocument: vi.fn().mockResolvedValue({ getText: () => '', lineCount: 0, lineAt: () => ({ text: '' }) }),
            textDocuments: [],
        },
        window: {
            onDidChangeActiveTextEditor: vi.fn(() => disposable),
            onDidChangeTextEditorSelection: vi.fn(() => disposable),
            activeTextEditor: undefined,
            showInformationMessage: vi.fn().mockResolvedValue('No'),
            showWarningMessage: vi.fn(),
            showErrorMessage: vi.fn(),
        },
    };
});

import { WikilinkRenameTracker } from '../WikilinkRenameTracker.js';
import { WikilinkService } from 'as-notes-common';
import * as vscode from 'vscode';

// ── Minimal dependency stubs ──────────────────────────────────────────────────

function makeTracker(): WikilinkRenameTracker {
    const wikilinkService = new WikilinkService();
    const fileService = {} as never;
    const indexService = { isOpen: true, getPageByPath: vi.fn() } as never;
    const indexScanner = {} as never;
    return new WikilinkRenameTracker(wikilinkService, fileService, indexService, indexScanner);
}

// ── hasPendingEdit ────────────────────────────────────────────────────────────

describe('WikilinkRenameTracker — hasPendingEdit', () => {
    let tracker: WikilinkRenameTracker;

    beforeEach(() => {
        tracker = makeTracker();
    });

    it('returns false when no pending edit is set', () => {
        expect(tracker.hasPendingEdit('file:///some/doc.md')).toBe(false);
    });

    it('returns false for a different doc key when a pending edit is set', () => {
        const docKey = 'file:///notes/page.md';

        // Inject a pending edit via the internal property (white-box, intentional)
        (tracker as unknown as { pendingEdit: { docKey: string; line: number; wikilinkStartPos: number } })
            .pendingEdit = { docKey, line: 0, wikilinkStartPos: 0 };

        expect(tracker.hasPendingEdit('file:///notes/other.md')).toBe(false);
    });

    it('returns true for the exact doc key that has a pending edit', () => {
        const docKey = 'file:///notes/page.md';

        (tracker as unknown as { pendingEdit: { docKey: string; line: number; wikilinkStartPos: number } })
            .pendingEdit = { docKey, line: 3, wikilinkStartPos: 5 };

        expect(tracker.hasPendingEdit(docKey)).toBe(true);
    });

    it('returns false after the pending edit has been cleared', () => {
        const docKey = 'file:///notes/page.md';

        (tracker as unknown as { pendingEdit: { docKey: string; line: number; wikilinkStartPos: number } | undefined })
            .pendingEdit = { docKey, line: 0, wikilinkStartPos: 0 };

        expect(tracker.hasPendingEdit(docKey)).toBe(true);

        (tracker as unknown as { pendingEdit: undefined }).pendingEdit = undefined;

        expect(tracker.hasPendingEdit(docKey)).toBe(false);
    });
});

// ── Guard behaviour: index must not be overwritten while pendingEdit is active ─

describe('WikilinkRenameTracker — debounce guard integration', () => {
    it('hasPendingEdit correctly reflects the state that the extension.ts guard checks', () => {
        // This test verifies the contract relied upon by the debounce guard in extension.ts:
        //
        //   if (renameTracker.hasPendingEdit(doc.uri.toString())) { return; }
        //
        // When hasPendingEdit returns true, the guard skips indexFileContent so the
        // stale-baseline used by checkForRenames remains intact.

        const tracker = makeTracker();
        const docKey = 'file:///vault/My%20Page.md';

        // No edit yet — debounce should proceed
        expect(tracker.hasPendingEdit(docKey)).toBe(false);

        // Simulate the rename tracker recording a pending edit (as onDocumentChanged would)
        (tracker as unknown as { pendingEdit: { docKey: string; line: number; wikilinkStartPos: number } })
            .pendingEdit = { docKey, line: 2, wikilinkStartPos: 4 };

        // Debounce guard fires — hasPendingEdit must return true so the re-index is skipped
        expect(tracker.hasPendingEdit(docKey)).toBe(true);

        // After rename check clears pendingEdit — debounce guard allows re-index again
        (tracker as unknown as { pendingEdit: undefined }).pendingEdit = undefined;
        expect(tracker.hasPendingEdit(docKey)).toBe(false);
    });
});

// ── isNestingChange ───────────────────────────────────────────────────────────

describe('WikilinkRenameTracker.isNestingChange', () => {
    const { isNestingChange } = WikilinkRenameTracker;

    // ── Should detect nesting (skip rename) ───────────────────────────

    it('detects nesting: [[A]] wrapped to [[[[A]] B]]', () => {
        expect(isNestingChange('A', '[[A]] B')).toBe(true);
    });

    it('detects wrapping: [[A]] to [[[[A]]]]', () => {
        expect(isNestingChange('A', '[[A]]')).toBe(true);
    });

    it('detects un-nesting: [[[[A]] B]] to [[A]]', () => {
        expect(isNestingChange('[[A]] B', 'A')).toBe(true);
    });

    it('detects nesting with longer page names', () => {
        expect(isNestingChange('Project Name', '[[Project Name]] Test Evidences')).toBe(true);
    });

    it('detects un-nesting with longer page names', () => {
        expect(isNestingChange('[[Project Name]] Test Evidences', 'Project Name')).toBe(true);
    });

    // ── Partial bracket manipulation (mid-edit) ───────────────────────

    it('detects partial nesting: pageName "Demo" vs "[Demo" (from [[[Demo]])', () => {
        expect(isNestingChange('Demo', '[Demo')).toBe(true);
    });

    it('detects partial nesting: pageName "Demo" vs "[Demo]" (from [[[Demo]]])', () => {
        expect(isNestingChange('Demo', '[Demo]')).toBe(true);
    });

    it('detects partial un-nesting: pageName "[Demo" vs "Demo"', () => {
        expect(isNestingChange('[Demo', 'Demo')).toBe(true);
    });

    it('detects partial nesting with trailing brackets: "Demo]" vs "Demo"', () => {
        expect(isNestingChange('Demo]', 'Demo')).toBe(true);
    });

    // ── Should not detect nesting (allow rename) ──────────────────────

    it('allows simple rename: [[A]] to [[B]]', () => {
        expect(isNestingChange('A', 'B')).toBe(false);
    });

    it('allows inner rename: [[X [[A]] Y]] to [[X [[B]] Y]]', () => {
        expect(isNestingChange('X [[A]] Y', 'X [[B]] Y')).toBe(false);
    });

    it('allows outer rename: [[X [[A]] Y]] to [[Z [[A]] Y]]', () => {
        expect(isNestingChange('X [[A]] Y', 'Z [[A]] Y')).toBe(false);
    });

    it('allows rename when page names are substrings but not bracketed', () => {
        // "AB" contains "A" but not "[[A]]"
        expect(isNestingChange('A', 'AB')).toBe(false);
    });

    it('allows rename of identical-length names', () => {
        expect(isNestingChange('Foo', 'Bar')).toBe(false);
    });
});

// ── Parser output for intermediate nesting states ─────────────────────────────

describe('extractWikilinks — nesting intermediate states', () => {
    const ws = new WikilinkService();

    it('[[[Demo]] produces wikilink at pos 0 with pageName "[Demo"', () => {
        const wls = ws.extractWikilinks('[[[Demo]]');
        const atPos0 = wls.find(w => w.startPositionInText === 0);
        expect(atPos0).toBeDefined();
        expect(atPos0!.pageName).toBe('[Demo');
    });

    it('[[[[Demo]]]] produces inner Demo at pos 2 and outer [[Demo]] at pos 0', () => {
        const wls = ws.extractWikilinks('[[[[Demo]]]]');
        const inner = wls.find(w => w.startPositionInText === 2);
        const outer = wls.find(w => w.startPositionInText === 0);
        expect(inner).toBeDefined();
        expect(inner!.pageName).toBe('Demo');
        expect(outer).toBeDefined();
        expect(outer!.pageName).toBe('[[Demo]]');
    });

    it('[[[[Demo]] Test]] produces inner Demo at pos 2 and outer at pos 0', () => {
        const wls = ws.extractWikilinks('[[[[Demo]] Test]]');
        const inner = wls.find(w => w.startPositionInText === 2);
        const outer = wls.find(w => w.startPositionInText === 0);
        expect(inner).toBeDefined();
        expect(inner!.pageName).toBe('Demo');
        expect(outer).toBeDefined();
        expect(outer!.pageName).toBe('[[Demo]] Test');
    });
});

// ── promptAndPerformRenames — rename directory & decline re-index ──────────────

describe('WikilinkRenameTracker — promptAndPerformRenames', () => {
    function makeMocks() {
        const oldUri = { fsPath: '/notes/sub/OldName.md', toString: () => 'file:///notes/sub/OldName.md' };
        const newUri = { fsPath: '/notes/sub/NewName.md', toString: () => 'file:///notes/sub/NewName.md' };
        const documentUri = { fsPath: '/notes/referencing.md', toString: () => 'file:///notes/referencing.md' };
        const document = {
            uri: documentUri,
            getText: vi.fn(() => '[[NewName]]'),
            lineCount: 1,
            lineAt: vi.fn(() => ({ text: '[[NewName]]' })),
        };

        const resolveTargetUri = vi.fn().mockReturnValue(newUri);
        const resolveTargetUriCaseInsensitive = vi.fn().mockImplementation(async (_uri: unknown, pageFileName: string) => {
            if (pageFileName === 'OldName') {
                return { uri: oldUri, viaAlias: false };
            }
            return { uri: newUri, viaAlias: false };
        });
        // Old file exists, new file does not (standard rename, not merge)
        const fileExists = vi.fn().mockImplementation(async (uri: unknown) => {
            const uriStr = (uri as { toString(): string }).toString();
            return uriStr.includes('OldName');
        });

        const fileService = {
            resolveTargetUri,
            resolveTargetUriCaseInsensitive,
            fileExists,
            resolveNewFileTargetUri: vi.fn(),
        };

        const indexFileContent = vi.fn();
        const indexService = {
            isOpen: true,
            getPageByPath: vi.fn().mockReturnValue({ id: 1 }),
            getLinksForPage: vi.fn().mockReturnValue([]),
            resolveAlias: vi.fn().mockReturnValue(undefined),
            indexFileContent,
            updateRename: vi.fn(),
            saveToFile: vi.fn(),
            removePage: vi.fn(),
            getPageById: vi.fn().mockReturnValue(undefined),
            updateAliasRename: vi.fn(),
        };

        const indexScanner = {
            indexFile: vi.fn().mockResolvedValue(undefined),
        };

        const wikilinkService = new WikilinkService();
        const tracker = new WikilinkRenameTracker(
            wikilinkService,
            fileService as never,
            indexService as never,
            indexScanner as never,
        );

        return { tracker, document, fileService, indexService, indexScanner, oldUri, newUri, documentUri };
    }

    it('resolves newUri from the old file location, not the referencing document', async () => {
        const { tracker, document, fileService, oldUri } = makeMocks();

        // User clicks Yes to rename
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        const renames = [{
            oldPageName: 'OldName',
            newPageName: 'NewName',
            line: 0,
            startPosition: 0,
            endPosition: 11,
        }];

        // Call the private method directly
        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        // resolveTargetUri should have been called with the OLD file's URI,
        // not the referencing document's URI
        expect(fileService.resolveTargetUri).toHaveBeenCalledWith(oldUri, 'NewName');
    });

    it('re-indexes the document when the user declines the rename', async () => {
        const { tracker, document, indexService } = makeMocks();

        // User clicks No
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('No' as never);

        const renames = [{
            oldPageName: 'OldName',
            newPageName: 'NewName',
            line: 0,
            startPosition: 0,
            endPosition: 11,
        }];

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'sub/referencing.md');

        // On decline, indexFileContent should be called with buffer text
        expect(indexService.indexFileContent).toHaveBeenCalledWith(
            'sub/referencing.md',
            'referencing.md',
            '[[NewName]]',
            expect.any(Number),
        );
    });

    it('re-indexes the document when the user dismisses the dialog', async () => {
        const { tracker, document, indexService } = makeMocks();

        // User dismisses dialog (returns undefined)
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined as never);

        const renames = [{
            oldPageName: 'OldName',
            newPageName: 'NewName',
            line: 0,
            startPosition: 0,
            endPosition: 11,
        }];

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'notes/page.md');

        // Dismissing is equivalent to declining — should still re-index
        expect(indexService.indexFileContent).toHaveBeenCalledWith(
            'notes/page.md',
            'page.md',
            '[[NewName]]',
            expect.any(Number),
        );
    });

    it('does not re-index when the user accepts the rename', async () => {
        const { tracker, document, indexService } = makeMocks();

        // User clicks Yes
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        const renames = [{
            oldPageName: 'OldName',
            newPageName: 'NewName',
            line: 0,
            startPosition: 0,
            endPosition: 11,
        }];

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        // On accept, the normal rename flow handles indexing — indexFileContent
        // should NOT have been called in the decline path
        expect(indexService.indexFileContent).not.toHaveBeenCalled();
    });

    it('fires onDidDeclineRename when user declines', async () => {
        const { tracker, document } = makeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('No' as never);

        const listener = vi.fn();
        tracker.onDidDeclineRename(listener);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, [{
                oldPageName: 'OldName', newPageName: 'NewName',
                line: 0, startPosition: 0, endPosition: 11,
            }], 'referencing.md');

        expect(listener).toHaveBeenCalledOnce();
    });

    it('fires onDidDeclineRename when user dismisses the dialog', async () => {
        const { tracker, document } = makeMocks();
        // Dismissing returns undefined
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined as never);

        const listener = vi.fn();
        tracker.onDidDeclineRename(listener);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, [{
                oldPageName: 'OldName', newPageName: 'NewName',
                line: 0, startPosition: 0, endPosition: 11,
            }], 'referencing.md');

        expect(listener).toHaveBeenCalledOnce();
    });

    it('does not fire onDidDeclineRename when user accepts', async () => {
        const { tracker, document } = makeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        const listener = vi.fn();
        tracker.onDidDeclineRename(listener);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, [{
                oldPageName: 'OldName', newPageName: 'NewName',
                line: 0, startPosition: 0, endPosition: 11,
            }], 'referencing.md');

        expect(listener).not.toHaveBeenCalled();
    });
});

// ── isRenaming getter ─────────────────────────────────────────────────────────

describe('WikilinkRenameTracker — isRenaming', () => {
    it('returns false when no rename is in progress', () => {
        const wikilinkService = new WikilinkService();
        const tracker = new WikilinkRenameTracker(
            wikilinkService,
            { resolveTargetUri: vi.fn(), resolveTargetUriCaseInsensitive: vi.fn(), fileExists: vi.fn(), resolveNewFileTargetUri: vi.fn() } as never,
            { isOpen: true, getPageByPath: vi.fn(), getLinksForPage: vi.fn(), resolveAlias: vi.fn(), indexFileContent: vi.fn(), updateRename: vi.fn(), saveToFile: vi.fn(), removePage: vi.fn(), getPageById: vi.fn(), updateAliasRename: vi.fn() } as never,
            { indexFile: vi.fn() } as never,
        );
        expect(tracker.isRenaming).toBe(false);
    });
});

// ── Merge on rename to existing page ──────────────────────────────────────────

describe('WikilinkRenameTracker — merge on rename to existing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function makeMergeMocks() {
        const oldUri = { fsPath: '/notes/sub/OldName.md', toString: () => 'file:///notes/sub/OldName.md' };
        const newUri = { fsPath: '/notes/sub/NewName.md', toString: () => 'file:///notes/sub/NewName.md' };
        const documentUri = { fsPath: '/notes/referencing.md', toString: () => 'file:///notes/referencing.md' };
        const document = {
            uri: documentUri,
            getText: vi.fn(() => '[[NewName]]'),
            lineCount: 1,
            lineAt: vi.fn(() => ({ text: '[[NewName]]' })),
        };

        const resolveTargetUri = vi.fn().mockReturnValue(newUri);
        const resolveTargetUriCaseInsensitive = vi.fn().mockImplementation(async (_uri: unknown, pageFileName: string) => {
            if (pageFileName === 'OldName') {
                return { uri: oldUri, viaAlias: false };
            }
            return { uri: newUri, viaAlias: false };
        });
        // Both old and new files exist — triggers merge flow
        const fileExists = vi.fn().mockResolvedValue(true);

        const fileService = {
            resolveTargetUri,
            resolveTargetUriCaseInsensitive,
            fileExists,
            resolveNewFileTargetUri: vi.fn(),
        };

        const indexFileContent = vi.fn();
        const indexService = {
            isOpen: true,
            getPageByPath: vi.fn().mockReturnValue({ id: 1 }),
            getLinksForPage: vi.fn().mockReturnValue([]),
            resolveAlias: vi.fn().mockReturnValue(undefined),
            indexFileContent,
            updateRename: vi.fn(),
            saveToFile: vi.fn(),
            removePage: vi.fn(),
            getPageById: vi.fn().mockReturnValue(undefined),
            updateAliasRename: vi.fn(),
        };

        const indexScanner = {
            indexFile: vi.fn().mockResolvedValue(undefined),
        };

        // Mock openTextDocument to return different content for old vs new files
        const oldFileContent = '---\ntitle: Old Page\n---\n\n# Old content';
        const newFileContent = '---\ntitle: New Page\n---\n\n# New content';
        const makeDoc = (content: string, uri: unknown) => ({
            getText: () => content,
            lineCount: content.split('\n').length,
            lineAt: (line: number) => ({
                text: content.split('\n')[line] ?? '',
                range: { start: { line, character: 0 }, end: { line, character: (content.split('\n')[line] ?? '').length } },
            }),
            uri,
            save: vi.fn().mockResolvedValue(true),
        });
        vi.mocked(vscode.workspace.openTextDocument).mockImplementation(async (uri: unknown) => {
            const uriStr = typeof uri === 'string' ? uri : (uri as { toString(): string }).toString();
            if (uriStr.includes('OldName')) {
                return makeDoc(oldFileContent, oldUri) as never;
            }
            return makeDoc(newFileContent, newUri) as never;
        });

        const wikilinkService = new WikilinkService();
        const tracker = new WikilinkRenameTracker(
            wikilinkService,
            fileService as never,
            indexService as never,
            indexScanner as never,
        );

        const renames = [{
            oldPageName: 'OldName',
            newPageName: 'NewName',
            line: 0,
            startPosition: 0,
            endPosition: 11,
        }];

        return { tracker, document, fileService, indexService, indexScanner, oldUri, newUri, renames };
    }

    it('includes merge language in dialog when target file exists', async () => {
        const { tracker, document, renames } = makeMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('No' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        const messageArg = vi.mocked(vscode.window.showInformationMessage).mock.calls[0][0] as string;
        expect(messageArg.toLowerCase()).toContain('merge');
    });

    it('does not rename the file when target exists — merges instead', async () => {
        const { tracker, document, renames } = makeMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        // fs.rename should NOT have been called (merge, not rename)
        expect(vscode.workspace.fs.rename).not.toHaveBeenCalled();
    });

    it('writes merged content to target file on accept', async () => {
        const { tracker, document, renames } = makeMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        // applyEdit should have been called to write merged content
        expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('deletes source file after merge on accept', async () => {
        const { tracker, document, renames } = makeMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        // The old file should be deleted after merge
        expect(vscode.workspace.fs.delete).toHaveBeenCalled();
    });

    it('performs full no-op when user declines a merge rename', async () => {
        const { tracker, document, indexService, renames } = makeMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('No' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        // No file operations
        expect(vscode.workspace.fs.rename).not.toHaveBeenCalled();
        // No index update (full no-op for merge decline)
        expect(indexService.indexFileContent).not.toHaveBeenCalled();
        // No link updates (applyEdit not called for merge workspace edits)
        // Note: applyEdit for workspace link replacement should not be called
    });

    it('does not show the old warning message when target exists', async () => {
        const { tracker, document, renames } = makeMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });
});

// ── Alias-is-page-own-name should not block merge detection ───────────────────

describe('WikilinkRenameTracker — alias matching page own name', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Mocks the scenario from the bug report:
     * - Pothos.md has aliases: [Pothos] (its own name as an alias)
     * - Monstera.md exists (target file)
     * - User renames [[Pothos]] → [[Monstera]] in editor
     * - resolveAlias("Pothos") returns Pothos.md
     * - Expected: merge (not alias rename)
     */
    function makeAliasOwnNameMergeMocks() {
        const oldUri = { fsPath: '/notes/Pothos.md', toString: () => 'file:///notes/Pothos.md' };
        const newUri = { fsPath: '/notes/Monstera.md', toString: () => 'file:///notes/Monstera.md' };
        const documentUri = { fsPath: '/notes/referencing.md', toString: () => 'file:///notes/referencing.md' };
        const document = {
            uri: documentUri,
            getText: vi.fn(() => '[[Monstera]]'),
            lineCount: 1,
            lineAt: vi.fn(() => ({ text: '[[Monstera]]' })),
        };

        const resolveTargetUri = vi.fn().mockReturnValue(newUri);
        const resolveTargetUriCaseInsensitive = vi.fn().mockImplementation(async (_uri: unknown, pageFileName: string) => {
            if (pageFileName === 'Pothos') {
                return { uri: oldUri, viaAlias: false };
            }
            return { uri: newUri, viaAlias: false };
        });
        // Both old and new files exist
        const fileExists = vi.fn().mockResolvedValue(true);

        const fileService = {
            resolveTargetUri,
            resolveTargetUriCaseInsensitive,
            fileExists,
            resolveNewFileTargetUri: vi.fn(),
        };

        const indexService = {
            isOpen: true,
            getPageByPath: vi.fn().mockReturnValue({ id: 1 }),
            getLinksForPage: vi.fn().mockReturnValue([]),
            // This is the key: resolveAlias matches because "Pothos" is an alias on Pothos.md
            resolveAlias: vi.fn().mockReturnValue({
                id: 1,
                path: 'notes/Pothos.md',
                filename: 'Pothos.md',
                title: 'Pothos',
                mtime: 0,
                indexed_at: 0,
            }),
            indexFileContent: vi.fn(),
            updateRename: vi.fn(),
            saveToFile: vi.fn(),
            removePage: vi.fn(),
            getPageById: vi.fn().mockReturnValue(undefined),
            updateAliasRename: vi.fn(),
        };

        const indexScanner = {
            indexFile: vi.fn().mockResolvedValue(undefined),
        };

        // Mock openTextDocument for merge content
        const oldContent = '---\ntitle: Pothos\naliases:\n  - Pothos\n---\n\nPothos content';
        const newContent = '---\ntitle: Monstera\n---\n\nMonstera content';
        const makeDoc = (content: string, uri: unknown) => ({
            getText: () => content,
            lineCount: content.split('\n').length,
            lineAt: (line: number) => ({
                text: content.split('\n')[line] ?? '',
                range: { start: { line, character: 0 }, end: { line, character: (content.split('\n')[line] ?? '').length } },
            }),
            uri,
            save: vi.fn().mockResolvedValue(true),
        });
        vi.mocked(vscode.workspace.openTextDocument).mockImplementation(async (uri: unknown) => {
            const uriStr = typeof uri === 'string' ? uri : (uri as { toString(): string }).toString();
            if (uriStr.includes('Pothos')) {
                return makeDoc(oldContent, oldUri) as never;
            }
            return makeDoc(newContent, newUri) as never;
        });

        const wikilinkService = new WikilinkService();
        const tracker = new WikilinkRenameTracker(
            wikilinkService,
            fileService as never,
            indexService as never,
            indexScanner as never,
        );

        const renames = [{
            oldPageName: 'Pothos',
            newPageName: 'Monstera',
            line: 0,
            startPosition: 0,
            endPosition: 12,
        }];

        return { tracker, document, fileService, indexService, indexScanner, oldUri, newUri, renames };
    }

    it('shows merge dialog (not alias rename) when alias matches page own name and target exists', async () => {
        const { tracker, document, renames } = makeAliasOwnNameMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('No' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        const messageArg = vi.mocked(vscode.window.showInformationMessage).mock.calls[0][0] as string;
        expect(messageArg.toLowerCase()).toContain('merge');
        expect(messageArg.toLowerCase()).not.toContain('alias');
    });

    it('merges files when alias matches page own name and user accepts', async () => {
        const { tracker, document, renames } = makeAliasOwnNameMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        // Should merge (applyEdit + delete), not just update alias
        expect(vscode.workspace.applyEdit).toHaveBeenCalled();
        expect(vscode.workspace.fs.delete).toHaveBeenCalled();
        expect(vscode.workspace.fs.rename).not.toHaveBeenCalled();
    });

    it('does not call updateAliasRename when alias matches page own name', async () => {
        const { tracker, document, indexService, renames } = makeAliasOwnNameMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        // Should NOT have taken the alias path
        expect(indexService.updateAliasRename).not.toHaveBeenCalled();
    });
});

// ── Cross-directory merge detection ──────────────────────────────────────────

describe('WikilinkRenameTracker — cross-directory merge detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function makeCrossDirectoryMergeMocks(oldPageName = 'OldName', newPageName = 'NewName') {
        const oldUri = { fsPath: `/notes/source/${oldPageName}.md`, toString: () => `file:///notes/source/${oldPageName}.md` };
        const sameDirNewUri = { fsPath: `/notes/source/${newPageName}.md`, toString: () => `file:///notes/source/${newPageName}.md` };
        const targetUri = { fsPath: `/notes/target/${newPageName}.md`, toString: () => `file:///notes/target/${newPageName}.md` };
        const documentUri = { fsPath: '/notes/referencing.md', toString: () => 'file:///notes/referencing.md' };
        const document = {
            uri: documentUri,
            getText: vi.fn(() => `[[${newPageName}]]`),
            lineCount: 1,
            lineAt: vi.fn(() => ({ text: `[[${newPageName}]]` })),
        };

        const resolveTargetUri = vi.fn().mockReturnValue(sameDirNewUri);
        const resolveTargetUriCaseInsensitive = vi.fn().mockImplementation(async (_uri: unknown, pageFileName: string) => {
            if (pageFileName === oldPageName) {
                return { uri: oldUri, viaAlias: false };
            }
            if (pageFileName === newPageName) {
                return { uri: targetUri, viaAlias: false };
            }
            return { uri: sameDirNewUri, viaAlias: false };
        });
        const fileExists = vi.fn().mockImplementation(async (uri: { toString(): string }) => {
            const uriStr = uri.toString();
            return uriStr === oldUri.toString() || uriStr === targetUri.toString();
        });

        const fileService = {
            resolveTargetUri,
            resolveTargetUriCaseInsensitive,
            fileExists,
            resolveNewFileTargetUri: vi.fn(),
        };

        const indexService = {
            isOpen: true,
            getPageByPath: vi.fn().mockReturnValue({ id: 1 }),
            getLinksForPage: vi.fn().mockReturnValue([]),
            resolveAlias: vi.fn().mockReturnValue(undefined),
            findPagesByFilename: vi.fn().mockReturnValue([{ path: `target/${newPageName}.md`, filename: `${newPageName}.md` }]),
            indexFileContent: vi.fn(),
            updateRename: vi.fn(),
            saveToFile: vi.fn(),
            removePage: vi.fn(),
            getPageById: vi.fn().mockReturnValue(undefined),
            updateAliasRename: vi.fn(),
        };

        const indexScanner = {
            indexFile: vi.fn().mockResolvedValue(undefined),
        };

        const oldFileContent = `---\ntitle: ${oldPageName}\n---\n\nOld content`;
        const targetFileContent = `---\ntitle: ${newPageName}\n---\n\nTarget content`;
        const makeDoc = (content: string, uri: unknown) => ({
            getText: () => content,
            lineCount: content.split('\n').length,
            lineAt: (line: number) => ({
                text: content.split('\n')[line] ?? '',
                range: { start: { line, character: 0 }, end: { line, character: (content.split('\n')[line] ?? '').length } },
            }),
            uri,
            save: vi.fn().mockResolvedValue(true),
        });
        vi.mocked(vscode.workspace.openTextDocument).mockImplementation(async (uri: unknown) => {
            const uriStr = typeof uri === 'string' ? uri : (uri as { toString(): string }).toString();
            if (uriStr === oldUri.toString()) {
                return makeDoc(oldFileContent, oldUri) as never;
            }
            return makeDoc(targetFileContent, targetUri) as never;
        });

        const wikilinkService = new WikilinkService();
        const tracker = new WikilinkRenameTracker(
            wikilinkService,
            fileService as never,
            indexService as never,
            indexScanner as never,
        );

        const renames = [{
            oldPageName,
            newPageName,
            line: 0,
            startPosition: 0,
            endPosition: newPageName.length + 3,
        }];

        return { tracker, document, fileService, indexService, oldUri, sameDirNewUri, targetUri, renames };
    }

    it('merges into an existing page in another directory instead of renaming locally', async () => {
        const { tracker, document, renames, oldUri } = makeCrossDirectoryMergeMocks();
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        expect(vscode.workspace.fs.rename).not.toHaveBeenCalled();
        expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(oldUri);
        expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('does not treat alias-only target resolution as a file merge', async () => {
        const { tracker, document, renames, fileService } = makeCrossDirectoryMergeMocks('OldName', 'AliasTarget');
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);

        vi.mocked(fileService.resolveTargetUriCaseInsensitive).mockImplementation(async (_uri: unknown, pageFileName: string) => {
            if (pageFileName === 'OldName') {
                return { uri: { fsPath: '/notes/source/OldName.md', toString: () => 'file:///notes/source/OldName.md' }, viaAlias: false };
            }
            return { uri: { fsPath: '/notes/target/Canonical.md', toString: () => 'file:///notes/target/Canonical.md' }, viaAlias: true };
        });

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        expect(vscode.workspace.fs.rename).toHaveBeenCalled();
        expect(vscode.workspace.fs.delete).not.toHaveBeenCalled();
    });

    it('detects merge targets across directories for nested page names', async () => {
        const { tracker, document, renames } = makeCrossDirectoryMergeMocks('[[Topic]] Notes', '[[Topic]] Garden');
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('No' as never);

        await (tracker as unknown as { promptAndPerformRenames: Function })
            .promptAndPerformRenames(document, renames, 'referencing.md');

        const messageArg = vi.mocked(vscode.window.showInformationMessage).mock.calls[0][0] as string;
        expect(messageArg.toLowerCase()).toContain('merge');
        expect(messageArg).toContain('[[Topic]] Garden.md');
    });
});
