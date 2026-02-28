# as-notes

A VS Code extension for navigating and managing markdown files using wikilinks. Link pages together with `[[double bracket]]` syntax, navigate between them with a click, and keep filenames in sync when you rename a link.

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

### Link rename synchronisation

When you edit the text of a wikilink and then move your cursor outside it (or switch to another file), the extension detects the change and offers to:

1. **Rename the corresponding `.md` file** (if it exists)
2. **Update every matching link** across all markdown files in the workspace

A single confirmation dialog covers all affected nesting levels. For example, editing `[[Inner]]` inside `[[Outer [[Inner]] text]]` offers to rename both the inner and outer pages.

You can decline the rename — the link text change is kept but files and other links are left untouched.

### Case-insensitive file matching

`[[my page]]` will find and open `My Page.md` regardless of the operating system. On case-sensitive filesystems (Linux), a directory scan finds the matching file. On Windows and macOS this is handled natively by the filesystem.

### Filename sanitisation

Characters that are invalid in filenames (`/ ? < > \ : * | "`) are replaced with `_` in the target filename. For example:

```markdown
[[What is 1/2 + 1/4?]]  →  What is 1_2 + 1_4_.md
```

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

Unit tests use [vitest](https://vitest.dev/) and cover the wikilink parser, offset-based lookup, and non-overlapping segment computation. Run with `npm test`.

## Architecture

| File | Purpose |
|---|---|
| `src/extension.ts` | Extension entry point — registers all providers and commands |
| `src/Wikilink.ts` | Model class — positions, page name, filename sanitisation |
| `src/WikilinkService.ts` | Stack-based parser, innermost-offset lookup, segment computation |
| `src/WikilinkDecorationManager.ts` | Editor decorations (default + active highlight) |
| `src/WikilinkDocumentLinkProvider.ts` | Ctrl+Click navigation via non-overlapping segments |
| `src/WikilinkHoverProvider.ts` | Hover tooltips with target file existence status |
| `src/WikilinkFileService.ts` | File resolution, case-insensitive matching, creation |
| `src/WikilinkRenameTracker.ts` | Rename detection, confirmation dialog, workspace-wide updates |
| `src/test/` | Unit tests (vitest) |

For a deep dive into the technical design, see [docs/TECHNICAL.md](docs/TECHNICAL.md).
