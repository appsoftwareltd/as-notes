/**
 * Pure-logic service for toggling markdown todo checkboxes.
 *
 * Three-state cycle per line:
 *   1. Done todo  (`- [x] ...` or `- [X] ...`)  →  plain text (strip prefix)
 *   2. Unchecked  (`- [ ] ...`)                  →  done (`- [x] ...`)
 *   3. List item  (`- ...` or `* ...` w/o checkbox) →  unchecked (insert `[ ] ` after bullet)
 *   4. Plain text                                 →  unchecked (`- [ ] text`)
 *
 * Indentation (leading whitespace) is always preserved.
 * No VS Code dependencies — fully unit-testable.
 */

// ── Patterns ───────────────────────────────────────────────────────────────

/** Matches a done todo: optional indent, `-` or `*`, `[x]` or `[X]`, then content. */
const DONE_TODO = /^(\s*)([-*])\s+\[(?:x|X)\]\s?(.*)/;

/** Matches an unchecked todo: optional indent, `-` or `*`, `[ ]`, then content. */
const UNCHECKED_TODO = /^(\s*)([-*])\s+\[ \]\s?(.*)/;

/** Matches a plain list item (bullet only, no checkbox): optional indent, `-` or `*`, then content. */
const LIST_ITEM = /^(\s*)([-*])\s+(.*)/;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Toggle a single line through the three-state todo cycle.
 *
 * @param lineText  The full text of the line (no trailing newline expected).
 * @returns         The toggled line text.
 */
export function toggleTodoLine(lineText: string): string {
    // 1. Done → plain text (strip bullet + checkbox)
    const doneMatch = lineText.match(DONE_TODO);
    if (doneMatch) {
        const [, indent, , rest] = doneMatch;
        return `${indent}${rest}`;
    }

    // 2. Unchecked → done
    const uncheckedMatch = lineText.match(UNCHECKED_TODO);
    if (uncheckedMatch) {
        const [, indent, bullet, rest] = uncheckedMatch;
        return `${indent}${bullet} [x] ${rest}`;
    }

    // 3. List item (no checkbox) → unchecked todo
    const listMatch = lineText.match(LIST_ITEM);
    if (listMatch) {
        const [, indent, bullet, rest] = listMatch;
        return `${indent}${bullet} [ ] ${rest}`;
    }

    // 4. Plain text (or empty / whitespace-only) → unchecked todo
    const indentMatch = lineText.match(/^(\s*)(.*)/);
    const indent = indentMatch?.[1] ?? '';
    const rest = indentMatch?.[2] ?? '';
    return `${indent}- [ ] ${rest}`;
}
