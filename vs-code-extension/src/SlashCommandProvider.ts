import * as vscode from 'vscode';
import { isLineInsideFrontMatter, isPositionInsideCode } from './CompletionUtils.js';
import { formatWikilinkDate } from './DatePickerService.js';

/**
 * Provides slash command completions in markdown files.
 *
 * Triggered when the user types `/`. Shows a list of in-editor commands.
 * If the user types a non-matching key or presses Escape, VS Code dismisses
 * the list and the `/` is rendered as-is.
 *
 * Suppressed inside:
 * - YAML front matter
 * - Fenced code blocks (``` or ~~~)
 * - Inline code spans (` `)
 */
export class SlashCommandProvider implements vscode.CompletionItemProvider {
    private readonly _hasProEditor: () => boolean;

    constructor(hasProEditor: () => boolean) {
        this._hasProEditor = hasProEditor;
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext,
    ): vscode.CompletionList | undefined {
        const lines: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }

        // Suppress in front matter
        if (isLineInsideFrontMatter(lines, position.line)) {
            return undefined;
        }

        // Suppress inside code blocks / inline code
        if (isPositionInsideCode(lines, position.line, position.character - 1)) {
            return undefined;
        }

        // Ensure there is a `/` immediately before the cursor
        const lineText = document.lineAt(position.line).text;
        const charBefore = lineText[position.character - 1];
        if (charBefore !== '/') {
            return undefined;
        }

        // Replacement range covers the `/` character
        const range = new vscode.Range(
            new vscode.Position(position.line, position.character - 1),
            position,
        );

        // True when the cursor is on a task checkbox line — used to gate Task commands
        const isTaskLine = /^\s*-\s+\[[ xX]\]/.test(lineText);

        const items: vscode.CompletionItem[] = [];

        // ── Today ─────────────────────────────────────────────────────────
        const todayItem = new vscode.CompletionItem('Today', vscode.CompletionItemKind.Event);
        todayItem.detail = 'Insert [[YYYY_MM_DD]] for today';
        todayItem.sortText = '0-today';
        todayItem.filterText = '/Today';
        todayItem.insertText = formatWikilinkDate(new Date());
        todayItem.range = range;
        items.push(todayItem);

        // ── Date Picker ────────────────────────────────────────────────────
        const pickerItem = new vscode.CompletionItem('Date Picker', vscode.CompletionItemKind.Event);
        pickerItem.detail = 'Pick any date and insert as [[YYYY_MM_DD]]';
        pickerItem.sortText = '1-datepicker';
        pickerItem.filterText = '/Date Picker';
        // insertText replaces the `/` with empty — the command will do the insertion
        pickerItem.insertText = '';
        pickerItem.range = range;
        pickerItem.command = {
            command: 'as-notes.openDatePicker',
            title: 'Open Date Picker',
        };
        items.push(pickerItem);

        // ── Code (inline) ──────────────────────────────────────────────────
        const inlineCodeItem = new vscode.CompletionItem('Code (inline)', vscode.CompletionItemKind.Snippet);
        inlineCodeItem.detail = 'Insert inline code span';
        inlineCodeItem.sortText = '2-code-inline';
        inlineCodeItem.filterText = '/Code inline';
        inlineCodeItem.insertText = new vscode.SnippetString('`$0`');
        inlineCodeItem.range = range;
        items.push(inlineCodeItem);

        // ── Code (multiline) ───────────────────────────────────────────────
        const multilineCodeItem = new vscode.CompletionItem('Code (multiline)', vscode.CompletionItemKind.Snippet);
        multilineCodeItem.detail = 'Insert fenced code block';
        multilineCodeItem.sortText = '3-code-multiline';
        multilineCodeItem.filterText = '/Code multiline';
        multilineCodeItem.insertText = new vscode.SnippetString('```$0\n```');
        multilineCodeItem.range = range;
        items.push(multilineCodeItem);

        // ── Table commands (Pro-gated) ─────────────────────────────────────
        const proSuffix = this._hasProEditor() ? '' : ' (Pro)';

