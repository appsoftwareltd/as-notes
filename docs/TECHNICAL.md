# Technical Design — as-notes

This document explains the internal architecture, algorithms, and design decisions behind the as-notes VS Code extension. It is aimed at developers and AI agents who need to understand, maintain, or extend the codebase.

## Table of contents

- [Overview](#overview)
- [Persistent index](#persistent-index)
  - [Architecture split: IndexService and IndexScanner](#architecture-split-indexservice-and-indexscanner)
  - [Database schema](#database-schema)
  - [Content indexing and nesting](#content-indexing-and-nesting)
  - [Staleness detection](#staleness-detection)
  - [Persistence strategy](#persistence-strategy)
- [Activation model](#activation-model)
  - [Passive mode](#passive-mode)
  - [Full mode](#full-mode)
  - [Index update triggers](#index-update-triggers)
  - [Periodic scanning](#periodic-scanning)
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
- [Filename sanitisation](#filename-sanitisation)
- [Extension activation and wiring](#extension-activation-and-wiring)
- [Testing](#testing)
- [Known limitations and future considerations](#known-limitations-and-future-considerations)

---

## Overview

as-notes is a VS Code extension that turns `[[double bracket]]` text in markdown files into navigable links. Each wikilink maps to a `.md` file in the same directory. The extension provides highlighting, click navigation, hover tooltips, auto-creation of missing pages, and automated rename synchronisation between link text and filenames.

The extension is built with:

- **TypeScript 5.7**, strict mode, ES2022 target
- **esbuild** for bundling via custom `build.mjs` (`src/extension.ts` → `dist/extension.js`, CJS format, `vscode` external)
- **sql.js ^1.14.0** — WASM SQLite for the persistent index (zero native dependencies, works in VS Code remote/Codespaces)
- **vitest 3.x** for unit tests (145 tests across 5 test files)
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

### Database schema

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
    context TEXT,                   -- full line text for display
    parent_link_id INTEGER REFERENCES links(id),  -- nesting parent
    depth INTEGER NOT NULL DEFAULT 0               -- nesting depth (0 = top-level)
);

CREATE TABLE aliases (
    id INTEGER PRIMARY KEY,
    canonical_page_id INTEGER NOT NULL REFERENCES pages(id),
    alias_name TEXT NOT NULL,
    alias_filename TEXT NOT NULL
);
```

Key indexes: `idx_links_source`, `idx_links_page_filename`, `idx_links_page_name`, `idx_pages_path`, `idx_aliases_alias_name`, `idx_aliases_canonical`.

### Content indexing and nesting

`IndexService.indexFileContent()` performs the full indexing pipeline for a single file:

1. **Title extraction** — `extractTitle()` scans for the first `# heading`. Falls back to the filename stem (e.g. `Notes.md` → `Notes`).

2. **Page upsert** — `upsertPage()` uses an UPDATE-first-then-INSERT pattern to avoid UPSERT syntax differences.

3. **Link parsing** — `setLinksForPageWithNesting()` parses all lines with `WikilinkService.extractWikilinks()` and inserts links in two passes:
   - **Pass 1:** Insert all links with `parent_link_id = NULL`.
   - **Pass 2:** For each link, find the smallest containing wikilink (`findParentWikilink()`), look up its DB id, and UPDATE `parent_link_id`.

   This two-pass approach avoids foreign key ordering issues — all link ids exist before parent references are set.

4. **Depth computation** — `computeDepth()` counts how many larger wikilinks fully contain the current one (by position range). Depth 0 = top-level, depth 1 = nested inside one parent, etc.

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

sql.js operates entirely in memory. The database is persisted to disk (`saveToFile()`) at these points:

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
| `onDidDeleteFiles` | Remove from DB | Cascade-deletes links |
| `onDidRenameFiles` | Remove old + index new | Path updates |
| `onDidChangeActiveTextEditor` | Re-index departing file from editor buffer | Captures unsaved edits (e.g. new aliases) |

All handlers except `onDidChangeTextDocument` persist the DB after updating.

**Buffer read on editor switch:** The `onDidChangeActiveTextEditor` handler reads from the VS Code `TextDocument` buffer (`doc.getText()`) rather than from disk. This ensures that unsaved edits — such as newly added aliases in front matter — are captured in the index immediately when the user navigates away. If the document has already been closed (no longer in `workspace.textDocuments`), it falls back to reading from disk via `IndexScanner.indexFile()`.

**Debounced live-buffer re-index:** The `onDidChangeTextDocument` handler re-indexes the current document from its editor buffer 500 ms after the last keystroke. This ensures that a wikilink like `[[New Topic]]` typed on line 1 is immediately available for autocomplete when the user starts typing `[[New` on line 2 — without needing to save or navigate away first. Because this is a transient in-memory update (no `.asnotes/index.db` write), it is fast and does not call `safeSaveToFile()`. The debounce prevents re-indexing on every single keystroke. The debounce timer is cancelled in `disposeFullMode()` to prevent a stale callback firing after full mode has been torn down.

### Periodic scanning

A background `setInterval` runs `staleScan()` at a configurable interval (default: 300 seconds). This catches:

- Files modified by external tools (git checkout, other editors)
- Files created or deleted outside VS Code

The interval is read from `as-notes.periodicScanInterval`. Setting it to `0` disables periodic scanning. Changes to the setting take effect immediately (the interval is restarted on `onDidChangeConfiguration`).

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
| Alias | Reference | Alias name | `→ CanonicalPage` | `1-` |

The `sortText` prefix ensures pages always appear before aliases in the list. Both page and alias items set `insertText` to `Name]]` — selecting an item auto-closes the wikilink.

**Disambiguation:** when multiple pages share the same filename (e.g. `notes/Topic.md` and `archive/Topic.md`), the subfolder path is shown in the `detail` field so the user can distinguish them.

### Nested wikilinks and front matter

**Nested wikilinks:** when the user types `[[` inside an existing unclosed `[[...`, the bracket tracker detects the inner `[[` and scopes the replacement range to start after it. This allows the inner wikilink to be completed independently while the outer link remains open.

**Front matter suppression:** `isLineInsideFrontMatter()` checks whether the cursor is between the first two `---` lines. If so, no completions are returned — front matter aliases are plain strings, not wikilinks.

All three pure functions — `findInnermostOpenBracket()`, `findMatchingCloseBracket()`, and `isLineInsideFrontMatter()` — live in `CompletionUtils.ts` with no VS Code dependency, and are fully unit-tested.

### Caching strategy

The provider maintains a cached array of `CompletionItem[]` objects. The cache is rebuilt from the index only when marked dirty.

- **Dirty flag:** set via `refresh()` after any index update (file save, create, delete, rename, periodic scan, rebuild).
- **Rebuild:** queries `IndexService.getAllPages()` and `IndexService.getAllAliases()`, builds items once.
- **Filtering:** VS Code handles client-side filtering of the cached list as the user types — no per-keystroke DB queries.

This approach ensures the completion list is always up to date without redundant database access.

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
| Default | `#6699cc` (subtle blue) | Normal weight | All wikilink segments not under cursor |
| Active | `#4488ff` (bright blue) | Bold + underline | Segments of the innermost wikilink under the cursor |

### Why segments prevent decoration conflicts

Earlier versions registered one decoration range per wikilink. With overlapping ranges, the outer wikilink's default-blue decoration would override the inner wikilink's active-blue decoration (VS Code renders overlapping decorations in registration order, with later ones winning).

By using segments, each character position has exactly one range in either the default or active array. No overlap, no conflict.

**Active wikilink determination:**

1. For the cursor's line, call `findInnermostWikilinkAtOffset(wikilinks, cursorCharacter)`.
2. When building segments for that line, compare `segment.wikilink === activeWikilink` (reference equality).
3. Matching segments go to `activeRanges`; all others go to `defaultRanges`.

The decoration update runs on every cursor movement, editor switch, and document change. This is acceptably fast because segment computation is O(line_length × wikilink_count) and only processes the visible document.

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
   - Opens the SQLite database
   - Runs a stale scan to catch external changes
   - Creates shared `WikilinkService`, `WikilinkFileService`, `IndexService`, `IndexScanner`
   - Registers all providers: `WikilinkDecorationManager`, `WikilinkDocumentLinkProvider`, `WikilinkHoverProvider`, `WikilinkRenameTracker`
   - Registers the `as-notes.navigateWikilink` command
   - Sets up index update triggers (save, file events, editor switch)
   - Starts the periodic scanner
5. **Passive mode** (no `.asnotes/`): status bar only, no providers

All full-mode registrations are tracked in `fullModeDisposables[]` and pushed to `context.subscriptions`. The `deactivate()` function persists the database and cleans up.

Additionally, `extension.ts` registers the `as-notes.completionAccepted` command, which the completion provider's items use to clear the rename tracker's `pendingEdit` after a completion is applied (see [Completion and rename tracking interaction](#completion-and-rename-tracking-interaction)).

The markdown document selector is `{ language: 'markdown' }`, which VS Code maps to `.md` and `.markdown` files (configured in `package.json` under `contributes.languages`).

---

## Testing

Tests use vitest and are split across five test files:

### `WikilinkService.test.ts` (23 tests)

1. **Parser extraction** (11 test cases) — basic links, nested links, special characters, unbalanced brackets, interrupting characters. Each test verifies `linkText`, `pageName`, and `pageFileName` arrays.

2. **Innermost offset lookup** (6 tests) — simple links, outside-link offsets, nested links at each nesting level, deeply nested structures.

3. **Segment computation** (6 tests) — empty input, single links, 2-level nesting, 3-level nesting, sibling links, deeply nested structures with multiple children.

### `FrontMatterService.test.ts` (26 tests)

1. **`extractFrontMatter`** (7 tests) — valid front matter extraction, no front matter, no closing fence, content before fence, multiple fence blocks, empty front matter, whitespace handling.

2. **`parseAliases`** (11 tests) — list-style aliases, inline array, single inline value, no front matter, no `aliases:` field, empty aliases list, empty inline array, accidental `[[brackets]]` stripping, mixed formats, quoted values.

3. **`updateAlias`** (8 tests) — list format replacement, inline array replacement, single value replacement, alias not found, no front matter, no aliases field, preserves other front matter fields, handles missing closing fence.

### `IndexService.test.ts` (56 tests)

1. **Title extraction** (8 tests) — heading parsing, fallback to filename stem, various extensions, whitespace trimming.

2. **Schema** (2 tests) — table creation verification, `isOpen` state.

3. **Page CRUD** (6 tests) — insert, upsert, query, delete, cascade.

4. **Link CRUD** (8 tests) — insert, replace, backlinks, backlink count, nesting with parent_link_id and depth, rename updates, page path updates.

5. **Reset schema** (1 test) — drop and recreate.

6. **`indexFileContent`** (9 tests) — simple file, nested links, 3-level nesting, multi-line, title fallback, re-index, backlinks, empty file, filename sanitisation.

7. **Rename support** (6 tests) — link state for positional comparison, rename detection simulation, `updateRename()` for link references, `updatePagePath()` for page records, nested link rename detection, full rename flow.

8. **Aliases** (15 tests) — alias storage from front matter, re-indexing replaces aliases, no-front-matter edge case, `resolveAlias()` success and failure, case-insensitive resolution, `resolvePageByFilename()` direct vs alias match, backlink count including aliases, `updateAliasRename()` for alias record and link references, `findPagesByFilename()` for subfolder resolution, cascade delete on page removal, filename sanitisation, `getPageById()`, `getAllAliases()` with canonical page info, empty aliases.

### `WikilinkFileService.test.ts` (10 tests)

1. **Path distance** (10 tests) — same directory (0), nested subdirectory (1), sibling directories (2), root to deep (3), deep to root (3), divergent paths, case-insensitive comparison, deeply nested to root, same prefix different branch, single segment root.

### `WikilinkCompletionProvider.test.ts` (30 tests)

1. **Bracket detection** (11 tests) — no brackets, simple `[[`, after text, with text typed, already closed, nested innermost detection, inner closed leaving outer open, all brackets closed, multiple unclosed, partially closed, single `[`.

2. **Close-bracket detection** (9 tests) — no `]]`, `]]` at start, `]]` with text before, `]]` with text after, nested `[[...]]` skipped to find outer `]]`, only nested pairs (no outer close), immediate `]]` after nested pair, deeply nested brackets, `]]` with trailing wikilinks.

3. **Front matter detection** (6 tests) — no front matter, inside front matter, after front matter, unclosed front matter, empty document, first line not `---`.

4. **Completion item building** (4 tests) — page items with stem labels, alias items with canonical info, sort order (pages before aliases), duplicate filename disambiguation.

Tests that depend on VS Code APIs (decorations, document links, hover, rename tracker event handling) are not unit-tested — they require the extension host and are verified via F5 manual testing.

---

## Known limitations and future considerations

1. **Rename detection by position** — the `(line, start_col)` key works when edits happen inside a wikilink. Edits that shift the wikilink's position (e.g. inserting text before it on the same line) are not detected as renames. This is correct behaviour but worth noting.

2. **Large workspaces** — `updateLinksInWorkspace()` opens every `.md`/`.markdown` file in the workspace. For very large note collections, this could be slow. A `workspace.findTextInFiles` pre-filter could reduce the set of files to open. The index could also be used to narrow the search to files that actually contain the old link.

3. **Concurrent edits** — the rename tracker processes one document at a time. Edits to other documents while a rename dialog is shown are handled by the index refresh in `refreshIndexAfterRename()`.

4. **Sanitisation consolidation** — `sanitiseFileName()` is now shared via `PathUtils.ts`. The `Wikilink.ts` model still has its own inline sanitisation; a future cleanup could unify these.

5. **Segment computation performance** — the character-by-character scan is O(n × m). For lines with many wikilinks, a sorted-endpoint sweep-line approach would be O(n log n). This has not been necessary in practice.

6. **Backlink panel** — a dedicated tree view or webview showing all incoming links for the active file. The index already has the data; only the UI needs building.

7. **Tags** — `#tag` syntax support with index-backed queries is planned for a future iteration.
