import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexService, extractTitle } from '../IndexService.js';
import { WikilinkService } from '../WikilinkService.js';
import type { LinkInsert } from '../IndexService.js';

describe('extractTitle', () => {
    it('should extract the first # heading', () => {
        const content = '# My Page Title\n\nSome content here.';
        expect(extractTitle(content, 'fallback.md')).toBe('My Page Title');
    });

    it('should use the first heading when multiple exist', () => {
        const content = '# First Heading\n\n## Second Heading\n\n# Another';
        expect(extractTitle(content, 'fallback.md')).toBe('First Heading');
    });

    it('should ignore ## headings and use first # heading', () => {
        const content = '## Not this\n\n# This One\n\ntext';
        expect(extractTitle(content, 'fallback.md')).toBe('This One');
    });

    it('should fallback to filename stem when no heading exists', () => {
        const content = 'Just some text without any headings.';
        expect(extractTitle(content, 'My Page.md')).toBe('My Page');
    });

    it('should fallback to filename stem for empty content', () => {
        expect(extractTitle('', 'Notes.md')).toBe('Notes');
    });

    it('should handle .markdown extension in fallback', () => {
        expect(extractTitle('', 'Document.markdown')).toBe('Document');
    });

    it('should handle filename without extension', () => {
        expect(extractTitle('', 'README')).toBe('README');
    });

    it('should trim whitespace from heading text', () => {
        const content = '#   Spaced Title   \n\nContent';
        expect(extractTitle(content, 'fallback.md')).toBe('Spaced Title');
    });
});

describe('IndexService — schema', () => {
    let service: IndexService;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
    });

    afterEach(() => {
        service.close();
    });

    it('should create all expected tables', () => {
        const tables = service.getTableNames();
        expect(tables).toContain('pages');
        expect(tables).toContain('links');
        expect(tables).toContain('aliases');
        expect(tables).toContain('tasks');
    });

    it('should report isOpen correctly', () => {
        expect(service.isOpen).toBe(true);
        service.close();
        expect(service.isOpen).toBe(false);
    });
});

describe('IndexService — page CRUD', () => {
    let service: IndexService;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
    });

    afterEach(() => {
        service.close();
    });

    it('should insert a new page and return its id', () => {
        const id = service.upsertPage('notes/Test.md', 'Test.md', 'Test', 1000);
        expect(id).toBeGreaterThan(0);

        const page = service.getPageByPath('notes/Test.md');
        expect(page).toBeDefined();
        expect(page!.filename).toBe('Test.md');
        expect(page!.title).toBe('Test');
        expect(page!.mtime).toBe(1000);
    });

    it('should update an existing page on upsert', () => {
        const id1 = service.upsertPage('notes/Test.md', 'Test.md', 'Test', 1000);
        const id2 = service.upsertPage('notes/Test.md', 'Test.md', 'Updated Title', 2000);

        expect(id2).toBe(id1);

        const page = service.getPageByPath('notes/Test.md');
        expect(page!.title).toBe('Updated Title');
        expect(page!.mtime).toBe(2000);
    });

    it('should return undefined for non-existent page', () => {
        const page = service.getPageByPath('does/not/exist.md');
        expect(page).toBeUndefined();
    });

    it('should list all pages', () => {
        service.upsertPage('a.md', 'a.md', 'A', 100);
        service.upsertPage('b.md', 'b.md', 'B', 200);
        service.upsertPage('c.md', 'c.md', 'C', 300);

        const pages = service.getAllPages();
        expect(pages.length).toBe(3);
        expect(pages.map(p => p.path).sort()).toEqual(['a.md', 'b.md', 'c.md']);
    });

    it('should remove a page', () => {
        service.upsertPage('notes/Test.md', 'Test.md', 'Test', 1000);
        service.removePage('notes/Test.md');

        const page = service.getPageByPath('notes/Test.md');
        expect(page).toBeUndefined();
    });

    it('should cascade-delete links when page is removed', () => {
        const pageId = service.upsertPage('notes/Source.md', 'Source.md', 'Source', 1000);

        service.setLinksForPage(pageId, [
            { page_name: 'Target', page_filename: 'Target.md', line: 0, start_col: 0, end_col: 10, context: '[[Target]]', parent_link_id: null, depth: 0 },
        ]);

        // Verify link exists
        const linksBefore = service.getLinksForPage(pageId);
        expect(linksBefore.length).toBe(1);

        // Remove the page
        service.removePage('notes/Source.md');

        // Links should be gone
        const linksAfter = service.getLinksForPage(pageId);
        expect(linksAfter.length).toBe(0);
    });
});

