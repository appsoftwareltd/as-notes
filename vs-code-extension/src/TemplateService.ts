/**
 * Pure-logic template service -- no VS Code imports.
 * Handles placeholder replacement, path construction, and template folder
 * normalisation for the note templates feature.
 */

/** Default journal template content for new Journal.md files */
export const DEFAULT_JOURNAL_TEMPLATE = '# {{date}}\n';

/** Well-known template filename used for daily journal entries */
export const JOURNAL_TEMPLATE_FILENAME = 'Journal.md';

/** Sentinel replaced with a VS Code snippet tabstop after placeholder processing */
export const CURSOR_SENTINEL = '\0CURSOR\0';

/**
 * Context values available for placeholder replacement.
 */
export interface TemplateContext {
    /** Current date/time */
    now: Date;
    /** Active file name without extension (e.g. "My Page") */
    filename: string;
}

/**
 * Strip leading/trailing slashes and whitespace from a template folder path.
 * Returns empty string if the input is blank (meaning workspace root).
 */
export function normaliseTemplateFolder(folder: string): string {
    return folder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
}

/**
 * Compute the absolute path to the templates folder.
 */
export function computeTemplateFolderPath(
    workspaceRoot: string,
    templateFolder: string,
): string {
    const normalised = normaliseTemplateFolder(templateFolder);
    return normalised
        ? `${workspaceRoot}/${normalised}`
        : workspaceRoot;
}

/**
 * Format date components from a Date object.
 */
function dateComponents(date: Date): {
    YYYY: string;
    MM: string;
    DD: string;
    HH: string;
    mm: string;
    ss: string;
} {
    return {
        YYYY: String(date.getFullYear()),
        MM: String(date.getMonth() + 1).padStart(2, '0'),
        DD: String(date.getDate()).padStart(2, '0'),
        HH: String(date.getHours()).padStart(2, '0'),
        mm: String(date.getMinutes()).padStart(2, '0'),
        ss: String(date.getSeconds()).padStart(2, '0'),
    };
}

/**
 * Replace date format tokens (YYYY, MM, DD, HH, mm, ss) in a string
 * with actual date values.
 */
function applyDateTokens(format: string, date: Date): string {
    const c = dateComponents(date);
    return format
        .replace(/YYYY/g, c.YYYY)
        .replace(/MM/g, c.MM)
        .replace(/DD/g, c.DD)
        .replace(/HH/g, c.HH)
        .replace(/mm/g, c.mm)
        .replace(/ss/g, c.ss);
}

/**
 * Check if a placeholder body contains only date format tokens and separators.
 * Date format tokens: YYYY, MM, DD, HH, mm, ss
 * Remaining characters after token removal must be non-alpha separators.
 */
function isDateFormatString(body: string): boolean {
    const stripped = body
        .replace(/YYYY/g, '')
        .replace(/MM/g, '')
        .replace(/DD/g, '')
        .replace(/HH/g, '')
        .replace(/mm/g, '')
        .replace(/ss/g, '');
    // If nothing was stripped, it's not a date format
    if (stripped === body) return false;
    // Remaining chars must be non-alphanumeric separators
    return /^[^a-zA-Z0-9]*$/.test(stripped);
}

/** Named placeholders and their resolvers */
const NAMED_PLACEHOLDERS: Record<string, (ctx: TemplateContext) => string> = {
    date: (ctx) => {
        const c = dateComponents(ctx.now);
        return `${c.YYYY}-${c.MM}-${c.DD}`;
    },
    time: (ctx) => {
        const c = dateComponents(ctx.now);
        return `${c.HH}:${c.mm}:${c.ss}`;
    },
    datetime: (ctx) => {
        const c = dateComponents(ctx.now);
        return `${c.YYYY}-${c.MM}-${c.DD} ${c.HH}:${c.mm}:${c.ss}`;
    },
    filename: (ctx) => ctx.filename,
    title: (ctx) => ctx.filename,
    cursor: () => CURSOR_SENTINEL,
};

/**
 * Apply all template placeholders to content.
 *
 * Placeholder syntax: `{{name}}` or `{{date-format-string}}`
 * Escape syntax: `\{{name}}` produces literal `{{name}}`
 *
 * Named placeholders: date, time, datetime, filename, title, cursor
 * Custom date formats: any combination of YYYY, MM, DD, HH, mm, ss tokens
 * Unknown placeholders are left as-is.
 */
export function applyTemplatePlaceholders(
    content: string,
    context: TemplateContext,
): string {
    // First pass: protect escaped placeholders by replacing \{{ with a sentinel
    const ESCAPE_SENTINEL = '\0ESC_OPEN\0';
    let result = content.replace(/\\{{/g, ESCAPE_SENTINEL);

    // Replace all {{...}} placeholders
    result = result.replace(/{{([^}]+)}}/g, (_match, body: string) => {
        const trimmed = body.trim();

        // Check named placeholders
        const resolver = NAMED_PLACEHOLDERS[trimmed];
        if (resolver) {
            return resolver(context);
        }

        // Check if it's a custom date format string
        if (isDateFormatString(trimmed)) {
            return applyDateTokens(trimmed, context.now);
        }

        // Unknown placeholder -- leave as-is
        return _match;
    });

    // Restore escaped placeholders as literal {{
    result = result.replace(new RegExp(ESCAPE_SENTINEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '{{');

    return result;
}
