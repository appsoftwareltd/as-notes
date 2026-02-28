import { describe, it, expect } from 'vitest';
import { WikilinkService } from '../WikilinkService.js';

describe('WikilinkService', () => {
    const testCases = [
        {
            description: 'Basic non nested wikilinks',
            input: 'The quick brown fox [[Apple]] jumped over the lazy sleeping [[Google]] dog',
            expectedWikilinks: ['[[Apple]]', '[[Google]]'],
            expectedPageNames: ['Apple', 'Google'],
            expectedPageFileNames: ['Apple', 'Google'],
        },
        {
            description: 'Nested link',
            input: 'The quick brown fox [[[[[[Apple]] Microsoft]] [[[[Google]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[[Apple]] Microsoft]] [[[[Google]] Systems]]]]', '[[[[Apple]] Microsoft]]', '[[[[Google]] Systems]]', '[[Apple]]', '[[Google]]'],
            expectedPageNames: ['[[[[Apple]] Microsoft]] [[[[Google]] Systems]]', '[[Apple]] Microsoft', '[[Google]] Systems', 'Apple', 'Google'],
            expectedPageFileNames: ['[[[[Apple]] Microsoft]] [[[[Google]] Systems]]', '[[Apple]] Microsoft', '[[Google]] Systems', 'Apple', 'Google'],
        },
        {
            description: 'Nested link with / (file separator)',
            input: 'The quick brown fox [[[[[[Apple]] / Microsoft]] [[[[Google]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[[Apple]] / Microsoft]] [[[[Google]] Systems]]]]', '[[[[Apple]] / Microsoft]]', '[[[[Google]] Systems]]', '[[Apple]]', '[[Google]]'],
            expectedPageNames: ['[[[[Apple]] / Microsoft]] [[[[Google]] Systems]]', '[[Apple]] / Microsoft', '[[Google]] Systems', 'Apple', 'Google'],
            expectedPageFileNames: ['[[[[Apple]] _ Microsoft]] [[[[Google]] Systems]]', '[[Apple]] _ Microsoft', '[[Google]] Systems', 'Apple', 'Google'],
        },
        {
            description: 'Include spaced words in nested link',
            input: 'The quick brown fox [[[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]]]', '[[[[Turtle]] Attack]]', '[[[[Jiu Jitsu]] Technique]]', '[[Jiu Jitsu]]', '[[Turtle]]'],
            expectedPageNames: ['[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]', '[[Turtle]] Attack', '[[Jiu Jitsu]] Technique', 'Jiu Jitsu', 'Turtle'],
            expectedPageFileNames: ['[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]', '[[Turtle]] Attack', '[[Jiu Jitsu]] Technique', 'Jiu Jitsu', 'Turtle'],
        },
        {
            description: 'Multiple top level wikilinks with nested links',
            input: 'The quick brown fox [[[[[[Apple]] Microsoft]] [[[[Google]] Systems]]]] jumped over the lazy sleeping dog. The quick brown fox [[[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]]]', '[[[[[[Apple]] Microsoft]] [[[[Google]] Systems]]]]', '[[[[Jiu Jitsu]] Technique]]', '[[[[Turtle]] Attack]]', '[[[[Apple]] Microsoft]]', '[[[[Google]] Systems]]', '[[Jiu Jitsu]]', '[[Turtle]]', '[[Apple]]', '[[Google]]'],
            expectedPageNames: ['[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]', '[[[[Apple]] Microsoft]] [[[[Google]] Systems]]', '[[Jiu Jitsu]] Technique', '[[Turtle]] Attack', '[[Apple]] Microsoft', '[[Google]] Systems', 'Jiu Jitsu', 'Turtle', 'Apple', 'Google'],
            expectedPageFileNames: ['[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]', '[[[[Apple]] Microsoft]] [[[[Google]] Systems]]', '[[Jiu Jitsu]] Technique', '[[Turtle]] Attack', '[[Apple]] Microsoft', '[[Google]] Systems', 'Jiu Jitsu', 'Turtle', 'Apple', 'Google'],
        },
        {
            description: "Unbalanced Wikilink Brackets for '[[[[Apple]] Microsoft' changes results as expected",
            input: 'The quick brown fox [[[[[[Apple]] Microsoft [[[[Google]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[Apple]] Microsoft [[[[Google]] Systems]]]]', '[[[[Google]] Systems]]', '[[Apple]]', '[[Google]]'],
            expectedPageNames: ['[[Apple]] Microsoft [[[[Google]] Systems]]', '[[Google]] Systems', 'Apple', 'Google'],
            expectedPageFileNames: ['[[Apple]] Microsoft [[[[Google]] Systems]]', '[[Google]] Systems', 'Apple', 'Google'],
        },
        {
            description: 'Interrupting $ character in [$[Apple]$] changes results as expected',
            input: 'The quick brown fox [[[[[$[Apple]$] Microsoft]] [[[[Google]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[$[Apple]$] Microsoft]] [[[[Google]] Systems]]]]', '[[[$[Apple]$] Microsoft]]', '[[[[Google]] Systems]]', '[[Google]]'],
            expectedPageNames: ['[[[$[Apple]$] Microsoft]] [[[[Google]] Systems]]', '[$[Apple]$] Microsoft', '[[Google]] Systems', 'Google'],
            expectedPageFileNames: ['[[[$[Apple]$] Microsoft]] [[[[Google]] Systems]]', '[$[Apple]$] Microsoft', '[[Google]] Systems', 'Google'],
        },
        {
            description: 'Unbalanced interrupting $ character in [$[Apple]] changes results as expected (interrupt on start bracket)',
            input: 'The quick brown fox [[[[[$[Apple]] Microsoft]] [[[[Google]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[$[Apple]] Microsoft]]', '[[[[Google]] Systems]]', '[[[$[Apple]]', '[[Google]]'],
            expectedPageNames: ['[[[$[Apple]] Microsoft', '[[Google]] Systems', '[$[Apple', 'Google'],
            expectedPageFileNames: ['[[[$[Apple]] Microsoft', '[[Google]] Systems', '[$[Apple', 'Google'],
        },
        {
            description: 'Unbalanced interrupting $ character in [[Apple]$] changes results as expected (interrupt on end bracket)',
            input: 'The quick brown fox [[[[[[Apple]$] Microsoft]] [[[[Google]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[Apple]$] Microsoft]] [[[[Google]] Systems]]]]', '[[[[Google]] Systems]]', '[[Apple]$] Microsoft]]', '[[Google]]'],
            expectedPageNames: ['[[Apple]$] Microsoft]] [[[[Google]] Systems]]', '[[Google]] Systems', 'Apple]$] Microsoft', 'Google'],
            expectedPageFileNames: ['[[Apple]$] Microsoft]] [[[[Google]] Systems]]', '[[Google]] Systems', 'Apple]$] Microsoft', 'Google'],
        },
        {
            description: 'Unbalanced interrupting  (file separator) character in [[Apple]] changes results as expected (interrupt on end bracket)',
            input: 'The quick brown fox [[[[[[Apple]\\] Microsoft]] [[[[Google]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[Apple]\\] Microsoft]] [[[[Google]] Systems]]]]', '[[[[Google]] Systems]]', '[[Apple]\\] Microsoft]]', '[[Google]]'],
            expectedPageNames: ['[[Apple]\\] Microsoft]] [[[[Google]] Systems]]', '[[Google]] Systems', 'Apple]\\] Microsoft', 'Google'],
            expectedPageFileNames: ['[[Apple]_] Microsoft]] [[[[Google]] Systems]]', '[[Google]] Systems', 'Apple]_] Microsoft', 'Google'],
        },
        {
            description: 'Unbalanced opening square brackets character in [[Apple] changes results as expected (interrupt on end bracket)',
            input: 'The quick brown fox [[[[[[Apple] Microsoft]] [[[[Google]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[Apple] Microsoft]] [[[[Google]] Systems]]]]', '[[[[Google]] Systems]]', '[[Apple] Microsoft]]', '[[Google]]'],
            expectedPageNames: ['[[Apple] Microsoft]] [[[[Google]] Systems]]', '[[Google]] Systems', 'Apple] Microsoft', 'Google'],
            expectedPageFileNames: ['[[Apple] Microsoft]] [[[[Google]] Systems]]', '[[Google]] Systems', 'Apple] Microsoft', 'Google'],
        },
    ];

    const wikilinkService = new WikilinkService();

    testCases.forEach(({ description, input, expectedWikilinks, expectedPageNames, expectedPageFileNames }) => {
        it(`${description}: should extract wikilinks from "${input}"`, () => {
            const wikilinks = wikilinkService.extractWikilinks(input);

            expect(wikilinks.length).toBe(expectedWikilinks.length);
            expect(wikilinks.map((w) => w.linkText)).toEqual(expect.arrayContaining(expectedWikilinks));
            expect(wikilinks.map((w) => w.pageName)).toEqual(expect.arrayContaining(expectedPageNames));
            expect(wikilinks.map((w) => w.pageFileName)).toEqual(expect.arrayContaining(expectedPageFileNames));
        });
    });
});

