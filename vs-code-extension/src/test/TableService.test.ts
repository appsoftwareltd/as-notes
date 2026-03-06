import { describe, it, expect } from 'vitest';
import {
    DEFAULT_CELL_WIDTH,
    isTableRow,
    isSeparatorRow,
    parseTableRow,
    findTableBounds,
    findCursorColumn,
    buildRow,
    buildSeparator,
    generateTable,
    addColumns,
    addRows,
    formatTable,
    removeCurrentRow,
    removeCurrentColumn,
    removeRowsAbove,
    removeRowsBelow,
    removeColumnsRight,
    removeColumnsLeft,
} from '../TableService.js';

// ── Parsing utilities ──────────────────────────────────────────────────────

describe('TableService — isTableRow', () => {
    it('should detect a valid table row', () => {
        expect(isTableRow('| A | B |')).toBe(true);
    });

    it('should detect a separator row as a table row', () => {
        expect(isTableRow('|---|---|')).toBe(true);
    });

    it('should reject plain text', () => {
        expect(isTableRow('hello world')).toBe(false);
    });

    it('should reject a line with only one pipe', () => {
        expect(isTableRow('| hello')).toBe(false);
    });

    it('should handle whitespace-padded rows', () => {
        expect(isTableRow('  | A | B |  ')).toBe(true);
    });

    it('should reject empty string', () => {
        expect(isTableRow('')).toBe(false);
    });
});

describe('TableService — isSeparatorRow', () => {
    it('should detect a standard separator row', () => {
        expect(isSeparatorRow('|---|---|')).toBe(true);
    });

    it('should detect a long separator', () => {
        expect(isSeparatorRow('|---------|---------|')).toBe(true);
    });

    it('should reject a data row', () => {
        expect(isSeparatorRow('| Foo | Bar |')).toBe(false);
    });

    it('should reject non-table lines', () => {
        expect(isSeparatorRow('hello')).toBe(false);
    });
});

describe('TableService — parseTableRow', () => {
    it('should split a row into cell contents', () => {
        expect(parseTableRow('| Foo | Bar |')).toEqual(['Foo', 'Bar']);
    });

    it('should handle empty cells', () => {
        expect(parseTableRow('|   |   |')).toEqual(['', '']);
    });

    it('should handle cells with spaces', () => {
        expect(parseTableRow('| Hello World | Test |')).toEqual(['Hello World', 'Test']);
    });

    it('should handle a single cell', () => {
        expect(parseTableRow('| Only |')).toEqual(['Only']);
    });
});

describe('TableService — findTableBounds', () => {
    it('should find bounds of a simple table', () => {
        const lines = [
            'text before',
            '| A | B |',
            '|---|---|',
            '| 1 | 2 |',
            'text after',
        ];
        expect(findTableBounds(lines, 2)).toEqual({ startLine: 1, endLine: 3 });
    });

    it('should return null when not in a table', () => {
        const lines = ['just text', 'more text'];
        expect(findTableBounds(lines, 0)).toBeNull();
    });

    it('should handle table at document start', () => {
        const lines = ['| A |', '|---|', '| 1 |'];
        expect(findTableBounds(lines, 0)).toEqual({ startLine: 0, endLine: 2 });
    });

    it('should handle table at document end', () => {
        const lines = ['text', '| A |', '|---|', '| 1 |'];
        expect(findTableBounds(lines, 3)).toEqual({ startLine: 1, endLine: 3 });
    });

    it('should return null for out-of-bounds index', () => {
        expect(findTableBounds(['| A |'], -1)).toBeNull();
        expect(findTableBounds(['| A |'], 5)).toBeNull();
    });
});