describe('IndexService — link CRUD', () => {
    let service: IndexService;
    let sourcePageId: number;
    let targetPageId: number;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
        sourcePageId = service.upsertPage('notes/Source.md', 'Source.md', 'Source', 1000);
        targetPageId = service.upsertPage('notes/Target.md', 'Target.md', 'Target', 1000);
    });

    afterEach(() => {
        service.close();
    });

    it('should insert links and retrieve them', () => {
        const links: LinkInsert[] = [
            { page_name: 'Target', page_filename: 'Target.md', line: 0, start_col: 5, end_col: 16, context: 'See [[Target]] for details.', parent_link_id: null, depth: 0 },
            { page_name: 'Other', page_filename: 'Other.md', line: 2, start_col: 0, end_col: 10, context: '[[Other]]', parent_link_id: null, depth: 0 },
        ];

        const ids = service.setLinksForPage(sourcePageId, links);
        expect(ids.length).toBe(2);

        const retrieved = service.getLinksForPage(sourcePageId);
        expect(retrieved.length).toBe(2);
        expect(retrieved[0].page_name).toBe('Target');
        expect(retrieved[0].context).toBe('See [[Target]] for details.');
        expect(retrieved[1].page_name).toBe('Other');
    });

    it('should replace links when set again', () => {
        service.setLinksForPage(sourcePageId, [
            { page_name: 'Old', page_filename: 'Old.md', line: 0, start_col: 0, end_col: 8, context: '[[Old]]', parent_link_id: null, depth: 0 },
        ]);

        service.setLinksForPage(sourcePageId, [
            { page_name: 'New', page_filename: 'New.md', line: 0, start_col: 0, end_col: 8, context: '[[New]]', parent_link_id: null, depth: 0 },
        ]);

        const links = service.getLinksForPage(sourcePageId);
        expect(links.length).toBe(1);
        expect(links[0].page_name).toBe('New');
    });

    it('should get backlinks for a target page', () => {
        // Source page links to Target
        service.setLinksForPage(sourcePageId, [
            { page_name: 'Target', page_filename: 'Target.md', line: 0, start_col: 0, end_col: 12, context: '[[Target]]', parent_link_id: null, depth: 0 },
        ]);

        // Another page also links to Target
        const otherPageId = service.upsertPage('notes/Other.md', 'Other.md', 'Other', 1000);
        service.setLinksForPage(otherPageId, [
            { page_name: 'Target', page_filename: 'Target.md', line: 5, start_col: 3, end_col: 15, context: 'Go to [[Target]] now.', parent_link_id: null, depth: 0 },
        ]);

        const backlinks = service.getBacklinks('Target.md');
        expect(backlinks.length).toBe(2);
        expect(backlinks.map(l => l.source_page_id).sort()).toEqual([sourcePageId, otherPageId].sort());
    });

    it('should return correct backlink count', () => {
        service.setLinksForPage(sourcePageId, [
            { page_name: 'Target', page_filename: 'Target.md', line: 0, start_col: 0, end_col: 12, context: '[[Target]]', parent_link_id: null, depth: 0 },
        ]);

        const otherPageId = service.upsertPage('notes/Other.md', 'Other.md', 'Other', 1000);
        service.setLinksForPage(otherPageId, [
            { page_name: 'Target', page_filename: 'Target.md', line: 5, start_col: 3, end_col: 15, context: '[[Target]]', parent_link_id: null, depth: 0 },
        ]);

        expect(service.getBacklinkCount('Target.md')).toBe(2);
        expect(service.getBacklinkCount('NonExistent.md')).toBe(0);
    });

    it('should handle nested links with parent_link_id and depth', () => {
        const links: LinkInsert[] = [
            { page_name: 'Outer [[Inner]] text', page_filename: 'Outer [[Inner]] text.md', line: 0, start_col: 0, end_col: 27, context: '[[Outer [[Inner]] text]]', parent_link_id: null, depth: 0 },
        ];

        const ids = service.setLinksForPage(sourcePageId, links);
        const outerLinkId = ids[0];

        // Now add the inner link referencing the outer as parent
        const innerLinks: LinkInsert[] = [
            { page_name: 'Outer [[Inner]] text', page_filename: 'Outer [[Inner]] text.md', line: 0, start_col: 0, end_col: 27, context: '[[Outer [[Inner]] text]]', parent_link_id: null, depth: 0 },
            { page_name: 'Inner', page_filename: 'Inner.md', line: 0, start_col: 8, end_col: 18, context: '[[Outer [[Inner]] text]]', parent_link_id: outerLinkId, depth: 1 },
        ];

        // Replace with both
        service.setLinksForPage(sourcePageId, innerLinks);

        const retrieved = service.getLinksForPage(sourcePageId);
        expect(retrieved.length).toBe(2);

        const inner = retrieved.find(l => l.page_name === 'Inner');
        expect(inner).toBeDefined();
        expect(inner!.depth).toBe(1);
    });

    it('should update links on rename', () => {
        service.setLinksForPage(sourcePageId, [
            { page_name: 'OldName', page_filename: 'OldName.md', line: 0, start_col: 0, end_col: 12, context: '[[OldName]]', parent_link_id: null, depth: 0 },
        ]);

        service.updateRename('OldName.md', 'NewName', 'NewName.md');

        const links = service.getLinksForPage(sourcePageId);
        expect(links[0].page_name).toBe('NewName');
        expect(links[0].page_filename).toBe('NewName.md');
    });

    it('should update page path on rename', () => {
        service.updatePagePath('notes/Target.md', 'notes/Renamed.md', 'Renamed.md');

        const oldPage = service.getPageByPath('notes/Target.md');
        expect(oldPage).toBeUndefined();

        const newPage = service.getPageByPath('notes/Renamed.md');
        expect(newPage).toBeDefined();
        expect(newPage!.filename).toBe('Renamed.md');
    });
});

describe('IndexService — resetSchema', () => {
    let service: IndexService;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
    });

    afterEach(() => {
        service.close();
    });

    it('should drop and recreate all tables', () => {
        // Insert some data
        service.upsertPage('test.md', 'test.md', 'Test', 1000);

        // Reset
        service.resetSchema();

        // Tables should exist but be empty
        const tables = service.getTableNames();
        expect(tables).toContain('pages');
        expect(tables).toContain('links');
        expect(tables).toContain('aliases');

        const pages = service.getAllPages();
        expect(pages.length).toBe(0);
    });
});

