/**
 * Pure-logic service for Outliner Mode.
 *
 * Outliner mode turns a markdown editor into a bullet-first outliner:
 * - Enter on a bullet line inserts a new bullet at the same indentation.
 * - Enter on a todo line (`- [ ]` / `- [x]`) inserts a new unchecked todo.
 * - Tab / Shift+Tab indent and outdent bullet lines.
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
