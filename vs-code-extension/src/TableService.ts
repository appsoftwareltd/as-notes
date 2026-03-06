/**
 * Pure utility functions for markdown table manipulation.
 * No VS Code dependencies — safe for unit testing.
 */

/** Default minimum cell content width (characters). */
export const DEFAULT_CELL_WIDTH = 7;

// ── Parsing utilities ──────────────────────────────────────────────────────

/**
 * Check whether a line looks like a markdown table row (`| ... | ... |`).
 */
export function isTableRow(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length >= 3;
}

/**
 * Check whether a line is a markdown table separator row (`|---|---|`).
 */
export function isSeparatorRow(line: string): boolean {
    if (!isTableRow(line)) { return false; }
    const cells = parseTableRow(line);
    return cells.every(c => /^-+$/.test(c.trim()));
}

/**
 * Split a `|`-delimited table row into cell contents (trimmed).
 * Leading and trailing `|` are stripped.
 *
 * `"| Foo | Bar |"` → `["Foo", "Bar"]`
 */
export function parseTableRow(line: string): string[] {
    const trimmed = line.trim();
    // Strip leading and trailing |
    const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const stripped = inner.endsWith('|') ? inner.slice(0, -1) : inner;
    return stripped.split('|').map(cell => cell.trim());
}

/**
 * Find the first and last line indices of the markdown table containing `lineIndex`.
 * Returns `null` if the line is not inside a table.
 */
export function findTableBounds(lines: string[], lineIndex: number): { startLine: number; endLine: number } | null {
    if (lineIndex < 0 || lineIndex >= lines.length) { return null; }
    if (!isTableRow(lines[lineIndex])) { return null; }

    let startLine = lineIndex;
    while (startLine > 0 && isTableRow(lines[startLine - 1])) {
        startLine--;
    }

    let endLine = lineIndex;
    while (endLine < lines.length - 1 && isTableRow(lines[endLine + 1])) {
        endLine++;
    }

    return { startLine, endLine };
}

/**
 * Determine which column (0-based) the cursor is in on a table row.
 * Counts `|` characters before `charIndex` to determine column position.
 */
export function findCursorColumn(line: string, charIndex: number): number {
    let pipes = 0;
    for (let i = 0; i < charIndex && i < line.length; i++) {
        if (line[i] === '|') { pipes++; }
    }
    // First | is the leading pipe, so column = pipes - 1 (min 0)
    return Math.max(0, pipes - 1);
}

// ── Building utilities ─────────────────────────────────────────────────────

/**
 * Build a table row from cell contents and column widths.
 * Each cell is padded with spaces to match its column width.
 */
export function buildRow(cells: string[], widths: number[]): string {
    const parts = cells.map((cell, i) => {
        const w = widths[i] ?? DEFAULT_CELL_WIDTH;
        return ' ' + cell.padEnd(w) + ' ';
    });
    return '|' + parts.join('|') + '|';
}

/**
 * Build a separator row from column widths.
 */
export function buildSeparator(widths: number[]): string {
    const parts = widths.map(w => '-'.repeat(w + 2));
    return '|' + parts.join('|') + '|';
}

// ── Table generation ───────────────────────────────────────────────────────

/**
 * Generate a new markdown table string.
 *
 * @param cols Number of columns
 * @param rows Number of data rows (excludes header and separator)
 * @param cellWidth Content width per cell
 * @returns The full table as a string (with trailing newline)
 */
export function generateTable(cols: number, rows: number, cellWidth: number = DEFAULT_CELL_WIDTH): string {
    const widths = Array.from({ length: cols }, () => cellWidth);
    const headerCells = Array.from({ length: cols }, (_, i) => {
        const label = `Col ${i + 1}`;
        return label.length <= cellWidth ? label : label.slice(0, cellWidth);
    });

    const lines: string[] = [];
    lines.push(buildRow(headerCells, widths));
    lines.push(buildSeparator(widths));
    const emptyRow = buildRow(Array.from({ length: cols }, () => ''), widths);
    for (let r = 0; r < rows; r++) {
        lines.push(emptyRow);
    }
    return lines.join('\n');
}

// ── Add columns ────────────────────────────────────────────────────────────

export interface TableEdit {
    startLine: number;
    endLine: number;
    newText: string;
}

/**
 * Add columns after the cursor's current column in an existing table.
 *
 * @param lines All document lines
 * @param cursorLine 0-based line index of the cursor
 * @param cursorChar 0-based character index of the cursor
 * @param count Number of columns to add
 * @param cellWidth Content width for new columns
 * @returns A TableEdit replacing the table region, or null if cursor is not in a table
 */
