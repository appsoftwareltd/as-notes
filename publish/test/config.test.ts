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

function runExpectError(args: string[]): string {
    try {
        execFileSync('node', [CLI, ...args], {
            encoding: 'utf-8',
            timeout: 15000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        throw new Error('Expected process to exit with error');
    } catch (err: unknown) {
        const e = err as { stderr?: string; status?: number };
        return e.stderr ?? '';
    }
}

describe('--config flag', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;
    let configPath: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-config-test-'));
        inputDir = path.join(tmpDir, 'notes');
        outputDir = path.join(tmpDir, 'site');
        configPath = path.join(tmpDir, 'asnotes-publish.json');
        fs.mkdirSync(inputDir, { recursive: true });
        // Create a simple test page
        fs.writeFileSync(
            path.join(inputDir, 'Hello.md'),
            '---\npublic: true\n---\n# Hello World\n',
        );
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should load config file and use its settings', () => {
        fs.writeFileSync(configPath, JSON.stringify({
            defaultPublic: true,
            defaultAssets: true,
            layout: 'blog',
            outputDir: './site',
        }));
        // --config + --input: config provides outputDir, layout
        const output = run(['--config', configPath, '--input', inputDir]);
        expect(output).toContain('Hello');
        expect(fs.existsSync(path.join(outputDir, 'hello.html'))).toBe(true);
        // Verify blog layout was used
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('blog-post');
    });

    it('should default --input to config file parent directory', () => {
        // Put the config in the notes dir itself
        const cfgInNotes = path.join(inputDir, 'asnotes-publish.json');
        fs.writeFileSync(cfgInNotes, JSON.stringify({
            defaultPublic: true,
            outputDir: path.resolve(outputDir),
        }));
        // No --input flag: should default to inputDir (config file's directory)
        const output = run(['--config', cfgInNotes]);
        expect(output).toContain('Hello');
        expect(fs.existsSync(path.join(outputDir, 'hello.html'))).toBe(true);
    });

    it('should default --output from config outputDir resolved relative to config dir', () => {
        fs.writeFileSync(configPath, JSON.stringify({
            defaultPublic: true,
            outputDir: './site',
        }));
        // --input from CLI, --output from config (relative to config dir = tmpDir)
        const output = run(['--config', configPath, '--input', inputDir]);
        expect(output).toContain('Hello');
        expect(fs.existsSync(path.join(tmpDir, 'site', 'hello.html'))).toBe(true);
    });

    it('CLI flags should override config values', () => {
        fs.writeFileSync(configPath, JSON.stringify({
            defaultPublic: true,
            layout: 'blog',
            outputDir: './site',
        }));
        // Override layout via CLI
        const output = run(['--config', configPath, '--input', inputDir, '--layout', 'minimal']);
        expect(fs.existsSync(path.join(outputDir, 'hello.html'))).toBe(true);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        // minimal layout has no nav and no special article class
        expect(html).not.toContain('blog-post');
        expect(html).not.toContain('site-nav');
    });

    it('CLI --output should override config outputDir', () => {
        const altOutput = path.join(tmpDir, 'alt-output');
        fs.writeFileSync(configPath, JSON.stringify({
            defaultPublic: true,
            outputDir: './site',
        }));
        run(['--config', configPath, '--input', inputDir, '--output', altOutput]);
        expect(fs.existsSync(path.join(altOutput, 'hello.html'))).toBe(true);
        // Config's outputDir should NOT be created
        expect(fs.existsSync(outputDir)).toBe(false);
    });

    it('should load stylesheets and exclude from config', () => {
        // Create a subdirectory with a note that should be excluded
        const draftsDir = path.join(inputDir, 'drafts');
        fs.mkdirSync(draftsDir);
        fs.writeFileSync(
            path.join(draftsDir, 'Secret.md'),
            '---\npublic: true\n---\n# Secret\n',
        );
        fs.writeFileSync(configPath, JSON.stringify({
            defaultPublic: true,
            exclude: ['drafts'],
            outputDir: './site',
        }));
        const output = run(['--config', configPath, '--input', inputDir]);
        expect(output).toContain('Hello');
        // Secret should NOT be in the output (excluded)
        expect(fs.existsSync(path.join(outputDir, 'secret.html'))).toBe(false);
    });

    it('should error on missing config file', () => {
        const stderr = runExpectError(['--config', path.join(tmpDir, 'nonexistent.json')]);
        expect(stderr).toContain('Config file not found');
    });

    it('should error on invalid JSON in config file', () => {
        fs.writeFileSync(configPath, 'not json');
        const stderr = runExpectError([
            '--config', configPath,
            '--input', inputDir,
            '--output', outputDir,
        ]);
        expect(stderr).toContain('Invalid JSON');
    });

    it('should still work without --config (backward compatible)', () => {
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public']);
        expect(output).toContain('Hello');
        expect(fs.existsSync(path.join(outputDir, 'hello.html'))).toBe(true);
    });

    it('should load includes directory from config', () => {
        const includesDir = path.join(tmpDir, 'includes');
        fs.mkdirSync(includesDir, { recursive: true });
        fs.writeFileSync(path.join(includesDir, 'header.html'), '<div class="my-header">Site Header</div>');
        fs.writeFileSync(configPath, JSON.stringify({
            defaultPublic: true,
            includes: './includes',
            outputDir: './site',
        }));
        run(['--config', configPath, '--input', inputDir]);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('<header>');
        expect(html).toContain('my-header');
        expect(html).toContain('Site Header');
    });

    it('CLI --includes should override config includes', () => {
        const includesDir1 = path.join(tmpDir, 'inc1');
        const includesDir2 = path.join(tmpDir, 'inc2');
        fs.mkdirSync(includesDir1, { recursive: true });
        fs.mkdirSync(includesDir2, { recursive: true });
        fs.writeFileSync(path.join(includesDir1, 'header.html'), '<div>Header One</div>');
        fs.writeFileSync(path.join(includesDir2, 'header.html'), '<div>Header Two</div>');
        fs.writeFileSync(configPath, JSON.stringify({
            defaultPublic: true,
            includes: './inc1',
            outputDir: './site',
        }));
        run(['--config', configPath, '--input', inputDir, '--includes', includesDir2]);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('Header Two');
        expect(html).not.toContain('Header One');
    });
});

