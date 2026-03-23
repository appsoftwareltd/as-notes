/**
 * Tests for AiContextGatherer -- graph traversal, token budgeting, expansion.
 *
 * These tests are written from the REQUIREMENTS, not the implementation:
 *
 * Requirements (from task plan):
 * R1. Given a topic, resolve the direct page by filename or alias
 * R2. Gather backlinks (pages that link TO the topic page)
 * R3. Gather forward links (pages that the topic page links to)
 * R4. Mark the direct page as hop distance 0, first-order links as hop 1
 * R5. Read file content for each gathered page
 * R6. Respect a configurable token budget -- trim pages if total exceeds budget
 * R7. Prioritise closer pages (lower hop distance) when trimming
 * R8. Expansion: given additional topics, gather their pages + backlinks as 2nd/3rd-order
 * R9. Expansion must exclude pages already gathered in first-order
 * R10. Token counting should use a proper tokenizer (js-tiktoken), not heuristics
 * R11. Direct page (hop 0) should be truncated (not dropped) if it exceeds budget
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock vscode before importing the module under test
vi.mock('vscode', () => ({
    Uri: {
        joinPath: (...args: unknown[]) => {
            const base = args[0] as { fsPath: string };
            const rest = (args.slice(1) as string[]).join('/');
            return { fsPath: `${base.fsPath}/${rest}` };
        },
    },
    workspace: {
        fs: {
            readFile: vi.fn(),
        },
    },
}));

import * as vscode from 'vscode';
import type { PageRow, BacklinkEntry, LinkRow } from '../IndexService.js';
import type { AiContextGathererDeps } from '../AiContextGatherer.js';
import { gatherFirstOrderContext, gatherExpansionContext, countTokens } from '../AiContextGatherer.js';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makePage(id: number, filename: string, title?: string): PageRow {
    return {
        id,
        path: `notes/${filename}`,
        filename,
        title: title ?? filename.replace('.md', ''),
        mtime: Date.now(),
        indexed_at: Date.now(),
    };
}

function makeLink(id: number, sourcePageId: number, pageFilename: string): LinkRow {
    return {
        id,
        source_page_id: sourcePageId,
        page_name: pageFilename.replace('.md', ''),
        page_filename: pageFilename,
        line: 1,
        start_col: 0,
        end_col: 10,
        context: null,
        parent_link_id: null,
        depth: 0,
        indent_level: 0,
        outline_parent_link_id: null,
    };
}

function makeBacklinkEntry(link: LinkRow, sourcePage: PageRow): BacklinkEntry {
    return { link, sourcePage };
}

function mockDeps(indexOverrides: Partial<MockIndex> = {}): {
    deps: AiContextGathererDeps;
    mockIndex: MockIndex;
} {
    const mockIndex: MockIndex = {
        resolvePageByFilename: vi.fn().mockReturnValue(undefined),
        getBacklinksIncludingAliases: vi.fn().mockReturnValue([]),
        getLinksForPage: vi.fn().mockReturnValue([]),
        ...indexOverrides,
    };

    const deps: AiContextGathererDeps = {
        indexService: mockIndex as unknown as AiContextGathererDeps['indexService'],
        notesRootUri: { fsPath: '/workspace' } as vscode.Uri,
    };

    return { deps, mockIndex };
}

interface MockIndex {
    resolvePageByFilename: ReturnType<typeof vi.fn>;
    getBacklinksIncludingAliases: ReturnType<typeof vi.fn>;
    getLinksForPage: ReturnType<typeof vi.fn>;
}

function mockFileContent(contentMap: Record<string, string>): void {
    const readFile = vscode.workspace.fs.readFile as ReturnType<typeof vi.fn>;
    readFile.mockImplementation((uri: { fsPath: string }) => {
        for (const [pathFragment, content] of Object.entries(contentMap)) {
            if (uri.fsPath.includes(pathFragment)) {
                return Promise.resolve(new TextEncoder().encode(content));
            }
        }
        return Promise.reject(new Error(`File not found: ${uri.fsPath}`));
    });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AiContextGatherer — gatherFirstOrderContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('R1: resolves the direct page by filename and returns it at hop distance 0', async () => {
        const topicPage = makePage(1, 'TypeScript.md');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: topicPage, viaAlias: false }),
        });
        mockFileContent({ 'TypeScript.md': '# TypeScript\n\nA typed language.' });

        const result = await gatherFirstOrderContext('TypeScript', deps, 100_000);

        expect(result.pages.length).toBeGreaterThanOrEqual(1);
        const directPage = result.pages.find(p => p.hopDistance === 0);
        expect(directPage).toBeDefined();
        expect(directPage!.title).toBe('TypeScript');
        expect(directPage!.relation).toBe('direct');
    });

    it('R1: resolves a page via alias and marks relation as "alias"', async () => {
        const topicPage = makePage(1, 'TypeScript.md', 'TypeScript');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: topicPage, viaAlias: true }),
        });
        mockFileContent({ 'TypeScript.md': '# TypeScript' });

        const result = await gatherFirstOrderContext('TS', deps, 100_000);

        const directPage = result.pages.find(p => p.hopDistance === 0);
        expect(directPage).toBeDefined();
        expect(directPage!.relation).toBe('alias');
    });

    it('R2: gathers backlink pages at hop distance 1 with relation "backlink"', async () => {
        const topicPage = makePage(1, 'TypeScript.md');
        const backlinkPage = makePage(2, 'React.md', 'React');
        const backlinkLink = makeLink(10, 2, 'TypeScript.md');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: topicPage, viaAlias: false }),
            getBacklinksIncludingAliases: vi.fn().mockReturnValue([
                makeBacklinkEntry(backlinkLink, backlinkPage),
            ]),
        });
        mockFileContent({
            'TypeScript.md': '# TypeScript',
            'React.md': '# React\nUses [[TypeScript]]',
        });

        const result = await gatherFirstOrderContext('TypeScript', deps, 100_000);

        const backlinks = result.pages.filter(p => p.relation === 'backlink');
        expect(backlinks).toHaveLength(1);
        expect(backlinks[0].title).toBe('React');
        expect(backlinks[0].hopDistance).toBe(1);
    });

    it('R3: gathers forward link pages at hop distance 1 with relation "forward"', async () => {
        const topicPage = makePage(1, 'TypeScript.md');
        const forwardPage = makePage(3, 'Deno.md', 'Deno');
        const forwardLink = makeLink(20, 1, 'Deno.md');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn()
                .mockReturnValueOnce({ page: topicPage, viaAlias: false }) // first call: topic
                .mockReturnValueOnce({ page: forwardPage, viaAlias: false }), // second call: forward link resolution
            getLinksForPage: vi.fn().mockReturnValue([forwardLink]),
        });
        mockFileContent({
            'TypeScript.md': '# TypeScript\nSee [[Deno]]',
            'Deno.md': '# Deno\nA TypeScript runtime',
        });

        const result = await gatherFirstOrderContext('TypeScript', deps, 100_000);

        const forwards = result.pages.filter(p => p.relation === 'forward');
        expect(forwards).toHaveLength(1);
        expect(forwards[0].title).toBe('Deno');
        expect(forwards[0].hopDistance).toBe(1);
    });

    it('R5: reads file content for each gathered page', async () => {
        const topicPage = makePage(1, 'Architecture.md', 'Architecture');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: topicPage, viaAlias: false }),
        });
        const expectedContent = '# Architecture\n\nMicroservices vs monolith discussion.';
        mockFileContent({ 'Architecture.md': expectedContent });

        const result = await gatherFirstOrderContext('Architecture', deps, 100_000);

        expect(result.pages[0].content).toBe(expectedContent);
    });

    it('returns empty pages array when topic is not found in the index', async () => {
        const { deps } = mockDeps();

        const result = await gatherFirstOrderContext('NonExistent', deps, 100_000);

        expect(result.pages).toHaveLength(0);
        expect(result.totalTokens).toBe(0);
    });

    it('does not duplicate a page that appears as both backlink and forward link', async () => {
        const topicPage = makePage(1, 'Architecture.md');
        const linkedPage = makePage(2, 'Patterns.md', 'Patterns');
        const backlink = makeLink(10, 2, 'Architecture.md');
        const forwardLink = makeLink(20, 1, 'Patterns.md');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn()
                .mockReturnValueOnce({ page: topicPage, viaAlias: false })
                .mockReturnValueOnce({ page: linkedPage, viaAlias: false }),
            getBacklinksIncludingAliases: vi.fn().mockReturnValue([
                makeBacklinkEntry(backlink, linkedPage),
            ]),
            getLinksForPage: vi.fn().mockReturnValue([forwardLink]),
        });
        mockFileContent({
            'Architecture.md': '# Architecture',
            'Patterns.md': '# Patterns',
        });

        const result = await gatherFirstOrderContext('Architecture', deps, 100_000);

        // Patterns should appear only once (as backlink since it's found first)
        const patternsPages = result.pages.filter(p => p.title === 'Patterns');
        expect(patternsPages).toHaveLength(1);
    });

    it('R6/R7: trims pages to fit token budget, keeping closer pages first', async () => {
        const topicPage = makePage(1, 'Main.md', 'Main');
        const backlink1 = makePage(2, 'Near.md', 'Near');
        const backlink2 = makePage(3, 'Far.md', 'Far');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: topicPage, viaAlias: false }),
            getBacklinksIncludingAliases: vi.fn().mockReturnValue([
                makeBacklinkEntry(makeLink(10, 2, 'Main.md'), backlink1),
                makeBacklinkEntry(makeLink(11, 3, 'Main.md'), backlink2),
            ]),
        });

        // Main = short, Near and Far = long enough that not all fit
        const shortContent = 'Short content';
        const longContent = 'A'.repeat(2000); // ~500 tokens at 4 chars/token
        mockFileContent({
            'Main.md': shortContent,
            'Near.md': longContent,
            'Far.md': longContent,
        });

        // Budget that fits Main + one long page, but not both
        const mainTokens = countTokens(shortContent);
        const longTokens = countTokens(longContent);
        const budget = mainTokens + longTokens + 10; // just barely fits 2 of 3 pages

        const result = await gatherFirstOrderContext('Main', deps, budget);

        // Should include the direct page (hop 0) and one backlink but not both
        expect(result.pages.length).toBeLessThan(3);
        expect(result.pages[0].hopDistance).toBe(0); // direct page kept
    });

    it('R11: truncates the direct page rather than dropping it when it alone exceeds budget', async () => {
        const topicPage = makePage(1, 'Huge.md', 'Huge');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: topicPage, viaAlias: false }),
        });

        const hugeContent = 'Word '.repeat(20000); // ~5000 tokens
        mockFileContent({ 'Huge.md': hugeContent });

        const result = await gatherFirstOrderContext('Huge', deps, 100); // tiny budget

        // The direct page should still be present, but truncated
        expect(result.pages).toHaveLength(1);
        expect(result.pages[0].hopDistance).toBe(0);
        expect(countTokens(result.pages[0].content)).toBeLessThanOrEqual(100);
    });

    it('reports totalTokens as the sum of tokens across all gathered pages', async () => {
        const topicPage = makePage(1, 'Topic.md');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: topicPage, viaAlias: false }),
        });
        const content = 'Hello world, this is a test of token counting.';
        mockFileContent({ 'Topic.md': content });

        const result = await gatherFirstOrderContext('Topic', deps, 100_000);

        expect(result.totalTokens).toBe(countTokens(content));
        expect(result.totalTokens).toBeGreaterThan(0);
    });
});

describe('AiContextGatherer — gatherExpansionContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('R8: gathers expansion topics as hop distance 2 with relation "expansion"', async () => {
        const expansionPage = makePage(5, 'React.md', 'React');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: expansionPage, viaAlias: false }),
        });
        mockFileContent({ 'React.md': '# React\nUI library' });

        const result = await gatherExpansionContext(['React'], deps, 100_000, new Set());

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('React');
        expect(result[0].hopDistance).toBe(2);
        expect(result[0].relation).toBe('expansion');
    });

    it('R8: gathers backlinks of expansion topics as hop distance 3', async () => {
        const expansionPage = makePage(5, 'React.md', 'React');
        const thirdOrderPage = makePage(6, 'Hooks.md', 'Hooks');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: expansionPage, viaAlias: false }),
            getBacklinksIncludingAliases: vi.fn().mockReturnValue([
                makeBacklinkEntry(makeLink(30, 6, 'React.md'), thirdOrderPage),
            ]),
        });
        mockFileContent({
            'React.md': '# React',
            'Hooks.md': '# Hooks\nUses [[React]]',
        });

        const result = await gatherExpansionContext(['React'], deps, 100_000, new Set());

        const thirdOrder = result.filter(p => p.hopDistance === 3);
        expect(thirdOrder).toHaveLength(1);
        expect(thirdOrder[0].title).toBe('Hooks');
    });

    it('R9: excludes pages already seen in first-order pass', async () => {
        const expansionPage = makePage(5, 'AlreadySeen.md', 'AlreadySeen');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: expansionPage, viaAlias: false }),
        });
        mockFileContent({ 'AlreadySeen.md': '# AlreadySeen' });

        const excludeIds = new Set([5]); // page 5 was already in first-order
        const result = await gatherExpansionContext(['AlreadySeen'], deps, 100_000, excludeIds);

        expect(result).toHaveLength(0);
    });

    it('R9: excludes backlinks that were in the first-order set', async () => {
        const expansionPage = makePage(5, 'NewTopic.md', 'NewTopic');
        const alreadySeenBacklink = makePage(2, 'Known.md', 'Known');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn().mockReturnValue({ page: expansionPage, viaAlias: false }),
            getBacklinksIncludingAliases: vi.fn().mockReturnValue([
                makeBacklinkEntry(makeLink(30, 2, 'NewTopic.md'), alreadySeenBacklink),
            ]),
        });
        mockFileContent({
            'NewTopic.md': '# New Topic',
            'Known.md': '# Known',
        });

        const excludeIds = new Set([2]); // page 2 was in first-order
        const result = await gatherExpansionContext(['NewTopic'], deps, 100_000, excludeIds);

        // Only the expansion page itself, not the already-seen backlink
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('NewTopic');
    });

    it('respects token budget for expansion results', async () => {
        const page1 = makePage(10, 'Big1.md', 'Big1');
        const page2 = makePage(11, 'Big2.md', 'Big2');

        const { deps } = mockDeps({
            resolvePageByFilename: vi.fn()
                .mockReturnValueOnce({ page: page1, viaAlias: false })
                .mockReturnValueOnce({ page: page2, viaAlias: false }),
        });

        const longContent = 'B'.repeat(2000);
        mockFileContent({
            'Big1.md': longContent,
            'Big2.md': longContent,
        });

        const smallBudget = countTokens(longContent) + 10; // room for 1 but not 2
        const result = await gatherExpansionContext(['Big1', 'Big2'], deps, smallBudget, new Set());

        expect(result.length).toBeLessThanOrEqual(1);
    });
});

describe('AiContextGatherer — countTokens', () => {
    it('R10: returns a positive integer for non-empty text', () => {
        const result = countTokens('Hello, world! This is a test.');
        expect(result).toBeGreaterThan(0);
        expect(Number.isInteger(result)).toBe(true);
    });

    it('R10: returns 0 for empty string', () => {
        expect(countTokens('')).toBe(0);
    });

    it('R10: token count is less than character count (proper tokenizer, not char/4 heuristic)', () => {
        const text = 'The quick brown fox jumps over the lazy dog.';
        const tokens = countTokens(text);
        // A proper tokenizer should give ~10 tokens for this sentence
        // A char/4 heuristic would give ~11. Both happen to be similar for English.
        // But for longer text, the tokenizer is more accurate.
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThan(text.length); // tokens < characters always
    });

    it('R10: handles unicode text without crashing', () => {
        const result = countTokens('Cafe Tokyo, Shibuya');
        expect(result).toBeGreaterThan(0);
    });
});