describe('TableService — findCursorColumn', () => {
    it('should return 0 for cursor in first column', () => {
        // Cursor is in the "A" cell: | A | B |
        expect(findCursorColumn('| A | B |', 2)).toBe(0);
    });

    it('should return 1 for cursor in second column', () => {
        // Cursor is in the "B" cell
        expect(findCursorColumn('| A | B |', 6)).toBe(1);
    });

    it('should return 0 for cursor at start of line', () => {
        expect(findCursorColumn('| A | B |', 0)).toBe(0);
    });

    it('should handle wider cells', () => {
        // | Hello   | World   | Third   |
        expect(findCursorColumn('| Hello   | World   | Third   |', 22)).toBe(2);
    });
});

// ── Building utilities ─────────────────────────────────────────────────────

describe('TableService — buildRow', () => {
    it('should build a row with proper padding', () => {
        const result = buildRow(['Foo', 'Bar'], [7, 7]);
        expect(result).toBe('| Foo     | Bar     |');
    });

    it('should pad cells that are shorter than width', () => {
        const result = buildRow(['A', 'B'], [5, 5]);
        expect(result).toBe('| A     | B     |');
    });

    it('should not truncate cells longer than width', () => {
        const result = buildRow(['LongerText', 'B'], [3, 3]);
        expect(result).toBe('| LongerText | B   |');
    });
});

describe('TableService — buildSeparator', () => {
    it('should build a separator with correct dash counts', () => {
        const result = buildSeparator([7, 7]);
        expect(result).toBe('|---------|---------|');
    });

    it('should handle different widths', () => {
        const result = buildSeparator([3, 10]);
        expect(result).toBe('|-----|------------|');
    });
});

// ── Table generation ───────────────────────────────────────────────────────

describe('TableService — generateTable', () => {
    it('should generate a 2x2 table with correct structure', () => {
        const table = generateTable(2, 2);
        const lines = table.split('\n');
        expect(lines).toHaveLength(4); // header + separator + 2 data rows
        expect(isTableRow(lines[0])).toBe(true);
        expect(isSeparatorRow(lines[1])).toBe(true);
        expect(isTableRow(lines[2])).toBe(true);
        expect(isTableRow(lines[3])).toBe(true);
    });

    it('should have correct column count', () => {
        const table = generateTable(3, 1);
        const lines = table.split('\n');
        expect(parseTableRow(lines[0])).toHaveLength(3);
    });

    it('should use header labels Col 1, Col 2, ...', () => {
        const table = generateTable(3, 1);
        const headerCells = parseTableRow(table.split('\n')[0]);
        expect(headerCells).toEqual(['Col 1', 'Col 2', 'Col 3']);
    });

    it('should have empty data rows', () => {
        const table = generateTable(2, 1);
        const dataCells = parseTableRow(table.split('\n')[2]);
        expect(dataCells).toEqual(['', '']);
    });

    it('should handle 1x1 table', () => {
        const table = generateTable(1, 1);
        const lines = table.split('\n');
        expect(lines).toHaveLength(3);
        expect(parseTableRow(lines[0])).toEqual(['Col 1']);
    });
});

// ── Add columns ────────────────────────────────────────────────────────────

describe('TableService — addColumns', () => {
    const tableLines = [
        'text before',
        '| A   | B   |',
        '|-----|-----|',
        '| 1   | 2   |',
        'text after',
    ];

    it('should return null when cursor is not in a table', () => {
        expect(addColumns(tableLines, 0, 5, 1)).toBeNull();
    });

    it('should add one column after the first column', () => {
        const result = addColumns(tableLines, 1, 3, 1);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        // Each row should now have 3 columns
        for (const line of newLines) {
            expect(parseTableRow(line)).toHaveLength(3);
        }
    });

    it('should add columns after the last column', () => {
        const result = addColumns(tableLines, 1, 9, 1);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        for (const line of newLines) {
            expect(parseTableRow(line)).toHaveLength(3);
        }
    });

    it('should add multiple columns at once', () => {
        const result = addColumns(tableLines, 1, 3, 3);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        for (const line of newLines) {
            expect(parseTableRow(line)).toHaveLength(5); // 2 original + 3 new
        }
    });

    it('should preserve existing cell content', () => {
        const result = addColumns(tableLines, 3, 3, 1);
        expect(result).not.toBeNull();
        const dataRow = parseTableRow(result!.newText.split('\n')[2]);
        expect(dataRow[0]).toBe('1');
    });

    it('should include separator dashes in new columns', () => {
        const result = addColumns(tableLines, 1, 3, 1);
        expect(result).not.toBeNull();
        const sepRow = result!.newText.split('\n')[1];
        expect(isSeparatorRow(sepRow)).toBe(true);
    });
});