describe('auto-generated index page', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-index-test-'));
        inputDir = path.join(tmpDir, 'notes');
        outputDir = path.join(tmpDir, 'site');
        fs.mkdirSync(inputDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should auto-generate index.html when no index.md exists', () => {
        fs.writeFileSync(path.join(inputDir, 'About.md'), '---\npublic: true\n---\n# About\n');
        fs.writeFileSync(path.join(inputDir, 'Contact.md'), '---\npublic: true\n---\n# Contact\n');
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public']);
        expect(output).toContain('No index.md found');
        expect(fs.existsSync(path.join(outputDir, 'index.html'))).toBe(true);
        const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf-8');
        // Links should point to correct pages
        expect(html).toContain('href="about.html"');
        expect(html).toContain('href="contact.html"');
        expect(html).toContain('About');
        expect(html).toContain('Contact');
        expect(html).toContain('<title>Home</title>');
    });

    it('should use existing index.md when present', () => {
        fs.writeFileSync(path.join(inputDir, 'index.md'), '---\npublic: true\ntitle: Welcome\n---\n# My Home Page\n');
        fs.writeFileSync(path.join(inputDir, 'About.md'), '---\npublic: true\n---\n# About\n');
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public']);
        expect(output).not.toContain('No index.md found');
        expect(fs.existsSync(path.join(outputDir, 'index.html'))).toBe(true);
        const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf-8');
        expect(html).toContain('My Home Page');
        expect(html).toContain('<title>Welcome</title>');
    });

    it('auto-generated index should include Home in navigation', () => {
        fs.writeFileSync(path.join(inputDir, 'Page1.md'), '---\npublic: true\n---\n# Page 1\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public']);
        const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf-8');
        // Nav should include Home link for the auto-generated index
        expect(html).toContain('Home');
        expect(html).toContain('index.html');
    });

    it('should render nested wikilinks as separate links in auto-generated nav', () => {
        fs.writeFileSync(path.join(inputDir, 'Plant.md'), '---\npublic: true\n---\n# Plant\n');
        fs.writeFileSync(path.join(inputDir, '[[Plant]] Foods.md'), '---\npublic: true\n---\n# Plant Foods\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public']);
        const html = fs.readFileSync(path.join(outputDir, 'plant.html'), 'utf-8');
        const nav = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
        // The nav item for "[[Plant]] Foods" should contain two separate <a> tags
        expect(nav).toContain('href="plant.html"');
        expect(nav).toContain('href="plant-foods.html"');
        // Both links should be in the same <li>
        const plantFoodsLi = nav.match(/<li[^>]*>.*?plant-foods\.html.*?<\/li>/s)?.[0] || '';
        expect(plantFoodsLi).toContain('href="plant.html"');
        expect(plantFoodsLi).toContain('href="plant-foods.html"');
    });

    it('should render nested wikilinks as separate links in auto-generated index', () => {
        fs.writeFileSync(path.join(inputDir, 'Plant.md'), '---\npublic: true\n---\n# Plant\n');
        fs.writeFileSync(path.join(inputDir, '[[Plant]] Foods.md'), '---\npublic: true\n---\n# Plant Foods\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public']);
        const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf-8');
        const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)?.[1] || '';
        // Index listing for "[[Plant]] Foods" should have two separate links
        const plantFoodsLi = article.match(/<li[^>]*>.*?plant-foods\.html.*?<\/li>/s)?.[0] || '';
        expect(plantFoodsLi).toContain('href="plant.html"');
        expect(plantFoodsLi).toContain('href="plant-foods.html"');
    });
});

