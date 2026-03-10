---
task: task_20260310_151315463_zlxs55_context_menu_actions
---

## TODO

- [x] Add `as-notes.showBacklinks` to `editor/title/context` menu in `package.json`
- [x] Update `editor/context` when clauses for `viewBacklinks` and `navigateToPage` to include `as-notes.cursorOnWikilink`
- [x] Register `onDidChangeTextEditorSelection` listener in extension.ts to set `as-notes.cursorOnWikilink` context
- [x] Clear `as-notes.cursorOnWikilink` context on full mode deactivation
- [x] Build and verify

## Iteration 2 — Fix context menu race + hover actions

- [x] Remove `as-notes.cursorOnWikilink` from `editor/context` when clauses (`package.json`)
- [x] Remove `onDidChangeTextEditorSelection` listener and `setContext cursorOnWikilink` cleanup from `extension.ts`
- [x] Change `viewBacklinks`: fall back to current file when no wikilink under cursor
- [x] Change `navigateToPage`: silently do nothing when no wikilink (remove info message)
- [x] Register `as-notes.viewBacklinksForPage` command in `package.json` and `extension.ts`
- [x] Update `WikilinkHoverProvider.ts` to add command links (View Backlinks, Navigate to Page)
- [x] Build and verify
