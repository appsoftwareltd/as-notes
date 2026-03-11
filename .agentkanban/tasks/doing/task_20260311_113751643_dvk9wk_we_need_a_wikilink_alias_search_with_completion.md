---
title: We need a wikilink / alias search with completion
created: 2026-03-11T11:37:51.643Z
updated: 2026-03-11T20:22:26.807Z
priority: high
sortOrder: 2
---

## Conversation

[user]

We need a text completion search bar wikilinks / aliases. It should reside in the AS Notes side bar in a small section above the tasks view.

The completion control can extend down over the task view when open if needed. Only completed wikilinks aliases are allowed so once selected, the "Go To" button opens the file in the editor directly (or an Enter key press when the control is focused) 

[agent]

I've read README.md, AGENTS.md, INSTRUCTION.md, and TECHNICAL.md. Working in task file: `task_20260311_113751643_dvk9wk_we_need_a_wikilink_alias_search_with_completion.md`.

## Plan

### Goal

Add a **Wikilink Search** panel to the AS Notes sidebar, positioned **above** the existing Tasks view. It provides a text input with autocomplete that searches all indexed pages and aliases, then navigates to the selected file.

### Architecture

The existing sidebar has one webview view (`as-notes-tasks` / `TaskPanelProvider`). We'll add a second webview view above it.

**Pattern**: Follow the `TaskPanelProvider` model — a `WebviewViewProvider` with its own webview. However, since the search UI is small and self-contained (input + dropdown), we'll use **inline HTML** (like `BacklinkPanelProvider`) rather than separate TS/CSS build entries. This keeps the change minimal.

### Data Source

`IndexService` already provides:
- `getAllPages()` → all page rows (path, filename, title)
- `getAllAliases()` → alias rows with canonical page info
- `getForwardReferencedPages()` → unresolved forward references (page names referenced but not yet created)

We'll send the full list to the webview on init/refresh. The webview filters locally as the user types — no round-trips needed for each keystroke.

### Components

1. **`SearchPanelProvider.ts`** — new `WebviewViewProvider`:
   - `VIEW_ID = 'as-notes-search'`
   - Receives `IndexService` reference
   - On `resolveWebviewView`: builds HTML with search input + results dropdown
   - Sends `{ type: 'update', entries }` with all searchable entries on refresh
   - Handles `{ type: 'navigateTo', pagePath }` messages from webview → opens file in editor
   - Refreshes when index updates (same pattern as `TaskPanelProvider`)

2. **`package.json` changes**:
   - Add view: `{ "type": "webview", "id": "as-notes-search", "name": "Search" }` as **first** entry in `as-notes-sidebar` views array (so it appears above Tasks)

3. **`extension.ts` changes**:
   - Create and register `SearchPanelProvider` in `enterFullMode()`
   - Wire up index update notifications to trigger `searchPanelProvider.refresh()`

4. **Webview UI** (inline in `SearchPanelProvider`):
   - Text input with placeholder "Search wikilinks..."
   - Dropdown list that appears below input on typing, showing matching entries
   - Each entry shows: label (page name or alias), detail (directory path for pages, "→ canonical" for aliases)
   - Arrow keys navigate, Enter or click selects
   - "Go To" button next to input (also triggered by Enter when a result is selected)
   - Uses VS Code CSS variables for theme compatibility
   - Dropdown can visually overflow the panel bounds via `overflow: visible` / absolute positioning

5. **TECHNICAL.md**: Update with new "Search panel" section.

### Behaviour

- **Filtering**: Case-insensitive substring match on label. Results capped at ~20 visible items for performance.
- **Selection**: Only completed selections (picked from the dropdown) are valid. Free-text that doesn't match an entry can't be navigated to.
- **Navigation**: On selection + Enter/GoTo → extension opens the file via `vscode.workspace.openTextDocument(path)` + `vscode.window.showTextDocument()`
- **Forward references**: Included in results. Selecting one creates the file (same behaviour as clicking a wikilink to a non-existent page — delegates to existing `navigateToPage` logic).

