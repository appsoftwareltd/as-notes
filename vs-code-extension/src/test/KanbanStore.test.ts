import { describe, it, expect, vi } from 'vitest';

// ── Minimal vscode stub ───────────────────────────────────────────────────────

vi.mock('vscode', () => {
    const disposable = { dispose: vi.fn() };
    return {
        Uri: {
            joinPath: vi.fn((...parts: unknown[]) => ({ fsPath: (parts as string[]).join('/') })),
        },
        workspace: {
            fs: {
                readFile: vi.fn(),
                writeFile: vi.fn(),
                readDirectory: vi.fn(),
                createDirectory: vi.fn(),
                delete: vi.fn(),
                copy: vi.fn(),
                rename: vi.fn(),
            },
        },
        FileType: { Directory: 2, File: 1 },
        EventEmitter: class {
            event = vi.fn();
            fire = vi.fn();
            dispose = vi.fn();
        },
    };
});

import { KanbanStore } from '../KanbanStore.js';

// ── KanbanStore.slugify ───────────────────────────────────────────────────────

describe('KanbanStore.slugify', () => {
    it('lowercases and replaces non-alphanumeric with underscores', () => {
        expect(KanbanStore.slugify('Fix Login Bug')).toBe('fix_login_bug');
    });

    it('trims leading and trailing underscores', () => {
        expect(KanbanStore.slugify('--hello--')).toBe('hello');
    });

    it('truncates to 50 characters', () => {
        const longTitle = 'a'.repeat(100);
        expect(KanbanStore.slugify(longTitle).length).toBeLessThanOrEqual(50);
    });

    it('removes trailing underscores after truncation', () => {
        // 49 a's then a space then 20 b's — underscore at position 50 should be trimmed
        const title = 'a'.repeat(49) + ' ' + 'b'.repeat(20);
        const slug = KanbanStore.slugify(title);
        expect(slug).not.toMatch(/_$/);
    });

    it('returns empty string for non-alphanumeric only input', () => {
        expect(KanbanStore.slugify('!@#$%')).toBe('');
    });

    it('handles empty string', () => {
        expect(KanbanStore.slugify('')).toBe('');
    });
});

// ── KanbanStore.generateId ────────────────────────────────────────────────────

describe('KanbanStore.generateId', () => {
    it('starts with card_ prefix', () => {
        const id = KanbanStore.generateId(new Date(), 'Fix Login');
        expect(id).toMatch(/^card_/);
    });

    it('contains slugified title', () => {
        const id = KanbanStore.generateId(new Date(), 'Fix Login Bug');
        expect(id).toContain('fix_login_bug');
    });

    it('ends with a 6-char random segment', () => {
        const id = KanbanStore.generateId(new Date(), 'Test Card');
        const parts = id.split('_');
        const lastPart = parts[parts.length - 1];
        expect(lastPart.length).toBe(6);
    });

    it('uses format card_<slug>_<uuid>', () => {
        const id = KanbanStore.generateId(new Date(), 'My Task');
        expect(id).toMatch(/^card_my_task_[a-z0-9]{6}$/);
    });

    it('handles empty title', () => {
        const id = KanbanStore.generateId(new Date(), '');
        expect(id).toMatch(/^card_[a-z0-9]{6}$/);
    });
});

// ── KanbanStore.extractSlugFromId ─────────────────────────────────────────────

describe('KanbanStore.extractSlugFromId', () => {
    it('extracts the slug portion from a card id', () => {
        const id = 'card_fix_login_bug_a1b2c3';
        expect(KanbanStore.extractSlugFromId(id)).toBe('fix_login_bug');
    });

    it('handles single-word slugs', () => {
        const id = 'card_test_a1b2c3';
        expect(KanbanStore.extractSlugFromId(id)).toBe('test');
    });

    it('returns empty string for card with no slug (just uuid)', () => {
        const id = 'card_a1b2c3';
        expect(KanbanStore.extractSlugFromId(id)).toBe('');
    });

    it('returns empty string for malformed ids', () => {
        expect(KanbanStore.extractSlugFromId('bad_id')).toBe('');
        expect(KanbanStore.extractSlugFromId('')).toBe('');
    });

    it('returns empty string when prefix is not card', () => {
        expect(KanbanStore.extractSlugFromId('task_test_a1b2c3')).toBe('');
    });
});

// ── KanbanStore.extractMarkdownBody ───────────────────────────────────────────

describe('KanbanStore.extractMarkdownBody', () => {
    it('extracts body after frontmatter', () => {
        const text = '---\ntitle: Test\n---\n\n## entry 2026-03-12\n\nSome text';
        expect(KanbanStore.extractMarkdownBody(text)).toBe('\n## entry 2026-03-12\n\nSome text');
    });

    it('returns empty string when no body after frontmatter', () => {
        const text = '---\ntitle: Test\n---\n';
        expect(KanbanStore.extractMarkdownBody(text)).toBe('');
    });

    it('returns full text when no frontmatter', () => {
        const text = 'Just plain text';
        expect(KanbanStore.extractMarkdownBody(text)).toBe('Just plain text');
    });

    it('returns empty when frontmatter has no closing fence', () => {
        const text = '---\ntitle: Test\nno closing fence';
        expect(KanbanStore.extractMarkdownBody(text)).toBe('');
    });
});

