import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => {
    const disposable = { dispose: vi.fn() };
    class WorkspaceEdit {
        replace = vi.fn();
    }
    return {
        ProgressLocation: {
            Notification: 15,
        },
        Uri: {
            file: vi.fn((fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` })),
            joinPath: vi.fn((base: { fsPath: string }, child: string) => ({
                fsPath: `${base.fsPath}/${child}`.replace(/\\/g, '/'),
                toString: () => `file://${base.fsPath}/${child}`,
            })),
        },
        Range: class {
            constructor(public startLine: number, public startChar: number, public endLine: number, public endChar: number) { }
        },
        WorkspaceEdit,
        workspace: {
            asRelativePath: vi.fn((uri: { fsPath: string }) => uri.fsPath),
            findFiles: vi.fn().mockResolvedValue([{ fsPath: '/notes/Ref.md', toString: () => 'file:///notes/Ref.md' }]),
            openTextDocument: vi.fn(),
            applyEdit: vi.fn().mockResolvedValue(true),
            textDocuments: [],
            fs: {
                delete: vi.fn().mockResolvedValue(undefined),
                readFile: vi.fn().mockResolvedValue(new Uint8Array()),
                writeFile: vi.fn().mockResolvedValue(undefined),
            },
            workspaceFolders: [{ uri: { fsPath: '/notes', toString: () => 'file:///notes' } }],
            onDidRenameFiles: vi.fn(() => disposable),
        },
        window: {
            showInformationMessage: vi.fn(),
            showWarningMessage: vi.fn(),
            withProgress: vi.fn(async (_options: unknown, task: Function) => task({ report: vi.fn() }, {})),
        },
    };
});

import * as vscode from 'vscode';
import { WikilinkService } from 'as-notes-common';
import { handleExplorerRenameRefactors } from '../WikilinkExplorerRenameRefactorService.js';

describe('WikilinkExplorerRenameRefactorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows notification progress when the user accepts explorer reference updates', async () => {
        const staleScan = vi.fn().mockResolvedValue(undefined);
        const indexFile = vi.fn().mockResolvedValue(undefined);
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);
        // updateLinksInWorkspace now reads via fs.readFile for non-open files
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
            new TextEncoder().encode('[[OldName]]'),
        );

        await handleExplorerRenameRefactors({
            files: [{
                oldUri: { fsPath: '/notes/OldName.md', toString: () => 'file:///notes/OldName.md' },
                newUri: { fsPath: '/notes/NewName.md', toString: () => 'file:///notes/NewName.md' },
            }],
            renameTrackerIsRenaming: false,
            wikilinkService: new WikilinkService(),
            indexService: {
                findPagesByFilename: vi.fn().mockReturnValue([{ id: 1, path: 'NewName.md', filename: 'NewName.md', title: 'NewName', mtime: 0, indexed_at: 0 }]),
                findPagesLinkingToPageNames: vi.fn().mockReturnValue([{ id: 3, path: 'Ref.md', filename: 'Ref.md', title: 'Ref', mtime: 0, indexed_at: 0 }]),
                removePage: vi.fn(),
            } as never,
            indexScanner: {
                staleScan,
                indexFile,
            } as never,
            notesRootPath: '/notes',
            safeSaveToFile: vi.fn().mockReturnValue(true),
            refreshProviders: vi.fn(),
        });

        expect(vscode.window.withProgress).toHaveBeenCalledTimes(1);
        expect(staleScan).not.toHaveBeenCalled();
        expect(indexFile).toHaveBeenCalled();
    });

    it('shows notification progress when the user accepts an explorer merge', async () => {
        vi.mocked(vscode.window.showInformationMessage)
            .mockResolvedValueOnce('Yes' as never)
            .mockResolvedValueOnce('No' as never);
        vi.mocked(vscode.workspace.openTextDocument)
            .mockResolvedValueOnce({
                getText: () => '# source',
                lineCount: 1,
                lineAt: () => ({ range: { start: 0, end: 7 } }),
                save: vi.fn().mockResolvedValue(true),
            } as never)
            .mockResolvedValueOnce({
                getText: () => '# target',
                lineCount: 1,
                lineAt: () => ({ range: { start: 0, end: 7 } }),
                save: vi.fn().mockResolvedValue(true),
            } as never);

        await handleExplorerRenameRefactors({
            files: [{
                oldUri: { fsPath: '/notes/OldName.md', toString: () => 'file:///notes/OldName.md' },
                newUri: { fsPath: '/notes/NewName.md', toString: () => 'file:///notes/NewName.md' },
            }],
            renameTrackerIsRenaming: false,
            wikilinkService: new WikilinkService(),
            indexService: {
                findPagesByFilename: vi.fn().mockReturnValue([
                    { id: 1, path: 'NewName.md', filename: 'NewName.md', title: 'NewName', mtime: 0, indexed_at: 0 },
                    { id: 2, path: 'folder/NewName.md', filename: 'NewName.md', title: 'NewName', mtime: 0, indexed_at: 0 },
                ]),
                findPagesLinkingToPageNames: vi.fn().mockReturnValue([]),
                removePage: vi.fn(),
            } as never,
            indexScanner: {
                staleScan: vi.fn().mockResolvedValue(undefined),
                indexFile: vi.fn().mockResolvedValue(undefined),
            } as never,
            notesRootPath: '/notes',
            safeSaveToFile: vi.fn().mockReturnValue(true),
            refreshProviders: vi.fn(),
        });

        expect(vscode.window.withProgress).toHaveBeenCalledTimes(1);
    });

    it('does not show notification progress when the user declines explorer reference updates', async () => {
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('No' as never);

        await handleExplorerRenameRefactors({
            files: [{
                oldUri: { fsPath: '/notes/OldName.md', toString: () => 'file:///notes/OldName.md' },
                newUri: { fsPath: '/notes/NewName.md', toString: () => 'file:///notes/NewName.md' },
            }],
            renameTrackerIsRenaming: false,
            wikilinkService: new WikilinkService(),
            indexService: {
                findPagesByFilename: vi.fn().mockReturnValue([{ id: 1, path: 'NewName.md', filename: 'NewName.md', title: 'NewName', mtime: 0, indexed_at: 0 }]),
                findPagesLinkingToPageNames: vi.fn().mockReturnValue([]),
                removePage: vi.fn(),
            } as never,
            indexScanner: {
                staleScan: vi.fn().mockResolvedValue(undefined),
                indexFile: vi.fn().mockResolvedValue(undefined),
            } as never,
            notesRootPath: '/notes',
            safeSaveToFile: vi.fn().mockReturnValue(true),
            refreshProviders: vi.fn(),
        });

        expect(vscode.window.withProgress).not.toHaveBeenCalled();
    });

    it('re-indexes open affected reference documents from their live buffers instead of disk', async () => {
        const candidateUri = { fsPath: '/notes/Ref.md', toString: () => 'file:///notes/Ref.md' };
        const openDoc = {
            uri: candidateUri,
            getText: () => '[[OldName]]',
            lineCount: 1,
            lineAt: () => ({ text: '[[OldName]]', range: { start: 0, end: 11 } }),
            isDirty: true,
            save: vi.fn().mockResolvedValue(true),
        };

        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);
        vi.mocked(vscode.workspace.textDocuments).splice(0, vi.mocked(vscode.workspace.textDocuments).length, openDoc as never);

        const indexFile = vi.fn().mockResolvedValue(undefined);
        const indexFileContent = vi.fn();

        await handleExplorerRenameRefactors({
            files: [{
                oldUri: { fsPath: '/notes/OldName.md', toString: () => 'file:///notes/OldName.md' },
                newUri: { fsPath: '/notes/NewName.md', toString: () => 'file:///notes/NewName.md' },
            }],
            renameTrackerIsRenaming: false,
            wikilinkService: new WikilinkService(),
            indexService: {
                findPagesByFilename: vi.fn().mockReturnValue([{ id: 1, path: 'NewName.md', filename: 'NewName.md', title: 'NewName', mtime: 0, indexed_at: 0 }]),
                findPagesLinkingToPageNames: vi.fn().mockReturnValue([{ id: 3, path: 'Ref.md', filename: 'Ref.md', title: 'Ref', mtime: 0, indexed_at: 0 }]),
                removePage: vi.fn(),
                indexFileContent,
            } as never,
            indexScanner: {
                staleScan: vi.fn().mockResolvedValue(undefined),
                indexFile,
            } as never,
            notesRootPath: '/notes',
            safeSaveToFile: vi.fn().mockReturnValue(true),
            refreshProviders: vi.fn(),
        });

        expect(indexFileContent).toHaveBeenCalledWith('Ref.md', 'Ref.md', '[[OldName]]', expect.any(Number));
        expect(indexFile).not.toHaveBeenCalledWith(candidateUri);
    });

    it('does not save the target document after an explorer merge', async () => {
        const targetSave = vi.fn().mockResolvedValue(true);
        const sourceSave = vi.fn().mockResolvedValue(true);

        vi.mocked(vscode.window.showInformationMessage)
            .mockResolvedValueOnce('Yes' as never)   // merge dialog
            .mockResolvedValueOnce('No' as never);    // reference update dialog
        vi.mocked(vscode.workspace.openTextDocument)
            .mockResolvedValueOnce({
                getText: () => '# source',
                lineCount: 1,
                lineAt: () => ({ range: { start: 0, end: 7 } }),
                save: sourceSave,
            } as never)
            .mockResolvedValueOnce({
                getText: () => '# target',
                lineCount: 1,
                lineAt: () => ({ range: { start: 0, end: 7 } }),
                save: targetSave,
            } as never);

        await handleExplorerRenameRefactors({
            files: [{
                oldUri: { fsPath: '/notes/OldName.md', toString: () => 'file:///notes/OldName.md' },
                newUri: { fsPath: '/notes/NewName.md', toString: () => 'file:///notes/NewName.md' },
            }],
            renameTrackerIsRenaming: false,
            wikilinkService: new WikilinkService(),
            indexService: {
                findPagesByFilename: vi.fn().mockReturnValue([
                    { id: 1, path: 'NewName.md', filename: 'NewName.md', title: 'NewName', mtime: 0, indexed_at: 0 },
                    { id: 2, path: 'folder/NewName.md', filename: 'NewName.md', title: 'NewName', mtime: 0, indexed_at: 0 },
                ]),
                findPagesLinkingToPageNames: vi.fn().mockReturnValue([]),
                removePage: vi.fn(),
                indexFileContent: vi.fn(),
            } as never,
            indexScanner: {
                staleScan: vi.fn().mockResolvedValue(undefined),
                indexFile: vi.fn().mockResolvedValue(undefined),
            } as never,
            notesRootPath: '/notes',
            safeSaveToFile: vi.fn().mockReturnValue(true),
            refreshProviders: vi.fn(),
        });

        expect(targetSave).not.toHaveBeenCalled();
        expect(sourceSave).not.toHaveBeenCalled();
    });
});