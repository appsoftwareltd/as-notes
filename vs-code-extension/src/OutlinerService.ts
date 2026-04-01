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

/** Captures leading whitespace for any line. */
const LEADING_WHITESPACE = /^(\s*)/;

/** Matches a done todo: optional indent, `- [x]` or `- [X]`, then content. */
const DONE_TODO = /^(\s*)- \[(?:x|X)\] ?(.*)/;

/** Matches an unchecked todo: optional indent, `- [ ]`, then content. */
const UNCHECKED_TODO = /^(\s*)- \[ \] ?(.*)/;

/** Matches a plain bullet (no checkbox): optional indent, `- `, then content. */
const PLAIN_BULLET = /^(\s*)- (.*)/;

/** Matches an empty plain bullet shell, with or without the trailing space. */
const EMPTY_PLAIN_BULLET = /^(\s*)-(?: )?$/;

/** Matches an empty todo bullet shell, with or without the trailing space. */
const EMPTY_TODO_BULLET = /^(\s*)- \[[ xX]\](?: )?$/;

/**
 * Matches a bullet line whose content ends with an opening code fence:
 * optional indent, `- `, optional text, triple backticks, optional language, optional trailing whitespace.
 */
const CODE_FENCE_OPEN = /^(\s*)- .*```(\w*)\s*$/;

export type FenceTokenCursorZone = 'before' | 'inside' | 'after' | 'none';

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
export function getOutlinerEnterInsert(lineText: string, indentOverride?: string): string {
    const indentMatch = lineText.match(BULLET_INDENT);
    const indent = indentOverride ?? indentMatch?.[1] ?? '';

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

export function isOutlinerBackspaceMergeCandidate(
    lineText: string,
    cursorCharacter: number,
): boolean {
    if (EMPTY_PLAIN_BULLET.test(lineText) || EMPTY_TODO_BULLET.test(lineText)) {
        return cursorCharacter === lineText.length;
    }

    return false;
}

export function getOutlinerBackspaceTargetLine(
    lines: string[],
    lineIndex: number,
): number | null {
    // Strip trailing \r so regexes anchored with $ work on \r\n line endings.
    const lineText = lines[lineIndex]?.replace(/\r$/, '');
    if (!lineText || !isOutlinerBackspaceMergeCandidate(lineText, lineText.length)) {
        return null;
    }

    const currentIndent = getLineIndent(lineText);
    for (let i = lineIndex - 1; i >= 0; i--) {
        const candidate = lines[i];
        if (!candidate || !BULLET_LINE.test(candidate)) {
            continue;
        }

        if (getLineIndent(candidate) <= currentIndent) {
            return i;
        }
    }

    return null;
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

export function getFenceTokenCursorZone(
    lineText: string,
    cursorCharacter: number,
): FenceTokenCursorZone {
    const fenceStart = lineText.indexOf('```');
    if (fenceStart === -1) {
        return 'none';
    }

    if (cursorCharacter <= fenceStart) {
        return 'before';
    }

    if (cursorCharacter < fenceStart + 3) {
        return 'inside';
    }

    return 'after';
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
    const contentIndent = getBulletContentIndent(lineText);
    return `\n${contentIndent}\n${contentIndent}\`\`\``;
}

export interface BulletCodeFenceContext {
    readonly openerLine: number;
    readonly rootIndent: number;
    readonly contentIndent: number;
    readonly isTodo: boolean;
}

function getBulletContentIndent(lineText: string): string {
    const match = lineText.match(BULLET_INDENT);
    const bulletIndent = match?.[1] ?? '';
    return bulletIndent + '  ';
}

function getBulletInsertFromContext(context: BulletCodeFenceContext): string {
    const indent = ' '.repeat(context.rootIndent);
    return context.isTodo ? `\n${indent}- [ ] ` : `\n${indent}- `;
}

function hasClosingFenceForBulletCodeFence(lines: string[], openerLineIndex: number): boolean {
    const openerLine = lines[openerLineIndex];
    if (!openerLine || !CODE_FENCE_OPEN.test(openerLine)) {
        return false;
    }

    const rootIndent = getLineIndent(openerLine);
    const continuationIndent = rootIndent + 2;

    for (let i = openerLineIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        const indent = getLineIndent(line);

        if (isClosingCodeFenceLine(line) && indent >= continuationIndent) {
            return true;
        }

        if (BULLET_LINE.test(line) && indent <= rootIndent) {
            return false;
        }

        if (!BULLET_LINE.test(line) && !isBlankLine(line) && indent < continuationIndent) {
            return false;
        }
    }

    return false;
}

