---
task: task_20260310_103330375_9u0r85_tasks_rework
---

## TODO

### Implementation

- [x] DB schema: SCHEMA_VERSION 1→2, add priority/waiting/due_date columns to tasks table
- [x] parseTaskMeta() static helper in IndexService
- [x] Update indexTasksFromContent() to use parseTaskMeta
- [x] Update TaskRow interface to include new fields
- [x] Update mapTaskRows() to map new columns
- [x] Add getAllTasksForWebview() query
- [x] Rewrite TaskPanelProvider as WebviewViewProvider
- [x] Create src/webview/tasks.ts (webview frontend)
- [x] Create src/webview/tasks.css (Tailwind v4 CSS)
- [x] Update build.mjs to add PostCSS/Tailwind and webview esbuild step
- [x] Install tailwindcss, @tailwindcss/postcss, postcss
- [x] package.json: add viewsContainers activitybar entry
- [x] package.json: move as-notes-tasks view to as-notes-sidebar, type=webview
- [x] package.json: add as-notes.toggleTaskAtLine command
- [x] package.json: remove view/title and view/item/context menus
- [x] package.json: add tailwind devDependencies
- [x] extension.ts: register TaskPanelProvider via registerWebviewViewProvider
- [x] extension.ts: add toggleTaskAtLine command
- [x] extension.ts: keep toggleTaskFromPanel as backward-compat shim
- [x] tsconfig.json: exclude src/webview/**/*
- [x] tsconfig.webview.json: new config with DOM lib
- [x] IndexService.test.ts: remove non-existent OutlinerEntry import
- [x] IndexService.test.ts: add parseTaskMeta tests (11)
- [x] IndexService.test.ts: add task metadata indexing tests (6)
- [x] Build succeeds (npm run build)
- [x] All tests pass (463/463)
