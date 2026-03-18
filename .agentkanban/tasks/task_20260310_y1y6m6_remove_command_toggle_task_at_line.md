---
title: Remove command "Toggle Task at Line"
lane: done
created: 2026-03-10T15:09:45.043Z
updated: 2026-03-10T15:51:32.687Z
description: It's not working and has low utility
sortOrder: 2
---

## Conversation

[user]

It's not working and has low utility

[agent]

**Plan**

`as-notes.toggleTaskAtLine` is currently:
- Registered in `package.json` → appears in the command palette (with no args → does nothing useful)
- Registered in `extension.ts` → called internally by `TaskPanelProvider` when the webview sends a `toggleTask` message
- `as-notes.toggleTaskFromPanel` is a backward-compat shim in both `package.json` and `extension.ts` that delegates to it

The toggle-from-webview functionality works fine internally; only the palette-exposed command is broken/useless. Since the internal call can be inlined directly in `TaskPanelProvider`, we can remove both registered commands entirely.

**Changes:**

1. `package.json` — remove `as-notes.toggleTaskAtLine` and `as-notes.toggleTaskFromPanel` command entries
2. `extension.ts` — remove both command registration blocks (`toggleTaskAtLine` and `toggleTaskFromPanel`)
3. `TaskPanelProvider.ts` — inline the toggle logic into `_handleMessage` (import `toggleTodoLine` from `TodoToggleService`; use `vscode.workspace.workspaceFolders?.[0]?.uri` directly)

[user]

todo implement

[agent]

Done. Removed `as-notes.toggleTaskAtLine` and `as-notes.toggleTaskFromPanel` from `package.json` and `extension.ts`. Inlined the toggle logic directly in `TaskPanelProvider._handleMessage` — the webview checkbox toggle still works, the commands no longer appear in the palette. Build passed.

[user]

There are more commands that have low utility, so remove from Ctrl + P command list

- as-notes.toggleShowTodoOnly
- as-notes.viewBacklinks (does not make sense without a target)
- as-notes.showBacklinks (does not make sense without a target)
- as-notes.navigateToPage (does not make sense without a target)
- as-notes.toggleTodo (this is handled by in editor keyboard shortcut)

[agent]

**Plan**

Three of the five commands (`showBacklinks`, `navigateToPage`, `viewBacklinks`) appear in `menus.editor/title` or `menus.editor/context` — VS Code requires them to remain in `contributes.commands` for those menu entries to render. The correct way to hide them from the palette is to add `commandPalette` menu entries with `"when": "false"`.

The other two (`toggleShowTodoOnly`, `toggleTodo`) are not referenced in any menu, so their `contributes.commands` entries can simply be deleted.

**Changes (all in `package.json`):**

1. Remove `as-notes.toggleShowTodoOnly` entry from `contributes.commands`
2. Remove `as-notes.toggleTodo` entry from `contributes.commands`
3. Add `menus.commandPalette` entries with `"when": "false"` for `as-notes.showBacklinks`, `as-notes.navigateToPage`, and `as-notes.viewBacklinks`

No changes needed in `extension.ts` — the command registrations stay (keybindings and menu clicks still need them).

[user]

todo implement

[agent]

Done. Removed `toggleTodo` and `toggleShowTodoOnly` from `contributes.commands`. Added `commandPalette` entries with `when: false` for `showBacklinks`, `viewBacklinks`, and `navigateToPage` so they still render in editor menus but are hidden from the palette. Build passed.

[user]

