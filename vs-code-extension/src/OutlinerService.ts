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

/**
 * Matches a bullet line whose content ends with an opening code fence:
 * optional indent, `- `, optional text, triple backticks, optional language, optional trailing whitespace.
 */
const CODE_FENCE_OPEN = /^(\s*)- .*```(\w*)\s*$/;

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

// ── Code fence detection ───────────────────────────────────────────────────

/**
 * Returns `true` when the bullet line ends with an opening code fence
 * (triple backticks, optionally followed by a language identifier).
 *
 * Examples that match: `- \`\`\``, `- \`\`\`javascript`, `    - [ ] \`\`\`ts`
 */
export function isCodeFenceOpen(lineText: string): boolean {
    return CODE_FENCE_OPEN.test(lineText);
}

/**
 * Returns the text to insert when Enter is pressed on a bullet line that ends
 * with an opening code fence.
 *
 * Inserts a blank line (for the cursor) and a closing fence, both indented
 * 2 spaces past the bullet's `- ` (matching standard markdown list continuation
 * indent). The 2-space offset is hardcoded by design — see TECHNICAL.md.
 *
 * Example: `    - \`\`\`javascript` → `\n      \n      \`\`\``
 * (4 spaces indent + 2 spaces past hyphen = 6 spaces for continuation content)
 */
export function getCodeFenceEnterInsert(lineText: string): string {
    const match = lineText.match(BULLET_INDENT);
    const bulletIndent = match?.[1] ?? '';
    // Content inside a list item is indented 2 spaces past the `- ` marker
    const contentIndent = bulletIndent + '  ';
    return `\n${contentIndent}\n${contentIndent}\`\`\``;
}

// ── Standalone (non-bullet) code fence detection ───────────────────────────

/**
 * Matches a non-bullet line that is an opening code fence:
 * optional indent, triple backticks, optional language, optional trailing whitespace.
 * Bullet lines are excluded — use `isCodeFenceOpen` for those.
 */
const STANDALONE_CODE_FENCE_OPEN = /^(\s*)```(\w*)\s*$/;

/**
 * Returns `true` when the line is a standalone (non-bullet) opening code fence.
 * Does NOT match bullet lines — use `isCodeFenceOpen` for `- \`\`\`` lines.
 */
export function isStandaloneCodeFenceOpen(lineText: string): boolean {
    return STANDALONE_CODE_FENCE_OPEN.test(lineText) && !BULLET_LINE.test(lineText);
}

/**
 * Returns the text to insert when Enter is pressed on a standalone opening
 * code fence line. Inserts a blank line (for the cursor) and a closing fence,
 * both at the same indentation as the opening fence.
 *
 * Example: `    \`\`\`javascript` → `\n    \n    \`\`\``
 */
export function getStandaloneCodeFenceEnterInsert(lineText: string): string {
    const match = lineText.match(STANDALONE_CODE_FENCE_OPEN);
    const indent = match?.[1] ?? '';
    return `\n${indent}\n${indent}\`\`\``;
}

// ── Closing code fence detection ───────────────────────────────────────────

/**
 * Matches a closing code fence: optional indent, triple backticks, optional
 * trailing whitespace, and nothing else (no language identifier, no bullet).
 */
const CLOSING_CODE_FENCE = /^(\s*)```\s*$/;

/**
 * Returns `true` when the line is a closing code fence (no language identifier).
 * Excludes bullet lines.
 */
export function isClosingCodeFenceLine(lineText: string): boolean {
    return CLOSING_CODE_FENCE.test(lineText) && !BULLET_LINE.test(lineText);
}

/**
 * When Enter is pressed on a closing code fence line, scans upward to find the
 * matching opening fence. If that opening fence is on a bullet line, returns
 * the text to insert a new bullet at the same indentation as the parent bullet.
 *
 * Returns `null` when the closing fence is not inside a bullet code block
 * (i.e. the opening fence was standalone or not found).
 */
export function getClosingFenceBulletInsert(lines: string[], lineIndex: number): string | null {
    // Scan upward from the closing fence to find the matching opening fence
    for (let i = lineIndex - 1; i >= 0; i--) {
        const line = lines[i];
        // Found a bullet-prefixed opening fence
        if (CODE_FENCE_OPEN.test(line)) {
            // Use the bullet's indent to produce the new bullet
            const indentMatch = line.match(BULLET_INDENT);
            const indent = indentMatch?.[1] ?? '';
            const isTodo = TODO_LINE.test(line);
            if (isTodo) {
                return `\n${indent}- [ ] `;
            }
            return `\n${indent}- `;
        }
        // Found a standalone opening fence — not a bullet code block
        if (STANDALONE_CODE_FENCE_OPEN.test(line)) {
            return null;
        }
    }
    // No opening fence found
    return null;
}

// ── Code fence balance detection ───────────────────────────────────────────

/**
 * Pattern matching any standalone fence line (opening or closing):
 * optional indent, triple backticks, optional language, optional trailing whitespace.
 */
const ANY_STANDALONE_FENCE = /^(\s*)```\w*\s*$/;