describe('.enc.md exclusion', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-enc-test-'));
        inputDir = path.join(tmpDir, 'notes');
        outputDir = path.join(tmpDir, 'site');
        fs.mkdirSync(inputDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should exclude .enc.md files from published output', () => {
        fs.writeFileSync(path.join(inputDir, 'Public.md'), '---\npublic: true\n---\n# Public Page\n');
        fs.writeFileSync(path.join(inputDir, 'Secret.enc.md'), '---\npublic: true\n---\n# Secret Note\n');
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public']);
        expect(output).toContain('Public');
        expect(output).not.toContain('Secret');
        expect(fs.existsSync(path.join(outputDir, 'public.html'))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, 'secret.html'))).toBe(false);
        expect(fs.existsSync(path.join(outputDir, 'secret-enc.html'))).toBe(false);
    });

    it('should exclude .enc.md files even with --default-public', () => {
        fs.writeFileSync(path.join(inputDir, 'Normal.md'), '# Normal\n');
        fs.writeFileSync(path.join(inputDir, 'Encrypted.enc.md'), '# Encrypted\n');
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public']);
        expect(output).toContain('Normal');
        expect(output).not.toContain('Encrypted');
    });

    it('should exclude .enc.md files in subdirectories', () => {
        const subDir = path.join(inputDir, 'private');
        fs.mkdirSync(subDir, { recursive: true });
        fs.writeFileSync(path.join(inputDir, 'Public.md'), '---\npublic: true\n---\n# Public\n');
        fs.writeFileSync(path.join(subDir, 'Deep.enc.md'), '---\npublic: true\n---\n# Deep Secret\n');
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public']);
        expect(output).toContain('Public');
        expect(output).not.toContain('Deep');
    });
});

