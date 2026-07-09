import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Enforces ADR-0005: the password-safe webview must render untrusted KDBX
 * fields only through the auto-escaping html`` helper. Bare `innerHTML` (or
 * insertAdjacentHTML / outerHTML) is banned everywhere in the safe webview
 * except dom.ts, which owns the single sanctioned assignment. A miss fails the
 * build instead of silently shipping.
 */

const WEBVIEW_DIR = join(__dirname, '..', 'webview');
const ALLOWED = new Set(['dom.ts']);
const FORBIDDEN = /\b(innerHTML|outerHTML|insertAdjacentHTML)\b/;

/** Safe webview source files (this feature's files only, by convention `safe*`). */
function safeWebviewFiles(): string[] {
    return readdirSync(WEBVIEW_DIR)
        .filter((name) => name.startsWith('safe') && name.endsWith('.ts'))
        .map((name) => join(WEBVIEW_DIR, name))
        .filter((p) => statSync(p).isFile());
}

describe('ADR-0005: no bare innerHTML in the safe webview', () => {
    it('renders only through the html`` helper', () => {
        const offenders: string[] = [];
        for (const file of [...safeWebviewFiles(), join(WEBVIEW_DIR, 'dom.ts')]) {
            const base = file.split('/').pop()!;
            if (ALLOWED.has(base)) {
                continue;
            }
            const src = readFileSync(file, 'utf8');
            src.split('\n').forEach((line, i) => {
                if (FORBIDDEN.test(line)) {
                    offenders.push(`${base}:${i + 1}  ${line.trim()}`);
                }
            });
        }
        const message = 'Use the html`` helper + setHtml from dom.ts instead:\n' + offenders.join('\n');
        expect(offenders, message).toEqual([]);
    });
});
