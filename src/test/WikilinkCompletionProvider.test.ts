import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexService } from '../IndexService.js';
import { findInnermostOpenBracket, findMatchingCloseBracket, isLineInsideFrontMatter } from '../CompletionUtils.js';

// ── Bracket detection ──────────────────────────────────────────────────────

describe('WikilinkCompletionProvider — findInnermostOpenBracket', () => {
    const find = findInnermostOpenBracket;

    it('should return -1 for text without [[', () => {
        expect(find('hello world')).toBe(-1);
        expect(find('')).toBe(-1);
        expect(find('single [ bracket')).toBe(-1);
    });

    it('should detect a simple [[ at the start', () => {
        expect(find('[[')).toBe(0);
    });

    it('should detect [[ after text', () => {
        expect(find('See [[')).toBe(4);
    });

    it('should detect [[ with text typed after it', () => {
        expect(find('See [[My Pa')).toBe(4);
    });

    it('should return -1 when [[ is already closed by ]]', () => {
        expect(find('See [[Page]]')).toBe(-1);
        expect(find('[[Page]] and more')).toBe(-1);
    });

    it('should detect the innermost [[ in nested wikilinks', () => {
        // Typing: [[Outer [[
        expect(find('[[Outer [[')).toBe(8);
    });

    it('should detect innermost unclosed [[ after inner is closed', () => {
        // Typing: [[Outer [[Inner]] more text
        // The inner [[ is closed, so the still-open [[ is the outer at col 0
        expect(find('[[Outer [[Inner]] more text')).toBe(0);
    });

    it('should return -1 when all brackets are closed', () => {
        expect(find('[[Outer [[Inner]] text]]')).toBe(-1);
    });

    it('should handle multiple unclosed brackets — return innermost', () => {
        // [[A [[B [[
        expect(find('[[A [[B [[')).toBe(8);
    });

    it('should handle partially closed nested brackets', () => {
        // [[A [[B]] [[C
        // First [[ at 0 open, [[B]] closed, [[C at 10 open — innermost is 10
        expect(find('[[A [[B]] [[C')).toBe(10);
    });

    it('should handle single [ not triggering', () => {
        expect(find('text [ more text')).toBe(-1);
    });
});

// ── Close-bracket detection ────────────────────────────────────────────────

describe('WikilinkCompletionProvider — findMatchingCloseBracket', () => {
    const find = findMatchingCloseBracket;

    it('should return -1 when no ]] exists', () => {
        expect(find('some text')).toBe(-1);
        expect(find('')).toBe(-1);
        expect(find('single ] bracket')).toBe(-1);
    });

    it('should find ]] at the start of text', () => {
        // text after cursor is "]]"
        expect(find(']]')).toBe(2);
    });

    it('should find ]] with text before it', () => {
        // text after cursor is "remaining]]"
        expect(find('remaining]]')).toBe(11);
    });

    it('should find ]] with text after it', () => {
        // text after cursor is "]] more stuff"
        expect(find(']] more stuff')).toBe(2);
    });

    it('should skip nested [[...]] and find the outer ]]', () => {
        // text after cursor is "[[Inner]] stuff]]"
        // The [[Inner]] pair balances out, so the outer ]] at the end matches
        expect(find('[[Inner]] stuff]]')).toBe(17);
    });

    it('should return -1 when only nested pairs exist (no outer close)', () => {
        // text after cursor is "[[Inner]] more"
        // The [[Inner]] balances, and there's no further ]] to close our bracket
        expect(find('[[Inner]] more')).toBe(-1);
    });

    it('should handle immediate ]] after nested pair', () => {
        // text after cursor is "[[A]]]]"
        // [[A]] balances (depth 0), then ]] → depth -1 → match at pos 7
        expect(find('[[A]]]]')).toBe(7);
    });

    it('should handle deeply nested brackets', () => {
        // text after cursor is "[[a [[b]] c]]]]"
        // [[a opens (depth 1), [[b opens (depth 2), ]] closes b (depth 1),
        // ]] closes a (depth 0), ]] closes ours (depth -1) → pos 15
        expect(find('[[a [[b]] c]]]]')).toBe(15);
    });

    it('should handle ]] with trailing text after matching close', () => {
        // text after cursor is "]] and [[Other]]"
        expect(find(']] and [[Other]]')).toBe(2);
    });
});

// ── Front matter detection ─────────────────────────────────────────────────