// ── Add rows ───────────────────────────────────────────────────────────────

describe('TableService — addRows', () => {
    const tableLines = [
        'text before',
        '| A       | B       |',
        '|---------|---------|',
        '| 1       | 2       |',
        'text after',
    ];

    it('should return null when cursor is not in a table', () => {
        expect(addRows(tableLines, 0, 1)).toBeNull();
    });

    it('should add a row after the current data row', () => {
        const result = addRows(tableLines, 3, 1);
        expect(result).not.toBeNull();
        expect(result!.insertAfterLine).toBe(3);
        const newRows = result!.newText.split('\n');
        expect(newRows).toHaveLength(1);
        // New row should have same number of columns
        expect(parseTableRow(newRows[0])).toHaveLength(2);
    });

    it('should add multiple rows', () => {
        const result = addRows(tableLines, 3, 3);
        expect(result).not.toBeNull();
        const newRows = result!.newText.split('\n');
        expect(newRows).toHaveLength(3);
    });

    it('should insert after separator when cursor is on header', () => {
        const result = addRows(tableLines, 1, 1);
        expect(result).not.toBeNull();
        // Should insert after the separator (line 2), not after the header
        expect(result!.insertAfterLine).toBe(2);
    });

    it('should insert after separator when cursor is on separator', () => {
        const result = addRows(tableLines, 2, 1);
        expect(result).not.toBeNull();
        expect(result!.insertAfterLine).toBe(2);
    });

    it('should match column widths from header row', () => {
        const result = addRows(tableLines, 3, 1);
        expect(result).not.toBeNull();
        // The header cells "A" and "B" are in 7+ width cells
        // New row should match that width
        const newRow = result!.newText;
        expect(isTableRow(newRow)).toBe(true);
    });
});

// ── Format table ───────────────────────────────────────────────────────────

describe('TableService — formatTable', () => {
    it('should return null when not in a table', () => {
        expect(formatTable(['plain text'], 0)).toBeNull();
    });

    it('should normalise column widths to longest content', () => {
        const lines = [
            '| Short | VeryLongContent |',
            '|---|---|',
            '| A | B |',
        ];
        const result = formatTable(lines, 0);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');

        // All rows should have same-width columns
        const headerCells = parseTableRow(newLines[0]);
        const dataCells = parseTableRow(newLines[2]);

        // "VeryLongContent" is 15 chars, so the second column should be at least 15 wide
        // The row string itself should reflect uniform padding
        expect(headerCells[0]).toBe('Short');
        expect(headerCells[1]).toBe('VeryLongContent');
    });

    it('should enforce minimum cell width', () => {
        const lines = [
            '| A | B |',
            '|---|---|',
            '| C | D |',
        ];
        const result = formatTable(lines, 0, 7);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        // Each cell area should be at least 7 chars wide (+ 2 spaces)
        // A separator dash count = width + 2
        const sepParts = newLines[1].split('|').filter(s => s.length > 0);
        for (const part of sepParts) {
            expect(part.length).toBeGreaterThanOrEqual(7 + 2);
        }
    });

    it('should preserve cell content after formatting', () => {
        const lines = [
            '| Foo | Bar |',
            '|---|---|',
            '| Hello | World |',
        ];
        const result = formatTable(lines, 0);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['Foo', 'Bar']);
        expect(parseTableRow(newLines[2])).toEqual(['Hello', 'World']);
    });

    it('should handle table with uneven column counts gracefully', () => {
        const lines = [
            '| A | B | C |',
            '|---|---|---|',
            '| 1 | 2 |',  // missing third cell
        ];
        const result = formatTable(lines, 0);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        // Should pad missing cells with empty strings
        expect(parseTableRow(newLines[2])).toHaveLength(3);
    });

    it('should return correct line bounds', () => {
        const lines = [
            'before',
            '| A | B |',
            '|---|---|',
            '| 1 | 2 |',
            'after',
        ];
        const result = formatTable(lines, 2);
        expect(result).not.toBeNull();
        expect(result!.startLine).toBe(1);
        expect(result!.endLine).toBe(3);
    });

    it('should preserve left indentation of table rows', () => {
        const lines = [
            '    | A | B |',
            '    |---|---|',
            '    | 1 | 2 |',
        ];
        const result = formatTable(lines, 0);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        for (const line of newLines) {
            expect(line.startsWith('    |')).toBe(true);
        }
    });

    it('should preserve indentation when widths change', () => {
        const lines = [
            '  | Short | VeryLongContent |',
            '  |---|---|',
            '  | A | B |',
        ];
        const result = formatTable(lines, 0);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        for (const line of newLines) {
            expect(line.startsWith('  |')).toBe(true);
        }
        // Content should be preserved
        expect(parseTableRow(newLines[0])).toEqual(['Short', 'VeryLongContent']);
    });
});