describe('--layouts flag', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;
    let layoutsDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-layouts-test-'));
        inputDir = path.join(tmpDir, 'notes');
        outputDir = path.join(tmpDir, 'site');
        layoutsDir = path.join(tmpDir, 'layouts');
        fs.mkdirSync(inputDir, { recursive: true });
        fs.mkdirSync(layoutsDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should use custom layout from layouts directory', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
        fs.writeFileSync(path.join(layoutsDir, 'docs.html'), '<html><body class="custom-layout">{{content}}</body></html>');
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public', '--layouts', layoutsDir]);
        expect(output).toContain('Hello');
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('custom-layout');
    });

    it('should fall back to built-in layout when layouts directory has no matching file', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
        // layoutsDir exists but has no docs.html
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public', '--layouts', layoutsDir]);
        expect(output).toContain('Hello');
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('markdown-body');
    });

    it('should load layouts from config file', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
        fs.writeFileSync(path.join(layoutsDir, 'blog.html'), '<html><body class="my-blog">{{content}}</body></html>');
        const configPath = path.join(tmpDir, 'asnotes-publish.json');
        fs.writeFileSync(configPath, JSON.stringify({
            inputDir: './notes',
            outputDir: './site',
            defaultPublic: true,
            layout: 'blog',
            layouts: './layouts',
        }));
        const output = run(['--config', configPath]);
        expect(output).toContain('Hello');
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('my-blog');
    });

    it('should prefer layouts directory over includes directory for layout files', () => {
        const includesDir = path.join(tmpDir, 'includes');
        fs.mkdirSync(includesDir, { recursive: true });
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
        fs.writeFileSync(path.join(layoutsDir, 'docs.html'), '<html><body class="from-layouts">{{content}}</body></html>');
        fs.writeFileSync(path.join(includesDir, 'docs.html'), '<html><body class="from-includes">{{content}}</body></html>');
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public', '--layouts', layoutsDir, '--includes', includesDir]);
        expect(output).toContain('Hello');
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('from-layouts');
        expect(html).not.toContain('from-includes');
    });
});

describe('data-layout attribute', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-data-layout-test-'));
        inputDir = path.join(tmpDir, 'notes');
        outputDir = path.join(tmpDir, 'site');
        fs.mkdirSync(inputDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should add data-layout="docs" to body for docs layout', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--layout', 'docs']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('data-layout="docs"');
    });

    it('should add data-layout="blog" to body for blog layout', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--layout', 'blog']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('data-layout="blog"');
    });

    it('should add data-layout="minimal" to body for minimal layout', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--layout', 'minimal']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('data-layout="minimal"');
    });

    it('should place nav after article in blog layout', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
        fs.writeFileSync(path.join(inputDir, 'World.md'), '---\npublic: true\n---\n# World\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--layout', 'blog']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        const articleEnd = html.indexOf('</article>');
        const navStart = html.indexOf('<nav');
        expect(articleEnd).toBeGreaterThan(-1);
        expect(navStart).toBeGreaterThan(-1);
        expect(navStart).toBeGreaterThan(articleEnd);
    });

    it('should place nav before article in docs layout', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
        fs.writeFileSync(path.join(inputDir, 'World.md'), '---\npublic: true\n---\n# World\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--layout', 'docs']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        const articleStart = html.indexOf('<article');
        const navStart = html.indexOf('<nav');
        expect(articleStart).toBeGreaterThan(-1);
        expect(navStart).toBeGreaterThan(-1);
        expect(navStart).toBeLessThan(articleStart);
    });
});

