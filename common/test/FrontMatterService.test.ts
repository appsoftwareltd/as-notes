import { describe, it, expect } from 'vitest';
import { FrontMatterService } from '../src/FrontMatterService.js';

describe('FrontMatterService — extractFrontMatter', () => {
    const service = new FrontMatterService();

    it('should extract front matter between --- fences', () => {
        const content = '---\ntitle: My Page\naliases: [A, B]\n---\n\n# Body';
        expect(service.extractFrontMatter(content)).toBe('title: My Page\naliases: [A, B]');
    });

    it('should return null when no front matter exists', () => {
        const content = '# Just a heading\n\nSome text.';
        expect(service.extractFrontMatter(content)).toBeNull();
    });

    it('should return null when file does not start with ---', () => {
        const content = 'Some text\n---\naliases: [A]\n---';
        expect(service.extractFrontMatter(content)).toBeNull();
    });

    it('should return null when closing fence is missing', () => {
        const content = '---\naliases: [A, B]\n';
        expect(service.extractFrontMatter(content)).toBeNull();
    });

    it('should handle empty front matter', () => {
        const content = '---\n---\n\nBody text.';
        expect(service.extractFrontMatter(content)).toBe('');
    });

    it('should handle Windows line endings', () => {
        const content = '---\r\ntitle: Test\r\n---\r\n\r\nBody';
        expect(service.extractFrontMatter(content)).toBe('title: Test');
    });
});

describe('FrontMatterService — parseAliases', () => {
    const service = new FrontMatterService();

    it('should parse list-style aliases', () => {
        const content = '---\naliases:\n  - Alias One\n  - Alias Two\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual(['Alias One', 'Alias Two']);
    });

    it('should parse inline array aliases', () => {
        const content = '---\naliases: [Alias One, Alias Two]\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual(['Alias One', 'Alias Two']);
    });

    it('should parse single inline alias', () => {
        const content = '---\naliases: My Alias\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual(['My Alias']);
    });

    it('should return empty array when no front matter', () => {
        const content = '# Just a page\n\nNo front matter here.';
        expect(service.parseAliases(content)).toEqual([]);
    });

    it('should return empty array when no aliases field', () => {
        const content = '---\ntitle: My Page\ntags: [foo]\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual([]);
    });

    it('should strip accidental [[ and ]] brackets', () => {
        const content = '---\naliases:\n  - "[[Bracketed Alias]]"\n  - Normal Alias\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual(['Bracketed Alias', 'Normal Alias']);
    });

    it('should strip brackets from inline array values', () => {
        const content = '---\naliases: [[[Alias A]], Alias B]\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual(['Alias A', 'Alias B']);
    });

    it('should handle empty aliases list', () => {
        const content = '---\naliases:\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual([]);
    });

    it('should handle empty inline array', () => {
        const content = '---\naliases: []\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual([]);
    });

    it('should strip surrounding quotes from alias values', () => {
        const content = '---\naliases:\n  - "Quoted Alias"\n  - \'Single Quoted\'\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual(['Quoted Alias', 'Single Quoted']);
    });

    it('should handle aliases with mixed whitespace', () => {
        const content = '---\naliases:   [  Alias A  ,  Alias B  ]\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual(['Alias A', 'Alias B']);
    });

    it('should handle aliases field with other fields around it', () => {
        const content = '---\ntitle: My Page\naliases:\n  - A1\n  - A2\ntags: [foo]\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual(['A1', 'A2']);
    });

    it('should stop list parsing at non-list line', () => {
        const content = '---\naliases:\n  - A1\n  - A2\ntitle: Next Field\n---\n\n# Page';
        expect(service.parseAliases(content)).toEqual(['A1', 'A2']);
    });
});

describe('FrontMatterService — updateAlias', () => {
    const service = new FrontMatterService();

    it('should update an alias in list format', () => {
        const content = '---\naliases:\n  - Old Alias\n  - Other\n---\n\n# Page';
        const result = service.updateAlias(content, 'Old Alias', 'New Alias');
        expect(result).toBe('---\naliases:\n  - New Alias\n  - Other\n---\n\n# Page');
    });

    it('should update an alias in inline array format', () => {
        const content = '---\naliases: [Old Alias, Other]\n---\n\n# Page';
        const result = service.updateAlias(content, 'Old Alias', 'New Alias');
        expect(result).toBe('---\naliases: [New Alias, Other]\n---\n\n# Page');
    });

    it('should update a single inline alias', () => {
        const content = '---\naliases: Old Alias\n---\n\n# Page';
        const result = service.updateAlias(content, 'Old Alias', 'New Alias');
        expect(result).toBe('---\naliases: New Alias\n---\n\n# Page');
    });

    it('should return null when alias not found', () => {
        const content = '---\naliases:\n  - Some Alias\n---\n\n# Page';
        const result = service.updateAlias(content, 'Nonexistent', 'New');
        expect(result).toBeNull();
    });

    it('should return null when no front matter', () => {
        const content = '# Just a page';
        const result = service.updateAlias(content, 'A', 'B');
        expect(result).toBeNull();
    });

    it('should return null when no aliases field', () => {
        const content = '---\ntitle: My Page\n---\n\n# Page';
        const result = service.updateAlias(content, 'A', 'B');
        expect(result).toBeNull();
    });

    it('should preserve surrounding content', () => {
        const content = '---\ntitle: My Page\naliases:\n  - Target\ntags: [foo]\n---\n\n# Body text here\n\nMore content.';
        const result = service.updateAlias(content, 'Target', 'Updated');
        expect(result).toBe('---\ntitle: My Page\naliases:\n  - Updated\ntags: [foo]\n---\n\n# Body text here\n\nMore content.');
    });
});

