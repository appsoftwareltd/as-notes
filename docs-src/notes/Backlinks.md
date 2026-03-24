# Backlinks

The Backlinks panel shows every note in your workspace that links to a given page. It is one of the most powerful navigation tools in AS Notes — use it to understand how ideas connect across your knowledge base.

## Opening the Panel

- Press `Ctrl+Alt+B` (Cmd+Alt+B on macOS) to open backlinks for the **currently active file**.
- **Right-click any wikilink** in the editor and choose **View Backlinks** to see backlinks for that specific page — useful for checking forward references (links to pages that don't exist yet).

The panel opens beside your active editor.

## What You See

Each backlink is displayed as a **chain** — the full outline context from the root of the page down to the link. A standalone mention (not nested inside another wikilink) is a chain of length one.

For example, if `Project.md` contains:

```
- [[Tasks]]
  - [[NGINX]]
```

…then the backlink chain for `NGINX` from `Project.md` would be:

```
Project → Tasks → NGINX
```

Each link in the chain is individually clickable and shows its line number (e.g. `[L12]`). Below each chain, the surrounding line text is shown with the wikilink highlighted — giving you immediate context without having to open the file.

## View Modes

Toggle the view mode using the button in the panel header:

| Mode | Description |
|---|---|
| **Flat by page** (default) | All backlink instances listed alphabetically by source page name. Journal files sort chronologically. |
| **Grouped by chain** | Backlinks grouped by their chain pattern, with collapsible headers. Good for exploring concept-based relationships. |

The default mode is configured via `as-notes.backlinkGroupByChain` in [[Settings]].

## Context Verbosity

A second toggle controls how much line text is shown:

- **Compact** (default) — single-line, truncated
- **Wrapped** — full text visible

The default is configured via `as-notes.backlinkWrapContext`.

## Alias-Aware

If a page has aliases (see [[Wikilinks]]), the backlinks panel includes links that target any of the page's aliases, not just direct filename references.

## Forward References

The panel works even for pages that don't exist yet. If you have written `[[Future Topic]]` somewhere and then right-click that link and choose **View Backlinks**, you will see all the places it is referenced — even before `Future Topic.md` has been created.

## Live Sync

The panel updates automatically when you:

- Switch to a different file
- Save a file
- The index is updated (file changes, background scan)

## Backlink Counts in Hover Tooltips

When you hover over any wikilink in the editor, the tooltip shows the number of backlinks for that page. This gives you a quick sense of how central an idea is without opening the panel.