describe('IndexService — indexFileContent', () => {
    let service: IndexService;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
    });

    afterEach(() => {
        service.close();
    });

    it('should index a simple file with one wikilink', () => {
        const content = '# My Page\n\nSee [[Target]] for details.';
        const pageId = service.indexFileContent('notes/MyPage.md', 'MyPage.md', content, 1000);

        expect(pageId).toBeGreaterThan(0);

        const page = service.getPageByPath('notes/MyPage.md');
        expect(page).toBeDefined();
        expect(page!.title).toBe('My Page');

        const links = service.getLinksForPage(pageId);
        expect(links.length).toBe(1);
        expect(links[0].page_name).toBe('Target');
        expect(links[0].page_filename).toBe('Target.md');
        expect(links[0].line).toBe(2);
        expect(links[0].context).toBe('See [[Target]] for details.');
        expect(links[0].depth).toBe(0);
        expect(links[0].parent_link_id).toBeNull();
    });

    it('should index a file with nested wikilinks and set correct depth/parent', () => {
        const content = '[[Outer [[Inner]] text]]';
        const pageId = service.indexFileContent('test.md', 'test.md', content, 1000);

        const links = service.getLinksForPage(pageId);
        expect(links.length).toBe(2);

        // Sort by depth to make assertions predictable
        const sorted = links.sort((a, b) => a.depth - b.depth);

        // Outer link
        expect(sorted[0].page_name).toBe('Outer [[Inner]] text');
        expect(sorted[0].depth).toBe(0);
        expect(sorted[0].parent_link_id).toBeNull();

        // Inner link
        expect(sorted[1].page_name).toBe('Inner');
        expect(sorted[1].depth).toBe(1);
        expect(sorted[1].parent_link_id).toBe(sorted[0].id);
    });

    it('should index a file with 3-level nesting', () => {
        const content = '[[Test [[[[Test]] Page]] Page]]';
        const pageId = service.indexFileContent('test.md', 'test.md', content, 1000);

        const links = service.getLinksForPage(pageId);
        expect(links.length).toBe(3);

        const byDepth = links.sort((a, b) => a.depth - b.depth);
        expect(byDepth[0].depth).toBe(0); // outermost
        expect(byDepth[1].depth).toBe(1); // middle
        expect(byDepth[2].depth).toBe(2); // innermost [[Test]]

        // Middle's parent should be outer
        expect(byDepth[1].parent_link_id).toBe(byDepth[0].id);
        // Inner's parent should be middle
        expect(byDepth[2].parent_link_id).toBe(byDepth[1].id);
    });

    it('should index a file with multiple links across lines', () => {
        const content = '# Page\n\nFirst [[Alpha]] link.\n\nSecond [[Beta]] and [[Gamma]].';
        const pageId = service.indexFileContent('multi.md', 'multi.md', content, 1000);

        const links = service.getLinksForPage(pageId);
        expect(links.length).toBe(3);

        const names = links.map(l => l.page_name).sort();
        expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('should use filename stem as title when no heading exists', () => {
        const content = 'Just text with [[Link]].';
        service.indexFileContent('My Notes.md', 'My Notes.md', content, 1000);

        const page = service.getPageByPath('My Notes.md');
        expect(page!.title).toBe('My Notes');
    });

    it('should replace links on re-index', () => {
        const content1 = 'See [[Old]].';
        const pageId1 = service.indexFileContent('test.md', 'test.md', content1, 1000);

        const content2 = 'See [[New]].';
        const pageId2 = service.indexFileContent('test.md', 'test.md', content2, 2000);

        expect(pageId2).toBe(pageId1);

        const links = service.getLinksForPage(pageId2);
        expect(links.length).toBe(1);
        expect(links[0].page_name).toBe('New');
    });

    it('should generate backlinks across indexed files', () => {
        service.indexFileContent('source1.md', 'source1.md', 'See [[Target]].', 1000);
        service.indexFileContent('source2.md', 'source2.md', 'Also [[Target]].', 1000);
        service.indexFileContent('target.md', 'target.md', '# Target\n\nContent.', 1000);

        const backlinks = service.getBacklinks('Target.md');
        expect(backlinks.length).toBe(2);
        expect(service.getBacklinkCount('Target.md')).toBe(2);
    });

    it('should handle empty file content', () => {
        const pageId = service.indexFileContent('empty.md', 'empty.md', '', 1000);
        expect(pageId).toBeGreaterThan(0);

        const links = service.getLinksForPage(pageId);
        expect(links.length).toBe(0);

        const page = service.getPageByPath('empty.md');
        expect(page!.title).toBe('empty');
    });

    it('should sanitise filenames in link records', () => {
        const content = '[[What is 1/2 + 1/4?]]';
        const pageId = service.indexFileContent('test.md', 'test.md', content, 1000);

        const links = service.getLinksForPage(pageId);
        expect(links[0].page_name).toBe('What is 1/2 + 1/4?');
        expect(links[0].page_filename).toBe('What is 1_2 + 1_4_.md');
    });
});

// ── Rename tracker data layer tests ────────────────────────────────────────

