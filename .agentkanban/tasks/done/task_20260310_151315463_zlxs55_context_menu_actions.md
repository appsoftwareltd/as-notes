---
title: Context menu actions
created: 2026-03-10T15:13:15.463Z
updated: 2026-03-10T15:51:35.396Z
description: |-
  Editor tab right click context menu should show "View Backlinks"

  Editor page right click should not show view backlinks, only right click on wikilink / alias in the editor should
sortOrder: 3
---

## Conversation

[user]

Editor tab right click context menu should show "View Backlinks"

Editor page right click should not show view backlinks, only right click on wikilink / alias in the editor should

[agent]

**Plan**

Two changes are needed:

**1. Editor tab right-click → "View Backlinks"**

Add `as-notes.showBacklinks` to the `editor/title/context` menu in `package.json`. This menu appears when you right-click a tab. `showBacklinks` shows backlinks for the active file — the existing command with title "AS Notes: Show Backlinks" is the right one here.

**2. Editor content right-click → only show "View Backlinks" when cursor is on a wikilink/alias**

Currently `as-notes.viewBacklinks` and `as-notes.navigateToPage` appear in `editor/context` for all markdown files regardless of cursor position. To make them conditional on the cursor being on a wikilink:

- Listen to `vscode.window.onDidChangeTextEditorSelection` in extension.ts
- On each selection change, extract wikilinks from the current line and check if the cursor offset is inside one
- Call `vscode.commands.executeCommand('setContext', 'as-notes.cursorOnWikilink', true/false)` accordingly
- Update the `editor/context` `when` clause for both `viewBacklinks` and `navigateToPage` to add `&& as-notes.cursorOnWikilink`
- Clear the context key to `false` when full mode is deactivated

**Files to change:**
- `vs-code-extension/package.json` — add `editor/title/context` entry; update `editor/context` `when` clauses
- `vs-code-extension/src/extension.ts` — register `onDidChangeTextEditorSelection` listener in full mode

[user]

todo implement

[agent]

Done. Here's what was changed:

**`package.json`**
- Added `editor/title/context` entry for `as-notes.showBacklinks` with `when: resourceLangId == markdown` — appears when right-clicking an editor tab
- Updated `editor/context` `when` clauses for both `navigateToPage` and `viewBacklinks` to require `as-notes.cursorOnWikilink` — these items now only appear when the cursor is on a wikilink

**`extension.ts`**
- Registered an `onDidChangeTextEditorSelection` listener (in full mode) that calls `setContext('as-notes.cursorOnWikilink', ...)` based on whether the cursor is inside a wikilink on the current line
- Added `setContext('as-notes.cursorOnWikilink', false)` to `disposeFullMode()` to clean up on deactivation

Build: success.

[user]

There is an issue with the in editor page right click - the right click action does not always seem to be up to date. Sometimes I will click the same position in the page (inside or outside of a wikilink) and get different context menu actions - sometimes the view backlinks / navigate to page items will show, sometimes not  

[agent]

**Root cause:** `executeCommand('setContext', ...)` is asynchronous. When you right-click, VS Code evaluates the `when` clause for the context menu before the `setContext` promise resolves, so the stale value is used. This is a fundamental VS Code API limitation — there is no synchronous `setContext`.

**Options:**

**Option A (recommended): Remove the condition, always show the items**
Remove `as-notes.cursorOnWikilink` from both `when` clauses. Items always appear in the markdown context menu. When `viewBacklinks` is invoked with no wikilink under cursor, fall back to showing backlinks for the **current file** (same as tab right-click). When `navigateToPage` has no wikilink, silently do nothing. Reliable and adds useful fallback behaviour.

**Option B: Keep the current approach, accept occasional stale state**
The approach mostly works when the cursor was already positioned before right-clicking, but single-gesture right-click on a new position will sometimes be stale. No fix available.

**Option C: Remove condition only for `viewBacklinks`**
Always show "View Backlinks" (falls back to current file), remove `navigateToPage` from the context menu entirely.

Which approach would you prefer? Option A is recommended.

[user]

OK I accept A - keep the context options everywhere (they will just have differenet actions depending on where the click is - in or out of wikilink)

Can the wikilink hover menue also have a "View Backlinks" line above "Navigate to <Page>"

[agent]

**Plan**

**Part 1 — Fix context menu (Option A)**

- **`package.json`** — Remove `&& as-notes.cursorOnWikilink` from both `editor/context` when clauses
- **`extension.ts`**:
  - Remove the `onDidChangeTextEditorSelection` listener (no longer needed)
  - Remove `setContext('as-notes.cursorOnWikilink', false)` from `disposeFullMode`
  - Change `viewBacklinks`: when no wikilink under cursor, fall back to showing backlinks for the **current file** (instead of showing an info message)
  - Change `navigateToPage`: when no wikilink under cursor, silently do nothing (remove the info message)

**Part 2 — Hover menu command links**

The hover currently shows info only (filename, status, backlink count). Adding clickable links requires `MarkdownString.isTrusted` with `enabledCommands`.

[comment] I'm not sure what you mean by this - see attached image - it is this hover menu that we want A "view backlinks" link button for - we do it for navigate to page, so we should be able to do it for view backlinks