// ── KanbanStore.parseEntries ──────────────────────────────────────────────────

describe('KanbanStore.parseEntries', () => {
    it('parses a single entry with date', () => {
        const body = '## entry 2026-03-12\n\nSome notes here.';
        const entries = KanbanStore.parseEntries(body);
        expect(entries).toHaveLength(1);
        expect(entries[0].date).toBe('2026-03-12');
        expect(entries[0].title).toBeUndefined();
        expect(entries[0].body).toBe('Some notes here.');
    });

    it('parses entry with date and title', () => {
        const body = '## entry 2026-03-13 Further analysis\n\nPool size too small.';
        const entries = KanbanStore.parseEntries(body);
        expect(entries).toHaveLength(1);
        expect(entries[0].date).toBe('2026-03-13');
        expect(entries[0].title).toBe('Further analysis');
        expect(entries[0].body).toBe('Pool size too small.');
    });

    it('parses entry with no date', () => {
        const body = '## entry\n\nJust some text.';
        const entries = KanbanStore.parseEntries(body);
        expect(entries).toHaveLength(1);
        expect(entries[0].date).toBeUndefined();
        expect(entries[0].title).toBeUndefined();
        expect(entries[0].body).toBe('Just some text.');
    });

    it('parses entry with title but no date', () => {
        const body = '## entry Quick note\n\nSome info.';
        const entries = KanbanStore.parseEntries(body);
        expect(entries).toHaveLength(1);
        expect(entries[0].date).toBeUndefined();
        expect(entries[0].title).toBe('Quick note');
        expect(entries[0].body).toBe('Some info.');
    });

    it('parses multiple entries', () => {
        const body = '## entry 2026-03-12\n\nFirst entry.\n\n## entry 2026-03-13 Second\n\nSecond entry.';
        const entries = KanbanStore.parseEntries(body);
        expect(entries).toHaveLength(2);
        expect(entries[0].date).toBe('2026-03-12');
        expect(entries[0].body).toBe('First entry.');
        expect(entries[1].date).toBe('2026-03-13');
        expect(entries[1].title).toBe('Second');
        expect(entries[1].body).toBe('Second entry.');
    });

    it('returns empty array for text with no entries', () => {
        expect(KanbanStore.parseEntries('Just plain text')).toEqual([]);
        expect(KanbanStore.parseEntries('')).toEqual([]);
    });

    it('ignores text before the first ## entry heading', () => {
        const body = 'Some intro text\n\n## entry 2026-03-12\n\nActual entry.';
        const entries = KanbanStore.parseEntries(body);
        expect(entries).toHaveLength(1);
        expect(entries[0].body).toBe('Actual entry.');
    });

    it('trims whitespace from entry bodies', () => {
        const body = '## entry 2026-03-12\n\n   Padded text   \n\n';
        const entries = KanbanStore.parseEntries(body);
        expect(entries[0].body).toBe('Padded text');
    });

    it('is case-insensitive for ## entry heading', () => {
        const body = '## Entry 2026-03-12\n\nContent.';
        const entries = KanbanStore.parseEntries(body);
        expect(entries).toHaveLength(1);
        expect(entries[0].date).toBe('2026-03-12');
    });
});

// ── KanbanStore.serialise / deserialise ───────────────────────────────────────

