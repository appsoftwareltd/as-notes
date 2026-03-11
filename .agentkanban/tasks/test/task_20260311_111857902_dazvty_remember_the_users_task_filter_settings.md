---
title: Remember the users task filter settings
created: 2026-03-11T11:18:57.902Z
updated: 2026-03-11T12:37:43.266Z
sortOrder: 1
---

## Conversation

[user]

When users change group by filters or TODO only / waiting only in the task view, the settings need to be stored in user settings so that each time the task view is shown / hidden or the workspace reloaded the values do not reset to default

[agent]

Implemented filter state persistence using `vscode.ExtensionContext.workspaceState`. The three filter values (`groupBy`, `showTodoOnly`, `waitingOnly`) are now saved and restored across panel hide/show and workspace reload. `pageFilter` remains ephemeral (search reset is intentional UX).

**Changes made:**

- **`TaskPanelProvider.ts`**: Constructor now takes `vscode.ExtensionContext` (previously `vscode.Uri`). `_buildHtml()` reads saved state from `workspaceState` and embeds it as `window.__INITIAL_FILTER_STATE__ = <json>;` in a nonced `<script>` tag before the main bundle. New `case 'saveFilterState'` in `_handleMessage()` writes the three keys back to `workspaceState`.
  - Keys: `as-notes.taskFilter.groupBy`, `as-notes.taskFilter.showTodoOnly`, `as-notes.taskFilter.waitingOnly`

- **`extension.ts`**: Updated `TaskPanelProvider` constructor call to pass full `context` instead of `context.extensionUri`.

- **`webview/tasks.ts`**: State variables now initialise from `__INITIAL_FILTER_STATE__` (with safe fallback to defaults). Added `saveFilterState()` helper that posts a `saveFilterState` message. Called from the group-by pill click handler and both checkbox change handlers.

Build verified clean.

[user]

