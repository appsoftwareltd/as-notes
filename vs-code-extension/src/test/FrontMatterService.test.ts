import { describe, it, expect } from 'vitest';
import { FrontMatterService } from '../FrontMatterService.js';

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