describe('WikilinkService.findInnermostWikilinkAtOffset', () => {
    const wikilinkService = new WikilinkService();

    it('should find a simple wikilink at offset', () => {
        const input = 'Hello [[World]] there';
        const wikilinks = wikilinkService.extractWikilinks(input);
        const result = wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 8);
        expect(result).toBeDefined();
        expect(result!.pageName).toBe('World');
    });

    it('should return undefined when offset is outside any wikilink', () => {
        const input = 'Hello [[World]] there';
        const wikilinks = wikilinkService.extractWikilinks(input);
        const result = wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 2);
        expect(result).toBeUndefined();
    });

    it('should find the innermost nested wikilink', () => {
        const input = '[[Outer [[Inner]] text]]';
        const wikilinks = wikilinkService.extractWikilinks(input);
        // Offset 11 is within "Inner"
        const result = wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 11);
        expect(result).toBeDefined();
        expect(result!.pageName).toBe('Inner');
    });

    it('should find the outer wikilink when offset is in the outer-only portion', () => {
        const input = '[[Outer [[Inner]] text]]';
        const wikilinks = wikilinkService.extractWikilinks(input);
        // Offset 3 is within "Outer " (before the nested link)
        const result = wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 3);
        expect(result).toBeDefined();
        expect(result!.pageName).toBe('Outer [[Inner]] text');
    });

    it('should find innermost in deeply nested structure', () => {
        const input = 'The quick brown fox [[[[[[Apple]] Microsoft]] [[[[Google]] Systems]]]] jumped';
        const wikilinks = wikilinkService.extractWikilinks(input);
        // "Apple" starts at position 26 in the string
        const result = wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 26);
        expect(result).toBeDefined();
        expect(result!.pageName).toBe('Apple');
    });
});

