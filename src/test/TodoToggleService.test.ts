import { describe, it, expect } from 'vitest';
import { toggleTodoLine } from '../TodoToggleService.js';

describe('TodoToggleService', () => {
    // ── Plain text → unchecked todo ────────────────────────────────────────

    it('converts plain text to unchecked todo', () => {
        expect(toggleTodoLine('buy milk')).toBe('- [ ] buy milk');
    });

    it('converts indented plain text to unchecked todo preserving indent', () => {
        expect(toggleTodoLine('    buy milk')).toBe('    - [ ] buy milk');
    });

    it('converts empty line to unchecked todo', () => {
        expect(toggleTodoLine('')).toBe('- [ ] ');
    });

    it('converts whitespace-only line to unchecked todo preserving indent', () => {
        expect(toggleTodoLine('    ')).toBe('    - [ ] ');
    });

    // ── Unchecked todo → done todo ─────────────────────────────────────────

    it('marks unchecked todo as done', () => {
        expect(toggleTodoLine('- [ ] buy milk')).toBe('- [x] buy milk');
    });

    it('marks indented unchecked todo as done', () => {
        expect(toggleTodoLine('    - [ ] nested task')).toBe('    - [x] nested task');
    });

    it('marks unchecked todo with * bullet as done', () => {
        expect(toggleTodoLine('* [ ] buy milk')).toBe('* [x] buy milk');
    });

    // ── Done todo → plain text ─────────────────────────────────────────────

    it('strips done todo to plain text', () => {
        expect(toggleTodoLine('- [x] buy milk')).toBe('buy milk');
    });

    it('strips done todo with uppercase X', () => {
        expect(toggleTodoLine('- [X] buy milk')).toBe('buy milk');
    });

    it('strips indented done todo preserving indent', () => {
        expect(toggleTodoLine('    - [x] nested task')).toBe('    nested task');
    });

    it('strips done todo with * bullet', () => {
        expect(toggleTodoLine('* [x] buy milk')).toBe('buy milk');
    });

    // ── Existing list items (no checkbox) ──────────────────────────────────

    it('inserts checkbox into existing list item with -', () => {
        expect(toggleTodoLine('- some text')).toBe('- [ ] some text');
    });

    it('inserts checkbox into existing list item with *', () => {
        expect(toggleTodoLine('* some text')).toBe('* [ ] some text');
    });

    it('inserts checkbox into indented list item', () => {
        expect(toggleTodoLine('  - some text')).toBe('  - [ ] some text');
    });

    // ── Full cycle ─────────────────────────────────────────────────────────

    it('completes a full cycle: plain → unchecked → done → plain', () => {
        const plain = 'write docs';
        const unchecked = toggleTodoLine(plain);
        expect(unchecked).toBe('- [ ] write docs');

        const done = toggleTodoLine(unchecked);
        expect(done).toBe('- [x] write docs');

        const backToPlain = toggleTodoLine(done);
        expect(backToPlain).toBe('write docs');
    });

    it('completes a full cycle with existing list item', () => {
        const listItem = '- write docs';
        const unchecked = toggleTodoLine(listItem);
        expect(unchecked).toBe('- [ ] write docs');

        const done = toggleTodoLine(unchecked);
        expect(done).toBe('- [x] write docs');

        const plain = toggleTodoLine(done);
        expect(plain).toBe('write docs');
    });

    it('completes a full cycle with indentation', () => {
        const plain = '    write docs';
        const unchecked = toggleTodoLine(plain);
        expect(unchecked).toBe('    - [ ] write docs');

        const done = toggleTodoLine(unchecked);
        expect(done).toBe('    - [x] write docs');

        const backToPlain = toggleTodoLine(done);
        expect(backToPlain).toBe('    write docs');
    });
});
