---
order: 2
---

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

## Finding Pages

The **Search** view sits at the top of the AS Notes sidebar. Type to filter, then press Enter (or click **Go To**) to open the page. It lists three kinds of entry:

| Entry | Shown as |
|---|---|
| Page | the filename without `.md`, with its folder alongside |
| Alias | the alias name, with `→ CanonicalPage` alongside |
| Forward reference | the name of a page you have linked to but not yet created, marked **New** — selecting it creates the file |

Filtering is a case-insensitive substring match against that name. It searches **page names and aliases, not page content** — for full-text search across your notes, use VS Code's own Search (`Ctrl+Shift+F` / `Cmd+Shift+F`), which works on markdown files like any other text.

Note that `title:` front matter plays no part here. It is read only by the publish tool, where it sets the HTML page title and the navigation label. If you want a page to be findable under a second name, give it an alias.

## Naming Notes

The filename is a page's identity: wikilinks, the Search view, autocomplete and published URLs all resolve against it.

A page name reads best as ordinary words with spaces — `Project Ideas.md` rather than `project-ideas.md` — so that `[[Project Ideas]]` sits naturally in a sentence. Keep to letters, digits, spaces and hyphens, and reword rather than substitute when a name wants punctuation:

| Instead of | Use | Why |
|---|---|---|
| `Sync: Overview` | `Sync Overview` | `:` is not legal in a filename and becomes `_` |
| `Import & Export` | `Import and Export` | `&` is dropped from the published URL slug |
| `Notes [Draft]` | `Notes Draft` | square brackets are the wikilink syntax |

When publishing, the URL slug is built by lowercasing the filename, turning spaces and underscores into hyphens, and **discarding every other character**. Two names that differ only in punctuation therefore land on the same URL, and the later page overwrites the earlier one without warning: `Import & Export.md` and `Import Export.md` both publish as `import-export.html`.

Put the punctuation you wanted back in the page's `# heading`, and in `title:` for a published page.

## Rename Synchronisation

AS Notes keeps files and links consistent when you rename either a wikilink or its backing file.

### In-Editor Rename

When you edit a wikilink's text and move the cursor away (or switch files), AS Notes detects the change and offers to:

1. **Rename the corresponding `.md` file** (if it exists)
2. **Update every matching wikilink** across all markdown files in the workspace

A single confirmation dialog covers all affected renames. You can decline -- the link text change is kept but files and other links are left untouched.

### Merge on Rename to Existing Page

If you rename a wikilink to match a page that already exists, AS Notes offers to **merge** the two files instead of renaming:

- The dialog uses "Merge" language so the operation is clear
- **Target page content is preserved** -- the source body is appended below the target body, separated by a blank line
- **Front matter is merged** with target priority -- the target's values win for any shared properties (e.g. `title`, `description`), while properties that only exist in the source are added
- **Aliases are merged and deduplicated** -- both pages' alias lists are combined, with duplicates removed
- The source file is **deleted** after the merge

Declining a merge is a full no-op -- no files change, no index updates, no other links are touched.

### Explorer Sidebar Rename

Renaming a `.md` file in the VS Code explorer sidebar triggers the same link update: all wikilinks that referenced the old filename are updated to match the new name.

### Alias-Aware Rename

Rename tracking is alias-aware. Editing an alias wikilink offers to update the alias value in the canonical page's front matter and all matching references across the workspace.

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

> **Aliases are an editor feature.** The publish tool resolves wikilinks by filename, then by slug, and knows nothing about the alias table. An `[[Alias]]` link on a page you publish becomes a placeholder page, not a link to the canonical page. Use aliases freely in private notes; in a folder you publish, link by filename.

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