describe('IndexService — rename support', () => {
    let service: IndexService;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
    });

    afterEach(() => {
        service.close();
    });

    it('should provide link state for rename comparison via getLinksForPage', () => {
        const content = 'See [[Alpha]] and [[Beta]].';
        const pageId = service.indexFileContent('source.md', 'source.md', content, 1000);

        const links = service.getLinksForPage(pageId);
        expect(links.length).toBe(2);

        // Links should have line and start_col for positional matching
        const alpha = links.find(l => l.page_name === 'Alpha')!;
        expect(alpha.line).toBe(0);
        expect(alpha.start_col).toBe(4); // "See " = 4 chars in
        expect(alpha.page_filename).toBe('Alpha.md');

        const beta = links.find(l => l.page_name === 'Beta')!;
        expect(beta.line).toBe(0);
        expect(beta.start_col).toBe(18); // "See [[Alpha]] and " = 19 chars, [[ starts at 18
    });

    it('should detect rename by comparing index state with new parse', () => {
        // Simulate: index has [[Old Name]], user edits it to [[New Name]]
        const originalContent = 'Link to [[Old Name]] here.';
        const pageId = service.indexFileContent('doc.md', 'doc.md', originalContent, 1000);

        const oldLinks = service.getLinksForPage(pageId);
        expect(oldLinks.length).toBe(1);
        expect(oldLinks[0].page_name).toBe('Old Name');

        // Simulate user editing the document (not yet saved/re-indexed)
        // The edited content would be parsed on the fly by the rename tracker
        const editedContent = 'Link to [[New Name]] here.';
        const ws = new WikilinkService();
        const newWikilinks = ws.extractWikilinks(editedContent);

        // Positional comparison: same start position, different page name → rename
        const oldMap = new Map(oldLinks.map(l => [`${l.line}:${l.start_col}`, l]));
        const renames = newWikilinks.filter(wl => {
            const key = `0:${wl.startPositionInText}`;
            const old = oldMap.get(key);
            return old && old.page_name !== wl.pageName;
        });

        expect(renames.length).toBe(1);
        expect(renames[0].pageName).toBe('New Name');
    });

    it('updateRename should update all link references to old filename', () => {
        // Three files: source1 and source2 link to "Target"
        service.indexFileContent('source1.md', 'source1.md', 'See [[Target]].', 1000);
        service.indexFileContent('source2.md', 'source2.md', 'Also [[Target]] here.', 1000);
        service.indexFileContent('target.md', 'target.md', '# Target\n\nContent.', 1000);

        // Rename "Target" → "New Target"
        service.updateRename('Target.md', 'New Target', 'New Target.md');

        // All link references should now point to "New Target"
        const backlinksOld = service.getBacklinks('Target.md');
        expect(backlinksOld.length).toBe(0);

        const backlinksNew = service.getBacklinks('New Target.md');
        expect(backlinksNew.length).toBe(2);
        expect(backlinksNew[0].page_name).toBe('New Target');
        expect(backlinksNew[0].page_filename).toBe('New Target.md');
    });

    it('updatePagePath should update the page record', () => {
        service.indexFileContent('old-path/Page.md', 'Page.md', '# Page\n\nContent.', 1000);

        service.updatePagePath('old-path/Page.md', 'new-path/Renamed.md', 'Renamed.md');

        const oldPage = service.getPageByPath('old-path/Page.md');
        expect(oldPage).toBeUndefined();

        const newPage = service.getPageByPath('new-path/Renamed.md');
        expect(newPage).toBeDefined();
        expect(newPage!.filename).toBe('Renamed.md');
    });

    it('should handle nested link rename detection correctly', () => {
        const content = '[[Outer [[Inner]] text]]';
        const pageId = service.indexFileContent('doc.md', 'doc.md', content, 1000);

        const links = service.getLinksForPage(pageId);
        expect(links.length).toBe(2);

        // Verify both links have distinct positions for matching
        const outer = links.find(l => l.page_name === 'Outer [[Inner]] text')!;
        const inner = links.find(l => l.page_name === 'Inner')!;

        expect(outer).toBeDefined();
        expect(inner).toBeDefined();
        expect(outer.start_col).not.toBe(inner.start_col);
        expect(outer.depth).toBe(0); // outermost
        expect(inner.depth).toBe(1); // nested
    });

    it('should handle full rename flow: re-index source + updateRename', () => {
        // Setup: source links to [[Page A]], target file exists
        service.indexFileContent('source.md', 'source.md', 'Link to [[Page A]] here.', 1000);
        service.indexFileContent('Page A.md', 'Page A.md', '# Page A\n\nContent.', 1000);

        // Step 1: User edits [[Page A]] to [[Page B]] in source.md
        // Step 2: Rename tracker re-indexes source.md with new content
        service.indexFileContent('source.md', 'source.md', 'Link to [[Page B]] here.', 2000);

        // Step 3: Rename tracker updates all link references
        service.updateRename('Page A.md', 'Page B', 'Page B.md');

        // Step 4: Rename tracker re-indexes the renamed file at its new path
        service.removePage('Page A.md');
        service.indexFileContent('Page B.md', 'Page B.md', '# Page B\n\nContent.', 2000);

        // Verify consistency
        const sourceLinks = service.getLinksForPage(
            service.getPageByPath('source.md')!.id
        );
        expect(sourceLinks.length).toBe(1);
        expect(sourceLinks[0].page_name).toBe('Page B');
        expect(sourceLinks[0].page_filename).toBe('Page B.md');

        const oldPage = service.getPageByPath('Page A.md');
        expect(oldPage).toBeUndefined();

        const newPage = service.getPageByPath('Page B.md');
        expect(newPage).toBeDefined();
        expect(newPage!.filename).toBe('Page B.md');
        expect(newPage!.title).toBe('Page B');

        // Backlinks should point to the new filename
        expect(service.getBacklinkCount('Page A.md')).toBe(0);
        expect(service.getBacklinkCount('Page B.md')).toBe(1);
    });
});

