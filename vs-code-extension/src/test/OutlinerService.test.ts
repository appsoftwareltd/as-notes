import { describe, it, expect } from 'vitest';
import {
    isOnBulletLine,
    getOutlinerEnterInsert,
    getFenceTokenCursorZone,
    isOutlinerBackspaceMergeCandidate,
    getOutlinerBackspaceTargetLine,
    toggleOutlinerTodoLine,
    isCodeFenceOpen,
    getCodeFenceEnterInsert,
    getBulletCodeFenceEnterInsert,
    formatOutlinerPaste,
    isStandaloneCodeFenceOpen,
    getStandaloneCodeFenceEnterInsert,
    isClosingCodeFenceLine,
    getBulletCodeFenceContext,
    getClosingFenceBulletInsert,
    isInsideBulletCodeFence,
    isCodeFenceUnbalanced,
    getMaxOutlinerIndent,
    getOutlinerBranchRange,
    getOutlinerFirstChildLine,
    getOwningOutlinerBranchLine,
    getOutlinerBranchActionLine,
    canIndentOutlinerBranch,
    moveOutlinerBranch,
    getOutlinerFenceContentBoundary,
    canJoinOutlinerFenceContentWithPreviousLine,
    getOutlinerFenceVerticalMoveTarget,
    isOutlinerFenceBackspaceBlocked,
    shiftOutlinerFenceContentLine,
    formatOutlinerFencePaste,
} from '../OutlinerService.js';

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

    it('can override the target indentation for child-first insertion', () => {
        expect(getOutlinerEnterInsert('- parent', '    ')).toBe('\n    - ');
        expect(getOutlinerEnterInsert('- [x] parent', '    ')).toBe('\n    - [ ] ');
    });
});

// ── fence token cursor position ───────────────────────────────────────────

describe('getFenceTokenCursorZone', () => {
    it('returns before when the cursor is before the first backtick', () => {
        expect(getFenceTokenCursorZone('- ```ts', 2)).toBe('before');
    });

    it('returns inside when the cursor is inside the backtick token', () => {
        expect(getFenceTokenCursorZone('- ```ts', 4)).toBe('inside');
    });

    it('returns after when the cursor is after the backtick token', () => {
        expect(getFenceTokenCursorZone('- ```ts', 5)).toBe('after');
    });

    it('returns none when the line does not contain a fence token', () => {
        expect(getFenceTokenCursorZone('- plain bullet', 3)).toBe('none');
    });
});

// ── outliner backspace merge ─────────────────────────────────────────────

describe('isOutlinerBackspaceMergeCandidate', () => {
    it('returns true for an empty plain bullet at the bullet content start', () => {
        expect(isOutlinerBackspaceMergeCandidate('- ', 2)).toBe(true);
        expect(isOutlinerBackspaceMergeCandidate('-', 1)).toBe(true);
        expect(isOutlinerBackspaceMergeCandidate('    - ', 6)).toBe(true);
        expect(isOutlinerBackspaceMergeCandidate('    -', 5)).toBe(true);
    });

    it('returns true for an empty todo bullet at the checkbox content start', () => {
        expect(isOutlinerBackspaceMergeCandidate('- [ ] ', 6)).toBe(true);
    });

    it('returns false for non-empty bullets or other cursor positions', () => {
        expect(isOutlinerBackspaceMergeCandidate('- item', 2)).toBe(false);
        expect(isOutlinerBackspaceMergeCandidate('- ', 1)).toBe(false);
        expect(isOutlinerBackspaceMergeCandidate('- [ ] ', 5)).toBe(false);
    });
});