export function addColumns(
    lines: string[],
    cursorLine: number,
    cursorChar: number,
    count: number,
    cellWidth: number = DEFAULT_CELL_WIDTH,
): TableEdit | null {
    const bounds = findTableBounds(lines, cursorLine);
    if (!bounds) { return null; }

    const colIndex = findCursorColumn(lines[cursorLine], cursorChar);
    const newCellPad = ' ' + ''.padEnd(cellWidth) + ' ';
    const newSepPad = '-'.repeat(cellWidth + 2);
    const insertion = '|' + (newCellPad + '|').repeat(count);
    const sepInsertion = '|' + (newSepPad + '|').repeat(count);

    const newLines: string[] = [];
    for (let i = bounds.startLine; i <= bounds.endLine; i++) {
        const line = lines[i];
        const isSep = isSeparatorRow(line);
        const ins = isSep ? sepInsertion : insertion;

        // Find the position of the (colIndex+1)th pipe after the leading pipe
        let pipeCount = 0;
        let insertPos = -1;
        for (let c = 0; c < line.length; c++) {
            if (line[c] === '|') {
                pipeCount++;
                // colIndex 0 → insert after 2nd pipe, colIndex 1 → after 3rd, etc.
                if (pipeCount === colIndex + 2) {
                    insertPos = c + 1;
                    break;
                }
            }
        }

        if (insertPos === -1) {
            // Cursor is beyond the last column — append before trailing pipe
            const trimmed = line.trimEnd();
            const lastPipe = trimmed.lastIndexOf('|');
            newLines.push(trimmed.slice(0, lastPipe) + ins.slice(1) + '|');
        } else {
            newLines.push(line.slice(0, insertPos) + ins.slice(1, -1) + '|' + line.slice(insertPos));
        }
    }

    return { startLine: bounds.startLine, endLine: bounds.endLine, newText: newLines.join('\n') };
}

// ── Add rows ───────────────────────────────────────────────────────────────

export interface RowInsert {
    insertAfterLine: number;
    newText: string;
}

/**
 * Add rows after the cursor's current row in an existing table.
 *
 * @param lines All document lines
 * @param cursorLine 0-based line index of the cursor
 * @param count Number of rows to add
 * @returns A RowInsert with line to insert after and the new text, or null if cursor is not in a table
 */
export function addRows(
    lines: string[],
    cursorLine: number,
    count: number,
): RowInsert | null {
    const bounds = findTableBounds(lines, cursorLine);
    if (!bounds) { return null; }

    // Use header row (first row) to determine column widths
    const headerLine = lines[bounds.startLine];
    const headerCells = parseTableRow(headerLine);
    const colCount = headerCells.length;

    // Measure widths from header row cells (content between pipes, minus the space padding)
    const widths = measureColumnWidths(lines[bounds.startLine]);

    // Preserve original left indentation
    const indent = getIndent(lines[bounds.startLine]);

    const emptyRow = indent + buildRow(Array.from({ length: colCount }, () => ''), widths);
    const newRows: string[] = [];
    for (let r = 0; r < count; r++) {
        newRows.push(emptyRow);
    }

    // If cursor is on the header or separator row, insert after the separator
    let insertLine = cursorLine;
    if (bounds.startLine + 1 <= bounds.endLine && isSeparatorRow(lines[bounds.startLine + 1])) {
        if (cursorLine <= bounds.startLine + 1) {
            insertLine = bounds.startLine + 1;
        }
    }

    return { insertAfterLine: insertLine, newText: newRows.join('\n') };
}

// ── Format table ───────────────────────────────────────────────────────────

/**
 * Reformat an entire table to uniform column widths.
 * Each column width = max(longest cell content, defaultMinWidth).
 *
 * @param lines All document lines
 * @param lineIndex Any line inside the table
 * @param minWidth Minimum cell content width
 * @returns A TableEdit replacing the table region, or null if not in a table
 */
export function formatTable(
    lines: string[],
    lineIndex: number,
    minWidth: number = DEFAULT_CELL_WIDTH,
): TableEdit | null {
    const bounds = findTableBounds(lines, lineIndex);
    if (!bounds) { return null; }

    // Parse all rows
    const parsedRows: string[][] = [];
    let sepIndex = -1;
    for (let i = bounds.startLine; i <= bounds.endLine; i++) {
        if (isSeparatorRow(lines[i])) {
            sepIndex = i - bounds.startLine;
            parsedRows.push([]); // placeholder for separator
        } else {
            parsedRows.push(parseTableRow(lines[i]));
        }
    }

    // Determine column count from the header (first row)
    const colCount = parsedRows[0].length;
    if (colCount === 0) { return null; }

    // Calculate optimal widths
    const widths: number[] = Array.from({ length: colCount }, () => minWidth);
    for (const row of parsedRows) {
        if (row.length === 0) { continue; } // separator placeholder
        for (let c = 0; c < row.length && c < colCount; c++) {
            widths[c] = Math.max(widths[c], row[c].length);
        }
    }

    // Preserve original left indentation
    const indent = getIndent(lines[bounds.startLine]);

    // Rebuild table
    const newLines: string[] = [];
    for (let r = 0; r < parsedRows.length; r++) {
        if (r === sepIndex) {
            newLines.push(indent + buildSeparator(widths));
        } else {
            // Pad/truncate cells to match column count
            const cells = parsedRows[r];
            while (cells.length < colCount) { cells.push(''); }
            newLines.push(indent + buildRow(cells.slice(0, colCount), widths));
        }
    }

    return { startLine: bounds.startLine, endLine: bounds.endLine, newText: newLines.join('\n') };
}

