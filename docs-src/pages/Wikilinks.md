# Wikilinks

Wikilinks are the core navigation primitive in AS Notes. Wrap any page name in double square brackets and AS Notes turns it into a navigable link — no folder paths, no file extensions needed.

```
[[Page Name]]
```

AS Notes resolves the link to the matching `.md` file anywhere in your workspace. If `Page Name.md` doesn't exist yet, navigating to it creates the file automatically.

## Writing and Navigating Links

- **Write** `[[` and a completion list appears immediately. Keep typing to filter by page name or alias.
- **Navigate** — hold `Ctrl` (Cmd on macOS) and click any wikilink to open the target file.
- **Create** — if the target file doesn't exist, navigating to it creates it. Link first, write later.
- **Hover** — hover over a wikilink to see the target filename, whether it exists, and how many pages link to it.

## Highlighting

Every wikilink in a markdown file is highlighted in blue. When your cursor is inside a link, that specific link is highlighted with a brighter blue, bold, and underlined — so you always know which link you're about to interact with.

## How Resolution Works

Wikilinks resolve globally across your workspace, not just in the current folder. Given:

```
notes/
  Project Ideas.md
  journal/
    2026-03-07.md
```

The link `[[Project Ideas]]` resolves correctly from any file, at any depth.

**Resolution order:**

1. **Direct filename match** — finds `Page Name.md` anywhere in the workspace
2. **Alias match** — checks page aliases declared in YAML front matter
3. **Auto-create** — creates the file in the same directory as the source note

**When multiple files share the same name:**

1. A file in the **same directory** as the source always wins
2. Otherwise, the **closest folder** by directory distance wins

## Autocomplete

Type `[[` in any markdown file to trigger the autocomplete list:

- **Page names** — all indexed pages, with folder paths shown when names collide
- **Aliases** — shown as `Alias → CanonicalPage`
- Selecting a suggestion inserts the name and closes the brackets with `]]`
- Typing `[[` inside an already-open `[[...` starts autocomplete for an inner (nested) link
- Autocomplete is suppressed inside YAML front matter

## Rename Synchronisation

When you edit a wikilink's text and move the cursor away (or switch files), AS Notes detects the change and offers to:

1. **Rename the corresponding `.md` file** (if it exists)
2. **Update every matching wikilink** across all markdown files in the workspace

A single confirmation dialog covers all affected pages. You can decline — the link text change is kept but files and other links are left untouched.

Rename tracking is alias-aware: editing an alias wikilink offers to update the alias in the front matter and all matching references.

## Page Aliases

Define alternative names for a page using YAML front matter:

```yaml
---
aliases:
  - Short Name
  - Another Name
---
```

Or inline:

```yaml
---
aliases: [Short Name, Another Name]
---
```

`[[Short Name]]` and `[[Another Name]]` now both navigate to that page — no extra file is created. Hover tooltips show the alias resolution (`Short Name → ActualPage.md`). Alias values are plain strings; any accidental `[[` or `]]` characters are stripped automatically.

## Nested Wikilinks

Wikilinks can contain other wikilinks, allowing composite page names that are themselves fully navigable:

```
[[Specific [[Topic]] Details]]
```

This creates **two** navigable targets:

| You click on... | You navigate to... |
|---|---|
| `[[Topic]]` (the inner brackets) | `Topic.md` |
| `[[Specific` or `Details]]` (the outer portions) | `Specific [[Topic]] Details.md` |

More deeply nested examples work the same way:

```
[[[[[[Deep]] Topic]] Notes]]
```

Resolves three links: `Deep.md`, `[[Deep]] Topic.md`, and `[[[[Deep]] Topic]] Notes.md`.

**Practical use:** Nested wikilinks let you build a topic hierarchy where sub-pages share their parent's name. For example:

```
See [[[[AS Notes]] Changelog]] for recent changes.
```

Both `AS Notes.md` and `[[AS Notes]] Changelog.md` are independently navigable from that single line.

The cursor highlight always identifies the **innermost** link at your cursor position.

## Filename Sanitisation

Invalid filename characters (`/ ? < > \ : * | "`) are replaced with `_` when a new file is created from a wikilink:

```
[[What is 1/2 + 1/4?]]  →  What is 1_2 + 1_4_.md
```

## Case Insensitivity

`[[my page]]` resolves to `My Page.md` regardless of how the file was named. On case-sensitive filesystems (Linux), AS Notes does a directory scan to find the match.

## Missing Links

A wikilink with no matching file is still valid. It is highlighted (slightly differently) and navigating to it creates the file. See also the [[Backlinks]] panel, which shows incoming links to pages that don't exist yet.

## Backlinks

Every wikilink is tracked in the index. The [[Backlinks]] panel shows all pages that link to the current page, including nested references.
