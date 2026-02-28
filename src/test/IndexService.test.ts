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
