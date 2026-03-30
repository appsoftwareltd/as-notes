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
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Yes' as never);
        vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({
            getText: () => '[[OldName]]',
            lineCount: 1,
            lineAt: () => ({ text: '[[OldName]]', range: { start: 0, end: 11 } }),
            isDirty: false,
            save: vi.fn().mockResolvedValue(true),
            uri: { fsPath: '/notes/Renamed.md', toString: () => 'file:///notes/Renamed.md' },
        } as never);

        await handleExplorerRenameRefactors({
            files: [{
                oldUri: { fsPath: '/notes/OldName.md', toString: () => 'file:///notes/OldName.md' },
                newUri: { fsPath: '/notes/NewName.md', toString: () => 'file:///notes/NewName.md' },
            }],
            renameTrackerIsRenaming: false,
            wikilinkService: new WikilinkService(),
            indexService: {
                findPagesByFilename: vi.fn().mockReturnValue([{ id: 1, path: 'NewName.md', filename: 'NewName.md', title: 'NewName', mtime: 0, indexed_at: 0 }]),
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
});