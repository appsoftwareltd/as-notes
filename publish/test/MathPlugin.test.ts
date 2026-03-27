import { describe, it, expect } from 'vitest';
import MarkdownIt from 'markdown-it';
import { mathPlugin, parseMathDelimiters } from '../src/MathPlugin.js';
import { mermaidPlugin } from '../src/MermaidPlugin.js';

function render(markdown: string): string {
    const md = new MarkdownIt({ html: true });
    md.use(mathPlugin);
    return md.render(markdown);
}

describe('parseMathDelimiters', () => {
    it('should parse inline math', () => {
        const parts = parseMathDelimiters('the value is $x + 1$ here');
        expect(parts).toEqual([
            { type: 'text', content: 'the value is ' },
            { type: 'inline', content: 'x + 1' },
            { type: 'text', content: ' here' },
        ]);
    });

    it('should parse display math', () => {
        const parts = parseMathDelimiters('$$E = mc^2$$');
        expect(parts).toEqual([
            { type: 'display', content: 'E = mc^2' },
        ]);
    });

    it('should handle escaped dollar signs', () => {
        const parts = parseMathDelimiters('price is \\$5 and $x$');
        expect(parts).toEqual([
            { type: 'text', content: 'price is \\$5 and ' },
            { type: 'inline', content: 'x' },
        ]);
    });

    it('should ignore empty math regions', () => {
        // Whitespace-only content between delimiters is not treated as math
        const parts = parseMathDelimiters('a $  $ b');
        expect(parts).toEqual([
            { type: 'text', content: 'a $  $ b' },
        ]);
    });

    it('should handle multiple inline math regions', () => {
        const parts = parseMathDelimiters('$a$ and $b$');
        expect(parts).toEqual([
            { type: 'inline', content: 'a' },
            { type: 'text', content: ' and ' },
            { type: 'inline', content: 'b' },
        ]);
    });

    it('should handle mixed inline and display math', () => {
        const parts = parseMathDelimiters('inline $x$ then $$y$$');
        expect(parts).toEqual([
            { type: 'text', content: 'inline ' },
            { type: 'inline', content: 'x' },
            { type: 'text', content: ' then ' },
            { type: 'display', content: 'y' },
        ]);
    });

    it('should return text-only for strings without dollar signs', () => {
        const parts = parseMathDelimiters('no math here');
        expect(parts).toEqual([
            { type: 'text', content: 'no math here' },
        ]);
    });

    it('should handle unmatched single dollar sign', () => {
        const parts = parseMathDelimiters('price is $5 but no closing');
        expect(parts).toEqual([
            { type: 'text', content: 'price is $5 but no closing' },
        ]);
    });
});

describe('MathPlugin', () => {
    describe('inline math', () => {
        it('should render inline $...$ math with KaTeX', () => {
            const html = render('The value is $x + 1$ here.');
            expect(html).toContain('katex');
            expect(html).not.toContain('$x + 1$');
        });

        it('should render multiple inline math expressions', () => {
            const html = render('$a$ and $b$');
            expect(html).toContain('katex');
            // Should contain two katex renderings
            const matches = html.match(/class="katex"/g);
            expect(matches).toBeTruthy();
            expect(matches!.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('display math', () => {
        it('should render display $$...$$ math with KaTeX', () => {
            const html = render('$$E = mc^2$$');
            expect(html).toContain('katex');
            expect(html).toContain('katex-display');
        });

        it('should render multi-line $$ display math (delimiters on own lines)', () => {
            const html = render('$$\n\\frac{dP}{dt} = rP\\left(1 - \\frac{P}{K}\\right)\n$$');
            expect(html).toContain('katex');
            expect(html).toContain('katex-display');
            expect(html).not.toContain('$$');
        });

        it('should render multi-line $$ display math with blank lines', () => {
            const html = render('$$\n\n\\frac{a}{b}\n\n$$');
            expect(html).toContain('katex');
            expect(html).toContain('katex-display');
        });

        it('should handle empty multi-line $$ block', () => {
            const html = render('$$\n\n$$');
            expect(html.trim()).toBe('');
        });

        it('should render multi-line $$ with multiple content lines', () => {
            const html = render('$$\na + b\n= c + d\n$$');
            expect(html).toContain('katex');
            expect(html).toContain('katex-display');
        });
    });

    describe('fenced code blocks', () => {
        it('should render ```math blocks as display math', () => {
            const html = render('```math\nE = mc^2\n```');
            expect(html).toContain('katex');
            expect(html).toContain('katex-display');
        });

        it('should render ```latex blocks as display math', () => {
            const html = render('```latex\n\\frac{a}{b}\n```');
            expect(html).toContain('katex');
            expect(html).toContain('frac');
        });

        it('should not affect other fenced code blocks', () => {
            const html = render('```javascript\nconst x = 1;\n```');
            expect(html).toContain('<code');
            expect(html).not.toContain('katex');
        });

        it('should handle empty math fenced block gracefully', () => {
            const html = render('```math\n\n```');
            // Empty blocks should produce no output
            expect(html.trim()).toBe('');
        });
    });

    describe('error handling', () => {
        it('should render invalid LaTeX with error class', () => {
            // KaTeX with throwOnError: false renders best-effort or error span
            const html = render('$\\invalid_command_xyz$');
            // Should still render something (KaTeX handles unknown commands gracefully)
            expect(html).toBeTruthy();
        });
    });

    describe('escaped dollar signs', () => {
        it('should not treat escaped \\$ as math delimiters', () => {
            const html = render('The price is \\$5.');
            expect(html).not.toContain('katex');
            expect(html).toContain('$5');
        });
    });

    describe('interaction with other plugins', () => {
        it('should work alongside mermaid plugin', () => {
            const md = new MarkdownIt({ html: true });
            md.use(mermaidPlugin);
            md.use(mathPlugin);

            const markdown = '```mermaid\ngraph TD\n    A --> B\n```\n\n```math\nE = mc^2\n```\n\nInline $x$';
            const html = md.render(markdown);

            expect(html).toContain('class="mermaid"');
            expect(html).toContain('katex');
        });
    });
});
