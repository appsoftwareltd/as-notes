import initSqlJs, { type Database } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import { WikilinkService, Wikilink } from 'as-notes-common';
import { FrontMatterService } from 'as-notes-common';
import { LogService, NO_OP_LOGGER } from './LogService.js';

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
    indent_level: number;
    outline_parent_link_id: number | null;
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
    indent_level: number;
    outline_parent_link_id: number | null;
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
    priority: number | null;
    waiting: number;
    due_date: string | null;
    completion_date: string | null;
}

/** A task row joined with its source page path and title, for webview display. */
export interface TaskViewItem {
    id: number;
    source_page_id: number;
    pagePath: string;
    pageTitle: string;
    line: number;
    text: string;
    done: boolean;
    priority: number | null;
    waiting: boolean;
    dueDate: string | null;
    completionDate: string | null;
}

export interface BacklinkEntry {
    link: LinkRow;
    sourcePage: PageRow;
}

/** A single link in a backlink chain, from root to leaf. */
export interface BacklinkChainLink {
    linkId: number;
    pageName: string;
    pageFilename: string;
    line: number;
    startCol: number;
    endCol: number;
    context: string | null;
}

/** A single chain instance (one occurrence on one source page). */
export interface BacklinkChainInstance {
    /** The chain from the outline root down to the target link, in document order. */
    chain: BacklinkChainLink[];
    /** The source page where this chain exists. */
    sourcePage: PageRow;
}

/** A group of chain instances sharing the same abstract pattern. */
export interface BacklinkChainGroup {
    /** Page-name sequence lowercased (for grouping key). */
    patternKey: string;
    /** Page-name sequence in original case (for display). */
    displayPattern: string[];
    /** All occurrences of this chain pattern, sorted by source page title. */
    instances: BacklinkChainInstance[];
}

// ── Schema ─────────────────────────────────────────────────────────────────

/**
 * Increment this whenever the schema changes (new columns, tables, indexes).
 * On DB open, if the stored user_version is less than this value, the database
 * is dropped and rebuilt from scratch. Because the DB is a pure derived index
 * (fully regeneratable from markdown files), drop-and-rebuild is always safe.
 */
