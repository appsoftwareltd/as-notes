import { describe, it, expect, vi } from 'vitest';

// TabColourService.ts imports 'vscode' for the TabColourService class.
// Stub the module so tests of the pure functions don't require a VS Code host.
vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vi.fn(() => ({ get: vi.fn(() => ({})) })),
        asRelativePath: vi.fn((uri: string) => uri),
    },
    window: {
        activeTextEditor: undefined,
    },
    ConfigurationTarget: { Workspace: 2 },
}));

import { isValidHex, resolveTabColour, toBackgroundTint } from '../TabColourService.js';
import type { TabColourRules } from '../TabColourService.js';

// ── toBackgroundTint ────────────────────────────────────────────────────────

describe('toBackgroundTint', () => {
    it('appends 33 to 6-char hex', () => expect(toBackgroundTint('#ff6600')).toBe('#ff660033'));
    it('expands 3-char hex and appends 33', () => expect(toBackgroundTint('#f60')).toBe('#ff660033'));
    it('strips existing alpha from 8-char hex and appends 33', () => expect(toBackgroundTint('#ff6600aa')).toBe('#ff660033'));
    it('handles uppercase hex', () => expect(toBackgroundTint('#FF6600')).toBe('#FF660033'));
});


// ── isValidHex ──────────────────────────────────────────────────────────────

describe('isValidHex', () => {
    it('accepts 3-char hex', () => expect(isValidHex('#abc')).toBe(true));
    it('accepts 6-char hex', () => expect(isValidHex('#aabbcc')).toBe(true));
    it('accepts 8-char hex', () => expect(isValidHex('#aabbccdd')).toBe(true));
    it('accepts uppercase hex', () => expect(isValidHex('#FF6600')).toBe(true));
    it('rejects missing hash', () => expect(isValidHex('aabbcc')).toBe(false));
    it('rejects empty string', () => expect(isValidHex('')).toBe(false));
    it('rejects invalid characters', () => expect(isValidHex('#gghhii')).toBe(false));
    it('rejects 5-char hex', () => expect(isValidHex('#abcde')).toBe(false));
    it('rejects 7-char hex', () => expect(isValidHex('#aabbcc0')).toBe(false));
});

// ── resolveTabColour ────────────────────────────────────────────────────────

describe('resolveTabColour', () => {
    it('extracts tab-colour from frontmatter', () => {
        const content = '---\ntab-colour: #ff0000\n---\n# Page';
        expect(resolveTabColour('notes/page.md', content, [])).toBe('#ff0000');
    });

    it('frontmatter wins over config rules', () => {
        const content = '---\ntab-colour: #ff0000\n---\n# Page';
        const rules: TabColourRules = { 'notes/.*': '#0000ff' };
        expect(resolveTabColour('notes/page.md', content, rules)).toBe('#ff0000');
    });

    it('returns first matching rule colour when no frontmatter colour', () => {
        const content = '# Page';
        const rules: TabColourRules = { 'journals/.*': '#00ff00', 'notes/.*': '#0000ff' };
        expect(resolveTabColour('notes/page.md', content, rules)).toBe('#0000ff');
    });

    it('returns first matching rule when multiple rules match', () => {
        const content = '# Page';
        const rules: TabColourRules = { '.*': '#111111', 'notes/.*': '#222222' };
        expect(resolveTabColour('notes/page.md', content, rules)).toBe('#111111');
    });

    it('returns undefined when no frontmatter and no matching rule', () => {
        const rules: TabColourRules = { 'journals/.*': '#00ff00' };
        expect(resolveTabColour('notes/page.md', '# Page', rules)).toBeUndefined();
    });

    it('returns undefined when no frontmatter and no rules', () => {
        expect(resolveTabColour('page.md', '# Page', {})).toBeUndefined();
    });

    it('ignores invalid hex in frontmatter and falls through to rules', () => {
        const content = '---\ntab-colour: notahex\n---\n# Page';
        const rules: TabColourRules = { '.*': '#abcdef' };
        expect(resolveTabColour('page.md', content, rules)).toBe('#abcdef');
    });

    it('ignores invalid hex in frontmatter and returns undefined when no rule matches', () => {
        const content = '---\ntab-colour: notahex\n---\n# Page';
        expect(resolveTabColour('page.md', content, {})).toBeUndefined();
    });

    it('ignores rule with invalid hex colour and falls through to next matching rule', () => {
        const content = '# Page';
        // 'notes/.*' matches but colour is invalid; '.*' also matches with a valid colour
        const rules: TabColourRules = { 'notes/.*': 'notahex', '.*': '#123456' };
        expect(resolveTabColour('notes/page.md', content, rules)).toBe('#123456');
    });

    it('skips rules with invalid regex pattern without throwing', () => {
        const content = '# Page';
        const rules: TabColourRules = { '[invalid(regex': '#111111', '.*': '#222222' };
        expect(resolveTabColour('page.md', content, rules)).toBe('#222222');
    });

    it('handles null content (file not yet loaded) — falls through to rules', () => {
        const rules: TabColourRules = { 'notes/.*': '#ff6600' };
        expect(resolveTabColour('notes/page.md', null, rules)).toBe('#ff6600');
    });

    it('handles null content with no matching rule', () => {
        expect(resolveTabColour('page.md', null, {})).toBeUndefined();
    });

    it('handles backslash path separators (Windows paths)', () => {
        const rules: TabColourRules = { 'notes[\\\\/].*': '#ff0000' };
        expect(resolveTabColour('notes\\page.md', '# Page', rules)).toBe('#ff0000');
    });

    it('handles frontmatter with quoted hex colour', () => {
        const content = '---\ntab-colour: "#ff0000"\n---\n# Page';
        expect(resolveTabColour('page.md', content, [])).toBe('#ff0000');
    });

    it('handles frontmatter with Windows line endings', () => {
        const content = '---\r\ntab-colour: #abcdef\r\n---\r\n# Page';
        expect(resolveTabColour('page.md', content, [])).toBe('#abcdef');
    });
});
