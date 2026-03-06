/**
 * GitHookService — installs and maintains the AS Notes pre-commit git hook.
 *
 * The hook prevents `.enc.md` files from being committed when they are
 * unencrypted (lack the `ASNOTES_ENC_V1:` marker on the first line).
 *
 * The hook block is wrapped in named markers so it can be detected and
 * idempotently managed without clobbering any existing hook content.
 *
 * No VS Code imports — pure Node.js `fs`, suitable for unit testing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ENCRYPTION_MARKER } from './EncryptionService.js';

// ── Constants ──────────────────────────────────────────────────────────────

/** Path relative to workspace root where git stores hooks. */
export const HOOK_PATH_RELATIVE = path.join('.git', 'hooks', 'pre-commit');

/** Marker written at the start of the AS Notes hook block. */
export const HOOK_START_MARKER = '# asnotes-enc-check-start';

/** Marker written at the end of the AS Notes hook block. */
export const HOOK_END_MARKER = '# asnotes-enc-check-end';

// ── Public API ─────────────────────────────────────────────────────────────

/** Possible outcomes of `ensurePreCommitHook()`. */
export type HookResult = 'created' | 'appended' | 'exists' | 'updated' | 'no-git';

/**
 * Build the POSIX shell script block that should be inserted into the
 * pre-commit hook.  The block is wrapped in named markers so it can be
 * detected without executing the file.
 *
 * The script:
 * 1. Finds all staged `.enc.md` files.
 * 2. For each, checks whether the first line starts with `ASNOTES_ENC_V1:`.
 * 3. Aborts the commit with a descriptive message if any are unencrypted.
 */
export function buildHookBlock(): string {
    const marker = ENCRYPTION_MARKER;
    return [
        HOOK_START_MARKER,
        '# AS Notes: prevent committing unencrypted .enc.md files',
        'enc_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\\.enc\\.md$")',
        'if [ -n "$enc_files" ]; then',
        '  while IFS= read -r f; do',
        '    first_line=$(head -n 1 "$f" 2>/dev/null)',
        `    case "$first_line" in`,
        `      ${marker}*) ;;`,  // starts with marker — encrypted, OK
        '      *)',
        '        echo "AS Notes: commit blocked — unencrypted .enc.md file staged: $f"',
        '        echo "Run \'AS Notes: Encrypt eligible notes (.enc.md)\' before committing."',
        '        exit 1',
        '        ;;',
        '    esac',
        '  done <<ASNOTES_EOF',
        '$enc_files',
        'ASNOTES_EOF',
        'fi',
        HOOK_END_MARKER,
    ].join('\n');
}

/**
 * Ensure the pre-commit hook at `<workspaceRoot>/.git/hooks/pre-commit`
 * contains the AS Notes encryption guard block.
 *
 * Returns:
 * - `'no-git'`   — `.git/hooks/` directory not found (not a git repo, or hooks disabled)
 * - `'exists'`   — hook file already contains the current AS Notes block (no change made)
 * - `'updated'`  — hook file contained a stale AS Notes block which was replaced in-place
 * - `'created'`  — hook file did not exist; created with shebang + block + executable bit
 * - `'appended'` — hook file existed without the block; block appended to end
 */
export function ensurePreCommitHook(workspaceRoot: string): HookResult {
    const hooksDir = path.join(workspaceRoot, '.git', 'hooks');
    if (!fs.existsSync(hooksDir)) {
        return 'no-git';
    }

    const hookPath = path.join(workspaceRoot, HOOK_PATH_RELATIVE);
    const block = buildHookBlock();

    if (!fs.existsSync(hookPath)) {
        // Create from scratch: shebang + blank line + block + trailing newline
        const content = `#!/bin/sh\n\n${block}\n`;
        fs.writeFileSync(hookPath, content, { encoding: 'utf8' });
        // Set executable bit (owner + group + other execute)
        try {
            fs.chmodSync(hookPath, 0o755);
        } catch {
            // chmod not supported on all platforms (e.g. Windows without Git Bash)
            // This is a best-effort operation — the hook may still work via Git Bash.
        }
        return 'created';
    }

    const existing = fs.readFileSync(hookPath, 'utf8');

    if (existing.includes(HOOK_START_MARKER)) {
        // Block present — check whether it matches the current version
        const startIdx = existing.indexOf(HOOK_START_MARKER);
        const endIdx = existing.indexOf(HOOK_END_MARKER);
        if (endIdx !== -1) {
            const existingBlock = existing.slice(startIdx, endIdx + HOOK_END_MARKER.length);
            if (existingBlock === block) {
                return 'exists';
            }
            // Stale block — replace it in-place
            const updated = existing.slice(0, startIdx) + block + existing.slice(endIdx + HOOK_END_MARKER.length);
            fs.writeFileSync(hookPath, updated, { encoding: 'utf8' });
            return 'updated';
        }
        // Malformed (start marker present but no end marker) — leave file unchanged
        return 'exists';
    }

    // Append to end of existing file, separated by a blank line
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(hookPath, `${existing}${separator}${block}\n`, { encoding: 'utf8' });
    return 'appended';
}
