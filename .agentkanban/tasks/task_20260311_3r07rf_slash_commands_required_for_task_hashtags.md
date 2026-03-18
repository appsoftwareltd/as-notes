---
title: "Slash commands required for task #hashtags"
lane: doing
created: 2026-03-11T10:10:26.590Z
updated: 2026-03-11T15:34:15.976Z
priority: high
sortOrder: 2
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

[agent]

## Plan — Insert after existing hashtags + task-line-only visibility

### Requirement 1: Insert after existing leading hashtags

**Current behaviour:** `insertTagAtTaskStart` inserts at `match[1].length` — always the very start of task text, even if other hashtags are already there.

**Desired:** insert after any existing `#WORD ` tokens at the task text start.

**Fix in `DatePickerService.ts`** — extend `TASK_PREFIX_RE` to also capture leading hashtags:

```
/^(\s*-\s+\[[ xX]\]\s+)((?:#\S+\s+)*)/
```

- Group 1 (`match[1]`): checkbox prefix — `- [ ] ` etc.
- Group 2 (`match[2]`): zero or more existing hashtag tokens — `#P1 #D-2026-03-11 ` etc.

Insert column = `match[1].length + match[2].length`

Fallback (non-task line): insert at cursor (unchanged).

---

### Requirement 2: Task slash commands only on task lines

**Fix in `SlashCommandProvider.ts`** — after computing `range`, check whether the current line is a task line:

```typescript
const isTaskLine = /^\s*-\s+\[[ xX]\]/.test(lineText);
```

The 5 Task items are only pushed to `items` when `isTaskLine` is `true`. No change to non-task commands.

