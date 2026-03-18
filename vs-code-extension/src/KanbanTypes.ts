export type Priority = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'none';

export interface AssetMeta {
    filename: string;
    added: string;
    addedBy?: string;
}

/** Parsed entry from markdown body `## entry` headings. Read-only in the UI. */
export interface CardEntryDisplay {
    /** Date string from the heading (YYYY-MM-DD), if present. */
    date?: string;
    /** Title/summary text after the date on the heading line. */
    title?: string;
    /** Body text below the heading (until next ## entry or EOF). */
    body: string;
}

export interface Card {
    id: string;
    title: string;
    lane: string;
    created: string;
    updated: string;
    description: string;
    priority?: Priority;
    assignee?: string;
    labels?: string[];
    dueDate?: string;
    sortOrder?: number;
    slug?: string;
    /** When true, the card is waiting/blocked. Default false. */
    waiting?: boolean;
    /** Parsed from markdown body — never stored in frontmatter. */
    parsedEntries?: CardEntryDisplay[];
    assets?: AssetMeta[];
}

export interface BoardConfig {
    name: string;
    lanes: string[];
    users?: string[];
    labels?: string[];
}

export const DEFAULT_LANES: string[] = ['todo', 'doing', 'done'];

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
    name: '',
    lanes: [...DEFAULT_LANES],
};

export const PROTECTED_LANES = ['todo', 'done'];
export const RESERVED_LANES = ['archive'];

/** Directory name for board-level assets. */
export const ASSETS_DIR = 'assets';

/** Image file extensions displayed as thumbnails in the webview. */
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

/** Slugify a lane name: lowercase, non-alphanumeric→hyphens, trim edges. */
export function slugifyLane(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Slugify a board name: lowercase, non-alphanumeric→hyphens, trim edges. */
export function slugifyBoard(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Display a lane slug in the UI: UPPERCASE, hyphens→spaces. */
export function displayLane(slug: string): string {
    return slug.replace(/-/g, ' ').toUpperCase();
}

/** Display a board slug in the UI: Title Case, hyphens→spaces. */
export function displayBoard(slug: string): string {
    return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isProtectedLane(slug: string): boolean {
    return PROTECTED_LANES.includes(slug);
}

export function isReservedLane(slug: string): boolean {
    return RESERVED_LANES.includes(slug);
}

/** Check whether a filename has an image extension. */
export function isImageFile(filename: string): boolean {
    const lower = filename.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