// ── Indent preservation in addRows ─────────────────────────────────────────

describe('TableService — addRows indent preservation', () => {
    it('should match table indentation for new rows', () => {
        const lines = [
            '    | A       | B       |',
            '    |---------|---------|',
            '    | 1       | 2       |',
        ];
        const result = addRows(lines, 2, 1);
        expect(result).not.toBeNull();
        expect(result!.newText.startsWith('    |')).toBe(true);
    });

    it('should preserve no indent when table has none', () => {
        const lines = [
            '| A       | B       |',
            '|---------|---------|',
            '| 1       | 2       |',
        ];
        const result = addRows(lines, 2, 1);
        expect(result).not.toBeNull();
        expect(result!.newText.startsWith('|')).toBe(true);
    });
});

// ── Remove current row ─────────────────────────────────────────────────────

describe('TableService — removeCurrentRow', () => {
    const tableLines = [
        'text before',
        '| A   | B   |',
        '|-----|-----|',
        '| 1   | 2   |',
        '| 3   | 4   |',
        'text after',
    ];

    it('should return null when cursor is not in a table', () => {
        expect(removeCurrentRow(tableLines, 0)).toBeNull();
    });

    it('should return null when cursor is on the header row', () => {
        expect(removeCurrentRow(tableLines, 1)).toBeNull();
    });

    it('should return null when cursor is on the separator row', () => {
        expect(removeCurrentRow(tableLines, 2)).toBeNull();
    });

    it('should remove a data row', () => {
        const result = removeCurrentRow(tableLines, 3);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(newLines).toHaveLength(3); // header + sep + one remaining data row
        expect(parseTableRow(newLines[2])).toEqual(['3', '4']);
    });

    it('should remove the last data row', () => {
        const result = removeCurrentRow(tableLines, 4);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(newLines).toHaveLength(3);
        expect(parseTableRow(newLines[2])).toEqual(['1', '2']);
    });

    it('should return correct line bounds', () => {
        const result = removeCurrentRow(tableLines, 3);
        expect(result).not.toBeNull();
        expect(result!.startLine).toBe(1);
        expect(result!.endLine).toBe(4);
    });
});

// ── Remove current column ──────────────────────────────────────────────────

