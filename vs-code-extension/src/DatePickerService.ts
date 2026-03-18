import * as vscode from 'vscode';
import { DATE_PATTERN, formatInputDate, parseInputDate } from './TaskHashtagService.js';

/**
 * Format a Date as a `[[YYYY-MM-DD]]` wikilink string.
 */
export function formatWikilinkDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `[[${y}-${m}-${d}]]`;
}

/**
 * Open a date picker input box. Pre-filled with today's date in YYYY-MM-DD format.
 * On confirm, inserts `[[YYYY-MM-DD]]` at the active cursor position.
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
