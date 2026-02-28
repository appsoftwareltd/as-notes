import initSqlJs, { type Database } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import { WikilinkService } from './WikilinkService.js';
import { Wikilink } from './Wikilink.js';

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

export interface ScanSummary {
    newFiles: number;
    staleFiles: number;
    deletedFiles: number;
    unchanged: number;
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
     */
    saveToFile(): void {
        if (!this.db) { return; }
        const data = this.db.export();
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
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

    // ── Schema management ──────────────────────────────────────────────────

    /**
     * Drop all tables and recreate the schema. Used by rebuild command.
     */
    resetSchema(): void {
        this.ensureOpen();
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