export function getBulletCodeFenceContext(
    lines: string[],
    lineIndex: number,
): BulletCodeFenceContext | null {
    if (lineIndex < 0 || lineIndex >= lines.length) {
        return null;
    }

    let activeContext: BulletCodeFenceContext | null = null;
    let contextAtLine: BulletCodeFenceContext | null = null;

    for (let i = 0; i <= lineIndex; i++) {
        const line = lines[i];

        if (!activeContext && CODE_FENCE_OPEN.test(line)) {
            const rootIndent = getLineIndent(line);
            activeContext = {
                openerLine: i,
                rootIndent,
                contentIndent: rootIndent + 2,
                isTodo: TODO_LINE.test(line),
            };
        }

        if (i === lineIndex) {
            contextAtLine = activeContext;
        }

        if (
            activeContext
            && i !== activeContext.openerLine
            && isClosingCodeFenceLine(line)
            && getLineIndent(line) >= activeContext.contentIndent
        ) {
            activeContext = null;
        }
    }

    return contextAtLine;
}

export function isInsideBulletCodeFence(lines: string[], lineIndex: number): boolean {
    return getBulletCodeFenceContext(lines, lineIndex) !== null;
}

export function getBulletCodeFenceEnterInsert(
    lines: string[],
    lineIndex: number,
    cursorCharacter?: number,
): string | null {
    const lineText = lines[lineIndex];
    if (!lineText || !CODE_FENCE_OPEN.test(lineText)) {
        return null;
    }

    if (cursorCharacter !== undefined) {
        const fenceStart = lineText.indexOf('```');
        if (fenceStart !== -1 && cursorCharacter < fenceStart) {
            return null;
        }
    }

    const contentIndent = getBulletContentIndent(lineText);
    if (hasClosingFenceForBulletCodeFence(lines, lineIndex)) {
        return `\n${contentIndent}`;
    }

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
    if (!isClosingCodeFenceLine(lines[lineIndex] ?? '')) {
        return null;
    }

    const context = getBulletCodeFenceContext(lines, lineIndex);
    if (!context) {
        return null;
    }

    return getBulletInsertFromContext(context);
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

    if (getBulletCodeFenceContext(lines, lineIndex) !== null) {
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
        if (getBulletCodeFenceContext(lines, i) !== null) { continue; }
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
            if (getBulletCodeFenceContext(lines, i) !== null) { continue; }
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

export interface OutlinerBranchRange {
    readonly startLine: number;
    readonly endLine: number;
    readonly rootIndent: number;
}

export interface OutlinerBranchMoveResult extends OutlinerBranchRange {
    readonly lines: string[];
    readonly appliedIndentDelta: number;
}

function isBlankLine(lineText: string): boolean {
    return lineText.trim().length === 0;
}

function getLineIndent(lineText: string): number {
    return lineText.match(LEADING_WHITESPACE)?.[1]?.length ?? 0;
}

function shiftLineIndent(lineText: string, delta: number): string {
    if (delta === 0) {
        return lineText;
    }
    const currentIndent = getLineIndent(lineText);
    const nextIndent = Math.max(0, currentIndent + delta);
    return `${' '.repeat(nextIndent)}${lineText.slice(currentIndent)}`;
}

/**
 * Returns the contiguous line range belonging to the bullet branch rooted at
 * `lineIndex`, including descendant bullets and non-bullet continuation lines.
 */
export function getOutlinerBranchRange(
    lines: string[],
    lineIndex: number,
): OutlinerBranchRange | null {
    const rootLine = lines[lineIndex];
    if (!rootLine || !BULLET_LINE.test(rootLine)) {
        return null;
    }

    const rootIndent = getLineIndent(rootLine);
    const continuationIndent = rootIndent + 2;
    let endLine = lineIndex;
    let pendingBlankStart: number | null = null;
    let insideFence = false;

    for (let i = lineIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        const indent = getLineIndent(line);

        if (insideFence) {
            endLine = i;
            if (ANY_STANDALONE_FENCE.test(line) && !BULLET_LINE.test(line)) {
                insideFence = false;
            }
            continue;
        }

        if (isBlankLine(line)) {
            if (pendingBlankStart === null) {
                pendingBlankStart = i;
            }
            continue;
        }

        let belongsToBranch = false;

        if (BULLET_LINE.test(line)) {
            belongsToBranch = indent > rootIndent;
        } else {
            belongsToBranch = indent >= continuationIndent;
        }

        if (!belongsToBranch) {
            break;
        }

        endLine = i;
        if (pendingBlankStart !== null) {
            endLine = i;
            pendingBlankStart = null;
        }

        if (ANY_STANDALONE_FENCE.test(line) && !BULLET_LINE.test(line)) {
            insideFence = true;
        }
    }

    return {
        startLine: lineIndex,
        endLine,
        rootIndent,
    };
}

export function getOutlinerFirstChildLine(
    lines: string[],
    lineIndex: number,
): number | null {
    const range = getOutlinerBranchRange(lines, lineIndex);
    if (!range) {
        return null;
    }

    for (let i = lineIndex + 1; i <= range.endLine; i++) {
        const line = lines[i];
        if (BULLET_LINE.test(line) && getLineIndent(line) > range.rootIndent) {
            return i;
        }
    }

    return null;
}

export function getOwningOutlinerBranchLine(
    lines: string[],
    lineIndex: number,
): number | null {
    const currentLine = lines[lineIndex];
    if (currentLine === undefined) {
        return null;
    }

    if (BULLET_LINE.test(currentLine)) {
        return lineIndex;
    }

    for (let i = lineIndex - 1; i >= 0; i--) {
        if (!BULLET_LINE.test(lines[i])) {
            continue;
        }
        const range = getOutlinerBranchRange(lines, i);
        if (range && lineIndex >= range.startLine && lineIndex <= range.endLine) {
            return i;
        }
    }

    return null;
}

export function getOutlinerBranchActionLine(
    lines: string[],
    lineIndex: number,
): number | null {
    const rootLine = getOwningOutlinerBranchLine(lines, lineIndex);
    if (rootLine === null) {
        return null;
    }

    const currentLine = lines[lineIndex] ?? '';
    if (BULLET_LINE.test(currentLine)) {
        return rootLine;
    }

    const fenceContext = getBulletCodeFenceContext(lines, lineIndex);
    if (!fenceContext) {
        let insideStandaloneFence = false;
        for (let i = rootLine + 1; i <= lineIndex; i++) {
            const line = lines[i] ?? '';
            if (ANY_STANDALONE_FENCE.test(line) && !BULLET_LINE.test(line)) {
                if (i === lineIndex) {
                    return rootLine;
                }
                insideStandaloneFence = !insideStandaloneFence;
                continue;
            }
        }
        return insideStandaloneFence ? null : rootLine;
    }

    if (lineIndex === fenceContext.openerLine) {
        return rootLine;
    }

    if (isClosingCodeFenceLine(currentLine) && getLineIndent(currentLine) >= fenceContext.contentIndent) {
        return rootLine;
    }

    return null;
}

/**
 * Returns true when the selected bullet branch root may be indented one tab
 * stop deeper without violating the one-level-deeper guard.
 */
export function canIndentOutlinerBranch(
    lines: string[],
    lineIndex: number,
    tabSize: number,
): boolean {
    const range = getOutlinerBranchRange(lines, lineIndex);
    if (!range) {
        return false;
    }
    return range.rootIndent + tabSize <= getMaxOutlinerIndent(lines, lineIndex, tabSize);
}

/**
 * Move a bullet branch by one tab stop, preserving the relative indentation of
 * all descendants and continuation lines within the branch.
 */
export function moveOutlinerBranch(
    lines: string[],
    lineIndex: number,
    tabSize: number,
    direction: 'indent' | 'outdent',
): OutlinerBranchMoveResult | null {
    const range = getOutlinerBranchRange(lines, lineIndex);
    if (!range) {
        return null;
    }

    const appliedIndentDelta = direction === 'indent'
        ? (canIndentOutlinerBranch(lines, lineIndex, tabSize) ? tabSize : 0)
        : (range.rootIndent === 0 ? 0 : -Math.min(tabSize, range.rootIndent));

    const updatedLines = lines.slice();
    for (let i = range.startLine; i <= range.endLine; i++) {
        updatedLines[i] = shiftLineIndent(updatedLines[i], appliedIndentDelta);
    }

    return {
        ...range,
        lines: updatedLines,
        appliedIndentDelta,
    };
}

// ── Fence content boundary guard ───────────────────────────────────────────

/**
 * Returns the minimum indent column (content boundary) for a content line
 * inside a bullet-owned fenced code block.
 *
 * Returns `null` when:
 * - the line is not inside a bullet fence
 * - the line is the opener line (bullet + ```) or the closer line (```)
 */
export function getOutlinerFenceContentBoundary(
    lines: string[],
    lineIndex: number,
): number | null {
    const ctx = getBulletCodeFenceContext(lines, lineIndex);
    if (!ctx) {
        return null;
    }

    // Opener line is not a content line
    if (lineIndex === ctx.openerLine) {
        return null;
    }

    // Closer line is not a content line
    const line = lines[lineIndex];
    if (
        isClosingCodeFenceLine(line)
        && getLineIndent(line) >= ctx.contentIndent
    ) {
        return null;
    }

    return ctx.contentIndent;
}

/**
 * Returns `true` when Backspace should be blocked to prevent content from
 * moving left of the fence content boundary.
 *
 * The guard blocks when:
 * - cursor is at column 0 (prevents line-join escape from the fence)
 * - cursor is at or before the boundary AND the line's existing indent
 *   is at or below the boundary (deleting would breach the boundary)
 *
 * The guard allows when:
 * - cursor is past the boundary (normal content editing)
 * - line indent exceeds the boundary and cursor is within the excess indent
 *   (deleting still leaves indent >= boundary)
 */
export function isOutlinerFenceBackspaceBlocked(
    lineText: string,
    cursorCharacter: number,
    contentBoundary: number,
): boolean {
    // Cursor past the boundary — always allow
    if (cursorCharacter > contentBoundary) {
        return false;
    }

    // Cursor at column 0 — always block (prevents line join / escape)
    if (cursorCharacter === 0) {
        return true;
    }

    // Cursor is at or before the boundary.
    // Allow only when the line's indent exceeds the boundary
    // (so deleting one space still keeps indent >= boundary).
    const lineIndent = getLineIndent(lineText);
    return lineIndent <= contentBoundary;
}

export function canJoinOutlinerFenceContentWithPreviousLine(
    lines: string[],
    lineIndex: number,
): boolean {
    if (lineIndex <= 0) {
        return false;
    }

    const currentContext = getBulletCodeFenceContext(lines, lineIndex);
    const previousContext = getBulletCodeFenceContext(lines, lineIndex - 1);
    if (!currentContext || !previousContext) {
        return false;
    }

    const currentBoundary = getOutlinerFenceContentBoundary(lines, lineIndex);
    const previousBoundary = getOutlinerFenceContentBoundary(lines, lineIndex - 1);
    if (currentBoundary === null || previousBoundary === null) {
        return false;
    }

    return currentContext.openerLine === previousContext.openerLine;
}

export interface OutlinerFenceContentShiftResult {
    lineText: string;
    appliedIndentDelta: number;
}

export function shiftOutlinerFenceContentLine(
    lineText: string,
    tabSize: number,
    direction: 'indent' | 'outdent',
    contentBoundary: number,
): OutlinerFenceContentShiftResult {
    const currentIndent = getLineIndent(lineText);
    const appliedIndentDelta = direction === 'indent'
        ? tabSize
        : (currentIndent <= contentBoundary
            ? 0
            : Math.max(contentBoundary, currentIndent - tabSize) - currentIndent);

    return {
        lineText: shiftLineIndent(lineText, appliedIndentDelta),
        appliedIndentDelta,
    };
}

export interface OutlinerFenceVerticalMoveTarget {
    lineText: string;
    cursorCharacter: number;
}

export function getOutlinerFenceVerticalMoveTarget(
    lineText: string,
    preferredCharacter: number,
    contentBoundary: number,
): OutlinerFenceVerticalMoveTarget {
    const paddedLineText = lineText.length < contentBoundary
        ? `${lineText}${' '.repeat(contentBoundary - lineText.length)}`
        : lineText;

    return {
        lineText: paddedLineText,
        cursorCharacter: Math.max(contentBoundary, Math.min(preferredCharacter, paddedLineText.length)),
    };
}

/**
 * Transforms clipboard text for pasting inside a bullet-owned fenced code
 * block, rebasing indentation so the minimum non-blank indent lands on the
 * content boundary while preserving relative indentation.
 *
 * - CRLF is normalised to LF.
 * - Blank lines remain blank.
 * - The minimum indent of non-blank lines is shifted to `contentBoundary`.
 */
export function formatOutlinerFencePaste(
    contentBoundary: number,
    clipboardText: string,
): string {
    const normalised = clipboardText.replace(/\r\n/g, '\n');
    const lines = normalised.split('\n');

    // Find minimum indent across non-blank lines
    let minIndent = Infinity;
    for (const line of lines) {
        if (line.trim().length === 0) { continue; }
        const indent = getLineIndent(line);
        if (indent < minIndent) { minIndent = indent; }
    }

    // All blank — no rebasing needed
    if (minIndent === Infinity) { minIndent = 0; }

    const delta = contentBoundary - minIndent;

    const result = lines.map(line => {
        if (line.trim().length === 0) { return ''; }
        return shiftLineIndent(line, delta);
    });

    return result.join('\n');
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