### Questions for you

1. **Panel collapsibility**: The new Search view will be collapsible by default (standard VS Code sidebar behaviour). Is that OK, or do you want it always expanded?

[comment] Always expanded

2. **Forward references**: Should unresolved forward references (wikilinks to pages that don't exist yet) appear in search results? They'd allow creating new pages by searching. Or should we only show existing pages + aliases? [comment] Show the forward links, but we need an indicator that the page would be created if the user navigates to it
3. **View name**: "Search" or "Wikilink Search" or something else for the sidebar section title?

[comment] Search is fine

[user] See inline comments - note styling needs to be with tailwind like the tasks view

[agent]

Working in task file: `task_20260311_113751643_dvk9wk_we_need_a_wikilink_alias_search_with_completion.md`.

Understood. Incorporating your comments:

1. **Always expanded** — VS Code sidebar views don't have a native "prevent collapse" API, but we can set `"initialSize": 1` on the view to keep it small and non-intrusive. The view will always be visible by default. User can still manually collapse it, but that's standard VS Code behaviour — no way to override it.
2. **Forward links with creation indicator** — forward references will show in results with a distinct badge/icon (e.g. "New" badge or `+` icon) indicating the page will be created on navigation.
3. **"Search" as view name** — confirmed.
4. **Tailwind CSS** — will use separate `search.ts` / `search.css` webview files built through the same PostCSS + Tailwind pipeline as the tasks view.

### Updated Architecture

Following the TaskPanelProvider pattern exactly:
- `SearchPanelProvider.ts` — WebviewViewProvider, VIEW_ID `as-notes-search`
- `src/webview/search.ts` — IIFE bundle for the webview (autocomplete UI logic)
- `src/webview/search.css` — Tailwind CSS for the webview
- `build.mjs` — add entry points for `search.ts` and `search.css`
- `package.json` — add the view as first entry in `as-notes-sidebar`
- `extension.ts` — register provider, wire up refresh

### Data Flow

1. Extension sends `{ type: 'update', entries: SearchEntry[] }` on init + every index refresh
2. `SearchEntry` = `{ label: string, detail: string, pagePath: string, pageFileName: string, kind: 'page' | 'alias' | 'forward' }`
3. Webview filters locally per keystroke, renders dropdown
4. On selection + Enter/Go → webview posts `{ type: 'navigateTo', pageFileName: string, pagePath: string, kind: string }` 
5. Extension opens existing file or creates new file (for forward references) via existing `WikilinkFileService.navigateToFile()`

Proceeding to implement.

[user]

[agent]

Implementation complete. All TODO items checked off. Here's what was done:

### Files Created
- **`SearchPanelProvider.ts`** — WebviewViewProvider (`as-notes-search`) that builds entries from IndexService (pages, aliases, forward refs) and handles navigation messages
- **`src/webview/search.ts`** — IIFE webview bundle with autocomplete UI: search input, dropdown with keyboard nav (arrows/Enter/Escape), icon-differentiated entries (page/alias/forward), "New" badge for forward references, Go To button
- **`src/webview/search.css`** — Tailwind CSS with VS Code theme variables for the search bar, dropdown, and entry styling

### Files Modified
- **`package.json`** — Added `as-notes-search` as first view in `as-notes-sidebar` (appears above Tasks), with `initialSize: 1`
- **`build.mjs`** — Added `searchWebviewBuildOptions` for `search.ts` → `dist/webview/search.js`, and search CSS processing alongside tasks CSS
- **`extension.ts`** — Imported `SearchPanelProvider`, registered in `enterFullMode()`, wired `setFileService()` after fileService creation, added `searchPanelProvider?.refresh()` at all 12 index-update sites, cleanup on mode exit
- **`TECHNICAL.md`** — Added "Search panel" section with TOC entry

### Verification
- Build: succeeds (no new errors)
- Tests: all 503 pass

[user]

Test feed back:

If the search area in the side bar is too small, then the completion menu is hidden behind the task section below. Could the completion menu have a higher z-index so that it always sits above?

Could the font size of everything in the search area be bigger so that it matches the text size of the editor generally

[agent]

Working in task file: `task_20260311_113751643_dvk9wk_we_need_a_wikilink_alias_search_with_completion.md`.

Two issues from testing — both are CSS fixes in `search.css`:

### 1. Dropdown z-index

The dropdown has `z-index: 100` but it's **inside** the search webview's iframe, so z-index can't escape the webview boundary. The dropdown can only overlay content within **its own** webview — it can't overlay the Tasks webview below it because VS Code renders each sidebar view in its own isolated iframe.

**Realistic fix**: The dropdown already uses `position: absolute` and `z-index: 100`. The issue is that the webview's `<html>` and `<body>` have constrained height/overflow. We need `overflow: visible` on the body so the dropdown can visually extend beyond the webview's visible area. The current CSS already has `overflow: visible` on `html, body` — but VS Code might clip the webview container. Unfortunately, we can't control the VS Code iframe clipping.

**Alternative approach**: Since we can't escape the iframe, the best we can do is ensure the dropdown doesn't get clipped *within* the webview. The webview likely has a small fixed height from VS Code. Two options:
  - **A)** Use a fixed/viewport-positioned dropdown that renders at the bottom of the viewport (like VS Code's own command palette), so it uses all available space within the iframe
  - **B)** Accept that the panel needs some minimum height and document it — VS Code sidebar views don't support cross-view overflow

