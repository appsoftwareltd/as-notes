import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IgnoreService, createConfiguredIgnoreService } from '../IgnoreService.js';

// ── Helpers ────────────────────────────────────────────────────────────────

let tmpDir: string;
let ignoreFilePath: string;

function writeIgnore(content: string): void {
    fs.writeFileSync(ignoreFilePath, content, 'utf-8');
}

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-ignore-test-'));
    ignoreFilePath = path.join(tmpDir, '.asnotesignore');
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Missing file ───────────────────────────────────────────────────────────

describe('IgnoreService — missing file', () => {
    it('returns false for all paths when .asnotesignore does not exist', () => {
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('logseq/pages/foo.md')).toBe(false);
        expect(svc.isIgnored('notes/anything.md')).toBe(false);
    });
});

// ── Basic pattern matching ─────────────────────────────────────────────────

describe('IgnoreService — basic patterns', () => {
    it('ignores files under a directory pattern', () => {
        writeIgnore('logseq/\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('logseq/config.edn')).toBe(true);
        expect(svc.isIgnored('logseq/pages/foo.md')).toBe(true);
    });

    it('does not ignore files outside the matched directory', () => {
        writeIgnore('logseq/\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('notes/ideas.md')).toBe(false);
        expect(svc.isIgnored('logseq-backup.md')).toBe(false);
    });

    it('ignores dotfiles directories (.obsidian, .trash)', () => {
        writeIgnore('.obsidian/\n.trash/\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('.obsidian/config')).toBe(true);
        expect(svc.isIgnored('.trash/deleted-note.md')).toBe(true);
        expect(svc.isIgnored('notes/ideas.md')).toBe(false);
    });
});

// ── Depth / nesting ────────────────────────────────────────────────────────

describe('IgnoreService — depth-agnostic matching', () => {
    it('matches a directory pattern at any nesting depth', () => {
        writeIgnore('logseq/\n');
        const svc = new IgnoreService(ignoreFilePath);
        // Nested one level
        expect(svc.isIgnored('vault/logseq/config.edn')).toBe(true);
        // Nested two levels
        expect(svc.isIgnored('a/b/logseq/pages/foo.md')).toBe(true);
    });

    it('root-anchored pattern only matches at root', () => {
        writeIgnore('/logseq/\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('logseq/config.edn')).toBe(true);
        expect(svc.isIgnored('vault/logseq/config.edn')).toBe(false);
    });
});

// ── Comments and blank lines ───────────────────────────────────────────────

describe('IgnoreService — comments', () => {
    it('ignores comment lines and blank lines', () => {
        writeIgnore([
            '# This is a comment',
            '',
            'logseq/',
            '# Another comment',
            '.obsidian/',
        ].join('\n'));
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('logseq/pages/foo.md')).toBe(true);
        expect(svc.isIgnored('.obsidian/config')).toBe(true);
        expect(svc.isIgnored('notes/foo.md')).toBe(false);
    });
});

// ── Glob patterns ──────────────────────────────────────────────────────────

describe('IgnoreService — glob patterns', () => {
    it('supports wildcard file patterns', () => {
        writeIgnore('*.tmp\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('scratch.tmp')).toBe(true);
        expect(svc.isIgnored('notes/scratch.tmp')).toBe(true);
        expect(svc.isIgnored('notes/foo.md')).toBe(false);
    });

    it('supports ** patterns', () => {
        writeIgnore('backup/**\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('backup/2024/notes.md')).toBe(true);
        expect(svc.isIgnored('backup/foo.md')).toBe(true);
        expect(svc.isIgnored('notes/foo.md')).toBe(false);
    });
});

// ── Negation ───────────────────────────────────────────────────────────────

describe('IgnoreService — negation', () => {
    it('un-ignores a file that matches a negation pattern', () => {
        // Ignore all .log files, but keep important.log
        writeIgnore('*.log\n!important.log\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('debug.log')).toBe(true);
        expect(svc.isIgnored('error.log')).toBe(true);
        expect(svc.isIgnored('important.log')).toBe(false);
    });

    it('cannot un-ignore a file inside an already-ignored directory (gitignore semantics)', () => {
        // This is correct gitignore behaviour: once logseq/ is ignored, its
        // contents cannot be individually un-ignored.
        writeIgnore('logseq/\n!logseq/keep.md\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('logseq/pages/foo.md')).toBe(true);
        expect(svc.isIgnored('logseq/keep.md')).toBe(true);
    });
});

// ── Windows backslash normalisation ───────────────────────────────────────

describe('IgnoreService — path normalisation', () => {
    it('handles backslash paths (Windows) correctly', () => {
        writeIgnore('logseq/\n');
        const svc = new IgnoreService(ignoreFilePath);
        // Simulate a Windows-style path passed in
        expect(svc.isIgnored('logseq\\pages\\foo.md')).toBe(true);
    });
});

// ── reload() ───────────────────────────────────────────────────────────────

describe('IgnoreService — reload()', () => {
    it('reload() picks up new patterns added to the file', () => {
        writeIgnore('logseq/\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('.obsidian/config')).toBe(false);

        writeIgnore('logseq/\n.obsidian/\n');
        svc.reload();

        expect(svc.isIgnored('.obsidian/config')).toBe(true);
    });

    it('reload() handles file being deleted gracefully', () => {
        writeIgnore('logseq/\n');
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('logseq/foo.md')).toBe(true);

        fs.rmSync(ignoreFilePath);
        svc.reload();

        expect(svc.isIgnored('logseq/foo.md')).toBe(false);
    });

    it('reload() handles file being created after construction', () => {
        // Constructed before file exists
        const svc = new IgnoreService(ignoreFilePath);
        expect(svc.isIgnored('logseq/foo.md')).toBe(false);

        // File now created
        writeIgnore('logseq/\n');
        svc.reload();

        expect(svc.isIgnored('logseq/foo.md')).toBe(true);
    });
});

// ── Default ignore content ─────────────────────────────────────────────────

describe('IgnoreService — default patterns', () => {
    it('default Logseq and Obsidian patterns are correctly excluded', () => {
        writeIgnore([
            '# AS Notes ignore file',
            'logseq/',
            '.obsidian/',
            '.trash/',
        ].join('\n'));
        const svc = new IgnoreService(ignoreFilePath);
        // Logseq — at root
        expect(svc.isIgnored('logseq/config.edn')).toBe(true);
        expect(svc.isIgnored('logseq/bak/2024-01-01/notes.md')).toBe(true);
        // Obsidian — at root
        expect(svc.isIgnored('.obsidian/app.json')).toBe(true);
        // Obsidian trash
        expect(svc.isIgnored('.trash/old-note.md')).toBe(true);
        // Logseq nested in a sub-vault
        expect(svc.isIgnored('vaults/work/logseq/pages/foo.md')).toBe(true);
        // Normal user notes are not affected
        expect(svc.isIgnored('notes/ideas.md')).toBe(false);
        expect(svc.isIgnored('journal/2024-01-01.md')).toBe(false);
    });
});

describe('IgnoreService — mandatory runtime exclusions', () => {
    it('always excludes .asnotes, templateFolder, and assetPath directories', () => {
        const svc = createConfiguredIgnoreService(ignoreFilePath, {
            templateFolder: 'templates',
            assetPath: 'assets',
        });

        expect(svc.isIgnored('.asnotes/index.db')).toBe(true);
        expect(svc.isIgnored('.asnotes/logs/main.log')).toBe(true);
        expect(svc.isIgnored('templates/Journal.md')).toBe(true);
        expect(svc.isIgnored('assets/diagram.md')).toBe(true);
        expect(svc.isIgnored('assets/images/diagram.md')).toBe(true);
        expect(svc.isIgnored('notes/page.md')).toBe(false);
    });

    it('normalises configured directory paths and preserves mandatory exclusions across reload', () => {
        writeIgnore('archive/\n');
        const svc = createConfiguredIgnoreService(ignoreFilePath, {
            templateFolder: '/templates/',
            assetPath: '\\assets\\images\\',
        });

        expect(svc.isIgnored('templates/Journal.md')).toBe(true);
        expect(svc.isIgnored('assets/images/diagram.md')).toBe(true);
        expect(svc.isIgnored('.asnotes/index.db')).toBe(true);
        expect(svc.isIgnored('archive/page.md')).toBe(true);

        writeIgnore('private/\n');
        svc.reload();

        expect(svc.isIgnored('.asnotes/index.db')).toBe(true);
        expect(svc.isIgnored('templates/Journal.md')).toBe(true);
        expect(svc.isIgnored('assets/images/diagram.md')).toBe(true);
        expect(svc.isIgnored('archive/page.md')).toBe(false);
        expect(svc.isIgnored('private/page.md')).toBe(true);
    });

    it('reflects settings changes when a new configured service is created', () => {
        const initialSvc = createConfiguredIgnoreService(ignoreFilePath, {
            templateFolder: 'templates',
            assetPath: 'assets',
        });
        expect(initialSvc.isIgnored('templates/Journal.md')).toBe(true);
        expect(initialSvc.isIgnored('static/diagram.md')).toBe(false);
        expect(initialSvc.isIgnored('assets/diagram.md')).toBe(true);

        const updatedSvc = createConfiguredIgnoreService(ignoreFilePath, {
            templateFolder: 'snippets',
            assetPath: 'static',
        });
        expect(updatedSvc.isIgnored('.asnotes/index.db')).toBe(true);
        expect(updatedSvc.isIgnored('templates/Journal.md')).toBe(false);
        expect(updatedSvc.isIgnored('snippets/Journal.md')).toBe(true);
        expect(updatedSvc.isIgnored('assets/diagram.md')).toBe(false);
        expect(updatedSvc.isIgnored('static/diagram.md')).toBe(true);
    });
});