describe('asset path resolution', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-asset-test-'));
        inputDir = path.join(tmpDir, 'notes');
        outputDir = path.join(tmpDir, 'site');
        fs.mkdirSync(inputDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should copy assets referenced by same-directory images', () => {
        fs.writeFileSync(path.join(inputDir, 'photo.png'), 'PNG_DATA');
        fs.writeFileSync(
            path.join(inputDir, 'Page.md'),
            '---\npublic: true\nassets: true\n---\n# Page\n\n![Image](photo.png)\n',
        );
        run(['--input', inputDir, '--output', outputDir]);
        expect(fs.existsSync(path.join(outputDir, 'photo.png'))).toBe(true);
        const html = fs.readFileSync(path.join(outputDir, 'page.html'), 'utf-8');
        expect(html).toContain('src="photo.png"');
    });

    it('should copy assets in subdirectories and rewrite paths', () => {
        const imgDir = path.join(inputDir, 'images');
        fs.mkdirSync(imgDir, { recursive: true });
        fs.writeFileSync(path.join(imgDir, 'pic.png'), 'PNG_DATA');
        fs.writeFileSync(
            path.join(inputDir, 'Page.md'),
            '---\npublic: true\nassets: true\n---\n# Page\n\n![Image](images/pic.png)\n',
        );
        run(['--input', inputDir, '--output', outputDir]);
        expect(fs.existsSync(path.join(outputDir, 'images', 'pic.png'))).toBe(true);
        const html = fs.readFileSync(path.join(outputDir, 'page.html'), 'utf-8');
        expect(html).toContain('src="images/pic.png"');
    });

    it('should copy assets referenced with ../ paths outside input dir', () => {
        // Input is a subdirectory; assets are at the parent level
        const pagesDir = path.join(tmpDir, 'docs', 'pages');
        const assetsDir = path.join(tmpDir, 'docs', 'assets', 'images');
        const outDir = path.join(tmpDir, 'out');
        fs.mkdirSync(pagesDir, { recursive: true });
        fs.mkdirSync(assetsDir, { recursive: true });
        fs.writeFileSync(path.join(assetsDir, 'screenshot.png'), 'PNG_DATA');
        fs.writeFileSync(
            path.join(pagesDir, 'index.md'),
            '---\npublic: true\nassets: true\n---\n# Home\n\n![Screenshot](../assets/images/screenshot.png)\n',
        );
        run(['--input', pagesDir, '--output', outDir]);
        // Asset should be copied into output (leading ../ stripped)
        expect(fs.existsSync(path.join(outDir, 'assets', 'images', 'screenshot.png'))).toBe(true);
        const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8');
        expect(html).toContain('src="assets/images/screenshot.png"');
    });

    it('should copy assets from pages in subdirectories', () => {
        const subDir = path.join(inputDir, 'guides');
        const imgDir = path.join(inputDir, 'images');
        fs.mkdirSync(subDir, { recursive: true });
        fs.mkdirSync(imgDir, { recursive: true });
        fs.writeFileSync(path.join(imgDir, 'help.png'), 'PNG_DATA');
        fs.writeFileSync(
            path.join(subDir, 'Tutorial.md'),
            '---\npublic: true\nassets: true\n---\n# Tutorial\n\n![Help](../images/help.png)\n',
        );
        run(['--input', inputDir, '--output', outputDir, '--default-public']);
        expect(fs.existsSync(path.join(outputDir, 'images', 'help.png'))).toBe(true);
        const html = fs.readFileSync(path.join(outputDir, 'tutorial.html'), 'utf-8');
        expect(html).toContain('src="images/help.png"');
    });

    it('should apply base-url prefix to rewritten asset paths', () => {
        fs.writeFileSync(path.join(inputDir, 'photo.png'), 'PNG_DATA');
        fs.writeFileSync(
            path.join(inputDir, 'Page.md'),
            '---\npublic: true\nassets: true\n---\n# Page\n\n![Image](photo.png)\n',
        );
        run(['--input', inputDir, '--output', outputDir, '--base-url', '/my-repo']);
        const html = fs.readFileSync(path.join(outputDir, 'page.html'), 'utf-8');
        expect(html).toContain('src="/my-repo/photo.png"');
    });

    it('should warn for missing referenced assets', () => {
        fs.writeFileSync(
            path.join(inputDir, 'Page.md'),
            '---\npublic: true\nassets: true\n---\n# Page\n\n![Missing](gone.png)\n',
        );
        const output = run(['--input', inputDir, '--output', outputDir]);
        expect(output).toContain('warning');
        expect(output).toContain('not found');
    });
});