I'll go with **A** — position the dropdown as `position: fixed` relative to the viewport, so it uses all available iframe space regardless of the panel's scroll position.

[comment] Option B I'll accept the restriction - can we just prevent the search area from scrolling, I'd rather just expand the panel down

### 2. Font size

Currently using `text-xs` (0.75rem / 12px) for the input and entries. I'll bump everything to use `text-sm` (0.875rem / 14px) for the input and entry labels, and `text-xs` for the detail text. This should match the editor's default font size.

Both fixes are straightforward CSS changes. Ready to implement.

[user] See inline comments

[agent]

Working in task file: `task_20260311_113751643_dvk9wk_we_need_a_wikilink_alias_search_with_completion.md`.

Implemented both fixes per your feedback (Option B for dropdown):

### Changes to `search.css`

1. **Dropdown positioning** — Changed from `position: absolute` to `position: relative`. The dropdown now flows naturally within the webview content, pushing the panel down. User expands the Search panel to see results. Removed `max-height` and `overflow-y: auto` constraints so all results are visible. Set `html, body` to `overflow: hidden` to prevent internal scrolling.

2. **Font sizes bumped** — Input: `text-xs` → `text-sm`. Entry labels: `text-xs` → `text-sm`. Entry detail: kept `text-xs` but removed the extra-small `0.65rem` override. Badge: removed `0.6rem` override, kept `text-xs`. Icons: 14px → 16px. Go button: 24×24 → 26×26.

### Verification
- Build: succeeds
- Tests: all 503 pass

[user]

Test feed back:

Looks good but it still internally scrolls when I navigate down the completion options it just doesn't show a a scroll bar - can we stop the scrolling all together? The user can expand if needed

[agent]

Working in task file: `task_20260311_113751643_dvk9wk_we_need_a_wikilink_alias_search_with_completion.md`.

## Fix — Remove programmatic scrolling

### Root cause

`scrollActiveIntoView()` in `search.ts` calls `element.scrollIntoView({ block: 'nearest' })` on the active dropdown item when the user presses arrow keys. Browsers allow programmatic scrolling even on elements with `overflow: hidden`, so the body scrolls internally despite the CSS constraint.

### Changes to `search.ts`

- Removed `scrollActiveIntoView()` function entirely
- Removed both call sites (ArrowDown and ArrowUp handlers)

The dropdown renders all items — the user expands the panel to see them. No scrolling needed.

### Verification
- Build: clean
- Tests: 503/503 pass

[user]