describe('WikilinkService.computeLinkSegments', () => {
    const wikilinkService = new WikilinkService();

    it('should return empty array for no wikilinks', () => {
        const segments = wikilinkService.computeLinkSegments([]);
        expect(segments).toEqual([]);
    });

    it('should produce a single segment for a simple wikilink', () => {
        const input = 'Hello [[World]] there';
        const wikilinks = wikilinkService.extractWikilinks(input);
        const segments = wikilinkService.computeLinkSegments(wikilinks);

        expect(segments.length).toBe(1);
        expect(segments[0].startOffset).toBe(6);   // start of [[World]]
        expect(segments[0].endOffset).toBe(15);     // end (exclusive)
        expect(segments[0].wikilink.pageName).toBe('World');
    });

    it('should split nested wikilinks into non-overlapping segments', () => {
        const input = '[[Outer [[Inner]] text]]';
        const wikilinks = wikilinkService.extractWikilinks(input);
        const segments = wikilinkService.computeLinkSegments(wikilinks);

        // Should produce 3 segments:
        // 1. [[Outer  -> outer link
        // 2. [[Inner]] -> inner link
        // 3.  text]]  -> outer link
        expect(segments.length).toBe(3);

        // First segment: outer link (before inner)
        expect(segments[0].wikilink.pageName).toBe('Outer [[Inner]] text');
        expect(segments[0].startOffset).toBe(0);
        expect(segments[0].endOffset).toBe(8); // up to start of [[Inner]]

        // Second segment: inner link
        expect(segments[1].wikilink.pageName).toBe('Inner');
        expect(segments[1].startOffset).toBe(8);
        expect(segments[1].endOffset).toBe(17); // end of [[Inner]]

        // Third segment: outer link (after inner)
        expect(segments[2].wikilink.pageName).toBe('Outer [[Inner]] text');
        expect(segments[2].startOffset).toBe(17);
        expect(segments[2].endOffset).toBe(24);
    });

    it('should handle deeply nested wikilinks with multiple children', () => {
        const input = '[[[[[[Apple]] Microsoft]] [[[[Google]] Systems]]]]';
        const wikilinks = wikilinkService.extractWikilinks(input);
        const segments = wikilinkService.computeLinkSegments(wikilinks);

        // Each segment should map to the innermost wikilink at that position
        const pageNames = segments.map(s => s.wikilink.pageName);

        // The segments should include Apple, Google as innermost targets
        expect(pageNames).toContain('Apple');
        expect(pageNames).toContain('Google');

        // No segments should overlap
        for (let i = 1; i < segments.length; i++) {
            expect(segments[i].startOffset).toBe(segments[i - 1].endOffset);
        }
    });

    it('should handle sibling wikilinks on same line', () => {
        const input = '[[Alpha]] text [[Beta]]';
        const wikilinks = wikilinkService.extractWikilinks(input);
        const segments = wikilinkService.computeLinkSegments(wikilinks);

        expect(segments.length).toBe(2);
        expect(segments[0].wikilink.pageName).toBe('Alpha');
        expect(segments[1].wikilink.pageName).toBe('Beta');
    });

    it('should handle 3 levels of nesting', () => {
        const input = '[[Test [[[[Test]] Page]] Page]]';
        const wikilinks = wikilinkService.extractWikilinks(input);
        const segments = wikilinkService.computeLinkSegments(wikilinks);

        // 5 segments: outer | middle-before | inner | middle-after | outer-after
        expect(segments.length).toBe(5);

        // Segment 1: outer link text before middle
        expect(segments[0].wikilink.pageName).toBe('Test [[[[Test]] Page]] Page');
        expect(segments[0].startOffset).toBe(0);
        expect(segments[0].endOffset).toBe(7);

        // Segment 2: middle link brackets before inner
        expect(segments[1].wikilink.pageName).toBe('[[Test]] Page');
        expect(segments[1].startOffset).toBe(7);
        expect(segments[1].endOffset).toBe(9);

        // Segment 3: inner [[Test]]
        expect(segments[2].wikilink.pageName).toBe('Test');
        expect(segments[2].startOffset).toBe(9);
        expect(segments[2].endOffset).toBe(17);

        // Segment 4: middle link text after inner
        expect(segments[3].wikilink.pageName).toBe('[[Test]] Page');
        expect(segments[3].startOffset).toBe(17);
        expect(segments[3].endOffset).toBe(24);

        // Segment 5: outer link text after middle
        expect(segments[4].wikilink.pageName).toBe('Test [[[[Test]] Page]] Page');
        expect(segments[4].startOffset).toBe(24);
        expect(segments[4].endOffset).toBe(31);

        // All segments are contiguous with no gaps
        for (let i = 1; i < segments.length; i++) {
            expect(segments[i].startOffset).toBe(segments[i - 1].endOffset);
        }
    });
});

describe('WikilinkService.findInnermostWikilinkAtOffset (3-level nesting)', () => {
    const wikilinkService = new WikilinkService();

    it('should find innermost at each level in [[Test [[[[Test]] Page]] Page]]', () => {
        const input = '[[Test [[[[Test]] Page]] Page]]';
        const wikilinks = wikilinkService.extractWikilinks(input);

        // Position 3 = in outer-only text "Test"
        expect(wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 3)!.pageName)
            .toBe('Test [[[[Test]] Page]] Page');

        // Position 8 = in middle link brackets "[["
        expect(wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 8)!.pageName)
            .toBe('[[Test]] Page');

        // Position 12 = in inner "Test"
        expect(wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 12)!.pageName)
            .toBe('Test');

        // Position 20 = in middle text "Page"
        expect(wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 20)!.pageName)
            .toBe('[[Test]] Page');

        // Position 27 = in outer text "Page"
        expect(wikilinkService.findInnermostWikilinkAtOffset(wikilinks, 27)!.pageName)
            .toBe('Test [[[[Test]] Page]] Page');
    });
});