describe('FrontMatterService — stripFrontMatter', () => {
    const service = new FrontMatterService();

    it('should strip front matter and return remaining content', () => {
        const content = '---\ntitle: My Page\npublic: true\n---\n\n# Hello\n\nBody text.';
        expect(service.stripFrontMatter(content)).toBe('\n# Hello\n\nBody text.');
    });

    it('should return original content when no front matter', () => {
        const content = '# Just a heading\n\nSome text.';
        expect(service.stripFrontMatter(content)).toBe(content);
    });

    it('should return original content when closing fence is missing', () => {
        const content = '---\ntitle: My Page\n';
        expect(service.stripFrontMatter(content)).toBe(content);
    });

    it('should handle empty front matter', () => {
        const content = '---\n---\n\nBody text.';
        expect(service.stripFrontMatter(content)).toBe('\nBody text.');
    });

    it('should handle Windows line endings', () => {
        const content = '---\r\ntitle: Test\r\n---\r\n\r\nBody';
        // Line endings are normalised to \n during split/join
        expect(service.stripFrontMatter(content)).toBe('\nBody');
    });

    it('should handle content immediately after closing fence', () => {
        const content = '---\ntitle: Test\n---\n# Heading';
        expect(service.stripFrontMatter(content)).toBe('# Heading');
    });
});

describe('FrontMatterService — parseFrontMatterFields', () => {
    const service = new FrontMatterService();

    it('should parse public: true', () => {
        const content = '---\npublic: true\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).public).toBe(true);
    });

    it('should parse public: false', () => {
        const content = '---\npublic: false\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).public).toBe(false);
    });

    it('should parse public: yes/no', () => {
        expect(service.parseFrontMatterFields('---\npublic: yes\n---').public).toBe(true);
        expect(service.parseFrontMatterFields('---\npublic: no\n---').public).toBe(false);
    });

    it('should parse title field', () => {
        const content = '---\ntitle: My Custom Title\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).title).toBe('My Custom Title');
    });

    it('should parse quoted title field', () => {
        const content = '---\ntitle: "My Quoted Title"\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).title).toBe('My Quoted Title');
    });

    it('should parse order field as number', () => {
        const content = '---\norder: 5\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).order).toBe(5);
    });

    it('should parse negative order', () => {
        const content = '---\norder: -1\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).order).toBe(-1);
    });

    it('should return undefined for non-numeric order', () => {
        const content = '---\norder: abc\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).order).toBeUndefined();
    });

    it('should parse description field', () => {
        const content = '---\ndescription: A brief description of the page\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).description).toBe('A brief description of the page');
    });

    it('should parse layout field', () => {
        const content = '---\nlayout: blog\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).layout).toBe('blog');
    });

    it('should parse assets: true', () => {
        const content = '---\nassets: true\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).assets).toBe(true);
    });

    it('should parse retina: true', () => {
        const content = '---\nretina: true\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).retina).toBe(true);
    });

    it('should parse draft: true', () => {
        const content = '---\ndraft: true\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).draft).toBe(true);
    });

    it('should parse date field', () => {
        const content = '---\ndate: 2026-03-23\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).date).toBe('2026-03-23');
    });

    it('should parse aliases via parseFrontMatterFields', () => {
        const content = '---\naliases: [Alias A, Alias B]\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).aliases).toEqual(['Alias A', 'Alias B']);
    });

    it('should parse aliases list style via parseFrontMatterFields', () => {
        const content = '---\naliases:\n  - Alias A\n  - Alias B\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content).aliases).toEqual(['Alias A', 'Alias B']);
    });

    it('should parse multiple fields together', () => {
        const content = '---\npublic: true\ntitle: My Page\norder: 3\ndescription: A description\nlayout: docs\ndate: 2026-01-15\n---\n\n# Page';
        const fields = service.parseFrontMatterFields(content);
        expect(fields.public).toBe(true);
        expect(fields.title).toBe('My Page');
        expect(fields.order).toBe(3);
        expect(fields.description).toBe('A description');
        expect(fields.layout).toBe('docs');
        expect(fields.date).toBe('2026-01-15');
    });

    it('should return empty object when no front matter', () => {
        const content = '# Just a page\n\nNo front matter.';
        expect(service.parseFrontMatterFields(content)).toEqual({});
    });

    it('should return empty object for empty front matter', () => {
        const content = '---\n---\n\n# Page';
        expect(service.parseFrontMatterFields(content)).toEqual({});
    });

    it('should be case-insensitive for field names', () => {
        const content = '---\nPublic: true\nTitle: My Title\n---\n\n# Page';
        const fields = service.parseFrontMatterFields(content);
        expect(fields.public).toBe(true);
        expect(fields.title).toBe('My Title');
    });

    it('should handle boolean values case-insensitively', () => {
        const content = '---\npublic: TRUE\nassets: False\n---\n\n# Page';
        const fields = service.parseFrontMatterFields(content);
        expect(fields.public).toBe(true);
        expect(fields.assets).toBe(false);
    });
});
