import type { IWikilinkService } from 'as-notes-common';

/**
 * Pure utility functions for wikilink completion logic.
 * No VS Code dependencies — safe for unit testing.
 */

interface IndexedLinkLike {
    page_name: string;
}

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

/**
 * Check whether the cursor position falls inside an inline code span (` ` `)
 * or a fenced code block (``` ``` ``` or ~~~ ~~~ ~~~) on the given line/document.
 *
 * @param lines - All lines of the document
 * @param lineIndex - The 0-based line index of the cursor
 * @param charIndex - The 0-based character index of the cursor on that line
 * @returns true if the cursor is inside a code span or fenced block
 */
export function isPositionInsideCode(lines: string[], lineIndex: number, charIndex: number): boolean {
    // Check fenced code block — scan up to lineIndex tracking open/close state
    const standaloneFencePattern = /^\s*(`{3,}|~{3,})/;
    const bulletOwnedFencePattern = /^\s*-\s(?:\[[ xX]\]\s)?(?:.*\s)?(`{3,}|~{3,})\S*\s*$/;
    let inFence = false;
    let fenceChar = '';
    let fenceLen = 0;
    for (let i = 0; i <= lineIndex; i++) {
        const line = lines[i] ?? '';
        const standaloneMatch = standaloneFencePattern.exec(line);
        const bulletOwnedMatch = bulletOwnedFencePattern.exec(line);
        const marker = standaloneMatch?.[1] ?? bulletOwnedMatch?.[1];
        if (!marker) {
            continue;
        }

        const char = marker[0]; // ` or ~
        const len = marker.length;
        if (!inFence) {
            // Opening fence
            inFence = true;
            fenceChar = char;
            fenceLen = len;
        } else if (char === fenceChar && len >= fenceLen) {
            // Closing fence — same char, at least as many markers
            inFence = false;
            fenceChar = '';
            fenceLen = 0;
        }
        // Otherwise it's a different fence type or shorter — ignored
    }
    // If we're still inside a fence at lineIndex, cursor is in a code block.
    // The opening fence line itself is part of the block, but content starts
    // on the next line — however for suppression purposes we treat the opening
    // fence line as code too (no completions on a ``` line).
    if (inFence) {
        return true;
    }

    // Check inline code span on this line
    const line = lines[lineIndex] ?? '';
    let inCode = false;
    for (let c = 0; c < line.length; c++) {
        if (line[c] === '`') {
            inCode = !inCode;
            continue;
        }
        if (inCode && c === charIndex) {
            return true;
        }
    }

    return false;
}

/**
 * Determine whether the current document contains at least one newly added
 * complete wikilink compared to the page's last indexed links.
 *
 * This uses page-name occurrence counts rather than positions so that plain
 * text edits that shift existing links do not count as new links, while added
 * duplicate links and nested links are still detected.
 */
export function hasNewCompleteWikilink(
    lines: string[],
    indexedLinks: IndexedLinkLike[],
    wikilinkService: IWikilinkService,
): boolean {
    const indexedCounts = new Map<string, number>();
    for (const link of indexedLinks) {
        indexedCounts.set(link.page_name, (indexedCounts.get(link.page_name) ?? 0) + 1);
    }

    const currentCounts = new Map<string, number>();
    for (const line of lines) {
        const wikilinks = wikilinkService.extractWikilinks(line, false, false);
        for (const wikilink of wikilinks) {
            currentCounts.set(wikilink.pageName, (currentCounts.get(wikilink.pageName) ?? 0) + 1);
        }
    }

    for (const [pageName, count] of currentCounts) {
        if (count > (indexedCounts.get(pageName) ?? 0)) {
            return true;
        }
    }

    return false;
}
