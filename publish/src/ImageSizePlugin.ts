/**
 * markdown-it plugin honouring the AS Notes image size hint (ADR 0002):
 * an Obsidian-style pipe suffix at the end of image alt text —
 * `![alt|300](path)` (width px) or `![alt|300x200](path)` (width x height).
 *
 * Strips the pipe suffix from the alt text and emits width (and height,
 * when given) attributes on the <img> tag. In published HTML the hint is an
 * exact size — there is no granted-space concept outside the editor.
 */

const SIZE_HINT_REGEX = /\|(\d{1,5})(?:[xX](\d{1,5}))?\s*$/;

export function imageSizePlugin(md: any): void {
    const defaultRender = md.renderer.rules.image || function (tokens: any[], idx: number, options: any, _env: any, self: any): string {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.image = function (tokens: any[], idx: number, options: any, env: any, self: any): string {
        const token = tokens[idx];
        const altText: string = token.children
            ? self.renderInlineAsText(token.children, options, env)
            : (token.content || '');
        const match = SIZE_HINT_REGEX.exec(altText);
        if (match && match.index !== undefined) {
            const width = parseInt(match[1], 10);
            if (Number.isFinite(width) && width >= 1) {
                token.attrSet('width', String(width));
                if (match[2] !== undefined) {
                    const height = parseInt(match[2], 10);
                    if (Number.isFinite(height) && height >= 1) {
                        token.attrSet('height', String(height));
                    }
                }
                stripSizeHint(token);
            }
        }
        return defaultRender(tokens, idx, options, env, self);
    };
}

/**
 * Removes the size hint from the token so the rendered alt attribute reads
 * clean. The hint always sits at the end of the alt text, so it lives at the
 * end of the last non-empty child token.
 */
function stripSizeHint(token: { content: string; children: Array<{ content: string }> | null }): void {
    token.content = token.content.replace(SIZE_HINT_REGEX, '');
    if (!token.children) {
        return;
    }
    for (let i = token.children.length - 1; i >= 0; i--) {
        const child = token.children[i];
        if (!child.content) {
            continue;
        }
        child.content = child.content.replace(SIZE_HINT_REGEX, '');
        break;
    }
}