Note: `SlashCommandProvider` already imports from `CompletionUtils`, not `DatePickerService`, so no circular import risk — the regex is defined locally (it's trivial).

---

### Files changed

- `vs-code-extension/src/DatePickerService.ts` — update `TASK_PREFIX_RE` regex and insert column calculation
- `vs-code-extension/src/SlashCommandProvider.ts` — gate Task items behind `isTaskLine` check

Confirm or raise any objections before I implement.

[user] 

[agent]

## Implementation complete

### Changes made

**`vs-code-extension/src/DatePickerService.ts`**
- Replaced `TASK_PREFIX_RE` with a two-group regex:
  ```
  /^(\s*-\s+\[[ xX]\]\s+)((?:#\S+\s+)*)/
  ```
  Insert column = `match[1].length + match[2].length` — places new tag after all existing leading hashtags.

**`vs-code-extension/src/SlashCommandProvider.ts`**
- Added `isTaskLine` check: `const isTaskLine = /^\s*-\s+\[[ xX]\]/.test(lineText);`
- All 5 Task items wrapped in `if (isTaskLine) { ... }` — they only appear in the completion list when the cursor is on a task line.

Build verified clean.

[user]

Test feedback:

If a command is repeated for an existing tag (e.g. we have #P1, but the priority 1 command is used again) - remove that tag. A change of priority is still a replace. #W if command is issued again would be a remove. #D-YYYY-MM-DD would be a replace with the new date if issued again.

While we're doing this, we will add a "completion" date tag. This will work the same as the due date tag, but will will prepend with a 'C' so #C-YYYY-MM-DD. We need this rendered in the task view and same rules applied regarding completion, input of date as the due date control. We will give completion a pastel green colour rather than the yellow used for due date in the task view

[agent]

## Implementation complete

### Changes made

**`vs-code-extension/src/IndexService.ts`**
- Bumped `SCHEMA_VERSION` `2` → `3` (triggers drop-and-rebuild of the derived index)
- Added `completion_date TEXT` column + index to the `tasks` table schema
- Added `completion_date: string | null` to `TaskRow` interface
- Added `completionDate: string | null` to `TaskViewItem` interface
- Updated `parseTaskMeta` regex to capture `#C-YYYY-MM-DD` (group 4); return type now includes `completionDate`
- Updated both `INSERT INTO tasks` calls with `completion_date` parameter
- Updated `getTasksForPage` and `getAllTasksForWebview` SELECT queries to include `completion_date`
- Updated `getAllTasksForWebview` row mapper and `mapTaskRows` for the new column

**`vs-code-extension/src/DatePickerService.ts`**
- Added constants: `EXISTING_WAITING_RE`, `DUE_DATE_TAG_PREFIX_RE`, `EXISTING_DUE_DATE_RE`, `COMPLETION_DATE_TAG_PREFIX_RE`, `EXISTING_COMPLETION_DATE_RE`
- Rewrote `insertTagAtTaskStart` with full toggle/remove/replace/insert logic:
  - Priority same → **remove** tag (plus trailing space)
  - Priority different → **replace** (existing)
  - `#W` present → **remove**; absent → insert
  - `#D-*` exists → **replace** with new date; absent → insert
  - `#C-*` exists → **replace** with new date; absent → insert
  - Cursor restoration handles new `remove` mode
- Added `insertTaskCompletionDate()` — identical to `insertTaskDueDate` but produces `#C-YYYY-MM-DD`

**`vs-code-extension/src/SlashCommandProvider.ts`**
- Added `Task: Completion Date` item (sortText `j-task-completion-date`, fires `as-notes.insertTaskCompletionDate`)

**`vs-code-extension/src/extension.ts`**
- Added `insertTaskCompletionDate` to import from `DatePickerService.js`
- Registered `as-notes.insertTaskCompletionDate` command

**`vs-code-extension/src/webview/tasks.ts`**
- Added `completionDate: string | null` to `TaskViewItem` interface
- Added `buildCompletionDateBadge()` returning a pastel green `.badge-completion` span
- Included completion badge in `buildTask()` alongside the existing badges

**`vs-code-extension/src/webview/tasks.css`**
- Added `.badge-completion` — pastel green using `--vscode-testing-iconPassed` token (`#73c991` fallback)

**Tests**
- 7 new tests (TDD red then green): `parseTaskMeta` for `#C-*`, combined tags, integration tests for `completion_date` storage and `getAllTasksForWebview` mapping
- Updated plain-text `toEqual` test to include `completionDate: null` in expected shape
- 503 tests pass, build clean

[user]

Test feedback:

Can we have a completion date filter button, like Due Date (setting saved like the others)

[agent]

## Implementation complete

### Changes made

**`vs-code-extension/src/webview/tasks.ts`**
- Added `completionDateOnly: boolean` to the `__INITIAL_FILTER_STATE__` declaration
- Added `let completionDateOnly = _savedState?.completionDateOnly ?? false;` state variable
- Updated `saveFilterState()` to include `completionDateOnly` in the posted message
- Added `if (completionDateOnly) { tasks = tasks.filter(t => !!t.completionDate); }` in `getFilteredTasks()`
- Added **COMPLETED** toggle checkbox in toolbar HTML after WAITING ONLY
- Wired up `chk-completion-date-only` change event handler

**`vs-code-extension/src/TaskPanelProvider.ts`**
- `saveFilterState` handler: destructures + persists `completionDateOnly` to `as-notes.taskFilter.completionDateOnly`
- `_buildHtml`: reads `completionDateOnly` from `workspaceState` (default `false`), includes in `initialState` JSON

Build clean.

[user]

Actually - I wanted the completed date button in the task view it to be a group by control (like due date), not a toggle switch

[agent]

## Implementation complete

### Changes made

**`vs-code-extension/src/webview/tasks.ts`**
- `GroupBy` type: added `'completionDate'`
- `GROUP_BY_LABELS`: added `completionDate: 'Completion Date'`
- Added `COMPLETION_BUCKET_ORDER`, `CompletionBucket` type, `COMPLETION_BUCKET_LABELS` (Today / This Week / Earlier / No Completion Date)
- Added `completionDateBucket()` helper (diff=0->today, diff>-7->this-week, else->earlier)
- Removed `completionDateOnly` state variable, `__INITIAL_FILTER_STATE__` field, `saveFilterState` field, and `getFilteredTasks` filter line
- Added `renderByCompletionDate()` grouping renderer - groups by recency, sorts most-recent first, shows page name
- Added `case 'completionDate': return renderByCompletionDate(tasks);` in `buildTaskListHtml()`
- Removed COMPLETED toggle switch HTML and its change event handler

**`vs-code-extension/src/TaskPanelProvider.ts`**
- Removed `completionDateOnly` from `saveFilterState` message handler
- Removed `completionDateOnly` read from workspaceState and embed in `initialState` JSON

Build clean. Completion date is now a GROUP BY pill (Page / Priority / Due Date / Completion Date). COMPLETED toggle removed.

[user]

I need to add an amendment to the instruction from line 163:

> Add that the cursor should return to it's original position after the insert

Becomes:

> Add that the cursor should return to it's original position after the insert, unless that position leaves the cursor before the end of the last #hashtag after insert / change, and then it should be moved to the end of the line

[user]

After adding / editing any task hash tags, there should be a single space character between the task square brackets, each of the hash tags and the task text

[user]

Test issue - if I create a Priority 1 right after the checkbox, the cursor moves to before the #P1 - this breaks the requirement to ensure that cursor is always after all hashtags

```
- [ ] /p1
- [ ] #P1
```