describe('WikilinkCompletionProvider — isLineInsideFrontMatter', () => {
    const check = isLineInsideFrontMatter;

    it('should return false when no front matter exists', () => {
        const lines = ['# Heading', '', 'Some text'];
        expect(check(lines, 0)).toBe(false);
        expect(check(lines, 2)).toBe(false);
    });

    it('should return true for lines inside front matter', () => {
        const lines = ['---', 'aliases: [Foo]', '---', '', 'Body text'];
        // Line 0 (---), line 1 (aliases), line 2 (---) are all "inside"
        expect(check(lines, 0)).toBe(true);
        expect(check(lines, 1)).toBe(true);
        expect(check(lines, 2)).toBe(true);
    });

    it('should return false for lines after front matter', () => {
        const lines = ['---', 'aliases: [Foo]', '---', '', 'Body text [['];
        expect(check(lines, 3)).toBe(false);
        expect(check(lines, 4)).toBe(false);
    });

    it('should treat unclosed front matter as covering entire document', () => {
        const lines = ['---', 'aliases: [Foo]', 'more stuff'];
        expect(check(lines, 0)).toBe(true);
        expect(check(lines, 1)).toBe(true);
        expect(check(lines, 2)).toBe(true);
    });

    it('should return false for empty document', () => {
        expect(check([], 0)).toBe(false);
    });

    it('should return false when first line is not ---', () => {
        const lines = ['not front matter', '---', 'stuff', '---'];
        expect(check(lines, 0)).toBe(false);
        expect(check(lines, 1)).toBe(false);
    });
});

// ── Completion item building (integration with IndexService) ───────────────

describe('WikilinkCompletionProvider — completion item cache', () => {
    let service: IndexService;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
    });

    afterEach(() => {
        service.close();
    });

    it('should build page items from index with stem as label', () => {
        service.indexFileContent('notes/My Page.md', 'My Page.md', '# My Page', 1000);
        service.indexFileContent('Other.md', 'Other.md', '# Other', 1000);

        const pages = service.getAllPages();
        expect(pages).toHaveLength(2);

        // Verify page stems would be correct
        for (const page of pages) {
            const stem = page.filename.endsWith('.md')
                ? page.filename.slice(0, -3)
                : page.filename;
            expect(stem.length).toBeGreaterThan(0);
        }
    });

    it('should build alias items from index with canonical page info', () => {
        const content = '---\naliases:\n  - Quick Ref\n  - QR\n---\n\n# Full Page Name';
        service.indexFileContent('sub/Full Page Name.md', 'Full Page Name.md', content, 1000);

        const aliases = service.getAllAliases();
        expect(aliases).toHaveLength(2);
        expect(aliases.map(a => a.alias_name).sort()).toEqual(['QR', 'Quick Ref']);
        expect(aliases[0].canonical_filename).toBe('Full Page Name.md');
    });

    it('should sort pages alphabetically before aliases', () => {
        service.indexFileContent('Bravo.md', 'Bravo.md', '# Bravo', 1000);
        const aliasContent = '---\naliases: [Alpha Alias]\n---\n\n# Zulu';
        service.indexFileContent('Zulu.md', 'Zulu.md', aliasContent, 1000);

        const pages = service.getAllPages();
        const aliases = service.getAllAliases();

        // Pages get sortText prefix "0-", aliases get "1-"
        // "0-bravo" < "0-zulu" < "1-alpha alias" — pages always before aliases
        const pageSorts = pages.map(p => {
            const stem = p.filename.slice(0, -3);
            return `0-${stem.toLowerCase()}`;
        });
        const aliasSorts = aliases.map(a => `1-${a.alias_name.toLowerCase()}`);

        const combined = [...pageSorts, ...aliasSorts].sort();
        // All page sorts should come before alias sorts
        expect(combined[0].startsWith('0-')).toBe(true);
        expect(combined[combined.length - 1].startsWith('1-')).toBe(true);
    });

    it('should detect duplicate filenames for disambiguation', () => {
        service.indexFileContent('notes/Topic.md', 'Topic.md', '# Topic in notes', 1000);
        service.indexFileContent('archive/Topic.md', 'Topic.md', '# Topic in archive', 1000);
        service.indexFileContent('Unique.md', 'Unique.md', '# Unique', 1000);

        const pages = service.getAllPages();
        const filenameCount = new Map<string, number>();
        for (const page of pages) {
            const lower = page.filename.toLowerCase();
            filenameCount.set(lower, (filenameCount.get(lower) ?? 0) + 1);
        }

        expect(filenameCount.get('topic.md')).toBe(2);
        expect(filenameCount.get('unique.md')).toBe(1);
    });
});