describe('nav.md custom navigation', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-nav-test-'));
        inputDir = path.join(tmpDir, 'notes');
        outputDir = path.join(tmpDir, 'site');
        fs.mkdirSync(inputDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should use auto-generated nav when no nav.md exists', () => {
        fs.writeFileSync(path.join(inputDir, 'Alpha.md'), '---\npublic: true\n---\n# Alpha\n');
        fs.writeFileSync(path.join(inputDir, 'Beta.md'), '---\npublic: true\n---\n# Beta\n');
        run(['--input', inputDir, '--output', outputDir]);
        const html = fs.readFileSync(path.join(outputDir, 'alpha.html'), 'utf-8');
        expect(html).toContain('site-nav');
        expect(html).toContain('Alpha');
        expect(html).toContain('Beta');
        // Should have nav-current for auto-generated nav
        expect(html).toContain('nav-current');
    });

    it('should render nav.md as custom navigation', () => {
        fs.writeFileSync(path.join(inputDir, 'Alpha.md'), '---\npublic: true\n---\n# Alpha\n');
        fs.writeFileSync(path.join(inputDir, 'Beta.md'), '---\npublic: true\n---\n# Beta\n');
        fs.writeFileSync(
            path.join(inputDir, 'nav.md'),
            '- [[Alpha]]\n\n---\n\n- [[Beta]]\n',
        );
        const output = run(['--input', inputDir, '--output', outputDir]);
        expect(output).toContain('nav.md');
        const html = fs.readFileSync(path.join(outputDir, 'alpha.html'), 'utf-8');
        expect(html).toContain('site-nav');
        expect(html).toContain('alpha.html');
        expect(html).toContain('beta.html');
        // Should contain the <hr> from --- in nav.md
        expect(html).toContain('<hr');
    });

    it('should not publish nav.md as a standalone page', () => {
        fs.writeFileSync(path.join(inputDir, 'Alpha.md'), '---\npublic: true\n---\n# Alpha\n');
        fs.writeFileSync(
            path.join(inputDir, 'nav.md'),
            '- [[Alpha]]\n',
        );
        run(['--input', inputDir, '--output', outputDir, '--default-public']);
        expect(fs.existsSync(path.join(outputDir, 'nav.html'))).toBe(false);
    });

    it('should apply base-url to wikilinks in nav.md', () => {
        fs.writeFileSync(path.join(inputDir, 'Alpha.md'), '---\npublic: true\n---\n# Alpha\n');
        fs.writeFileSync(
            path.join(inputDir, 'nav.md'),
            '- [[Alpha]]\n',
        );
        run(['--input', inputDir, '--output', outputDir, '--base-url', '/docs']);
        const html = fs.readFileSync(path.join(outputDir, 'alpha.html'), 'utf-8');
        expect(html).toContain('href="/docs/alpha.html"');
    });

    it('should apply base-url to wikilinks in article body', () => {
        fs.writeFileSync(path.join(inputDir, 'Alpha.md'), '---\npublic: true\n---\n# Alpha\nSee [[Beta]] for more.\n');
        fs.writeFileSync(path.join(inputDir, 'Beta.md'), '---\npublic: true\n---\n# Beta\nBack to [[Alpha]].\n');
        run(['--input', inputDir, '--output', outputDir, '--base-url', '/docs']);
        const alphaHtml = fs.readFileSync(path.join(outputDir, 'alpha.html'), 'utf-8');
        const betaHtml = fs.readFileSync(path.join(outputDir, 'beta.html'), 'utf-8');
        // Extract article body to avoid matching nav links
        const alphaBody = alphaHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/)?.[1] || '';
        const betaBody = betaHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/)?.[1] || '';
        expect(alphaBody).toContain('href="/docs/beta.html"');
        expect(betaBody).toContain('href="/docs/alpha.html"');
    });

    it('should support headings and markdown formatting in nav.md', () => {
        fs.writeFileSync(path.join(inputDir, 'Alpha.md'), '---\npublic: true\n---\n# Alpha\n');
        fs.writeFileSync(path.join(inputDir, 'Beta.md'), '---\npublic: true\n---\n# Beta\n');
        fs.writeFileSync(
            path.join(inputDir, 'nav.md'),
            '### Section One\n\n- [[Alpha]]\n\n### Section Two\n\n- [[Beta]]\n',
        );
        run(['--input', inputDir, '--output', outputDir]);
        const html = fs.readFileSync(path.join(outputDir, 'alpha.html'), 'utf-8');
        expect(html).toContain('Section One');
        expect(html).toContain('Section Two');
        expect(html).toContain('<h3');
    });

    it('should not include nav.md in sitemap', () => {
        fs.writeFileSync(path.join(inputDir, 'Alpha.md'), '---\npublic: true\n---\n# Alpha\n');
        fs.writeFileSync(
            path.join(inputDir, 'nav.md'),
            '- [[Alpha]]\n',
        );
        run(['--input', inputDir, '--output', outputDir, '--default-public']);
        const sitemap = fs.readFileSync(path.join(outputDir, 'sitemap.xml'), 'utf-8');
        expect(sitemap).not.toContain('nav.html');
        expect(sitemap).toContain('alpha.html');
    });

    it('should render nested wikilinks in bulleted list as inline links within a single li', () => {
        fs.writeFileSync(path.join(inputDir, 'Plant.md'), '---\npublic: true\n---\n# Plant\n');
        fs.writeFileSync(path.join(inputDir, 'Plant Foods.md'), '---\npublic: true\n---\n# Plant Foods\n');
        fs.writeFileSync(path.join(inputDir, 'Demo.md'), '---\npublic: true\n---\n# Demo\n');
        fs.writeFileSync(path.join(inputDir, 'Plant Based.md'), '---\npublic: true\n---\n# Plant Based\n');
        fs.writeFileSync(
            path.join(inputDir, 'nav.md'),
            '- [[[[Plant]] Foods]]\n- [[Plant Based [[Demo]]]]\n',
        );
        run(['--input', inputDir, '--output', outputDir]);
        const html = fs.readFileSync(path.join(outputDir, 'plant.html'), 'utf-8');
        // Nested wikilinks should produce multiple <a> tags inside a single <li>
        // [[[[Plant]] Foods]] -> <li>...<a>Plant</a><a> Foods</a>...</li>
        const navMatch = html.match(/<nav class="site-nav">([\s\S]*?)<\/nav>/);
        expect(navMatch).not.toBeNull();
        const navHtml = navMatch![1];
        // Each bulleted item should be a single <li> containing the wikilink parts
        const liItems = navHtml.match(/<li>[\s\S]*?<\/li>/g) ?? [];
        expect(liItems.length).toBe(2);
        // First <li> should contain both "Plant" and "Foods" as links
        expect(liItems[0]).toContain('plant.html');
        expect(liItems[0]).toContain('plant-foods.html');
        // Second <li> should contain both "Plant Based" and "Demo" as links
        // Outer wikilink target is "Plant Based Demo" (inner brackets stripped) → plant-based-demo.html
        expect(liItems[1]).toContain('demo.html');
        expect(liItems[1]).toContain('plant-based-demo.html');
    });
});

