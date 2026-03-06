# Technical Design — as-notes

This document explains the internal architecture, algorithms, and design decisions behind the as-notes VS Code extension. It is aimed at developers and AI agents who need to understand, maintain, or extend the codebase.

## Table of contents

- [Overview](#overview)
- [Persistent index](#persistent-index)
  - [Architecture split: IndexService and IndexScanner](#architecture-split-indexservice-and-indexscanner)
  - [IgnoreService and .asnotesignore](#ignoreservice-and-asnotesignore)
  - [Database schema](#database-schema)
  - [Content indexing and nesting](#content-indexing-and-nesting)
  - [Staleness detection](#staleness-detection)
  - [Persistence strategy](#persistence-strategy)
  - [WASM memory model](#wasm-memory-model)
- [Activation model](#activation-model)
  - [Passive mode](#passive-mode)
  - [Full mode](#full-mode)
  - [Index update triggers](#index-update-triggers)
  - [Periodic scanning](#periodic-scanning)
  - [Manual rebuild](#manual-rebuild)
  - [Automatic schema migration (PRAGMA user_version)](#automatic-schema-migration-pragma-user_version)
  - [Clean workspace](#clean-workspace)
- [Aliases and front matter](#aliases-and-front-matter)
  - [FrontMatterService](#frontmatterservice)
  - [Alias indexing](#alias-indexing)
  - [Alias resolution order](#alias-resolution-order)
  - [Alias-aware rename tracking](#alias-aware-rename-tracking)
- [Subfolder link resolution](#subfolder-link-resolution)
  - [Index-based global resolution](#index-based-global-resolution)
  - [Disambiguation algorithm](#disambiguation-algorithm)
  - [Path distance calculation](#path-distance-calculation)
- [Wikilink autocomplete](#wikilink-autocomplete)
  - [Trigger detection](#trigger-detection)
  - [Completion items](#completion-items)
  - [Nested wikilinks and front matter](#nested-wikilinks-and-front-matter)
  - [Caching strategy](#caching-strategy)
  - [Completion and rename tracking interaction](#completion-and-rename-tracking-interaction)
- [Wikilink parsing](#wikilink-parsing)
  - [Stack-based bracket matching](#stack-based-bracket-matching)
  - [The Wikilink model](#the-wikilink-model)
  - [Ordering](#ordering)
- [Non-overlapping segments](#non-overlapping-segments)
  - [Why segments are needed](#why-segments-are-needed)
  - [The algorithm](#the-algorithm)
  - [Example: 3-level nesting](#example-3-level-nesting)
- [Decorations](#decorations)
  - [Default vs active](#default-vs-active)
  - [Why segments prevent decoration conflicts](#why-segments-prevent-decoration-conflicts)
  - [Debug logging](#debug-logging)
- [Click navigation](#click-navigation)
  - [DocumentLinkProvider and command URIs](#documentlinkprovider-and-command-uris)
  - [File resolution](#file-resolution)
  - [Case-insensitive matching](#case-insensitive-matching)
  - [Auto-creation](#auto-creation)
- [Hover](#hover)
- [Rename tracking](#rename-tracking)
  - [Index-backed detection](#index-backed-detection)
  - [Rename detection algorithm](#rename-detection-algorithm)
  - [Cursor-exit and editor-switch triggers](#cursor-exit-and-editor-switch-triggers)
  - [Multi-level rename execution](#multi-level-rename-execution)
  - [Post-rename index refresh](#post-rename-index-refresh)
  - [Re-entrancy guard](#re-entrancy-guard)
- [Markdown preview rendering](#markdown-preview-rendering)
  - [Plugin registration](#plugin-registration)
  - [Non-blocking activation](#non-blocking-activation)
  - [Inline rule](#inline-rule)
  - [Nested link handling in preview](#nested-link-handling-in-preview)
  - [Link resolver](#link-resolver)
  - [Source file context](#source-file-context)
  - [Preview CSS](#preview-css)
  - [Limitations of preview links](#limitations-of-preview-links)
- [Todo toggle](#todo-toggle)
  - [TodoToggleService](#todotoggleservice)
  - [Command registration](#command-registration)
- [Tasks panel](#tasks-panel)
  - [Tasks table](#tasks-table)
  - [TaskPanelProvider](#taskpanelprovider)
  - [Sync strategy](#sync-strategy)
- [Backlinks panel](#backlinks-panel)
  - [BacklinkPanelProvider](#backlinkpanelprovider)
  - [Chain-first grouping](#chain-first-grouping)
  - [Data flow](#data-flow-1)
  - [Context menu — View Backlinks](#context-menu--view-backlinks)
  - [Context menu — Navigate to Page](#context-menu--navigate-to-page)
  - [Types](#types)
  - [Chain building](#chain-building)
  - [Message protocol](#message-protocol)
  - [Rendering](#rendering)
  - [Sync strategy](#sync-strategy-1)
- [Daily journal](#daily-journal)
  - [JournalService](#journalservice)
  - [Command flow](#command-flow)
  - [Template system](#template-system)
- [Pro licence](#pro-licence)
  - [LicenceService](#licenceservice)
  - [LicenceActivationService](#licenceactivationservice)
  - [Pro gate pattern](#pro-gate-pattern)
  - [Settings](#settings-1)
- [Encryption (Pro)](#encryption-pro)
  - [File format](#file-format)
  - [Key derivation](#key-derivation)
  - [EncryptionService](#encryptionservice)
  - [GitHookService](#githookservice)
  - [Index exclusion](#index-exclusion)
  - [Encryption commands](#encryption-commands)
- [File drop & paste](#file-drop--paste)
  - [Workspace configuration](#workspace-configuration)
  - [Legacy cleanup](#legacy-cleanup)
- [Extension activation and wiring](#extension-activation-and-wiring)
- [Testing](#testing)
- [Known limitations and future considerations](#known-limitations-and-future-considerations)

---

## Overview

as-notes is a VS Code extension that turns `[[double bracket]]` text in markdown files into navigable links. Each wikilink maps to a `.md` file in the same directory. The extension provides highlighting, click navigation, hover tooltips, auto-creation of missing pages, and automated rename synchronisation between link text and filenames.

The extension is built with:

- **TypeScript 5.7**, strict mode, ES2022 target
- **esbuild** for bundling via custom `build.mjs` (`src/extension.ts` → `dist/extension.js`, CJS format, `vscode` external). Includes a custom `sqlJsCacheResetPlugin` that patches sql.js at bundle time — see [Manual rebuild](#manual-rebuild)
- **sql.js ^1.14.0** — WASM SQLite for the persistent index (zero native dependencies, works in VS Code remote/Codespaces)
- **vitest 3.x** for unit tests (219 tests across 8 test files)
- **VS Code API ^1.85.0** (`DocumentLinkProvider`, `HoverProvider`, `TextEditorDecorationType`, `WorkspaceEdit`)

The build script (`build.mjs`) copies the `sql-wasm.wasm` binary to `dist/` alongside the bundled extension.

---

## Persistent index

AS Notes maintains a SQLite database (`.asnotes/index.db`) that indexes all markdown files in the workspace. The index enables backlink counting, rename detection comparison, and will support future features like backlink panels and tag queries.

### Architecture split: IndexService and IndexScanner

The index is split into two layers:

- **`IndexService`** (`src/IndexService.ts`) — Pure data layer with no VS Code dependencies. All SQL operations (schema, CRUD, content parsing) live here. This makes the service fully testable with vitest using an in-memory SQLite database (`initInMemory()`).

- **`IndexScanner`** (`src/IndexScanner.ts`) — VS Code-dependent filesystem layer. Reads files via `workspace.fs.readFile`, resolves mtimes via `workspace.fs.stat`, and delegating to `IndexService.indexFileContent()`. Handles full scans and stale scans.

This separation follows the Ports & Adapters pattern. The IndexService knows nothing about VS Code, files, or URIs — it only works with strings, numbers, and SQL.

### IgnoreService and .asnotesignore

`IgnoreService` (`src/IgnoreService.ts`) is a pure Node.js class (no VS Code dependency) that reads a `.asnotesignore` file at a given path and exposes a single check:

```typescript
isIgnored(relativePath: string): boolean
reload(): void
```

Patterns follow `.gitignore` syntax, parsed by the [`ignore`](https://www.npmjs.com/package/ignore) npm package — the standard implementation used by many tools. `IgnoreService` normalises backslash paths to forward slashes on Windows before passing them to `ignore`.

**`.asnotesignore` lifecycle:**

- Created by `initWorkspace()` at the workspace root (same level as `.asnotes/`) if it does not already exist.
- The extension **never overwrites** the file — existence is enforced, content is not. A user can empty the file freely; if they delete it entirely it will be recreated with defaults on the next indexing operation.
- Default content excludes `logseq/`, `.obsidian/`, and `.trash/` — common Logseq and Obsidian metadata/cache directories.
- Patterns without a leading `/` match at any depth (e.g. `logseq/` excludes `vault/logseq/pages/foo.md`).

The create-if-missing logic is centralised in a private `ensureIgnoreFile(workspaceRootFsPath: string): void` helper. It is called in three places:

| Call site | When |
|---|---|
| `initWorkspace()` | On first workspace initialisation |
| `rebuildIndex()` | At the start of every manual rebuild |
| `startPeriodicScan()` setInterval callback | On every periodic scan tick |

After `ensureIgnoreFile()` is called in `rebuildIndex()` and `startPeriodicScan()`, `ignoreService?.reload()` is called immediately so the in-memory patterns reflect any changes (including recreation after deletion) before the scan proceeds.

**Integration with IndexScanner:**

`IndexScanner` accepts an optional `IgnoreService` in its constructor. It is applied at three points:

1. **`indexFile(uri)`** — early return (silent skip) if `ignoreService?.isIgnored(relativePath)` is true.
2. **`fullScan()`** — post-filter on `findFiles()` result, alongside the `.enc.md` filter.
3. **`staleScan()`** — post-filter on `findFiles()` result.

Because ignored files are not present in `scannedPaths`, the "deleted files" cleanup at the end of `staleScan()` automatically removes previously indexed files that have become newly ignored. Conversely, un-ignoring a pattern causes those files to appear as "new" in the next stale scan and be re-indexed.

**File watcher:**

In `enterFullMode()`, a `vscode.workspace.createFileSystemWatcher` is registered on `.asnotesignore`. On any change (create, modify, or delete), `ignoreService.reload()` is called, followed by a `staleScan()`. The stale scan handles both removal of newly-ignored entries and addition of newly-un-ignored files. The watcher disposable is pushed to `fullModeDisposables` and torn down on mode transition.

**VS Code `files.exclude` interaction:**

`IndexScanner.fullScan()` and `staleScan()` use `vscode.workspace.findFiles()` without an explicit exclude parameter. This means VS Code's built-in `files.exclude` and `search.exclude` settings are applied — files matching those patterns are silently omitted from scan results and never indexed. This is by design: if a user has excluded folders in their workspace settings, those files should not appear in the index.

If a user opens an excluded file (e.g. via the command palette) and triggers the backlinks panel, the panel will display a message indicating the file is not indexed, with a note that it may be an ignored file. The `onDidSaveTextDocument` and `onDidChangeTextDocument` handlers will index such files on save/edit, but this is incidental — the file will not persist in the index across rebuilds.

**Future option:** If demand arises, on-the-fly indexing could be added to `BacklinkPanelProvider.renderBacklinksForUri()` — when `getPageByPath()` returns null, index the file from the open editor buffer before querying. This was deferred as the current behaviour (showing an informative message) is sufficient.

**Module-level state:**

`ignoreService` is kept as a module-level variable (alongside `indexService` and `indexScanner`) and is set to `undefined` in `exitFullMode()`. In `initWorkspace()`, a temporary `IgnoreService` is constructed (after creating the file) and passed to the one-time `IndexScanner` used for the initial full scan, so newly initialised workspaces also respect default exclusions immediately.



```sql
CREATE TABLE pages (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,     -- workspace-relative path
    filename TEXT NOT NULL,         -- just the filename
    title TEXT NOT NULL,            -- first # heading, or filename stem
    mtime INTEGER NOT NULL,         -- last modification time (epoch ms)
    indexed_at INTEGER NOT NULL     -- when this page was last indexed (epoch ms)
);

CREATE TABLE links (
    id INTEGER PRIMARY KEY,
    source_page_id INTEGER NOT NULL REFERENCES pages(id),
    page_name TEXT NOT NULL,        -- raw wikilink text (e.g. "My Page")
    page_filename TEXT NOT NULL,    -- sanitised filename (e.g. "My Page.md")
    line INTEGER NOT NULL,          -- 0-based line number
    start_col INTEGER NOT NULL,     -- column of first [
    end_col INTEGER NOT NULL,       -- column of last ]
    context TEXT,                   -- surrounding lines text for display (±1 lines)
    parent_link_id INTEGER REFERENCES links(id),  -- nesting parent (bracket-based)
    depth INTEGER NOT NULL DEFAULT 0,              -- nesting depth (0 = top-level)
    indent_level INTEGER NOT NULL DEFAULT 0,       -- leading whitespace count
    outline_parent_link_id INTEGER REFERENCES links(id) ON DELETE SET NULL  -- outliner parent
);

CREATE TABLE aliases (
    id INTEGER PRIMARY KEY,
    canonical_page_id INTEGER NOT NULL REFERENCES pages(id),
    alias_name TEXT NOT NULL,
    alias_filename TEXT NOT NULL
);

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY,
    source_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    line INTEGER NOT NULL,          -- 0-based line number
    text TEXT NOT NULL,             -- task text without bullet/checkbox
    done INTEGER NOT NULL DEFAULT 0,-- 0 = unchecked, 1 = done
    line_text TEXT NOT NULL          -- full original line text
);
```

Key indexes: `idx_links_source`, `idx_links_page_filename`, `idx_links_page_name`, `idx_pages_path`, `idx_aliases_alias_name`, `idx_aliases_canonical`, `idx_tasks_source`, `idx_links_outline_parent`.

### Content indexing and nesting

`IndexService.indexFileContent()` performs the full indexing pipeline for a single file:

1. **Title extraction** — `extractTitle()` scans for the first `# heading`. Falls back to the filename stem (e.g. `Notes.md` → `Notes`).

2. **Page upsert** — `upsertPage()` uses an UPDATE-first-then-INSERT pattern to avoid UPSERT syntax differences.

3. **Link parsing** — `setLinksForPageWithNesting()` parses all lines with `WikilinkService.extractWikilinks()` and inserts links in three passes:
   - **Pass 1:** Insert all links with `parent_link_id = NULL`, including `indent_level` computed from leading whitespace (`computeIndentLevel()`).
   - **Pass 2:** For each link, find the smallest containing wikilink (`findParentWikilink()`), look up its DB id, and UPDATE `parent_link_id`.
   - **Pass 3:** Compute outliner parents via `computeOutlineParents()`, updating `outline_parent_link_id`.

   This three-pass approach avoids foreign key ordering issues — all link ids exist before parent references are set.

4. **Indent level** — `computeIndentLevel(lineText)` counts leading whitespace characters (spaces and tabs) to determine the indentation of each wikilink's source line. This is used by the outliner parent algorithm.

5. **Outline parent computation** — `computeOutlineParents()` uses a stack-based algorithm to determine the outline hierarchy between wikilinks on a page:
   - Links are processed in document order (by line, then column).
   - A stack of `(linkId, indentLevel)` pairs tracks the current hierarchy.
   - For each new link, the stack is popped until the top element has a strictly smaller indent level — that element becomes the outline parent.
   - Same-line links (peers) share the same outline parent; only the first link on each line is pushed to the stack.
   - The result is a tree structure stored via `outline_parent_link_id` in the `links` table.

6. **Depth computation** — `computeDepth()` counts how many larger wikilinks fully contain the current one (by position range). Depth 0 = top-level, depth 1 = nested inside one parent, etc.

### Staleness detection

`IndexScanner.staleScan()` compares the filesystem against the index:

| Category | Condition | Action |
|---|---|---|
| **New** | File exists on disk, not in DB | Index it |
| **Stale** | File mtime > `indexed_at` | Re-index it |
| **Unchanged** | File mtime ≤ `indexed_at` | Skip |
| **Deleted** | In DB, not on disk | Remove from DB |

This runs on activation and periodically in the background.

### Persistence strategy

sql.js operates entirely in memory. The WASM module (`SqlJsStatic`) is loaded once per `IndexService` instance via `ensureSqlModule()` and cached in a private field. During normal operation the module is reused for the lifetime of the `IndexService` instance — this avoids accumulating WASM heap allocations that cannot be garbage-collected.

**WASM linear memory constraint:** WASM linear memory can grow but **never shrink**. After indexing ~18k files the heap reaches ~80 MB and becomes fragmented. Creating a new `Database()` on the same heap crashes at ~1618 files with "memory access out of bounds".

**sql.js cache:** `initSqlJs()` internally caches the WASM module at the package level in a closure variable (`initSqlJsPromise`). Once called, all subsequent calls return the same promise — there is no built-in way to get a fresh WASM instance. An esbuild plugin (`sqlJsCacheResetPlugin` in `build.mjs`) patches this by injecting a `resetCache()` function onto the exported `initSqlJs` that sets `initSqlJsPromise = undefined`. This allows `resetSchema()` to force a truly fresh WASM load for rebuilds — see [Manual rebuild](#manual-rebuild).

### WASM memory model

Understanding how WASM linear memory behaves is essential for reasoning about the extension's reliability on large workspaces.

**Why fragmentation occurs during a full scan:**

During a full scan of ~18k files, SQLite performs millions of allocations inside WASM memory: parsing SQL strings, building B-tree nodes, creating prepared statements, buffering row data, managing the page cache. Each `indexFileContent()` call runs `UPDATE`/`INSERT` on `pages`, `DELETE FROM links WHERE source_page_id = ?`, then N × `INSERT INTO links`, plus alias and task operations. Over 18k files with ~280k links, this involves hundreds of thousands of `malloc`/`free` cycles within the WASM heap.

When SQLite frees memory internally (`sqlite3_free`), those freed blocks remain as holes in the linear memory — they're returned to the C allocator's free list but the WASM heap high-water mark never decreases. After 18k files, the heap has grown to ~80 MB with a swiss-cheese pattern of allocated and freed blocks.

On a **fresh** WASM instance, the allocator starts from a pristine state — all allocations are sequential, contiguous, and efficient. This is why the initial scan always succeeds.

**Why rebuild needs a fresh WASM instance but periodic scans do not:**

| Scenario | WASM heap state | Concern? |
|---|---|---|
| First scan (activation) | Fresh heap, pristine allocator | None |
| Periodic scan (`staleScan`) | Steady-state heap; processes 0–10 files per tick | None — small incremental reuse of freed blocks |
| Manual rebuild (`resetSchema`) | Needs to create a new `Database()` on the heap | **Yes** — fixed by loading a fresh WASM instance |
| Clean Workspace + Init | Fresh `IndexService` + fresh WASM | None |

Periodic scans (`staleScan()`) compare disk mtime vs indexed mtime and only process **changed/new/deleted** files — typically 0–10 per tick. The SQL operations are identical to `indexFileContent` but at 1000× lower volume. The heap is already at its high-water mark from the initial full scan; processing a handful of files causes negligible additional fragmentation. The allocator efficiently reuses freed blocks when the working set is small.

`staleScan()` does **not** call `resetSchema()` or create new Database instances. It operates purely on the existing DB with the existing WASM heap. There is no accumulation problem.

**Periodic defragmentation is not needed.** The heap reaches its steady-state size after the initial full scan (~80 MB for 18k files). There is no WASM API to compact linear memory — the only way to "defragment" is to load a fresh WASM instance, which is exactly what rebuild does via the esbuild method.

**Rebuild memory lifecycle:**

Each rebuild loads a completely new WASM binary with its own independent linear memory starting at 0 bytes. The old module (~80 MB) becomes unreferenced and eligible for JS garbage collection. The brief ~160 MB peak (old + new WASM coexisting during the transition) is well within the VS Code extension host's memory budget. This makes every rebuild equivalent to a first scan.

The database is persisted to disk (`saveToFile()`) at these points:

- After each index update (file save, create, delete, rename, editor switch)
- After each periodic scan that detects changes
- On extension deactivation (before the extension host shuts down)

The `saveToFile()` method exports the in-memory database to a `Buffer` and writes it atomically to `.asnotes/index.db`. If the `.asnotes/` directory does not exist (e.g. the user deleted it), the write is silently skipped — the directory is only created by the explicit init command.

**Safe save and mode transition:** All index update triggers in `extension.ts` use a `safeSaveToFile()` wrapper that checks for the `.asnotes/` directory before persisting. If the directory has been deleted while the extension is running, `safeSaveToFile()` calls `exitFullMode()` which:

1. Stops the periodic scanner
2. Closes the in-memory database
3. Disposes all registered providers (decorations, links, hover, rename tracker, completions)
4. Switches the status bar to passive mode

This allows users to "uninitialise" a workspace by simply deleting the `.asnotes/` directory — the extension detects the deletion on the next trigger and cleanly transitions to passive mode. Direct `saveToFile()` calls (without the guard) are only used in `initWorkspace()`, `rebuildIndex()`, and the `enterFullMode()` stale scan, where the directory’s existence is guaranteed.

---

## Activation model

The extension uses a `.asnotes/` directory in the workspace root as a project marker (analogous to `.git/` or `.obsidian/`). Its presence determines the operating mode.

### Passive mode

When no `.asnotes/` directory is found:

- A status bar item shows `$(circle-slash) AS Notes: not initialised`
- Clicking it runs the **AS Notes: Initialise Workspace** command
- No providers (decorations, links, hover, rename tracking) are registered
- The only active commands are `initWorkspace` and `rebuildIndex`

### Full mode

When `.asnotes/` exists:

1. The database is opened (or created if `index.db` is missing)
2. A stale scan runs to catch external changes (e.g. git pull)
3. All providers are registered: decorations, document links, hover, rename tracker
4. Index update triggers are activated (file events, editor switch, periodic scan)
5. The status bar shows `$(database) AS Notes (N pages)` — clicking runs rebuild

### Index update triggers

In full mode, these events keep the index current:

| Event | Handler | Action |
|---|---|---|
| `onDidSaveTextDocument` | Re-index saved file | Catches content changes |
| `onDidChangeTextDocument` | Re-index live buffer (debounced 500 ms) | Surfaces new wikilinks for autocomplete without saving |
| `onDidCreateFiles` | Index new file | New pages enter the index |
| `onDidDeleteFiles` | Remove from DB (or `staleScan` for folders) | Cascade-deletes links |
| `onDidRenameFiles` | Remove old + index new (or `staleScan` for folders) | Path updates |
| `onDidChangeActiveTextEditor` | Re-index departing file from editor buffer | Captures unsaved edits (e.g. new aliases) |

All handlers except `onDidChangeTextDocument` persist the DB after updating.

**Folder moves and deletes:** When the VS Code file explorer moves or renames a folder, `onDidRenameFiles` fires with the **folder** URI — not with the individual `.md` file URIs inside. The same applies to `onDidDeleteFiles` for folder deletes. An extension-based `isMarkdownUri` check on the event URIs is therefore insufficient to detect these operations.

Both handlers detect non-markdown URIs in the event and respond by running `indexScanner.staleScan()`. The stale scan compares every file on disk against the DB: files no longer on disk are removed (old paths after a folder delete or move), and files not yet indexed are added (files at their new location after a folder move). The individual per-file handling for bare `.md` file events is still applied as a fast path before the stale scan guard.

**Buffer read on editor switch:** The `onDidChangeActiveTextEditor` handler reads from the VS Code `TextDocument` buffer (`doc.getText()`) rather than from disk. This ensures that unsaved edits — such as newly added aliases in front matter — are captured in the index immediately when the user navigates away. If the document has already been closed (no longer in `workspace.textDocuments`), it falls back to reading from disk via `IndexScanner.indexFile()`. `completionProvider.refresh()` is **not** called here — completion data is global and unchanged by switching tabs; forward references from unsaved edits appear after the next save.

**Deferred re-indexing:** The editor-switch re-indexing work (`indexFileContent`, `safeSaveToFile`, task/backlink panel refresh) is wrapped in `setTimeout(0)`. This defers the synchronous SQLite work off the immediate event callback, allowing the new editor’s decoration manager to paint wikilinks blue before the background index sync blocks the event loop. The rename tracker’s `onDidChangeActiveTextEditor` fires synchronously (registered earlier), so it always reads the stale index state before the deferred re-index runs — preserving the critical ordering guarantee.

**Debounced live-buffer re-index:** The `onDidChangeTextDocument` handler re-indexes the current document from its editor buffer 500 ms after the last keystroke. This ensures that a wikilink like `[[New Topic]]` typed on line 1 is immediately available for autocomplete when the user starts typing `[[New` on line 2 — without needing to save or navigate away first. Because this is a transient in-memory update (no `.asnotes/index.db` write), it is fast and does not call `safeSaveToFile()`. The debounce prevents re-indexing on every single keystroke. The debounce timer is cancelled in `disposeFullMode()` to prevent a stale callback firing after full mode has been torn down.

### Periodic scanning

A background `setInterval` runs `staleScan()` at a configurable interval (default: 300 seconds). This catches:

- Files modified by external tools (git checkout, other editors)
- Files created or deleted outside VS Code

The interval is read from `as-notes.periodicScanInterval`. Setting it to `0` disables periodic scanning. Changes to the setting take effect immediately (the interval is restarted on `onDidChangeConfiguration`).

### Manual rebuild

The **AS Notes: Rebuild Index** command (`as-notes.rebuildIndex`) uses `resetSchema()` to obtain a completely fresh WASM instance and empty database:

1. `await indexService.resetSchema()` — closes the old Database, resets sql.js's internal WASM cache via `initSqlJs.resetCache()`, loads a fresh WASM instance with clean linear memory via `await initSqlJs()`, and creates a new empty Database with schema.
2. `indexScanner.fullScan()` — repopulates the empty database from disk.
3. `indexService.saveToFile()` — persists the rebuilt index.

**Why a fresh WASM instance is required (esbuild method):**

Every alternative approach on the same WASM heap fails on large workspaces (~18k files, ~280k links):

| Approach | Failure mode | Files before crash |
|---|---|---|
| `DELETE FROM` all tables | WASM runtime hangs indefinitely on 280k rows | 0 (never starts) |
| `DROP TABLE` with FK cascade | WASM runtime hangs on cascade checks | 0 (never starts) |
| `db.close()` + `new Database()` on cached module | "memory access out of bounds" — fragmented heap | ~1618 |

WASM linear memory can grow but never shrink. After indexing 18k files the heap is ~80 MB and fragmented. The only working path is a truly fresh WASM instance — proven by the initial index always completing successfully.

**How `resetCache()` works:**

sql.js caches the first `initSqlJs()` promise forever in a closure variable (`initSqlJsPromise`). The `sqlJsCacheResetPlugin` esbuild plugin (in `build.mjs`) intercepts `sql-wasm.js` during bundling and injects `initSqlJs.resetCache = function() { initSqlJsPromise = undefined; };` — this has closure access to the private variable. Calling `resetCache()` allows the next `initSqlJs()` to load a fresh WASM binary with clean memory. The old WASM module (~80 MB) becomes unreferenced and eligible for GC.

### Automatic schema migration (PRAGMA user_version)

Every time `IndexService.initDatabase()` opens an existing `.asnotes/index.db` file, it compares the stored `PRAGMA user_version` against the compiled-in `SCHEMA_VERSION` constant. If the stored value is lower, the schema is outdated and the database is automatically dropped and rebuilt.

**Why this matters:** The index database is a pure derived artifact — every record can be regenerated by re-scanning the markdown files. There is no user data that cannot be recovered. This makes drop-and-rebuild the simplest and safest migration strategy: no incremental SQL migration scripts, no ALTER TABLE statements, no data transformations.

**`SCHEMA_VERSION` constant:**

```typescript
// src/IndexService.ts
export const SCHEMA_VERSION = 1;
```

This integer is incremented whenever the schema changes (new column, new table, dropped index, etc.). Every future change only requires two edits: update `SCHEMA_SQL` and increment `SCHEMA_VERSION`.

**`initDatabase()` flow:**

1. If the DB file exists, open it and read `PRAGMA user_version`.
2. If `storedVersion < SCHEMA_VERSION`, call `resetSchema()` (drops all tables, fresh WASM instance, recreates schema) then stamp `PRAGMA user_version = SCHEMA_VERSION`. Return `{ schemaReset: true }`.
3. If `storedVersion >= SCHEMA_VERSION`, proceed normally (enable FK enforcement, run `SCHEMA_SQL` with `CREATE TABLE IF NOT EXISTS`). Return `{ schemaReset: false }`.
4. If the DB file does not exist, create a new in-memory database and stamp `user_version`. Return `{ schemaReset: false }`.

**Version 0 (pre-versioning databases):** SQLite initialises `user_version` to `0` by default. Any database created before schema versioning was introduced — i.e. every existing user's `.asnotes/index.db` — will have `user_version = 0`, which is less than `SCHEMA_VERSION = 1`. On first launch after upgrading, the database is automatically reset and a full rebuild is triggered. The user sees a progress notification: `AS Notes: Rebuilding index (schema updated)`.

**Caller contract:** `initDatabase()` returns `{ schemaReset: boolean }`. In `enterFullMode()` in `extension.ts`:

```typescript
const { schemaReset } = await indexService.initDatabase();
if (schemaReset) {
    // Schema was outdated — force a full rebuild with a progress notification
    await vscode.window.withProgress({ title: 'AS Notes: Rebuilding index (schema updated)' }, ...);
} else {
    // Normal path — run a stale scan to catch external changes
    const summary = await indexScanner.staleScan();
    ...
}
```

`resetSchema()` also stamps `user_version` directly, so a manual rebuild via the **Rebuild Index** command also keeps the version current.

**Scale:** Drop-and-rebuild works for arbitrarily complex schema changes because the migration code path never changes. There are no migration scripts to maintain or chain. Adding a new column, index, or table only requires changing `SCHEMA_SQL` and incrementing `SCHEMA_VERSION`.

### Clean workspace

The **AS Notes: Clean Workspace** command (`as-notes.cleanWorkspace`) performs a full reset:

1. Confirms with a modal warning dialog.
2. Calls `exitFullMode()` — stops periodic scanning, closes the database handle, nulls all service instances (`indexService`, `indexScanner`, `ignoreService`, `completionProvider`, `logService`), disposes all full-mode disposables, and switches to passive mode.
3. `fs.rmSync(.asnotes/, { recursive: true, force: true })` — deletes the entire `.asnotes/` directory tree (index database, logs, git hook config).
4. Shows an informational message directing the user to run **Initialise Workspace** to start fresh.

`.asnotesignore` at the workspace root is intentionally preserved — it is a user-editable, version-controlled configuration file.

If the `.asnotes/` directory does not exist, the command shows an informational message and returns early. If the directory deletion fails (e.g. file lock on Windows), an error message is displayed.

---

## Aliases and front matter

### FrontMatterService

`FrontMatterService` (`src/FrontMatterService.ts`) is a lightweight, custom YAML front matter parser with no external dependencies. It handles the specific subset of YAML needed for `aliases:` (and extensible to future fields like `tags:`).

**Parsing approach:**

1. `extractFrontMatter(content)` finds text between the first two `---` lines at the start of a file. Returns `null` if no valid front matter block exists.
2. `parseAliases(content)` extracts the `aliases:` field and returns a `string[]`.

**Supported alias formats:**

```yaml
# List style
aliases:
  - Alias One
  - Alias Two

# Inline array style
aliases: [Alias One, Alias Two]

# Single value
aliases: Alias One
```

**Value cleaning:** `cleanAliasValue()` strips surrounding quotes (`'` or `"`) and accidental `[[` / `]]` wikilink brackets from alias values. This prevents user errors from creating broken alias records.

**In-place editing:** `updateAlias(content, oldAlias, newAlias)` modifies the front matter of a markdown file to replace a specific alias name. It returns the modified content string or `null` if the alias is not found. This preserves all formatting outside the targeted alias line.

### Alias indexing

During `IndexService.indexFileContent()`, after link parsing, `indexAliasesFromContent()` is called:

1. A new `FrontMatterService` instance parses the content for aliases.
2. `setAliasesForPage(pageId, aliasNames)` deletes all existing alias records for the page and inserts fresh ones.
3. Each alias name is sanitised into a filename using the standard invalid-character replacement (`/ ? < > \ : * | "` → `_`).
4. The `alias_filename` column stores the sanitised name with `.md` extension (e.g. `"Short Name"` → `"Short Name.md"`).

Alias records cascade-delete when the parent page is removed.

### Alias resolution order

When resolving a wikilink (in `WikilinkFileService.resolveViaIndex()`), the index is queried in this order:

1. **Direct filename match** — `findPagesByFilename()` (case-insensitive)
2. **Alias match** — `resolveAlias()` (case-insensitive JOIN on `aliases` → `pages`)
3. **Fallback** — return `undefined` (caller creates the file in source directory)

The `resolvePageByFilename()` method on `IndexService` exposes this two-step lookup directly and returns `{ page, viaAlias }`.

**Backlink counting** uses `getBacklinkCountIncludingAliases(pageId)`, which collects all filenames (the page's own filename plus all alias filenames) and counts matching links across the workspace in a single `IN (...)` query.

### Alias-aware rename tracking

The `WikilinkRenameTracker` classifies each detected rename as either:

- **Direct rename** — the old link name matches a file directly → rename the file, update all references
- **Alias rename** — the old link name resolves via `resolveAlias()` → update front matter on the canonical page, update all references, **no file rename**

For alias renames:

1. `FrontMatterService.updateAlias()` modifies the canonical page's front matter in-place.
2. `updateLinksInWorkspace()` replaces all `[[OldAlias]]` references across the workspace with `[[NewAlias]]`.
3. `IndexService.updateAliasRename()` updates the alias record and all link references in the index.
4. The canonical page is re-indexed so its alias list is refreshed from the updated front matter.

---

## Subfolder link resolution

### Index-based global resolution

Before subfolder support, all links resolved to the same directory as the source file. With a persistent index, links now resolve globally: `[[My Page]]` finds `My Page.md` anywhere in the workspace.

`WikilinkFileService` accepts an optional `IndexService` via constructor injection. When available, `resolveViaIndex()` queries the index before falling back to same-directory resolution.

### Disambiguation algorithm

When `findPagesByFilename()` returns multiple matches (same-named files in different folders):

1. **Same directory** — if any candidate is in the same directory as the source file, it wins immediately.
2. **Closest folder** — otherwise, `pickClosest()` selects the candidate with the smallest directory distance.

This is implemented via `getPathDistance()` in `PathUtils.ts`.

### Path distance calculation

`getPathDistance(dirA, dirB)` computes the number of directory hops between two paths:

```
notes      ↔ notes      → 0 (same directory)
notes      ↔ notes/sub  → 1 (one hop down)
notes/a    ↔ notes/b    → 2 (one up, one down)
.          ↔ deep/nested → 2 (two hops down from root)
```

The algorithm:

1. Split both paths into segments (forward slashes).
2. Find the common prefix length.
3. Distance = (steps up from A to common ancestor) + (steps down from ancestor to B).

Comparison is case-insensitive to match the case-insensitive filename resolution used elsewhere.

---

## Wikilink autocomplete

The `WikilinkCompletionProvider` provides autocomplete suggestions when the user types `[[` in a markdown file. It uses VS Code's `CompletionItemProvider` API.

### Trigger detection

The provider is registered with `[` as the trigger character. When it fires, it examines the text before the cursor to find an unclosed `[[` pair:

1. `findInnermostOpenBracket()` scans the text using a stack-based bracket tracker.
2. Each `[[` pushes onto the stack; each `]]` pops.
3. If the stack is non-empty, the last entry is the innermost unclosed `[[`.
4. If the stack is empty (no unclosed `[[`), no completions are returned.

This means single `[` brackets do not trigger completions, and fully closed wikilinks (like `[[Page]]`) do not re-trigger.

**Close-bracket consumption:** After finding the open `[[`, the provider also scans forward from the cursor using `findMatchingCloseBracket()` to detect an existing `]]` that closes the current wikilink. If found, the replacement range extends past the `]]`, so the inserted `PageName]]` replaces both the typed text and the existing closing brackets. This prevents orphan `]]` pairs after completion (e.g. `[[PageName]]]]`). The function uses depth tracking: nested `[[` increase depth, `]]` decrease it, and the match is found when depth reaches −1.

### Completion items

Items are built from two sources in the index:

| Source | Kind | Label | Detail | Sort prefix |
|---|---|---|---|---|
| Page | File | Filename stem (no `.md`) | Subfolder path (if ambiguous) | `0-` |
| Forward ref | File | Page name | `not yet created` | `1-` |
| Alias | Reference | Alias name | `→ CanonicalPage` | `2-` |

The `sortText` prefix ensures pages always appear before aliases in the list. Both page and alias items set `insertText` to `Name]]` — selecting an item auto-closes the wikilink.

**Disambiguation:** when multiple pages share the same filename (e.g. `notes/Topic.md` and `archive/Topic.md`), the subfolder path is shown in the `detail` field so the user can distinguish them.

### Nested wikilinks and front matter

**Nested wikilinks:** when the user types `[[` inside an existing unclosed `[[...`, the bracket tracker detects the inner `[[` and scopes the replacement range to start after it. This allows the inner wikilink to be completed independently while the outer link remains open.

**Front matter suppression:** `isLineInsideFrontMatter()` checks whether the cursor is between the first two `---` lines. If so, no completions are returned — front matter aliases are plain strings, not wikilinks.

All three pure functions — `findInnermostOpenBracket()`, `findMatchingCloseBracket()`, and `isLineInsideFrontMatter()` — live in `CompletionUtils.ts` with no VS Code dependency, and are fully unit-tested.

### Caching strategy

The provider maintains a cached array of `CompletionItem[]` objects. The cache is rebuilt **eagerly** whenever `refresh()` is called — there is no dirty flag or lazy rebuild.

- **Eager rebuild:** `refresh()` calls `rebuildCache()` immediately, running three SQLite queries (`getAllPages`, `getAllAliases`, `getForwardReferencedPages`) and building lightweight plain data objects (not `CompletionItem` instances). This happens at index-update time (file save, create, delete, rename, periodic scan, rebuild), not at `[[` keystroke time.
- **Not called on text-change debounce:** The 500 ms `onDidChangeTextDocument` debounce handler does **not** call `completionProvider.refresh()`. This eliminates three SQLite queries on every typing pause. Forward references appear in autocomplete after the next file save.
- **Warm on activation:** `enterFullMode()` calls `completionProvider.refresh()` immediately after construction (post stale-scan), so the cache is warm before the user types the first `[[`.
- **Not called on editor switch:** The `onDidChangeActiveTextEditor` handler does **not** call `completionProvider.refresh()`. Completion data is global (all pages, aliases, forward refs) and is unaffected by which tab is focused. This avoids 3 SQLite queries on every tab switch.
- **Hot path:** `provideCompletionItems()` never touches the database. It builds `CompletionItem` instances from lightweight cached data objects with the per-call replacement range and returns them inside a `CompletionList`.
- **Filtering:** VS Code handles client-side filtering of the full list as the user types — no per-keystroke DB queries.

### CompletionList and backspace handling

`provideCompletionItems()` returns a `vscode.CompletionList` with `isIncomplete: true`. This tells VS Code to re-query the provider on every keystroke — including backspace. Without `isIncomplete`, VS Code may dismiss the completion widget on backspace because it treats the session as over.

Since the cache is pre-built (no SQLite in the hot path), the cost of re-querying on every keystroke is negligible: it's just a clone of the cached items with an updated replacement range.

**Note:** `CompletionList` with `isIncomplete: true` combined with a **capped/filtered** subset was previously tested but VS Code dropped the widget entirely. The current approach returns the **full** item list with `isIncomplete: true`, which works correctly.

### Completion re-trigger after session death

`isIncomplete: true` keeps the completion session alive while the widget is visible, but VS Code still kills the session when zero items match the typed text (or on word-boundary heuristics such as trailing spaces). Once the session is dead, backspace does not restart it — no trigger character is being typed.

To handle this, a separate `onDidChangeTextDocument` listener in `extension.ts` detects **deletions** (backspace / delete key) where the cursor remains inside an unclosed `[[`. When detected, it fires `editor.action.triggerSuggest` via `setTimeout(0)` to restart the completion session. This is safe because:

- **Active session:** `triggerSuggest` is a no-op when the widget is already showing.
- **Dead session:** A new session starts, `provideCompletionItems()` is called, and items matching the current wikilink text are displayed.
- **Cursor outside `[[`:** `findInnermostOpenBracket()` returns -1, so no trigger fires.

The listener only fires on deletions (where `rangeLength > 0` and `text` is empty), not on forward typing — forward typing either keeps the existing session alive or opens a new one via the `[` trigger character.

### Completion and rename tracking interaction

When the user types inside a wikilink, two things happen on every keystroke:

1. `WikilinkRenameTracker.onDocumentChanged` — records `pendingEdit` (the outermost wikilink position the cursor is inside). This edit state is cleared and rename detection runs when the cursor exits the wikilink.
2. The 500 ms `onDidChangeTextDocument` debounce in `extension.ts` — re-indexes the live buffer into the in-memory DB so that newly typed forward references appear in autocomplete immediately.

These two behaviours interact at the index: rename detection (`checkForRenames`) works by comparing the **current DB state** (the last-indexed link positions and names) against the live document. If the debounce fires and re-indexes the document before the cursor exits the wikilink, the DB is updated to reflect the edited name. When `checkForRenames` later runs after cursor exit, it compares the edited name in the DB against the same name in the live document — no difference is detected, and the rename dialog is never shown.

**Guard:** The debounce callback in `extension.ts` checks `renameTracker.hasPendingEdit(doc.uri.toString())` before calling `indexFileContent`. If a pending edit is active for that document, the re-index is skipped for that tick. `WikilinkRenameTracker` exposes:

```typescript
hasPendingEdit(docKey: string): boolean
```

This returns `true` while `pendingEdit` is set for the given document URI. Once `checkForRenames` completes — either by detecting no change or by performing the rename via `refreshIndexAfterRename` — the pending edit is cleared and subsequent debounce ticks can re-index normally.

**`checkForRenames` scans the full document.** It reads all link rows for the page from the DB (via `getLinksForPage`) and builds an `(line, start_col) → LinkRow` map. It then parses every line in the live document, comparing `page_name` for each position. Any position that exists in both the DB and the live parse with a different `page_name` is a rename candidate. This is a full-document comparison — it does not limit itself to the link the cursor was editing.

Manual renames continue to work normally: `pendingEdit` is set on any document change (not just completions), and `checkForRenames` is invoked on cursor exit or editor switch.

---

## Wikilink parsing

### Stack-based bracket matching

`WikilinkService.extractWikilinks()` is the core parser. It processes the input string character by character using a stack of bracket positions.

**Algorithm:**

1. Iterate through each character in the input string.
2. When a `[` is encountered, push its index onto the stack — but only if a look-ahead confirms it could be part of a `[[` pair (either the next character is `[`, or the previous character was `[` and we're waiting for a match).
3. When a `]` is encountered and the stack is non-empty, pop the top index. Check whether the popped position and current position form a valid `[[...]]` pair.
4. A pair is valid when:
   - The stack is now at an even length (balanced)
   - The substring starts with `[[` and ends with `]]`
5. Valid pairs become `Wikilink` objects with position metadata.

**Stack parity** (`stack.length % 2`) distinguishes between "waiting for a completing bracket" (odd) and "ready for a new pair" (even). This allows the parser to handle arbitrarily deep nesting.

**Edge cases handled:**

- Unbalanced brackets (e.g. `[[Mount] Escape]]`) — the parity check rejects these
- Interrupting characters (e.g. `[$[Mount]$]`) — the bracket look-ahead skips non-bracket characters
- Multiple sibling links on the same line — the stack resets after each completed pair
- Deeply nested structures — the stack naturally handles `[[[[[[A]] B]] C]]` at any depth

### The Wikilink model

Each parsed wikilink becomes a `Wikilink` instance (`src/Wikilink.ts`) with:

| Property | Description |
|---|---|
| `linkText` | The full text including brackets, e.g. `[[Page Name]]` |
| `startPositionInText` | Index of the first `[` in the input string |
| `endPositionInText` | Index of the last `]` (inclusive, computed as `startPositionInText + linkText.length - 1`) |
| `pageName` | `linkText` with outer `[[` and `]]` stripped. Inner brackets are retained for nested links — e.g. `[[Outer [[Inner]]]]` → `Outer [[Inner]]` |
| `pageFileName` | `pageName` with invalid filename characters replaced by `_` |
| `children` | Optional recursive child links (populated when `recurseChildren: true`) |

### Ordering

By default, `extractWikilinks()` returns results sorted by length descending, then alphabetically. This ensures deterministic ordering for tests and makes outermost links appear first in the array. The `orderWikilinks` parameter can disable this when insertion-order matters.

---

## Non-overlapping segments

### Why segments are needed

In `[[Outer [[Inner]] text]]`, the parser returns two wikilinks whose character ranges overlap:

```
Position: 0         1         2
          0123456789012345678901234
Text:     [[Outer [[Inner]] text]]

Outer:    [========================]  (0–23)
Inner:              [========]        (8–16)
```

VS Code's `DocumentLink` and `TextEditorDecorationType` APIs work with `Range` objects. If we register overlapping ranges:

- **Decorations**: The outer range's style overrides the inner range's style (VS Code applies the last-set decoration)
- **DocumentLinks**: VS Code picks the larger/first registered link, making nested links unclickable

### The algorithm

`WikilinkService.computeLinkSegments()` splits overlapping wikilinks into non-overlapping segments where each character position maps to exactly one wikilink (the innermost).

**Steps:**

1. Find the minimum start and maximum end across all wikilinks.
2. For each character position in that range, call `findInnermostWikilinkAtOffset()` to determine which wikilink "owns" that position.
3. Group consecutive characters owned by the same wikilink into contiguous `LinkSegment` objects.

Each `LinkSegment` has:

- `startOffset` (inclusive)
- `endOffset` (exclusive)
- `wikilink` — reference to the owning `Wikilink` object

**Time complexity:** O(n × m) where n is the character range and m is the number of wikilinks. This is acceptable because lines are typically short and wikilink counts are small. If performance became a concern, the character-by-character scan could be replaced with a sweep-line approach over sorted wikilink endpoints.

### Example: 3-level nesting

```
Input: [[Test [[[[Test]] Page]] Page]]
       0         1         2         3
       0123456789012345678901234567890

Wikilinks extracted:
  Outer:  [[Test [[[[Test]] Page]] Page]]  (0–30)
  Middle: [[[[Test]] Page]]                (7–23)
  Inner:  [[Test]]                         (9–16)

Segments produced:
  [0–7)   → Outer  ("[[Test ")
  [7–9)   → Middle ("[[")
  [9–17)  → Inner  ("[[Test]]")
  [17–24) → Middle (" Page]]")
  [24–31) → Outer  (" Page]]")
```

Each segment is registered as a separate `DocumentLink` and a separate decoration range. Clicking position 12 (inside `[[Test]]`) navigates to `Test.md`. Clicking position 20 (inside `Page]]`) navigates to `[[Test]] Page.md`.

---

## Decorations

### Default vs active

`WikilinkDecorationManager` maintains two decoration types:

| Decoration | Colour | Style | Applied to |
|---|---|---|---|
| Loading | `#888888` (muted grey) | Normal weight | All wikilink segments while index is loading |
| Default | Theme's `textLink.foreground` (or `as-notes.wikilinkColour` override) | Normal weight | All wikilink segments after index is ready |

All wikilinks share the same colour — there is no separate active/hover style.

### Configurable colour

The wikilink colour defaults to the VS Code theme's `textLink.foreground` colour (the same colour used by the backlinks panel). Users can override it via the `as-notes.wikilinkColour` setting:

| Setting | Default | Description |
|---|---|---|
| `as-notes.wikilinkColour` | _(empty — uses theme colour)_ | Hex colour for wikilinks (e.g. `#3794ff`). Leave empty to follow the theme. |

Changing the setting takes effect immediately — no reload required. Internally, decoration types are immutable in VS Code, so changing the colour disposes the old types and creates new ones.

### Loading state

The decoration manager is created **before** the index scan starts, so wikilinks are visually recognised immediately on activation. While the index is loading (`ready = false`), all wikilinks are shown with the muted grey `loadingDecorationType`. The active (hover/cursor) highlight is suppressed — there is nothing to navigate to yet.

Once the scan completes, `extension.ts` calls `decorationManager.setReady()`, which flips `ready = true` and re-applies decorations to the active editor. Wikilinks shift from grey to their normal blue, signalling that Ctrl+Click navigation and hover tooltips are now available.

The status bar shows `$(sync~spin) AS Notes: Indexing...` during the scan, then switches to the normal `$(database) AS Notes — N pages` display.

### Why segments prevent decoration conflicts

Earlier versions registered one decoration range per wikilink. With overlapping nested wikilinks (e.g. `[[outer [[inner]]]]`), overlapping ranges would cause unpredictable results as VS Code renders overlapping decorations in registration order.

By using segments, each character position has exactly one range. No overlap, no conflict.

### Decoration caching and debouncing

Parsing every line on every event is expensive for large documents. Segments are cached per `(document.uri, document.version)`. A full re-parse only occurs when the document version changes (text edit) or a different document is focused.

- **Debounced text changes:** `onDidChangeTextDocument` is debounced at 50 ms. Rapidly fired edit events are batched into a single re-parse.

This ensures:
- Opening a document parses once and applies decorations immediately.
- Typing triggers at most one re-parse per 50 ms burst.

### Debug logging

Diagnostic logging is provided by `LogService` (`src/LogService.ts`), a pure Node.js rolling file logger with no VS Code dependencies.

**Activation:** enabled via the `as-notes.enableLogging` setting (boolean, default `false`) or the `AS_NOTES_DEBUG=1` environment variable. Changing the setting requires a reload. When disabled, all `LogService` methods are no-ops with negligible overhead.

**Output:** log files are written to `.asnotes/logs/as-notes.log`. When a file exceeds 10 MB it is rotated: `as-notes.log` → `as-notes.1.log` → `as-notes.2.log` → ... up to `as-notes.4.log` (5 files total). The oldest file is deleted on rotation.

**Log format:** `[ISO timestamp] [LEVEL] tag: message`

**Usage in services:** `LogService` is injected as an optional constructor parameter (defaulting to `NO_OP_LOGGER`) into `IndexService`, `IndexScanner`, `WikilinkDecorationManager`, and `WikilinkCompletionProvider`. The `extension.ts` module also uses the instance directly for lifecycle logging. A `NO_OP_LOGGER` singleton is used when logging is disabled, avoiding null checks throughout the codebase.

**Timer API:** `logService.time(tag, label)` returns a closure that, when called, logs the elapsed milliseconds at INFO level — used for performance instrumentation throughout the decoration and completion pipelines.

**Instrumented operations:** The following operations produce diagnostic log entries when logging is enabled:

| Component | Operations logged |
|---|---|
| `IndexService` | `ensureSqlModule` (first vs cached load, timer), `initDatabase` (new/existing + file size, schema creation), `resetSchema` (close old DB, WASM cache reset, fresh initSqlJs timer, create new DB), `clearAllData` (timer), `close`, `saveToFile` (timer + byte count), `indexFileContent` (path → pageId), `getTotalLinkCount` (single COUNT query) |
| `IndexScanner` | `fullScan` (file count, progress every 500 files, timer, total indexed + links via `getTotalLinkCount()`), `staleScan` (disk/index counts, new/stale/deleted/unchanged summary, timer) |
| `extension.ts` | `enterFullMode` (DB init, stale scan, complete), `rebuildIndex` (resetSchema, fullScan, save, success with counts; errors at ERROR level), `exitFullMode` (start/complete), `cleanWorkspace` (confirmed), `startPeriodicScan` (each tick start, changes detected or no changes) |

---

## Click navigation

### DocumentLinkProvider and command URIs

`WikilinkDocumentLinkProvider` implements VS Code's `DocumentLinkProvider` interface. For each line, it computes non-overlapping segments and creates a `DocumentLink` per segment.

Each `DocumentLink` uses a **command URI** rather than a file URI:

```
command:as-notes.navigateWikilink?{encoded JSON args}
```

The command URI carries:

- `targetUri` — the exact-case file URI for the target `.md` file
- `pageName` — the raw page name from the wikilink
- `pageFileName` — the sanitised version for filename construction
- `sourceUri` — the URI of the document containing the link (needed for case-insensitive resolution)

**Why command URIs instead of direct file URIs:** Direct file URIs would bypass the case-insensitive resolution and auto-creation logic. The command URI delegates to `WikilinkFileService.navigateToFile()` which handles both.

### File resolution

`WikilinkFileService.resolveTargetUri()` constructs the target path as:

```
{directory of source file}/{pageFileName}.md
```

All target files live in the same directory as the file containing the link. There is no support for cross-directory linking — this is intentional to keep the mental model simple (one folder = one wiki).

### Case-insensitive matching

`resolveTargetUriCaseInsensitive()` handles the case mismatch problem:

1. **Fast path:** `stat()` the exact-case URI. If it exists, return it. On Windows and macOS (HFS+), this always succeeds because those filesystems are case-insensitive.
2. **Slow path:** If the exact-case `stat` fails (Linux, or file truly doesn't exist), scan the directory with `workspace.fs.readDirectory()` and compare filenames case-insensitively.

The fast path avoids the directory scan in the common case. The slow path ensures cross-platform consistency.

### Auto-creation

When `navigateToFile()` finds no matching file (exact or case-insensitive), it:

1. Creates an empty file using `workspace.fs.writeFile(targetUri, new Uint8Array())`
2. Shows an information notification: `Created {pageFileName}.md`
3. Opens the newly created file

The file is created with the exact casing from the wikilink text.

---

## Hover

`WikilinkHoverProvider` shows a tooltip when the mouse hovers over a wikilink. It:

1. Parses the line for wikilinks
2. Finds the innermost wikilink at the hover position
3. Resolves the target file using case-insensitive matching
4. Queries the index for backlink count (`IndexService.getBacklinkCount()`)
5. Returns a `MarkdownString` showing:
   - The target filename (e.g. `**My Page.md**`)
   - Existence status: `$(file) Existing file` or `$(new-file) Will be created`
   - Backlink count (when > 0): `$(references) N backlinks`

The `IndexService` is an optional constructor parameter — when not provided (e.g. during testing without an index), the backlink count is simply omitted.

---

## Rename tracking

This is the most complex subsystem. It detects when a user edits a wikilink's text and offers to rename the corresponding file and update all matching links across the workspace.

### Index-backed detection

The rename tracker uses the persistent index as the "before" state rather than maintaining separate in-memory snapshots. When a rename check fires, the tracker reads link records from `IndexService.getLinksForPage()` and compares them with the live document state.

This works because the index represents the **last-indexed state** of each file — updated only on save, file events, and editor switch. While the user is actively editing a wikilink, the index still holds the pre-edit link state, providing a natural baseline for comparison.

The tracker accepts `IndexService` and `IndexScanner` as constructor parameters:

```typescript
constructor(
    wikilinkService: WikilinkService,
    fileService: WikilinkFileService,
    indexService: IndexService,
    indexScanner: IndexScanner,
)
```

During editing, the tracker records a `pendingEdit` noting which outermost wikilink the cursor is inside:

```typescript
interface PendingEditInfo {
    docKey: string;           // document URI
    line: number;             // line the cursor was on
    wikilinkStartPos: number; // start of outermost wikilink
}
```

Edits to files not yet in the index (e.g. brand new unsaved files) are ignored — there's no baseline to compare against.

### Rename detection algorithm

When a rename check fires (cursor exit or editor switch):

1. **Look up the page** in the index via `getPageByPath()` using the workspace-relative path.

2. **Read old links** from the index via `getLinksForPage(pageId)`. Each `LinkRow` has `line`, `start_col`, and `page_name` — the same positional data formerly stored in snapshots.

3. **Index old links** by the composite key `"line:start_col"` in a `Map`.

4. **Parse the current document** line by line for wikilinks (the live/edited state).

5. **Compare:** For each current wikilink, look up the old link at the same `(line, start_col)`. If the `page_name` differs, this is classified as a rename:

    ```
    Index: { line: 5, start_col: 10, page_name: "Foo" }
    Live:  { line: 5, start_col: 10, pageName: "Bar" }
    → Detected rename: "Foo" → "Bar"
    ```

6. **Why (line, start_col) works as a stable key:** When the user edits text *inside* a wikilink (between the `[[` and `]]`), the start position of that wikilink does not change — the `[[` stays at the same column. The `page_name` changes but the key remains stable. This is the fundamental invariant that makes positional detection possible.

7. **When (line, start_col) breaks:** If the user edits text *before* a wikilink on the same line (e.g. adding characters at the start of the line), the wikilink's `start_col` shifts. The old and new positions won't match by key, so no rename is detected. This is the correct behaviour — the link text hasn't changed; only its position has.

**Event handler ordering:** The rename tracker's `onDidChangeActiveTextEditor` handler is registered before the extension.ts `onDidChangeActiveTextEditor` handler (which re-indexes the departing file). This ordering is critical — the rename tracker must read the pre-edit index state before the extension.ts handler updates it.

### Cursor-exit and editor-switch triggers

The rename check does not use a timer or debounce. It fires on two events:

**Cursor exit (`onSelectionChanged`):**

When the user's cursor moves (via click or keypress), the tracker checks whether the cursor has left the wikilink it was inside during the last edit. It compares:

- Current cursor line vs `pendingEdit.line`
- Outermost wikilink at current cursor position vs `pendingEdit.wikilinkStartPos`

If the line changed, or the cursor is outside all wikilinks, or it's inside a different outermost wikilink — the cursor has exited, and the rename check fires.

The "outermost" wikilink is used as the boundary rather than the innermost. This ensures that navigating between nested links within the same outer link doesn't prematurely trigger a rename check.

**Editor switch (`onDidChangeActiveTextEditor`):**

When the user switches tabs or opens a different file, the tracker checks for renames in the previously active document (using the stored `pendingEdit.docKey`), then takes a snapshot of the newly active document.

### Multi-level rename execution

When editing a nested link, multiple renames are detected. For example, editing `[[Pagey]]` to `[[Page]]` inside `[[Test [[Pagey]] stuff]]` produces two renames:

| Level | Old pageName | New pageName |
|---|---|---|
| Inner | `Pagey` | `Page` |
| Outer | `Test [[Pagey]] stuff` | `Test [[Page]] stuff` |

**Processing order — outermost first:**

Renames are sorted by range size (largest first). This is critical because:

1. When the outer link `[[Test [[Pagey]] stuff]]` is replaced with `[[Test [[Page]] stuff]]` across the workspace, the inner `[[Pagey]]` reference inside it is also replaced. This is intentional — the outer replacement is a full-text replacement of the entire `[[...]]` content.

2. The inner rename pass (`[[Pagey]]` → `[[Page]]`) then only affects files where `[[Pagey]]` appears as a standalone link (not wrapped inside the outer link).

If the order were reversed, the inner pass would incorrectly modify the outer link text before the outer pass had a chance to replace the whole thing.

**Confirmation dialog:**

A single dialog lists all affected renames. For each rename:

- If the old target file exists → shows as a file rename (e.g. `"Pagey.md" → "Page.md"`)
- If the old file doesn't exist → shows as a link-only change

**Workspace-wide link update:**

`updateLinksInWorkspace()` finds all `.md` and `.markdown` files, parses each for wikilinks, and creates a `WorkspaceEdit` that replaces every `[[oldPageName]]` with `[[newPageName]]`. After applying the edit, it saves modified files.

### Post-rename index refresh

After a rename operation completes, `refreshIndexAfterRename()` ensures the index is consistent before releasing control:

1. **Re-index the source document** — captures the edited link text
2. **Remove old page path + re-index renamed files** — at their new locations
3. **Bulk-update link references** — `IndexService.updateRename()` updates all `links.page_name` and `links.page_filename` records that point to the old filename
4. **Persist the database** — `saveToFile()`

This explicit refresh prevents a stale-index window where the next edit event could compare against outdated links. The extension.ts save/rename handlers may also re-index some of these files (via event triggers), but the operations are idempotent — double-indexing is harmless and keeps the code robust.

### Re-entrancy guard

The `isProcessing` flag prevents document-change events fired by the rename operation itself (file renames, workspace edits) from being treated as new user edits. It is set to `true` before any rename work begins and cleared in the `finally` block.

---

## Markdown preview rendering

VS Code's built-in markdown preview is extensible via the `contributes` contribution point `markdown.markdownItPlugins`. When this flag is set in `package.json`, VS Code calls the `extendMarkdownIt(md)` function returned by `activate()` during preview initialisation, passing the markdown-it instance used to render preview HTML.

The implementation lives in `src/MarkdownItWikilinkPlugin.ts` (the plugin itself) and `createExtendMarkdownIt()` in `src/extension.ts` (the resolver and wiring).

### Plugin registration

`package.json` declares two contribution points under the flat dotted-key format that VS Code requires:

```json
"contributes": {
    "markdown.markdownItPlugins": true,
    "markdown.previewStyles": [
        "./media/wikilink-preview.css"
    ]
}
```

**Critical:** These must be flat dotted keys at the top level of `contributes` (e.g. `"markdown.markdownItPlugins"`), not nested under a `"markdown"` object. VS Code's markdown extension looks up the dotted key literally; a nested structure is silently ignored and the plugin is never loaded.

`activate()` returns `{ extendMarkdownIt }` — the function VS Code calls with the markdown-it instance. This is constructed via `createExtendMarkdownIt()` which closes over a `WikilinkService` instance and the resolver function.

### Non-blocking activation

`activate()` must return the `extendMarkdownIt` API immediately. VS Code's markdown preview extension awaits `activate()` before calling the plugin. If `activate()` blocks on slow async work (e.g. database initialisation, stale scan), the preview hangs indefinitely.

To solve this, `enterFullMode()` is launched fire-and-forget:

```typescript
enterFullMode(context, workspaceRoot).catch(err => {
    console.error('as-notes: failed to enter full mode', err);
    setPassiveMode('Index initialisation failed');
});
```

The `apiReturn` object containing `extendMarkdownIt` is returned synchronously on the next line. The preview plugin begins working immediately with fallback same-directory links. Once the index finishes loading in the background, subsequent preview renders gain full subfolder and alias resolution.

### Inline rule

`wikilinkPlugin()` registers a custom inline rule on the markdown-it instance using `md.inline.ruler.before('link', 'wikilink', ...)`. Registering **before** the built-in `link` rule is critical — it prevents markdown-it from interpreting bracket characters as standard link syntax (e.g. `[[Page **Name**]]` would otherwise be parsed as nested emphasis inside brackets).

The inline rule (`wikilinkInlineRule`) operates as follows:

1. **Quick bail** — checks that the current position starts with `[[` and that there are at least 5 characters remaining (`[[x]]`).
2. **Outermost close scan** — `findOutermostClose()` scans forward from the opening `[[`, tracking nesting depth. Each `[[` increments depth; each `]]` decrements. When depth returns to zero, the position of the final `]` is returned. This correctly skips nested `[[...]]` pairs.
3. **Silent mode** — when markdown-it calls with `silent: true` (probing whether the rule matches), the function returns `true` without producing tokens.
4. **Token emission** — the full wikilink text is parsed with `WikilinkService.extractWikilinks()`, then segmented with `computeLinkSegments()`. For each segment, three tokens are pushed: `link_open` (with `href` and `class="wikilink"` attributes), `text` (display text with brackets stripped), and `link_close`.
5. **Advance position** — `state.pos` is moved past the closing `]]` so markdown-it does not re-process the consumed characters.

### Nested link handling in preview

HTML does not allow nested `<a>` elements. For `[[Outer [[Inner]] text]]`, the plugin uses the same `computeLinkSegments()` approach as the editor's decorations and document links, producing three **adjacent** `<a>` elements:

```html
<a href="Outer%20%5B%5BInner%5D%5D%20text.md" class="wikilink">Outer </a>
<a href="Inner.md" class="wikilink">Inner</a>
<a href="Outer%20%5B%5BInner%5D%5D%20text.md" class="wikilink"> text</a>
```

Bracket delimiters (`[[`, `]]`) are stripped from display text by `stripBrackets()`, which iteratively removes leading `[[` pairs and trailing `]]` pairs. Each segment is independently clickable and navigates to the correct target.

### Link resolver

The resolver function (closure created in `createExtendMarkdownIt()`) maps a sanitised page filename to a relative href. It follows the same resolution order used elsewhere in the extension:

1. **Direct filename match** — `indexService.findPagesByFilename()`. If multiple matches exist, disambiguation uses same-directory preference then closest-folder tiebreak via `getPathDistance()`.
2. **Alias match** — `indexService.resolveAlias()` for alias-to-canonical page resolution.
3. **Fallback** — `encodeURIComponent(pageFileName + '.md')`, a same-directory relative link.

The fallback fires when the index is not yet loaded (non-blocking activation) or in passive mode (no `.asnotes/` directory). This ensures wikilinks always render as clickable links, even before the index is ready.

When the index resolves a target to a different subfolder, `relativeLink()` computes the correct relative path from source to target:

```typescript
function relativeLink(sourcePath: string, targetPath: string): string {
    const sourceDir = path.dirname(sourcePath);
    const relative = path.relative(sourceDir, targetPath).replace(/\\/g, '/');
    return relative.split('/').map(s => encodeURIComponent(s)).join('/');
}
```

Each path segment is individually URI-encoded so that spaces and special characters are handled correctly.

### Source file context

The resolver needs to know which file is being previewed in order to compute relative paths. VS Code (≥1.72) populates `state.env.currentDocument` with the URI of the source file during markdown-it rendering.

`getSourcePathFromEnv()` extracts the workspace-relative source path from this environment:

- If `currentDocument` is a `vscode.Uri` object (has `fsPath`), `workspace.asRelativePath()` converts it.
- If it's a URI string, it's parsed first with `vscode.Uri.parse()`.
- If not available, `undefined` is returned and the resolver falls back to same-directory links.

### Preview CSS

`media/wikilink-preview.css` is declared via `contributes.markdown.previewStyles` and loaded into the markdown preview webview. It styles the `.wikilink` class applied to all rendered wikilink `<a>` elements:

| Theme | Colour | Hover colour |
|---|---|---|
| Light | `#4080bf` | `#2060a0` |
| Dark / High contrast | `#6796e6` | `#85b1ff` |

Links use a dotted bottom border (solid on hover) instead of underline, and `text-decoration: none` to override the default link underline.

### Limitations of preview links

- **Read-only** — the preview plugin only reads from the index; it never writes. No database mutations occur during rendering.
- **No auto-creation** — clicking a link to a non-existent page in preview mode shows VS Code's default "file not found" behaviour. The auto-creation logic in `WikilinkFileService.navigateToFile()` is not triggered because preview link clicks are handled by VS Code's built-in markdown preview link handler, not the extension's command URI.
- **Preview-to-preview navigation** — VS Code's built-in markdown preview natively handles clicks on relative `.md` links by opening the target file in preview mode. This gives "stay in preview" navigation for free.
- **Stale resolution** — if the index has not finished loading (during the brief window between activation and background `enterFullMode()` completion), links use fallback same-directory resolution. The next preview re-render (triggered by document changes or manual refresh) picks up the fully-resolved paths.

---

## Todo toggle

The todo toggle feature cycles a markdown line through three states: plain text → unchecked todo → done todo → plain text. It requires full mode (`.asnotes/` directory present) because the toggle command is registered inside `enterFullMode()` to integrate with the task panel and index.

### TodoToggleService

`TodoToggleService` (`src/TodoToggleService.ts`) is a pure-logic module with no VS Code dependencies. It exports a single function:

```typescript
toggleTodoLine(lineText: string): string
```

The function uses regex matching to detect the current state and return the toggled line. Detection order matters — done todos are checked before unchecked todos to avoid the `[x]` pattern matching as a list item:

1. **Done todo** — `/^(\s*)([-*])\s+\[(?:x|X)\]\s?(.*)/` → strip bullet and checkbox, return `indent + rest`
2. **Unchecked todo** — `/^(\s*)([-*])\s+\[ \]\s?(.*)/` → replace `[ ]` with `[x]`
3. **List item** (bullet without checkbox) — `/^(\s*)([-*])\s+(.*)/` → insert `[ ] ` after the bullet
4. **Plain text** — everything else → prepend `- [ ] ` after leading whitespace

Leading whitespace (indentation) is captured and preserved in all cases. Both `-` and `*` bullets are supported. Both `[x]` and `[X]` are recognised as done.

### Command registration

The `as-notes.toggleTodo` command is registered inside `enterFullMode()` (behind the full-mode guard), so it only works when the workspace is initialised with `.asnotes/`. In passive mode, the keybinding is a no-op because the command does not exist. The command handler:

1. Gets the active text editor
2. Collects unique line numbers from all cursor positions (deduplicating lines that have multiple cursors)
3. Applies `toggleTodoLine()` to each line via `editor.edit()`

The keybinding defaults to `Ctrl+Shift+Enter` (Windows/Linux) / `Cmd+Shift+Enter` (macOS), scoped to `editorLangId == markdown`. It is user-configurable via VS Code's standard keybinding settings.

---

## Tasks panel

The Tasks panel is a TreeView in the Explorer sidebar that displays all todo items across the workspace, grouped by page. It requires full mode (`.asnotes/` directory) and is gated behind the `as-notes.fullMode` context key.

### Tasks table

`IndexService.indexFileContent()` parses tasks from file content alongside links and aliases. Two regex patterns detect task lines:

- **Unchecked:** `/^\s*[-*]\s+\[ \]\s+(.*)/` — matches `- [ ] task text` and `* [ ] task text`
- **Done:** `/^\s*[-*]\s+\[(?:x|X)\]\s+(.*)/` — matches `- [x] task text` and `* [X] task text`

Task rows are replaced atomically on each re-index (all tasks for the page are deleted, then new ones inserted). The `ON DELETE CASCADE` on `source_page_id` ensures tasks are cleaned up when a page is removed.

Query methods:

- `getTasksForPage(pageId, todoOnly?)` — returns tasks for a specific page, optionally filtered to unchecked only
- `getPagesWithTasks(todoOnly?)` — returns pages that have tasks, with task counts
- `getTaskCounts()` — returns total, done, and undone counts

### TaskPanelProvider

`TaskPanelProvider` (`src/TaskPanelProvider.ts`) implements `vscode.TreeDataProvider<TaskTreeItem>` with a discriminated union of two item types:

- **PageGroupItem** — collapsible parent node representing a page, showing the page title and task count in the description. Uses `vscode.ThemeIcon.File` icon.
- **TaskItem** — leaf node representing a single task. Uses `$(circle)` for unchecked and `$(pass)` for done tasks. Includes a `command` property that opens the file and scrolls to the task's line.

Key behaviour:

- `showTodoOnly` (default: `true`) — when enabled, only unchecked tasks and pages containing them are shown
- `toggleShowTodoOnly()` — flips the filter and fires `onDidChangeTreeData`
- `refresh()` — fires `onDidChangeTreeData` to trigger a UI rebuild from the index

The tree view is created via `vscode.window.createTreeView('as-notes-tasks', ...)` in `enterFullMode()` and is visible only when `as-notes.fullMode` is set.

### Inline task toggle

Each task item in the panel has an inline action button (`$(check)` icon) that toggles the task's done/todo state without stealing focus from the active editor. This is implemented via a `view/item/context` menu entry with `"group": "inline"`, scoped to `viewItem == taskItem`.

The `as-notes.toggleTaskFromPanel` command handler:

1. Receives the `TaskItem` as an argument (VS Code passes the tree item to inline action commands)
2. Opens the document silently via `vscode.workspace.openTextDocument()` — no editor is shown
3. Reads the line text at the stored line number and applies `toggleTodoLine()`
4. Applies the edit via `WorkspaceEdit` + `vscode.workspace.applyEdit()`
5. Saves the document via `doc.save()`

The existing `onDidSaveTextDocument` trigger handles re-indexing and panel refresh automatically. The user's active editor remains untouched — clicking the toggle button does not navigate to or reveal the file.

### Sync strategy

The task panel refreshes whenever the index changes. Rather than maintaining separate task-specific listeners, every existing index trigger (`onDidSaveTextDocument`, `onDidChangeTextDocument`, `onDidCreateFiles`, `onDidDeleteFiles`, `onDidRenameFiles`, `onDidChangeActiveTextEditor`, `rebuildIndex`, periodic scan) calls `taskPanelProvider?.refresh()` alongside `completionProvider?.refresh()`.

The `toggleTodoCommand` additionally re-indexes the current buffer after the edit completes (via `.then()` on `editor.edit()`), then refreshes the task panel. This ensures the panel reflects the toggle immediately without waiting for the next save or debounced update.

---

## Backlinks panel

The backlinks panel displays all incoming links to a target page — either the currently active markdown file or a specific wikilink chosen via right-click context menu. It uses a `WebviewPanel` in `ViewColumn.Beside` with rich HTML rendering. The panel presents a single unified **Backlinks** view where every backlink is shown as a **chain** — the full outline context path from root to the link itself. Standalone mentions (no outline nesting) appear as chains of length 1.

### BacklinkPanelProvider

`BacklinkPanelProvider` (`src/BacklinkPanelProvider.ts`) manages the webview panel lifecycle:

- **`show()`** — creates or reveals the panel for the currently active editor file. Resolves the active file's page in the index and displays its backlink chains. If the page is not in the index (e.g. newly created file), falls back to name-based lookup via `getBacklinkChainsByName()` — returning the same results as a forward reference. Shows a loading spinner while content loads.
- **`showForPage(pageId, pageTitle)`** — opens the panel locked to a specific page by its database ID. Used when the target page exists in the index (e.g. right-clicking a wikilink that resolves to a known page, including via alias resolution). Shows a loading spinner while content loads.
- **`showForName(pageName)`** — opens the panel locked to a page name without requiring a page to exist. Used for forward references (wikilinks to pages that haven't been created yet). Shows a loading spinner while content loads.
- **`update(uri)`** — called when the active editor changes. Re-renders backlinks for the given file unless the panel is locked to a specific page/name.
- **`refresh()`** — re-renders the current target's backlinks without a loading spinner. Called by all index update triggers. Preserves webview scroll position and collapsed group state across re-renders.
- **`dispose()`** — cleans up the panel and listeners.

### Chain-first grouping

All backlinks are grouped by their **chain pattern** — the abstract sequence of page names from root to the target link. For example, `[[Project]] → [[Tasks]] → [[NGINX]]` is a different pattern from `[[NGINX]]` alone.

Grouping logic:
1. Query all links pointing to the target page's filename(s) — including alias filenames
2. For each link, build the full chain via `buildChainForLink()` (walk `outline_parent_link_id` upward, then reverse)
3. Compute a **pattern key**: the lowercased, `→`-joined sequence of page names (case-insensitive grouping)
4. Group chain instances by pattern key
5. Sort groups: length-1 chains first, then longer chains alphabetically by pattern key
6. Within each group, instances are sorted alphabetically by source page title

### Data flow

1. **Active file mode**: resolves workspace-relative path → `getPageByPath()` → `getBacklinkChains(pageId)`
2. **Locked page mode**: uses stored `lockedPageId` → `getBacklinkChains(pageId)`
3. **Forward ref mode**: uses stored `lockedPageName` → `getBacklinkChainsByName(pageName)`

Both `getBacklinkChains()` and `getBacklinkChainsByName()` call the private `buildBacklinkChainGroups(targetFilenames)` method which:
- Queries `SELECT l.id, l.source_page_id, p.* FROM links l JOIN pages p ON l.source_page_id = p.id WHERE LOWER(l.page_filename) IN (...)` with case-insensitive filename matching
- Builds chain for each link via `buildChainForLink(linkId)`
- Groups by lowercased pattern key into `BacklinkChainGroup[]`

### Context menu — View Backlinks

The `as-notes.viewBacklinks` command (registered in `extension.ts`) enables right-clicking any wikilink in the editor to open backlinks for that specific page:

1. Extracts all wikilinks from the active editor's document text
2. Finds the innermost wikilink at the cursor position via `WikilinkService.findInnermostWikilinkAtOffset()`
3. Looks up the page via `IndexService.findPagesByFilename(filename)` (handles alias resolution)
4. If found: calls `showForPage(pageId, pageTitle)`
5. If not found (forward reference): calls `showForName(pageName)`

The command appears in the `editor/context` menu when `as-notes.fullMode` is active and the editor language is markdown.

### Context menu — Navigate to Page

The `as-notes.navigateToPage` command (registered in `extension.ts`) enables right-clicking any wikilink in the editor to navigate directly to the target page:

1. Extracts all wikilinks from the current line
2. Finds the innermost wikilink at the cursor position via `WikilinkService.findInnermostWikilinkAtOffset()`
3. Resolves the target URI via `WikilinkFileService.resolveTargetUri()`
4. Calls `WikilinkFileService.navigateToFile()` — which uses index-aware resolution (global filename match, alias support, case-insensitive fallback) and auto-creates the file if it doesn't exist

This provides the same navigation as Ctrl+click (DocumentLink) but via an explicit context menu entry. The command appears in the `editor/context` menu alongside "View Backlinks" when `as-notes.fullMode` is active and the editor language is markdown.

### Types

```typescript
interface BacklinkChainLink {
    linkId: number;
    pageName: string;
    pageFilename: string;
    line: number;
    startCol: number;
    endCol: number;
    context: string | null;
}

interface BacklinkChainInstance {
    chain: BacklinkChainLink[];
    sourcePage: PageRow;
}

interface BacklinkChainGroup {
    patternKey: string;           // lowercased page names joined by ' → '
    displayPattern: string[];     // original-cased page names for display
    instances: BacklinkChainInstance[];
}
```

The `BacklinkEntry` interface and `getBacklinksIncludingAliases()` method are retained for use by `WikilinkHoverProvider`.

### Chain building

**`buildChainForLink(linkId)`** (public method on `IndexService`) walks the `outline_parent_link_id` chain from a given link upward to the root, collecting `BacklinkChainLink` entries (including `context` — the surrounding ±1 lines of text) for each step, then reverses for root-to-leaf order. A standalone mention (no `outline_parent_link_id`) produces a chain of length 1.

### Message protocol

The webview communicates with the extension via `postMessage`:

- **`navigate`** — sent when the user clicks a chain link or source page header. Payload: `{ command: 'navigate', pagePath: string, line: number }`. The provider opens the file in `ViewColumn.One` and scrolls to the line.
- **`toggleGroupMode`** — sent when the user clicks the view mode toggle button. Payload: `{ command: 'toggleGroupMode', groupByChain: boolean }`. The provider stores the new mode and re-renders without a loading spinner.
- **`toggleContextWrap`** — sent when the user clicks the context verbosity toggle. Payload: `{ command: 'toggleContextWrap', wrapContext: boolean }`. The provider stores the mode and re-renders without a loading spinner.

### View modes

The backlinks panel supports two view modes, toggled via a button in the page header:

- **Flat by page** (default, `groupByChain: false`): All backlink instances from all chain groups are flattened and grouped by source page. Pages are sorted in two tiers: journal-format filenames (`YYYY_MM_DD`) appear first in **reverse chronological order** (latest date at top), followed by non-journal pages in standard case-insensitive alphabetical order. Instances within each page are listed under a shared page header (rendered once). This mode gives a timeline-first view — the most recent journal entries are always at the top.
- **Grouped by chain** (`groupByChain: true`): The current chain-first grouping with collapsible headers showing the pattern. Instances within each group are sorted by source page title.

Both toggles are rendered as **segmented pill controls** with two segments each (e.g. `[Flat | Grouped]`). The active segment is highlighted with `--vscode-textLink-foreground` background and white text; the inactive segment is clickable. This makes the current state and available action immediately clear. Codicon-based icons were removed because the webview's bundled codicon font does not reliably include newer glyphs. The mode is persisted in webview state via `vscode.setState()` alongside scroll position and collapsed groups.

The default mode is configured via the `as-notes.backlinkGroupByChain` setting (boolean, default `false`). The setting provides the initial default when the panel first opens. Once the user toggles via the UI button, the extension-side `groupByChain` property overrides the setting for that session.

### Context verbosity

The backlinks panel supports two context display modes, toggled via a text button ("Compact" / "Wrap") in the page header:

- **Compact** (default, `wrapContext: false`): `white-space: pre; overflow: hidden; text-overflow: ellipsis;` — single-line truncated context with ellipsis for overflow.
- **Wrap** (`wrapContext: true`): `white-space: pre-wrap; word-break: break-word;` — full context visible, text wraps naturally.

The default is configured via `as-notes.backlinkWrapContext` (boolean, default `false`). The mode is persisted in webview state alongside the other toggle states.

### Rendering

Each chain group renders as a collapsible section with:
- **Header**: the chain pattern displayed as clickable page name links separated by `→` arrows, with an instance count badge
- **Instances**: each instance shows the source page title followed by the chain with per-link line numbers (e.g. `[L12]`), each clickable for navigation
- **Context block**: below each chain instance, a multi-line context snippet (±1 surrounding lines) of the last link (the target link) is displayed in a blockquote-styled `<pre>` block. Common leading whitespace is stripped so that outliner-indented content doesn't waste horizontal space (relative indentation is preserved). The wikilink text on the relevant line is highlighted using `--vscode-textLink-foreground`. The blockquote uses `--vscode-textBlockQuote-border` for the left border and `--vscode-textBlockQuote-background` for the background fill. Context text uses `--vscode-descriptionForeground` for a muted secondary appearance.

Chain link names in instance rows use `font-weight: 600` for emphasis. The instance chain bar matches the editor font family and size.

The HTML uses VS Code CSS variables for automatic light/dark theme support. Chain arrows use dimmed description foreground. Clickable elements have hover states.

### State preservation

The webview preserves scroll position and collapsed group state across re-renders using the VS Code webview state API (`vscode.setState()` / `vscode.getState()`):

- **Collapsed groups**: each call to `toggleGroup()` saves the list of collapsed group element IDs to state. On page load, the script reads state and re-applies the `collapsed` class and chevron direction to matching groups.
- **Scroll position**: a debounced `scroll` event listener (100ms) saves `document.documentElement.scrollTop` to state. On page load, the script calls `window.scrollTo()` with the saved value.
- **View mode**: the `groupByChain` boolean is stored in webview state. On toggle, the mode is saved before the `toggleGroupMode` message is posted to the extension.
- **Context verbosity**: the `wrapContext` boolean is stored in webview state. On toggle, the mode is saved before the `toggleContextWrap` message is posted to the extension.

This is critical because `refresh()` replaces `webview.html` on every index update — navigation clicks trigger `onDidChangeActiveTextEditor` which re-indexes and refreshes the panel. Without state preservation, the user loses their scroll position every time they click a backlink.

The loading spinner (`renderLoading()`) is only shown on initial panel opens (`show()`, `showForName()`, `showForPage()`), not on background refreshes. This avoids a visible flash when index events trigger a re-render.

### Sync strategy

The backlink panel follows the same sync pattern as the task panel and completion provider. All index update triggers (`onDidSaveTextDocument`, `onDidChangeTextDocument`, `onDidCreateFiles`, `onDidDeleteFiles`, `onDidRenameFiles`, `onDidChangeActiveTextEditor`, `rebuildIndex`, periodic scan) call `backlinkPanelProvider?.refresh()`. Additionally, `onDidChangeActiveTextEditor` calls `backlinkPanelProvider?.update(uri)` to show backlinks for the newly active file (unless the panel is locked to a specific target).

---

## Daily journal

The daily journal provides a shortcut to create or open a dated markdown file. One file per day, stored in a configurable folder.

### JournalService

`src/JournalService.ts` is a pure-logic module with no VS Code imports, fully testable:

- **`formatJournalFilename(date)`** — returns `YYYY_MM_DD.md` (underscores for filesystem compatibility)
- **`formatJournalDate(date)`** — returns `YYYY-MM-DD` (hyphens for display in content)
- **`applyTemplate(templateContent, date)`** — replaces all literal `YYYY-MM-DD` occurrences in the template string with the formatted date
- **`normaliseJournalFolder(folder)`** — strips leading/trailing slashes and whitespace; returns empty string for blank input (meaning workspace root)
- **`computeJournalPaths(workspaceRoot, journalFolder, date)`** — returns `{ journalFilePath, templateFilePath, journalFolderPath }` with fully resolved paths
- **`DEFAULT_TEMPLATE`** — the constant `# YYYY-MM-DD\n`, used when no template file exists
- **`TEMPLATE_FILENAME`** — the constant `journal_template.md`

### Command flow

The `as-notes.openDailyJournal` command is registered in `enterFullMode()` (requires full mode). The flow:

1. Read the `as-notes.journalFolder` setting (default: `"journals"`)
2. Compute paths via `computeJournalPaths()` using today's date
3. **If the journal file exists** — open it in the editor and return
4. **If the journal file does not exist:**
   a. Create the journal folder via `workspace.fs.createDirectory()` (no-op if it exists)
   b. Check for `journal_template.md` — if missing, create it with `DEFAULT_TEMPLATE`
   c. Read the template, apply date substitution via `applyTemplate()`
   d. Write the new journal file
   e. Index the file immediately (`indexScanner.indexFile()` + `safeSaveToFile()`) and refresh all providers (completion, tasks, backlinks)
   f. Update the status bar page count
   g. Open the new file in the editor

Keybinding: `Ctrl+Alt+J` / `Cmd+Alt+J`, scoped to `as-notes.fullMode`.

### Template system

The template file (`journal_template.md`) lives inside the journal folder. It is a regular markdown file that the user can freely edit to add sections, prompts, front matter, or any other content.

The only special token is the literal string `YYYY-MM-DD` — every occurrence is replaced with the actual date when a new journal file is created. The filename uses underscores (`YYYY_MM_DD.md`) but the content date uses hyphens (`YYYY-MM-DD`).

The template file is indexed like any other markdown file. If the user deletes it, it is silently recreated with the default content on the next journal creation.

---

## Pro licence

The Pro Licence system gates premium features behind a validated licence key. The design is split into two components and a small amount of wiring in `extension.ts`.

### LicenceService

`src/LicenceService.ts` — pure logic, no VS Code imports, fully unit-testable.

```
export type LicenceStatus = 'valid' | 'invalid' | 'not-entered';

validateLicenceKey(key: string): LicenceStatus
isValidStatus(status: LicenceStatus): boolean
```

**Current validation rule (temporary):** a key is `valid` if it is exactly 24 ASCII characters containing exactly 12 lowercase and 12 uppercase letters. No digits, spaces, or symbols. This placeholder rule will be replaced with real cryptographic verification when the activation server is available — all call sites remain unchanged.

### LicenceActivationService

`src/LicenceActivationService.ts` — VS Code-dependent, owns `SecretStorage` interaction.

**Agreed architecture (Option A):**

1. User enters licence key in settings.
2. Extension calls the activation server **once** → server records the activation and returns a signed token (Ed25519/HMAC).
3. Signed token is stored in VS Code's `SecretStorage` (OS keychain, encrypted at rest, not synced).
4. On every subsequent startup the token signature is verified locally against the baked-in public key — **no further network calls**.

**Current state (stub — server not yet built):**

```
activateWithServer(key: string, context: vscode.ExtensionContext): Promise<LicenceStatus>
```

The stub:
- Validates the key format locally (no network call)
- On success, writes a stub token (`stub:<base64(key)>`) to `context.secrets` under the key `as-notes.activationToken`
- On subsequent startups, checks the stored token before re-validating locally

Three internal helpers are clearly marked for replacement:
- `_callServer(key)` — replace with the real HTTP call
- `_buildToken(key)` — replace with storage of the server-returned signed token
- `_verifyToken(token, key)` — replace with Ed25519/HMAC signature verification against the baked-in public key

### Pro gate pattern

A single exported function in `extension.ts` is the only place pro status is checked:

```typescript
export function isProLicenced(): boolean
```

All pro-gated features call `isProLicenced()` directly. When real server verification arrives, only `LicenceActivationService` and `LicenceService` change — call sites are unaffected.

### Settings

`as-notes.licenceKey` — scope `machine` (not synced across devices, appropriate for paid licences). Read on activation and re-validated on every `onDidChangeConfiguration` event. An invalid (wrong format) key triggers an immediate `showWarningMessage`.

**Status bar:** Full mode with valid licence shows `AS Notes (Pro) — N pages`; without licence shows `AS Notes — N pages`.

---

## Encryption (Pro)

Encryption is a Pro-gated feature allowing users to store sensitive notes in `.enc.md` files. These files use AES-256-GCM symmetric encryption with a passphrase-derived key stored in VS Code's `SecretStorage` (OS keychain).

### File format

An encrypted `.enc.md` file contains exactly **one line**:

```
ASNOTES_ENC_V1:<base64url(12-byte-nonce + ciphertext + 16-byte-authTag)>
```

- **Marker prefix** `ASNOTES_ENC_V1:` makes encrypted status detectable without the key (used by the git hook).
- **Nonce** (12 bytes, random) is unique per encryption call — the same plaintext encrypted twice produces different ciphertext.
- **Auth tag** (16 bytes) provides GCM authenticated encryption; any tampering causes decryption to fail.
- **No filename extension change on encryption** — the file is always `.enc.md`, whether plaintext or ciphertext. The marker prefix is the canonical encrypted indicator.

### Key derivation

Passphrase → PBKDF2-SHA256 (100,000 iterations, fixed salt `asnotes-enc-v1`) → 32-byte AES-256 key.

The **fixed salt** is intentional: it produces a deterministic key from the same passphrase on any machine, so the user does not need to store the derived key — only the passphrase (in SecretStorage).

For bulk encrypt/decrypt operations, `deriveKey()` is called once per command invocation and the resulting `Buffer` is passed to each `encrypt()` / `decrypt()` call via the optional `precomputedKey` parameter, avoiding 100,000 PBKDF2 iterations per file.

SecretStorage key: `as-notes.encryptionKey`.

### EncryptionService

`src/EncryptionService.ts` — pure module, no VS Code imports, fully unit-testable.

```typescript
export const ENCRYPTION_MARKER = 'ASNOTES_ENC_V1:';

isEligibleFile(filePath: string): boolean           // true if path ends with .enc.md
isEncrypted(content: string): boolean              // true if content starts with marker
deriveKey(passphrase: string): Buffer              // PBKDF2-SHA256 → 32-byte key
encrypt(plaintext, passphrase, precomputedKey?): string
decrypt(encryptedContent, passphrase, precomputedKey?): string
```

`encrypt()` throws nothing — returns a single-line encrypted string.  
`decrypt()` throws descriptive errors on: wrong passphrase (GCM auth failure), tampered ciphertext, malformed base64, non-encrypted input, or payload too short (< 28 bytes).

### GitHookService

`src/GitHookService.ts` — pure module using Node `fs`, no VS Code imports.

Installs a POSIX shell script block in `.git/hooks/pre-commit` that prevents committing an unencrypted `.enc.md` file (i.e. one that does NOT start with `ASNOTES_ENC_V1:`).

```typescript
export const HOOK_PATH_RELATIVE = path.join('.git', 'hooks', 'pre-commit');
export const HOOK_START_MARKER = '# asnotes-enc-check-start';
export const HOOK_END_MARKER   = '# asnotes-enc-check-end';
export type HookResult = 'no-git' | 'created' | 'appended' | 'exists' | 'updated';

buildHookBlock(): string                          // returns the shell script block
ensurePreCommitHook(workspaceRoot: string): HookResult
```

`ensurePreCommitHook()` is **idempotent** and **self-healing**:
- `no-git` — `.git/hooks/` directory does not exist (not a git repo)
- `created` — no pre-commit hook existed; created with `#!/bin/sh` + block
- `appended` — hook existed but lacked the marker; block appended
- `exists` — marker already present and block is current; no changes
- `updated` — marker present but block was stale (old version); block replaced in-place, surrounding content preserved

`buildHookBlock()` uses `while IFS= read -r f; do ... done <<ASNOTES_EOF` (heredoc fed from `$enc_files`) instead of `for f in $enc_files` to correctly handle filenames containing spaces.

The hook file is made executable via `fs.chmodSync(hookPath, 0o755)` (wrapped in try/catch — no-op on Windows without Git Bash, but the hook still runs in Git Bash environments).

`ensurePreCommitHook()` is called in three places in `extension.ts`:
1. `initWorkspace()` — after creating `.asnotes/`
2. `rebuildIndex()` — at the start of the rebuild
3. `startPeriodicScan()` setInterval callback — each periodic scan tick

### Index exclusion

Two classes of files are excluded from the index:

**1. `.enc.md` files (encrypted notes)**

`.enc.md` files end in `.md`, so they match the `**/*.{md,markdown}` glob used by `IndexScanner`. They are explicitly excluded at three points:

1. **`IndexScanner.indexFile(uri)`** — early return if `uri.fsPath.toLowerCase().endsWith('.enc.md')`
2. **`IndexScanner.fullScan()`** — post-filter on `findFiles()` result
3. **`IndexScanner.staleScan()`** — post-filter on `findFiles()` result

In `extension.ts`, all index update triggers (`onDidSaveTextDocument`, `onDidChangeTextDocument`, `onDidCreateFiles`, etc.) use `isMarkdown(doc)` / `isMarkdownUri(uri)`, both of which have been updated to return `false` for `.enc.md` URIs.

A private `isEncryptedFileUri(uri)` helper centralises the `.enc.md` check within `extension.ts`.

**2. `.asnotesignore` patterns (user exclusions)**

See [IgnoreService and .asnotesignore](#ignoreservice-and-asnotesignore) in the Persistent index section.

### Encryption commands

All eight commands are registered in `enterFullMode()` and pro-gated via `isProLicenced()`.

| Command | Action |
|---|---|
| `as-notes.setEncryptionKey` | `showInputBox(password:true)` → `context.secrets.store('as-notes.encryptionKey', ...)` |
| `as-notes.clearEncryptionKey` | `context.secrets.delete('as-notes.encryptionKey')` |
| `as-notes.encryptNotes` | `findFiles('**/*.enc.md')` → derive key once → for each file, find open doc via `textDocuments.find(d => d.uri.fsPath === fileUri.fsPath)`, read from editor buffer if open else disk → encrypt → if open doc: `WorkspaceEdit` replace + `save()`, else `workspace.fs.writeFile` |
| `as-notes.decryptNotes` | `findFiles('**/*.enc.md')` → derive key once → always read encrypted content from disk → decrypt → if open doc (matched via `fsPath`): `WorkspaceEdit` replace + `save()`, else `workspace.fs.writeFile` |
| `as-notes.createEncryptedFile` | `showInputBox` for title → `sanitiseFileName(title).enc.md` → open/create in workspace root |
| `as-notes.createEncryptedJournalNote` | `computeJournalPaths()` → replace `.md` suffix with `.enc.md` → open/create in journal folder |
| `as-notes.encryptCurrentNote` | Active editor buffer → encrypt → `WorkspaceEdit` replace full range + save. Error if not `.enc.md` or no active editor. |
| `as-notes.decryptCurrentNote` | Read from disk via `workspace.fs.readFile` → decrypt → `WorkspaceEdit` replace full range + save. Error if not `.enc.md` or no active editor. |

---

## File drop & paste

AS Notes delegates file drop and paste to VS Code's **built-in** markdown editor. Rather than registering custom `DocumentDropEditProvider` / `DocumentPasteEditProvider` providers, the extension programmatically configures the built-in `markdown.copyFiles.destination` workspace setting so dropped/pasted files land in the user's preferred asset folder.

### Workspace configuration

`applyAssetPathSettings()` in `src/ImageDropProvider.ts` reads `as-notes.assetPath` (default `assets/images`) and writes:

```json
"markdown.copyFiles.destination": {
    "**/*.md": "assets/images/${fileName}"
}
```

to `.vscode/settings.json` at workspace scope. `${fileName}` is a built-in VS Code variable that resolves to the original filename of the dropped/pasted file.

| Setting | Default | Description |
|---|---|---|
| `as-notes.assetPath` | `assets/images` | Workspace-relative folder where dropped/pasted files are saved |

**Trigger points** (all in `extension.ts`):
1. `enterFullMode()` — on activation when `.asnotes/` is found
2. `initWorkspace` command — when user initialises a new workspace
3. `rebuildIndex` command — re-applies in case settings were modified externally
4. `onDidChangeConfiguration` — when `as-notes.assetPath` changes

### Legacy cleanup

`applyAssetPathSettings()` also removes workspace-scoped overrides that may have been written by earlier versions of the extension:

- `markdown.editor.drop.enabled`
- `markdown.editor.filePaste.enabled`
- `markdown.editor.drop.copyIntoWorkspace`
- `markdown.editor.filePaste.copyIntoWorkspace`

These are cleaned up once (only if a workspace-level value exists) so users upgrading from earlier versions are not left with stale settings.

---

## Filename sanitisation

The regex `/ ? < > \ : * | "` is applied to `pageName` to produce `pageFileName`. The replacement character is `_`.

This is implemented in two places:

- `Wikilink.pageFileName` (getter on the model)
- `sanitiseFileName()` in `WikilinkRenameTracker.ts` (standalone function for rename logic that operates on raw strings rather than `Wikilink` instances)

Both use the same regex pattern. If the sanitisation rules change, both must be updated.

---

## Extension activation and wiring

`extension.ts` is the entry point. On activation (`onLanguage:markdown`):

1. Creates a status bar item (always visible in both modes)
2. Registers global commands: `as-notes.initWorkspace`, `as-notes.rebuildIndex`
3. Checks for `.asnotes/` directory in workspace root
4. **Full mode** (`.asnotes/` found): calls `enterFullMode()` which:
   - Sets the `as-notes.fullMode` context key (controls view/keybinding `when` clauses)
   - Opens the SQLite database
   - Creates `WikilinkDecorationManager` **before** the scan (wikilinks appear muted grey immediately)
   - Shows status bar spinner `$(sync~spin) AS Notes: Indexing...`
   - Runs a stale scan (or full rebuild on schema reset) to catch external changes
   - Calls `decorationManager.setReady()` — wikilinks shift from grey to blue
   - Creates shared `WikilinkFileService`, `IndexService`, `IndexScanner`
   - Registers all providers: `WikilinkDocumentLinkProvider`, `WikilinkHoverProvider`, `WikilinkRenameTracker`, `TaskPanelProvider`, `BacklinkPanelProvider`
   - Registers the `as-notes.navigateWikilink`, `as-notes.toggleTodo`, `as-notes.toggleTaskPanel`, `as-notes.toggleShowTodoOnly`, `as-notes.navigateToTask`, `as-notes.showBacklinks`, `as-notes.openDailyJournal`, and all eight encryption commands
   - Sets up index update triggers (save, file events, editor switch)
   - Starts the periodic scanner
5. **Passive mode** (no `.asnotes/`): status bar only, no providers, context key cleared

All full-mode registrations are tracked in `fullModeDisposables[]` and pushed to `context.subscriptions`. The `deactivate()` function persists the database and cleans up.

Additionally, `extension.ts` registers the `as-notes.completionAccepted` command, which the completion provider's items use to clear the rename tracker's `pendingEdit` after a completion is applied (see [Completion and rename tracking interaction](#completion-and-rename-tracking-interaction)).

The markdown document selector is `{ language: 'markdown' }`, which VS Code maps to `.md` and `.markdown` files (configured in `package.json` under `contributes.languages`).

---

## Testing

Tests use vitest and are split across eight test files:

### `WikilinkService.test.ts` (23 tests)

1. **Parser extraction** (11 test cases) — basic links, nested links, special characters, unbalanced brackets, interrupting characters. Each test verifies `linkText`, `pageName`, and `pageFileName` arrays.

2. **Innermost offset lookup** (6 tests) — simple links, outside-link offsets, nested links at each nesting level, deeply nested structures.

3. **Segment computation** (6 tests) — empty input, single links, 2-level nesting, 3-level nesting, sibling links, deeply nested structures with multiple children.

### `FrontMatterService.test.ts` (26 tests)

1. **`extractFrontMatter`** (7 tests) — valid front matter extraction, no front matter, no closing fence, content before fence, multiple fence blocks, empty front matter, whitespace handling.

2. **`parseAliases`** (11 tests) — list-style aliases, inline array, single inline value, no front matter, no `aliases:` field, empty aliases list, empty inline array, accidental `[[brackets]]` stripping, mixed formats, quoted values.

3. **`updateAlias`** (8 tests) — list format replacement, inline array replacement, single value replacement, alias not found, no front matter, no aliases field, preserves other front matter fields, handles missing closing fence.

### `IndexService.test.ts` (120 tests)

1. **Title extraction** (8 tests) — heading parsing, fallback to filename stem, various extensions, whitespace trimming.

2. **Schema** (2 tests) — table creation verification (including tasks table), `isOpen` state.

3. **Schema versioning** (5 tests) — new DB gets `user_version` stamped; existing up-to-date DB returns `schemaReset: false`; existing DB with version 0 (pre-versioning) returns `schemaReset: true` and stamps new version; after reset tables exist and data is wiped; post-reset DB is fully functional for indexing.

4. **Page CRUD** (6 tests) — insert, upsert, query, delete, cascade.

5. **Link CRUD** (8 tests) — insert, replace, backlinks, backlink count, nesting with parent_link_id and depth, rename updates, page path updates.

6. **Reset schema** (1 test) — drop and recreate.

7. **`indexFileContent`** (9 tests) — simple file, nested links, 3-level nesting, multi-line, title fallback, re-index, backlinks, empty file, filename sanitisation.

8. **Rename support** (6 tests) — link state for positional comparison, rename detection simulation, `updateRename()` for link references, `updatePagePath()` for page records, nested link rename detection, full rename flow.

9. **Aliases** (15 tests) — alias storage from front matter, re-indexing replaces aliases, no-front-matter edge case, `resolveAlias()` success and failure, case-insensitive resolution, `resolvePageByFilename()` direct vs alias match, backlink count including aliases, `updateAliasRename()` for alias record and link references, `findPagesByFilename()` for subfolder resolution, cascade delete on page removal, filename sanitisation, `getPageById()`, `getAllAliases()` with canonical page info, empty aliases.

10. **Forward referenced pages** (7 tests) — unresolved links, resolved links excluded, ghost page detection, multi-file scenarios, alias exclusion.

11. **Indent level computation** (4 tests) — zero indent, spaces, tabs, mixed.

12. **Indent level indexing** (4 tests) — zero indent stored, indented links stored, mixed indents, tab indented.

13. **Outline parent computation** (14 tests) — basic nesting, siblings, multi-level, same-line peers, nested wikilinks, cross-line inheritance, deep hierarchies.

14. **Unified backlink chains / `getBacklinkChains`** (15 tests) — standalone mention (chain length 1), chain with outline context, pattern grouping across files, separate groups for different patterns, length-1-first sorting, alias resolution, empty/non-existent page, line numbers, context line text in chain links, alphabetical instance sorting, case-insensitive pattern grouping, alias in outline context, multiple backlinks from same page, real-world outliner scenario.

15. **Forward reference chains / `getBacklinkChainsByName`** (3 tests) — forward reference with no page file, empty for unreferenced name, chain with outline context for forward reference.

16. **Task indexing** (11 tests) — unchecked and done task indexing, re-index replacement, todoOnly filter, pages with tasks grouped by count, task counts, cascade delete on page removal, indented tasks, `*` bullet tasks, non-todo exclusion, empty tasks, `line_text` storage.

17. **`getBacklinksIncludingAliases`** (7 tests) — direct backlinks, alias backlinks, self-link exclusion, empty result, line/column data, ordering by title then line.

### `WikilinkFileService.test.ts` (10 tests)

1. **Path distance** (10 tests) — same directory (0), nested subdirectory (1), sibling directories (2), root to deep (3), deep to root (3), divergent paths, case-insensitive comparison, deeply nested to root, same prefix different branch, single segment root.

### `WikilinkCompletionProvider.test.ts` (30 tests)

1. **Bracket detection** (11 tests) — no brackets, simple `[[`, after text, with text typed, already closed, nested innermost detection, inner closed leaving outer open, all brackets closed, multiple unclosed, partially closed, single `[`.

2. **Close-bracket detection** (9 tests) — no `]]`, `]]` at start, `]]` with text before, `]]` with text after, nested `[[...]]` skipped to find outer `]]`, only nested pairs (no outer close), immediate `]]` after nested pair, deeply nested brackets, `]]` with trailing wikilinks.

3. **Front matter detection** (6 tests) — no front matter, inside front matter, after front matter, unclosed front matter, empty document, first line not `---`.

4. **Completion item building** (4 tests) — page items with stem labels, alias items with canonical info, sort order (pages before aliases), duplicate filename disambiguation.

Tests that depend on VS Code APIs (decorations, document links, hover, rename tracker event handling) are not unit-tested — they require the extension host and are verified via F5 manual testing.

### `TodoToggleService.test.ts` (17 tests)

1. **Plain text → unchecked** (4 tests) — plain text, indented text, empty line, whitespace-only line.

2. **Unchecked → done** (3 tests) — basic, indented, `*` bullet.

3. **Done → plain** (4 tests) — basic, uppercase `X`, indented, `*` bullet.

4. **List items** (3 tests) — `-` list item gains checkbox, `*` list item gains checkbox, indented list item.

5. **Full cycle** (3 tests) — plain → unchecked → done → plain, same with existing list item, same with indentation.

### `JournalService.test.ts` (22 tests)

1. **Date formatting** (5 tests) — `formatJournalFilename()` produces `YYYY_MM_DD.md` with zero-padding; `formatJournalDate()` produces `YYYY-MM-DD` with zero-padding.

2. **Template substitution** (4 tests) — single placeholder, multiple placeholders, no placeholder (unchanged), default template.

3. **Folder normalisation** (7 tests) — clean input, leading slashes, trailing slashes, both, backslashes, blank, whitespace-only, nested paths.

4. **Path construction** (4 tests) — default folder, custom folder, empty folder (workspace root), folder with extra slashes.

### `EncryptionService.test.ts` (27 tests)

1. **`isEligibleFile`** (8 tests) — `.enc.md` extensions (case variants), plain `.md`, other extensions, directory paths, compound extensions.

2. **`isEncrypted`** (5 tests) — starts with marker, no marker, partial marker, empty string, whitespace prefix.

3. **`deriveKey`** (4 tests) — returns 32-byte Buffer, deterministic (same passphrase → same key), different passphrases produce different keys, empty passphrase produces a valid key.

4. **`encrypt` / `decrypt`** (10 tests) — roundtrip recovery, empty string roundtrip, unicode/multi-line content, single-line output, marker prefix, random nonce (two encryptions differ), wrong passphrase throws, non-encrypted input throws, tampered ciphertext throws, malformed base64 payload throws.

### `GitHookService.test.ts` (20 tests)

All tests use real `fs` in an `os.tmpdir()` temp directory, cleaned up in `afterEach`.

1. **`buildHookBlock`** (6 tests) — starts with HOOK_START_MARKER, ends with HOOK_END_MARKER, contains `\.enc\.md` pattern, contains `ASNOTES_ENC_V1:`, contains `exit 1`, idempotent.

2. **No git directory** (2 tests) — returns `'no-git'`, creates no files.

3. **No existing hook** (6 tests) — returns `'created'`, file exists, starts with `#!/bin/sh`, contains start marker, contains end marker, contains encryption marker.

4. **Existing hook without marker** (4 tests) — returns `'appended'`, preserves original content, contains start marker, end marker appears after original content.

5. **Existing hook with marker** (3 tests) — returns `'exists'`, file unchanged, idempotent on repeated calls.

---

## Known limitations and future considerations

1. **Rename detection by position** — the `(line, start_col)` key works when edits happen inside a wikilink. Edits that shift the wikilink's position (e.g. inserting text before it on the same line) are not detected as renames. This is correct behaviour but worth noting.

2. **Large workspaces** — `updateLinksInWorkspace()` opens every `.md`/`.markdown` file in the workspace. For very large note collections, this could be slow. A `workspace.findTextInFiles` pre-filter could reduce the set of files to open. The index could also be used to narrow the search to files that actually contain the old link.

3. **Concurrent edits** — the rename tracker processes one document at a time. Edits to other documents while a rename dialog is shown are handled by the index refresh in `refreshIndexAfterRename()`.

4. **Sanitisation consolidation** — `sanitiseFileName()` is now shared via `PathUtils.ts`. The `Wikilink.ts` model still has its own inline sanitisation; a future cleanup could unify these.

5. **Segment computation performance** — the character-by-character scan is O(n × m). For lines with many wikilinks, a sorted-endpoint sweep-line approach would be O(n log n). This has not been necessary in practice.

6. ~~**Backlink panel**~~ — implemented. See [Backlinks panel](#backlinks-panel).

7. **Tags** — `#tag` syntax support with index-backed queries is planned for a future iteration.