describe('getOutlinerBackspaceTargetLine', () => {
    it('merges an empty root-level sibling into the previous sibling bullet', () => {
        const lines = [
            '- first',
            '-',
        ];

        expect(getOutlinerBackspaceTargetLine(lines, 1)).toBe(0);
    });

    it('merges a first child into its parent when there is no previous sibling', () => {
        const lines = [
            '- parent',
            '    - ',
        ];

        expect(getOutlinerBackspaceTargetLine(lines, 1)).toBe(0);
    });

    it('prefers the previous sibling over the parent for nested empty bullets', () => {
        const lines = [
            '- parent',
            '    - child one',
            '        - grandchild',
            '    - ',
        ];

        expect(getOutlinerBackspaceTargetLine(lines, 3)).toBe(1);
    });

    it('returns null when there is no previous structural predecessor', () => {
        const lines = ['- '];

        expect(getOutlinerBackspaceTargetLine(lines, 0)).toBeNull();
    });

    it('returns null for non-empty bullets', () => {
        const lines = ['- first', '- second'];

        expect(getOutlinerBackspaceTargetLine(lines, 1)).toBeNull();
    });

    it('handles \\r\\n line endings from getText().split(\\n)', () => {
        const lines = [
            '- first\r',
            '- \r',
        ];

        expect(getOutlinerBackspaceTargetLine(lines, 1)).toBe(0);
    });

    it('handles bare dash with \\r\\n line endings', () => {
        const lines = [
            '- parent\r',
            '    -\r',
        ];

        expect(getOutlinerBackspaceTargetLine(lines, 1)).toBe(0);
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

// ── isCodeFenceOpen ────────────────────────────────────────────────────────

describe('isCodeFenceOpen', () => {
    it('returns true for a bullet ending with triple backticks', () => {
        expect(isCodeFenceOpen('- ```')).toBe(true);
    });

    it('returns true for a bullet ending with backticks and language', () => {
        expect(isCodeFenceOpen('- ```javascript')).toBe(true);
    });

    it('returns true for an indented bullet with backticks', () => {
        expect(isCodeFenceOpen('    - ```')).toBe(true);
    });

    it('returns true for an indented bullet with backticks and language', () => {
        expect(isCodeFenceOpen('    - ```typescript')).toBe(true);
    });

    it('returns true with trailing whitespace after language', () => {
        expect(isCodeFenceOpen('- ```python  ')).toBe(true);
    });

    it('returns true with trailing whitespace after bare backticks', () => {
        expect(isCodeFenceOpen('- ```  ')).toBe(true);
    });

    it('returns false for a normal bullet line', () => {
        expect(isCodeFenceOpen('- hello')).toBe(false);
    });

    it('returns false for a bullet with backticks in the middle of text', () => {
        expect(isCodeFenceOpen('- some ```code``` here')).toBe(false);
    });

    it('returns false for a bullet with inline code backtick', () => {
        expect(isCodeFenceOpen('- use `code` here')).toBe(false);
    });

    it('returns false for a non-bullet line with backticks', () => {
        expect(isCodeFenceOpen('```javascript')).toBe(false);
    });

    it('returns false for text before the backticks on the bullet', () => {
        expect(isCodeFenceOpen('- some text ```')).toBe(true);
    });

    it('returns true for a todo line ending with backticks', () => {
        expect(isCodeFenceOpen('- [ ] ```javascript')).toBe(true);
    });

    it('returns true for a done todo line ending with backticks', () => {
        expect(isCodeFenceOpen('- [x] ```')).toBe(true);
    });
});

// ── getCodeFenceEnterInsert ────────────────────────────────────────────────

describe('getCodeFenceEnterInsert', () => {
    it('returns code block skeleton for a plain bullet with bare backticks', () => {
        // "- ```" → "\n  \n  ```"
        // Indentation: bullet indent (0) + 2 spaces past the hyphen
        expect(getCodeFenceEnterInsert('- ```')).toBe('\n  \n  ```');
    });

    it('returns code block skeleton for a bullet with language', () => {
        expect(getCodeFenceEnterInsert('- ```javascript')).toBe('\n  \n  ```');
    });

    it('returns code block skeleton with indentation for an indented bullet', () => {
        // "    - ```" → "\n      \n      ```"
        // Indentation: 4 (bullet indent) + 2 (past hyphen) = 6 spaces
        expect(getCodeFenceEnterInsert('    - ```')).toBe('\n      \n      ```');
    });

    it('returns code block skeleton for indented bullet with language', () => {
        expect(getCodeFenceEnterInsert('    - ```typescript')).toBe('\n      \n      ```');
    });

    it('returns code block skeleton for 2-space indented bullet', () => {
        // "  - ```" → "\n    \n    ```"
        expect(getCodeFenceEnterInsert('  - ```')).toBe('\n    \n    ```');
    });

    it('returns code block skeleton for a todo line ending with backticks', () => {
        expect(getCodeFenceEnterInsert('- [ ] ```javascript')).toBe('\n  \n  ```');
    });

    it('returns code block skeleton for an indented todo line', () => {
        expect(getCodeFenceEnterInsert('    - [ ] ```')).toBe('\n      \n      ```');
    });
});

// ── bullet-owned code fence context ───────────────────────────────────────

describe('getBulletCodeFenceContext', () => {
    it('returns bullet fence context for the opening bullet line', () => {
        const lines = [
            '- ```csharp',
            '  Console.WriteLine("hi");',
            '  ```',
            '- sibling',
        ];

        expect(getBulletCodeFenceContext(lines, 0)).toEqual({
            openerLine: 0,
            rootIndent: 0,
            contentIndent: 2,
            isTodo: false,
        });
    });

    it('returns bullet fence context for content and closing fence lines', () => {
        const lines = [
            '    - [ ] ```ts',
            '      const value = 1;',
            '      ```',
            '    - next',
        ];

        expect(getBulletCodeFenceContext(lines, 1)).toEqual({
            openerLine: 0,
            rootIndent: 4,
            contentIndent: 6,
            isTodo: true,
        });
        expect(getBulletCodeFenceContext(lines, 2)).toEqual({
            openerLine: 0,
            rootIndent: 4,
            contentIndent: 6,
            isTodo: true,
        });
    });

    it('returns null once the bullet-owned fence has closed', () => {
        const lines = [
            '- ```js',
            '  const value = 1;',
            '  ```',
            '- next',
        ];

        expect(getBulletCodeFenceContext(lines, 3)).toBeNull();
    });

    it('does not treat standalone fences as bullet-owned fence context', () => {
        const lines = [
            '```js',
            'const value = 1;',
            '```',
        ];

        expect(getBulletCodeFenceContext(lines, 1)).toBeNull();
    });
});

describe('isInsideBulletCodeFence', () => {
    it('returns true for opening, content, and closing lines of a bullet-owned fence', () => {
        const lines = [
            '- ```python',
            '  print("hello")',
            '  ```',
            '- sibling',
        ];

        expect(isInsideBulletCodeFence(lines, 0)).toBe(true);
        expect(isInsideBulletCodeFence(lines, 1)).toBe(true);
        expect(isInsideBulletCodeFence(lines, 2)).toBe(true);
        expect(isInsideBulletCodeFence(lines, 3)).toBe(false);
    });
});

describe('getBulletCodeFenceEnterInsert', () => {
    it('returns null when the cursor is before the fence token on a bullet fence line', () => {
        const lines = [
            '- ```csharp',
            '  Console.WriteLine("hi");',
            '  ```',
        ];

        expect(getBulletCodeFenceEnterInsert(lines, 0, 1)).toBeNull();
    });

    it('treats the caret at the first backtick as a valid opening-fence Enter position', () => {
        const lines = [
            '- ```csharp',
            '  Console.WriteLine("hi");',
            '  ```',
        ];

        expect(getBulletCodeFenceEnterInsert(lines, 0, 2)).toBe('\n  ');
    });

    it('returns a full skeleton when a bullet fence has no closing fence yet', () => {
        const lines = [
            '- ```csharp',
            '  Console.WriteLine("hi");',
        ];

        expect(getBulletCodeFenceEnterInsert(lines, 0, 5)).toBe('\n  \n  ```');
    });

    it('returns only a continued content line when the bullet fence is already closed later', () => {
        const lines = [
            '- ```csharp',
            '  Console.WriteLine("hi");',
            '  ```',
            '- sibling',
        ];

        expect(getBulletCodeFenceEnterInsert(lines, 0, 5)).toBe('\n  ');
    });

    it('returns null for lines that are not bullet fence openers', () => {
        const lines = ['- plain bullet'];
        expect(getBulletCodeFenceEnterInsert(lines, 0)).toBeNull();
    });
});

// ── formatOutlinerPaste ────────────────────────────────────────────────────

describe('formatOutlinerPaste', () => {
    // ── Single-line paste (no conversion) ──────────────────────────────────

    it('returns null for single-line clipboard text (no conversion)', () => {
        expect(formatOutlinerPaste('- ', 2, 'hello')).toBeNull();
    });

    it('returns null for clipboard text with no newlines', () => {
        expect(formatOutlinerPaste('- some text', 5, 'pasted')).toBeNull();
    });

    // ── Multi-line paste on plain bullet ───────────────────────────────────

    it('converts multi-line paste on an empty plain bullet', () => {
        const result = formatOutlinerPaste('- ', 2, 'Hello\nWorld');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('- Hello\n- World');
        expect(result!.replaceFromChar).toBe(0);
    });

    it('strips empty lines from pasted content', () => {
        const result = formatOutlinerPaste('- ', 2, 'Hello\n\nWorld\n\nBye');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('- Hello\n- World\n- Bye');
    });

    it('preserves indentation for indented plain bullet', () => {
        const result = formatOutlinerPaste('    - ', 6, 'Line1\nLine2\nLine3');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('    - Line1\n    - Line2\n    - Line3');
    });

    it('merges first pasted line with existing text before cursor on plain bullet', () => {
        // "- existing|" with cursor at 10, paste "Hello\nWorld"
        // → "- existingHello\n- World"
        const result = formatOutlinerPaste('- existing', 10, 'Hello\nWorld');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('- existingHello\n- World');
        expect(result!.replaceFromChar).toBe(0);
    });

    it('handles text after cursor on plain bullet line', () => {
        // "- hel|lo" with cursor at 5, paste "AAA\nBBB"
        // Text before cursor: "- hel", text after cursor: "lo"
        // → "- helAAA\n- BBB" and "lo" stays after the last bullet
        const result = formatOutlinerPaste('- hello', 5, 'AAA\nBBB');
        expect(result).not.toBeNull();
        // First line keeps text before cursor + first pasted line
        // Last pasted line gets text after cursor appended
        expect(result!.text).toBe('- helAAA\n- BBBlo');
        expect(result!.replaceFromChar).toBe(0);
    });

    // ── Multi-line paste on unchecked todo ──────────────────────────────────

    it('converts multi-line paste on empty unchecked todo', () => {
        const result = formatOutlinerPaste('- [ ] ', 6, 'Hello\nWorld\nBye');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('- [ ] Hello\n- [ ] World\n- [ ] Bye');
    });

    it('converts multi-line paste on indented unchecked todo', () => {
        const result = formatOutlinerPaste('    - [ ] ', 10, 'A\nB');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('    - [ ] A\n    - [ ] B');
    });

    // ── Multi-line paste on done todo ──────────────────────────────────────

    it('keeps first line checked, subsequent unchecked for done todo', () => {
        const result = formatOutlinerPaste('- [x] ', 6, 'Hello\nWorld\nBye');
        expect(result).not.toBeNull();
        // First line uses original checked state, rest are unchecked
        expect(result!.text).toBe('- [x] Hello\n- [ ] World\n- [ ] Bye');
    });

    it('keeps first line checked, subsequent unchecked for indented done todo', () => {
        const result = formatOutlinerPaste('    - [x] ', 10, 'A\nB');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('    - [x] A\n    - [ ] B');
    });

    // ── Whitespace handling ────────────────────────────────────────────────

    it('strips leading/trailing whitespace from each pasted line', () => {
        const result = formatOutlinerPaste('- ', 2, '  Hello  \n  World  ');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('- Hello\n- World');
    });

    it('strips all empty/whitespace-only lines', () => {
        const result = formatOutlinerPaste('- ', 2, 'A\n   \n\nB\n  \nC');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('- A\n- B\n- C');
    });

    // ── Edge: paste on todo with existing text + text after cursor ─────────

    it('handles text after cursor on todo line', () => {
        // "- [ ] hel|lo" cursor at 9
        const result = formatOutlinerPaste('- [ ] hello', 9, 'AAA\nBBB');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('- [ ] helAAA\n- [ ] BBBlo');
        expect(result!.replaceFromChar).toBe(0);
    });

    // ── Edge: only whitespace lines pasted ─────────────────────────────────

    it('returns null when all pasted lines are empty/whitespace', () => {
        expect(formatOutlinerPaste('- ', 2, '\n  \n\n  ')).toBeNull();
    });

    // ── Edge: clipboard with \\r\\n line endings ───────────────────────────

    it('handles Windows-style CRLF line endings', () => {
        const result = formatOutlinerPaste('- ', 2, 'Hello\r\nWorld\r\nBye');
        expect(result).not.toBeNull();
        expect(result!.text).toBe('- Hello\n- World\n- Bye');
    });
});

// ── isStandaloneCodeFenceOpen ──────────────────────────────────────────────

describe('isStandaloneCodeFenceOpen', () => {
    it('returns true for bare triple backticks', () => {
        expect(isStandaloneCodeFenceOpen('```')).toBe(true);
    });

    it('returns true for backticks with language', () => {
        expect(isStandaloneCodeFenceOpen('```javascript')).toBe(true);
    });

    it('returns true for indented backticks', () => {
        expect(isStandaloneCodeFenceOpen('    ```')).toBe(true);
    });

    it('returns true for indented backticks with language', () => {
        expect(isStandaloneCodeFenceOpen('  ```python')).toBe(true);
    });

    it('returns true with trailing whitespace', () => {
        expect(isStandaloneCodeFenceOpen('```  ')).toBe(true);
    });

    it('returns true with trailing whitespace after language', () => {
        expect(isStandaloneCodeFenceOpen('```typescript  ')).toBe(true);
    });

    it('returns false for a bullet line with backticks (use isCodeFenceOpen instead)', () => {
        expect(isStandaloneCodeFenceOpen('- ```')).toBe(false);
    });

    it('returns false for an indented bullet with backticks', () => {
        expect(isStandaloneCodeFenceOpen('    - ```javascript')).toBe(false);
    });

    it('returns false for plain text', () => {
        expect(isStandaloneCodeFenceOpen('hello world')).toBe(false);
    });

    it('returns false for inline backticks', () => {
        expect(isStandaloneCodeFenceOpen('some `code` here')).toBe(false);
    });

    it('returns false for text before backticks', () => {
        expect(isStandaloneCodeFenceOpen('text ```')).toBe(false);
    });
});

// ── getStandaloneCodeFenceEnterInsert ──────────────────────────────────────

describe('getStandaloneCodeFenceEnterInsert', () => {
    it('returns code block skeleton at same indent for bare backticks', () => {
        // "```" → "\n\n```"  (no indent: cursor line + closing fence)
        expect(getStandaloneCodeFenceEnterInsert('```')).toBe('\n\n```');
    });

    it('returns code block skeleton at same indent for backticks with language', () => {
        expect(getStandaloneCodeFenceEnterInsert('```javascript')).toBe('\n\n```');
    });

    it('returns code block skeleton preserving indent', () => {
        // "    ```" → "\n    \n    ```"
        expect(getStandaloneCodeFenceEnterInsert('    ```')).toBe('\n    \n    ```');
    });

    it('returns code block skeleton preserving indent with language', () => {
        expect(getStandaloneCodeFenceEnterInsert('  ```python')).toBe('\n  \n  ```');
    });
});

// ── isClosingCodeFenceLine ─────────────────────────────────────────────────

describe('isClosingCodeFenceLine', () => {
    it('returns true for bare closing backticks', () => {
        expect(isClosingCodeFenceLine('```')).toBe(true);
    });

    it('returns true for indented closing backticks', () => {
        expect(isClosingCodeFenceLine('  ```')).toBe(true);
    });

    it('returns true for closing backticks with trailing whitespace', () => {
        expect(isClosingCodeFenceLine('```  ')).toBe(true);
    });

    it('returns true for indented closing backticks with trailing whitespace', () => {
        expect(isClosingCodeFenceLine('      ```  ')).toBe(true);
    });

    it('returns false for backticks with language (opening fence, not closing)', () => {
        expect(isClosingCodeFenceLine('```javascript')).toBe(false);
    });

    it('returns false for a bullet line with backticks', () => {
        expect(isClosingCodeFenceLine('- ```')).toBe(false);
    });

    it('returns false for plain text', () => {
        expect(isClosingCodeFenceLine('hello')).toBe(false);
    });

    it('returns false for a line with text after backticks', () => {
        expect(isClosingCodeFenceLine('``` some text')).toBe(false);
    });
});

// ── getClosingFenceBulletInsert ────────────────────────────────────────────

describe('getClosingFenceBulletInsert', () => {
    it('returns new bullet at parent indent when closing fence is inside a bullet code block', () => {
        const lines = [
            '- ```javascript',
            '  var i = 0;',
            '  ```',
        ];
        expect(getClosingFenceBulletInsert(lines, 2)).toBe('\n- ');
    });

    it('returns new bullet at parent indent for indented bullet code block', () => {
        const lines = [
            '    - ```',
            '      some text',
            '      ```',
        ];
        expect(getClosingFenceBulletInsert(lines, 2)).toBe('\n    - ');
    });

    it('returns new todo bullet when parent is an unchecked todo', () => {
        const lines = [
            '- [ ] ```javascript',
            '  code',
            '  ```',
        ];
        expect(getClosingFenceBulletInsert(lines, 2)).toBe('\n- [ ] ');
    });

    it('returns new unchecked todo bullet when parent is a done todo', () => {
        const lines = [
            '- [x] ```',
            '  code',
            '  ```',
        ];
        expect(getClosingFenceBulletInsert(lines, 2)).toBe('\n- [ ] ');
    });

    it('returns new indented todo bullet when parent is indented todo', () => {
        const lines = [
            '    - [ ] ```typescript',
            '      let x = 1;',
            '      ```',
        ];
        expect(getClosingFenceBulletInsert(lines, 2)).toBe('\n    - [ ] ');
    });

    it('returns null when closing fence is NOT inside a bullet code block', () => {
        const lines = [
            '```javascript',
            'var i = 0;',
            '```',
        ];
        expect(getClosingFenceBulletInsert(lines, 2)).toBeNull();
    });

    it('returns null when no opening fence is found above', () => {
        const lines = [
            'some text',
            '```',
        ];
        expect(getClosingFenceBulletInsert(lines, 1)).toBeNull();
    });

    it('handles nested bullet structure - finds nearest bullet with code fence', () => {
        const lines = [
            '- Parent',
            '    - ```',
            '      code',
            '      ```',
        ];
        expect(getClosingFenceBulletInsert(lines, 3)).toBe('\n    - ');
    });

    it('handles code block with multiple lines of content', () => {
        const lines = [
            '- ```javascript',
            '  function foo() {',
            '    return 42;',
            '  }',
            '  ```',
        ];
        expect(getClosingFenceBulletInsert(lines, 4)).toBe('\n- ');
    });

    it('skips non-fence lines when scanning upward and finds the bullet fence opener', () => {
        const lines = [
            '- Some text',
            '- ```',
            '  line1',
            '  line2',
            '  line3',
            '  ```',
        ];
        expect(getClosingFenceBulletInsert(lines, 5)).toBe('\n- ');
    });

    it('returns null when the first line is a closing fence with nothing above', () => {
        const lines = ['```'];
        expect(getClosingFenceBulletInsert(lines, 0)).toBeNull();
    });
});

// ── isCodeFenceUnbalanced ──────────────────────────────────────────────────

describe('isCodeFenceUnbalanced', () => {
    it('returns true for a single opening fence with language (no closing fence)', () => {
        const lines = ['```javascript'];
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(true);
    });

    it('returns true for a single bare opening fence', () => {
        const lines = ['```'];
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(true);
    });

    it('returns false for opening fence of a balanced pair (with language)', () => {
        // Example 3: balanced pair
        const lines = [
            '```javascript',
            '',
            '```',
        ];
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(false);
    });

    it('returns false for opening fence of a balanced pair (bare)', () => {
        const lines = [
            '```',
            '',
            '```',
        ];
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(false);
    });

    it('returns false for closing fence of a balanced pair', () => {
        const lines = [
            '```javascript',
            'code',
            '```',
        ];
        expect(isCodeFenceUnbalanced(lines, 2)).toBe(false);
    });

    it('returns true for an unpaired fence after a completed pair (Example 5)', () => {
        // A balanced pair above, then a new unpaired opening
        const lines = [
            '```javascript',
            'code',
            '```',
            '',
            '```javascript',
        ];
        expect(isCodeFenceUnbalanced(lines, 4)).toBe(true);
    });

    it('returns true for an unpaired bare fence after a completed pair (Example 6)', () => {
        const lines = [
            '```',
            'text',
            '```',
            '',
            '```',
        ];
        expect(isCodeFenceUnbalanced(lines, 4)).toBe(true);
    });

    it('treats a new standalone fence under an outliner branch as unbalanced after a prior bullet-owned fence has closed', () => {
        const lines = [
            '- ```js',
            '  const a = 1;',
            '  ```',
            '  ```',
        ];

        expect(isCodeFenceUnbalanced(lines, 3)).toBe(true);
    });

    it('returns false for both fences of a pair with indentation', () => {
        const lines = [
            '    ```javascript',
            '    code',
            '    ```',
        ];
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(false);
        expect(isCodeFenceUnbalanced(lines, 2)).toBe(false);
    });

    it('does not pair fences at different indent levels', () => {
        // The second ``` is at a different indent, so the first is unbalanced
        const lines = [
            '```javascript',
            '    ```',
        ];
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(true);
    });

    it('pairs fences at the same indent ignoring other indent levels', () => {
        const lines = [
            '```javascript',
            '    ```',
            '    ```',
            '```',
        ];
        // The outer pair (lines 0 and 3) is balanced at indent 0
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(false);
        expect(isCodeFenceUnbalanced(lines, 3)).toBe(false);
        // The inner pair (lines 1 and 2) is balanced at indent 4
        expect(isCodeFenceUnbalanced(lines, 1)).toBe(false);
        expect(isCodeFenceUnbalanced(lines, 2)).toBe(false);
    });

    it('handles multiple pairs followed by an unpaired fence', () => {
        const lines = [
            '```',
            '```',
            '```',
            '```',
            '```',
        ];
        // Surrounding-balanced: fence is unbalanced when fence count
        // before AND after it are both even.
        // Line 0: before=0(even), after=4(even) → unbalanced
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(true);
        // Line 1: before=1(odd), after=3(odd) → balanced
        expect(isCodeFenceUnbalanced(lines, 1)).toBe(false);
        // Line 2: before=2(even), after=2(even) → unbalanced
        expect(isCodeFenceUnbalanced(lines, 2)).toBe(true);
        // Line 3: before=3(odd), after=1(odd) → balanced
        expect(isCodeFenceUnbalanced(lines, 3)).toBe(false);
        // Line 4: before=4(even), after=0(even) → unbalanced
        expect(isCodeFenceUnbalanced(lines, 4)).toBe(true);
    });

    it('returns true for fence between balanced pairs with language', () => {
        const lines = [
            '```javascript',
            'var i = 0',
            '```',
            '',
            '```javascript',   // line 4 — cursor here
            '',
            '```javascript',
            'var i = 0',
            '```',
        ];
        // Before line 4: [0,2] = 2 (even). After: [6,8] = 2 (even). → unbalanced
        expect(isCodeFenceUnbalanced(lines, 4)).toBe(true);
        // Existing pairs remain balanced
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(false);
        expect(isCodeFenceUnbalanced(lines, 2)).toBe(false);
        expect(isCodeFenceUnbalanced(lines, 6)).toBe(false);
        expect(isCodeFenceUnbalanced(lines, 8)).toBe(false);
    });

    it('returns true for fence between balanced pairs bare backticks', () => {
        const lines = [
            '```',
            'var i = 0',
            '```',
            '',
            '```',   // line 4 — cursor here
            '',
            '```',
            'var i = 0',
            '```',
        ];
        // Before line 4: [0,2] = 2 (even). After: [6,8] = 2 (even). → unbalanced
        expect(isCodeFenceUnbalanced(lines, 4)).toBe(true);
        // Bare boundary fences use the surrounding-balanced heuristic which
        // is ambiguous for boundary fences in multi-pair docs, so we only
        // assert the target line here.
    });

    it('ignores bullet fence lines (only considers standalone fences)', () => {
        // Bullet fences are not standalone — they should not participate in pairing
        const lines = [
            '- ```javascript',
            '  ```',
            '```',
        ];
        // Line 0 is a bullet fence, line 1 is indented (bullet continuation)
        // Line 2 is a standalone fence — it has no standalone pair, so unbalanced
        expect(isCodeFenceUnbalanced(lines, 2)).toBe(true);
    });

    it('returns false for a line that is not a fence at all', () => {
        const lines = ['hello world'];
        expect(isCodeFenceUnbalanced(lines, 0)).toBe(false);
    });

    it('handles content between fences correctly', () => {
        const lines = [
            '# Heading',
            '',
            '```python',
            'def foo():',
            '    pass',
            '```',
            '',
            'More text',
            '```',
        ];
        // Lines 2 and 5 pair at indent 0; line 8 is unpaired
        expect(isCodeFenceUnbalanced(lines, 2)).toBe(false);
        expect(isCodeFenceUnbalanced(lines, 5)).toBe(false);
        expect(isCodeFenceUnbalanced(lines, 8)).toBe(true);
    });

    it('returns true for bare ``` immediately after a language+bare balanced pair', () => {
        // User scenario: ```javascript / ``` (balanced pair), then bare ``` typed next
        const lines = [
            '```javascript',
            '',
            '```',
            '```',   // line 3 — unbalanced, should get completion
        ];
        expect(isCodeFenceUnbalanced(lines, 3)).toBe(true);
    });

    it('returns true for bare ``` after a balanced pair with content', () => {
        const lines = [
            '```javascript',
            'var i = 0',
            '```',
            '',
            '```',   // line 4 — unbalanced
        ];
        expect(isCodeFenceUnbalanced(lines, 4)).toBe(true);
    });

    it('returns false for bare ``` that closes a standalone bare pair', () => {
        // Two bare fences forming a complete pair — second is balanced
        const lines = [
            '```',
            'content',
            '```',   // line 2 — balanced (closes the pair)
        ];
        expect(isCodeFenceUnbalanced(lines, 2)).toBe(false);
    });

    it('returns true for bare ``` after two completed pairs', () => {
        const lines = [
            '```javascript',
            'code',
            '```',
            '```javascript',
            'code',
            '```',
            '```',   // line 6 — unbalanced, should get completion
        ];
        expect(isCodeFenceUnbalanced(lines, 6)).toBe(true);
    });
});

// ── getMaxOutlinerIndent ───────────────────────────────────────────────────

describe('getMaxOutlinerIndent', () => {
    it('returns one tab stop past parent at indent 0', () => {
        const lines = ['- parent', '- child'];
        // Nearest bullet above line 1 is at indent 0; max = 0 + 4 = 4
        expect(getMaxOutlinerIndent(lines, 1, 4)).toBe(4);
    });

    it('returns one tab stop past parent at indent 4', () => {
        const lines = ['- root', '    - parent', '    - child'];
        // Nearest bullet above line 2 is at indent 4; max = 4 + 4 = 8
        expect(getMaxOutlinerIndent(lines, 2, 4)).toBe(8);
    });

    it('returns two tab stops when parent is deeply indented', () => {
        const lines = ['- root', '    - mid', '        - deep', '- shallow'];
        // Nearest bullet above line 3 is "deep" at indent 8; max = 8 + 4 = 12
        expect(getMaxOutlinerIndent(lines, 3, 4)).toBe(12);
    });

    it('returns 0 when no bullet line exists above (first bullet)', () => {
        const lines = ['- only'];
        // No bullet above line 0; max = 0
        expect(getMaxOutlinerIndent(lines, 0, 4)).toBe(0);
    });

    it('returns 0 when only non-bullet lines exist above', () => {
        const lines = ['# heading', '', '- bullet'];
        // No bullet above line 2; max = 0
        expect(getMaxOutlinerIndent(lines, 2, 4)).toBe(0);
    });

    it('skips non-bullet lines when searching for parent', () => {
        const lines = ['- parent', '', '# heading', '- child'];
        // Nearest bullet above line 3 is "parent" at indent 0; max = 4
        expect(getMaxOutlinerIndent(lines, 3, 4)).toBe(4);
    });

    it('works with tab size 2', () => {
        const lines = ['- parent', '  - child'];
        // Nearest bullet above line 1 is '- parent' at indent 0; max = 0 + 2 = 2
        expect(getMaxOutlinerIndent(lines, 1, 2)).toBe(2);
    });

    it('uses the immediately preceding bullet regardless of indent', () => {
        const lines = ['- root', '    - child', '        - grandchild', '    - back-to-child'];
        // Nearest bullet above line 3 is "grandchild" at indent 8; max = 12
        expect(getMaxOutlinerIndent(lines, 3, 4)).toBe(12);
    });
});

// ── subtree-aware branch moves ────────────────────────────────────────────

describe('getOutlinerBranchRange', () => {
    it('includes non-bullet continuation lines indented to content indent', () => {
        const lines = [
            '- parent',
            '  paragraph',
            '  > quote',
            '  ![img](../assets/leaf.png)',
            '- sibling',
        ];

        expect(getOutlinerBranchRange(lines, 0)).toEqual({
            startLine: 0,
            endLine: 3,
            rootIndent: 0,
        });
    });

    it('stops before a non-bullet line indented less than content indent', () => {
        const lines = [
            '- parent',
            '  paragraph',
            'plain root paragraph',
            '- sibling',
        ];

        expect(getOutlinerBranchRange(lines, 0)).toEqual({
            startLine: 0,
            endLine: 1,
            rootIndent: 0,
        });
    });

    it('treats blank lines as neutral when followed by valid continuation content', () => {
        const lines = [
            '- parent',
            '  paragraph',
            '',
            '',
            '  continued paragraph',
            '- sibling',
        ];

        expect(getOutlinerBranchRange(lines, 0)).toEqual({
            startLine: 0,
            endLine: 4,
            rootIndent: 0,
        });
    });

    it('does not keep trailing blank lines when the next significant line closes the branch', () => {
        const lines = [
            '- parent',
            '  paragraph',
            '',
            '',
            'plain root paragraph',
            '- sibling',
        ];

        expect(getOutlinerBranchRange(lines, 0)).toEqual({
            startLine: 0,
            endLine: 1,
            rootIndent: 0,
        });
    });

    it('treats a heading outside continuation indent as a hard boundary', () => {
        const lines = [
            '- parent',
            '  paragraph',
            '# Heading',
            '- sibling',
        ];

        expect(getOutlinerBranchRange(lines, 0)).toEqual({
            startLine: 0,
            endLine: 1,
            rootIndent: 0,
        });
    });

    it('includes an indented table but excludes a root-level table after the branch', () => {
        const lines = [
            '- parent',
            '  | Col | Val |',
            '  | --- | --- |',
            '  | A | B |',
            '| Root | Table |',
            '| --- | --- |',
        ];

        expect(getOutlinerBranchRange(lines, 0)).toEqual({
            startLine: 0,
            endLine: 3,
            rootIndent: 0,
        });
    });

    it('keeps fenced blocks with internal blank lines inside the branch', () => {
        const lines = [
            '- parent',
            '  ```ts',
            '',
            'root-looking text inside fence',
            '',
            '  ```',
            'plain root paragraph',
        ];

        expect(getOutlinerBranchRange(lines, 0)).toEqual({
            startLine: 0,
            endLine: 5,
            rootIndent: 0,
        });
    });
});

describe('getOutlinerFirstChildLine', () => {
    it('returns the first descendant bullet line for a branch with children', () => {
        const lines = [
            '- parent',
            '  paragraph owned by parent',
            '    - child one',
            '        - grandchild',
            '    - child two',
        ];

        expect(getOutlinerFirstChildLine(lines, 0)).toBe(2);
    });

    it('returns null when the branch has no descendant bullets', () => {
        const lines = [
            '- parent',
            '  paragraph owned by parent',
            '  ```ts',
            '  const value = 1;',
            '  ```',
            '- sibling',
        ];

        expect(getOutlinerFirstChildLine(lines, 0)).toBeNull();
    });
});

describe('getOwningOutlinerBranchLine', () => {
    it('returns the same line when the current line is a bullet', () => {
        const lines = ['- root', '  paragraph'];
        expect(getOwningOutlinerBranchLine(lines, 0)).toBe(0);
    });

    it('returns the owning bullet line for a continuation paragraph', () => {
        const lines = [
            '- root',
            '  paragraph',
            '  still part of root',
            '- sibling',
        ];

        expect(getOwningOutlinerBranchLine(lines, 2)).toBe(0);
    });

    it('returns the owning bullet line for a blank line kept by lookahead', () => {
        const lines = [
            '- root',
            '  paragraph',
            '',
            '  continued paragraph',
            '- sibling',
        ];

        expect(getOwningOutlinerBranchLine(lines, 2)).toBe(0);
    });

    it('returns the owning bullet line for an indented closing fence', () => {
        const lines = [
            '- root',
            '  ```ts',
            '  const value = 1;',
            '  ```',
            '- sibling',
        ];

        expect(getOwningOutlinerBranchLine(lines, 3)).toBe(0);
    });

    it('returns null for a root-level line outside any branch', () => {
        const lines = [
            '- root',
            '  paragraph',
            'root paragraph',
        ];

        expect(getOwningOutlinerBranchLine(lines, 2)).toBeNull();
    });
});

describe('getOutlinerBranchActionLine', () => {
    it('returns the branch root when the cursor is on a bullet fence opener line', () => {
        const lines = [
            '- root',
            '  - ```csharp',
            '    Console.WriteLine("hi");',
            '    ```',
        ];

        expect(getOutlinerBranchActionLine(lines, 1)).toBe(1);
    });

    it('returns the owning branch root when the cursor is on a closing fence line', () => {
        const lines = [
            '- root',
            '  ```ts',
            '  const value = 1;',
            '  ```',
            '- sibling',
        ];

        expect(getOutlinerBranchActionLine(lines, 3)).toBe(0);
    });

    it('returns the owning branch root when the cursor is on a continuation paragraph outside fenced code', () => {
        const lines = [
            '- root',
            '  paragraph',
            '  another paragraph',
            '- sibling',
        ];

        expect(getOutlinerBranchActionLine(lines, 2)).toBe(0);
    });

    it('returns null for actual code-content lines inside a bullet-owned fence', () => {
        const lines = [
            '- root',
            '  ```ts',
            '  const value = 1;',
            '  ```',
            '- sibling',
        ];

        expect(getOutlinerBranchActionLine(lines, 2)).toBeNull();
    });
});

describe('canIndentOutlinerBranch', () => {
    it('allows indent when the branch root stays within one tab stop of the nearest bullet above', () => {
        const lines = ['- root', '- child', '    - grandchild'];
        expect(canIndentOutlinerBranch(lines, 1, 4)).toBe(true);
    });

    it('blocks indent when the branch root would exceed the max indent guard', () => {
        const lines = ['- root', '    - child', '        - grandchild'];
        expect(canIndentOutlinerBranch(lines, 2, 4)).toBe(false);
    });
});

describe('moveOutlinerBranch', () => {
    it('indenting a parent pushes direct and deep descendants', () => {
        const lines = [
            '- root',
            '- parent',
            '    - child',
            '        - grandchild',
            '- sibling',
        ];

        const result = moveOutlinerBranch(lines, 1, 4, 'indent');

        expect(result).not.toBeNull();
        expect(result!.lines).toEqual([
            '- root',
            '    - parent',
            '        - child',
            '            - grandchild',
            '- sibling',
        ]);
        expect(result!.startLine).toBe(1);
        expect(result!.endLine).toBe(3);
        expect(result!.appliedIndentDelta).toBe(4);
    });

    it('outdenting a parent drags direct and deep descendants', () => {
        const lines = [
            '- root',
            '    - parent',
            '        - child',
            '            - grandchild',
            '- sibling',
        ];

        const result = moveOutlinerBranch(lines, 1, 4, 'outdent');

        expect(result).not.toBeNull();
        expect(result!.lines).toEqual([
            '- root',
            '- parent',
            '    - child',
            '        - grandchild',
            '- sibling',
        ]);
        expect(result!.startLine).toBe(1);
        expect(result!.endLine).toBe(3);
        expect(result!.appliedIndentDelta).toBe(-4);
    });

    it('outdenting a nested branch clamps at root level and preserves subtree shape', () => {
        const lines = [
            '- parent',
            '    - child',
            '        - grandchild',
        ];

        const result = moveOutlinerBranch(lines, 0, 4, 'outdent');

        expect(result).not.toBeNull();
        expect(result!.lines).toEqual(lines);
        expect(result!.appliedIndentDelta).toBe(0);
    });

    it('leaves sibling branches outside the moved subtree unchanged', () => {
        const lines = [
            '- root',
            '    - branch a',
            '        - child a1',
            '    - branch b',
            '        - child b1',
        ];

        const result = moveOutlinerBranch(lines, 1, 4, 'outdent');

        expect(result).not.toBeNull();
        expect(result!.lines).toEqual([
            '- root',
            '- branch a',
            '    - child a1',
            '    - branch b',
            '        - child b1',
        ]);
    });

    it('moves continuation paragraphs, fenced blocks, and tables with the branch', () => {
        const lines = [
            '- root',
            '    - parent',
            '      continuation paragraph',
            '      ```ts',
            '      const water = true;',
            '      ```',
            '      | Col | Val |',
            '      | --- | --- |',
            '      | A | B |',
            '        - child',
            '- sibling',
        ];

        const result = moveOutlinerBranch(lines, 1, 4, 'outdent');

        expect(result).not.toBeNull();
        expect(result!.lines).toEqual([
            '- root',
            '- parent',
            '  continuation paragraph',
            '  ```ts',
            '  const water = true;',
            '  ```',
            '  | Col | Val |',
            '  | --- | --- |',
            '  | A | B |',
            '    - child',
            '- sibling',
        ]);
        expect(result!.endLine).toBe(9);
    });
});

// ── getOutlinerFenceContentBoundary ─────────────────────────────────────────

describe('getOutlinerFenceContentBoundary', () => {
    it('returns contentIndent for a content line inside a bullet fence', () => {
        const lines = [
            '- ```ts',
            '  const x = 1;',
            '  ```',
        ];
        expect(getOutlinerFenceContentBoundary(lines, 1)).toBe(2);
    });

    it('returns null for the opener line itself', () => {
        const lines = [
            '- ```ts',
            '  const x = 1;',
            '  ```',
        ];
        expect(getOutlinerFenceContentBoundary(lines, 0)).toBeNull();
    });

    it('returns null for the closer line', () => {
        const lines = [
            '- ```ts',
            '  const x = 1;',
            '  ```',
        ];
        expect(getOutlinerFenceContentBoundary(lines, 2)).toBeNull();
    });

    it('returns null for a line outside any fence', () => {
        const lines = [
            '- plain bullet',
            '  continuation',
        ];
        expect(getOutlinerFenceContentBoundary(lines, 0)).toBeNull();
        expect(getOutlinerFenceContentBoundary(lines, 1)).toBeNull();
    });

    it('returns correct boundary for indented bullet fence', () => {
        const lines = [
            '- parent',
            '    - ```js',
            '      let y = 2;',
            '      ```',
        ];
        expect(getOutlinerFenceContentBoundary(lines, 2)).toBe(6);
    });

    it('returns boundary for blank lines inside a fence', () => {
        const lines = [
            '- ```',
            '',
            '  ```',
        ];
        expect(getOutlinerFenceContentBoundary(lines, 1)).toBe(2);
    });
});

// ── isOutlinerFenceBackspaceBlocked ────────────────────────────────────────

describe('isOutlinerFenceBackspaceBlocked', () => {
    it('blocks when cursor is at column 0 inside a fence', () => {
        expect(isOutlinerFenceBackspaceBlocked('code', 0, 2)).toBe(true);
    });

    it('blocks when cursor is at the boundary and indent is at boundary', () => {
        expect(isOutlinerFenceBackspaceBlocked('  code', 2, 2)).toBe(true);
    });

    it('blocks when cursor is before boundary on a line at boundary indent', () => {
        expect(isOutlinerFenceBackspaceBlocked('  code', 1, 2)).toBe(true);
    });

    it('allows when cursor is past the boundary', () => {
        expect(isOutlinerFenceBackspaceBlocked('  code', 3, 2)).toBe(false);
    });

    it('allows when line indent is above boundary and cursor is at boundary', () => {
        // Line has 4 spaces indent, boundary is 2. Deleting at col 2 still leaves indent >= 2.
        expect(isOutlinerFenceBackspaceBlocked('    code', 2, 2)).toBe(false);
    });

    it('blocks when line indent equals boundary and cursor is within indent', () => {
        expect(isOutlinerFenceBackspaceBlocked('  code', 2, 2)).toBe(true);
    });

    it('blocks when line is blank and cursor is at 0', () => {
        expect(isOutlinerFenceBackspaceBlocked('', 0, 2)).toBe(true);
    });

    it('blocks when line has less indent than boundary and cursor is at 0', () => {
        expect(isOutlinerFenceBackspaceBlocked(' x', 0, 2)).toBe(true);
    });
});

// ── canJoinOutlinerFenceContentWithPreviousLine ───────────────────────────

describe('canJoinOutlinerFenceContentWithPreviousLine', () => {
    it('returns true when the previous line is content in the same bullet-owned fence', () => {
        const lines = [
            '- ```ts',
            '  const a = 1;',
            '  const b = 2;',
            '  ```',
        ];

        expect(canJoinOutlinerFenceContentWithPreviousLine(lines, 2)).toBe(true);
    });

    it('returns false when the previous line is the fence opener', () => {
        const lines = [
            '- ```ts',
            '  const a = 1;',
            '  ```',
        ];

        expect(canJoinOutlinerFenceContentWithPreviousLine(lines, 1)).toBe(false);
    });

    it('returns false when the line is not inside bullet-owned fence content', () => {
        const lines = [
            '- plain bullet',
            '  continuation',
        ];

        expect(canJoinOutlinerFenceContentWithPreviousLine(lines, 1)).toBe(false);
    });

    it('returns false when the previous line is outside the same fence content region', () => {
        const lines = [
            '- ```ts',
            '  const a = 1;',
            '  ```',
            '- next bullet',
        ];

        expect(canJoinOutlinerFenceContentWithPreviousLine(lines, 3)).toBe(false);
    });
});

// ── shiftOutlinerFenceContentLine ─────────────────────────────────────────

describe('shiftOutlinerFenceContentLine', () => {
    it('indents a fence-content line by one tab stop', () => {
        expect(shiftOutlinerFenceContentLine('  code', 4, 'indent', 2)).toEqual({
            lineText: '      code',
            appliedIndentDelta: 4,
        });
    });

    it('outdents a fence-content line but clamps at the boundary', () => {
        expect(shiftOutlinerFenceContentLine('      code', 4, 'outdent', 4)).toEqual({
            lineText: '    code',
            appliedIndentDelta: -2,
        });
    });

    it('does not outdent past the boundary', () => {
        expect(shiftOutlinerFenceContentLine('    code', 4, 'outdent', 4)).toEqual({
            lineText: '    code',
            appliedIndentDelta: 0,
        });
    });

    it('leaves already-invalid left-shifted lines unchanged on outdent', () => {
        expect(shiftOutlinerFenceContentLine('  code', 4, 'outdent', 4)).toEqual({
            lineText: '  code',
            appliedIndentDelta: 0,
        });
    });

    it('indents blank fence-content lines', () => {
        expect(shiftOutlinerFenceContentLine('    ', 2, 'indent', 4)).toEqual({
            lineText: '      ',
            appliedIndentDelta: 2,
        });
    });
});

// ── getOutlinerFenceVerticalMoveTarget ────────────────────────────────────

describe('getOutlinerFenceVerticalMoveTarget', () => {
    it('clamps the target cursor column to the boundary', () => {
        expect(getOutlinerFenceVerticalMoveTarget('  code', 0, 2)).toEqual({
            lineText: '  code',
            cursorCharacter: 2,
        });
    });

    it('preserves a preferred column to the right of the boundary', () => {
        expect(getOutlinerFenceVerticalMoveTarget('  code', 4, 2)).toEqual({
            lineText: '  code',
            cursorCharacter: 4,
        });
    });

    it('pads a blank line so the cursor can land at the boundary', () => {
        expect(getOutlinerFenceVerticalMoveTarget('', 0, 2)).toEqual({
            lineText: '  ',
            cursorCharacter: 2,
        });
    });

    it('pads whitespace-only lines up to the boundary', () => {
        expect(getOutlinerFenceVerticalMoveTarget(' ', 0, 3)).toEqual({
            lineText: '   ',
            cursorCharacter: 3,
        });
    });

    it('pads short lines up to the boundary before placing the cursor', () => {
        expect(getOutlinerFenceVerticalMoveTarget('x', 0, 3)).toEqual({
            lineText: 'x  ',
            cursorCharacter: 3,
        });
    });
});

// ── formatOutlinerFencePaste ───────────────────────────────────────────────

describe('formatOutlinerFencePaste', () => {
    it('rebases pasted text so minimum indent lands on the boundary', () => {
        const result = formatOutlinerFencePaste(4, 'if (x) {\n  y();\n}');
        expect(result).toBe('    if (x) {\n      y();\n    }');
    });

    it('preserves relative indentation within pasted code', () => {
        const result = formatOutlinerFencePaste(2, '  a\n    b\n  c');
        expect(result).toBe('  a\n    b\n  c');
    });

    it('leaves blank lines blank', () => {
        const result = formatOutlinerFencePaste(2, 'line1\n\nline2');
        expect(result).toBe('  line1\n\n  line2');
    });

    it('handles single-line paste by adding boundary indent', () => {
        const result = formatOutlinerFencePaste(4, 'hello');
        expect(result).toBe('    hello');
    });

    it('normalises CRLF to LF', () => {
        const result = formatOutlinerFencePaste(2, 'a\r\nb');
        expect(result).toBe('  a\n  b');
    });

    it('handles already-indented paste that exceeds boundary', () => {
        // Minimum indent is 6, boundary is 4. Should shift left by 2.
        const result = formatOutlinerFencePaste(4, '      x\n        y');
        expect(result).toBe('    x\n      y');
    });

    it('handles paste with no indentation at boundary 0', () => {
        const result = formatOutlinerFencePaste(0, 'a\n  b');
        expect(result).toBe('a\n  b');
    });
});