/**
 * Returns `true` when the fence at `lineIndex` is unbalanced — i.e. it needs
 * a closing fence to be inserted.
 *
 * Uses a two-phase approach:
 *
 * 1. **Language-aware matching** (precise).  Language fences (e.g. ` ```js `)
 *    are unambiguously openers.  Walking bottom-to-top, each bare closer is
 *    pushed onto a stack; each language opener pops the nearest closer to form
 *    a pair.  If the target participates in a pair it is balanced.  If it is a
 *    language fence that found no closer it is unbalanced.
 *
 * 2. **Surrounding-balanced heuristic** (for bare fences only).  Count
 *    standalone fences at the same indent before and after the target.  When
 *    both counts are even the surrounding context is balanced and the target is
 *    the odd one out (unbalanced).
 *
 * Only standalone fences participate (bullet-prefixed fences are excluded).
 * Returns `false` for non-fence lines.
 */
export function isCodeFenceUnbalanced(lines: string[], lineIndex: number): boolean {
    const targetLine = lines[lineIndex];
    if (!targetLine || !ANY_STANDALONE_FENCE.test(targetLine) || BULLET_LINE.test(targetLine)) {
        return false;
    }

    const indentMatch = targetLine.match(/^(\s*)/);
    const targetIndent = indentMatch ? indentMatch[1].length : 0;

    // Phase 1: Match language openers with bare closers via bottom-up stack.
    const closerStack: number[] = [];
    const matched = new Set<number>();

    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!ANY_STANDALONE_FENCE.test(line) || BULLET_LINE.test(line)) { continue; }
        const im = line.match(/^(\s*)/);
        const indent = im ? im[1].length : 0;
        if (indent !== targetIndent) { continue; }

        if (CLOSING_CODE_FENCE.test(line)) {
            // Bare fence → potential closer
            closerStack.push(i);
        } else {
            // Has language → opener → pair with nearest available closer
            if (closerStack.length > 0) {
                const closer = closerStack.pop()!;
                matched.add(i);
                matched.add(closer);
            }
        }
    }

    // If the target was matched in phase 1, it is balanced.
    if (matched.has(lineIndex)) {
        return false;
    }

    // Unmatched language fence → no closer exists → unbalanced.
    if (!CLOSING_CODE_FENCE.test(targetLine)) {
        return true;
    }

    // Phase 2: Bare unmatched fence → surrounding-balanced heuristic.
    let beforeCount = 0;
    let afterCount = 0;
    for (let i = 0; i < lines.length; i++) {
        if (i === lineIndex) { continue; }
        const line = lines[i];
        if (ANY_STANDALONE_FENCE.test(line) && !BULLET_LINE.test(line)) {
            const im = line.match(/^(\s*)/);
            const indent = im ? im[1].length : 0;
            if (indent === targetIndent) {
                if (i < lineIndex) { beforeCount++; }
                else { afterCount++; }
            }
        }
    }

    return beforeCount % 2 === 0 && afterCount % 2 === 0;
}

// ── Indent guard ───────────────────────────────────────────────────────────

/**
 * Returns the maximum indentation (in spaces) allowed for the bullet at
 * `lineIndex`.  A bullet may be at most one tab stop deeper than the nearest
 * bullet line above it.  If no bullet exists above, only indent 0 is allowed.
 */
