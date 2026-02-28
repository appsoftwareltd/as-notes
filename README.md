# as-notes

A VS Code extension for navigating markdown files using wikilinks.

## Features

- **Wikilink highlighting** — Wikilinks (`[[Page Name]]`) are highlighted in blue in markdown files
- **Nested wikilink support** — Complex nested links like `[[Outer [[Inner]] text]]` are fully supported; the innermost link under the cursor is highlighted distinctly
- **Ctrl/Cmd+Click navigation** — Click a wikilink to open the target `.md` file in the same directory
- **Auto-create missing pages** — If the target file doesn't exist, it's created automatically
- **Hover tooltips** — Hover over a wikilink to see the target filename and whether it exists

## Wikilink Syntax

Wikilinks are text enclosed in double square brackets:

```markdown
Visit [[My Page]] for details.
```

This links to `My Page.md` in the same directory.

### Nested Wikilinks

Wikilinks can be nested:

```markdown
See [[Specific [[Topic]] Details]] for more.
```

- Clicking the outer portion navigates to `Specific [[Topic]] Details.md`
- Clicking `[[Topic]]` navigates to `Topic.md`

### Filename Sanitisation

Characters invalid in filenames (`/ ? < > \ : * | "`) are replaced with `_` in the target filename.

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

## Architecture

| File | Purpose |
|------|---------|
| `src/extension.ts` | Extension activation, registers all providers |
| `src/Wikilink.ts` | Wikilink model — positions, page name, filename sanitisation |
| `src/WikilinkService.ts` | Stack-based parser for extracting wikilinks (including nested) |
| `src/WikilinkDecorationManager.ts` | Editor decorations — default and active highlight styles |
| `src/WikilinkDocumentLinkProvider.ts` | DocumentLinkProvider for Ctrl+Click navigation |
| `src/WikilinkHoverProvider.ts` | Hover tooltips showing target file info |
| `src/WikilinkFileService.ts` | File resolution, existence checks, and creation |
| `src/test/` | Unit tests (vitest) |