describe('--theme and --themes flags', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-theme-test-'));
        inputDir = path.join(tmpDir, 'notes');
        outputDir = path.join(tmpDir, 'site');
        fs.mkdirSync(inputDir, { recursive: true });
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n');
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should not include sticky positioning in default theme nav', () => {
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--theme', 'default']);
        const css = fs.readFileSync(path.join(outputDir, 'theme-default.css'), 'utf-8');
        expect(css).not.toContain('position: sticky');
        expect(css).not.toMatch(/[^-]height: 100vh/);
        expect(css).toContain('.site-nav');
    });

    it('should not include sticky positioning in dark theme nav', () => {
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--theme', 'dark']);
        const css = fs.readFileSync(path.join(outputDir, 'theme-dark.css'), 'utf-8');
        expect(css).not.toContain('position: sticky');
        expect(css).not.toMatch(/[^-]height: 100vh/);
        expect(css).toContain('.site-nav');
    });

    it('should use custom theme from themes directory', () => {
        const themesDir = path.join(tmpDir, 'themes');
        fs.mkdirSync(themesDir, { recursive: true });
        fs.writeFileSync(path.join(themesDir, 'default.css'), 'body { color: red; }');
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--theme', 'default', '--themes', themesDir]);
        const css = fs.readFileSync(path.join(outputDir, 'theme-default.css'), 'utf-8');
        expect(css).toBe('body { color: red; }');
    });

    it('should fall back to built-in theme when themes directory has no matching file', () => {
        const themesDir = path.join(tmpDir, 'themes');
        fs.mkdirSync(themesDir, { recursive: true });
        // themesDir exists but has no default.css
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--theme', 'default', '--themes', themesDir]);
        const css = fs.readFileSync(path.join(outputDir, 'theme-default.css'), 'utf-8');
        expect(css).toContain('AS Notes default theme');
    });

    it('should load themes directory from config file', () => {
        const themesDir = path.join(tmpDir, 'themes');
        fs.mkdirSync(themesDir, { recursive: true });
        fs.writeFileSync(path.join(themesDir, 'dark.css'), '.custom-dark { background: #000; }');
        const configPath = path.join(tmpDir, 'asnotes-publish.json');
        fs.writeFileSync(configPath, JSON.stringify({
            inputDir: './notes',
            outputDir: './site',
            defaultPublic: true,
            theme: 'dark',
            themes: './themes',
        }));
        run(['--config', configPath]);
        const css = fs.readFileSync(path.join(outputDir, 'theme-dark.css'), 'utf-8');
        expect(css).toBe('.custom-dark { background: #000; }');
    });

    it('should log custom theme source', () => {
        const themesDir = path.join(tmpDir, 'themes');
        fs.mkdirSync(themesDir, { recursive: true });
        fs.writeFileSync(path.join(themesDir, 'default.css'), 'body {}');
        const output = run(['--input', inputDir, '--output', outputDir, '--default-public', '--theme', 'default', '--themes', themesDir]);
        expect(output).toContain('(custom)');
    });
});