export function getMaxOutlinerIndent(
    lines: string[],
    lineIndex: number,
    tabSize: number,
): number {
    for (let i = lineIndex - 1; i >= 0; i--) {
        if (BULLET_LINE.test(lines[i])) {
            const match = lines[i].match(BULLET_INDENT);
            const indent = match?.[1]?.length ?? 0;
            return indent + tabSize;
        }
    }
    // No bullet above — root level only
    return 0;
}

// ── Paste formatting ───────────────────────────────────────────────────────

/** Result of formatting a multi-line paste for outliner mode. */
export interface OutlinerPasteResult {
    /** The full replacement text for the entire line (including bullet prefix). */
    text: string;
    /** The character offset on the line from which to start the replacement (always 0 — replaces the whole line). */
    replaceFromChar: number;
}

/**
 * Formats multi-line clipboard text for pasting onto a bullet line in outliner
 * mode. Each non-empty pasted line becomes a separate bullet at the same
 * indentation level.
 *
 * Returns `null` when no outliner conversion is needed:
 * - Single-line clipboard text (no newlines)
 * - All pasted lines are empty/whitespace-only
 *
 * @param lineText       The full text of the current line.
 * @param cursorCharacter  The 0-based character offset of the cursor on the line.
 * @param clipboardText  The raw clipboard text being pasted.
 */
export function formatOutlinerPaste(
    lineText: string,
    cursorCharacter: number,
    clipboardText: string,
): OutlinerPasteResult | null {
    // Normalise CRLF → LF
    const normalised = clipboardText.replace(/\r\n/g, '\n');
    const lines = normalised.split('\n');

    // Single-line paste: no conversion
    if (lines.length <= 1) { return null; }

    // Filter out empty/whitespace-only lines and trim each line
    const trimmedLines = lines.map(l => l.trim()).filter(l => l.length > 0);
    if (trimmedLines.length === 0) { return null; }

    // Determine the bullet prefix and indentation from the current line
    const indentMatch = lineText.match(BULLET_INDENT);
    const indent = indentMatch?.[1] ?? '';

    // Determine line type: done todo, unchecked todo, or plain bullet
    const isDone = DONE_TODO.test(lineText);
    const isTodo = TODO_LINE.test(lineText);

    // Build the prefix for the first line (keeps original type) and subsequent lines
    let firstPrefix: string;
    let restPrefix: string;

    if (isDone) {
        firstPrefix = `${indent}- [x] `;
        restPrefix = `${indent}- [ ] `;
    } else if (isTodo) {
        firstPrefix = `${indent}- [ ] `;
        restPrefix = `${indent}- [ ] `;
    } else {
        firstPrefix = `${indent}- `;
        restPrefix = `${indent}- `;
    }

    // Text before and after cursor on the current line (content only, not bullet prefix)
    const textBeforeCursor = lineText.slice(0, cursorCharacter);
    const textAfterCursor = lineText.slice(cursorCharacter);

    // Strip the bullet prefix from textBeforeCursor to get just the user content
    // We rebuild the line with the correct prefix + content
    const prefixMatch = textBeforeCursor.match(/^(\s*- (?:\[[ xX]\] )?)/);
    const existingPrefix = prefixMatch?.[0] ?? '';
    const contentBeforeCursor = textBeforeCursor.slice(existingPrefix.length);

    // Strip the existing bullet prefix from textAfterCursor if cursor was before content
    // textAfterCursor is raw from cursorCharacter onwards — no stripping needed

    // Build result lines
    const resultLines: string[] = [];

    // First pasted line merges with content before cursor
    resultLines.push(firstPrefix + contentBeforeCursor + trimmedLines[0]);

    // Middle lines get their own bullets
    for (let i = 1; i < trimmedLines.length - 1; i++) {
        resultLines.push(restPrefix + trimmedLines[i]);
    }

    // Last pasted line gets text after cursor appended
    if (trimmedLines.length > 1) {
        resultLines.push(restPrefix + trimmedLines[trimmedLines.length - 1] + textAfterCursor);
    }

    return {
        text: resultLines.join('\n'),
        replaceFromChar: 0,
    };
}
