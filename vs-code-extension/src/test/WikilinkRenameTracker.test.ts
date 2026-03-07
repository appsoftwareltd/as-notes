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
        workspace: {
            onDidChangeTextDocument: vi.fn(() => disposable),
            asRelativePath: vi.fn((uri: { fsPath?: string; toString(): string }) =>
                typeof uri === 'string' ? uri : uri.fsPath ?? uri.toString(),
            ),
        },
        window: {
            onDidChangeActiveTextEditor: vi.fn(() => disposable),
            onDidChangeTextEditorSelection: vi.fn(() => disposable),
            activeTextEditor: undefined,
        },
    };
});

import { WikilinkRenameTracker } from '../WikilinkRenameTracker.js';
import { WikilinkService } from 'as-notes-common';

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
