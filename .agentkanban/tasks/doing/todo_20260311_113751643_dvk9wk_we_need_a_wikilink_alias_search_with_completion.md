---
task: task_20260311_113751643_dvk9wk_we_need_a_wikilink_alias_search_with_completion
---

## TODO

- [x] Add `as-notes-search` webview view to `package.json` views (first entry in `as-notes-sidebar`)
- [x] Add `search.ts` and `search.css` entry points to `build.mjs` 
- [x] Create `SearchPanelProvider.ts` — WebviewViewProvider following TaskPanelProvider pattern
- [x] Create `src/webview/search.ts` — autocomplete UI logic (filter, keyboard nav, dropdown)
- [x] Create `src/webview/search.css` — Tailwind CSS styling for search panel
- [x] Register `SearchPanelProvider` in `extension.ts` `enterFullMode()` + wire refresh calls
- [x] Update `TECHNICAL.md` with Search panel section
- [x] Build and verify no errors

### Iteration 2 — Test feedback

- [x] Fix dropdown: change from `absolute` to `relative` positioning so it pushes panel content down (user expands panel to see results)
- [x] Bump font sizes: input and labels to `text-sm`, icons to 16px, Go button to 26px
- [x] Build and verify
