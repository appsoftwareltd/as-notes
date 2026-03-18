/**
 * Pure-logic journal service -- no VS Code imports.
 * Handles date formatting and path construction for the daily journal feature.
 * Template processing is handled by TemplateService.
 */

/**
 * Format a Date as a journal filename: `YYYY-MM-DD.md`
 */
export function formatJournalFilename(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}.md`;
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
    /** Full path to the journal file, e.g. `/workspace/journals/2026-03-02.md` */
    journalFilePath: string;
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
        journalFolderPath: base,
    };
}
