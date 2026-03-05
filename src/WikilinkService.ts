import { Wikilink } from './Wikilink.js';

export interface IWikilinkService {
    extractWikilinks(input: string, recurseChildren?: boolean, orderWikilinks?: boolean): Wikilink[];
}

/**
 * Parses wikilinks from text using stack-based bracket matching.
 *
 * Handles complex scenarios including:
 * - Nested wikilinks: `[[Outer [[Inner]] text]]`
 * - Multiple top-level wikilinks in the same line
 * - Unbalanced brackets and interrupting characters
 * - Recursive child extraction for building link hierarchies
 */
export class WikilinkService implements IWikilinkService {

    /**
     * Extract all wikilinks from the input text.
     *
     * @param input - The text to parse for wikilinks
     * @param recurseChildren - If true, recursively extract child wikilinks within each top-level link
     * @param orderWikilinks - If true, sort results by length descending then alphabetically
     * @returns Array of Wikilink objects with positions relative to the input string
     */
    extractWikilinks(input: string, recurseChildren: boolean = false, orderWikilinks: boolean = true): Wikilink[] {
        const wikilinkResults = new Set<Wikilink>();
        const stack: number[] = [];

        for (let i = 0; i < input.length; i++) {
            // Stack parity (% 2 == 1) indicates we are waiting for a completing bracket.
            // When not waiting, we only push if a look-ahead confirms a new bracket pair.

            if (
                input[i] === '[' &&
                (i === 0 ||
                    (i > 0 && input[i - 1] === '[' && stack.length % 2 === 1) ||
                    (i < input.length - 1 && input[i + 1] === '['))
            ) {
                stack.push(i);
            } else if (
                stack.length > 0 &&
                input[i] === ']' &&
                (i === input.length - 1 ||
                    (i > 0 && input[i - 1] === ']' && stack.length % 2 === 1) ||
                    (i < input.length - 1 && input[i + 1] === ']'))
            ) {
                const startIndex = stack.pop()!;

                if (startIndex + 1 < input.length && input[startIndex + 1] === '[' && input[i - 1] === ']') {
                    const length = i - startIndex + 1;
                    const substring = input.substring(startIndex, startIndex + length);

                    // Valid wikilink: stack is balanced (even) and text starts with [[ and ends with ]]
                    if (stack.length % 2 === 0 && substring.startsWith('[[') && substring.endsWith(']]')) {
                        const wikilink = new Wikilink(substring, startIndex);

                        if (recurseChildren) {
                            const innerContent = wikilink.linkText.substring(2, wikilink.linkText.length - 2);
                            wikilink.children = this.extractWikilinks(innerContent);
                        }

                        wikilinkResults.add(wikilink);
                    }
                }
            }
        }

        let result: Wikilink[];

        if (orderWikilinks) {
            // Order by length descending, then alphabetically for predictable ordering
            result = Array.from(wikilinkResults).sort(
                (a, b) => b.linkText.length - a.linkText.length || a.linkText.localeCompare(b.linkText)
            );
        } else {
            result = Array.from(wikilinkResults);
        }

        return result;
    }

    /**
     * Find the innermost wikilink at a given character offset within a line.
     *
     * Given a set of wikilinks extracted from a line, returns the smallest
     * (most deeply nested) wikilink whose range contains the offset.
     *
     * @param wikilinks - Wikilinks extracted from a single line
     * @param offsetInLine - Character offset within the line
     * @returns The innermost wikilink at the offset, or undefined
     */
    findInnermostWikilinkAtOffset(wikilinks: Wikilink[], offsetInLine: number): Wikilink | undefined {
        let best: Wikilink | undefined;

        for (const wl of wikilinks) {
            if (offsetInLine >= wl.startPositionInText && offsetInLine <= wl.endPositionInText) {
                if (!best || wl.length < best.length) {
                    best = wl;
                }
            }
        }

        return best;
    }

    /**
     * Compute non-overlapping link segments for a set of wikilinks.
     *
     * For nested wikilinks like `[[Outer [[Inner]] text]]`, this produces
     * segments where each character position maps to the innermost wikilink:
     *   - `[[Outer ` → outer link
     *   - `[[Inner]]` → inner link
     *   - ` text]]` → outer link
     *
     * Segmentation logic - segment is a contiguous range of text that belongs 
     * to a single wikilink target.
     *
     * @param wikilinks - All wikilinks extracted from a line (unordered)
     * @returns Array of non-overlapping segments, each with start/end offsets and target wikilink
     */
    computeLinkSegments(wikilinks: Wikilink[]): LinkSegment[] {
        if (wikilinks.length === 0) {
            return [];
        }

        // Determine the full extent of all wikilinks
        let minStart = Infinity;
        let maxEnd = -Infinity;
        for (const wl of wikilinks) {
            if (wl.startPositionInText < minStart) { minStart = wl.startPositionInText; }
            if (wl.endPositionInText > maxEnd) { maxEnd = wl.endPositionInText; }
        }

        // For each character position, find the innermost wikilink
        // Then group consecutive positions with the same innermost wikilink into segments
        const segments: LinkSegment[] = [];
        let currentWikilink: Wikilink | undefined;
        let segmentStart = minStart;

        for (let i = minStart; i <= maxEnd; i++) {
            const innermost = this.findInnermostWikilinkAtOffset(wikilinks, i);

            if (innermost !== currentWikilink) {
                // Close the previous segment
                if (currentWikilink) {
                    segments.push({
                        startOffset: segmentStart,
                        endOffset: i, // exclusive
                        wikilink: currentWikilink,
                    });
                }
                currentWikilink = innermost;
                segmentStart = i;
            }
        }

        // Close the final segment
        if (currentWikilink) {
            segments.push({
                startOffset: segmentStart,
                endOffset: maxEnd + 1, // exclusive
                wikilink: currentWikilink,
            });
        }

        return segments;
    }
}

/**
 * A non-overlapping segment of text that maps to a single wikilink target.
 */
export interface LinkSegment {
    /** Start character offset (inclusive) within the line. */
    startOffset: number;
    /** End character offset (exclusive) within the line. */
    endOffset: number;
    /** The wikilink this segment belongs to (innermost at this position). */
    wikilink: Wikilink;
}
