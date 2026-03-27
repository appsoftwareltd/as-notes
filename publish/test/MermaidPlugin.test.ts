import { describe, it, expect } from 'vitest';
import MarkdownIt from 'markdown-it';
import { mermaidPlugin } from '../src/MermaidPlugin.js';

function render(markdown: string): string {
    const md = new MarkdownIt({ html: true });
    md.use(mermaidPlugin);
    return md.render(markdown);
}

describe('MermaidPlugin', () => {
    it('should render mermaid fenced block as <pre class="mermaid">', () => {
        const html = render('```mermaid\ngraph TD\n    A --> B\n```');
        expect(html).toContain('<pre class="mermaid">');
        expect(html).toContain('graph TD');
        expect(html).toContain('A --&gt; B');
        expect(html).not.toContain('<code');
    });

    it('should not affect non-mermaid fenced blocks', () => {
        const html = render('```javascript\nconst x = 1;\n```');
        expect(html).toContain('<code');
        expect(html).not.toContain('class="mermaid"');
    });

    it('should escape HTML in mermaid source', () => {
        const html = render('```mermaid\ngraph TD\n    A["<script>alert(1)</script>"] --> B\n```');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('should handle case-insensitive language tag', () => {
        const html = render('```Mermaid\ngraph LR\n    X --> Y\n```');
        expect(html).toContain('<pre class="mermaid">');
        expect(html).toContain('graph LR');
    });

    it('should trim whitespace from diagram source', () => {
        const html = render('```mermaid\n\n  graph TD\n    A --> B\n\n```');
        expect(html).toMatch(/<pre class="mermaid">graph TD/);
    });

    it('should handle flowchart diagram', () => {
        const md = [
            '```mermaid',
            'flowchart LR',
            '    Sun --> Leaves --> Photosynthesis --> Growth',
            '    Water --> Roots --> Growth',
            '```',
        ].join('\n');
        const html = render(md);
        expect(html).toContain('<pre class="mermaid">');
        expect(html).toContain('flowchart LR');
    });

    it('should handle multiple mermaid blocks on a page', () => {
        const md = '```mermaid\ngraph TD\n    A --> B\n```\n\nSome text\n\n```mermaid\nsequenceDiagram\n    Alice->>Bob: Hi\n```';
        const html = render(md);
        const matches = html.match(/<pre class="mermaid">/g);
        expect(matches).toHaveLength(2);
    });

    it('should not wrap in <code> tag', () => {
        const html = render('```mermaid\ngraph TD\n    A --> B\n```');
        expect(html).not.toContain('<code class="language-mermaid"');
    });
});
