import { describe, it, expect } from 'vitest';
import {
    formatJournalFilename,
    formatJournalDate,
    normaliseJournalFolder,
    computeJournalPaths,
} from '../JournalService.js';

describe('JournalService', () => {
    // ── Date formatting ────────────────────────────────────────────────────

    describe('formatJournalFilename', () => {
        it('formats a date as YYYY-MM-DD.md', () => {
            expect(formatJournalFilename(new Date(2026, 2, 2))).toBe('2026-03-02.md');
        });

        it('zero-pads single-digit month and day', () => {
            expect(formatJournalFilename(new Date(2025, 0, 5))).toBe('2025-01-05.md');
        });

        it('handles double-digit month and day', () => {
            expect(formatJournalFilename(new Date(2026, 11, 25))).toBe('2026-12-25.md');
        });
    });

    describe('formatJournalDate', () => {
        it('formats a date as YYYY-MM-DD', () => {
            expect(formatJournalDate(new Date(2026, 2, 2))).toBe('2026-03-02');
        });

        it('zero-pads single-digit month and day', () => {
            expect(formatJournalDate(new Date(2025, 0, 5))).toBe('2025-01-05');
        });
    });

    // ── Folder normalisation ───────────────────────────────────────────────

    describe('normaliseJournalFolder', () => {
        it('returns the folder unchanged when already clean', () => {
            expect(normaliseJournalFolder('journals')).toBe('journals');
        });

        it('strips leading slashes', () => {
            expect(normaliseJournalFolder('/journals')).toBe('journals');
        });

        it('strips trailing slashes', () => {
            expect(normaliseJournalFolder('journals/')).toBe('journals');
        });

        it('strips leading and trailing slashes', () => {
            expect(normaliseJournalFolder('/journals/')).toBe('journals');
        });

        it('strips backslashes', () => {
            expect(normaliseJournalFolder('\\journals\\')).toBe('journals');
        });

        it('returns empty string for blank input', () => {
            expect(normaliseJournalFolder('')).toBe('');
        });

        it('returns empty string for whitespace-only input', () => {
            expect(normaliseJournalFolder('   ')).toBe('');
        });

        it('trims surrounding whitespace', () => {
            expect(normaliseJournalFolder('  journals  ')).toBe('journals');
        });

        it('preserves nested folder paths', () => {
            expect(normaliseJournalFolder('notes/journals')).toBe('notes/journals');
        });
    });

    // ── Path construction ──────────────────────────────────────────────────

    describe('computeJournalPaths', () => {
        const date = new Date(2026, 2, 2);

        it('computes paths with default folder', () => {
            const paths = computeJournalPaths('/workspace', 'journals', date);
            expect(paths.journalFolderPath).toBe('/workspace/journals');
            expect(paths.journalFilePath).toBe('/workspace/journals/2026-03-02.md');
        });

        it('computes paths with custom folder', () => {
            const paths = computeJournalPaths('/workspace', 'my/daily', date);
            expect(paths.journalFolderPath).toBe('/workspace/my/daily');
            expect(paths.journalFilePath).toBe('/workspace/my/daily/2026-03-02.md');
        });

        it('computes paths when folder is empty (workspace root)', () => {
            const paths = computeJournalPaths('/workspace', '', date);
            expect(paths.journalFolderPath).toBe('/workspace');
            expect(paths.journalFilePath).toBe('/workspace/2026-03-02.md');
        });

        it('normalises folder with extra slashes', () => {
            const paths = computeJournalPaths('/workspace', '/journals/', date);
            expect(paths.journalFolderPath).toBe('/workspace/journals');
            expect(paths.journalFilePath).toBe('/workspace/journals/2026-03-02.md');
        });
    });
});
