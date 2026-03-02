/**
 * Pure-logic journal service — no VS Code imports.
 * Handles date formatting, template processing, and path construction
 * for the daily journal feature.
 */

/** Default template content for new journal_template.md files */
export const DEFAULT_TEMPLATE = '# YYYY-MM-DD\n';

/** Template filename */
export const TEMPLATE_FILENAME = 'journal_template.md';

/** Placeholder token replaced with the actual date in templates */
const DATE_PLACEHOLDER = 'YYYY-MM-DD';

/**
 * Format a Date as a journal filename: `YYYY_MM_DD.md`
 */
export function formatJournalFilename(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}_${m}_${d}.md`;
}

/**
 * Format a Date as the content date string: `YYYY-MM-DD`
 */
export function formatJournalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Replace all occurrences of `YYYY-MM-DD` in template content
 * with the formatted date for the given Date.
 */
export function applyTemplate(templateContent: string, date: Date): string {
    const formatted = formatJournalDate(date);
    return templateContent.replaceAll(DATE_PLACEHOLDER, formatted);
}

/**
 * Strip leading/trailing slashes and whitespace from a journal folder path.
 * Returns empty string if the input is blank (meaning workspace root).
 */
export function normaliseJournalFolder(folder: string): string {
    return folder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
}

/**
 * Paths needed for the daily journal workflow.
 */
export interface JournalPaths {
    /** Full path to the journal file, e.g. `/workspace/journals/2026_03_02.md` */
    journalFilePath: string;
    /** Full path to the template file, e.g. `/workspace/journals/journal_template.md` */
    templateFilePath: string;
    /** Full path to the journal folder, e.g. `/workspace/journals` */
    journalFolderPath: string;
}

/**
 * Compute the full file-system paths for the journal file, template, and folder.
 *
 * @param workspaceRoot Absolute path to the workspace root (no trailing slash)
 * @param journalFolder Configured journal folder (may need normalisation)
 * @param date The target date
 */
export function computeJournalPaths(
    workspaceRoot: string,
    journalFolder: string,
    date: Date,
): JournalPaths {
    const normalised = normaliseJournalFolder(journalFolder);
    const base = normalised
        ? `${workspaceRoot}/${normalised}`
        : workspaceRoot;

    return {
        journalFilePath: `${base}/${formatJournalFilename(date)}`,
        templateFilePath: `${base}/${TEMPLATE_FILENAME}`,
        journalFolderPath: base,
    };
}
