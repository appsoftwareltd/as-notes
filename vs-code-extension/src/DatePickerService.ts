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

/**
 * Insert `tag + ' '` after any existing leading hashtags on each cursor's task line.
 * If the line is not a task line, inserts at the cursor position instead.
 *
 * Special case — priority tags (`#P\d+`): if the line already contains a priority tag,
 * it is **replaced** with the new one rather than inserted alongside it.
 *
 * After the edit, restores each cursor to its original text position
 * (adjusted for any inserted or replaced characters).
 */
export async function insertTagAtTaskStart(editor: vscode.TextEditor, tag: string): Promise<void> {
    const isPriority = PRIORITY_TAG_RE.test(tag);

    // Pre-compute operations for each cursor
    const ops = editor.selections.map(sel => {
        const lineText = editor.document.lineAt(sel.active.line).text;
        const match = TASK_PREFIX_RE.exec(lineText);

        if (isPriority && match) {
            const existingMatch = EXISTING_PRIORITY_RE.exec(lineText);
            if (existingMatch) {
                // Replace existing priority tag
                const replaceStart = existingMatch.index;
                const replaceEnd = existingMatch.index + existingMatch[0].length;
                return {
                    line: sel.active.line,
                    mode: 'replace' as const,
                    replaceStart,
                    replaceEnd,
                    newText: tag,
                    origCol: sel.active.character,
                };
            }
        }

        // Default: insert after checkbox prefix + any existing leading hashtags
        const insertCol = match ? match[1].length + match[2].length : sel.active.character;
        return {
            line: sel.active.line,
            mode: 'insert' as const,
            insertCol,
            insertText: tag + ' ',
            origCol: sel.active.character,
        };
    });

    await editor.edit((editBuilder) => {
        for (const op of ops) {
            if (op.mode === 'replace') {
                editBuilder.replace(
                    new vscode.Range(
                        new vscode.Position(op.line, op.replaceStart),
                        new vscode.Position(op.line, op.replaceEnd),
                    ),
                    op.newText,
                );
            } else {
                editBuilder.insert(new vscode.Position(op.line, op.insertCol), op.insertText);
            }
        }
    });

    // Restore cursors to their original text positions, adjusted for the edit
    editor.selections = ops.map(op => {
        let restoredCol: number;
        if (op.mode === 'replace') {
            const delta = op.newText.length - (op.replaceEnd - op.replaceStart);
            if (op.origCol <= op.replaceStart) {
                restoredCol = op.origCol; // cursor was before the replaced text
            } else if (op.origCol <= op.replaceEnd) {
                restoredCol = op.replaceStart; // cursor was inside replaced text
            } else {
                restoredCol = op.origCol + delta; // cursor was after replaced text
            }
        } else {
            const insertLen = op.insertText.length;
            restoredCol = op.insertCol <= op.origCol
                ? op.origCol + insertLen
                : op.origCol;
        }
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
