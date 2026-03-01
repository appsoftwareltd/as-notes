# AS Notes

AS Notes is a VS Code extension that turns your editor into a Personal Knowledge Management System (PKMS).

## Wikilinks

- Logseq / Roam / Obsidian style wikilinks in the VS Code editor
- Markdown wikilinks include nested link handling e.g. `[[[[AS Notes]] Page]]`
- Wikilinks navigate the user to the target page regardless of location in folder structure e.g. `[[[[AS Notes]] Page]]` -> `[[AS Notes]] Page.md`
- Renames for wikilinks automatically update other existing links and will rename the page to which the link refers to keep names in sync


## VS Code Marketplace

AS Notes via the Visual Studio Marketplace: https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes

## Getting started

### Initialise a workspace

AS Notes activates when it finds a `.asnotes/` directory in your workspace root (similar to `.git/` or `.obsidian/`). Without it, the extension runs in **passive mode** — you'll see a status bar item inviting you to initialise.

To initialise:

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **AS Notes: Initialise Workspace**

This creates the `.asnotes/` directory, builds a SQLite index of all markdown files, and activates all features. The index file (`.asnotes/index.db`) is excluded from git by an auto-generated `.gitignore`.

### Rebuild the index

If the index becomes stale or corrupted, run **AS Notes: Rebuild Index** from the Command Palette. This drops and recreates the entire index with a progress indicator.

## Features

### Wikilink highlighting

Every `[[wikilink]]` in a markdown file is highlighted in blue. When your cursor is inside a link, that specific link is highlighted with a brighter blue, bold, and underlined — so you always know which link you're about to interact with.

### Nested wikilinks

Links can contain other links:

```markdown
[[Specific [[Topic]] Details]]
[[Specific [[[[Topic]] Variant]] Details]]
```

This creates **three** navigable targets:

| You click on... | You navigate to... |
|---|---|
| `[[Topic]]` | `Topic.md` |
| `[[Specific` or `Details]]` (the outer portions) | `Specific [[Topic]] Details.md` |
| `[[[[Topic]] Variant]]` (the outer portions) | `[[Topic]] Variant.md` |

Nesting works to arbitrary depth. The extension always identifies the innermost link under your cursor for highlighting, hover, and click targets.

### Click navigation

**Ctrl+Click** (Cmd+Click on macOS) on any wikilink to open the target `.md` file. The target is always resolved in the same directory as the file containing the link.

### Auto-create missing pages

If you navigate to a page that doesn't exist, the extension creates it automatically and shows a notification. This lets you create forward-references to pages you intend to write later.

### Hover tooltips

Hover over any wikilink to see:

- The target filename (e.g. `My Page.md`)
- Whether the file already exists or will be created on click
- The number of backlinks (other pages that link to this target)

### Link rename synchronisation

When you edit the text of a wikilink and then move your cursor outside it (or switch to another file), the extension detects the change and offers to:

1. **Rename the corresponding `.md` file** (if it exists)
2. **Update every matching link** across all markdown files in the workspace

A single confirmation dialog covers all affected nesting levels. For example, editing `[[Inner]]` inside `[[Outer [[Inner]] text]]` offers to rename both the inner and outer pages.

You can decline the rename — the link text change is kept but files and other links are left untouched.

Rename detection is backed by the persistent index — the extension compares the last-indexed link state with the current document to detect changes accurately.

### Case-insensitive file matching

`[[my page]]` will find and open `My Page.md` regardless of the operating system. On case-sensitive filesystems (Linux), a directory scan finds the matching file. On Windows and macOS this is handled natively by the filesystem.

### Filename sanitisation

Characters that are invalid in filenames (`/ ? < > \ : * | "`) are replaced with `_` in the target filename. For example:

```markdown
[[What is 1/2 + 1/4?]]  →  What is 1_2 + 1_4_.md
```

### Page aliases

Define alternative names for a page using YAML front matter at the top of any markdown file:

```yaml
---
aliases:
  - Short Name
  - Another Name
---
```

Or inline array style:

```yaml
---
aliases: [Short Name, Another Name]
---
```

Linking to `[[Short Name]]` or `[[Another Name]]` navigates to the page that declares those aliases — no extra file is created.

**Hover tooltips** show alias resolution: hovering over `[[Short Name]]` displays `Short Name.md → ActualPage.md` and an alias indicator.

**Rename tracking** is alias-aware. Editing an alias link (e.g. changing `[[Short Name]]` to `[[New Name]]`) offers to update the front matter on the canonical page and all matching references across the workspace. No file is renamed.

**Backlink counts** include both direct and alias references. A page with two aliases counts links to all three names.

Alias values are plain strings. Any accidental `[[` or `]]` brackets are stripped automatically.

### Subfolder link resolution

Wikilinks resolve globally across the workspace, not just in the current directory. The extension uses the persistent index to find matching files anywhere in the folder tree.

**Resolution order:**

