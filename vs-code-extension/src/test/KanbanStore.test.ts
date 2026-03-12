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
        const id = KanbanStore.generateId(new Date(2026, 2, 12, 14, 30, 45, 123), 'Fix Login');
        expect(id).toMatch(/^card_/);
    });

    it('contains timestamp segment', () => {
        const id = KanbanStore.generateId(new Date(2026, 2, 12, 14, 30, 45, 123), 'Fix Login');
        expect(id).toContain('20260312_143045123');
    });

    it('contains slugified title at the end', () => {
        const id = KanbanStore.generateId(new Date(), 'Fix Login Bug');
        expect(id).toMatch(/fix_login_bug$/);
    });

    it('contains a random segment', () => {
        const date = new Date(2026, 0, 1);
        const id1 = KanbanStore.generateId(date, 'test');
        const id2 = KanbanStore.generateId(date, 'test');
        // Very unlikely to be the same due to random uuid part
        // Check that the structure has 5+ parts (card, ts, ms, uuid, slug)
        const parts = id1.split('_');
        expect(parts.length).toBeGreaterThanOrEqual(5);
    });
});

// ── KanbanStore.extractSlugFromId ─────────────────────────────────────────────

describe('KanbanStore.extractSlugFromId', () => {
    it('extracts the slug portion from a card id', () => {
        const id = 'card_20260312_143045123_a1b2c3_fix_login_bug';
        expect(KanbanStore.extractSlugFromId(id)).toBe('fix_login_bug');
    });

    it('handles single-word slugs', () => {
        const id = 'card_20260312_143045123_a1b2c3_test';
        expect(KanbanStore.extractSlugFromId(id)).toBe('test');
    });

    it('returns empty string for malformed ids', () => {
        expect(KanbanStore.extractSlugFromId('bad_id')).toBe('');
        expect(KanbanStore.extractSlugFromId('')).toBe('');
    });

    it('returns empty string when prefix is not card', () => {
        expect(KanbanStore.extractSlugFromId('task_20260312_143045123_a1b2c3_test')).toBe('');
    });
});

// ── KanbanStore.serialise / deserialise ───────────────────────────────────────

describe('KanbanStore serialise/deserialise round-trip', () => {
    it('round-trips a minimal card', () => {
        const card = {
            id: 'card_20260312_143045123_a1b2c3_test',
            title: 'Test Card',
            lane: 'todo',
            created: '2026-03-12T14:30:45.123Z',
            updated: '2026-03-12T14:30:45.123Z',
            description: '',
        };

        const yaml = KanbanStore.serialise(card);
        const deserialized = KanbanStore.deserialise(yaml);

        expect(deserialized).not.toBeNull();
        expect(deserialized!.title).toBe('Test Card');
        expect(deserialized!.created).toBe('2026-03-12T14:30:45.123Z');
    });

    it('round-trips a card with all fields populated', () => {
        const card = {
            id: 'card_20260312_143045123_a1b2c3_full',
            title: 'Full Card',
            lane: 'doing',
            created: '2026-03-12T14:30:45.123Z',
            updated: '2026-03-12T16:00:00.000Z',
            description: 'A detailed description spanning multiple lines.\nSecond line.',
            priority: 'high' as const,
            assignee: 'alice',
            labels: ['backend', 'bug'],
            dueDate: '2026-03-20',
            sortOrder: 100,
            slug: 'full',
            entries: [
                {
                    author: 'alice',
                    date: '2026-03-12T14:30:45.123Z',
                    text: 'Initial investigation complete.',
                },
                {
                    author: 'bob',
                    date: '2026-03-12T15:00:00.000Z',
                    text: 'Fixing the pool size.',
                },
            ],
            assets: [
                {
                    filename: 'screenshot.png',
                    added: '2026-03-12T14:30:45.123Z',
                    addedBy: 'alice',
                },
            ],
        };

        const yaml = KanbanStore.serialise(card);
        const deserialized = KanbanStore.deserialise(yaml);

        expect(deserialized).not.toBeNull();
        expect(deserialized!.title).toBe('Full Card');
        expect(deserialized!.description).toBe('A detailed description spanning multiple lines.\nSecond line.');
        expect(deserialized!.priority).toBe('high');
        expect(deserialized!.assignee).toBe('alice');
        expect(deserialized!.labels).toEqual(['backend', 'bug']);
        expect(deserialized!.dueDate).toBe('2026-03-20');
        expect(deserialized!.sortOrder).toBe(100);
        expect(deserialized!.slug).toBe('full');
        expect(deserialized!.entries).toHaveLength(2);
        expect(deserialized!.entries![0].author).toBe('alice');
        expect(deserialized!.entries![0].text).toBe('Initial investigation complete.');
        expect(deserialized!.entries![1].author).toBe('bob');
        expect(deserialized!.assets).toHaveLength(1);
        expect(deserialized!.assets![0].filename).toBe('screenshot.png');
        expect(deserialized!.assets![0].addedBy).toBe('alice');
    });

    it('omits empty optional fields in serialised YAML', () => {
        const card = {
            id: 'card_test',
            title: 'Minimal',
            lane: 'todo',
            created: '2026-01-01T00:00:00.000Z',
            updated: '2026-01-01T00:00:00.000Z',
            description: '',
        };

        const yaml = KanbanStore.serialise(card);
        expect(yaml).not.toContain('priority');
        expect(yaml).not.toContain('assignee');
        expect(yaml).not.toContain('labels');
        expect(yaml).not.toContain('dueDate');
        expect(yaml).not.toContain('entries');
        expect(yaml).not.toContain('assets');
        expect(yaml).not.toContain('description');
    });

    it('omits priority none in serialised YAML', () => {
        const card = {
            id: 'card_test',
            title: 'Test card',
            lane: 'todo',
            created: '2026-01-01T00:00:00.000Z',
            updated: '2026-01-01T00:00:00.000Z',
            description: '',
            priority: 'none' as const,
        };

        const yaml = KanbanStore.serialise(card);
        expect(yaml).not.toMatch(/^priority:/m);
    });
});

describe('KanbanStore.deserialise — edge cases', () => {
    it('returns null for empty string', () => {
        expect(KanbanStore.deserialise('')).toBeNull();
    });

    it('returns null for invalid YAML', () => {
        expect(KanbanStore.deserialise('{{{')).toBeNull();
    });

    it('returns null when title is missing', () => {
        const yaml = 'description: No title field\n';
        expect(KanbanStore.deserialise(yaml)).toBeNull();
    });

    it('deserialises YAML with only title', () => {
        const yaml = 'title: Just a title\n';
        const card = KanbanStore.deserialise(yaml);
        expect(card).not.toBeNull();
        expect(card!.title).toBe('Just a title');
        expect(card!.id).toBe('');
        expect(card!.lane).toBe('');
        expect(card!.description).toBe('');
    });

    it('handles YAML with unknown extra fields gracefully', () => {
        const yaml = 'title: Test\nextraField: should be ignored\n';
        const card = KanbanStore.deserialise(yaml);
        expect(card).not.toBeNull();
        expect(card!.title).toBe('Test');
    });
});