// ── Remove current row ─────────────────────────────────────────────────────

/**
 * Remove the row at the cursor position.
 * Refuses to remove the header row or separator row.
 *
 * @returns A TableEdit replacing the table region, or null if not in a table / on header or separator
 */
export function removeCurrentRow(
    lines: string[],
    cursorLine: number,
): TableEdit | null {
    const bounds = findTableBounds(lines, cursorLine);
    if (!bounds) { return null; }

    // Determine header and separator indices
    const headerLine = bounds.startLine;
    const sepLine = (headerLine + 1 <= bounds.endLine && isSeparatorRow(lines[headerLine + 1]))
        ? headerLine + 1
        : -1;

    // Refuse to remove header or separator
    if (cursorLine === headerLine || cursorLine === sepLine) { return null; }

    const newLines: string[] = [];
    for (let i = bounds.startLine; i <= bounds.endLine; i++) {
        if (i !== cursorLine) {
            newLines.push(lines[i]);
        }
    }

    return { startLine: bounds.startLine, endLine: bounds.endLine, newText: newLines.join('\n') };
}

// ── Remove current column ──────────────────────────────────────────────────

/**
 * Remove the column at the cursor position.
 * Refuses if the table has only one column.
 *
 * @returns A TableEdit replacing the table region, or null if not in a table / single column
 */
export function removeCurrentColumn(
    lines: string[],
    cursorLine: number,
    cursorChar: number,
): TableEdit | null {
    const bounds = findTableBounds(lines, cursorLine);
    if (!bounds) { return null; }

    const colIndex = findCursorColumn(lines[cursorLine], cursorChar);
    const headerCells = parseTableRow(lines[bounds.startLine]);
    const colCount = headerCells.length;

    if (colCount <= 1) { return null; }
    if (colIndex >= colCount) { return null; }

    return rebuildTableWithoutColumns(lines, bounds, [colIndex]);
}

// ── Remove rows above ──────────────────────────────────────────────────────

/**
 * Remove up to `count` data rows above the cursor row.
 * Never removes the header or separator. Clamps to available rows.
 *
 * @returns A TableEdit, or null if not in a table or no removable rows above
 */
export function removeRowsAbove(
    lines: string[],
    cursorLine: number,
    count: number,
): TableEdit | null {
    const bounds = findTableBounds(lines, cursorLine);
    if (!bounds) { return null; }

    const firstDataRow = getFirstDataRow(lines, bounds);
    if (firstDataRow === -1 || cursorLine <= firstDataRow) { return null; }

    // Removable rows: data rows strictly above the cursor
    const maxRemovable = cursorLine - firstDataRow;
    const toRemove = Math.min(count, maxRemovable);
    if (toRemove <= 0) { return null; }

    // Remove `toRemove` rows immediately above the cursor
    const removeStart = cursorLine - toRemove;
    const removeSet = new Set<number>();
    for (let i = removeStart; i < cursorLine; i++) {
        removeSet.add(i);
    }

    const newLines: string[] = [];
    for (let i = bounds.startLine; i <= bounds.endLine; i++) {
        if (!removeSet.has(i)) {
            newLines.push(lines[i]);
        }
    }

    return { startLine: bounds.startLine, endLine: bounds.endLine, newText: newLines.join('\n') };
}

// ── Remove rows below ──────────────────────────────────────────────────────

/**
 * Remove up to `count` rows below the cursor row.
 * Clamps to available rows.
 *
 * @returns A TableEdit, or null if not in a table or no rows below
 */
export function removeRowsBelow(
    lines: string[],
    cursorLine: number,
    count: number,
): TableEdit | null {
    const bounds = findTableBounds(lines, cursorLine);
    if (!bounds) { return null; }

    if (cursorLine >= bounds.endLine) { return null; }

    const maxRemovable = bounds.endLine - cursorLine;
    const toRemove = Math.min(count, maxRemovable);
    if (toRemove <= 0) { return null; }

    const removeStart = cursorLine + 1;
    const removeEnd = cursorLine + toRemove;
    const removeSet = new Set<number>();
    for (let i = removeStart; i <= removeEnd; i++) {
        removeSet.add(i);
    }

    const newLines: string[] = [];
    for (let i = bounds.startLine; i <= bounds.endLine; i++) {
        if (!removeSet.has(i)) {
            newLines.push(lines[i]);
        }
    }

    return { startLine: bounds.startLine, endLine: bounds.endLine, newText: newLines.join('\n') };
}

