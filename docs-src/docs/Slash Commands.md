---
order: 7
---

# Slash Commands

Type `/` in any markdown file to open the slash command menu. The menu appears inline and lets you quickly insert content or run table operations without leaving the keyboard.

## Using the Menu

1. Type `/` on any line
2. The menu appears immediately
3. Keep typing to filter — the list narrows as you type
4. Press `Enter` or click to run a command
5. Press `Escape` (or type a non-matching character) to dismiss — the `/` stays in your document as-is

Slash commands are suppressed inside fenced code blocks, inline code spans, and YAML front matter.

## Available Commands

### Standard Commands

| Command | What it does |
|---|---|
| **Today** | Inserts a wikilink for today's date -- e.g. `[[2026-03-07]]` |
| **Date Picker** | Opens a date input pre-filled with today. Edit the date (YYYY-MM-DD format) and press Enter to insert it as a wikilink |
| **Code (inline)** | Inserts `` ` `` `` ` `` with the cursor placed between the backticks |
| **Code (multiline)** | Inserts a fenced code block. The cursor lands after the opening ` ``` ` -- type the language identifier (e.g. `js`, `python`) then press Enter |

### Publishing Commands *(front matter)*

These commands toggle or cycle publishing-related fields in the file's YAML front matter. See [[Publishing a Static Site]] for details.

| Command | What it does |
|---|---|
| **Public** | Toggles `public: true` / `public: false` in front matter |
| **Layout** | Cycles `layout` through `docs`, `blog`, and `minimal` in front matter |
| **Retina** | Toggles `retina: true` / `retina: false` in front matter |
| **Assets** | Toggles `assets: true` / `assets: false` in front matter |

### Kanban Card Commands *(kanban card files only)*

This command only appears when editing a kanban card file (`kanban/card_*.md`).

| Command | What it does |
|---|---|
| **Card: Entry Date** | Inserts a `## entry YYYY-MM-DD` heading at the cursor, pre-filled with today's date |

### Task Commands *(task lines only)*

These commands only appear in the slash menu when the cursor is on a task line (`- [ ]` or `- [x]`). Each tag is inserted at the start of the task text -- after the checkbox prefix and after any hashtags already present on the line. The cursor returns to its original position after insertion.

| Command | What it does |
|---|---|
| **Task: Priority 1** | Inserts `#P1`. If the line already has a priority tag (`#P1`--`#P9`), it is **replaced** rather than added alongside |
| **Task: Priority 2** | Inserts `#P2`, replacing any existing priority tag |
| **Task: Priority 3** | Inserts `#P3`, replacing any existing priority tag |
| **Task: Waiting** | Toggles `#W` at the task text start (inserts if absent, removes if present) |
| **Task: Due Date** | Opens a date input pre-filled with today (YYYY-MM-DD format). On confirm, inserts `#D-YYYY-MM-DD` at the task text start. Replaces any existing due date tag |
| **Task: Completion Date** | Opens a date input pre-filled with today (YYYY-MM-DD format). On confirm, inserts `#C-YYYY-MM-DD` at the task text start. Replaces any existing completion date tag |
| **Convert to Kanban Card** *(Pro)* | Marks the task as done, creates a Kanban card in the **TODO** lane with the task title (stripped of tags), matching priority and due date, and the **Waiting** flag set. Only available on unchecked tasks |

Priority and waiting tags toggle: issuing the same tag again removes it. Issuing a different priority replaces the existing one. Due date and completion date tags replace any existing tag of the same type.

### Pro Commands

Pro commands are available with a Pro licence. Free users see them listed with **(Pro)** appended in the menu.

| Command | What it does |
|---|---|
| **Template** | Opens a quick-pick list of templates from the templates folder and inserts the selected template at the cursor. Supports placeholders -- see [[Settings]] for template folder configuration |
| **Table** | Prompts for column and row count, then inserts a formatted markdown table |
| **Table: Format** | Normalises all column widths to the longest cell in each column |
| **Table: Add Column(s)** | Prompts for count, then inserts columns after the cursor's current column |
| **Table: Add Row(s)** | Prompts for count, then inserts rows after the cursor's current row |
| **Table: Remove Row (Current)** | Removes the row at the cursor (refuses to remove the header or separator row) |
| **Table: Remove Column (Current)** | Removes the column at the cursor (refuses if only one column remains) |
| **Table: Remove Row(s) Above** | Prompts for count, removes that many data rows above the cursor (clamps to available) |
| **Table: Remove Row(s) Below** | Prompts for count, removes that many rows below the cursor (clamps to available) |
| **Table: Remove Column(s) Right** | Prompts for count, removes columns to the right of the cursor (clamps to available) |
| **Table: Remove Column(s) Left** | Prompts for count, removes columns to the left of the cursor (clamps, preserves table indentation) |

## Pro Licence

Pro users see clean command names in the menu. Free users see the same commands with **(Pro)** appended.

To enter your licence key, run **AS Notes: Enter Licence Key** from the Command Palette (`Ctrl+Shift+P`), or open VS Code Settings (`Ctrl+,`) and search for `as-notes.licenceKey`. See [[Settings]] for details.
