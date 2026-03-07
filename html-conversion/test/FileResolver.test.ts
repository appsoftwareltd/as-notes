import { describe, it, expect } from 'vitest';
import { FileResolver } from '../src/FileResolver.js';

describe('FileResolver', () => {
    describe('basic resolution', () => {
        it('should resolve a page name to its .html href', () => {
            const resolver = new FileResolver(['index.md', 'Wikilinks.md']);
            expect(resolver.resolve('Wikilinks')).toBe('Wikilinks.html');
        });

        it('should resolve index page', () => {
            const resolver = new FileResolver(['index.md', 'Wikilinks.md']);
            expect(resolver.resolve('index')).toBe('index.html');
        });

        it('should return a valid .html href for missing targets', () => {
            const resolver = new FileResolver(['index.md']);
            expect(resolver.resolve('NonExistent')).toBe('NonExistent.html');
        });
    });

    describe('case-insensitive matching', () => {
        it('should resolve case-insensitively', () => {
            const resolver = new FileResolver(['Wikilinks.md']);
            expect(resolver.resolve('wikilinks')).toBe('Wikilinks.html');
        });

        it('should resolve uppercase input to original filename casing', () => {
            const resolver = new FileResolver(['Wikilinks.md']);
            expect(resolver.resolve('WIKILINKS')).toBe('Wikilinks.html');
        });
    });

    describe('URL encoding', () => {
        it('should URL-encode spaces in page names', () => {
            const resolver = new FileResolver(['My Page.md']);
            expect(resolver.resolve('My Page')).toBe('My%20Page.html');
        });

        it('should URL-encode special characters', () => {
            const resolver = new FileResolver(['Page & Notes.md']);
            expect(resolver.resolve('Page & Notes')).toBe('Page%20%26%20Notes.html');
        });
    });

    describe('WikilinkResolverFn compatibility', () => {
        it('should work as a WikilinkResolverFn via createResolverFn', () => {
            const resolver = new FileResolver(['index.md', 'Topics.md']);
            const resolverFn = resolver.createResolverFn();
            expect(resolverFn('Topics', {})).toBe('Topics.html');
        });

        it('should handle missing pages in resolver fn', () => {
            const resolver = new FileResolver(['index.md']);
            const resolverFn = resolver.createResolverFn();
            expect(resolverFn('Missing', {})).toBe('Missing.html');
        });
    });

    describe('page listing', () => {
        it('should list all pages for nav generation', () => {
            const resolver = new FileResolver(['index.md', 'Wikilinks.md', 'Getting Started.md']);
            const pages = resolver.listPages();
            expect(pages).toEqual([
                { name: 'index', href: 'index.html' },
                { name: 'Getting Started', href: 'Getting%20Started.html' },
                { name: 'Wikilinks', href: 'Wikilinks.html' },
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

        it('should URL-encode missing target hrefs', () => {
            const resolver = new FileResolver(['index.md']);
            expect(resolver.resolve('Missing Page')).toBe('Missing%20Page.html');
            expect(resolver.getMissingTargets()).toEqual(new Set(['Missing Page']));
        });

        it('should track missing targets through createResolverFn', () => {
            const resolver = new FileResolver(['index.md']);
            const resolverFn = resolver.createResolverFn();
            resolverFn('MissingViaFn', {});
            expect(resolver.getMissingTargets()).toEqual(new Set(['MissingViaFn']));
        });
    });
});