        // ── Table ──────────────────────────────────────────────────────────
        const tableItem = new vscode.CompletionItem('Table' + proSuffix, vscode.CompletionItemKind.Event);
        tableItem.detail = 'Insert a new markdown table';
        tableItem.sortText = '4-table';
        tableItem.filterText = '/Table';
        tableItem.insertText = '';
        tableItem.range = range;
        tableItem.command = {
            command: 'as-notes.insertTable',
            title: 'Insert Table',
        };
        items.push(tableItem);

        // ── Table: Add Column(s) ───────────────────────────────────────────
        const tableColItem = new vscode.CompletionItem('Table: Add Column(s)' + proSuffix, vscode.CompletionItemKind.Event);
        tableColItem.detail = 'Add columns after the current column';
        tableColItem.sortText = '5-table-add-column';
        tableColItem.filterText = '/Table Add Column';
        tableColItem.insertText = '';
        tableColItem.range = range;
        tableColItem.command = {
            command: 'as-notes.tableAddColumn',
            title: 'Add Table Column',
        };
        items.push(tableColItem);

        // ── Table: Add Row(s) ──────────────────────────────────────────────
        const tableRowItem = new vscode.CompletionItem('Table: Add Row(s)' + proSuffix, vscode.CompletionItemKind.Event);
        tableRowItem.detail = 'Add rows after the current row';
        tableRowItem.sortText = '6-table-add-row';
        tableRowItem.filterText = '/Table Add Row';
        tableRowItem.insertText = '';
        tableRowItem.range = range;
        tableRowItem.command = {
            command: 'as-notes.tableAddRow',
            title: 'Add Table Row',
        };
        items.push(tableRowItem);

        // ── Table: Format ──────────────────────────────────────────────────
        const tableFormatItem = new vscode.CompletionItem('Table: Format' + proSuffix, vscode.CompletionItemKind.Event);
        tableFormatItem.detail = 'Normalise table column widths';
        tableFormatItem.sortText = '7-table-format';
        tableFormatItem.filterText = '/Table Format';
        tableFormatItem.insertText = '';
        tableFormatItem.range = range;
        tableFormatItem.command = {
            command: 'as-notes.tableFormat',
            title: 'Format Table',
        };
        items.push(tableFormatItem);

        // ── Table: Remove Row (Current) ────────────────────────────────────
        const removeRowItem = new vscode.CompletionItem('Table: Remove Row (Current)' + proSuffix, vscode.CompletionItemKind.Event);
        removeRowItem.detail = 'Remove the current table row';
        removeRowItem.sortText = '8-table-remove-row';
        removeRowItem.filterText = '/Table Remove Row';
        removeRowItem.insertText = '';
        removeRowItem.range = range;
        removeRowItem.command = {
            command: 'as-notes.tableRemoveRow',
            title: 'Remove Table Row',
        };
        items.push(removeRowItem);

        // ── Table: Remove Column (Current) ─────────────────────────────────
        const removeColItem = new vscode.CompletionItem('Table: Remove Column (Current)' + proSuffix, vscode.CompletionItemKind.Event);
        removeColItem.detail = 'Remove the current table column';
        removeColItem.sortText = '9-table-remove-col';
        removeColItem.filterText = '/Table Remove Column';
        removeColItem.insertText = '';
        removeColItem.range = range;
        removeColItem.command = {
            command: 'as-notes.tableRemoveColumn',
            title: 'Remove Table Column',
        };
        items.push(removeColItem);

        // ── Table: Remove Row(s) Above ─────────────────────────────────────
        const removeRowsAboveItem = new vscode.CompletionItem('Table: Remove Row(s) Above' + proSuffix, vscode.CompletionItemKind.Event);
        removeRowsAboveItem.detail = 'Remove rows above the current row';
        removeRowsAboveItem.sortText = 'a-table-remove-rows-above';
        removeRowsAboveItem.filterText = '/Table Remove Rows Above';
        removeRowsAboveItem.insertText = '';
        removeRowsAboveItem.range = range;
        removeRowsAboveItem.command = {
            command: 'as-notes.tableRemoveRowsAbove',
            title: 'Remove Rows Above',
        };
        items.push(removeRowsAboveItem);

