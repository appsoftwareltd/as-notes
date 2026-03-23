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
});
