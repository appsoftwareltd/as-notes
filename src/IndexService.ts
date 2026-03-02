import initSqlJs, { type Database } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import { WikilinkService } from './WikilinkService.js';
import { Wikilink } from './Wikilink.js';
import { FrontMatterService } from './FrontMatterService.js';

// ── Row types ──────────────────────────────────────────────────────────────

export interface PageRow {
    id: number;
    path: string;
    filename: string;
    title: string;
    mtime: number;
    indexed_at: number;
}

export interface LinkRow {
    id: number;
    source_page_id: number;
    page_name: string;
    page_filename: string;
    line: number;
    start_col: number;
    end_col: number;
    context: string | null;
    parent_link_id: number | null;
    depth: number;
}

export interface LinkInsert {
    page_name: string;
    page_filename: string;
    line: number;
    start_col: number;
    end_col: number;
    context: string | null;
    parent_link_id: number | null;
    depth: number;
}

export interface AliasRow {
    id: number;
    canonical_page_id: number;
    alias_name: string;
    alias_filename: string;
}

export interface ScanSummary {
    newFiles: number;
    staleFiles: number;
    deletedFiles: number;
    unchanged: number;
}

export interface TaskRow {
    id: number;
    source_page_id: number;
    line: number;
    text: string;
    done: number;
    line_text: string;
}

export interface BacklinkEntry {
    link: LinkRow;
    sourcePage: PageRow;
}

// ── Schema ─────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    title TEXT NOT NULL,
    mtime INTEGER NOT NULL,
    indexed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY,
    source_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    page_name TEXT NOT NULL,
    page_filename TEXT NOT NULL,
    line INTEGER NOT NULL,
    start_col INTEGER NOT NULL,
    end_col INTEGER NOT NULL,
    context TEXT,
    parent_link_id INTEGER REFERENCES links(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS aliases (
    id INTEGER PRIMARY KEY,
    canonical_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    alias_name TEXT NOT NULL,
    alias_filename TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_page_id);
CREATE INDEX IF NOT EXISTS idx_links_page_filename ON links(page_filename);
CREATE INDEX IF NOT EXISTS idx_links_page_name ON links(page_name);
CREATE INDEX IF NOT EXISTS idx_aliases_alias_name ON aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_aliases_canonical ON aliases(canonical_page_id);
CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(path);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    source_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    line INTEGER NOT NULL,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    line_text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source_page_id);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
`;

// ── Title extraction ───────────────────────────────────────────────────────

/**
 * Extract the page title from markdown content.
 * Uses the first `# heading` found. Falls back to the filename stem.
 */
export function extractTitle(content: string, filename: string): string {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/^#\s+(.+)$/);
        if (match) {
            return match[1].trim();
        }
    }
    // Fallback: filename without extension
    const ext = path.extname(filename);
    return ext ? filename.slice(0, -ext.length) : filename;
}

// ── IndexService ───────────────────────────────────────────────────────────

export class IndexService {
    private db: Database | null = null;
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    /**
     * Initialise the database. Opens an existing file or creates a new one.
     * Creates the schema tables if they don't already exist.
     */
    async initDatabase(): Promise<void> {
        const SQL = await initSqlJs();

        if (fs.existsSync(this.dbPath)) {
            const fileBuffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(fileBuffer);
        } else {
            this.db = new SQL.Database();
        }

        // Enable foreign key enforcement
        this.db.run('PRAGMA foreign_keys = ON;');
        this.db.run(SCHEMA_SQL);
    }

    /**
     * Initialise from an in-memory database (for testing — no file I/O).
     */
    async initInMemory(): Promise<void> {
        const SQL = await initSqlJs();
        this.db = new SQL.Database();
        this.db.run('PRAGMA foreign_keys = ON;');
        this.db.run(SCHEMA_SQL);
    }

