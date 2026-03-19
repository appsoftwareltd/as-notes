import { describe, it, expect } from 'vitest';
import {
    normaliseRootDirectory,
    computeNotesRoot,
    computeNotesRootPaths,
    toNotesRelativePath,
    isInsideNotesRoot,
} from '../NotesRootService.js';

describe('NotesRootService', () => {
    // ── normaliseRootDirectory ─────────────────────────────────────────

    describe('normaliseRootDirectory', () => {
        it('returns empty string for blank input', () => {
            expect(normaliseRootDirectory('')).toBe('');
            expect(normaliseRootDirectory('  ')).toBe('');
        });

        it('trims whitespace', () => {
            expect(normaliseRootDirectory('  docs  ')).toBe('docs');
        });

        it('strips leading slashes', () => {
            expect(normaliseRootDirectory('/docs')).toBe('docs');
            expect(normaliseRootDirectory('//docs')).toBe('docs');
        });

        it('strips trailing slashes', () => {
            expect(normaliseRootDirectory('docs/')).toBe('docs');
            expect(normaliseRootDirectory('docs//')).toBe('docs');
        });

        it('strips leading and trailing backslashes', () => {
            expect(normaliseRootDirectory('\\docs\\')).toBe('docs');
        });

        it('preserves nested path separators', () => {
            expect(normaliseRootDirectory('sub/docs')).toBe('sub/docs');
        });
    });

    // ── computeNotesRoot ───────────────────────────────────────────────

    describe('computeNotesRoot', () => {
        it('returns workspace root when rootDirectory is empty', () => {
            expect(computeNotesRoot('/home/user/project', '')).toBe('/home/user/project');
        });

        it('returns workspace root when rootDirectory is blank', () => {
            expect(computeNotesRoot('/home/user/project', '   ')).toBe('/home/user/project');
        });

        it('joins workspace root with rootDirectory', () => {
            const result = computeNotesRoot('/home/user/project', 'docs');
            expect(result).toMatch(/[/\\]home[/\\]user[/\\]project[/\\]docs$/);
        });

        it('normalises rootDirectory before joining', () => {
            const result = computeNotesRoot('/home/user/project', '  /docs/  ');
            expect(result).toMatch(/[/\\]home[/\\]user[/\\]project[/\\]docs$/);
        });
    });

    // ── computeNotesRootPaths ──────────────────────────────────────────

    describe('computeNotesRootPaths', () => {
        it('computes all paths at workspace root when rootDirectory is empty', () => {
            const paths = computeNotesRootPaths('/home/user/project', '');
            expect(paths.root).toBe('/home/user/project');
            expect(paths.asnotesDir).toMatch(/[/\\]\.asnotes$/);
            expect(paths.databasePath).toMatch(/[/\\]\.asnotes[/\\]index\.db$/);
            expect(paths.logDir).toMatch(/[/\\]\.asnotes[/\\]logs$/);
            expect(paths.ignoreFilePath).toMatch(/[/\\]\.asnotesignore$/);
        });

        it('computes all paths under rootDirectory', () => {
            const paths = computeNotesRootPaths('/home/user/project', 'docs');
            expect(paths.root).toMatch(/[/\\]home[/\\]user[/\\]project[/\\]docs$/);
            expect(paths.asnotesDir).toMatch(/[/\\]docs[/\\]\.asnotes$/);
            expect(paths.databasePath).toMatch(/[/\\]docs[/\\]\.asnotes[/\\]index\.db$/);
            expect(paths.logDir).toMatch(/[/\\]docs[/\\]\.asnotes[/\\]logs$/);
            expect(paths.ignoreFilePath).toMatch(/[/\\]docs[/\\]\.asnotesignore$/);
        });

        it('provides a forward-slashed rootUri', () => {
            const paths = computeNotesRootPaths('C:\\Users\\dev\\project', 'docs');
            expect(paths.rootUri).not.toContain('\\');
            expect(paths.rootUri).toContain('/docs');
        });
    });

    // ── toNotesRelativePath ────────────────────────────────────────────

    describe('toNotesRelativePath', () => {
        it('returns relative path from notes root (forward slashes)', () => {
            expect(toNotesRelativePath('/home/project', '/home/project/notes/page.md'))
                .toBe('notes/page.md');
        });

        it('handles Windows backslashes', () => {
            expect(toNotesRelativePath('C:\\Users\\dev\\project', 'C:\\Users\\dev\\project\\notes\\page.md'))
                .toBe('notes/page.md');
        });

        it('returns empty string when path equals root', () => {
            expect(toNotesRelativePath('/home/project', '/home/project')).toBe('');
        });

        it('returns path as-is when not inside root', () => {
            expect(toNotesRelativePath('/home/project', '/other/place/page.md'))
                .toBe('/other/place/page.md');
        });

        it('works with subdirectory root', () => {
            expect(toNotesRelativePath('/home/project/docs', '/home/project/docs/journals/2026-03-19.md'))
                .toBe('journals/2026-03-19.md');
        });
    });

    // ── isInsideNotesRoot ──────────────────────────────────────────────

    describe('isInsideNotesRoot', () => {
        it('returns true for files inside root', () => {
            expect(isInsideNotesRoot('/home/project', '/home/project/notes/page.md')).toBe(true);
        });

        it('returns true when path equals root', () => {
            expect(isInsideNotesRoot('/home/project', '/home/project')).toBe(true);
        });

        it('returns false for files outside root', () => {
            expect(isInsideNotesRoot('/home/project/docs', '/home/project/src/index.ts')).toBe(false);
        });

        it('is case-insensitive', () => {
            expect(isInsideNotesRoot('/Home/Project', '/home/project/page.md')).toBe(true);
        });

        it('handles Windows paths', () => {
            expect(isInsideNotesRoot('C:\\Users\\dev\\project\\docs', 'C:\\Users\\dev\\project\\docs\\page.md'))
                .toBe(true);
        });

        it('does not match partial directory names', () => {
            expect(isInsideNotesRoot('/home/project', '/home/project2/page.md')).toBe(false);
        });
    });
});
