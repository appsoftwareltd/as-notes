import { describe, it, expect } from 'vitest';
import { isOnBulletLine, getOutlinerEnterInsert, toggleOutlinerTodoLine } from '../OutlinerService.js';

// ── isOnBulletLine ─────────────────────────────────────────────────────────

describe('isOnBulletLine', () => {
    it('returns true for a plain bullet line', () => {
        expect(isOnBulletLine('- hello')).toBe(true);
    });

    it('returns true for an indented bullet line', () => {
        expect(isOnBulletLine('    - hello')).toBe(true);
    });

    it('returns true for a bullet line with only a hyphen and space', () => {
        expect(isOnBulletLine('- ')).toBe(true);
    });

    it('returns true for an indented empty bullet', () => {
        expect(isOnBulletLine('    - ')).toBe(true);
    });

    it('returns true for an unchecked todo line', () => {
        expect(isOnBulletLine('- [ ] todo item')).toBe(true);
    });

    it('returns true for a done todo line', () => {
        expect(isOnBulletLine('- [x] done item')).toBe(true);
    });

    it('returns true for an indented todo line', () => {
        expect(isOnBulletLine('    - [ ] nested todo')).toBe(true);
    });

    it('returns false for plain text', () => {
        expect(isOnBulletLine('hello world')).toBe(false);
    });

    it('returns false for an empty line', () => {
        expect(isOnBulletLine('')).toBe(false);
    });

    it('returns false for a whitespace-only line', () => {
        expect(isOnBulletLine('    ')).toBe(false);
    });

    it('returns false for a * bullet (not supported by outliner)', () => {
        expect(isOnBulletLine('* item')).toBe(false);
    });

    it('returns false for an indented * bullet', () => {
        expect(isOnBulletLine('    * item')).toBe(false);
    });

    it('returns false when hyphen has no trailing space', () => {
        expect(isOnBulletLine('-hello')).toBe(false);
    });
});

// ── getOutlinerEnterInsert ─────────────────────────────────────────────────

describe('getOutlinerEnterInsert', () => {
    // ── Plain bullets ──────────────────────────────────────────────────────

    it('returns new bullet for a plain bullet line (no indent)', () => {
        expect(getOutlinerEnterInsert('- hello')).toBe('\n- ');
    });

    it('returns new indented bullet for an indented plain bullet', () => {
        expect(getOutlinerEnterInsert('    - hello')).toBe('\n    - ');
    });

    it('returns new bullet for an empty bullet line', () => {
        expect(getOutlinerEnterInsert('- ')).toBe('\n- ');
    });

    it('returns new indented bullet for an empty indented bullet', () => {
        expect(getOutlinerEnterInsert('    - ')).toBe('\n    - ');
    });

    it('preserves 2-space indentation', () => {
        expect(getOutlinerEnterInsert('  - item')).toBe('\n  - ');
    });

    it('preserves 8-space (double-nested) indentation', () => {
        expect(getOutlinerEnterInsert('        - deep item')).toBe('\n        - ');
    });

    // ── Todo lines ─────────────────────────────────────────────────────────

    it('returns new unchecked todo for an unchecked todo line', () => {
        expect(getOutlinerEnterInsert('- [ ] todo')).toBe('\n- [ ] ');
    });

    it('returns new unchecked todo for a done todo line', () => {
        expect(getOutlinerEnterInsert('- [x] done')).toBe('\n- [ ] ');
    });

    it('returns new unchecked todo for an uppercase-X done todo', () => {
        expect(getOutlinerEnterInsert('- [X] done')).toBe('\n- [ ] ');
    });

    it('returns new indented unchecked todo for an indented todo line', () => {
        expect(getOutlinerEnterInsert('    - [ ] nested')).toBe('\n    - [ ] ');
    });

    it('returns new indented unchecked todo for an indented done todo', () => {
        expect(getOutlinerEnterInsert('    - [x] nested done')).toBe('\n    - [ ] ');
    });
});

// ── toggleOutlinerTodoLine ─────────────────────────────────────────────────

describe('toggleOutlinerTodoLine', () => {
    // ── Plain bullet → unchecked todo ──────────────────────────────────────

    it('converts plain bullet to unchecked todo', () => {
        expect(toggleOutlinerTodoLine('- item')).toBe('- [ ] item');
    });

    it('converts indented plain bullet to unchecked todo preserving indent', () => {
        expect(toggleOutlinerTodoLine('    - item')).toBe('    - [ ] item');
    });

    it('converts empty bullet to unchecked todo', () => {
        expect(toggleOutlinerTodoLine('- ')).toBe('- [ ] ');
    });

    // ── Unchecked todo → done todo ─────────────────────────────────────────

    it('marks unchecked todo as done', () => {
        expect(toggleOutlinerTodoLine('- [ ] item')).toBe('- [x] item');
    });

    it('marks indented unchecked todo as done', () => {
        expect(toggleOutlinerTodoLine('    - [ ] nested')).toBe('    - [x] nested');
    });

    // ── Done todo → plain bullet (outliner diverges from default here) ─────

    it('converts done todo to plain bullet (not plain text)', () => {
        expect(toggleOutlinerTodoLine('- [x] item')).toBe('- item');
    });

    it('converts done todo with uppercase X to plain bullet', () => {
        expect(toggleOutlinerTodoLine('- [X] item')).toBe('- item');
    });

    it('converts indented done todo to indented plain bullet', () => {
        expect(toggleOutlinerTodoLine('    - [x] nested')).toBe('    - nested');
    });

    it('converts empty done todo to empty plain bullet', () => {
        expect(toggleOutlinerTodoLine('- [x] ')).toBe('- ');
    });

    // ── Full outliner cycle ────────────────────────────────────────────────

    it('completes a full outliner cycle: plain bullet → unchecked → done → plain bullet', () => {
        const bullet = '- write docs';
        const unchecked = toggleOutlinerTodoLine(bullet);
        expect(unchecked).toBe('- [ ] write docs');

        const done = toggleOutlinerTodoLine(unchecked);
        expect(done).toBe('- [x] write docs');

        const backToBullet = toggleOutlinerTodoLine(done);
        expect(backToBullet).toBe('- write docs');
    });
});