1. **Direct filename match** — `[[My Page]]` finds `My Page.md` anywhere in the workspace
2. **Alias match** — if no file matches, check page aliases
3. **Auto-create** — if nothing matches, create the file in the same directory as the source

**Disambiguation** — when multiple files share the same name (e.g. `notes/Topic.md` and `archive/Topic.md`):

1. A file in the **same directory** as the source always wins
2. Otherwise, the **closest folder** is preferred (measured by directory distance)

### Wikilink autocomplete

Type `[[` in any markdown file to trigger an autocomplete popup listing all indexed pages and aliases. As you type, the list filters in real time.

- **Page suggestions** show the page name (without `.md`). When multiple pages share the same name in different subfolders, the folder path is shown for disambiguation.
- **Alias suggestions** show the alias name with an arrow indicating the canonical page (e.g. `→ ActualPage`).
- **Auto-close** — selecting a suggestion inserts the page name and closes the wikilink with `]]`.
- **Nested wikilinks** — typing `[[` inside an existing unclosed `[[...` starts a new autocompletion scoped to the inner brackets.
- Completions are **suppressed inside front matter** blocks (between `---` fences).

### Persistent index

AS Notes maintains a SQLite database (`.asnotes/index.db`) that indexes all markdown files in the workspace. The index tracks:

- **Pages** — file paths, filenames, titles (extracted from the first `# heading`)
- **Links** — every wikilink in every file, with line, column, nesting depth, and parent references
- **Aliases** — alternative names declared in YAML front matter, with sanitised filenames
- **Backlinks** — reverse lookups for hover tooltips (including alias references)

The index is kept up-to-date automatically:

- On file save, create, delete, or rename
- On editor switch (captures unsaved edits)
- Via a configurable periodic background scan

## Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.periodicScanInterval` | `300` | Seconds between automatic background scans for file changes. Set to `0` to disable. Minimum: `30`. |

## Supported file types

The extension activates for files with `.md` and `.markdown` extensions.

## Wikilink syntax

A wikilink is any text enclosed in double square brackets:

```markdown
See [[Page Name]] for details.
```

The text between the brackets becomes both the display text and the page name. The target file is `Page Name.md` in the same directory.

### Nesting rules

Wikilinks can be nested by adding more bracket pairs:

```markdown
[[Outer [[Inner]] text]]
```

The parser uses a stack-based bracket matching algorithm. Each pair of `[[` and `]]` that balances correctly forms a valid wikilink. See [docs/TECHNICAL.md](docs/TECHNICAL.md) for a detailed explanation of the parsing algorithm and edge cases.

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch mode (rebuilds on changes)
npm run watch

# Run unit tests
npm test

# Type-check
npm run lint
```

### Debugging

Press **F5** in VS Code to launch the Extension Development Host with the extension loaded.

### Testing

Unit tests use [vitest](https://vitest.dev/) and cover the wikilink parser, offset-based lookup, segment computation, index service CRUD, title extraction, rename detection data flow, and nested link indexing. Run with `npm test`.

## Architecture

| File | Purpose |
|---|---|
| `src/extension.ts` | Entry point — activation model (passive/full mode), commands, index triggers |
| `src/Wikilink.ts` | Model class — positions, page name, filename sanitisation |
| `src/WikilinkService.ts` | Stack-based parser, innermost-offset lookup, segment computation |
| `src/WikilinkDecorationManager.ts` | Editor decorations (default + active highlight) |
| `src/WikilinkDocumentLinkProvider.ts` | Ctrl+Click navigation via non-overlapping segments (alias-aware tooltips) |
| `src/WikilinkHoverProvider.ts` | Hover tooltips with target file existence, alias indicator, backlink count |
| `src/WikilinkFileService.ts` | File resolution — index-aware global matching, alias resolution, subfolder disambiguation |
| `src/WikilinkRenameTracker.ts` | Rename detection (index-backed), alias vs direct rename classification, workspace-wide updates |
| `src/WikilinkCompletionProvider.ts` | Wikilink autocomplete — `[[` trigger, page + alias suggestions, auto-close, nested link support |
| `src/CompletionUtils.ts` | Pure utilities for completion logic — bracket detection, front matter detection |
| `src/IndexService.ts` | SQLite data layer — schema, CRUD, content indexing, alias management, nesting detection |
| `src/IndexScanner.ts` | VS Code filesystem scanning — file indexing, full scan, stale scan |
| `src/FrontMatterService.ts` | Lightweight YAML front matter parser — alias extraction, in-place alias updates |
| `src/PathUtils.ts` | Pure utilities — path distance calculation, filename sanitisation |
| `build.mjs` | Custom esbuild script — bundles extension, copies WASM binary |
| `src/test/` | Unit tests (vitest) |

For a deep dive into the technical design, see [docs/TECHNICAL.md](docs/TECHNICAL.md).

## Publishing

```
npx @vscode/vsce package
npx @vscode/vsce login appsoftwareltd
 
(Enter PAT token if auth expired)

npx @vscode/vsce publish
```