// ── Remove columns right ───────────────────────────────────────────────────

/**
 * Remove up to `count` columns to the right of the cursor column.
 * Clamps to available columns. Refuses if it would remove all columns.
 *
 * @returns A TableEdit, or null if not in a table or no columns to the right
 */
export function removeColumnsRight(
    lines: string[],
    cursorLine: number,
    cursorChar: number,
    count: number,
): TableEdit | null {
    const bounds = findTableBounds(lines, cursorLine);
    if (!bounds) { return null; }

    const colIndex = findCursorColumn(lines[cursorLine], cursorChar);
    const colCount = parseTableRow(lines[bounds.startLine]).length;

    const maxRemovable = colCount - colIndex - 1;
    if (maxRemovable <= 0) { return null; }
    const toRemove = Math.min(count, maxRemovable);

    const colsToRemove: number[] = [];
    for (let c = colIndex + 1; c <= colIndex + toRemove; c++) {
        colsToRemove.push(c);
    }

    return rebuildTableWithoutColumns(lines, bounds, colsToRemove);
}

// ── Remove columns left ────────────────────────────────────────────────────

/**
 * Remove up to `count` columns to the left of the cursor column.
 * Clamps to available columns. Refuses if it would remove all columns.
 * Preserves the original left indentation of the table.
 *
 * @returns A TableEdit, or null if not in a table or no columns to the left
 */
export function removeColumnsLeft(
    lines: string[],
    cursorLine: number,
    cursorChar: number,
    count: number,
): TableEdit | null {
    const bounds = findTableBounds(lines, cursorLine);
    if (!bounds) { return null; }

    const colIndex = findCursorColumn(lines[cursorLine], cursorChar);
    if (colIndex <= 0) { return null; }

    const toRemove = Math.min(count, colIndex);

    const colsToRemove: number[] = [];
    for (let c = colIndex - toRemove; c < colIndex; c++) {
        colsToRemove.push(c);
    }

    return rebuildTableWithoutColumns(lines, bounds, colsToRemove);
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Get the first data row index (after header and separator).
 */
function getFirstDataRow(lines: string[], bounds: { startLine: number; endLine: number }): number {
    let row = bounds.startLine + 1; // skip header
    if (row <= bounds.endLine && isSeparatorRow(lines[row])) {
        row++; // skip separator
    }
    return row <= bounds.endLine ? row : -1;
}

/**
 * Rebuild a table with specified columns removed.
 * Preserves original left indentation.
 */
function rebuildTableWithoutColumns(
    lines: string[],
    bounds: { startLine: number; endLine: number },
    colsToRemove: number[],
): TableEdit {
    const removeSet = new Set(colsToRemove);
    const indent = getIndent(lines[bounds.startLine]);

    // Parse all rows and remove specified columns
    const parsedRows: string[][] = [];
    let sepIndex = -1;
    for (let i = bounds.startLine; i <= bounds.endLine; i++) {
        if (isSeparatorRow(lines[i])) {
            sepIndex = i - bounds.startLine;
            parsedRows.push([]); // placeholder
        } else {
            const cells = parseTableRow(lines[i]);
            parsedRows.push(cells.filter((_, idx) => !removeSet.has(idx)));
        }
    }

    // Determine new column count and widths
    const colCount = parsedRows.find(r => r.length > 0)!.length;
    const widths: number[] = Array.from({ length: colCount }, () => DEFAULT_CELL_WIDTH);
    for (const row of parsedRows) {
        if (row.length === 0) { continue; }
        for (let c = 0; c < row.length && c < colCount; c++) {
            widths[c] = Math.max(widths[c], row[c].length);
        }
    }

    // Rebuild
    const newLines: string[] = [];
    for (let r = 0; r < parsedRows.length; r++) {
        if (r === sepIndex) {
            newLines.push(indent + buildSeparator(widths));
        } else {
            const cells = parsedRows[r];
            while (cells.length < colCount) { cells.push(''); }
            newLines.push(indent + buildRow(cells.slice(0, colCount), widths));
        }
    }

    return { startLine: bounds.startLine, endLine: bounds.endLine, newText: newLines.join('\n') };
}

/**
 * Extract leading whitespace from a line.
 */
function getIndent(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
}

/**
 * Measure column content widths from a single table row.
 * Splits the row and measures each cell's content length,
 * applying DEFAULT_CELL_WIDTH as minimum.
 */
function measureColumnWidths(line: string): number[] {
    const cells = parseTableRow(line);
    return cells.map(c => Math.max(c.length, DEFAULT_CELL_WIDTH));
}
