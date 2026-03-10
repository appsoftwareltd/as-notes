---
task: task_20260310_150945043_y1y6m6_remove_command_toggle_task_at_line
---

## TODO

- [x] package.json: remove `as-notes.toggleTaskAtLine` command entry
- [x] package.json: remove `as-notes.toggleTaskFromPanel` command entry
- [x] extension.ts: remove `toggleTaskAtLine` command registration block
- [x] extension.ts: remove `toggleTaskFromPanel` shim registration block
- [x] TaskPanelProvider.ts: inline toggle logic (import `toggleTodoLine`, use workspace root directly)
- [x] Build and verify no errors

## Iteration 2 — Hide more commands from palette

- [x] package.json: remove `as-notes.toggleShowTodoOnly` from `contributes.commands`
- [x] package.json: remove `as-notes.toggleTodo` from `contributes.commands`
- [x] package.json: add `commandPalette` when:false for `showBacklinks`, `navigateToPage`, `viewBacklinks`
- [x] Build and verify no errors
