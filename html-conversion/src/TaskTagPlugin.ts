/**
 * markdown-it plugin that transforms task list items:
 *
 * 1. Converts `[ ]` / `[x]` checkbox text into `<input type="checkbox">` elements
 * 2. Transforms leading hashtags into styled badge spans
 *
 * Only transforms content within task list items (lines matching `- [ ]` or `- [x]`).
 * Tags embedded mid-sentence are left as-is.
 *
 * Recognised tags:
 *   #P1, #P2, #P3  → Priority 1/2/3
 *   #W              → Waiting
 *   #D-YYYY-MM-DD   → Due YYYY-MM-DD
 *   #C-YYYY-MM-DD   → Completed YYYY-MM-DD
 */

const TAG_RE = /^(#P([123])|#W|#D-(\d{4}-\d{2}-\d{2})|#C-(\d{4}-\d{2}-\d{2}))\s*/;
const TASK_CHECKBOX_RE = /^\[([ xX])\]\s*/;

function tagToHtml(fullMatch: string, p: string | undefined, d: string | undefined, c: string | undefined): string {
    if (p) {
        return `<span class="task-tag priority-${p}">Priority ${p}</span>`;
    }
    if (fullMatch.startsWith('#W')) {
        return '<span class="task-tag waiting">Waiting</span>';
    }
    if (d) {
        return `<span class="task-tag due-date">Due ${d}</span>`;
    }
    if (c) {
        return `<span class="task-tag completed-date">Completed ${c}</span>`;
    }
    return fullMatch;
}

function transformTaskTags(content: string): string {
    // Must start with a checkbox pattern (markdown-it strips the `- ` list prefix
    // into list_item tokens, so the inline content starts with `[ ] ` or `[x] `)
    const cbMatch = content.match(TASK_CHECKBOX_RE);
    if (!cbMatch) { return content; }

    // Replace checkbox text with HTML input element
    const isChecked = cbMatch[1] !== ' ';
    const checkboxHtml = isChecked
        ? '<input type="checkbox" checked disabled> '
        : '<input type="checkbox" disabled> ';

    let pos = cbMatch[0].length;
    const parts: string[] = [checkboxHtml];
    let rest = content.slice(pos);

    let m: RegExpMatchArray | null;
    while ((m = rest.match(TAG_RE)) !== null) {
        parts.push(tagToHtml(m[1], m[2], m[3], m[4]));
        // Keep the trailing space between badges (or before text)
        if (m[0].length > m[1].length) {
            parts.push(' ');
        }
        rest = rest.slice(m[0].length);
    }

    parts.push(rest);
    return parts.join('');
}

export function taskTagPlugin(md: any): void {
    md.core.ruler.push('task_tag', (state: any) => {
        const tokens = state.tokens;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type !== 'inline' || !token.children) { continue; }

            // Check if this inline token contains a task checkbox
            const firstTextChild = token.children.find((c: any) => c.type === 'text');
            if (!firstTextChild || !TASK_CHECKBOX_RE.test(firstTextChild.content)) { continue; }

            // Transform the text content (checkbox + tags)
            const newChildren: any[] = [];
            for (const child of token.children) {
                if (child.type !== 'text') {
                    newChildren.push(child);
                    continue;
                }

                const transformed = transformTaskTags(child.content);
                if (transformed === child.content) {
                    newChildren.push(child);
                    continue;
                }

                const htmlToken = new state.Token('html_inline', '', 0);
                htmlToken.content = transformed;
                newChildren.push(htmlToken);
            }

            token.children = newChildren;

            // Walk backwards to find the parent list_item_open and bullet_list_open
            // to add CSS classes
            for (let j = i - 1; j >= 0; j--) {
                if (tokens[j].type === 'list_item_open') {
                    tokens[j].attrJoin('class', 'task-list-item');
                    break;
                }
            }
            for (let j = i - 1; j >= 0; j--) {
                if (tokens[j].type === 'bullet_list_open') {
                    // Only add if not already present
                    const existing = tokens[j].attrGet('class') || '';
                    if (!existing.includes('task-list')) {
                        tokens[j].attrJoin('class', 'task-list');
                    }
                    break;
                }
            }
        }
    });
}