describe('KanbanStore serialise/deserialise round-trip', () => {
    it('round-trips a minimal card', () => {
        const card = {
            id: 'card_test_a1b2c3',
            title: 'Test Card',
            lane: 'todo',
            created: '2026-03-12T14:30:45.123Z',
            updated: '2026-03-12T14:30:45.123Z',
            description: '',
        };

        const md = KanbanStore.serialise(card);
        expect(md).toMatch(/^---\n/);
        expect(md).toContain('title: Test Card');
        const deserialized = KanbanStore.deserialise(md);
        expect(deserialized).not.toBeNull();
        expect(deserialized!.title).toBe('Test Card');
        expect(deserialized!.created).toBe('2026-03-12T14:30:45.123Z');
    });

    it('round-trips a card with all frontmatter fields populated', () => {
        const card = {
            id: 'card_full_a1b2c3',
            title: 'Full Card',
            lane: 'doing',
            created: '2026-03-12T14:30:45.123Z',
            updated: '2026-03-12T16:00:00.000Z',
            description: 'A detailed description.',
            priority: 'high' as const,
            assignee: 'alice',
            labels: ['backend', 'bug'],
            dueDate: '2026-03-20',
            sortOrder: 100,
            slug: 'full',
            assets: [
                {
                    filename: 'screenshot.png',
                    added: '2026-03-12T14:30:45.123Z',
                    addedBy: 'alice',
                },
            ],
        };

        const md = KanbanStore.serialise(card);
        const deserialized = KanbanStore.deserialise(md);

        expect(deserialized).not.toBeNull();
        expect(deserialized!.title).toBe('Full Card');
        expect(deserialized!.description).toBe('A detailed description.');
        expect(deserialized!.priority).toBe('high');
        expect(deserialized!.assignee).toBe('alice');
        expect(deserialized!.labels).toEqual(['backend', 'bug']);
        expect(deserialized!.dueDate).toBe('2026-03-20');
        expect(deserialized!.sortOrder).toBe(100);
        expect(deserialized!.slug).toBe('full');
        expect(deserialized!.assets).toHaveLength(1);
        expect(deserialized!.assets![0].filename).toBe('screenshot.png');
    });

    it('preserves the markdown body through serialise', () => {
        const card = {
            id: 'card_test_a1b2c3',
            title: 'Test',
            lane: 'todo',
            created: '2026-01-01T00:00:00.000Z',
            updated: '2026-01-01T00:00:00.000Z',
            description: '',
        };
        const existingBody = '\n## entry 2026-03-12\n\nSome notes.\n';
        const md = KanbanStore.serialise(card, existingBody);
        expect(md).toContain('## entry 2026-03-12');
        expect(md).toContain('Some notes.');
    });

    it('deserialises entries from markdown body', () => {
        const md = `---
title: Test Card
created: 2026-03-12T14:30:45.123Z
updated: 2026-03-12T14:30:45.123Z
---

## entry 2026-03-12

Initial notes.

## entry 2026-03-13 Follow-up

More details.
`;
        const card = KanbanStore.deserialise(md);
        expect(card).not.toBeNull();
        expect(card!.title).toBe('Test Card');
        expect(card!.parsedEntries).toHaveLength(2);
        expect(card!.parsedEntries![0].date).toBe('2026-03-12');
        expect(card!.parsedEntries![0].body).toBe('Initial notes.');
        expect(card!.parsedEntries![1].date).toBe('2026-03-13');
        expect(card!.parsedEntries![1].title).toBe('Follow-up');
        expect(card!.parsedEntries![1].body).toBe('More details.');
    });

    it('omits empty optional fields in serialised markdown', () => {
        const card = {
            id: 'card_test_a1b2c3',
            title: 'Minimal',
            lane: 'todo',
            created: '2026-01-01T00:00:00.000Z',
            updated: '2026-01-01T00:00:00.000Z',
            description: '',
        };

        const md = KanbanStore.serialise(card);
        expect(md).not.toContain('priority');
        expect(md).not.toContain('assignee');
        expect(md).not.toContain('labels');
        expect(md).not.toContain('dueDate');
        expect(md).not.toContain('assets');
        expect(md).not.toContain('description');
    });

    it('omits priority none in serialised markdown', () => {
        const card = {
            id: 'card_test_a1b2c3',
            title: 'Test card',
            lane: 'todo',
            created: '2026-01-01T00:00:00.000Z',
            updated: '2026-01-01T00:00:00.000Z',
            description: '',
            priority: 'none' as const,
        };

        const md = KanbanStore.serialise(card);
        expect(md).not.toMatch(/priority:/);
    });

    it('does not include entries in frontmatter', () => {
        const card = {
            id: 'card_test_a1b2c3',
            title: 'Test',
            lane: 'todo',
            created: '2026-01-01T00:00:00.000Z',
            updated: '2026-01-01T00:00:00.000Z',
            description: '',
            parsedEntries: [{ date: '2026-03-12', body: 'test' }],
        };

        const md = KanbanStore.serialise(card);
        const frontmatter = md.split('---')[1];
        expect(frontmatter).not.toContain('entries');
        expect(frontmatter).not.toContain('parsedEntries');
    });
});

describe('KanbanStore.deserialise — edge cases', () => {
    it('returns null for empty string', () => {
        expect(KanbanStore.deserialise('')).toBeNull();
    });

    it('returns null for invalid YAML frontmatter', () => {
        expect(KanbanStore.deserialise('---\n{{{\n---\n')).toBeNull();
    });

    it('returns null when title is missing', () => {
        const md = '---\ndescription: No title field\n---\n';
        expect(KanbanStore.deserialise(md)).toBeNull();
    });

    it('deserialises markdown with only title in frontmatter', () => {
        const md = '---\ntitle: Just a title\n---\n';
        const card = KanbanStore.deserialise(md);
        expect(card).not.toBeNull();
        expect(card!.title).toBe('Just a title');
        expect(card!.id).toBe('');
        expect(card!.lane).toBe('');
    });

    it('handles frontmatter with unknown extra fields gracefully', () => {
        const md = '---\ntitle: Test\nextraField: should be ignored\n---\n';
        const card = KanbanStore.deserialise(md);
        expect(card).not.toBeNull();
        expect(card!.title).toBe('Test');
    });

    it('returns null when frontmatter has no closing fence', () => {
        const md = '---\ntitle: Test\nno closing fence';
        expect(KanbanStore.deserialise(md)).toBeNull();
    });

    it('falls back to pure YAML parsing for backwards compat', () => {
        const yaml = 'title: Legacy Card\ncreated: 2026-01-01T00:00:00.000Z\n';
        const card = KanbanStore.deserialise(yaml);
        expect(card).not.toBeNull();
        expect(card!.title).toBe('Legacy Card');
    });
});
