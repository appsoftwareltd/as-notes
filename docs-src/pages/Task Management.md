# Task Management

AS Notes has two complementary tools for managing todos: a keyboard shortcut to toggle todo state on any line, and a Tasks panel that shows all open todos across your entire notes workspace.

## Todo Toggle

Press `Ctrl+Shift+Enter` (Cmd+Shift+Enter on macOS) on any line to cycle through todo states:

| Before | After |
|---|---|
| `buy milk` | `- [ ] buy milk` |
| `- [ ] buy milk` | `- [x] buy milk` |
| `- [x] buy milk` | `buy milk` |

The toggle is list-aware — if the line already starts with `- `, the marker is inserted correctly without duplicating the dash:

```
- some text       →  - [ ] some text
- [ ] some text   →  - [x] some text
- [x] some text   →  some text
```

Indentation is preserved at every step, so the toggle works correctly on nested list items. If your cursor is on multiple lines (multi-cursor), each line is toggled independently.

You can change the keybinding by searching for **AS Notes: Toggle Todo** in **Keyboard Shortcuts** (`Ctrl+K Ctrl+S`).

## Tasks Panel

The **AS Notes Tasks** panel appears in the Explorer sidebar. It shows a tree view of all todo items across all markdown files in your workspace, grouped by page.

### Opening the Panel

Press `Ctrl+Alt+T` (Cmd+Alt+T on macOS) to toggle the panel's visibility, or click the **AS Notes Tasks** entry in the Explorer sidebar.

### Navigating to a Task

Click any task in the panel to open the file and scroll directly to that line.

### Toggling a Task from the Panel

Each task entry has a check button. Click it to toggle the task's done/todo state directly from the panel — without stealing focus from your active editor.

### Filtering

The panel defaults to showing only unchecked (`- [ ]`) tasks. Click the filter icon in the panel title bar (or run **AS Notes: Toggle Show TODO Only**) to switch between:

- **Show TODO only** — only unchecked tasks (the default)
- **Show all** — both unchecked and checked tasks

### Live Sync

The panel refreshes automatically whenever a file is saved, edited, created, deleted, renamed, or a todo is toggled. Background scans also trigger a refresh.