describe('retina images', () => {
    let tmpDir: string;
    let inputDir: string;
    let outputDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-retina-test-'));
        inputDir = path.join(tmpDir, 'notes');
        outputDir = path.join(tmpDir, 'site');
        fs.mkdirSync(inputDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should strip {.retina} from alt text and add retina class', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n\n![my image {.retina}](photo.png)\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('class="retina"');
        expect(html).toContain('alt="my image"');
        expect(html).not.toContain('{.retina}');
    });

    it('should add retina class to all images when --retina flag is used', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n\n![photo](photo.png)\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--retina']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('class="retina"');
    });

    it('should set width to half intrinsic width for retina PNG images', () => {
        // Create a minimal valid 200x100 PNG
        const png = createMinimalPng(200, 100);
        fs.writeFileSync(path.join(inputDir, 'photo.png'), png);
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n\n![my image {.retina}](photo.png)\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('width="100"');
        expect(html).toContain('class="retina"');
    });

    it('should set width to half intrinsic width with global --retina flag', () => {
        const png = createMinimalPng(800, 400);
        fs.writeFileSync(path.join(inputDir, 'photo.png'), png);
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n\n![photo](photo.png)\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public', '--retina']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('width="400"');
    });

    it('should not set width when image file does not exist', () => {
        fs.writeFileSync(path.join(inputDir, 'Hello.md'), '---\npublic: true\n---\n# Hello\n\n![my image {.retina}](missing.png)\n');
        run(['--input', inputDir, '--output', outputDir, '--default-public']);
        const html = fs.readFileSync(path.join(outputDir, 'hello.html'), 'utf-8');
        expect(html).toContain('class="retina"');
        expect(html).not.toMatch(/img[^>]+width="/);
    });
});

/** Create a minimal valid PNG file with specified dimensions. */
function createMinimalPng(width: number, height: number): Buffer {
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    // IHDR chunk: width(4) + height(4) + bitDepth(1) + colorType(1) + compression(1) + filter(1) + interlace(1) = 13 bytes
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8;   // bit depth
    ihdrData[9] = 2;   // color type (RGB)
    ihdrData[10] = 0;  // compression
    ihdrData[11] = 0;  // filter
    ihdrData[12] = 0;  // interlace
    const ihdr = createPngChunk('IHDR', ihdrData);

    // Minimal IDAT chunk (empty compressed data)
    const idat = createPngChunk('IDAT', Buffer.from([0x08, 0xD7, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01]));

    // IEND chunk
    const iend = createPngChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);
}

function createPngChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBytes = Buffer.from(type, 'ascii');
    const combined = Buffer.concat([typeBytes, data]);

    // CRC32 over type+data
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < combined.length; i++) {
        crc ^= combined[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
    }
    crc ^= 0xFFFFFFFF;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);

    return Buffer.concat([length, typeBytes, data, crcBuf]);
}
