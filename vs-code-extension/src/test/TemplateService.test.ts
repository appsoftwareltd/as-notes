import { describe, it, expect } from 'vitest';
import {
    normaliseTemplateFolder,
    computeTemplateFolderPath,
    applyTemplatePlaceholders,
    CURSOR_SENTINEL,
    DEFAULT_JOURNAL_TEMPLATE,
    type TemplateContext,
} from '../TemplateService.js';

describe('TemplateService', () => {
    // ── Folder normalisation ───────────────────────────────────────────────

    describe('normaliseTemplateFolder', () => {
        it('returns the folder unchanged when already clean', () => {
            expect(normaliseTemplateFolder('templates')).toBe('templates');
        });

        it('strips leading slashes', () => {
            expect(normaliseTemplateFolder('/templates')).toBe('templates');
        });

        it('strips trailing slashes', () => {
            expect(normaliseTemplateFolder('templates/')).toBe('templates');
        });

        it('strips leading and trailing slashes', () => {
            expect(normaliseTemplateFolder('/templates/')).toBe('templates');
        });

        it('strips backslashes', () => {
            expect(normaliseTemplateFolder('\\templates\\')).toBe('templates');
        });

        it('returns empty string for blank input', () => {
            expect(normaliseTemplateFolder('')).toBe('');
        });

        it('returns empty string for whitespace-only input', () => {
            expect(normaliseTemplateFolder('   ')).toBe('');
        });

        it('trims surrounding whitespace', () => {
            expect(normaliseTemplateFolder('  templates  ')).toBe('templates');
        });

        it('preserves nested folder paths', () => {
            expect(normaliseTemplateFolder('notes/templates')).toBe('notes/templates');
        });
    });

    // ── Path construction ──────────────────────────────────────────────────

    describe('computeTemplateFolderPath', () => {
        it('computes path with default folder', () => {
            expect(computeTemplateFolderPath('/workspace', 'templates')).toBe('/workspace/templates');
        });

        it('computes path with custom folder', () => {
            expect(computeTemplateFolderPath('/workspace', 'my/templates')).toBe('/workspace/my/templates');
        });

        it('computes path when folder is empty (workspace root)', () => {
            expect(computeTemplateFolderPath('/workspace', '')).toBe('/workspace');
        });

        it('normalises folder with extra slashes', () => {
            expect(computeTemplateFolderPath('/workspace', '/templates/')).toBe('/workspace/templates');
        });
    });

    // ── Placeholder replacement ────────────────────────────────────────────

    describe('applyTemplatePlaceholders', () => {
        const baseContext: TemplateContext = {
            now: new Date(2026, 2, 18, 14, 30, 45), // 2026-03-18 14:30:45
            filename: 'My Page',
        };

        // Named placeholders

        it('replaces {{date}} with YYYY-MM-DD', () => {
            expect(applyTemplatePlaceholders('# {{date}}', baseContext)).toBe('# 2026-03-18');
        });

        it('replaces {{time}} with HH:mm:ss', () => {
            expect(applyTemplatePlaceholders('at {{time}}', baseContext)).toBe('at 14:30:45');
        });

        it('replaces {{datetime}} with YYYY-MM-DD HH:mm:ss', () => {
            expect(applyTemplatePlaceholders('{{datetime}}', baseContext)).toBe('2026-03-18 14:30:45');
        });

        it('replaces {{filename}} with the current filename', () => {
            expect(applyTemplatePlaceholders('# {{filename}}', baseContext)).toBe('# My Page');
        });

        it('replaces {{title}} as alias for filename', () => {
            expect(applyTemplatePlaceholders('# {{title}}', baseContext)).toBe('# My Page');
        });

        it('replaces {{cursor}} with the cursor sentinel', () => {
            expect(applyTemplatePlaceholders('text{{cursor}}more', baseContext)).toBe(`text${CURSOR_SENTINEL}more`);
        });

        // Multiple placeholders

        it('replaces multiple different placeholders', () => {
            const result = applyTemplatePlaceholders('# {{title}}\n\nCreated: {{date}}', baseContext);
            expect(result).toBe('# My Page\n\nCreated: 2026-03-18');
        });

        it('replaces multiple occurrences of the same placeholder', () => {
            const result = applyTemplatePlaceholders('{{date}} and {{date}}', baseContext);
            expect(result).toBe('2026-03-18 and 2026-03-18');
        });

        // Custom date formats

        it('replaces custom date format {{YYYY-MM-DD}}', () => {
            expect(applyTemplatePlaceholders('{{YYYY-MM-DD}}', baseContext)).toBe('2026-03-18');
        });

        it('replaces custom date format {{DD/MM/YYYY}}', () => {
            expect(applyTemplatePlaceholders('{{DD/MM/YYYY}}', baseContext)).toBe('18/03/2026');
        });

        it('replaces custom date format {{HH:mm}}', () => {
            expect(applyTemplatePlaceholders('{{HH:mm}}', baseContext)).toBe('14:30');
        });

        it('replaces custom date format {{YYYY-MM-DD-HH:mm:ss}}', () => {
            expect(applyTemplatePlaceholders('{{YYYY-MM-DD-HH:mm:ss}}', baseContext)).toBe('2026-03-18-14:30:45');
        });

        it('replaces custom date format {{YYYY_MM_DD}}', () => {
            expect(applyTemplatePlaceholders('{{YYYY_MM_DD}}', baseContext)).toBe('2026_03_18');
        });

        // Escape mechanism

        it('leaves escaped placeholders as literal text', () => {
            expect(applyTemplatePlaceholders('\\{{date}}', baseContext)).toBe('{{date}}');
        });

        it('handles escaped and non-escaped in same content', () => {
            const result = applyTemplatePlaceholders('\\{{date}} vs {{date}}', baseContext);
            expect(result).toBe('{{date}} vs 2026-03-18');
        });

        it('handles multiple escaped placeholders', () => {
            const result = applyTemplatePlaceholders('\\{{date}} and \\{{time}}', baseContext);
            expect(result).toBe('{{date}} and {{time}}');
        });

        // Edge cases

        it('returns content unchanged when no placeholders present', () => {
            const content = '# Just some text\n\nNo placeholders here.';
            expect(applyTemplatePlaceholders(content, baseContext)).toBe(content);
        });

        it('leaves unknown placeholders as-is', () => {
            expect(applyTemplatePlaceholders('{{unknown}}', baseContext)).toBe('{{unknown}}');
        });

        it('handles empty content', () => {
            expect(applyTemplatePlaceholders('', baseContext)).toBe('');
        });

        it('handles whitespace inside placeholder braces', () => {
            expect(applyTemplatePlaceholders('{{ date }}', baseContext)).toBe('2026-03-18');
        });

        it('works with the default journal template', () => {
            const result = applyTemplatePlaceholders(DEFAULT_JOURNAL_TEMPLATE, baseContext);
            expect(result).toBe('# 2026-03-18\n');
        });

        // Zero-padding

        it('zero-pads single-digit month and day', () => {
            const ctx: TemplateContext = {
                now: new Date(2025, 0, 5, 3, 7, 9), // 2025-01-05 03:07:09
                filename: 'Test',
            };
            expect(applyTemplatePlaceholders('{{date}}', ctx)).toBe('2025-01-05');
            expect(applyTemplatePlaceholders('{{time}}', ctx)).toBe('03:07:09');
        });
    });
});
