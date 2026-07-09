/**
 * dom.ts - the auto-escaping render primitive for the password-safe webview.
 *
 * Every `${…}` interpolation in an html`` template is HTML-escaped by default;
 * the ONLY ways to inject markup are a nested html`` result or an explicit
 * `raw()`. `setHtml` is the one sanctioned `innerHTML` assignment in the safe
 * webview - an ESLint rule bans bare `innerHTML` everywhere else, so a missed
 * escape cannot ship (see ADR-0005). Safe entry fields are untrusted input.
 */

/** A pre-escaped / trusted HTML fragment that passes through un-escaped. */
export class RawHtml {
    constructor(readonly value: string) {}
}

/** Escape text for insertion into HTML. */
export function escapeHtml(input: string): string {
    return input.replace(/[&<>"']/g, (c) =>
        c === '&' ? '&amp;'
            : c === '<' ? '&lt;'
                : c === '>' ? '&gt;'
                    : c === '"' ? '&quot;'
                        : '&#39;',
    );
}

/** Explicitly mark a string as trusted HTML. Use sparingly and audit each call. */
export function raw(value: string): RawHtml {
    return new RawHtml(value);
}

function serialize(value: unknown): string {
    if (value == null || value === false || value === true) {
        return '';
    }
    if (value instanceof RawHtml) {
        return value.value;
    }
    if (Array.isArray(value)) {
        return value.map(serialize).join('');
    }
    return escapeHtml(String(value));
}

/**
 * Tagged template that escapes every interpolation. Returns RawHtml so nested
 * html`` fragments compose without being double-escaped.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): RawHtml {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) {
        out += serialize(values[i]) + strings[i + 1];
    }
    return new RawHtml(out);
}

/** The single sanctioned innerHTML assignment. Only accepts RawHtml.
 *  `no-innerhtml.test.ts` allows innerHTML in this file and bans it elsewhere. */
export function setHtml(target: Element, content: RawHtml): void {
    (target as HTMLElement).innerHTML = content.value;
}
