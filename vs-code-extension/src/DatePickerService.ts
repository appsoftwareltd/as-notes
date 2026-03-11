import * as vscode from 'vscode';
import { formatWikilinkDate } from './SlashCommandProvider.js';

/** YYYY-MM-DD pattern for date validation */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Matches the task checkbox prefix and any leading hashtag tokens that follow it.
 * - Group 1: checkbox prefix, e.g. `- [ ] ` or `  - [x] `
 * - Group 2: zero or more existing `#WORD ` hashtag tokens, e.g. `#P1 #D-2026-03-11 `
 *
 * Insert position = group1.length + group2.length — lands after all existing hashtags.
 */
const TASK_PREFIX_RE = /^(\s*-\s+\[[ xX]\]\s+)((?:#\S+\s+)*)/;

/** Matches a priority hashtag token (e.g. `#P1`, `#P23`). */
const PRIORITY_TAG_RE = /^#P\d+$/;

/** Finds an existing priority hashtag token anywhere on a line. */
const EXISTING_PRIORITY_RE = /#P\d+/;

/** Finds `#W` as a complete token (not followed by a non-space char). */
const EXISTING_WAITING_RE = /#W(?!\S)/;

/** Matches if the incoming tag is a due-date tag (`#D-…`). */
const DUE_DATE_TAG_PREFIX_RE = /^#D-/;

/** Finds an existing due-date token on a line. */
const EXISTING_DUE_DATE_RE = /#D-\d{4}-\d{2}-\d{2}/;

/** Matches if the incoming tag is a completion-date tag (`#C-…`). */
const COMPLETION_DATE_TAG_PREFIX_RE = /^#C-/;

/** Finds an existing completion-date token on a line. */
const EXISTING_COMPLETION_DATE_RE = /#C-\d{4}-\d{2}-\d{2}/;

/**
 * Matches the checkbox prefix plus all leading hashtag tokens, with or without
 * a trailing space. Used to find where the hashtag block ends in a normalized line.
 */
const HASHTAG_BLOCK_END_RE = /^(\s*-\s+\[[ xX]\](?:\s+#\S+)*)/

/**
 * Normalize spacing within a task line so there is exactly one space between
 * the checkbox marker, each hashtag token, and the remaining task text.
 * Non-task lines (no `TASK_PREFIX_RE` match) are returned unchanged.
 */
function normalizeTaskLine(line: string): string {
    const m = /^(\s*-\s+\[[ xX]\])\s+((?:#\S+\s*)*)(.*)$/.exec(line);
    if (!m) { return line; }
    const checkbox = m[1];
    const tags = m[2].trim().split(/\s+/).filter(t => t.length > 0);
    const text = m[3];
    const parts: string[] = [checkbox];
    if (tags.length > 0) { parts.push(tags.join(' ')); }
    if (text) { parts.push(text); }
    return parts.join(' ');
}

/**
 * Insert `tag + ' '` after any existing leading hashtags on each cursor's task line.
 * If the line is not a task line, inserts at the cursor position instead.
 *
 * Special cases:
 * - Priority tags (`#P\d+`): same priority issued again → **removed**; different priority → **replaced**.
 * - `#W`: issued again when already present → **removed**.
 * - `#D-YYYY-MM-DD`: any existing `#D-*` tag is **replaced** with the new date.
 * - `#C-YYYY-MM-DD`: any existing `#C-*` tag is **replaced** with the new date.
 *
 * After the edit the line spacing is normalised (exactly one space between tokens).
 * The cursor is restored to its original position; if that position falls inside
 * the leading hashtag block it is moved to the end of the line instead.
 */
export async function insertTagAtTaskStart(editor: vscode.TextEditor, tag: string): Promise<void> {
    const isPriority = PRIORITY_TAG_RE.test(tag);

    // Pre-compute operations for each cursor
    const ops = editor.selections.map(sel => {
        const lineText = editor.document.lineAt(sel.active.line).text;
        const match = TASK_PREFIX_RE.exec(lineText);

        // ── Priority ──────────────────────────────────────────────────────
        if (isPriority && match) {
            const existingMatch = EXISTING_PRIORITY_RE.exec(lineText);
            if (existingMatch) {
                if (existingMatch[0] === tag) {
                    // Same priority — REMOVE (plus one trailing space if present)
                    const removeStart = existingMatch.index;
                    const trailingSpace = lineText[removeStart + existingMatch[0].length] === ' ' ? 1 : 0;
                    return {
                        line: sel.active.line, mode: 'remove' as const,
                        removeStart, removeLen: existingMatch[0].length + trailingSpace,
                        origCol: sel.active.character, lineText,
                    };
                } else {
                    // Different priority — REPLACE
                    return {
                        line: sel.active.line, mode: 'replace' as const,
                        replaceStart: existingMatch.index,
                        replaceEnd: existingMatch.index + existingMatch[0].length,
                        newText: tag, origCol: sel.active.character, lineText,
                    };
                }
            }
        }

        // ── Waiting ───────────────────────────────────────────────────────
        if (tag === '#W' && match) {
            const existingMatch = EXISTING_WAITING_RE.exec(lineText);
            if (existingMatch) {
                // #W already present — REMOVE
                const removeStart = existingMatch.index;
                const trailingSpace = lineText[removeStart + existingMatch[0].length] === ' ' ? 1 : 0;
                return {
                    line: sel.active.line, mode: 'remove' as const,
                    removeStart, removeLen: existingMatch[0].length + trailingSpace,
                    origCol: sel.active.character, lineText,
                };
            }
        }

        // ── Due date: replace if any #D-* exists ──────────────────────────
        if (DUE_DATE_TAG_PREFIX_RE.test(tag) && match) {
            const existingMatch = EXISTING_DUE_DATE_RE.exec(lineText);
            if (existingMatch) {
                return {
                    line: sel.active.line, mode: 'replace' as const,
                    replaceStart: existingMatch.index,
                    replaceEnd: existingMatch.index + existingMatch[0].length,
                    newText: tag, origCol: sel.active.character, lineText,
                };
            }
        }

        // ── Completion date: replace if any #C-* exists ───────────────────
        if (COMPLETION_DATE_TAG_PREFIX_RE.test(tag) && match) {
            const existingMatch = EXISTING_COMPLETION_DATE_RE.exec(lineText);
            if (existingMatch) {
                return {
                    line: sel.active.line, mode: 'replace' as const,
                    replaceStart: existingMatch.index,
                    replaceEnd: existingMatch.index + existingMatch[0].length,
                    newText: tag, origCol: sel.active.character, lineText,
                };
            }
        }

        // ── Default: insert after checkbox prefix + any existing leading hashtags
        const insertCol = match ? match[1].length + match[2].length : sel.active.character;
        return {
            line: sel.active.line,
            mode: 'insert' as const,
            insertCol,
            insertText: tag + ' ',
            origCol: sel.active.character, lineText,
        };
    });

    // Pre-compute raw post-edit and normalized line for each op.
    // This is used both to drive a full-line replacement (ensuring clean spacing)
    // and to compute correct cursor positions after the edit.
    const postEdits = ops.map(op => {
        let rawPostEdit: string;
        if (op.mode === 'insert') {
            rawPostEdit = op.lineText.slice(0, op.insertCol) + op.insertText + op.lineText.slice(op.insertCol);
        } else if (op.mode === 'replace') {
            rawPostEdit = op.lineText.slice(0, op.replaceStart) + op.newText + op.lineText.slice(op.replaceEnd);
        } else {
            rawPostEdit = op.lineText.slice(0, op.removeStart) + op.lineText.slice(op.removeStart + op.removeLen);
        }
        const isTaskLine = TASK_PREFIX_RE.test(op.lineText);
        const normalizedLine = isTaskLine ? normalizeTaskLine(rawPostEdit) : rawPostEdit;
        return { rawPostEdit, normalizedLine, isTaskLine };
    });

    await editor.edit((editBuilder) => {
        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];
            const { normalizedLine, isTaskLine } = postEdits[i];
            if (isTaskLine) {
                // Replace the entire line with normalized content (ensures single spacing)
                editBuilder.replace(editor.document.lineAt(op.line).range, normalizedLine);
            } else {
                // Non-task line: use the targeted insert/replace/remove
                if (op.mode === 'replace') {
                    editBuilder.replace(
                        new vscode.Range(
                            new vscode.Position(op.line, op.replaceStart),
                            new vscode.Position(op.line, op.replaceEnd),
                        ),
                        op.newText,
                    );
                } else if (op.mode === 'remove') {
                    editBuilder.delete(
                        new vscode.Range(
                            new vscode.Position(op.line, op.removeStart),
                            new vscode.Position(op.line, op.removeStart + op.removeLen),
                        ),
                    );
                } else {
                    editBuilder.insert(new vscode.Position(op.line, op.insertCol), op.insertText);
                }
            }
        }
    });

    // Restore cursors to their original text positions, adjusted for the edit.
    editor.selections = ops.map((op, i) => {
        const { normalizedLine, isTaskLine } = postEdits[i];

        if (!isTaskLine) {
            // Non-task line: delta-based cursor restoration
            let restoredCol: number;
            if (op.mode === 'replace') {
                const delta = op.newText.length - (op.replaceEnd - op.replaceStart);
                if (op.origCol <= op.replaceStart) {
                    restoredCol = op.origCol;
                } else if (op.origCol <= op.replaceEnd) {
                    restoredCol = op.replaceStart;
                } else {
                    restoredCol = op.origCol + delta;
                }
            } else if (op.mode === 'remove') {
                if (op.origCol <= op.removeStart) {
                    restoredCol = op.origCol;
                } else if (op.origCol < op.removeStart + op.removeLen) {
                    restoredCol = op.removeStart;
                } else {
                    restoredCol = op.origCol - op.removeLen;
                }
            } else {
                const insertLen = op.insertText.length;
                restoredCol = op.insertCol <= op.origCol
                    ? op.origCol + insertLen
                    : op.origCol;
            }
            const pos = new vscode.Position(op.line, restoredCol);
            return new vscode.Selection(pos, pos);
        }

        // Task line: compute cursor directly on the normalized (final) line.
        // Find where the hashtag block ends in both the original and normalized lines.
        const origBlockMatch = HASHTAG_BLOCK_END_RE.exec(op.lineText);
        const origBlockEnd = origBlockMatch ? origBlockMatch[1].length : 0;
        const normBlockMatch = HASHTAG_BLOCK_END_RE.exec(normalizedLine);
        const normBlockEnd = normBlockMatch ? normBlockMatch[1].length : 0;

        // Minimum cursor position: after all hashtags + one space (start of text region)
        const minCursorCol = normBlockEnd < normalizedLine.length
            ? normBlockEnd + 1  // skip the space after last hashtag
            : normalizedLine.length;

        // If cursor was in the hashtag/prefix region, move to end of line
        if (op.origCol <= origBlockEnd) {
            const pos = new vscode.Position(op.line, normalizedLine.length);
            return new vscode.Selection(pos, pos);
        }

        // Cursor was in the text region — preserve offset from the start of text
        const origTextStart = origBlockEnd < op.lineText.length
            ? origBlockEnd + 1  // skip the space after last hashtag in original
            : origBlockEnd;
        const textOffset = op.origCol - origTextStart;
        const restoredCol = Math.min(minCursorCol + textOffset, normalizedLine.length);

        const pos = new vscode.Position(op.line, restoredCol);
        return new vscode.Selection(pos, pos);
    });
}

/**
 * Open a date picker input box. Pre-filled with today's date in YYYY-MM-DD format.
 * On confirm, inserts `[[YYYY_MM_DD]]` at the active cursor position.
 */
export async function openDatePicker(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const today = new Date();
    const prefill = formatInputDate(today);

    const input = await vscode.window.showInputBox({
        title: 'Insert Date Wikilink',
        prompt: 'Enter a date (YYYY-MM-DD)',
        value: prefill,
        valueSelection: [0, prefill.length],
        validateInput: (value) => {
            if (!DATE_PATTERN.test(value)) {
                return 'Please enter a date in YYYY-MM-DD format';
            }
            const parsed = parseInputDate(value);
            if (!parsed) {
                return 'Invalid date';
            }
            return undefined;
        },
    });

    if (!input) { return; } // Cancelled

    const date = parseInputDate(input);
    if (!date) { return; }

    const wikilink = formatWikilinkDate(date);
    await editor.edit((edit) => {
        for (const sel of editor.selections) {
            edit.insert(sel.active, wikilink);
        }
    });
}

/**
 * Open an input box for a task due date. Pre-filled with today's date in YYYY-MM-DD format.
 * On confirm, inserts `#D-YYYY-MM-DD` at every active cursor position.
 */
export async function insertTaskDueDate(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const today = new Date();
    const prefill = formatInputDate(today);

    const input = await vscode.window.showInputBox({
        title: 'Insert Task Due Date',
        prompt: 'Enter a due date (YYYY-MM-DD)',
        value: prefill,
        valueSelection: [0, prefill.length],
        validateInput: (value) => {
            if (!DATE_PATTERN.test(value)) {
                return 'Please enter a date in YYYY-MM-DD format';
            }
            const parsed = parseInputDate(value);
            if (!parsed) {
                return 'Invalid date';
            }
            return undefined;
        },
    });

    if (!input) { return; } // Cancelled

    const date = parseInputDate(input);
    if (!date) { return; }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const tag = `#D-${y}-${m}-${d}`;

    await insertTagAtTaskStart(editor, tag);
}

/**
 * Open an input box for a task completion date. Pre-filled with today's date in YYYY-MM-DD format.
 * On confirm, inserts `#C-YYYY-MM-DD` at every active cursor position using `insertTagAtTaskStart`.
 */
export async function insertTaskCompletionDate(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const today = new Date();
    const prefill = formatInputDate(today);

    const input = await vscode.window.showInputBox({
        title: 'Insert Task Completion Date',
        prompt: 'Enter a completion date (YYYY-MM-DD)',
        value: prefill,
        valueSelection: [0, prefill.length],
        validateInput: (value) => {
            if (!DATE_PATTERN.test(value)) {
                return 'Please enter a date in YYYY-MM-DD format';
            }
            const parsed = parseInputDate(value);
            if (!parsed) {
                return 'Invalid date';
            }
            return undefined;
        },
    });

    if (!input) { return; } // Cancelled

    const date = parseInputDate(input);
    if (!date) { return; }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const tag = `#C-${y}-${m}-${d}`;

    await insertTagAtTaskStart(editor, tag);
}

/** Format a Date as `YYYY-MM-DD` for the input box pre-fill. */
function formatInputDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` string into a Date, or undefined if invalid. */
function parseInputDate(value: string): Date | undefined {
    const [yStr, mStr, dStr] = value.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (isNaN(y) || isNaN(m) || isNaN(d)) { return undefined; }
    const date = new Date(y, m - 1, d);
    // Verify the date didn't overflow (e.g. Feb 30 → Mar 2)
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        return undefined;
    }
    return date;
}
