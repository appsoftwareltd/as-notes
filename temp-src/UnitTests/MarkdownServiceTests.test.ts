import { describe, it, expect } from 'vitest';
import { WikilinkService } from '../WikilinkService';
import { MarkdownService } from '../MarkdownService';

describe('MarkdownService wikilink to HTML conversion tests', () => {
    const testCases = [
        {
            description: 'Simple single nested tag',
            input: 'Some [[[[Mount]] Escape]] text',
            expectedWikilinks: ['[[[[Mount]] Escape]]', '[[Mount]]'],
            expectedHtml: 'Some <a href="#[[Mount]] Escape">[[</a><a href="#Mount">[[Mount]]</a><a href="#[[Mount]] Escape"> Escape]]</a> text',
        },
        {
            description: 'Double nested tag',
            input: 'Some [[[[Mount]] [[Escape]]]] text',
            expectedWikilinks: ['[[[[Mount]] [[Escape]]]]', '[[Escape]]', '[[Mount]]'],
            expectedHtml: 'Some <a href="#[[Mount]] [[Escape]]">[[</a><a href="#Mount">[[Mount]]</a><a href="#[[Mount]] [[Escape]]"> </a><a href="#Escape">[[Escape]]</a><a href="#[[Mount]] [[Escape]]">]]</a> text',
        },
        {
            description: 'Sibling simple nested tags',
            input: 'Some [[[[Mount]] Escape]] text [[[[Jiu Jitsu]] Technique]]',
            expectedWikilinks: ['[[[[Jiu Jitsu]] Technique]]', '[[[[Mount]] Escape]]', '[[Jiu Jitsu]]', '[[Mount]]'],
            expectedHtml: 'Some <a href="#[[Mount]] Escape">[[</a><a href="#Mount">[[Mount]]</a><a href="#[[Mount]] Escape"> Escape]]</a> text <a href="#[[Jiu Jitsu]] Technique">[[</a><a href="#Jiu Jitsu">[[Jiu Jitsu]]</a><a href="#[[Jiu Jitsu]] Technique"> Technique]]</a>',
        },
        {
            description: 'Multiple occurrences of sibling nested tags',
            input: 'Some [[[[Mount]] Escape]] text [[[[Jiu Jitsu]] Technique]] Some [[[[Mount]] Escape]] text [[[[Jiu Jitsu]] Technique]] test.',
            expectedWikilinks: ['[[[[Jiu Jitsu]] Technique]]', '[[[[Jiu Jitsu]] Technique]]', '[[[[Mount]] Escape]]', '[[[[Mount]] Escape]]', '[[Jiu Jitsu]]', '[[Jiu Jitsu]]', '[[Mount]]', '[[Mount]]'],
            expectedHtml: 'Some <a href="#[[Mount]] Escape">[[</a><a href="#Mount">[[Mount]]</a><a href="#[[Mount]] Escape"> Escape]]</a> text <a href="#[[Jiu Jitsu]] Technique">[[</a><a href="#Jiu Jitsu">[[Jiu Jitsu]]</a><a href="#[[Jiu Jitsu]] Technique"> Technique]]</a> Some <a href="#[[Mount]] Escape">[[</a><a href="#Mount">[[Mount]]</a><a href="#[[Mount]] Escape"> Escape]]</a> text <a href="#[[Jiu Jitsu]] Technique">[[</a><a href="#Jiu Jitsu">[[Jiu Jitsu]]</a><a href="#[[Jiu Jitsu]] Technique"> Technique]]</a> test.',
        },
        {
            description: 'Unbalanced interrupting character in [[Mount]\\] changes results as expected (interrupt on end bracket)',
            input: 'The quick brown fox [[[[[[Mount]\\] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[Mount]\\] Escape]] [[[[BJJ]] Systems]]]]', '[[[[BJJ]] Systems]]', '[[Mount]\\] Escape]]', '[[BJJ]]'],
            expectedHtml: 'The quick brown fox [[<a href="#[[Mount]\\] Escape]] [[[[BJJ]] Systems]]">[[</a><a href="#Mount]\\] Escape">[[Mount]\\] Escape]]</a><a href="#[[Mount]\\] Escape]] [[[[BJJ]] Systems]]"> </a><a href="#[[BJJ]] Systems">[[</a><a href="#BJJ">[[BJJ]]</a><a href="#[[BJJ]] Systems"> Systems]]</a><a href="#[[Mount]\\] Escape]] [[[[BJJ]] Systems]]">]]</a> jumped over the lazy sleeping dog',
        },
        {
            description: 'Unbalanced interrupting $ character in [$[Mount]] changes results as expected (interrupt on start bracket)',
            input: 'The quick brown fox [[[[[$[Mount]] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[$[Mount]] Escape]]', '[[[[BJJ]] Systems]]', '[[[$[Mount]]', '[[BJJ]]'],
            expectedHtml: 'The quick brown fox <a href="#[[[$[Mount]] Escape">[[</a><a href="#[$[Mount">[[[$[Mount]]</a><a href="#[[[$[Mount]] Escape"> Escape]]</a> <a href="#[[BJJ]] Systems">[[</a><a href="#BJJ">[[BJJ]]</a><a href="#[[BJJ]] Systems"> Systems]]</a>]] jumped over the lazy sleeping dog',
        },
        {
            description: 'Nested tag at start in last wikilink in text',
            input: 'The quick brown fox [[[[[[Mount]] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[[Mount]] Escape]] [[[[BJJ]] Systems]]]]', '[[[[Mount]] Escape]]', '[[[[BJJ]] Systems]]', '[[Mount]]', '[[BJJ]]'],
            expectedHtml: 'The quick brown fox <a href="#[[[[Mount]] Escape]] [[[[BJJ]] Systems]]">[[</a><a href="#[[Mount]] Escape">[[</a><a href="#Mount">[[Mount]]</a><a href="#[[Mount]] Escape"> Escape]]</a><a href="#[[[[Mount]] Escape]] [[[[BJJ]] Systems]]"> </a><a href="#[[BJJ]] Systems">[[</a><a href="#BJJ">[[BJJ]]</a><a href="#[[BJJ]] Systems"> Systems]]</a><a href="#[[[[Mount]] Escape]] [[[[BJJ]] Systems]]">]]</a> jumped over the lazy sleeping dog',
        },
        {
            description: 'Nested tag at end in last wikilink in text',
            input: 'The quick brown fox [[[[[[Mount]] Escape]] [[[[BJJ]] System [[Design]]]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[[Mount]] Escape]] [[[[BJJ]] System [[Design]]]]]]', '[[[[BJJ]] System [[Design]]]]', '[[[[Mount]] Escape]]', '[[Design]]', '[[Mount]]', '[[BJJ]]'],
            expectedHtml: 'The quick brown fox <a href="#[[[[Mount]] Escape]] [[[[BJJ]] System [[Design]]]]">[[</a><a href="#[[Mount]] Escape">[[</a><a href="#Mount">[[Mount]]</a><a href="#[[Mount]] Escape"> Escape]]</a><a href="#[[[[Mount]] Escape]] [[[[BJJ]] System [[Design]]]]"> </a><a href="#[[BJJ]] System [[Design]]">[[</a><a href="#BJJ">[[BJJ]]</a><a href="#[[BJJ]] System [[Design]]"> System </a><a href="#Design">[[Design]]</a><a href="#[[BJJ]] System [[Design]]">]]</a><a href="#[[[[Mount]] Escape]] [[[[BJJ]] System [[Design]]]]">]]</a> jumped over the lazy sleeping dog',
        },
        {
            description: 'Interrupting $ character in [$[Mount]$]',
            input: 'The quick brown fox [[[[[$[Mount]$] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog',
            expectedWikilinks: ['[[[[[$[Mount]$] Escape]] [[[[BJJ]] Systems]]]]', '[[[$[Mount]$] Escape]]', '[[[[BJJ]] Systems]]', '[[BJJ]]'],
            expectedHtml: 'The quick brown fox <a href="#[[[$[Mount]$] Escape]] [[[[BJJ]] Systems]]">[[</a><a href="#[$[Mount]$] Escape">[[[$[Mount]$] Escape]]</a><a href="#[[[$[Mount]$] Escape]] [[[[BJJ]] Systems]]"> </a><a href="#[[BJJ]] Systems">[[</a><a href="#BJJ">[[BJJ]]</a><a href="#[[BJJ]] Systems"> Systems]]</a><a href="#[[[$[Mount]$] Escape]] [[[[BJJ]] Systems]]">]]</a> jumped over the lazy sleeping dog',
        },
    ];

    testCases.forEach(({ description, input, expectedWikilinks, expectedHtml }) => {
        it(description, () => {
            const wikilinkService = new WikilinkService();
            const wikilinks = wikilinkService.extractWikilinks(input);

            const resultingWikilinksCombined = wikilinks.map((wikilink) => `"${wikilink.linkText}"`).join('\n');
            console.log(resultingWikilinksCombined);

            expect(wikilinks.length).toBe(expectedWikilinks.length);
            expectedWikilinks.forEach((expectedWikilink) => {
                expect(wikilinks.map((w) => w.linkText)).toContain(expectedWikilink);
            });

            const markdownService = new MarkdownService(wikilinkService);
            const html = markdownService.convertWikiLinksToHtml(input);

            console.log(`Actual: ${html}`);
            console.log(`Expect: ${expectedHtml}`);

            expect(html).toBe(expectedHtml);
        });
    });
});

describe('MarkdownService markdown to HTML conversion tests', () => {
    const testCases = [
        {
            description: 'Markdown conversion with nested tags',
            input: `# Title
## Subtitle
Some [[[[Mount]] [[Escape]]]] text.
**Emphasis**.`,
            expectedHtml: `<h1>Title</h1>
<h2>Subtitle</h2>
<p>Some <a href="#[[Mount]] [[Escape]]">[[</a><a href="#Mount">[[Mount]]</a><a href="#[[Mount]] [[Escape]]"> </a><a href="#Escape">[[Escape]]</a><a href="#[[Mount]] [[Escape]]">]]</a> text.<br><strong>Emphasis</strong>.</p>
`,
        },
    ];

    testCases.forEach(({ description, input, expectedHtml }) => {
        it(description, () => {
            const wikilinkService = new WikilinkService();
            const markdownService = new MarkdownService(wikilinkService);

            const html = markdownService.convertMarkdownToHtml(input);

            console.log(`Actual: ${html}`);
            console.log(`Expect: ${expectedHtml.replace(/""/g, '"').replace(/\r\n/g, '\n')}`);

            expect(html).toBe(expectedHtml.replace(/\r\n/g, '\n'));
        });
    });
});