        // ── Table: Remove Row(s) Below ─────────────────────────────────────
        const removeRowsBelowItem = new vscode.CompletionItem('Table: Remove Row(s) Below' + proSuffix, vscode.CompletionItemKind.Event);
        removeRowsBelowItem.detail = 'Remove rows below the current row';
        removeRowsBelowItem.sortText = 'b-table-remove-rows-below';
        removeRowsBelowItem.filterText = '/Table Remove Rows Below';
        removeRowsBelowItem.insertText = '';
        removeRowsBelowItem.range = range;
        removeRowsBelowItem.command = {
            command: 'as-notes.tableRemoveRowsBelow',
            title: 'Remove Rows Below',
        };
        items.push(removeRowsBelowItem);

        // ── Table: Remove Column(s) Right ──────────────────────────────────
        const removeColsRightItem = new vscode.CompletionItem('Table: Remove Column(s) Right' + proSuffix, vscode.CompletionItemKind.Event);
        removeColsRightItem.detail = 'Remove columns to the right of the cursor';
        removeColsRightItem.sortText = 'c-table-remove-cols-right';
        removeColsRightItem.filterText = '/Table Remove Columns Right';
        removeColsRightItem.insertText = '';
        removeColsRightItem.range = range;
        removeColsRightItem.command = {
            command: 'as-notes.tableRemoveColumnsRight',
            title: 'Remove Columns Right',
        };
        items.push(removeColsRightItem);

        // ── Table: Remove Column(s) Left ───────────────────────────────────
        const removeColsLeftItem = new vscode.CompletionItem('Table: Remove Column(s) Left' + proSuffix, vscode.CompletionItemKind.Event);
        removeColsLeftItem.detail = 'Remove columns to the left of the cursor';
        removeColsLeftItem.sortText = 'd-table-remove-cols-left';
        removeColsLeftItem.filterText = '/Table Remove Columns Left';
        removeColsLeftItem.insertText = '';
        removeColsLeftItem.range = range;
        removeColsLeftItem.command = {
            command: 'as-notes.tableRemoveColumnsLeft',
            title: 'Remove Columns Left',
        };
        items.push(removeColsLeftItem);

