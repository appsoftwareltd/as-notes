---
title: "Slash commands required for task #hashtags"
created: 2026-03-11T10:10:26.590Z
updated: 2026-03-11T10:10:32.336Z
priority: high
sortOrder: 4
---

## Conversation

[user]

The task side bar view is supported by hash tags for filtering and sorting

| Tag | Description |
|---|---|
| `#P1` | Priority 1 — Critical |
| `#P2` | Priority 2 — High |
| `#P3` | Priority 3 — Normal |
| `#W` | Waiting — task is blocked or waiting on someone/something |
| `#D-YYYY-MM-DD` | Due date — e.g. `#D-2026-03-15` |

Add slash commands for quick insertion 

- `#P1 - #P3` get separate commands (the user can edit manually to suffix with another digit)
- `#D-YYYY-MM-DD` triggers an input dialogue that enforces a valid date. Is a tailwind styled date picker as used in `D:\src\vscode-agent-kanban` feasible?

[agent]

## Plan

### Context investigated

- `SlashCommandProvider.ts` — existing slash command completions (Today, Date Picker, Code, Table commands)
- `DatePickerService.ts` — `openDatePicker()` uses `vscode.window.showInputBox` with YYYY-MM-DD validation, inserts `[[YYYY_MM_DD]]`
- `extension.ts` — command registrations live in `enterFullMode()`; `as-notes.openDatePicker` is already registered
- `package.json` — commands section declares all palette-visible commands
- `D:\src\vscode-agent-kanban` — inspected the webview; it uses a standard HTML `<input type="date">` embedded inside an existing, full-size kanban board webview panel, NOT a standalone floating picker

### Tailwind date picker feasibility

VS Code webviews open as full editor panels — they cannot be rendered as floating pop-ups or modal overlays. The vscode-agent-kanban date input exists inside an already-open board panel; it is not a self-contained picker. Launching a separate webview panel just to pick a date would be disruptive (focus leaves the editor, a new tab opens). **The pragmatic approach is to use `vscode.window.showInputBox`**, exactly as the existing `/Date Picker` command does. This is quick, keyboard-driven, and consistent with the current UX.

### What will be built

#### 1. Slash commands (in `SlashCommandProvider.ts`) — 5 new items

| Slash command | Inserts | Sort key |
|---|---|---|
| `Task: Priority 1` | `#P1` | `e-task-p1` |
| `Task: Priority 2` | `#P2` | `f-task-p2` |
| `Task: Priority 3` | `#P3` | `g-task-p3` |
| `Task: Waiting` | `#W` | `h-task-waiting` |
| `Task: Due Date` | fires `as-notes.insertTaskDueDate` | `i-task-due-date` |

All sorted together under a `Task:` group prefix, grouped alphabetically after the table commands.

#### 2. New `insertTaskDueDate()` function in `DatePickerService.ts`

- Opens `vscode.window.showInputBox` pre-filled with today's date (`YYYY-MM-DD`)
- Validates YYYY-MM-DD format and real date (same logic as `openDatePicker`)
- On confirm, inserts `#D-YYYY-MM-DD` at every active cursor position

#### 3. `extension.ts` — register `as-notes.insertTaskDueDate` command (inside `enterFullMode`)

#### 4. `package.json` — no palette declaration needed (pure slash-command trigger, same as table commands)

### Files changed

- `vs-code-extension/src/SlashCommandProvider.ts`
- `vs-code-extension/src/DatePickerService.ts`
- `vs-code-extension/src/extension.ts`

Confirm or raise any objections before I implement.

[user] Agreed

[agent]

## Implementation complete

### Changes made

**`vs-code-extension/src/DatePickerService.ts`**
- Added `insertTaskDueDate()` — `showInputBox` pre-filled with today's YYYY-MM-DD, same validation as `openDatePicker`, inserts `#D-YYYY-MM-DD` at all cursor positions.