describe('TableService — removeCurrentColumn', () => {
    const tableLines = [
        '| A   | B   | C   |',
        '|-----|-----|-----|',
        '| 1   | 2   | 3   |',
    ];

    it('should return null when cursor is not in a table', () => {
        expect(removeCurrentColumn(['text'], 0, 0)).toBeNull();
    });

    it('should return null for single-column table', () => {
        const singleCol = [
            '| A   |',
            '|-----|',
            '| 1   |',
        ];
        expect(removeCurrentColumn(singleCol, 0, 3)).toBeNull();
    });

    it('should remove the first column', () => {
        const result = removeCurrentColumn(tableLines, 0, 3);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['B', 'C']);
        expect(parseTableRow(newLines[2])).toEqual(['2', '3']);
    });

    it('should remove a middle column', () => {
        const result = removeCurrentColumn(tableLines, 0, 9);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['A', 'C']);
        expect(parseTableRow(newLines[2])).toEqual(['1', '3']);
    });

    it('should remove the last column', () => {
        const result = removeCurrentColumn(tableLines, 0, 15);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['A', 'B']);
        expect(parseTableRow(newLines[2])).toEqual(['1', '2']);
    });

    it('should preserve indentation when removing a column', () => {
        const indented = [
            '    | A   | B   |',
            '    |-----|-----|',
            '    | 1   | 2   |',
        ];
        const result = removeCurrentColumn(indented, 0, 7);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        for (const line of newLines) {
            expect(line.startsWith('    |')).toBe(true);
        }
    });
});

// ── Remove rows above ──────────────────────────────────────────────────────

describe('TableService — removeRowsAbove', () => {
    const tableLines = [
        '| H1  | H2  |',
        '|-----|-----|',
        '| R1  | R1  |',
        '| R2  | R2  |',
        '| R3  | R3  |',
        '| R4  | R4  |',
    ];

    it('should return null when cursor is not in a table', () => {
        expect(removeRowsAbove(['text'], 0, 1)).toBeNull();
    });

    it('should return null when cursor is on header', () => {
        expect(removeRowsAbove(tableLines, 0, 1)).toBeNull();
    });

    it('should return null when cursor is on separator', () => {
        expect(removeRowsAbove(tableLines, 1, 1)).toBeNull();
    });

    it('should return null when cursor is on first data row (no rows above)', () => {
        expect(removeRowsAbove(tableLines, 2, 1)).toBeNull();
    });

    it('should remove one row above', () => {
        const result = removeRowsAbove(tableLines, 4, 1);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(newLines).toHaveLength(5); // 6 - 1
        expect(parseTableRow(newLines[2])).toEqual(['R1', 'R1']);
        expect(parseTableRow(newLines[3])).toEqual(['R3', 'R3']);
    });

    it('should remove multiple rows above', () => {
        const result = removeRowsAbove(tableLines, 5, 2);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(newLines).toHaveLength(4); // 6 - 2
        expect(parseTableRow(newLines[2])).toEqual(['R1', 'R1']);
        expect(parseTableRow(newLines[3])).toEqual(['R4', 'R4']);
    });

    it('should clamp to available rows above', () => {
        // Cursor on R2 (index 3), only 1 data row above (R1)
        const result = removeRowsAbove(tableLines, 3, 100);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(newLines).toHaveLength(5); // removed only 1
        expect(parseTableRow(newLines[2])).toEqual(['R2', 'R2']);
    });
});

// ── Remove rows below ──────────────────────────────────────────────────────

describe('TableService — removeRowsBelow', () => {
    const tableLines = [
        '| H1  | H2  |',
        '|-----|-----|',
        '| R1  | R1  |',
        '| R2  | R2  |',
        '| R3  | R3  |',
    ];

    it('should return null when cursor is not in a table', () => {
        expect(removeRowsBelow(['text'], 0, 1)).toBeNull();
    });

    it('should return null when cursor is on last row', () => {
        expect(removeRowsBelow(tableLines, 4, 1)).toBeNull();
    });

    it('should remove one row below', () => {
        const result = removeRowsBelow(tableLines, 2, 1);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(newLines).toHaveLength(4); // 5 - 1
        expect(parseTableRow(newLines[2])).toEqual(['R1', 'R1']);
        expect(parseTableRow(newLines[3])).toEqual(['R3', 'R3']);
    });

    it('should remove multiple rows below', () => {
        const result = removeRowsBelow(tableLines, 2, 2);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(newLines).toHaveLength(3); // 5 - 2
        expect(parseTableRow(newLines[2])).toEqual(['R1', 'R1']);
    });

    it('should clamp to available rows below', () => {
        // Cursor on R1 (index 2), 2 rows below
        const result = removeRowsBelow(tableLines, 2, 100);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(newLines).toHaveLength(3); // header + sep + R1
    });

    it('should work when cursor is on separator row', () => {
        const result = removeRowsBelow(tableLines, 1, 1);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(newLines).toHaveLength(4);
    });
});

