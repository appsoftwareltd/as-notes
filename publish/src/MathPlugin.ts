/**
 * markdown-it plugin that renders LaTeX math expressions using KaTeX.
 *
 * Supports:
 * - Inline math: `$...$`
 * - Display math: `$$...$$`
 * - Fenced code blocks with language `math` or `latex`
 *
 * Renders at build time using KaTeX's `renderToString()`, producing
 * self-contained HTML that requires only the KaTeX CSS stylesheet.
 * Invalid expressions render as the raw source in an error wrapper.
 */

import katex from 'katex';

/**
 * Render a LaTeX expression to HTML using KaTeX.
 * Returns the KaTeX HTML string, or an error-wrapped raw source on failure.
 */
function renderMath(source: string, displayMode: boolean): string {
    try {
        return katex.renderToString(source, {
            displayMode,
            throwOnError: false,
            output: 'htmlAndMathml',
        });
    } catch {
        const escaped = source
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const tag = displayMode ? 'div' : 'span';
        return `<${tag} class="math-error" title="Invalid LaTeX">${escaped}</${tag}>`;
    }
}

/**
 * Check whether a character at position `pos` is escaped by a preceding backslash.
 */
function isEscaped(src: string, pos: number): boolean {
    let backslashes = 0;
    for (let i = pos - 1; i >= 0; i--) {
        if (src[i] === '\\') backslashes++;
        else break;
    }
    return backslashes % 2 === 1;
}

export function mathPlugin(md: any): void {
    // --- 1. Fenced code blocks: ```math / ```latex ---

    const defaultFence = md.renderer.rules.fence;

    md.renderer.rules.fence = function (tokens: any[], idx: number, options: any, env: any, self: any): string {
        const token = tokens[idx];
        const info = (token.info || '').trim().toLowerCase();

        if (info === 'math' || info === 'latex') {
            const source = token.content.trim();
            if (!source) {
                return '';
            }
            return renderMath(source, true);
        }

        // Fall through to default (or the mermaid plugin's override)
        if (defaultFence) {
            return defaultFence(tokens, idx, options, env, self);
        }
        return self.renderToken(tokens, idx, options);
    };

    // --- 2. Block-level display math: $$ on its own line ---

    md.block.ruler.before('fence', 'math_block', (state: any, startLine: number, endLine: number, silent: boolean) => {
        const startPos = state.bMarks[startLine] + state.tShift[startLine];
        const startMax = state.eMarks[startLine];
        const lineText = state.src.slice(startPos, startMax).trim();

        // Opening line must be exactly $$ (optionally followed by whitespace)
        if (lineText !== '$$') return false;

        // Scan forward for closing $$
        let nextLine = startLine + 1;
        let found = false;
        while (nextLine < endLine) {
            const pos = state.bMarks[nextLine] + state.tShift[nextLine];
            const max = state.eMarks[nextLine];
            const line = state.src.slice(pos, max).trim();
            if (line === '$$') {
                found = true;
                break;
            }
            nextLine++;
        }

        if (!found) return false;
        if (silent) return true;

        // Collect content lines between opening and closing $$
        const contentLines: string[] = [];
        for (let i = startLine + 1; i < nextLine; i++) {
            const pos = state.bMarks[i] + state.tShift[i];
            const max = state.eMarks[i];
            contentLines.push(state.src.slice(pos, max));
        }
        const content = contentLines.join('\n').trim();

        if (!content) {
            // Empty math block - skip
            state.line = nextLine + 1;
            return true;
        }

        const token = state.push('math_block', 'div', 0);
        token.content = content;
        token.map = [startLine, nextLine + 1];
        state.line = nextLine + 1;
        return true;
    }, { alt: ['paragraph'] });

    md.renderer.rules.math_block = (tokens: any[], idx: number) => {
        return renderMath(tokens[idx].content, true);
    };

    // --- 3. Inline and display math via $ and $$ delimiters ---

    md.core.ruler.push('math_replace', (state: any) => {
        for (const token of state.tokens) {
            if (token.type !== 'inline' || !token.children) continue;

            const newChildren: any[] = [];
            for (const child of token.children) {
                if (child.type !== 'text' && child.type !== 'html_inline') {
                    newChildren.push(child);
                    continue;
                }

                const src = child.content;

                // Quick check: skip tokens that don't contain $
                if (!src.includes('$')) {
                    newChildren.push(child);
                    continue;
                }

                const parts = parseMathDelimiters(src);
                if (parts.length === 1 && parts[0].type === 'text') {
                    newChildren.push(child);
                    continue;
                }

                for (const part of parts) {
                    const tok = new state.Token(
                        part.type === 'text' ? child.type : 'html_inline',
                        '',
                        0,
                    );
                    tok.content = part.type === 'text'
                        ? part.content
                        : renderMath(part.content, part.type === 'display');
                    newChildren.push(tok);
                }
            }
            token.children = newChildren;
        }
    });
}

interface MathPart {
    type: 'text' | 'inline' | 'display';
    content: string;
}

/**
 * Parse a text string, extracting inline ($...$) and display ($$...$$) math regions.
 * Escaped \$ are treated as literal dollar signs.
 * Empty/whitespace-only math regions are not treated as math.
 */
export function parseMathDelimiters(src: string): MathPart[] {
    const parts: MathPart[] = [];
    let i = 0;
    let textStart = 0;

    while (i < src.length) {
        if (src[i] === '$' && !isEscaped(src, i)) {
            // Try display math first ($$...$$)
            if (i + 1 < src.length && src[i + 1] === '$') {
                const closeIdx = findClosingDouble(src, i + 2);
                if (closeIdx !== -1) {
                    const content = src.slice(i + 2, closeIdx);
                    if (content.trim().length > 0) {
                        if (i > textStart) {
                            parts.push({ type: 'text', content: src.slice(textStart, i) });
                        }
                        parts.push({ type: 'display', content: content.trim() });
                        i = closeIdx + 2;
                        textStart = i;
                        continue;
                    }
                }
            }

            // Try inline math ($...$)
            const closeIdx = findClosingSingle(src, i + 1);
            if (closeIdx !== -1) {
                const content = src.slice(i + 1, closeIdx);
                if (content.trim().length > 0) {
                    if (i > textStart) {
                        parts.push({ type: 'text', content: src.slice(textStart, i) });
                    }
                    parts.push({ type: 'inline', content: content.trim() });
                    i = closeIdx + 1;
                    textStart = i;
                    continue;
                }
            }
        }
        i++;
    }

    if (textStart < src.length) {
        parts.push({ type: 'text', content: src.slice(textStart) });
    }

    return parts;
}

/** Find the next unescaped `$$` starting from `start`. */
function findClosingDouble(src: string, start: number): number {
    for (let i = start; i < src.length - 1; i++) {
        if (src[i] === '$' && src[i + 1] === '$' && !isEscaped(src, i)) {
            return i;
        }
    }
    return -1;
}

/** Find the next unescaped `$` starting from `start`, ensuring it's not `$$`. */
function findClosingSingle(src: string, start: number): number {
    for (let i = start; i < src.length; i++) {
        if (src[i] === '$' && !isEscaped(src, i)) {
            // If followed by another $, it's a double delimiter - skip
            if (i + 1 < src.length && src[i + 1] === '$') {
                continue;
            }
            return i;
        }
    }
    return -1;
}
