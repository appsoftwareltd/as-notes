import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';

const CLI = path.resolve(__dirname, '..', 'dist', 'convert.js');

function run(args: string[]): string {
    return execFileSync('node', [CLI, ...args], {
        encoding: 'utf-8',
        timeout: 15000,
    });
}

describe('--static-dir', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-static-test-'));
        inputDir = path.join(tmpDir, 'blog');
        outputDir = path.join(tmpDir, 'site');
        fs.mkdirSync(inputDir, { recursive: true });
        // Create a regular public page
        fs.writeFileSync(
            path.join(inputDir, 'Hello.md'),
            '---\npublic: true\n---\n# Hello World\n',
        );
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should convert static markdown files to HTML at output root', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        fs.writeFileSync(path.join(staticDir, 'Contact.md'), '# Contact Us\n\nEmail us at hello@example.com\n');

        run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        expect(fs.existsSync(path.join(outputDir, 'contact.html'))).toBe(true);
        const html = fs.readFileSync(path.join(outputDir, 'contact.html'), 'utf-8');
        expect(html).toContain('Contact Us');
        expect(html).toContain('hello@example.com');
    });

    it('should copy non-markdown files verbatim', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        fs.writeFileSync(path.join(staticDir, 'robots.txt'), 'User-agent: *\nDisallow:\n');

        run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        expect(fs.existsSync(path.join(outputDir, 'robots.txt'))).toBe(true);
        const content = fs.readFileSync(path.join(outputDir, 'robots.txt'), 'utf-8');
        expect(content).toBe('User-agent: *\nDisallow:\n');
    });

    it('should preserve directory structure for nested files', () => {
        const staticDir = path.join(inputDir, 'static');
        const assetsDir = path.join(staticDir, 'assets');
        fs.mkdirSync(assetsDir, { recursive: true });
        fs.writeFileSync(path.join(assetsDir, 'logo.txt'), 'LOGO');

        const legalDir = path.join(staticDir, 'legal');
        fs.mkdirSync(legalDir);
        fs.writeFileSync(path.join(legalDir, 'Privacy.md'), '# Privacy Policy\n\nWe respect your privacy.\n');

        run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        expect(fs.existsSync(path.join(outputDir, 'assets', 'logo.txt'))).toBe(true);
        expect(fs.readFileSync(path.join(outputDir, 'assets', 'logo.txt'), 'utf-8')).toBe('LOGO');

        expect(fs.existsSync(path.join(outputDir, 'legal', 'privacy.html'))).toBe(true);
        const html = fs.readFileSync(path.join(outputDir, 'legal', 'privacy.html'), 'utf-8');
        expect(html).toContain('Privacy Policy');
    });

    it('should not require front matter for static pages', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        // No front matter at all
        fs.writeFileSync(path.join(staticDir, 'About.md'), '# About\n\nThis is about us.\n');

        run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        expect(fs.existsSync(path.join(outputDir, 'about.html'))).toBe(true);
        const html = fs.readFileSync(path.join(outputDir, 'about.html'), 'utf-8');
        expect(html).toContain('About');
        expect(html).toContain('This is about us.');
    });

    it('should honour front matter title and layout if present', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        fs.writeFileSync(path.join(staticDir, 'Contact.md'), '---\ntitle: Get in Touch\nlayout: minimal\n---\n# Contact\n\nHello\n');

        run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        const html = fs.readFileSync(path.join(outputDir, 'contact.html'), 'utf-8');
        expect(html).toContain('Get in Touch');
        // minimal layout: no site-nav
        expect(html).not.toContain('site-nav');
    });

    it('should not include static pages in auto-generated navigation', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        fs.writeFileSync(path.join(staticDir, 'Contact.md'), '# Contact\n');

        run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        // The hello.html nav should not list Contact
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).not.toContain('>Contact<');
    });

    it('should include static pages in sitemap.xml', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        fs.writeFileSync(path.join(staticDir, 'Contact.md'), '# Contact\n');

        run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        const sitemap = fs.readFileSync(path.join(outputDir, 'sitemap.xml'), 'utf-8');
        expect(sitemap).toContain('contact.html');
    });

    it('should resolve wikilinks from regular pages to static pages', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        fs.writeFileSync(path.join(staticDir, 'Contact.md'), '# Contact\n');
        // Regular page links to Contact via wikilink
        fs.writeFileSync(
            path.join(inputDir, 'Hello.md'),
            '---\npublic: true\n---\n# Hello\n\nSee our [[Contact]] page.\n',
        );

        run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('href="contact.html"');
    });

    it('should resolve wikilinks from static pages to regular pages', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        fs.writeFileSync(path.join(staticDir, 'Contact.md'), '# Contact\n\nBack to [[Hello]]\n');

        run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        const html = fs.readFileSync(path.join(outputDir, 'contact.html'), 'utf-8');
        expect(html).toContain('href="hello.html"');
    });

    it('should work with config file staticDir field', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        fs.writeFileSync(path.join(staticDir, 'About.md'), '# About\n');

        const configPath = path.join(inputDir, 'asnotes-publish.json');
        fs.writeFileSync(configPath, JSON.stringify({
            defaultPublic: true,
            staticDir: 'static',
            outputDir: outputDir,
        }));

        run(['--config', configPath]);

        expect(fs.existsSync(path.join(outputDir, 'about.html'))).toBe(true);
    });

    it('should not process static dir pages as regular public pages', () => {
        const staticDir = path.join(inputDir, 'static');
        fs.mkdirSync(staticDir);
        fs.writeFileSync(path.join(staticDir, 'Contact.md'), '# Contact\n');

        const output = run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        // Static pages are logged with [static] prefix
        expect(output).toContain('[static]');
        expect(output).toContain('Contact.md');
    });

    it('should do nothing when staticDir does not exist', () => {
        // No static directory created
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public', '--static-dir', 'static']);

        // Should still succeed with normal page conversion
        expect(fs.existsSync(path.join(outputDir, 'hello.html'))).toBe(true);
    });
});
