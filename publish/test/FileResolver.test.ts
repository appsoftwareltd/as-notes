import { describe, it, expect } from 'vitest';
import { FileResolver, slugify } from '../src/FileResolver.js';

describe('slugify', () => {
    it('should lowercase and hyphenate', () => {
        expect(slugify('My Cool Page')).toBe('my-cool-page');
    });

    it('should handle underscores', () => {
        expect(slugify('my_page_name')).toBe('my-page-name');
    });

    it('should remove special characters', () => {
        expect(slugify('Page & Notes!')).toBe('page-notes');
    });

    it('should collapse consecutive hyphens', () => {
        expect(slugify('Page -- Something')).toBe('page-something');
    });

    it('should trim leading/trailing hyphens', () => {
        expect(slugify('-Leading-')).toBe('leading');
    });

    it('should keep index as index', () => {
        expect(slugify('index')).toBe('index');
    });

    it('should handle already-slugified names', () => {
        expect(slugify('my-page')).toBe('my-page');
    });

    it('should handle names with numbers', () => {
        expect(slugify('Chapter 1 Introduction')).toBe('chapter-1-introduction');
    });

    it('should handle mixed case', () => {
        expect(slugify('Getting Started')).toBe('getting-started');
    });
});

describe('FileResolver', () => {
    describe('basic resolution', () => {
        it('should resolve a page name to its slugified .html href', () => {
            const resolver = new FileResolver(['index.md', 'Wikilinks.md']);
            expect(resolver.resolve('Wikilinks')).toBe('wikilinks.html');
        });

        it('should resolve index page', () => {
            const resolver = new FileResolver(['index.md', 'Wikilinks.md']);
            expect(resolver.resolve('index')).toBe('index.html');
        });

        it('should return a slugified .html href for missing targets', () => {
            const resolver = new FileResolver(['index.md']);
            expect(resolver.resolve('NonExistent')).toBe('nonexistent.html');
        });
    });

    describe('case-insensitive matching', () => {
        it('should resolve case-insensitively', () => {
            const resolver = new FileResolver(['Wikilinks.md']);
            expect(resolver.resolve('wikilinks')).toBe('wikilinks.html');
        });

        it('should resolve uppercase input to slugified href', () => {
            const resolver = new FileResolver(['Wikilinks.md']);
            expect(resolver.resolve('WIKILINKS')).toBe('wikilinks.html');
        });
    });

    describe('slug formatting', () => {
        it('should slugify spaces in page names', () => {
            const resolver = new FileResolver(['My Page.md']);
            expect(resolver.resolve('My Page')).toBe('my-page.html');
        });

        it('should slugify special characters', () => {
            const resolver = new FileResolver(['Page & Notes.md']);
            expect(resolver.resolve('Page & Notes')).toBe('page-notes.html');
        });
    });

    describe('WikilinkResolverFn compatibility', () => {
        it('should work as a WikilinkResolverFn via createResolverFn', () => {
            const resolver = new FileResolver(['index.md', 'Topics.md']);
            const resolverFn = resolver.createResolverFn();
            expect(resolverFn('Topics', {})).toBe('topics.html');
        });

        it('should handle missing pages in resolver fn', () => {
            const resolver = new FileResolver(['index.md']);
            const resolverFn = resolver.createResolverFn();
            expect(resolverFn('Missing', {})).toBe('missing.html');
        });
    });

    describe('page listing', () => {
        it('should list all pages for nav generation', () => {
            const resolver = new FileResolver(['index.md', 'Wikilinks.md', 'Getting Started.md']);
            const pages = resolver.listPages();
            expect(pages).toEqual([
                { name: 'index', href: 'index.html' },
                { name: 'Getting Started', href: 'getting-started.html' },
                { name: 'Wikilinks', href: 'wikilinks.html' },
            ]);
        });

        it('should put index first, then sort alphabetically', () => {
            const resolver = new FileResolver(['Zebra.md', 'index.md', 'Alpha.md']);
            const pages = resolver.listPages();
            expect(pages.map(p => p.name)).toEqual(['index', 'Alpha', 'Zebra']);
        });
    });

    describe('missing target tracking', () => {
        it('should track missing targets when resolved', () => {
            const resolver = new FileResolver(['index.md']);
            resolver.resolve('MissingPage');
            resolver.resolve('AnotherMissing');
            expect(resolver.getMissingTargets()).toEqual(new Set(['MissingPage', 'AnotherMissing']));
        });

        it('should not track existing pages as missing', () => {
            const resolver = new FileResolver(['index.md', 'Wikilinks.md']);
            resolver.resolve('Wikilinks');
            resolver.resolve('index');
            expect(resolver.getMissingTargets()).toEqual(new Set());
        });

        it('should deduplicate missing targets', () => {
            const resolver = new FileResolver(['index.md']);
            resolver.resolve('Missing');
            resolver.resolve('Missing');
            resolver.resolve('missing'); // case-insensitive duplicate
            expect(resolver.getMissingTargets()).toEqual(new Set(['Missing']));
        });

        it('should slugify missing target hrefs', () => {
            const resolver = new FileResolver(['index.md']);
            expect(resolver.resolve('Missing Page')).toBe('missing-page.html');
            expect(resolver.getMissingTargets()).toEqual(new Set(['Missing Page']));
        });

        it('should track missing targets through createResolverFn', () => {
            const resolver = new FileResolver(['index.md']);
            const resolverFn = resolver.createResolverFn();
            resolverFn('MissingViaFn', {});
            expect(resolver.getMissingTargets()).toEqual(new Set(['MissingViaFn']));
        });

        it('should resolve by slug fallback when underscores match hyphens', () => {
            const resolver = new FileResolver(['2026-03-01.md']);
            expect(resolver.resolve('2026_03_01')).toBe('2026-03-01.html');
            expect(resolver.getMissingTargets()).toEqual(new Set());
        });

        it('should resolve by slug fallback when spaces match hyphens', () => {
            const resolver = new FileResolver(['my-page.md']);
            expect(resolver.resolve('my page')).toBe('my-page.html');
            expect(resolver.getMissingTargets()).toEqual(new Set());
        });

        it('should not false-match slug fallback for genuinely missing pages', () => {
            const resolver = new FileResolver(['2026-03-01.md']);
            resolver.resolve('2026_04_01');
            expect(resolver.getMissingTargets()).toEqual(new Set(['2026_04_01']));
        });
    });
});