Because hovering doesn't move the cursor, the existing commands (`viewBacklinks`, `navigateToPage`) read from `editor.selection.active` which won't be on the hovered wikilink. So a new command is needed that accepts the page data as an argument.

Changes:
- **`extension.ts`** — Add `as-notes.viewBacklinksForPage` command accepting `{ pageFileName: string, pageName: string }` arg. The existing `viewBacklinks` already handles the per-wikilink logic; this is a thin wrapper taking args instead of reading from cursor.
- **`WikilinkHoverProvider.ts`** — Append two command links to the hover markdown:
  - `[$(references) View Backlinks](command:as-notes.viewBacklinksForPage?...)` (URL-encoded JSON args)
  - `[$(go-to-file) Navigate to Page](command:as-notes.navigateToPage)` — this one can use the cursor-based command since hovering and then clicking will have the cursor close enough, or we keep it simple
  - Set `markdown.isTrusted = { enabledCommands: ['as-notes.viewBacklinksForPage', 'as-notes.navigateToPage'] }`
- **`package.json`** — Register `as-notes.viewBacklinksForPage` command (needed for the hover command link to work)

**Files to change:**
- `vs-code-extension/package.json`
- `vs-code-extension/src/extension.ts`
- `vs-code-extension/src/WikilinkHoverProvider.ts`

[user] See comment above - check we are not talking at cross purposes

[agent]

Understood — the screenshot confirmed it. The "Navigate to SIT.md (ctrl + click)" in the hover comes from the `DocumentLinkProvider` tooltip (already built on `command:as-notes.navigateWikilink`), not from `WikilinkHoverProvider`. We do not need to add a Navigate link ourselves.

We only need to add one new line to the hover:

**`[$(references) View Backlinks](command:as-notes.viewBacklinksForPage?<encoded args>)`**

Same technique as the existing Navigate link — a command URI with the wikilink data encoded as args. The hover provider already has the full wikilink context, so this is straightforward.

[user]

plan

[agent]

**Revised plan**

**Part 1 — Fix editor/context menu (Option A)**

- **`package.json`** — Remove `&& as-notes.cursorOnWikilink` from both `editor/context` when clauses
- **`extension.ts`**:
  - Remove the `onDidChangeTextEditorSelection` listener block
  - Remove `setContext('as-notes.cursorOnWikilink', false)` from `disposeFullMode`
  - `viewBacklinks`: when no wikilink under cursor, fall back to showing backlinks for the **current file**
  - `navigateToPage`: when no wikilink under cursor, silently do nothing (remove info message)

**Part 2 — "View Backlinks" link in hover**

- **`package.json`** — Add `as-notes.viewBacklinksForPage` to `commands` list
- **`extension.ts`** — Register `as-notes.viewBacklinksForPage` command accepting `{ pageFileName: string, pageName: string }` args (same logic as `viewBacklinks` but data comes from args, not cursor)
- **`WikilinkHoverProvider.ts`** — Append `[$(references) View Backlinks](command:as-notes.viewBacklinksForPage?<url-encoded-json>)` to the hover markdown; set `markdown.isTrusted = { enabledCommands: ['as-notes.viewBacklinksForPage'] }`. This will appear above the existing "Navigate to…" DocumentLink tooltip line.

**Files:** `package.json`, `extension.ts`, `WikilinkHoverProvider.ts`

[user]

implement and explain in the task file the difference between the two providers

[agent]

**Provider explanation**

VS Code shows a single combined hover popup assembled from two independent providers:

- **`WikilinkDocumentLinkProvider`** (`vscode.DocumentLinkProvider`) — registered via `registerDocumentLinkProvider`. Runs over the whole document and returns `DocumentLink` objects (range + command URI). VS Code renders these as Ctrl/Cmd+Click links and automatically appends the `link.tooltip` ("Navigate to SIT.md (ctrl + click)") to the bottom of the hover popup. This is where the navigate action was already coming from.

- **`WikilinkHoverProvider`** (`vscode.HoverProvider`) — registered via `registerHoverProvider`. Called per-hover position and returns a `Hover` with a `MarkdownString` — the top block showing the bold filename, file status, and backlink count. This is where we added the new "$(references) View Backlinks" command link.

VS Code stacks both results into a single popup for the same cursor position.

**What was changed (Iteration 2)**

`package.json`:
- Removed `as-notes.cursorOnWikilink` condition from `editor/context` — both items always show in markdown right-click menus (no race condition)
- Added `as-notes.viewBacklinksForPage` to `commands` and `commandPalette` (hidden from palette)

`extension.ts`:
- `navigateToPage`: silently returns when cursor is not on a wikilink (no info message)
- `viewBacklinks`: falls back to `backlinkPanelProvider.show()` (current file) when cursor is not on a wikilink
- Removed the `onDidChangeTextEditorSelection` listener entirely (no longer needed)
- Removed `setContext('as-notes.cursorOnWikilink', false)` from `disposeFullMode`
- Added `as-notes.viewBacklinksForPage` command accepting `{ pageFileName, pageName }` args — used by the hover link since hovering does not move the cursor

`WikilinkHoverProvider.ts`:
- Appends a `[$(references) View Backlinks](command:as-notes.viewBacklinksForPage?<args>)` link with `isTrusted: { enabledCommands: ['as-notes.viewBacklinksForPage'] }` so the command link is clickable

Build: success.

[user]

