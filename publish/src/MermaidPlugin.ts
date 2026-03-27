/**
 * markdown-it plugin that transforms fenced code blocks with language `mermaid`
 * into `<pre class="mermaid">` elements for client-side rendering by mermaid.js.
 *
 * Instead of the default `<pre><code class="language-mermaid">...</code></pre>`,
 * this outputs `<pre class="mermaid">...</pre>` which is the standard format
 * that mermaid.js auto-renders via `mermaid.run()`.
 */

export function mermaidPlugin(md: any): void {
    const defaultFence = md.renderer.rules.fence;

    md.renderer.rules.fence = function (tokens: any[], idx: number, options: any, env: any, self: any): string {
        const token = tokens[idx];
        const info = (token.info || '').trim().toLowerCase();

        if (info === 'mermaid') {
            // Escape HTML entities in the diagram source to prevent XSS
            const escaped = md.utils.escapeHtml(token.content.trim());
            return `<pre class="mermaid">${escaped}</pre>\n`;
        }

        // Fall through to default renderer for all other fenced blocks
        if (defaultFence) {
            return defaultFence(tokens, idx, options, env, self);
        }
        return self.renderToken(tokens, idx, options);
    };
}
