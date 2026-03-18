---
task: task_20260310_173309006_9cmpfw_potential_issue_on_upgrade_side_bar_doesn_t_show_u
---

## TODO

- [x] Remove `"when": "as-notes.fullMode"` from the `as-notes-tasks` view in `package.json`
- [x] Move `TaskPanelProvider` registration and `as-notes.toggleTaskPanel`/`toggleShowTodoOnly` commands to before the scan in `extension.ts`
- [x] Add `taskPanelProvider.refresh()` call after scan completes in `extension.ts`
