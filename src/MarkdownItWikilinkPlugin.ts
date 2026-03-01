import { WikilinkService } from './WikilinkService.js';

/**
 * Resolver function that maps a wikilink page filename to a relative
 * href for use in the markdown preview.
 *
 * @param pageFileName — Sanitised page filename (without extension)
 * @param env — The markdown-it render environment (may contain currentDocument)
 * @returns A relative href string (e.g. "My%20Page.md" or "../archive/Topic.md")
 */
export type WikilinkResolverFn = (pageFileName: string, env: Record<string, any>) => string;

/**
 * markdown-it plugin that transforms `[[wikilinks]]` into clickable `<a>` links
 * in VS Code's markdown preview.
 *
 * Uses an inline rule that detects `[[...]]` patterns before the standard
 * markdown link parser runs. This prevents markdown formatting inside wikilinks
 * from being processed (e.g. `[[Page **Name**]]` is treated as a single link).
 *
 * Supports nested wikilinks: `[[Outer [[Inner]] text]]` produces three adjacent
 * links, each navigating to the correct target. Bracket delimiters (`[[`, `]]`)
 * are stripped from display text.
 *
 * @param md - The markdown-it instance to extend
 * @param options - Plugin options including the wikilink parser and link resolver
 */
export function wikilinkPlugin(
    md: any,
    options: { wikilinkService: WikilinkService; resolver: WikilinkResolverFn },
): void {
    md.inline.ruler.before('link', 'wikilink', (state: any, silent: boolean) => {
        return wikilinkInlineRule(state, silent, options.wikilinkService, options.resolver);
    });
}

/**
 * markdown-it inline rule that detects `[[...]]` patterns and emits link tokens.
 *
 * When `silent` is true the rule only reports whether it matches (no token output).
 * When false, it produces `link_open` / `text` / `link_close` token sequences
 * for each non-overlapping segment of the wikilink — handling nesting correctly.
 */
function wikilinkInlineRule(
    state: any,
    silent: boolean,
    wikilinkService: WikilinkService,
    resolver: WikilinkResolverFn,
): boolean {
    const src: string = state.src;
    const pos: number = state.pos;
    const max: number = state.posMax;

    // Need at least [[x]] — 5 characters
    if (pos + 4 >= max) return false;

    // Quick bail: current position must start with [[
    if (src.charCodeAt(pos) !== 0x5B /* [ */ || src.charCodeAt(pos + 1) !== 0x5B /* [ */) {
        return false;
    }

    // Respect max nesting level
    if (state.level >= state.md.options.maxNesting) return false;

    // Scan for the matching ]] at the outermost nesting level
    const endPos = findOutermostClose(src, pos, max);
    if (endPos === -1) return false;

    // Validation only — don't produce tokens
    if (silent) return true;

    // Parse the wikilink text using the full parser
    const fullText = src.substring(pos, endPos + 1);
    const wikilinks = wikilinkService.extractWikilinks(fullText, false, false);
    if (wikilinks.length === 0) return false;

    const segments = wikilinkService.computeLinkSegments(wikilinks);

    for (const segment of segments) {
        const segmentText = fullText.substring(segment.startOffset, segment.endOffset);
        const displayText = stripBrackets(segmentText);
        const href = resolver(segment.wikilink.pageFileName, state.env ?? {});

        if (displayText.length > 0) {
            const linkOpen = state.push('link_open', 'a', 1);
            linkOpen.attrs = [['href', href], ['class', 'wikilink']];
            linkOpen.markup = '[[';

            const text = state.push('text', '', 0);
            text.content = displayText;

            const linkClose = state.push('link_close', 'a', -1);
            linkClose.markup = ']]';
        }
    }

    state.pos = endPos + 1;
    return true;
}

/**
 * Scan forward from an opening `[[` to find the matching `]]` at the same
 * nesting depth. Handles nested `[[...]]` pairs correctly.
 *
 * @param src - Source text
 * @param pos - Position of the first `[` of the opening `[[`
 * @param max - Maximum position to scan (exclusive, typically src.length)
 * @returns Position of the last `]` of the closing `]]`, or -1 if not found
 */
function findOutermostClose(src: string, pos: number, max: number): number {
    let depth = 0;
    let i = pos;

    while (i < max) {
        if (i + 1 < max && src.charCodeAt(i) === 0x5B && src.charCodeAt(i + 1) === 0x5B) {
            depth++;
            i += 2;
        } else if (i + 1 < max && src.charCodeAt(i) === 0x5D && src.charCodeAt(i + 1) === 0x5D) {
            depth--;
            if (depth === 0) {
                return i + 1; // Position of the last ]
            }
            i += 2;
        } else {
            i++;
        }
    }

    return -1;
}

/**
 * Strip leading `[[` pairs and trailing `]]` pairs from a segment's display text.
 *
 * Handles all nesting levels:
 * - `[[My Page]]`  → `My Page`
 * - `[[Outer `     → `Outer `
 * - ` text]]`      → ` text`
 * - `[[Inner]]`    → `Inner`
 * - `[[[[Deep]]]]` → `Deep`
 */
export function stripBrackets(text: string): string {
    let start = 0;
    while (start + 1 < text.length && text[start] === '[' && text[start + 1] === '[') {
        start += 2;
    }
    let end = text.length;
    while (end - 2 >= start && text[end - 1] === ']' && text[end - 2] === ']') {
        end -= 2;
    }
    return text.substring(start, end);
}