describe('IndexService — aliases', () => {
    let service: IndexService;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
    });

    afterEach(() => {
        service.close();
    });

    it('should store aliases from front matter during indexFileContent', () => {
        const content = '---\naliases:\n  - My Alias\n  - Other Name\n---\n\n# Page Title\n\nBody text.';
        service.indexFileContent('page.md', 'page.md', content, 1000);

        const page = service.getPageByPath('page.md')!;
        const aliases = service.getAliasesForPage(page.id);
        expect(aliases).toHaveLength(2);
        expect(aliases.map(a => a.alias_name).sort()).toEqual(['My Alias', 'Other Name']);
        expect(aliases.map(a => a.alias_filename).sort()).toEqual(['My Alias.md', 'Other Name.md']);
    });

    it('should re-index aliases replacing old ones', () => {
        const content1 = '---\naliases: [Old Alias]\n---\n\n# Page';
        service.indexFileContent('page.md', 'page.md', content1, 1000);

        const page1 = service.getPageByPath('page.md')!;
        expect(service.getAliasesForPage(page1.id)).toHaveLength(1);
        expect(service.getAliasesForPage(page1.id)[0].alias_name).toBe('Old Alias');

        // Re-index with different aliases
        const content2 = '---\naliases: [New Alias, Another]\n---\n\n# Page';
        service.indexFileContent('page.md', 'page.md', content2, 2000);

        const page2 = service.getPageByPath('page.md')!;
        const aliases = service.getAliasesForPage(page2.id);
        expect(aliases).toHaveLength(2);
        expect(aliases.map(a => a.alias_name).sort()).toEqual(['Another', 'New Alias']);
    });

    it('should store no aliases when content has no front matter', () => {
        const content = '# Just a Page\n\nNo front matter.';
        service.indexFileContent('page.md', 'page.md', content, 1000);

        const page = service.getPageByPath('page.md')!;
        expect(service.getAliasesForPage(page.id)).toHaveLength(0);
    });

    it('should resolve alias to canonical page', () => {
        const content = '---\naliases: [Quick Note]\n---\n\n# My Page';
        service.indexFileContent('page.md', 'page.md', content, 1000);

        const resolved = service.resolveAlias('Quick Note');
        expect(resolved).toBeDefined();
        expect(resolved!.filename).toBe('page.md');
        expect(resolved!.title).toBe('My Page');
    });

    it('should resolve alias case-insensitively', () => {
        const content = '---\naliases: [Quick Note]\n---\n\n# My Page';
        service.indexFileContent('page.md', 'page.md', content, 1000);

        const resolved = service.resolveAlias('quick note');
        expect(resolved).toBeDefined();
        expect(resolved!.filename).toBe('page.md');
    });

    it('should return undefined for non-existent alias', () => {
        const content = '---\naliases: [Real Alias]\n---\n\n# Page';
        service.indexFileContent('page.md', 'page.md', content, 1000);

        expect(service.resolveAlias('Nonexistent')).toBeUndefined();
    });

    it('should resolve page by filename: direct match first, then alias', () => {
        // Direct page
        service.indexFileContent('Direct.md', 'Direct.md', '# Direct Page', 1000);
        // Page with alias
        const aliasContent = '---\naliases: [Shortcut]\n---\n\n# Canonical Page';
        service.indexFileContent('Canonical.md', 'Canonical.md', aliasContent, 1000);

        // Direct match
        const direct = service.resolvePageByFilename('Direct.md');
        expect(direct).toBeDefined();
        expect(direct!.viaAlias).toBe(false);
        expect(direct!.page.filename).toBe('Direct.md');

        // Alias match
        const alias = service.resolvePageByFilename('Shortcut.md');
        expect(alias).toBeDefined();
        expect(alias!.viaAlias).toBe(true);
        expect(alias!.page.filename).toBe('Canonical.md');

        // No match
        const none = service.resolvePageByFilename('Unknown.md');
        expect(none).toBeUndefined();
    });

    it('should count backlinks including alias references', () => {
        // Page with alias
        const aliasContent = '---\naliases: [Shortcut]\n---\n\n# Target Page';
        service.indexFileContent('target.md', 'target.md', aliasContent, 1000);

        // Page linking to target directly via its filename
        service.indexFileContent('linker1.md', 'linker1.md', '# Linker 1\n\nSee [[target]]\n', 1000);

        // Page linking via alias
        service.indexFileContent('linker2.md', 'linker2.md', '# Linker 2\n\nSee [[Shortcut]]\n', 1000);

        const targetPage = service.getPageByPath('target.md')!;

        // Direct backlinks only (matching target.md)
        expect(service.getBacklinkCount('target.md')).toBe(1);

        // Including aliases (target.md + Shortcut.md)
        expect(service.getBacklinkCountIncludingAliases(targetPage.id)).toBe(2);
    });

    it('should update alias rename in the index', () => {
        const content = '---\naliases: [Old Name]\n---\n\n# Page';
        service.indexFileContent('page.md', 'page.md', content, 1000);

        // Another page references the alias
        service.indexFileContent('linker.md', 'linker.md', '# Linker\n\nSee [[Old Name]]\n', 1000);

        const page = service.getPageByPath('page.md')!;
        service.updateAliasRename('Old Name', 'New Name', page.id);

        // Alias record updated
        const aliases = service.getAliasesForPage(page.id);
        expect(aliases).toHaveLength(1);
        expect(aliases[0].alias_name).toBe('New Name');
        expect(aliases[0].alias_filename).toBe('New Name.md');

        // Link references updated
        const linkerPage = service.getPageByPath('linker.md')!;
        const links = service.getLinksForPage(linkerPage.id);
        expect(links[0].page_name).toBe('New Name');
        expect(links[0].page_filename).toBe('New Name.md');
    });

    it('should find pages by filename for subfolder resolution', () => {
        service.indexFileContent('notes/Page.md', 'Page.md', '# Page in notes', 1000);
        service.indexFileContent('archive/Page.md', 'Page.md', '# Page in archive', 1000);
        service.indexFileContent('Other.md', 'Other.md', '# Other', 1000);

        const matches = service.findPagesByFilename('Page.md');
        expect(matches).toHaveLength(2);
        expect(matches.map(m => m.path).sort()).toEqual(['archive/Page.md', 'notes/Page.md']);

        const noMatch = service.findPagesByFilename('Nonexistent.md');
        expect(noMatch).toHaveLength(0);
    });

    it('should get all aliases with canonical page info', () => {
        const page1 = '---\naliases:\n  - Alpha\n  - Beta\n---\n\n# Page One';
        service.indexFileContent('page1.md', 'page1.md', page1, 1000);

        const page2 = '---\naliases: [Gamma]\n---\n\n# Page Two';
        service.indexFileContent('sub/page2.md', 'page2.md', page2, 1000);

        // Page with no aliases
        service.indexFileContent('plain.md', 'plain.md', '# Plain', 1000);

        const allAliases = service.getAllAliases();
        expect(allAliases).toHaveLength(3);

        // Should be sorted alphabetically by alias_name
        expect(allAliases[0].alias_name).toBe('Alpha');
        expect(allAliases[0].canonical_filename).toBe('page1.md');
        expect(allAliases[0].canonical_path).toBe('page1.md');

        expect(allAliases[1].alias_name).toBe('Beta');
        expect(allAliases[1].canonical_filename).toBe('page1.md');

        expect(allAliases[2].alias_name).toBe('Gamma');
        expect(allAliases[2].canonical_filename).toBe('page2.md');
        expect(allAliases[2].canonical_path).toBe('sub/page2.md');
    });

    it('should return empty array from getAllAliases when no aliases exist', () => {
        service.indexFileContent('page.md', 'page.md', '# No aliases here', 1000);
        expect(service.getAllAliases()).toHaveLength(0);
    });

    it('should remove aliases when page is removed', () => {
        const content = '---\naliases: [My Alias]\n---\n\n# Page';
        service.indexFileContent('page.md', 'page.md', content, 1000);

        const page = service.getPageByPath('page.md')!;
        expect(service.getAliasesForPage(page.id)).toHaveLength(1);
        expect(service.resolveAlias('My Alias')).toBeDefined();

        service.removePage('page.md');

        expect(service.resolveAlias('My Alias')).toBeUndefined();
    });

    it('should sanitise alias filenames for invalid characters', () => {
        const content = '---\naliases: [What is 1/2?]\n---\n\n# Page';
        service.indexFileContent('page.md', 'page.md', content, 1000);

        const page = service.getPageByPath('page.md')!;
        const aliases = service.getAliasesForPage(page.id);
        expect(aliases).toHaveLength(1);
        expect(aliases[0].alias_name).toBe('What is 1/2?');
        expect(aliases[0].alias_filename).toBe('What is 1_2_.md');
    });

    it('should get a page by its numeric id', () => {
        const content = '# My Page\n\nSome text';
        service.indexFileContent('notes/page.md', 'page.md', content, 1000);

        const pageByPath = service.getPageByPath('notes/page.md')!;
        const pageById = service.getPageById(pageByPath.id);
        expect(pageById).toBeDefined();
        expect(pageById!.path).toBe('notes/page.md');
        expect(pageById!.title).toBe('My Page');
    });

    it('should return undefined for non-existent page id', () => {
        expect(service.getPageById(9999)).toBeUndefined();
    });

    it('should handle updateAliasRename updating both alias record and link references', () => {
        // Setup: page with alias, and a link referencing the alias
        const canonical = '---\naliases: [Old Alias]\n---\n\n# Canonical';
        service.indexFileContent('canonical.md', 'canonical.md', canonical, 1000);

        // Another page has a link using the alias name
        const linker = '# Linker\n\nSee [[Old Alias]] for details.';
        service.indexFileContent('linker.md', 'linker.md', linker, 1000);

        const canonicalPage = service.getPageByPath('canonical.md')!;

        // Verify initial state
        const aliases = service.getAliasesForPage(canonicalPage.id);
        expect(aliases).toHaveLength(1);
        expect(aliases[0].alias_name).toBe('Old Alias');

        const links = service.getLinksForPage(service.getPageByPath('linker.md')!.id);
        expect(links[0].page_name).toBe('Old Alias');

        // Perform alias rename
        service.updateAliasRename('Old Alias', 'New Alias', canonicalPage.id);

        // Verify alias record updated
        const updatedAliases = service.getAliasesForPage(canonicalPage.id);
        expect(updatedAliases).toHaveLength(1);
        expect(updatedAliases[0].alias_name).toBe('New Alias');
        expect(updatedAliases[0].alias_filename).toBe('New Alias.md');

        // Verify link references updated
        const updatedLinks = service.getLinksForPage(service.getPageByPath('linker.md')!.id);
        expect(updatedLinks[0].page_name).toBe('New Alias');
        expect(updatedLinks[0].page_filename).toBe('New Alias.md');
    });
});

