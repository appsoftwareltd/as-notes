import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal vscode stub ───────────────────────────────────────────────────────

const configValues: Record<string, unknown> = {};

vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: {
                fsPath: '/workspace',
                toString: () => 'file:///workspace',
            },
        }],
        getConfiguration: vi.fn(() => ({
            get: <T>(key: string, defaultValue: T): T =>
                (configValues[key] !== undefined ? configValues[key] as T : defaultValue),
        })),
        asRelativePath: vi.fn((uri: { fsPath?: string }) =>
            typeof uri === 'string' ? uri : (uri.fsPath ?? '').replace(/^\/workspace\//, ''),
        ),
        fs: {
            readDirectory: vi.fn(async () => []),
            stat: vi.fn(async () => { throw new Error('not found'); }),
        },
    },
    Uri: {
        file: (fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` }),
        joinPath: (base: { fsPath: string }, ...segments: string[]) => {
            const joined = [base.fsPath, ...segments].join('/');
            return { fsPath: joined, toString: () => `file://${joined}` };
        },
    },
}));

import { WikilinkFileService } from '../WikilinkFileService.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function uri(fsPath: string) {
    return { fsPath, toString: () => `file://${fsPath}` } as import('vscode').Uri;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WikilinkFileService.resolveNewFileTargetUri', () => {
    let service: WikilinkFileService;

    beforeEach(() => {
        service = new WikilinkFileService();
        // Reset config to defaults
        configValues['notesFolder'] = undefined;
        configValues['createNotesInCurrentDirectory'] = undefined;
        configValues['journalFolder'] = undefined;
    });

    it('uses notesFolder by default', () => {
        const result = service.resolveNewFileTargetUri(
            uri('/workspace/journals/2026-03-18.md'),
            'My Page',
        );
        // Default notesFolder = 'notes'
        expect(result.fsPath).toMatch(/[/\\]workspace[/\\]notes[/\\]My Page\.md$/);
    });

    it('uses custom notesFolder setting', () => {
        configValues['notesFolder'] = 'docs/pages';
        const result = service.resolveNewFileTargetUri(
            uri('/workspace/some/file.md'),
            'My Page',
        );
        expect(result.fsPath).toMatch(/[/\\]workspace[/\\]docs[/\\]pages[/\\]My Page\.md$/);
    });

    it('uses source directory when createNotesInCurrentDirectory is true and not in journal folder', () => {
        configValues['createNotesInCurrentDirectory'] = true;
        const result = service.resolveNewFileTargetUri(
            uri('/workspace/projects/file.md'),
            'My Page',
        );
        expect(result.fsPath).toMatch(/[/\\]workspace[/\\]projects[/\\]My Page\.md$/);
    });

    it('ignores createNotesInCurrentDirectory when source is in journal folder', () => {
        configValues['createNotesInCurrentDirectory'] = true;
        configValues['journalFolder'] = 'journals';
        const result = service.resolveNewFileTargetUri(
            uri('/workspace/journals/2026-03-18.md'),
            'My Page',
        );
        // Should use notesFolder, not journal directory
        expect(result.fsPath).toMatch(/[/\\]workspace[/\\]notes[/\\]My Page\.md$/);
    });

    it('ignores createNotesInCurrentDirectory when source is in nested journal subfolder', () => {
        configValues['createNotesInCurrentDirectory'] = true;
        configValues['journalFolder'] = 'journals';
        const result = service.resolveNewFileTargetUri(
            uri('/workspace/journals/2026/file.md'),
            'My Page',
        );
        expect(result.fsPath).toMatch(/[/\\]workspace[/\\]notes[/\\]My Page\.md$/);
    });

    it('handles empty notesFolder (workspace root)', () => {
        configValues['notesFolder'] = '';
        const result = service.resolveNewFileTargetUri(
            uri('/workspace/some/file.md'),
            'My Page',
        );
        expect(result.fsPath).toMatch(/[/\\]workspace[/\\]My Page\.md$/);
    });

    it('normalises notesFolder with leading/trailing slashes', () => {
        configValues['notesFolder'] = '/notes/';
        const result = service.resolveNewFileTargetUri(
            uri('/workspace/some/file.md'),
            'My Page',
        );
        expect(result.fsPath).toMatch(/[/\\]workspace[/\\]notes[/\\]My Page\.md$/);
    });

    it('uses notesFolder when createNotesInCurrentDirectory is false (default)', () => {
        configValues['createNotesInCurrentDirectory'] = false;
        const result = service.resolveNewFileTargetUri(
            uri('/workspace/projects/file.md'),
            'My Page',
        );
        expect(result.fsPath).toMatch(/[/\\]workspace[/\\]notes[/\\]My Page\.md$/);
    });

    it('resolveTargetUri still uses source directory (unchanged)', () => {
        const result = service.resolveTargetUri(
            uri('/workspace/projects/file.md'),
            'My Page',
        );
        expect(result.fsPath).toMatch(/[/\\]workspace[/\\]projects[/\\]My Page\.md$/);
    });
});
