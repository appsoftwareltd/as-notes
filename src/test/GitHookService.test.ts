import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    ensurePreCommitHook,
    buildHookBlock,
    HOOK_PATH_RELATIVE,
    HOOK_START_MARKER,
    HOOK_END_MARKER,
} from '../GitHookService.js';
import { ENCRYPTION_MARKER } from '../EncryptionService.js';

// ── Test workspace helpers ─────────────────────────────────────────────────

let tmpDir: string;

function createTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'as-notes-test-'));
}

function makeGitHooksDir(root: string): void {
    fs.mkdirSync(path.join(root, '.git', 'hooks'), { recursive: true });
}

function hookPath(root: string): string {
    return path.join(root, HOOK_PATH_RELATIVE);
}

beforeEach(() => {
    tmpDir = createTmpWorkspace();
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── buildHookBlock ─────────────────────────────────────────────────────────

describe('buildHookBlock', () => {

    it('starts with HOOK_START_MARKER', () => {
        const block = buildHookBlock();
        expect(block.startsWith(HOOK_START_MARKER)).toBe(true);
    });

    it('ends with HOOK_END_MARKER', () => {
        const block = buildHookBlock();
        expect(block.endsWith(HOOK_END_MARKER)).toBe(true);
    });

    it('contains .enc.md detection pattern', () => {
        const block = buildHookBlock();
        expect(block).toContain('\\.enc\\.md');
    });

    it('contains the ASNOTES_ENC_V1: marker check', () => {
        const block = buildHookBlock();
        expect(block).toContain(ENCRYPTION_MARKER);
    });

    it('contains exit 1 for unencrypted files', () => {
        const block = buildHookBlock();
        expect(block).toContain('exit 1');
    });

    it('uses while IFS= read -r (not for) to handle filenames with spaces', () => {
        const block = buildHookBlock();
        expect(block).toContain('while IFS= read -r f; do');
        expect(block).not.toContain('for f in $enc_files');
    });

    it('uses heredoc (ASNOTES_EOF) to feed filenames to while loop', () => {
        const block = buildHookBlock();
        expect(block).toContain('done <<ASNOTES_EOF');
        expect(block).toContain('ASNOTES_EOF');
    });

    it('is idempotent — same output on every call', () => {
        expect(buildHookBlock()).toBe(buildHookBlock());
    });

});

// ── ensurePreCommitHook ────────────────────────────────────────────────────

describe('ensurePreCommitHook — no git directory', () => {

    it('returns no-git when .git/hooks/ does not exist', () => {
        const result = ensurePreCommitHook(tmpDir);
        expect(result).toBe('no-git');
    });

    it('does not create any files when no-git', () => {
        ensurePreCommitHook(tmpDir);
        expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(false);
    });

});

describe('ensurePreCommitHook — no existing hook file', () => {

    beforeEach(() => {
        makeGitHooksDir(tmpDir);
    });

    it('returns created', () => {
        expect(ensurePreCommitHook(tmpDir)).toBe('created');
    });

    it('creates the hook file', () => {
        ensurePreCommitHook(tmpDir);
        expect(fs.existsSync(hookPath(tmpDir))).toBe(true);
    });

    it('created file starts with #!/bin/sh shebang', () => {
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(content.startsWith('#!/bin/sh')).toBe(true);
    });

    it('created file contains the start marker', () => {
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(content).toContain(HOOK_START_MARKER);
    });

    it('created file contains the end marker', () => {
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(content).toContain(HOOK_END_MARKER);
    });

    it('created file contains the encryption marker check', () => {
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(content).toContain(ENCRYPTION_MARKER);
    });

});

describe('ensurePreCommitHook — existing hook without marker', () => {

    const originalContent = '#!/bin/sh\n\n# Some other hook\necho "Running existing hook"\n';

    beforeEach(() => {
        makeGitHooksDir(tmpDir);
        fs.writeFileSync(hookPath(tmpDir), originalContent, 'utf8');
    });

    it('returns appended', () => {
        expect(ensurePreCommitHook(tmpDir)).toBe('appended');
    });

    it('preserves the original hook content', () => {
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(content).toContain('echo "Running existing hook"');
    });

    it('appended file contains the start marker', () => {
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(content).toContain(HOOK_START_MARKER);
    });

    it('appended file contains the end marker after the original content', () => {
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        const originalIdx = content.indexOf('Running existing hook');
        const endMarkerIdx = content.indexOf(HOOK_END_MARKER);
        expect(endMarkerIdx).toBeGreaterThan(originalIdx);
    });

});

describe('ensurePreCommitHook — existing hook already has marker', () => {

    beforeEach(() => {
        makeGitHooksDir(tmpDir);
        const content = `#!/bin/sh\n\n${buildHookBlock()}\n`;
        fs.writeFileSync(hookPath(tmpDir), content, 'utf8');
    });

    it('returns exists', () => {
        expect(ensurePreCommitHook(tmpDir)).toBe('exists');
    });

    it('does not modify the file', () => {
        const before = fs.readFileSync(hookPath(tmpDir), 'utf8');
        ensurePreCommitHook(tmpDir);
        const after = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(after).toBe(before);
    });

    it('is idempotent on repeated calls', () => {
        const r1 = ensurePreCommitHook(tmpDir);
        const r2 = ensurePreCommitHook(tmpDir);
        const r3 = ensurePreCommitHook(tmpDir);
        expect([r1, r2, r3]).toEqual(['exists', 'exists', 'exists']);
    });

});

describe('ensurePreCommitHook — existing hook with stale block', () => {

    beforeEach(() => {
        makeGitHooksDir(tmpDir);
        // Write a hook containing an old/stale AS Notes block
        const staleBlock = [
            HOOK_START_MARKER,
            '# AS Notes: old version of the hook',
            'for f in $(git diff --cached --name-only | grep enc.md); do',
            '  exit 1',
            'done',
            HOOK_END_MARKER,
        ].join('\n');
        fs.writeFileSync(hookPath(tmpDir), `#!/bin/sh\n\n${staleBlock}\n`, 'utf8');
    });

    it('returns updated', () => {
        expect(ensurePreCommitHook(tmpDir)).toBe('updated');
    });

    it('replaces stale block with current block', () => {
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(content).toContain(buildHookBlock());
    });

    it('does not contain stale block content after update', () => {
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(content).not.toContain('# AS Notes: old version of the hook');
    });

    it('preserves content outside the stale block', () => {
        // Write stale block with extra content before and after
        const staleBlock = [
            HOOK_START_MARKER,
            '# old',
            HOOK_END_MARKER,
        ].join('\n');
        const original = `#!/bin/sh\n\n# existing hook\necho "hi"\n\n${staleBlock}\n\n# trailing content\n`;
        fs.writeFileSync(hookPath(tmpDir), original, 'utf8');
        ensurePreCommitHook(tmpDir);
        const content = fs.readFileSync(hookPath(tmpDir), 'utf8');
        expect(content).toContain('# existing hook');
        expect(content).toContain('# trailing content');
    });

    it('returns exists on second call (block is now current)', () => {
        ensurePreCommitHook(tmpDir); // first call updates
        expect(ensurePreCommitHook(tmpDir)).toBe('exists'); // second call: no change
    });

});
