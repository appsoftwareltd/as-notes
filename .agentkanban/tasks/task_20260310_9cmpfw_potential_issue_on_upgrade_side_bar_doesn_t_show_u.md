---
title: Potential issue on upgrade - Side bar doesn't show up initially
lane: done
created: 2026-03-10T17:33:09.006Z
updated: 2026-03-10T20:18:53.118Z
description: Not until I attempt toggle taskbar command
priority: critical
sortOrder: 1.5
---

## Conversation

[user]

There is a potential issue on upgrade - Side bar doesn't show up initially. Not until I attempt toggle taskbar command at least

Initially shows error that the ommand is not available

[agent]

**Root cause confirmed (read extension.ts and package.json).**

The `as-notes-tasks` view has `"when": "as-notes.fullMode"` in `package.json`. VS Code hides the entire activity bar container when none of its views pass their `when` conditions. The `as-notes.fullMode` context key is only set to `true` at the **very end** of `enterFullMode()` — after the database scan completes. On upgrade, when the DB schema has changed, this triggers a full rebuild scan that can take many seconds. During that window:

1. The AS Notes activity bar icon and sidebar are hidden (view `when` condition is false).
2. `as-notes.toggleTaskPanel` is not yet registered (it's added to `fullModeDisposables` after the scan), so any invocation produces a "command not available" error.

**Proposed fix (two-part):**

**Part 1 — `package.json`:** Remove `"when": "as-notes.fullMode"` from the `as-notes-tasks` view. This decouples sidebar visibility from whether the full index is ready. The sidebar icon and Tasks panel will always be present. The `TaskPanelProvider` already handles an empty/not-yet-scanned index gracefully (returns `[]`).

**Part 2 — `extension.ts`:** Move the `TaskPanelProvider` registration and `as-notes.toggleTaskPanel` command registration to **before** the scan runs (immediately after `initDatabase()` succeeds). After the scan completes, call `taskPanelProvider.refresh()` so the view populates with real data.

All other `as-notes.fullMode`-gated features (context menus, backlinks, wikilink providers, etc.) remain unchanged — they still only activate after the full scan.

Happy to proceed with implementation on your instruction.

[user]

todo implement

[agent]

**Implemented.** Two changes made:

**`package.json`** — Removed `"when": "as-notes.fullMode"` from the `as-notes-tasks` view definition. The sidebar activity bar icon and Tasks panel are now always visible regardless of indexing state.

**`extension.ts`** — Moved `TaskPanelProvider` registration, `as-notes.toggleTaskPanel`, and `as-notes.toggleShowTodoOnly` command registrations to immediately after `initDatabase()` succeeds, before any scan runs. Added `taskPanelProvider?.refresh()` after the scan completes so the view populates with real data. Build confirmed clean.

[user]


