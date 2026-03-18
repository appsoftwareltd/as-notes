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

### Date and Time

| Command | What it does |
|---|---|
| **Today** | Inserts a wikilink for today's date -- e.g. `[[2026-03-07]]` |
| **Date Picker** | Opens a date input pre-filled with today. Edit the date (YYYY-MM-DD format) and press Enter to insert it as a wikilink |

### Code

| Command | What it does |
|---|---|
| **Code (inline)** | Inserts `` ` `` `` ` `` with the cursor placed between the backticks |
| **Code (multiline)** | Inserts a fenced code block. The cursor lands after the opening ` ``` ` — type the language identifier (e.g. `js`, `python`) then press Enter |

### Tables *(Pro)*

Table commands are labelled **(Pro)** on the free version. All are fully available with a Pro licence — see [[Encrypted Notes]] for details.

#### Creating a table

| Command | What it does |
|---|---|
| **Table** | Prompts for column and row count, then inserts a formatted markdown table |

#### Modifying an existing table

Place your cursor anywhere inside a table, then use:

| Command | What it does |
|---|---|
| **Table: Format** | Normalises all column widths to the longest cell in each column |
| **Table: Add Column(s)** | Prompts for count, then inserts columns after the cursor's current column |
| **Table: Add Row(s)** | Prompts for count, then inserts rows after the cursor's current row |
| **Table: Remove Row (Current)** | Removes the row at the cursor (refuses to remove the header or separator row) |
| **Table: Remove Column (Current)** | Removes the column at the cursor (refuses if only one column remains) |
| **Table: Remove Row(s) Above** | Prompts for count, removes that many data rows above the cursor (clamps to available) |
| **Table: Remove Row(s) Below** | Prompts for count, removes that many rows below the cursor (clamps to available) |
| **Table: Remove Column(s) Right** | Prompts for count, removes columns to the right of the cursor (clamps to available) |
| **Table: Remove Column(s) Left** | Prompts for count, removes columns to the left of the cursor (clamps, preserves table indentation) |

### Tasks *(task lines only)*

These commands only appear in the slash menu when the cursor is on a task line (`- [ ]` or `- [x]`). Each tag is inserted at the start of the task text — after the checkbox prefix and after any hashtags already present on the line. The cursor returns to its original position after insertion.

| Command | What it does |
|---|---|
| **Task: Priority 1** | Inserts `#P1`. If the line already has a priority tag (`#P1`–`#P9`), it is **replaced** rather than added alongside |
| **Task: Priority 2** | Inserts `#P2`, replacing any existing priority tag |
| **Task: Priority 3** | Inserts `#P3`, replacing any existing priority tag |
| **Task: Waiting** | Inserts `#W` at the task text start |
| **Task: Due Date** | Opens a date input pre-filled with today (YYYY-MM-DD format). On confirm, inserts `#D-YYYY-MM-DD` at the task text start |
| **Task: Completion Date** | Opens a date input pre-filled with today (YYYY-MM-DD format). On confirm, inserts `#C-YYYY-MM-DD` at the task text start |

## Pro Licence

Pro users see clean command names in the menu. Free users see the same commands with **(Pro)** appended.

To enter your licence key, run **AS Notes: Enter Licence Key** from the Command Palette (`Ctrl+Shift+P`), or open VS Code Settings (`Ctrl+,`) and search for `as-notes.licenceKey`. See [[Settings]] for details.
