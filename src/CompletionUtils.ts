/**
 * Pure utility functions for wikilink completion logic.
 * No VS Code dependencies — safe for unit testing.
 */

/**
 * Find the column of the innermost unclosed `[[` in the text up to the cursor.
 * Returns -1 if no valid `[[` trigger is found.
 *
 * Tracks bracket balance: each `]]` closes the most recent `[[`. Only the
 * innermost unclosed `[[` is returned.
 */
export function findInnermostOpenBracket(text: string): number {
    const openStack: number[] = [];
    let i = 0;

    while (i < text.length) {
        if (i + 1 < text.length && text[i] === ']' && text[i + 1] === ']') {
            // Close the most recent open bracket
            if (openStack.length > 0) {
                openStack.pop();
            }
            i += 2;
        } else if (i + 1 < text.length && text[i] === '[' && text[i + 1] === '[') {
            openStack.push(i);
            i += 2;
        } else {
            i++;
        }
    }

    // Return the innermost (last) unclosed [[ position, or -1
    return openStack.length > 0 ? openStack[openStack.length - 1] : -1;
}

/**
 * Scan text (the portion of the line after the cursor) to find the matching `]]`
 * for the innermost unclosed `[[`.
 *
 * Uses bracket-depth tracking: nested `[[` increase depth, `]]` decrease it.
 * When depth reaches −1 the matching close has been found.
 *
 * @returns The index *just past* the matching `]]` (relative to the start of
 *          `text`), or −1 if no matching close bracket is found.
 */
export function findMatchingCloseBracket(text: string): number {
    let depth = 0;
    let i = 0;

    while (i < text.length) {
        if (i + 1 < text.length && text[i] === '[' && text[i + 1] === '[') {
            depth++;
            i += 2;
        } else if (i + 1 < text.length && text[i] === ']' && text[i + 1] === ']') {
            depth--;
            if (depth < 0) {
                return i + 2;
            }
            i += 2;
        } else {
            i++;
        }
    }

    return -1;
}

/**
 * Check whether a given line index falls inside a YAML front matter block.
 * Front matter is the region between the first two `---` lines at the start
 * of the document.
 *
 * @param lines - All lines of the document
 * @param lineIndex - The 0-based line to check
 * @returns true if lineIndex is inside the front matter (including the fence lines)
 */
export function isLineInsideFrontMatter(lines: string[], lineIndex: number): boolean {
    if (lines.length === 0 || lines[0].trim() !== '---') {
        return false;
    }

    // Find the closing --- fence
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            return lineIndex <= i;
        }
    }

    // Unclosed front matter — treat entire document as front matter
    return true;
}
