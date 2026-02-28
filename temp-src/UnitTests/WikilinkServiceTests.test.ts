// src/tests/WikilinkService.test.ts
import { describe, it, expect } from 'vitest';
import { WikilinkService } from '../WikilinkService';

describe('WikilinkService', () => {
    const testCases = [
        {
            description: 'Basic non nested wikilinks',
            input: 'The quick brown fox [[Mount]] jumped over the lazy sleeping [[BJJ]] dog',
            expectedWikilinks: ['[[Mount]]', '[[BJJ]]'],
            expectedPageNames: ['Mount', 'BJJ'],
            expectedPageFileNames: ['Mount', 'BJJ'],
        },
        {
            description: 'Nested link',
            input: 'The quick brown fox [[[[[[Mount]] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[[Mount]] Escape]] [[[[BJJ]] Systems]]]]', '[[[[Mount]] Escape]]', '[[[[BJJ]] Systems]]', '[[Mount]]', '[[BJJ]]'],
            expectedPageNames: ['[[[[Mount]] Escape]] [[[[BJJ]] Systems]]', '[[Mount]] Escape', '[[BJJ]] Systems', 'Mount', 'BJJ'],
            expectedPageFileNames: ['[[[[Mount]] Escape]] [[[[BJJ]] Systems]]', '[[Mount]] Escape', '[[BJJ]] Systems', 'Mount', 'BJJ'],
        },
        {
            description: 'Nested link with / (file separator)',
            input: 'The quick brown fox [[[[[[Mount]] / Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[[Mount]] / Escape]] [[[[BJJ]] Systems]]]]', '[[[[Mount]] / Escape]]', '[[[[BJJ]] Systems]]', '[[Mount]]', '[[BJJ]]'],
            expectedPageNames: ['[[[[Mount]] / Escape]] [[[[BJJ]] Systems]]', '[[Mount]] / Escape', '[[BJJ]] Systems', 'Mount', 'BJJ'],
            expectedPageFileNames: ['[[[[Mount]] _ Escape]] [[[[BJJ]] Systems]]', '[[Mount]] _ Escape', '[[BJJ]] Systems', 'Mount', 'BJJ'],
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
            input: 'The quick brown fox [[[[[[Mount]] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog. The quick brown fox [[[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]]]', '[[[[[[Mount]] Escape]] [[[[BJJ]] Systems]]]]', '[[[[Jiu Jitsu]] Technique]]', '[[[[Turtle]] Attack]]', '[[[[Mount]] Escape]]', '[[[[BJJ]] Systems]]', '[[Jiu Jitsu]]', '[[Turtle]]', '[[Mount]]', '[[BJJ]]'],
            expectedPageNames: ['[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]', '[[[[Mount]] Escape]] [[[[BJJ]] Systems]]', '[[Jiu Jitsu]] Technique', '[[Turtle]] Attack', '[[Mount]] Escape', '[[BJJ]] Systems', 'Jiu Jitsu', 'Turtle', 'Mount', 'BJJ'],
            expectedPageFileNames: ['[[[[Turtle]] Attack]] [[[[Jiu Jitsu]] Technique]]', '[[[[Mount]] Escape]] [[[[BJJ]] Systems]]', '[[Jiu Jitsu]] Technique', '[[Turtle]] Attack', '[[Mount]] Escape', '[[BJJ]] Systems', 'Jiu Jitsu', 'Turtle', 'Mount', 'BJJ'],
        },
        {
            description: "Unbalanced Wikilink Brackets for '[[[[Mount]] Escape' changes results as expected",
            input: 'The quick brown fox [[[[[[Mount]] Escape [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[Mount]] Escape [[[[BJJ]] Systems]]]]', '[[[[BJJ]] Systems]]', '[[Mount]]', '[[BJJ]]'],
            expectedPageNames: ['[[Mount]] Escape [[[[BJJ]] Systems]]', '[[BJJ]] Systems', 'Mount', 'BJJ'],
            expectedPageFileNames: ['[[Mount]] Escape [[[[BJJ]] Systems]]', '[[BJJ]] Systems', 'Mount', 'BJJ'],
        },
        {
            description: 'Interrupting $ character in [$[Mount]$] changes results as expected',
            input: 'The quick brown fox [[[[[$[Mount]$] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[$[Mount]$] Escape]] [[[[BJJ]] Systems]]]]', '[[[$[Mount]$] Escape]]', '[[[[BJJ]] Systems]]', '[[BJJ]]'],
            expectedPageNames: ['[[[$[Mount]$] Escape]] [[[[BJJ]] Systems]]', '[$[Mount]$] Escape', '[[BJJ]] Systems', 'BJJ'],
            expectedPageFileNames: ['[[[$[Mount]$] Escape]] [[[[BJJ]] Systems]]', '[$[Mount]$] Escape', '[[BJJ]] Systems', 'BJJ'],
        },
        {
            description: 'Unbalanced interrupting $ character in [$[Mount]] changes results as expected (interrupt on start bracket)',
            input: 'The quick brown fox [[[[[$[Mount]] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[$[Mount]] Escape]]', '[[[[BJJ]] Systems]]', '[[[$[Mount]]', '[[BJJ]]'],
            expectedPageNames: ['[[[$[Mount]] Escape', '[[BJJ]] Systems', '[$[Mount', 'BJJ'],
            expectedPageFileNames: ['[[[$[Mount]] Escape', '[[BJJ]] Systems', '[$[Mount', 'BJJ'],
        },
        {
            description: 'Unbalanced interrupting $ character in [[Mount]$] changes results as expected (interrupt on end bracket)',
            input: 'The quick brown fox [[[[[[Mount]$] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[Mount]$] Escape]] [[[[BJJ]] Systems]]]]', '[[[[BJJ]] Systems]]', '[[Mount]$] Escape]]', '[[BJJ]]'],
            expectedPageNames: ['[[Mount]$] Escape]] [[[[BJJ]] Systems]]', '[[BJJ]] Systems', 'Mount]$] Escape', 'BJJ'],
            expectedPageFileNames: ['[[Mount]$] Escape]] [[[[BJJ]] Systems]]', '[[BJJ]] Systems', 'Mount]$] Escape', 'BJJ'],
        },
        {
            description: 'Unbalanced interrupting  (file separator) character in [[Mount]] changes results as expected (interrupt on end bracket)',
            input: 'The quick brown fox [[[[[[Mount]\\] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[Mount]\\] Escape]] [[[[BJJ]] Systems]]]]', '[[[[BJJ]] Systems]]', '[[Mount]\\] Escape]]', '[[BJJ]]'],
            expectedPageNames: ['[[Mount]\\] Escape]] [[[[BJJ]] Systems]]', '[[BJJ]] Systems', 'Mount]\\] Escape', 'BJJ'],
            expectedPageFileNames: ['[[Mount]_] Escape]] [[[[BJJ]] Systems]]', '[[BJJ]] Systems', 'Mount]_] Escape', 'BJJ'],
        },
        {
            description: 'Unbalanced opening square brackets character in [[Mount] changes results as expected (interrupt on end bracket)',
            input: 'The quick brown fox [[[[[[Mount] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[Mount] Escape]] [[[[BJJ]] Systems]]]]', '[[[[BJJ]] Systems]]', '[[Mount] Escape]]', '[[BJJ]]'],
            expectedPageNames: ['[[Mount] Escape]] [[[[BJJ]] Systems]]', '[[BJJ]] Systems', 'Mount] Escape', 'BJJ'],
            expectedPageFileNames: ['[[Mount] Escape]] [[[[BJJ]] Systems]]', '[[BJJ]] Systems', 'Mount] Escape', 'BJJ'],
        },
    ];

    const wikilinkService = new WikilinkService();

    testCases.forEach(({ input, expectedWikilinks, expectedPageNames, expectedPageFileNames }) => {
        it(`should extract wikilinks from "${input}"`, () => {
            const wikilinks = wikilinkService.extractWikilinks(input);

            expect(wikilinks.length).toBe(expectedWikilinks.length);
            expect(wikilinks.map((w) => w.linkText)).toEqual(expect.arrayContaining(expectedWikilinks));
            expect(wikilinks.map((w) => w.pageName)).toEqual(expect.arrayContaining(expectedPageNames));
            expect(wikilinks.map((w) => w.pageFileName)).toEqual(expect.arrayContaining(expectedPageFileNames));
        });
    });
});