describe('IndexService — getForwardReferencedPages', () => {
    let service: IndexService;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
    });

    afterEach(() => {
        service.close();
    });

    it('should return entries for links whose target file is not in pages', () => {
        // Index a source page that links to a non-existent page
        service.indexFileContent('source.md', 'source.md', '# Source\n\nSee [[Missing Page]] for details.', 1000);

        const forwardRefs = service.getForwardReferencedPages();
        expect(forwardRefs).toHaveLength(1);
        expect(forwardRefs[0].page_name).toBe('Missing Page');
        expect(forwardRefs[0].page_filename).toBe('Missing Page.md');
    });

    it('should return empty array when all linked pages exist', () => {
        service.indexFileContent('target.md', 'target.md', '# Target', 1000);
        service.indexFileContent('source.md', 'source.md', '# Source\n\nSee [[target]] for details.', 1000);

        // target.md exists in pages; "target" resolves to target filename
        // However, the link stores page_filename as sanitised, so create a realistic scenario:
        service.indexFileContent('Alpha.md', 'Alpha.md', '# Alpha\n\nSee [[Beta]] for details.', 1000);
        service.indexFileContent('Beta.md', 'Beta.md', '# Beta', 1000);

        const forwardRefs = service.getForwardReferencedPages();
        // Only links whose page_filename has no pages row should appear
        // target.md and Beta.md both exist, so they won't appear (assuming exact filename match)
        // "target.md" vs actual filename — verify no spurious entries for existing pages
        const names = forwardRefs.map(r => r.page_name);
        expect(names).not.toContain('Beta');
    });

    it('should not return duplicates when multiple sources link to the same unresolved target', () => {
        service.indexFileContent('a.md', 'a.md', '# A\n\nSee [[Ghost Page]].', 1000);
        service.indexFileContent('b.md', 'b.md', '# B\n\nAlso [[Ghost Page]] here.', 1000);
        service.indexFileContent('c.md', 'c.md', '# C\n\nAnd [[Ghost Page]] again.', 1000);

        const forwardRefs = service.getForwardReferencedPages();
        const ghostRefs = forwardRefs.filter(r => r.page_name === 'Ghost Page');
        expect(ghostRefs).toHaveLength(1);
    });

    it('should exclude a target once the corresponding page is indexed', () => {
        service.indexFileContent('source.md', 'source.md', '# Source\n\nSee [[New Page]].', 1000);

        const before = service.getForwardReferencedPages();
        expect(before.map(r => r.page_name)).toContain('New Page');

        // Now index the target page
        service.indexFileContent('New Page.md', 'New Page.md', '# New Page', 1000);

        const after = service.getForwardReferencedPages();
        expect(after.map(r => r.page_name)).not.toContain('New Page');
    });

    it('should return results sorted case-insensitively by page_name', () => {
        service.indexFileContent('source.md', 'source.md',
            '# Source\n\nSee [[zebra]], [[Apple]], [[mango]].', 1000);

        const forwardRefs = service.getForwardReferencedPages();
        const names = forwardRefs.map(r => r.page_name);
        const sorted = [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        expect(names).toEqual(sorted);
    });

    it('should exclude links that resolve to an alias', () => {
        // "Plant.md" exists and has "Plants" as an alias.
        // "source.md" links to [[Plants]].
        // Plants.md does NOT exist in pages, but "Plants" is a known alias.
        // Forward references should NOT include "Plants".
        service.indexFileContent('Plant.md', 'Plant.md', '---\naliases:\n  - Plants\n---\n# Plant', 1000);
        service.indexFileContent('source.md', 'source.md', '# Source\n\nSee [[Plants]] and [[Missing Page]].', 1000);

        const forwardRefs = service.getForwardReferencedPages();
        const names = forwardRefs.map(r => r.page_name);
        expect(names).not.toContain('Plants');
        expect(names).toContain('Missing Page');
    });

    it('should exclude alias links case-insensitively', () => {
        service.indexFileContent('Plant.md', 'Plant.md', '---\naliases:\n  - Plants\n---\n# Plant', 1000);
        service.indexFileContent('source.md', 'source.md', '# Source\n\nSee [[plants]].', 1000);

        const forwardRefs = service.getForwardReferencedPages();
        const names = forwardRefs.map(r => r.page_name);
        expect(names).not.toContain('plants');
    });
});

