import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
    Uri: {
        file: vi.fn((fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` })),
        joinPath: vi.fn((base: { fsPath: string }, child: string) => ({
            fsPath: `${base.fsPath}/${child}`.replace(/\\/g, '/'),
            toString: () => `file://${base.fsPath}/${child}`,
        })),
    },
}));

import * as vscode from 'vscode';
import {
    collectFilenameRefactorOperations,
    remapUrisForFileOperations,
} from '../WikilinkFilenameRefactorService.js';

describe('WikilinkFilenameRefactorService', () => {
    const rootUri = vscode.Uri.file('/notes');

    it('plans a filename rename when a page filename contains the renamed wikilink', () => {
        const result = collectFilenameRefactorOperations(
            [{ oldPageName: 'Plant', newPageName: 'Tree' }],
            [
                { path: 'Topic [[Plant]].md', filename: 'Topic [[Plant]].md' },
            ],
            rootUri,
        );

        expect(result.fileRenames).toHaveLength(1);
        expect(result.fileRenames[0].oldUri.fsPath).toContain('Topic [[Plant]].md');
        expect(result.fileRenames[0].newUri.fsPath).toContain('Topic [[Tree]].md');
        expect(result.fileMerges).toHaveLength(0);
    });

    it('plans a filename merge when the renamed filename target already exists', () => {
        const result = collectFilenameRefactorOperations(
            [{ oldPageName: 'Plant', newPageName: 'Tree' }],
            [
                { path: 'Topic [[Plant]].md', filename: 'Topic [[Plant]].md' },
                { path: 'Topic [[Tree]].md', filename: 'Topic [[Tree]].md' },
            ],
            rootUri,
        );

        expect(result.fileRenames).toHaveLength(0);
        expect(result.fileMerges).toHaveLength(1);
        expect(result.fileMerges[0].oldUri.fsPath).toContain('Topic [[Plant]].md');
        expect(result.fileMerges[0].newUri.fsPath).toContain('Topic [[Tree]].md');
    });

    it('remaps candidate URIs through filename rename operations', () => {
        const oldUri = vscode.Uri.file('/notes/Topic [[Plant]].md');
        const newUri = vscode.Uri.file('/notes/Topic [[Tree]].md');

        const remapped = remapUrisForFileOperations(
            [oldUri],
            [{ oldUri, newUri, label: 'Topic [[Plant]].md → Topic [[Tree]].md' }],
            [],
        );

        expect(remapped).toHaveLength(1);
        expect(remapped[0].fsPath).toBe('/notes/Topic [[Tree]].md');
    });
});