        // ── Card: Entry Date (kanban card files only) ─────────────────────
        const filePath = document.uri.fsPath.replace(/\\/g, '/');
        const isKanbanCardFile = /\/kanban\//.test(filePath) && /\/card_[^/]+\.md$/.test(filePath);
        if (isKanbanCardFile) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            const entryItem = new vscode.CompletionItem('Card: Entry Date', vscode.CompletionItemKind.Snippet);
            entryItem.detail = `Insert ## entry ${dateStr} heading`;
            entryItem.sortText = 'e-card-entry';
            entryItem.filterText = '/Card Entry Date';
            entryItem.insertText = new vscode.SnippetString(`## entry ${dateStr}\n\n$0`);
            entryItem.range = range;
            items.push(entryItem);
        }

        if (isTaskLine) {
            // ── Task: Priority 1 ──────────────────────────────────────────
            const taskP1Item = new vscode.CompletionItem('Task: Priority 1', vscode.CompletionItemKind.Event);
            taskP1Item.detail = 'Insert #P1 priority tag (Critical) at task start';
            taskP1Item.sortText = 'e-task-p1';
            taskP1Item.filterText = '/Task Priority 1';
            taskP1Item.insertText = '';
            taskP1Item.range = range;
            taskP1Item.command = { command: 'as-notes.insertTaskHashtag', title: 'Insert Task Hashtag', arguments: ['#P1'] };
            items.push(taskP1Item);

            // ── Task: Priority 2 ──────────────────────────────────────────
            const taskP2Item = new vscode.CompletionItem('Task: Priority 2', vscode.CompletionItemKind.Event);
            taskP2Item.detail = 'Insert #P2 priority tag (High) at task start';
            taskP2Item.sortText = 'f-task-p2';
            taskP2Item.filterText = '/Task Priority 2';
            taskP2Item.insertText = '';
            taskP2Item.range = range;
            taskP2Item.command = { command: 'as-notes.insertTaskHashtag', title: 'Insert Task Hashtag', arguments: ['#P2'] };
            items.push(taskP2Item);

            // ── Task: Priority 3 ──────────────────────────────────────────
            const taskP3Item = new vscode.CompletionItem('Task: Priority 3', vscode.CompletionItemKind.Event);
            taskP3Item.detail = 'Insert #P3 priority tag (Normal) at task start';
            taskP3Item.sortText = 'g-task-p3';
            taskP3Item.filterText = '/Task Priority 3';
            taskP3Item.insertText = '';
            taskP3Item.range = range;
            taskP3Item.command = { command: 'as-notes.insertTaskHashtag', title: 'Insert Task Hashtag', arguments: ['#P3'] };
            items.push(taskP3Item);

            // ── Task: Waiting ─────────────────────────────────────────────
            const taskWaitingItem = new vscode.CompletionItem('Task: Waiting', vscode.CompletionItemKind.Event);
            taskWaitingItem.detail = 'Insert #W waiting tag (blocked/waiting) at task start';
            taskWaitingItem.sortText = 'h-task-waiting';
            taskWaitingItem.filterText = '/Task Waiting';
            taskWaitingItem.insertText = '';
            taskWaitingItem.range = range;
            taskWaitingItem.command = { command: 'as-notes.insertTaskHashtag', title: 'Insert Task Hashtag', arguments: ['#W'] };
            items.push(taskWaitingItem);

            // ── Task: Due Date ────────────────────────────────────────────
            const taskDueDateItem = new vscode.CompletionItem('Task: Due Date', vscode.CompletionItemKind.Event);
            taskDueDateItem.detail = 'Insert #D-YYYY-MM-DD due date tag after existing hashtags';
            taskDueDateItem.sortText = 'i-task-due-date';
            taskDueDateItem.filterText = '/Task Due Date';
            taskDueDateItem.insertText = '';
            taskDueDateItem.range = range;
            taskDueDateItem.command = {
                command: 'as-notes.insertTaskDueDate',
                title: 'Insert Task Due Date',
            };
            items.push(taskDueDateItem);
            // ── Task: Completion Date ──────────────────────────────────
            const taskCompletionDateItem = new vscode.CompletionItem('Task: Completion Date', vscode.CompletionItemKind.Event);
            taskCompletionDateItem.detail = 'Insert #C-YYYY-MM-DD completion date tag after existing hashtags';
            taskCompletionDateItem.sortText = 'j-task-completion-date';
            taskCompletionDateItem.filterText = '/Task Completion Date';
            taskCompletionDateItem.insertText = '';
            taskCompletionDateItem.range = range;
            taskCompletionDateItem.command = {
                command: 'as-notes.insertTaskCompletionDate',
                title: 'Insert Task Completion Date',
            };
            items.push(taskCompletionDateItem);
            // ── Convert to Kanban Card ─────────────────────────────
            const convertToCardItem = new vscode.CompletionItem('Convert to Kanban Card' + proSuffix, vscode.CompletionItemKind.Event);
            convertToCardItem.detail = 'Mark task done and create a Kanban card (with Waiting flag)';
            convertToCardItem.sortText = 'k-convert-to-kanban';
            convertToCardItem.filterText = '/Convert to Kanban Card';
            convertToCardItem.insertText = '';
            convertToCardItem.range = range;
            convertToCardItem.command = { command: 'as-notes.convertTaskToKanbanCard', title: 'Convert to Kanban Card' };
            items.push(convertToCardItem);        }

        return new vscode.CompletionList(items, false);
    }
}