**`vs-code-extension/src/SlashCommandProvider.ts`**
- Added 5 new completion items after the Table group:
  - `Task: Priority 1` → inserts `#P1` (sortText `e-task-p1`)
  - `Task: Priority 2` → inserts `#P2` (sortText `f-task-p2`)
  - `Task: Priority 3` → inserts `#P3` (sortText `g-task-p3`)
  - `Task: Waiting` → inserts `#W` (sortText `h-task-waiting`)
  - `Task: Due Date` → fires `as-notes.insertTaskDueDate` command (sortText `i-task-due-date`)

**`vs-code-extension/src/extension.ts`**
- Added `insertTaskDueDate` to the import from `DatePickerService.js`
- Registered `as-notes.insertTaskDueDate` command in `enterFullMode()` alongside `openDatePicker`

Build verified clean.

[user]

Test feedback: 

The hashtags must be inserted at the start of the task text, as otherwise they are not rendered in the task view

Like this 

```
- [ ] #P1 #D-2026-03-11 Task text here
```

Not like this 

```
- [ ] Task text here #P1 #D-2026-03-11 
```

[agent]

## Plan — Insert at task start

### Root cause

- Priority/Waiting tags (#P1, #P2, #P3, #W) use `insertText` directly, so they insert wherever the `/` cursor is — often mid-line after existing text.  
- `insertTaskDueDate()` also uses `edit.insert(sel.active, tag)` — same issue.

### Fix

#### 1. Shared `insertTagAtTaskStart(tag)` helper (in `DatePickerService.ts`)

Finds the task text start position on the **active cursor's line** using the pattern:

```
/^(\s*-\s+\[[ xX]\]\s+)/
```

- If the line matches: insert `tag + ' '` at character `match[1].length` (immediately after `- [ ] `), prepending to any existing text.
- Fallback: insert at cursor (non-task lines, plain text).

#### 2. Priority/Waiting slash commands — switch to command-based insertion

Convert from `insertText = '#P1'` to:
- `insertText = ''` (erases the `/`)
- `command: { command: 'as-notes.insertTaskHashtag', arguments: ['#P1'] }`

Same pattern for `#P2`, `#P3`, `#W`.

#### 3. `as-notes.insertTaskHashtag` new command in `extension.ts`

Registered in `enterFullMode()`. Calls `insertTagAtTaskStart(tag)` with the passed argument.

#### 4. `insertTaskDueDate()` — call `insertTagAtTaskStart` instead of `edit.insert(sel.active, tag)`

### Files changed

- `vs-code-extension/src/DatePickerService.ts` — add `insertTagAtTaskStart`, update `insertTaskDueDate`
- `vs-code-extension/src/SlashCommandProvider.ts` — convert 4 direct-insert items to command-based
- `vs-code-extension/src/extension.ts` — register `as-notes.insertTaskHashtag`

Confirm or raise any objections before I implement.

[user] Add that the cursor should return to it's original position after the insert

[agent]

## Updated Plan — Insert at task start + cursor restoration

### Root cause (same as before)

- Priority/Waiting tags use `insertText` directly → insert at cursor, which may be mid-line.
- `insertTaskDueDate()` uses `edit.insert(sel.active, tag)` — same issue.

### Cursor restoration analysis

When `edit.insert` places text at task start (position `insertCol`) which is **before** the cursor (at `originalCol`), VS Code automatically shifts the cursor right by `insertLen`. To restore the cursor to its original text location:

- Saved positions are in pre-edit coordinates
- After the edit, reconstruct each selection: if `insertCol <= originalCol` on the same line → `restoredCol = originalCol + insertLen`; else → unchanged
- Set `editor.selections = [restored selections]`

This is explicit and correct (the VS Code auto-shift already lands at the right spot, but we set it explicitly as requested).

### What will be built

#### 1. `insertTagAtTaskStart(editor, tag)` exported helper in `DatePickerService.ts`

```
/^(\s*-\s+\[[ xX]\]\s+)/
```

Per active cursor:
- Matches: insert `tag + ' '` at `match[1].length` (task text start)
- No match: insert `tag + ' '` at cursor position

After `editor.edit()`, explicitly restore each selection to `originalCol + insertedLength` (if insert was before cursor) or `originalCol` (otherwise).

#### 2. Priority/Waiting slash commands — convert to command-based

All 4 items (`#P1`, `#P2`, `#P3`, `#W`): `insertText = ''`, `command: { command: 'as-notes.insertTaskHashtag', arguments: ['#P1'] }` etc.

#### 3. `as-notes.insertTaskHashtag` new command in `extension.ts`

Calls `insertTagAtTaskStart(editor, tag)`.

#### 4. `insertTaskDueDate()` — call `insertTagAtTaskStart` instead of raw `edit.insert`

### Files changed

- `vs-code-extension/src/DatePickerService.ts`
- `vs-code-extension/src/SlashCommandProvider.ts`
- `vs-code-extension/src/extension.ts`

Confirm or raise any objections before I implement.

[user] Add that the cursor should return to it's original position after the insert

[agent]

## Updated Plan — Insert at task start + cursor restoration

### Root cause (same as before)

- Priority/Waiting tags use `insertText` directly → insert at cursor, which may be mid-line.
- `insertTaskDueDate()` uses `edit.insert(sel.active, tag)` — same issue.

### Cursor restoration analysis

When `edit.insert` places text at task start (position `insertCol`) which is **before** the cursor (at `originalCol`), VS Code automatically shifts the cursor right by `insertLen`. To restore the cursor to its original text location:

- Saved positions are in pre-edit coordinates
- After the edit, reconstruct each selection: if `insertCol <= originalCol` on the same line → `restoredCol = originalCol + insertLen`; else → unchanged
- Set `editor.selections = [restored selections]`

This is explicit and correct (the VS Code auto-shift already lands at the right spot, but we set it explicitly as requested).

### What will be built

#### 1. `insertTagAtTaskStart(editor, tag)` exported helper in `DatePickerService.ts`

```
/^(\s*-\s+\[[ xX]\]\s+)/
```

Per active cursor:
- Matches: insert `tag + ' '` at `match[1].length` (task text start)
- No match: insert `tag + ' '` at cursor position

After `editor.edit()`, explicitly restore each selection to `originalCol + insertedLength` (if insert was before cursor) or `originalCol` (otherwise).

#### 2. Priority/Waiting slash commands — convert to command-based

All 4 items (`#P1`, `#P2`, `#P3`, `#W`): `insertText = ''`, `command: { command: 'as-notes.insertTaskHashtag', arguments: ['#P1'] }` etc.

#### 3. `as-notes.insertTaskHashtag` new command in `extension.ts`

Calls `insertTagAtTaskStart(editor, tag)`.

#### 4. `insertTaskDueDate()` — call `insertTagAtTaskStart` instead of raw `edit.insert`

### Files changed

- `vs-code-extension/src/DatePickerService.ts`
- `vs-code-extension/src/SlashCommandProvider.ts`
- `vs-code-extension/src/extension.ts`

Confirm or raise any objections before I implement.

[user] Agreed

[agent]

## Implementation complete

### Changes made

**`vs-code-extension/src/DatePickerService.ts`**
- Added `TASK_PREFIX_RE = /^(\s*-\s+\[[ xX]\]\s+)/` constant
- Added exported `insertTagAtTaskStart(editor, tag)` helper that:
  - Per cursor: finds task text start with `TASK_PREFIX_RE`, falls back to cursor if not a task line
  - Inserts `tag + ' '` at task start
  - Restores each cursor to its original text position (`origCol + insertLen` if insert was before cursor)
- Updated `insertTaskDueDate()` to call `insertTagAtTaskStart` instead of raw `edit.insert`

**`vs-code-extension/src/SlashCommandProvider.ts`**
- Converted all 4 direct-insert items (#P1, #P2, #P3, #W) to command-based: `insertText = ''`, `command: 'as-notes.insertTaskHashtag'` with tag as argument

**`vs-code-extension/src/extension.ts`**
- Added `insertTagAtTaskStart` to import from `DatePickerService.js`
- Registered `as-notes.insertTaskHashtag` command in `enterFullMode()`

Build verified clean.

[user]

Test feedback:

While hashtags must appear at the start of the tag, new hashtags added by slash commands should appear after all existing hash tags at the start

Slash commands for tasks should only appear in the context of editing a task (i.e. when `- [ ]`, `- [x]`) is present on the line

