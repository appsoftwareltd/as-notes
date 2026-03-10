/**
 * Pure-logic service for Outliner Mode.
 *
 * Outliner mode turns a markdown editor into a bullet-first outliner:
 * - Enter on a bullet line inserts a new bullet at the same indentation.
 * - Enter on a todo line (`- [ ]` / `- [x]`) inserts a new unchecked todo.
 * - Tab / Shift+Tab indent and outdent bullet lines.
 * - Todo toggle (Ctrl+Shift+Enter) cycles: plain bullet → unchecked → done → plain bullet.
 *
 * No VS Code dependencies — fully unit-testable.
 */

// ── Patterns ───────────────────────────────────────────────────────────────

/** Matches any bullet line: optional indent, `- `, then anything. */
const BULLET_LINE = /^\s*- /;

/** Matches a todo checkbox line (checked or unchecked): optional indent, `- [ ] ` or `- [x] `. */
const TODO_LINE = /^(\s*)- \[[ xX]\] /;

/** Captures the leading indentation of a bullet line. */
const BULLET_INDENT = /^(\s*)- /;

/** Matches a done todo: optional indent, `- [x]` or `- [X]`, then content. */
const DONE_TODO = /^(\s*)- \[(?:x|X)\] ?(.*)/;

/** Matches an unchecked todo: optional indent, `- [ ]`, then content. */
const UNCHECKED_TODO = /^(\s*)- \[ \] ?(.*)/;

/** Matches a plain bullet (no checkbox): optional indent, `- `, then content. */
const PLAIN_BULLET = /^(\s*)- (.*)/;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns `true` when the cursor is on a line that the outliner should handle:
 * any line that starts with optional whitespace followed by `- `.
 *
 * Note: `* ` bullets are intentionally excluded — only `-` is supported.
 */
export function isOnBulletLine(lineText: string): boolean {
    return BULLET_LINE.test(lineText);
}

/**
 * Returns the text to insert at the cursor position when Enter is pressed in
 * outliner mode.
 *
 * - Todo lines (`- [ ] ...` or `- [x] ...`) → `\n{indent}- [ ] `
 * - Plain bullet lines (`- ...`) → `\n{indent}- `
 *
 * The returned string is always prefixed with `\n` so that inserting it at the
 * cursor in VS Code naturally splits the current line and positions the new
 * bullet below.
 */
export function getOutlinerEnterInsert(lineText: string): string {
    const indentMatch = lineText.match(BULLET_INDENT);
    const indent = indentMatch?.[1] ?? '';

    if (TODO_LINE.test(lineText)) {
        return `\n${indent}- [ ] `;
    }

    return `\n${indent}- `;
}

/**
 * Toggle a bullet line through the outliner-specific 3-state todo cycle:
 *
 *   1. Done todo  (`- [x]` / `- [X]`)  →  plain bullet (`- text`)
 *   2. Unchecked  (`- [ ] ...`)         →  done (`- [x] ...`)
 *   3. Plain bullet (`- ...`)           →  unchecked (`- [ ] ...`)
 *
 * This differs from the default `toggleTodoLine` cycle only at step 1:
 * in outliner mode a done todo becomes a plain bullet rather than plain text,
 * so the `- ` prefix is always preserved.
 *
 * Only call this when `isOnBulletLine` is true.
 */
export function toggleOutlinerTodoLine(lineText: string): string {
    // 1. Done → plain bullet
    const doneMatch = lineText.match(DONE_TODO);
    if (doneMatch) {
        const [, indent, rest] = doneMatch;
        return `${indent}- ${rest}`;
    }

    // 2. Unchecked → done
    const uncheckedMatch = lineText.match(UNCHECKED_TODO);
    if (uncheckedMatch) {
        const [, indent, rest] = uncheckedMatch;
        return `${indent}- [x] ${rest}`;
    }

    // 3. Plain bullet → unchecked todo
    const plainMatch = lineText.match(PLAIN_BULLET);
    if (plainMatch) {
        const [, indent, rest] = plainMatch;
        return `${indent}- [ ] ${rest}`;
    }

    // Fallback: return unchanged (should not be reached if isOnBulletLine was checked)
    return lineText;
}