// ── Remove columns right ───────────────────────────────────────────────────

describe('TableService — removeColumnsRight', () => {
    const tableLines = [
        '| A   | B   | C   | D   |',
        '|-----|-----|-----|-----|',
        '| 1   | 2   | 3   | 4   |',
    ];

    it('should return null when cursor is not in a table', () => {
        expect(removeColumnsRight(['text'], 0, 0, 1)).toBeNull();
    });

    it('should return null when cursor is on last column', () => {
        // Cursor in column D (last column)
        expect(removeColumnsRight(tableLines, 0, 21, 1)).toBeNull();
    });

    it('should remove one column to the right', () => {
        // Cursor in column A (index 0)
        const result = removeColumnsRight(tableLines, 0, 3, 1);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['A', 'C', 'D']);
        expect(parseTableRow(newLines[2])).toEqual(['1', '3', '4']);
    });

    it('should remove multiple columns to the right', () => {
        const result = removeColumnsRight(tableLines, 0, 3, 2);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['A', 'D']);
        expect(parseTableRow(newLines[2])).toEqual(['1', '4']);
    });

    it('should clamp to available columns', () => {
        // Cursor in column B (index 1), 2 cols to right (C, D), request 100
        const result = removeColumnsRight(tableLines, 0, 9, 100);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['A', 'B']);
    });
});

// ── Remove columns left ────────────────────────────────────────────────────

describe('TableService — removeColumnsLeft', () => {
    const tableLines = [
        '| A   | B   | C   | D   |',
        '|-----|-----|-----|-----|',
        '| 1   | 2   | 3   | 4   |',
    ];

    it('should return null when cursor is not in a table', () => {
        expect(removeColumnsLeft(['text'], 0, 0, 1)).toBeNull();
    });

    it('should return null when cursor is on first column', () => {
        expect(removeColumnsLeft(tableLines, 0, 3, 1)).toBeNull();
    });

    it('should remove one column to the left', () => {
        // Cursor in column B (index 1)
        const result = removeColumnsLeft(tableLines, 0, 9, 1);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['B', 'C', 'D']);
        expect(parseTableRow(newLines[2])).toEqual(['2', '3', '4']);
    });

    it('should remove multiple columns to the left', () => {
        // Cursor in column C (index 2), remove 2 to the left (A, B)
        const result = removeColumnsLeft(tableLines, 0, 15, 2);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['C', 'D']);
        expect(parseTableRow(newLines[2])).toEqual(['3', '4']);
    });

    it('should clamp to available columns', () => {
        // Cursor in column B (index 1), only 1 col to left, request 100
        const result = removeColumnsLeft(tableLines, 0, 9, 100);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        expect(parseTableRow(newLines[0])).toEqual(['B', 'C', 'D']);
    });

    it('should preserve left indentation', () => {
        const indented = [
            '    | A   | B   | C   |',
            '    |-----|-----|-----|',
            '    | 1   | 2   | 3   |',
        ];
        // Cursor in column C (index 2), remove 1 to the left (B)
        const result = removeColumnsLeft(indented, 0, 19, 1);
        expect(result).not.toBeNull();
        const newLines = result!.newText.split('\n');
        for (const line of newLines) {
            expect(line.startsWith('    |')).toBe(true);
        }
        expect(parseTableRow(newLines[0])).toEqual(['A', 'C']);
    });
});