export const SCHEMA_VERSION = 3;

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
    depth INTEGER NOT NULL DEFAULT 0,
    indent_level INTEGER NOT NULL DEFAULT 0,
    outline_parent_link_id INTEGER REFERENCES links(id) ON DELETE SET NULL
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
CREATE INDEX IF NOT EXISTS idx_links_outline_parent ON links(outline_parent_link_id);
CREATE INDEX IF NOT EXISTS idx_aliases_alias_name ON aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_aliases_canonical ON aliases(canonical_page_id);
CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(path);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    source_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    line INTEGER NOT NULL,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    line_text TEXT NOT NULL,
    priority INTEGER,
    waiting INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    completion_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source_page_id);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_waiting ON tasks(waiting);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_completion_date ON tasks(completion_date);
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

    // ── WASM module cache (OOM fix) ────────────────────────────────────────
    // Each call to initSqlJs() loads a new WASM module with its own heap
    // (~2 MB+). These heaps are outside the JS GC and are never freed,
    // so repeated initSqlJs() calls (e.g. manual rebuilds) accumulate
    // until the process hits an "out of memory" error.
    // Caching the module here ensures the WASM binary is loaded once and
    // reused for every subsequent Database() construction.
    // ───────────────────────────────────────────────────────────────────────
    private sqlModule: Awaited<ReturnType<typeof initSqlJs>> | null = null;

    private dbPath: string;
    private readonly logger: LogService;

    constructor(dbPath: string, logger?: LogService) {
        this.dbPath = dbPath;
        this.logger = logger ?? NO_OP_LOGGER;
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    /**
     * Load the sql.js WASM module if not already cached.
     *
     * The module is kept for the lifetime of this IndexService instance
     * so that repeated `initDatabase()` calls (e.g. manual rebuild) reuse
     * the same WASM heap instead of allocating a new one each time.
     *
     * Without this cache every rebuild would call `initSqlJs()`, loading a
     * fresh WASM binary with its own non-GC-able heap.  After a handful of
     * rebuilds the cumulative heap allocations exhaust available memory and
     * sql.js throws "out of memory".
     *
     * See also: TECHNICAL.md § Persistence strategy.
     */
    private async ensureSqlModule(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
        if (!this.sqlModule) {
            this.logger.info('IndexService', 'Loading WASM module (first load)');
            const end = this.logger.time('IndexService', 'initSqlJs');
            this.sqlModule = await initSqlJs();
            end();
        }
        return this.sqlModule;
    }

    /**
     * Initialise the database. Opens an existing file or creates a new one.
     * Creates the schema tables if they don't already exist.
     *
     * Returns `{ schemaReset: true }` if the database schema was outdated and
     * was dropped and recreated. The caller should trigger a full index rebuild
     * in this case.
     */
    async initDatabase(): Promise<{ schemaReset: boolean }> {
        // Reuse the cached WASM module — see ensureSqlModule() for rationale.
        const SQL = await this.ensureSqlModule();

        if (fs.existsSync(this.dbPath)) {
            const fileBuffer = fs.readFileSync(this.dbPath);
            this.logger.info('IndexService', `initDatabase: opening existing file (${fileBuffer.length} bytes)`);
            this.db = new SQL.Database(fileBuffer);

            // Check schema version — if outdated, drop and recreate.
            // user_version is a SQLite pragma we control; 0 means never set (pre-versioning).
            const versionResult = this.db.exec('PRAGMA user_version');
            const storedVersion = (versionResult[0]?.values[0]?.[0] as number) ?? 0;
            if (storedVersion < SCHEMA_VERSION) {
                this.logger.info('IndexService', `initDatabase: schema version ${storedVersion} < ${SCHEMA_VERSION} — resetting database`);
                await this.resetSchema();
                this.db!.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
                this.logger.info('IndexService', 'initDatabase: schema reset complete');
                return { schemaReset: true };
            }
        } else {
            this.logger.info('IndexService', 'initDatabase: creating new in-memory database');
            this.db = new SQL.Database();
        }

        // Enable foreign key enforcement
        this.db.run('PRAGMA foreign_keys = ON;');
        this.db.run(SCHEMA_SQL);
        this.db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        this.logger.info('IndexService', 'initDatabase: complete');
        return { schemaReset: false };
    }

    /**
     * Initialise from an in-memory database (for testing — no file I/O).
     */
    async initInMemory(): Promise<void> {
        // Reuse the cached WASM module — see ensureSqlModule() for rationale.
        const SQL = await this.ensureSqlModule();
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
        const end = this.logger.time('IndexService', 'saveToFile');
        const data = this.db.export();
        fs.writeFileSync(this.dbPath, Buffer.from(data));
        this.logger.info('IndexService', `saveToFile: wrote ${data.length} bytes`);
        end();
    }

    /**
     * Reset the database for a full rebuild.
     *
     * This is the preferred way to clear all data before a rebuild.  It:
     * 1. Closes the current Database handle (instant — no row-level work);
     * 2. Resets sql.js's internal WASM cache (`initSqlJsPromise`);
     * 3. Calls `initSqlJs()` to load a **truly fresh** WASM instance with
     *    clean, unfragmented linear memory;
     * 4. Creates a new empty Database on that fresh instance.
     *
     * Why a fresh WASM instance is required:
     * - WASM linear memory can grow but **never shrink**.  After indexing
     *   ~18k files the heap reaches ~80 MB and becomes fragmented.
     * - `new Database()` on the same heap crashes at ~1618 files with
     *   "memory access out of bounds".
     * - sql.js caches the first `initSqlJs()` promise forever in a closure
     *   variable (`initSqlJsPromise`), so normal calls always return the
     *   same (fragmented) WASM instance.
     * - An esbuild plugin (see build.mjs) injects a `resetCache()` function
     *   that sets `initSqlJsPromise = undefined`, allowing the next call
     *   to load a fresh WASM binary with clean memory.
     *
     * The old WASM module (~80 MB) becomes unreferenced and eligible for GC
     * after `this.sqlModule` is reassigned.
     */
    async resetSchema(): Promise<void> {
        this.ensureOpen();

        this.logger.info('IndexService', 'resetSchema: closing old database');
        this.db!.close();
        this.db = null;

        // Reset sql.js's internal WASM promise cache so the next initSqlJs()
        // call loads a truly fresh WASM instance with clean linear memory.
        this.logger.info('IndexService', 'resetSchema: resetting WASM cache');
        const resetCache = (initSqlJs as any).resetCache;
        if (typeof resetCache === 'function') {
            resetCache();
        } else {
            this.logger.warn('IndexService', 'resetSchema: resetCache() not available — WASM module will be reused (may fail on large workspaces)');
        }
        this.sqlModule = null;

        // Load a fresh WASM instance
        const end = this.logger.time('IndexService', 'resetSchema: initSqlJs');
        this.sqlModule = await initSqlJs();
        end();

        this.logger.info('IndexService', 'resetSchema: creating fresh database');
        this.db = new this.sqlModule.Database();
        this.db.run('PRAGMA foreign_keys = ON;');
        this.db.run(SCHEMA_SQL);
        this.db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        this.logger.info('IndexService', 'resetSchema: complete');
    }

    /**
     * Close the database connection and release the cached WASM module.
     *
     * Used when the extension is fully shutting down or the workspace is
     * being cleaned.  For rebuilds, prefer `resetSchema()` which keeps
     * the Database and WASM module alive.
     */
    close(): void {
        if (this.db) {
            this.logger.info('IndexService', 'close: closing database and releasing WASM module');
            this.db.close();
            this.db = null;
            this.sqlModule = null;
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
            this.logger.info('IndexService', `getPageByPath: path="${pagePath}" → NOT FOUND`);
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
                `INSERT INTO links (source_page_id, page_name, page_filename, line, start_col, end_col, context, parent_link_id, depth, indent_level, outline_parent_link_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [pageId, link.page_name, link.page_filename, link.line, link.start_col, link.end_col, link.context, link.parent_link_id, link.depth, link.indent_level ?? 0, link.outline_parent_link_id ?? null],
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
            `SELECT id, source_page_id, page_name, page_filename, line, start_col, end_col, context, parent_link_id, depth, indent_level, outline_parent_link_id
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
            `SELECT l.id, l.source_page_id, l.page_name, l.page_filename, l.line, l.start_col, l.end_col, l.context, l.parent_link_id, l.depth, l.indent_level, l.outline_parent_link_id
             FROM links l WHERE l.page_filename = ?`,
            [pageFilename],
        );
        if (result.length === 0) { return []; }
        return this.mapLinkRows(result[0].values);
    }

    /**
     * Find distinct source pages containing links to any of the supplied page names.
     * Used to narrow rename refactors to only files that could contain matches.
     */
    findPagesLinkingToPageNames(pageNames: string[]): PageRow[] {
        this.ensureOpen();
        if (pageNames.length === 0) { return []; }

        const placeholders = pageNames.map(() => '?').join(', ');
        const result = this.db!.exec(
            `SELECT DISTINCT p.id, p.path, p.filename, p.title, p.mtime, p.indexed_at
             FROM pages p
             JOIN links l ON l.source_page_id = p.id
             WHERE l.page_name IN (${placeholders})
             ORDER BY p.path COLLATE NOCASE`,
            pageNames,
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

    /**
     * Get the total number of links across all pages.
     * Uses a single `COUNT(*)` query — O(1) regardless of table size.
     */
    getTotalLinkCount(): number {
        this.ensureOpen();
        const result = this.db!.exec(`SELECT COUNT(*) FROM links`);
        if (result.length === 0) { return 0; }
        return result[0].values[0][0] as number;
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

        this.logger.info('IndexService', `indexFileContent: ${relativePath} → pageId=${pageId}`);
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

                // Build ±1 line context snippet
                const contextLines: string[] = [];
                if (lineNum > 0) { contextLines.push(lines[lineNum - 1]); }
                contextLines.push(lineText);
                if (lineNum < lines.length - 1) { contextLines.push(lines[lineNum + 1]); }
                const contextSnippet = contextLines.join('\n');

                allLinks.push({
                    page_name: wl.pageName,
                    page_filename: `${wl.pageFileName}.md`,
                    line: lineNum,
                    start_col: wl.startPositionInText,
                    end_col: wl.endPositionInText,
                    context: contextSnippet,
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
     * Also computes indent_level (leading whitespace) and outline_parent_link_id
     * (closest preceding link on the same page with strictly less indent).
     */
    setLinksForPageWithNesting(pageId: number, content: string): number[] {
        const wikilinkService = new WikilinkService();
        const lines = content.split(/\r?\n/);

        // Delete existing links
        this.ensureOpen();
        this.db!.run(`DELETE FROM links WHERE source_page_id = ?`, [pageId]);

        // Collect all link inserts with their indent levels and DB ids
        const allIds: number[] = [];
        // Track (linkId, indentLevel, lineNum) for outline parent computation
        const linkMeta: { id: number; indentLevel: number; line: number }[] = [];

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const lineText = lines[lineNum];
            const wikilinks = wikilinkService.extractWikilinks(lineText, false, false);
            if (wikilinks.length === 0) { continue; }

            // Compute indent level from leading whitespace (tabs count as 1 char)
            const indentLevel = IndexService.computeIndentLevel(lineText);

            // Build ±1 line context snippet
            const contextLines: string[] = [];
            if (lineNum > 0) { contextLines.push(lines[lineNum - 1]); }
            contextLines.push(lineText);
            if (lineNum < lines.length - 1) { contextLines.push(lines[lineNum + 1]); }
            const contextSnippet = contextLines.join('\n');

            // Sort outermost first (largest range)
            const sorted = [...wikilinks].sort((a, b) => b.length - a.length);

            // First pass: insert all links with null parent_link_id and outline_parent_link_id
            const wlToId = new Map<Wikilink, number>();
            for (const wl of sorted) {
                const depth = this.computeDepth(wl, sorted);
                this.db!.run(
                    `INSERT INTO links (source_page_id, page_name, page_filename, line, start_col, end_col, context, parent_link_id, depth, indent_level, outline_parent_link_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [pageId, wl.pageName, `${wl.pageFileName}.md`, lineNum, wl.startPositionInText, wl.endPositionInText, contextSnippet, null, depth, indentLevel, null],
                );
                const result = this.db!.exec(`SELECT last_insert_rowid()`);
                const linkId = result[0].values[0][0] as number;
                wlToId.set(wl, linkId);
                allIds.push(linkId);
                linkMeta.push({ id: linkId, indentLevel, line: lineNum });
            }

            // Second pass: set parent_link_id for nested (bracket-nested) links
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

        // Third pass: compute outline_parent_link_id using a stack-based algorithm.
        // Walk links in document order (line ASC). For each link, the outline parent
        // is the closest preceding link with strictly less indent_level.
        // Links on the same line share the same outline parent (they are peers).
        this.computeOutlineParents(linkMeta);

        return allIds;
    }

    /**
     * Compute the leading whitespace count for a line.
     * Spaces count as 1, tabs count as 1 character each.
     */
    static computeIndentLevel(lineText: string): number {
        let count = 0;
        for (const ch of lineText) {
            if (ch === ' ' || ch === '\t') {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    /**
     * Compute outline_parent_link_id for all links on a page using a stack-based algorithm.
     * Links are expected in document order (line ASC).
     * Same-line links are peers — they share the same outline parent.
     */
    private computeOutlineParents(linkMeta: { id: number; indentLevel: number; line: number }[]): void {
        if (linkMeta.length === 0) { return; }

        // Stack of { id, indentLevel } — represents the current outline ancestry
        const stack: { id: number; indentLevel: number }[] = [];

        // Group by line so same-line links get the same parent
        let i = 0;
        while (i < linkMeta.length) {
            const currentLine = linkMeta[i].line;
            const currentIndent = linkMeta[i].indentLevel;

            // Pop stack until top has indent strictly less than current
            while (stack.length > 0 && stack[stack.length - 1].indentLevel >= currentIndent) {
                stack.pop();
            }

            const outlineParentId = stack.length > 0 ? stack[stack.length - 1].id : null;

            // Assign outline parent to all links on this line, then push the first one onto the stack
            const lineLinks: number[] = [];
            while (i < linkMeta.length && linkMeta[i].line === currentLine) {
                lineLinks.push(linkMeta[i].id);
                if (outlineParentId !== null) {
                    this.db!.run(
                        `UPDATE links SET outline_parent_link_id = ? WHERE id = ?`,
                        [outlineParentId, linkMeta[i].id],
                    );
                }
                i++;
            }

            // Push only the first link on this line as the representative for outline ancestry
            stack.push({ id: lineLinks[0], indentLevel: currentIndent });
        }
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
            `SELECT l.id, l.source_page_id, l.page_name, l.page_filename, l.line, l.start_col, l.end_col, l.context, l.parent_link_id, l.depth, l.indent_level, l.outline_parent_link_id,
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
                indent_level: row[10] as number,
                outline_parent_link_id: row[11] as number | null,
            },
            sourcePage: {
                id: row[12] as number,
                path: row[13] as string,
                filename: row[14] as string,
                title: row[15] as string,
                mtime: row[16] as number,
                indexed_at: row[17] as number,
            },
        }));
    }

    // ── Unified backlink chains ─────────────────────────────────────────

    /**
     * Get all page filenames (including aliases) for a given page id.
     */
    private getPageFilenames(pageId: number): string[] {
        const pageResult = this.db!.exec(
            `SELECT filename FROM pages WHERE id = ?`, [pageId],
        );
        if (pageResult.length === 0 || pageResult[0].values.length === 0) { return []; }
        const filename = pageResult[0].values[0][0] as string;

        const aliasResult = this.db!.exec(
            `SELECT alias_filename FROM aliases WHERE canonical_page_id = ?`, [pageId],
        );
        const aliasFilenames: string[] = aliasResult.length > 0
            ? aliasResult[0].values.map(r => r[0] as string)
            : [];

        return [filename, ...aliasFilenames];
    }

    /**
     * Get unified backlink chains for a page by its id.
     *
     * Algorithm:
     * 1. Find all links where page_filename matches the target page or its aliases
     * 2. For each matching link, walk outline_parent_link_id upward to build the
     *    full chain from outline root to the target link
     * 3. Group chains by their abstract pattern (lowercased page_name sequence)
     * 4. Sort: length-1 groups first, then longer chains; within groups,
     *    instances are sorted by source page title alphabetically
     */
    getBacklinkChains(pageId: number): BacklinkChainGroup[] {
        this.ensureOpen();
        const allFilenames = this.getPageFilenames(pageId);
        if (allFilenames.length === 0) { return []; }
        return this.buildBacklinkChainGroups(allFilenames);
    }

    /**
     * Get unified backlink chains by page name (for forward references where
     * no pages row exists). Converts the name to a filename and queries
     * the links table directly.
     */
    getBacklinkChainsByName(pageName: string): BacklinkChainGroup[] {
        this.ensureOpen();
        const invalids = /[\/\?<>\\:\*\|":]/g;
        const filename = `${pageName.replace(invalids, '_')}.md`;
        return this.buildBacklinkChainGroups([filename]);
    }

    /**
     * Core chain-building logic shared by getBacklinkChains and getBacklinkChainsByName.
     *
     * For each link matching the target filenames, builds the full outline chain
     * from root to that link, then groups by the abstract chain pattern.
     */
    private buildBacklinkChainGroups(targetFilenames: string[]): BacklinkChainGroup[] {
        const placeholders = targetFilenames.map(() => '?').join(', ');
        const lowered = targetFilenames.map(f => f.toLowerCase());

        // Find all links pointing to the target page (or its aliases), case-insensitive
        const result = this.db!.exec(
            `SELECT l.id, l.source_page_id,
                    p.id, p.path, p.filename, p.title, p.mtime, p.indexed_at
             FROM links l
             JOIN pages p ON l.source_page_id = p.id
             WHERE LOWER(l.page_filename) IN (${placeholders})
             ORDER BY p.title COLLATE NOCASE, l.line, l.start_col`,
            lowered,
        );

        if (result.length === 0) { return []; }

        // Build chain for each matching link
        const groupMap = new Map<string, BacklinkChainGroup>();

        for (const row of result[0].values) {
            const linkId = row[0] as number;
            const sourcePage = this.mapSinglePageRow(row, 2);

            const chain = this.buildChainForLink(linkId);
            if (chain.length === 0) { continue; }

            // Pattern key: lowercased page_name sequence joined by →
            const patternKey = chain.map(c => c.pageName.toLowerCase()).join(' → ');

            const existing = groupMap.get(patternKey);
            if (existing) {
                existing.instances.push({ chain, sourcePage });
            } else {
                groupMap.set(patternKey, {
                    patternKey,
                    displayPattern: chain.map(c => c.pageName),
                    instances: [{ chain, sourcePage }],
                });
            }
        }

        // Sort groups: length-1 first, then longer chains alphabetically by pattern key
        const groups = Array.from(groupMap.values());
        groups.sort((a, b) => {
            const aLen = a.displayPattern.length;
            const bLen = b.displayPattern.length;
            if (aLen === 1 && bLen > 1) { return -1; }
            if (aLen > 1 && bLen === 1) { return 1; }
            return a.patternKey.localeCompare(b.patternKey);
        });

        return groups;
    }

    /**
     * Build the full outline chain from root to the given link by walking
     * outline_parent_link_id upward and then reversing.
     */
    buildChainForLink(linkId: number): BacklinkChainLink[] {
        const chain: BacklinkChainLink[] = [];
        let currentId: number | null = linkId;

        while (currentId !== null) {
            const result = this.db!.exec(
                `SELECT id, page_name, page_filename, line, start_col, end_col, outline_parent_link_id, context
                 FROM links WHERE id = ?`,
                [currentId],
            );
            if (result.length === 0 || result[0].values.length === 0) { break; }
            const row = result[0].values[0];
            chain.push({
                linkId: row[0] as number,
                pageName: row[1] as string,
                pageFilename: row[2] as string,
                line: row[3] as number,
                startCol: row[4] as number,
                endCol: row[5] as number,
                context: row[7] as string | null,
            });
            currentId = row[6] as number | null;
        }

        chain.reverse(); // Root first
        return chain;
    }

    private mapSingleLinkRow(row: unknown[]): LinkRow {
        return {
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
            indent_level: row[10] as number,
            outline_parent_link_id: row[11] as number | null,
        };
    }

    private mapSinglePageRow(row: unknown[], offset: number): PageRow {
        return {
            id: row[offset] as number,
            path: row[offset + 1] as string,
            filename: row[offset + 2] as string,
            title: row[offset + 3] as string,
            mtime: row[offset + 4] as number,
            indexed_at: row[offset + 5] as number,
        };
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
     * Parse structured metadata tags from task text.
     * Strips `#P1`/`#P2`/`#P3` (priority), `#W` (waiting), `#D-YYYY-MM-DD` (due date).
     * All tags must appear at the start of the text (before any other content),
     * separated by spaces. Returns cleaned text and parsed metadata.
     */
    static parseTaskMeta(text: string): { cleanText: string; priority: number | null; waiting: number; dueDate: string | null; completionDate: string | null } {
        let remaining = text.trimStart();
        let priority: number | null = null;
        let waiting = 0;
        let dueDate: string | null = null;
        let completionDate: string | null = null;

        const tagRe = /^(#P([123])|#W|#D-(\d{4}-\d{2}-\d{2})|#C-(\d{4}-\d{2}-\d{2}))\s*/;
        let match: RegExpMatchArray | null;
        while ((match = remaining.match(tagRe)) !== null) {
            if (match[2]) {
                // #P1, #P2, #P3
                if (priority === null) { priority = parseInt(match[2], 10); }
            } else if (match[0].startsWith('#W')) {
                waiting = 1;
            } else if (match[3]) {
                // #D-YYYY-MM-DD
                if (dueDate === null) { dueDate = match[3]; }
            } else if (match[4]) {
                // #C-YYYY-MM-DD
                if (completionDate === null) { completionDate = match[4]; }
            }
            remaining = remaining.slice(match[0].length);
        }

        return { cleanText: remaining.trimEnd(), priority, waiting, dueDate, completionDate };
    }

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
                const rawText = doneMatch[3];
                const { cleanText, priority, waiting, dueDate, completionDate } = IndexService.parseTaskMeta(rawText);
                this.db!.run(
                    `INSERT INTO tasks (source_page_id, line, text, done, line_text, priority, waiting, due_date, completion_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [pageId, lineNum, cleanText, 1, lineText, priority, waiting, dueDate, completionDate],
                );
                continue;
            }

            const uncheckedMatch = lineText.match(IndexService.TASK_UNCHECKED);
            if (uncheckedMatch) {
                const rawText = uncheckedMatch[3];
                const { cleanText, priority, waiting, dueDate, completionDate } = IndexService.parseTaskMeta(rawText);
                this.db!.run(
                    `INSERT INTO tasks (source_page_id, line, text, done, line_text, priority, waiting, due_date, completion_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [pageId, lineNum, cleanText, 0, lineText, priority, waiting, dueDate, completionDate],
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
            ? `SELECT id, source_page_id, line, text, done, line_text, priority, waiting, due_date, completion_date FROM tasks WHERE source_page_id = ? AND done = 0 ORDER BY line`
            : `SELECT id, source_page_id, line, text, done, line_text, priority, waiting, due_date, completion_date FROM tasks WHERE source_page_id = ? ORDER BY line`;
        const result = this.db!.exec(sql, [pageId]);
        if (result.length === 0) { return []; }
        return this.mapTaskRows(result[0].values);
    }

    /**
     * Get all tasks joined with their source page, for the task webview panel.
     * Optionally filter to undone only and/or waiting only.
     */
    getAllTasksForWebview(opts?: { todoOnly?: boolean; waitingOnly?: boolean }): TaskViewItem[] {
        this.ensureOpen();
        const conditions: string[] = [];
        if (opts?.todoOnly) { conditions.push('t.done = 0'); }
        if (opts?.waitingOnly) { conditions.push('t.waiting = 1'); }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = this.db!.exec(
            `SELECT t.id, t.source_page_id, p.path, p.title, t.line, t.text, t.done, t.priority, t.waiting, t.due_date, t.completion_date
             FROM tasks t
             JOIN pages p ON t.source_page_id = p.id
             ${where}
             ORDER BY p.title COLLATE NOCASE, t.line`,
        );
        if (result.length === 0) { return []; }
        return result[0].values.map(row => ({
            id: row[0] as number,
            source_page_id: row[1] as number,
            pagePath: row[2] as string,
            pageTitle: row[3] as string,
            line: row[4] as number,
            text: row[5] as string,
            done: (row[6] as number) === 1,
            priority: row[7] as number | null,
            waiting: (row[8] as number) === 1,
            dueDate: row[9] as string | null,
            completionDate: row[10] as string | null,
        }));
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
            priority: row[6] as number | null,
            waiting: row[7] as number,
            due_date: row[8] as string | null,
            completion_date: row[9] as string | null,
        }));
    }

    // ── Schema management ──────────────────────────────────────────────────

    /**
     * Delete all data from every table without dropping or recreating the schema.
     * Unlike `resetSchema()` (which uses DROP TABLE), this preserves the
     * prepared-statement cache that sql.js maintains internally, so subsequent
     * queries continue to work correctly.
     *
     * Child tables are cleared before the parent (`pages`) to respect FK order.
     */
    clearAllData(): void {
        this.ensureOpen();
        this.logger.info('IndexService', 'clearAllData: starting');
        const end = this.logger.time('IndexService', 'clearAllData');
        this.logger.info('IndexService', 'clearAllData: DELETE FROM tasks');
        this.db!.run(`DELETE FROM tasks`);
        this.logger.info('IndexService', 'clearAllData: DELETE FROM aliases');
        this.db!.run(`DELETE FROM aliases`);
        this.logger.info('IndexService', 'clearAllData: DELETE FROM links');
        this.db!.run(`DELETE FROM links`);
        this.logger.info('IndexService', 'clearAllData: DELETE FROM pages');
        this.db!.run(`DELETE FROM pages`);
        end();
        this.logger.info('IndexService', 'clearAllData: complete');
    }

    /**
     * Get the stored user_version pragma value (for testing schema versioning).
     */
    getSchemaVersion(): number {
        this.ensureOpen();
        const result = this.db!.exec('PRAGMA user_version');
        return (result[0]?.values[0]?.[0] as number) ?? 0;
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
            indent_level: row[10] as number,
            outline_parent_link_id: row[11] as number | null,
        }));
    }
}
