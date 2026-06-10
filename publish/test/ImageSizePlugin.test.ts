import { describe, it, expect } from 'vitest';
import MarkdownIt from 'markdown-it';
import { imageSizePlugin } from '../src/ImageSizePlugin.js';

function render(markdown: string): string {
    const md = new MarkdownIt({ html: true });
    md.use(imageSizePlugin);
    return md.render(markdown);
}

describe('imageSizePlugin', () => {
    it('emits a width attribute and strips the hint from alt', () => {
        const html = render('![photo|300](img.png)');
        expect(html).toContain('width="300"');
        expect(html).toContain('alt="photo"');
        expect(html).not.toContain('|300');
    });

    it('emits width and height for a WxH hint', () => {
        const html = render('![photo|300x200](img.png)');
        expect(html).toContain('width="300"');
        expect(html).toContain('height="200"');
        expect(html).toContain('alt="photo"');
    });

    it('supports empty alt with a hint', () => {
        const html = render('![|150](img.png)');
        expect(html).toContain('width="150"');
        expect(html).toContain('alt=""');
    });

    it('leaves images without a hint untouched', () => {
        const html = render('![photo](img.png)');
        expect(html).toContain('alt="photo"');
        expect(html).not.toContain('width=');
    });

    it('does not treat non-numeric pipe segments as hints', () => {
        const html = render('![a|b](img.png)');
        expect(html).toContain('alt="a|b"');
        expect(html).not.toContain('width=');
    });

    it('strips only the final size segment from multi-pipe alt text', () => {
        const html = render('![a|b|300](img.png)');
        expect(html).toContain('alt="a|b"');
        expect(html).toContain('width="300"');
    });

    it('handles formatted alt text', () => {
        const html = render('![**bold** photo|200](img.png)');
        expect(html).toContain('width="200"');
        expect(html).toContain('alt="bold photo"');
    });

    it('applies to mid-sentence images too (publish has no granted-space concept)', () => {
        const html = render('text ![icon|24](icon.png) more');
        expect(html).toContain('width="24"');
    });
});
