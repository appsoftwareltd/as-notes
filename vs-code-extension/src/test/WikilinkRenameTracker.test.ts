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
    return {
        Uri: {
            joinPath: vi.fn((...args: unknown[]) => args),
        },
        workspace: {
            onDidChangeTextDocument: vi.fn(() => disposable),
            asRelativePath: vi.fn((uri: { fsPath?: string; toString(): string }) =>
                typeof uri === 'string' ? uri : uri.fsPath ?? uri.toString(),
            ),
            findFiles: vi.fn().mockResolvedValue([]),
            fs: {
                rename: vi.fn().mockResolvedValue(undefined),
            },
            applyEdit: vi.fn().mockResolvedValue(true),
            openTextDocument: vi.fn().mockResolvedValue({ getText: () => '', lineCount: 0, lineAt: () => ({ text: '' }) }),
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
        const resolveTargetUriCaseInsensitive = vi.fn().mockResolvedValue({ uri: oldUri });
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
});
