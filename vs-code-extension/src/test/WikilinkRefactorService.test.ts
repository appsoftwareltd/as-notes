import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
    Uri: {
        file: vi.fn((fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` })),
    },
    Range: class {
        constructor(public startLine: number, public startChar: number, public endLine: number, public endChar: number) { }
    },
    WorkspaceEdit: class {
        replace = vi.fn();
    },
    workspace: {
        findFiles: vi.fn().mockResolvedValue([]),
        openTextDocument: vi.fn(),
        applyEdit: vi.fn().mockResolvedValue(true),
        textDocuments: [],
        fs: {
            readFile: vi.fn(),
            writeFile: vi.fn().mockResolvedValue(undefined),
        },
    },
}));

import * as vscode from 'vscode';
import { WikilinkService } from 'as-notes-common';
import { updateLinksInWorkspace } from '../WikilinkRefactorService.js';

describe('WikilinkRefactorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(vscode.workspace.textDocuments).splice(0, vi.mocked(vscode.workspace.textDocuments).length);
    });

    it('uses provided candidate URIs instead of scanning the whole workspace', async () => {
        const candidateUri = { fsPath: '/notes/Ref.md', toString: () => 'file:///notes/Ref.md' };
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
            new TextEncoder().encode('[[OldName]]'),
        );

        await updateLinksInWorkspace(
            new WikilinkService(),
            [{ oldPageName: 'OldName', newPageName: 'NewName' }],
            { candidateUris: [candidateUri as never] },
        );

        expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
        expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(candidateUri);
    });

    it('does not auto-save dirty affected documents after applying rename edits', async () => {
        const candidateUri = { fsPath: '/notes/Ref.md', toString: () => 'file:///notes/Ref.md' };
        const save = vi.fn().mockResolvedValue(true);
        const dirtyDoc = {
            uri: candidateUri,
            getText: () => '[[OldName]]',
            lineCount: 1,
            lineAt: (i: number) => ({ text: '[[OldName]]' }),
            isDirty: true,
            save,
        };

        vi.mocked(vscode.workspace.textDocuments).splice(0, 0, dirtyDoc as never);

        await updateLinksInWorkspace(
            new WikilinkService(),
            [{ oldPageName: 'OldName', newPageName: 'NewName' }],
            { candidateUris: [candidateUri as never] },
        );

        expect(save).not.toHaveBeenCalled();
    });

    it('reads from open document buffer instead of disk when file is already open', async () => {
        const candidateUri = { fsPath: '/notes/Ref.md', toString: () => 'file:///notes/Ref.md' };
        const openDoc = {
            uri: candidateUri,
            lineCount: 1,
            lineAt: () => ({ text: '[[OldName]]' }),
        };

        vi.mocked(vscode.workspace.textDocuments).splice(0, 0, openDoc as never);

        await updateLinksInWorkspace(
            new WikilinkService(),
            [{ oldPageName: 'OldName', newPageName: 'NewName' }],
            { candidateUris: [candidateUri as never] },
        );

        // Should use the open document, not fs.readFile
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
        expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('reads from disk via fs.readFile for files not already open', async () => {
        const candidateUri = { fsPath: '/notes/Ref.md', toString: () => 'file:///notes/Ref.md' };
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
            new TextEncoder().encode('[[OldName]]'),
        );

        await updateLinksInWorkspace(
            new WikilinkService(),
            [{ oldPageName: 'OldName', newPageName: 'NewName' }],
            { candidateUris: [candidateUri as never] },
        );

        // Should NOT open a document model — reads raw bytes instead
        expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
        expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(candidateUri);
        expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
            candidateUri,
            Buffer.from('[[NewName]]', 'utf-8'),
        );
    });

    it('uses workspace edits only for files that are already open', async () => {
        const openUri = { fsPath: '/notes/Open.md', toString: () => 'file:///notes/Open.md' };
        const closedUri = { fsPath: '/notes/Closed.md', toString: () => 'file:///notes/Closed.md' };
        const openDoc = {
            uri: openUri,
            lineCount: 1,
            lineAt: () => ({ text: '[[OldName]]' }),
        };

        vi.mocked(vscode.workspace.textDocuments).splice(0, 0, openDoc as never);
        vi.mocked(vscode.workspace.fs.readFile).mockImplementation(async (uri) => {
            if ((uri as { toString(): string }).toString() === closedUri.toString()) {
                return new TextEncoder().encode('[[OldName]]');
            }
            throw new Error('unexpected uri');
        });

        await updateLinksInWorkspace(
            new WikilinkService(),
            [{ oldPageName: 'OldName', newPageName: 'NewName' }],
            { candidateUris: [openUri as never, closedUri as never] },
        );

        expect(vscode.workspace.applyEdit).toHaveBeenCalledTimes(1);
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
            closedUri,
            Buffer.from('[[NewName]]', 'utf-8'),
        );
    });

    it('skips files that do not contain any old page name', async () => {
        const candidateUri = { fsPath: '/notes/Ref.md', toString: () => 'file:///notes/Ref.md' };
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
            new TextEncoder().encode('No wikilinks here'),
        );

        const result = await updateLinksInWorkspace(
            new WikilinkService(),
            [{ oldPageName: 'OldName', newPageName: 'NewName' }],
            { candidateUris: [candidateUri as never] },
        );

        expect(result).toHaveLength(0);
        expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
    });
});