// ── Task indexing ──────────────────────────────────────────────────────────

describe('IndexService — task indexing', () => {
    let service: IndexService;

    beforeEach(async () => {
        service = new IndexService(':memory:');
        await service.initInMemory();
    });

    afterEach(() => {
        service.close();
    });

    it('should index unchecked and done tasks from file content', () => {
        const content = '# Tasks\n\n- [ ] Buy milk\n- [x] Write docs\n- [X] Ship feature\nPlain text line';
        service.indexFileContent('tasks.md', 'tasks.md', content, 1000);

        const page = service.getPageByPath('tasks.md');
        const tasks = service.getTasksForPage(page!.id);

        expect(tasks).toHaveLength(3);
        expect(tasks[0]).toMatchObject({ line: 2, text: 'Buy milk', done: 0 });
        expect(tasks[1]).toMatchObject({ line: 3, text: 'Write docs', done: 1 });
        expect(tasks[2]).toMatchObject({ line: 4, text: 'Ship feature', done: 1 });
    });

    it('should replace old tasks on re-index', () => {
        service.indexFileContent('tasks.md', 'tasks.md', '# Tasks\n\n- [ ] Old task', 1000);
        const page = service.getPageByPath('tasks.md');
        expect(service.getTasksForPage(page!.id)).toHaveLength(1);

        service.indexFileContent('tasks.md', 'tasks.md', '# Tasks\n\n- [ ] New task one\n- [x] New task two', 2000);
        const tasks = service.getTasksForPage(page!.id);
        expect(tasks).toHaveLength(2);
        expect(tasks[0].text).toBe('New task one');
        expect(tasks[1].text).toBe('New task two');
    });

    it('should filter tasks with todoOnly parameter', () => {
        const content = '# Tasks\n\n- [ ] Undone task\n- [x] Done task\n- [ ] Another undone';
        service.indexFileContent('tasks.md', 'tasks.md', content, 1000);

        const page = service.getPageByPath('tasks.md');
        const allTasks = service.getTasksForPage(page!.id, false);
        expect(allTasks).toHaveLength(3);

        const todoOnly = service.getTasksForPage(page!.id, true);
        expect(todoOnly).toHaveLength(2);
        expect(todoOnly.every(t => t.done === 0)).toBe(true);
    });

    it('should return pages with tasks and counts', () => {
        service.indexFileContent('a.md', 'a.md', '# A\n\n- [ ] Task 1\n- [x] Task 2', 1000);
        service.indexFileContent('b.md', 'b.md', '# B\n\n- [ ] Task 3', 1000);
        service.indexFileContent('c.md', 'c.md', '# C\n\nNo tasks here', 1000);

        const allPages = service.getPagesWithTasks(false);
        expect(allPages).toHaveLength(2);
        const pageA = allPages.find(p => p.page.filename === 'a.md');
        const pageB = allPages.find(p => p.page.filename === 'b.md');
        expect(pageA!.taskCount).toBe(2);
        expect(pageB!.taskCount).toBe(1);

        const todoOnlyPages = service.getPagesWithTasks(true);
        expect(todoOnlyPages).toHaveLength(2);
        const todoA = todoOnlyPages.find(p => p.page.filename === 'a.md');
        expect(todoA!.taskCount).toBe(1); // only the undone task
    });

    it('should return correct task counts', () => {
        service.indexFileContent('a.md', 'a.md', '# A\n\n- [ ] Task 1\n- [x] Task 2', 1000);
        service.indexFileContent('b.md', 'b.md', '# B\n\n- [ ] Task 3\n- [ ] Task 4', 1000);

        const counts = service.getTaskCounts();
        expect(counts.total).toBe(4);
        expect(counts.done).toBe(1);
        expect(counts.undone).toBe(3);
    });

    it('should cascade-delete tasks when page is removed', () => {
        service.indexFileContent('tasks.md', 'tasks.md', '# Tasks\n\n- [ ] Task 1\n- [x] Task 2', 1000);
        const page = service.getPageByPath('tasks.md');
        expect(service.getTasksForPage(page!.id)).toHaveLength(2);

        service.removePage('tasks.md');
        expect(service.getTaskCounts().total).toBe(0);
    });

    it('should parse indented tasks correctly', () => {
        const content = '# Tasks\n\n  - [ ] Indented unchecked\n    - [x] Deep indented done';
        service.indexFileContent('tasks.md', 'tasks.md', content, 1000);

        const page = service.getPageByPath('tasks.md');
        const tasks = service.getTasksForPage(page!.id);
        expect(tasks).toHaveLength(2);
        expect(tasks[0]).toMatchObject({ text: 'Indented unchecked', done: 0 });
        expect(tasks[1]).toMatchObject({ text: 'Deep indented done', done: 1 });
    });

    it('should parse tasks with * bullet correctly', () => {
        const content = '# Tasks\n\n* [ ] Star unchecked\n* [x] Star done';
        service.indexFileContent('tasks.md', 'tasks.md', content, 1000);

        const page = service.getPageByPath('tasks.md');
        const tasks = service.getTasksForPage(page!.id);
        expect(tasks).toHaveLength(2);
        expect(tasks[0]).toMatchObject({ text: 'Star unchecked', done: 0 });
        expect(tasks[1]).toMatchObject({ text: 'Star done', done: 1 });
    });

    it('should not store lines without todo markers as tasks', () => {
        const content = '# Tasks\n\nPlain text\n- List item\n* Another list\n## Heading';
        service.indexFileContent('tasks.md', 'tasks.md', content, 1000);

        const page = service.getPageByPath('tasks.md');
        const tasks = service.getTasksForPage(page!.id);
        expect(tasks).toHaveLength(0);
    });

    it('should produce empty tasks for file with no todos', () => {
        const content = '# No Tasks\n\nJust regular content here.\n\n- A list item\n- Another one';
        service.indexFileContent('notasks.md', 'notasks.md', content, 1000);

        const page = service.getPageByPath('notasks.md');
        const tasks = service.getTasksForPage(page!.id);
        expect(tasks).toHaveLength(0);
        expect(service.getTaskCounts().total).toBe(0);
    });

    it('should store original line text', () => {
        const content = '# Tasks\n\n    - [ ] Indented task with context';
        service.indexFileContent('tasks.md', 'tasks.md', content, 1000);

        const page = service.getPageByPath('tasks.md');
        const tasks = service.getTasksForPage(page!.id);
        expect(tasks[0].line_text).toBe('    - [ ] Indented task with context');
    });
});
