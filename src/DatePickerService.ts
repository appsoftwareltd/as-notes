import * as vscode from 'vscode';
import { formatWikilinkDate } from './SlashCommandProvider.js';

/** YYYY-MM-DD pattern for date validation */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