    /**
     * Persist the in-memory database to the file at `dbPath`.
     * If the parent directory does not exist (e.g. `.asnotes/` was deleted),
     * the write is silently skipped — the directory should only be created
     * by the explicit init command.
     */
    saveToFile(): void {
        if (!this.db) { return; }
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) { return; }
        const data = this.db.export();
        fs.writeFileSync(this.dbPath, Buffer.from(data));
    }

    /**
     * Close the database connection.
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /** Whether the database is currently open. */
    get isOpen(): boolean {
        return this.db !== null;
    }

    // ── Pages CRUD ─────────────────────────────────────────────────────────

    /**
     * Insert or update a page record. Returns the page id.
     */
    upsertPage(pagePath: string, filename: string, title: string, mtime: number): number {
        this.ensureOpen();
        const now = Date.now();

        // Try update first
        this.db!.run(
            `UPDATE pages SET filename = ?, title = ?, mtime = ?, indexed_at = ? WHERE path = ?`,
            [filename, title, mtime, now, pagePath],
        );

        const changes = this.db!.getRowsModified();
        if (changes > 0) {
            const result = this.db!.exec(`SELECT id FROM pages WHERE path = ?`, [pagePath]);
            return result[0].values[0][0] as number;
        }

        // Insert new
        this.db!.run(
            `INSERT INTO pages (path, filename, title, mtime, indexed_at) VALUES (?, ?, ?, ?, ?)`,
            [pagePath, filename, title, mtime, now],
        );

        const result = this.db!.exec(`SELECT last_insert_rowid()`);
        return result[0].values[0][0] as number;
    }

    /**
     * Remove a page and all its links (cascade).
     */
    removePage(pagePath: string): void {
        this.ensureOpen();
        // Manual cascade since sql.js may not enforce FK cascades on DELETE in all modes
        const page = this.getPageByPath(pagePath);
        if (page) {
            this.db!.run(`DELETE FROM links WHERE source_page_id = ?`, [page.id]);
            this.db!.run(`DELETE FROM aliases WHERE canonical_page_id = ?`, [page.id]);
            this.db!.run(`DELETE FROM tasks WHERE source_page_id = ?`, [page.id]);
            this.db!.run(`DELETE FROM pages WHERE id = ?`, [page.id]);
        }
    }

    /**
     * Get a page by its workspace-relative path.
     */
    getPageByPath(pagePath: string): PageRow | undefined {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT id, path, filename, title, mtime, indexed_at FROM pages WHERE path = ?`,
            [pagePath],
        );
        if (result.length === 0 || result[0].values.length === 0) {
            return undefined;
        }
        const row = result[0].values[0];
        return {
            id: row[0] as number,
            path: row[1] as string,
            filename: row[2] as string,
            title: row[3] as string,
            mtime: row[4] as number,
            indexed_at: row[5] as number,
        };
    }

    /**
     * Get a page by its numeric ID.
     */
    getPageById(pageId: number): PageRow | undefined {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT id, path, filename, title, mtime, indexed_at FROM pages WHERE id = ?`,
            [pageId],
        );
        if (result.length === 0 || result[0].values.length === 0) {
            return undefined;
        }
        const row = result[0].values[0];
        return {
            id: row[0] as number,
            path: row[1] as string,
            filename: row[2] as string,
            title: row[3] as string,
            mtime: row[4] as number,
            indexed_at: row[5] as number,
        };
    }

    /**
     * Get all pages in the index.
     */
    getAllPages(): PageRow[] {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT id, path, filename, title, mtime, indexed_at FROM pages`,
        );
        if (result.length === 0) { return []; }
        return result[0].values.map(row => ({
            id: row[0] as number,
            path: row[1] as string,
            filename: row[2] as string,
            title: row[3] as string,
            mtime: row[4] as number,
            indexed_at: row[5] as number,
        }));
    }

    // ── Links CRUD ─────────────────────────────────────────────────────────

    /**
     * Replace all links for a page. Deletes existing links and inserts the new set.
     * Returns the inserted link ids in the same order as the input array.
     */
    setLinksForPage(pageId: number, links: LinkInsert[]): number[] {
        this.ensureOpen();

        // Delete existing links for this page
        this.db!.run(`DELETE FROM links WHERE source_page_id = ?`, [pageId]);

        const ids: number[] = [];
        for (const link of links) {
            this.db!.run(
                `INSERT INTO links (source_page_id, page_name, page_filename, line, start_col, end_col, context, parent_link_id, depth)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [pageId, link.page_name, link.page_filename, link.line, link.start_col, link.end_col, link.context, link.parent_link_id, link.depth],
            );
            const result = this.db!.exec(`SELECT last_insert_rowid()`);
            ids.push(result[0].values[0][0] as number);
        }

        return ids;
    }

    /**
     * Get all links originating from a page.
     */
    getLinksForPage(pageId: number): LinkRow[] {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT id, source_page_id, page_name, page_filename, line, start_col, end_col, context, parent_link_id, depth
             FROM links WHERE source_page_id = ?`,
            [pageId],
        );
        if (result.length === 0) { return []; }
        return this.mapLinkRows(result[0].values);
    }

    /**
     * Get all links pointing to a given page filename (back-links).
     */
    getBacklinks(pageFilename: string): LinkRow[] {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT l.id, l.source_page_id, l.page_name, l.page_filename, l.line, l.start_col, l.end_col, l.context, l.parent_link_id, l.depth
             FROM links l WHERE l.page_filename = ?`,
            [pageFilename],
        );
        if (result.length === 0) { return []; }
        return this.mapLinkRows(result[0].values);
    }

    /**
     * Get the count of back-links pointing to a given page filename.
     * Optimised for hover tooltip display.
     */
    getBacklinkCount(pageFilename: string): number {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT COUNT(*) FROM links WHERE page_filename = ?`,
            [pageFilename],
        );
        if (result.length === 0) { return 0; }
        return result[0].values[0][0] as number;
    }

    /**
     * Update link references when a page is renamed.
     * Updates both the page record and all links pointing to it.
     */
    updateRename(oldPageFilename: string, newPageName: string, newPageFilename: string): void {
        this.ensureOpen();
        // Update links referencing the old filename
        this.db!.run(
            `UPDATE links SET page_name = ?, page_filename = ? WHERE page_filename = ?`,
            [newPageName, newPageFilename, oldPageFilename],
        );
    }

    /**
     * Update a page's path and filename (after file rename).
     */
    updatePagePath(oldPath: string, newPath: string, newFilename: string): void {
        this.ensureOpen();
        this.db!.run(
            `UPDATE pages SET path = ?, filename = ? WHERE path = ?`,
            [newPath, newFilename, oldPath],
        );
    }

    // ── File content indexing ────────────────────────────────────────────

    /**
     * Index a file's content into the database. Parses wikilinks from the content,
     * extracts the title, and upserts the page + links.
     *
     * This is the pure (no VS Code dependency) indexing method. The scanner layer
     * reads files from disk and calls this method with the content.
     *
     * @param relativePath - Workspace-relative path (e.g. "notes/My Page.md")
     * @param filename - Just the filename (e.g. "My Page.md")
     * @param content - Full text content of the file
     * @param mtime - Last modification time (epoch ms)
     * @returns The page id
     */
    indexFileContent(relativePath: string, filename: string, content: string, mtime: number): number {
        const title = extractTitle(content, filename);
        const pageId = this.upsertPage(relativePath, filename, title, mtime);

        this.setLinksForPageWithNesting(pageId, content);
        this.indexAliasesFromContent(pageId, content);
        this.indexTasksFromContent(pageId, content);

        return pageId;
    }

    /**
     * Parse file content and build LinkInsert records for all wikilinks found.
     * Handles nesting by tracking parent link ids and depth.
     */
    buildLinksFromContent(content: string): LinkInsert[] {
        const wikilinkService = new WikilinkService();
        const lines = content.split(/\r?\n/);
        const allLinks: LinkInsert[] = [];

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const lineText = lines[lineNum];
            const wikilinks = wikilinkService.extractWikilinks(lineText, false, false);

            if (wikilinks.length === 0) { continue; }

            // Sort by size descending (outermost first) for parent tracking
            const sorted = [...wikilinks].sort((a, b) => b.length - a.length);

            // Build flat list with nesting info
            // We use a placeholder for parent_link_id since we don't know DB ids yet.
            // Instead, we track nesting by index and set parent_link_id after insert.
            for (const wl of sorted) {
                const depth = this.computeDepth(wl, sorted);
                const parentWl = this.findParentWikilink(wl, sorted);

                allLinks.push({
                    page_name: wl.pageName,
                    page_filename: `${wl.pageFileName}.md`,
                    line: lineNum,
                    start_col: wl.startPositionInText,
                    end_col: wl.endPositionInText,
                    context: lineText,
                    parent_link_id: null, // Will be set in a second pass if needed
                    depth,
                    _parentIndex: parentWl ? sorted.indexOf(parentWl) : -1,
                    _lineOffset: allLinks.length - (allLinks.length > 0 ? allLinks.filter(l => l.line === lineNum).length - allLinks.filter(l => l.line === lineNum).length : 0),
                } as LinkInsert & { _parentIndex: number; _lineOffset: number });
            }
        }

        return allLinks;
    }

    /**
     * Insert links for a page with correct parent_link_id references for nested links.
     * Handles the two-pass insert: first insert all links, then update parent references.
     */
    setLinksForPageWithNesting(pageId: number, content: string): number[] {
        const wikilinkService = new WikilinkService();
        const lines = content.split(/\r?\n/);

        // Delete existing links
        this.ensureOpen();
        this.db!.run(`DELETE FROM links WHERE source_page_id = ?`, [pageId]);

        const allIds: number[] = [];

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const lineText = lines[lineNum];
            const wikilinks = wikilinkService.extractWikilinks(lineText, false, false);
            if (wikilinks.length === 0) { continue; }

            // Sort outermost first (largest range)
            const sorted = [...wikilinks].sort((a, b) => b.length - a.length);

            // First pass: insert all links with null parent_link_id
            const wlToId = new Map<Wikilink, number>();
            for (const wl of sorted) {
                const depth = this.computeDepth(wl, sorted);
                this.db!.run(
                    `INSERT INTO links (source_page_id, page_name, page_filename, line, start_col, end_col, context, parent_link_id, depth)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [pageId, wl.pageName, `${wl.pageFileName}.md`, lineNum, wl.startPositionInText, wl.endPositionInText, lineText, null, depth],
                );
                const result = this.db!.exec(`SELECT last_insert_rowid()`);
                const linkId = result[0].values[0][0] as number;
                wlToId.set(wl, linkId);
                allIds.push(linkId);
            }

            // Second pass: set parent_link_id for nested links
            for (const wl of sorted) {
                const parent = this.findParentWikilink(wl, sorted);
                if (parent) {
                    const childId = wlToId.get(wl)!;
                    const parentId = wlToId.get(parent)!;
                    this.db!.run(
                        `UPDATE links SET parent_link_id = ? WHERE id = ?`,
                        [parentId, childId],
                    );
                }
            }
        }

        return allIds;
    }

    /**
     * Compute the nesting depth of a wikilink relative to other wikilinks on the same line.
     * Depth 0 = top-level (not contained by any other wikilink).
     */
    private computeDepth(wl: Wikilink, allWikilinks: Wikilink[]): number {
        let depth = 0;
        for (const other of allWikilinks) {
            if (other === wl) { continue; }
            if (other.startPositionInText <= wl.startPositionInText &&
                other.endPositionInText >= wl.endPositionInText &&
                other.length > wl.length) {
                depth++;
            }
        }
        return depth;
    }

    /**
     * Find the immediate parent wikilink (smallest containing wikilink that is larger).
     */
    private findParentWikilink(wl: Wikilink, allWikilinks: Wikilink[]): Wikilink | undefined {
        let best: Wikilink | undefined;
        for (const other of allWikilinks) {
            if (other === wl) { continue; }
            if (other.startPositionInText <= wl.startPositionInText &&
                other.endPositionInText >= wl.endPositionInText &&
                other.length > wl.length) {
                if (!best || other.length < best.length) {
                    best = other;
                }
            }
        }
        return best;
    }

    // ── Aliases ────────────────────────────────────────────────────────────

    /**
     * Parse and store aliases from file content for a given page.
     * Clears existing aliases for the page before inserting new ones.
     */
    private indexAliasesFromContent(pageId: number, content: string): void {
        const frontMatterService = new FrontMatterService();
        const aliasNames = frontMatterService.parseAliases(content);
        this.setAliasesForPage(pageId, aliasNames);
    }

    /**
     * Replace all aliases for a page with the given alias names.
     * Sanitises each alias name into a filename using the same rules as wikilinks.
     */
    setAliasesForPage(pageId: number, aliasNames: string[]): void {
        this.ensureOpen();
        this.db!.run(`DELETE FROM aliases WHERE canonical_page_id = ?`, [pageId]);

        const invalids = /[\/\?<>\\:\*\|":]/g;
        for (const name of aliasNames) {
            const filename = `${name.replace(invalids, '_')}.md`;
            this.db!.run(
                `INSERT INTO aliases (canonical_page_id, alias_name, alias_filename) VALUES (?, ?, ?)`,
                [pageId, name, filename],
            );
        }
    }

    /**
     * Get all aliases for a specific page.
     */
    getAliasesForPage(pageId: number): AliasRow[] {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT id, canonical_page_id, alias_name, alias_filename FROM aliases WHERE canonical_page_id = ?`,
            [pageId],
        );
        if (result.length === 0) { return []; }
        return result[0].values.map(row => ({
            id: row[0] as number,
            canonical_page_id: row[1] as number,
            alias_name: row[2] as string,
            alias_filename: row[3] as string,
        }));
    }

    /**
     * Get all aliases in the index, joined with their canonical page info.
     */
    getAllAliases(): (AliasRow & { canonical_path: string; canonical_filename: string })[] {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT a.id, a.canonical_page_id, a.alias_name, a.alias_filename, p.path, p.filename
             FROM aliases a
             JOIN pages p ON a.canonical_page_id = p.id
             ORDER BY a.alias_name`,
        );
        if (result.length === 0) { return []; }
        return result[0].values.map(row => ({
            id: row[0] as number,
            canonical_page_id: row[1] as number,
            alias_name: row[2] as string,
            alias_filename: row[3] as string,
            canonical_path: row[4] as string,
            canonical_filename: row[5] as string,
        }));
    }

    /**
     * Get all "forward-referenced" pages — link targets that are referenced by at
     * least one wikilink but have no corresponding entry in the `pages` table (i.e.
     * the file has not been created yet).
     *
     * These are returned as distinct (page_name, page_filename) pairs, sorted
     * case-insensitively by page_name, and are useful for surfacing unresolved
     * links as autocomplete candidates before the file is created.
     */
    getForwardReferencedPages(): { page_name: string; page_filename: string }[] {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT DISTINCT l.page_name, l.page_filename
             FROM links l
             LEFT JOIN pages p ON p.filename = l.page_filename
             LEFT JOIN aliases a ON LOWER(a.alias_filename) = LOWER(l.page_filename)
             WHERE p.id IS NULL
               AND a.id IS NULL
             ORDER BY l.page_name COLLATE NOCASE`,
        );
        if (result.length === 0) { return []; }
        return result[0].values.map(row => ({
            page_name: row[0] as string,
            page_filename: row[1] as string,
        }));
    }

    /**
     * Resolve an alias name to its canonical page. Returns the page row or undefined.
     * Case-insensitive match on alias_name.
     */
    resolveAlias(aliasName: string): PageRow | undefined {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT p.id, p.path, p.filename, p.title, p.mtime, p.indexed_at
             FROM aliases a
             JOIN pages p ON a.canonical_page_id = p.id
             WHERE LOWER(a.alias_name) = LOWER(?)`,
            [aliasName],
        );
        if (result.length === 0 || result[0].values.length === 0) {
            return undefined;
        }
        const row = result[0].values[0];
        return {
            id: row[0] as number,
            path: row[1] as string,
            filename: row[2] as string,
            title: row[3] as string,
            mtime: row[4] as number,
            indexed_at: row[5] as number,
        };
    }

    /**
     * Resolve a page filename to a page. Checks direct filename match first,
     * then alias match. Returns the page and whether it matched via alias.
     */
    resolvePageByFilename(pageFilename: string): { page: PageRow; viaAlias: boolean } | undefined {
        this.ensureOpen();
        // Direct match first
        const directResult = this.db!.exec(
            `SELECT id, path, filename, title, mtime, indexed_at FROM pages WHERE LOWER(filename) = LOWER(?)`,
            [pageFilename],
        );
        if (directResult.length > 0 && directResult[0].values.length > 0) {
            const row = directResult[0].values[0];
            return {
                page: {
                    id: row[0] as number,
                    path: row[1] as string,
                    filename: row[2] as string,
                    title: row[3] as string,
                    mtime: row[4] as number,
                    indexed_at: row[5] as number,
                },
                viaAlias: false,
            };
        }
        // Alias match: strip .md extension to get alias name
        const aliasName = pageFilename.endsWith('.md') ? pageFilename.slice(0, -3) : pageFilename;
        const aliasPage = this.resolveAlias(aliasName);
        if (aliasPage) {
            return { page: aliasPage, viaAlias: true };
        }
        return undefined;
    }

    /**
     * Get backlink count including links that target a page via aliases.
     * Counts both direct filename references and alias filename references.
     */
    getBacklinkCountIncludingAliases(pageId: number): number {
        this.ensureOpen();
        // Get the page's own filename
        const pageResult = this.db!.exec(
            `SELECT filename FROM pages WHERE id = ?`, [pageId],
        );
        if (pageResult.length === 0 || pageResult[0].values.length === 0) { return 0; }
        const filename = pageResult[0].values[0][0] as string;

        // Get alias filenames for this page
        const aliasResult = this.db!.exec(
            `SELECT alias_filename FROM aliases WHERE canonical_page_id = ?`, [pageId],
        );
        const aliasFilenames: string[] = aliasResult.length > 0
            ? aliasResult[0].values.map(r => r[0] as string)
            : [];

        // Count links matching any of these filenames
        const allFilenames = [filename, ...aliasFilenames];
        const placeholders = allFilenames.map(() => '?').join(', ');
        const countResult = this.db!.exec(
            `SELECT COUNT(*) FROM links WHERE page_filename IN (${placeholders})`,
            allFilenames,
        );
        if (countResult.length === 0) { return 0; }
        return countResult[0].values[0][0] as number;
    }

    /**
     * Get all backlinks for a page, including links that target it via aliases.
     * Returns full LinkRow + source PageRow pairs for rich display.
     */
    getBacklinksIncludingAliases(pageId: number): BacklinkEntry[] {
        this.ensureOpen();
        // Get the page's own filename
        const pageResult = this.db!.exec(
            `SELECT filename FROM pages WHERE id = ?`, [pageId],
        );
        if (pageResult.length === 0 || pageResult[0].values.length === 0) { return []; }
        const filename = pageResult[0].values[0][0] as string;

        // Get alias filenames for this page
        const aliasResult = this.db!.exec(
            `SELECT alias_filename FROM aliases WHERE canonical_page_id = ?`, [pageId],
        );
        const aliasFilenames: string[] = aliasResult.length > 0
            ? aliasResult[0].values.map(r => r[0] as string)
            : [];

        // Query links matching any of these filenames, joined with source page
        const allFilenames = [filename, ...aliasFilenames];
        const placeholders = allFilenames.map(() => '?').join(', ');
        const result = this.db!.exec(
            `SELECT l.id, l.source_page_id, l.page_name, l.page_filename, l.line, l.start_col, l.end_col, l.context, l.parent_link_id, l.depth,
                    p.id, p.path, p.filename, p.title, p.mtime, p.indexed_at
             FROM links l
             JOIN pages p ON l.source_page_id = p.id
             WHERE l.page_filename IN (${placeholders})
             ORDER BY p.title COLLATE NOCASE, l.line, l.start_col`,
            allFilenames,
        );
        if (result.length === 0) { return []; }
        return result[0].values.map(row => ({
            link: {
                id: row[0] as number,
                source_page_id: row[1] as number,
                page_name: row[2] as string,
                page_filename: row[3] as string,
                line: row[4] as number,
                start_col: row[5] as number,
                end_col: row[6] as number,
                context: row[7] as string | null,
                parent_link_id: row[8] as number | null,
                depth: row[9] as number,
            },
            sourcePage: {
                id: row[10] as number,
                path: row[11] as string,
                filename: row[12] as string,
                title: row[13] as string,
                mtime: row[14] as number,
                indexed_at: row[15] as number,
            },
        }));
    }

    /**
     * Update an alias name across the index. Updates the alias record
     * and all link references that pointed to the old alias filename.
     */
    updateAliasRename(oldAliasName: string, newAliasName: string, canonicalPageId: number): void {
        this.ensureOpen();
        const invalids = /[\/\?<>\\:\*\|":]/g;
        const oldFilename = `${oldAliasName.replace(invalids, '_')}.md`;
        const newFilename = `${newAliasName.replace(invalids, '_')}.md`;

        // Update the alias record
        this.db!.run(
            `UPDATE aliases SET alias_name = ?, alias_filename = ? WHERE canonical_page_id = ? AND LOWER(alias_name) = LOWER(?)`,
            [newAliasName, newFilename, canonicalPageId, oldAliasName],
        );

        // Update link references pointing to old alias filename
        this.db!.run(
            `UPDATE links SET page_name = ?, page_filename = ? WHERE page_filename = ?`,
            [newAliasName, newFilename, oldFilename],
        );
    }

    /**
     * Find all pages matching a given filename (case-insensitive).
     * Used for subfolder resolution when multiple pages share the same filename.
     */
    findPagesByFilename(filename: string): PageRow[] {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT id, path, filename, title, mtime, indexed_at FROM pages WHERE LOWER(filename) = LOWER(?)`,
            [filename],
        );
        if (result.length === 0) { return []; }
        return result[0].values.map(row => ({
            id: row[0] as number,
            path: row[1] as string,
            filename: row[2] as string,
            title: row[3] as string,
            mtime: row[4] as number,
            indexed_at: row[5] as number,
        }));
    }

    // ── Tasks ──────────────────────────────────────────────────────────────

    /** Matches an unchecked todo: optional indent, `-` or `*`, `[ ]`, then content. */
    private static readonly TASK_UNCHECKED = /^(\s*)([-*])\s+\[ \]\s?(.*)/;

    /** Matches a done todo: optional indent, `-` or `*`, `[x]` or `[X]`, then content. */
    private static readonly TASK_DONE = /^(\s*)([-*])\s+\[(?:x|X)\]\s?(.*)/;

    /**
     * Parse and store tasks from file content for a given page.
     * Clears existing tasks for the page before inserting new ones.
     */
    private indexTasksFromContent(pageId: number, content: string): void {
        this.ensureOpen();
        this.db!.run(`DELETE FROM tasks WHERE source_page_id = ?`, [pageId]);

        const lines = content.split(/\r?\n/);
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const lineText = lines[lineNum];

            // Check done first (same order as TodoToggleService)
            const doneMatch = lineText.match(IndexService.TASK_DONE);
            if (doneMatch) {
                const text = doneMatch[3];
                this.db!.run(
                    `INSERT INTO tasks (source_page_id, line, text, done, line_text) VALUES (?, ?, ?, ?, ?)`,
                    [pageId, lineNum, text, 1, lineText],
                );
                continue;
            }

            const uncheckedMatch = lineText.match(IndexService.TASK_UNCHECKED);
            if (uncheckedMatch) {
                const text = uncheckedMatch[3];
                this.db!.run(
                    `INSERT INTO tasks (source_page_id, line, text, done, line_text) VALUES (?, ?, ?, ?, ?)`,
                    [pageId, lineNum, text, 0, lineText],
                );
            }
        }
    }

    /**
     * Get all tasks for a given page, optionally filtered to undone only.
     */
    getTasksForPage(pageId: number, todoOnly?: boolean): TaskRow[] {
        this.ensureOpen();
        const sql = todoOnly
            ? `SELECT id, source_page_id, line, text, done, line_text FROM tasks WHERE source_page_id = ? AND done = 0 ORDER BY line`
            : `SELECT id, source_page_id, line, text, done, line_text FROM tasks WHERE source_page_id = ? ORDER BY line`;
        const result = this.db!.exec(sql, [pageId]);
        if (result.length === 0) { return []; }
        return this.mapTaskRows(result[0].values);
    }

    /**
     * Get all pages that have at least one task, with task counts.
     * Optionally filter to pages with undone tasks only.
     */
    getPagesWithTasks(todoOnly?: boolean): { page: PageRow; taskCount: number }[] {
        this.ensureOpen();
        const whereClause = todoOnly ? `WHERE t.done = 0` : '';
        const result = this.db!.exec(
            `SELECT p.id, p.path, p.filename, p.title, p.mtime, p.indexed_at, COUNT(t.id) as task_count
             FROM tasks t
             JOIN pages p ON t.source_page_id = p.id
             ${whereClause}
             GROUP BY p.id
             ORDER BY p.title COLLATE NOCASE`,
        );
        if (result.length === 0) { return []; }
        return result[0].values.map(row => ({
            page: {
                id: row[0] as number,
                path: row[1] as string,
                filename: row[2] as string,
                title: row[3] as string,
                mtime: row[4] as number,
                indexed_at: row[5] as number,
            },
            taskCount: row[6] as number,
        }));
    }

    /**
     * Get aggregate task counts across the entire workspace.
     */
    getTaskCounts(): { total: number; done: number; undone: number } {
        this.ensureOpen();
        const totalResult = this.db!.exec(`SELECT COUNT(*) FROM tasks`);
        const doneResult = this.db!.exec(`SELECT COUNT(*) FROM tasks WHERE done = 1`);
        const total = totalResult.length > 0 ? totalResult[0].values[0][0] as number : 0;
        const done = doneResult.length > 0 ? doneResult[0].values[0][0] as number : 0;
        return { total, done, undone: total - done };
    }

    private mapTaskRows(rows: unknown[][]): TaskRow[] {
        return rows.map(row => ({
            id: row[0] as number,
            source_page_id: row[1] as number,
            line: row[2] as number,
            text: row[3] as string,
            done: row[4] as number,
            line_text: row[5] as string,
        }));
    }

    // ── Schema management ──────────────────────────────────────────────────

    /**
     * Drop all tables and recreate the schema. Used by rebuild command.
     */
    resetSchema(): void {
        this.ensureOpen();
        this.db!.run(`DROP TABLE IF EXISTS tasks`);
        this.db!.run(`DROP TABLE IF EXISTS aliases`);
        this.db!.run(`DROP TABLE IF EXISTS links`);
        this.db!.run(`DROP TABLE IF EXISTS pages`);
        this.db!.run(SCHEMA_SQL);
    }

    /**
     * Get table names (for testing schema creation).
     */
    getTableNames(): string[] {
        this.ensureOpen();
        const result = this.db!.exec(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
        );
        if (result.length === 0) { return []; }
        return result[0].values.map(row => row[0] as string);
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private ensureOpen(): void {
        if (!this.db) {
            throw new Error('IndexService: database is not open. Call initDatabase() or initInMemory() first.');
        }
    }

    private mapLinkRows(rows: unknown[][]): LinkRow[] {
        return rows.map(row => ({
            id: row[0] as number,
            source_page_id: row[1] as number,
            page_name: row[2] as string,
            page_filename: row[3] as string,
            line: row[4] as number,
            start_col: row[5] as number,
            end_col: row[6] as number,
            context: row[7] as string | null,
            parent_link_id: row[8] as number | null,
            depth: row[9] as number,
        }));
    }
}
