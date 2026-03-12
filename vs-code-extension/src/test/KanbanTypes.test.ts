import { describe, it, expect } from 'vitest';
import {
    slugifyLane,
    slugifyBoard,
    displayLane,
    displayBoard,
    isProtectedLane,
    isReservedLane,
    isImageFile,
    DEFAULT_LANES,
    PROTECTED_LANES,
    RESERVED_LANES,
    ASSETS_DIR,
    DEFAULT_BOARD_CONFIG,
} from '../KanbanTypes.js';

describe('slugifyLane', () => {
    it('lowercases and replaces non-alphanumeric with hyphens', () => {
        expect(slugifyLane('In Progress')).toBe('in-progress');
    });

    it('trims leading and trailing hyphens', () => {
        expect(slugifyLane('--hello--')).toBe('hello');
    });

    it('collapses runs of non-alphanumeric characters', () => {
        expect(slugifyLane('a & b / c')).toBe('a-b-c');
    });

    it('returns empty string for empty input', () => {
        expect(slugifyLane('')).toBe('');
    });

    it('handles already-slugified input', () => {
        expect(slugifyLane('todo')).toBe('todo');
    });
});

describe('slugifyBoard', () => {
    it('lowercases and replaces non-alphanumeric with hyphens', () => {
        expect(slugifyBoard('My Board Name')).toBe('my-board-name');
    });

    it('trims leading and trailing hyphens', () => {
        expect(slugifyBoard('  hello world  ')).toBe('hello-world');
    });

    it('handles special characters', () => {
        expect(slugifyBoard('Project (2026) v2')).toBe('project-2026-v2');
    });

    it('returns empty string for non-alphanumeric only input', () => {
        expect(slugifyBoard('!@#$')).toBe('');
    });
});

describe('displayLane', () => {
    it('uppercases and replaces hyphens with spaces', () => {
        expect(displayLane('in-progress')).toBe('IN PROGRESS');
    });

    it('handles single word', () => {
        expect(displayLane('todo')).toBe('TODO');
    });

    it('handles empty string', () => {
        expect(displayLane('')).toBe('');
    });
});

describe('displayBoard', () => {
    it('converts to Title Case and replaces hyphens with spaces', () => {
        expect(displayBoard('my-board-name')).toBe('My Board Name');
    });

    it('handles single word', () => {
        expect(displayBoard('project')).toBe('Project');
    });

    it('handles empty string', () => {
        expect(displayBoard('')).toBe('');
    });
});

describe('isProtectedLane', () => {
    it('returns true for todo', () => {
        expect(isProtectedLane('todo')).toBe(true);
    });

    it('returns true for done', () => {
        expect(isProtectedLane('done')).toBe(true);
    });

    it('returns false for doing', () => {
        expect(isProtectedLane('doing')).toBe(false);
    });

    it('returns false for archive', () => {
        expect(isProtectedLane('archive')).toBe(false);
    });
});

describe('isReservedLane', () => {
    it('returns true for archive', () => {
        expect(isReservedLane('archive')).toBe(true);
    });

    it('returns false for todo', () => {
        expect(isReservedLane('todo')).toBe(false);
    });

    it('returns false for an arbitrary string', () => {
        expect(isReservedLane('custom-lane')).toBe(false);
    });
});

describe('isImageFile', () => {
    it('returns true for .png', () => {
        expect(isImageFile('screenshot.png')).toBe(true);
    });

    it('returns true for .jpg', () => {
        expect(isImageFile('photo.jpg')).toBe(true);
    });

    it('returns true for .jpeg', () => {
        expect(isImageFile('photo.jpeg')).toBe(true);
    });

    it('returns true for .gif', () => {
        expect(isImageFile('animation.gif')).toBe(true);
    });

    it('returns true for .webp', () => {
        expect(isImageFile('image.webp')).toBe(true);
    });

    it('returns true for .svg', () => {
        expect(isImageFile('diagram.svg')).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isImageFile('PHOTO.PNG')).toBe(true);
        expect(isImageFile('Image.JPG')).toBe(true);
    });

    it('returns false for non-image files', () => {
        expect(isImageFile('document.pdf')).toBe(false);
        expect(isImageFile('data.yaml')).toBe(false);
        expect(isImageFile('notes.md')).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isImageFile('')).toBe(false);
    });
});

describe('constants', () => {
    it('DEFAULT_LANES contains todo, doing, done', () => {
        expect(DEFAULT_LANES).toEqual(['todo', 'doing', 'done']);
    });

    it('PROTECTED_LANES contains todo and done', () => {
        expect(PROTECTED_LANES).toEqual(['todo', 'done']);
    });

    it('RESERVED_LANES contains archive', () => {
        expect(RESERVED_LANES).toEqual(['archive']);
    });

    it('ASSETS_DIR is assets', () => {
        expect(ASSETS_DIR).toBe('assets');
    });

    it('DEFAULT_BOARD_CONFIG has default lanes and empty name', () => {
        expect(DEFAULT_BOARD_CONFIG.name).toBe('');
        expect(DEFAULT_BOARD_CONFIG.lanes).toEqual(['todo', 'doing', 'done']);
    });
});
