---
order: 16
---

# Markdown Editing

AS Notes includes several editing tools that help you work with markdown more efficiently. These range from code block completion (free) to table commands (Pro).

## Code Block Completion

Code block completion works in **all** markdown files and does not require a Pro licence.

When you type ` ``` ` (with an optional language identifier, e.g. ` ```javascript `) and press **Enter**, AS Notes automatically inserts the closing ` ``` ` and places the cursor inside the block.

On a bullet line, the content inside the code block is indented to match markdown list continuation rules.

### Balanced Fence Detection

The extension checks whether the opening backticks already have a matching closing fence at the same indentation. If they do, pressing Enter inserts a normal newline instead of a second closing fence.

### Outliner Mode Behaviour

When [[Settings|Outliner Mode]] is active and you press Enter on a closing ` ``` ` line that belongs to a bullet code block, a new bullet is inserted at the parent's indentation level instead of a blank line.

## Table Commands (Pro)

All table commands are Pro features. Free users see them listed in the slash menu with **(Pro)** appended.

Access table commands by typing `/` in any markdown file to open the [[Slash Commands]] menu.

### Creating a Table

| Command | What it does |
|---|---|
| **Table** | Prompts for column and row count, then inserts a formatted markdown table at the cursor |

The generated table includes a header row, separator row, and the requested number of data rows, with columns padded to equal width.

### Formatting

| Command | What it does |
|---|---|
| **Table: Format** | Normalises all column widths in the surrounding table to the longest cell content in each column |

Use this after editing cell content to realign the table. The command finds the table around the cursor and adjusts all column widths.

### Adding Rows and Columns

| Command | What it does |
|---|---|
| **Table: Add Column(s)** | Prompts for a count, then inserts that many columns after the cursor's current column |
| **Table: Add Row(s)** | Prompts for a count, then inserts that many rows after the cursor's current row |

### Removing Rows and Columns

| Command | What it does |
|---|---|
| **Table: Remove Row (Current)** | Removes the row at the cursor. Refuses to remove the header or separator row |
| **Table: Remove Column (Current)** | Removes the column at the cursor. Refuses if only one column remains |
| **Table: Remove Row(s) Above** | Prompts for a count, then removes that many data rows above the cursor (clamps to available rows) |
| **Table: Remove Row(s) Below** | Prompts for a count, then removes that many rows below the cursor (clamps to available rows) |
| **Table: Remove Column(s) Right** | Prompts for a count, then removes columns to the right of the cursor (clamps to available columns) |
| **Table: Remove Column(s) Left** | Prompts for a count, then removes columns to the left of the cursor (clamps to available columns, preserves table indentation) |

## Pro Licence

To unlock table commands:

1. Obtain a licence key from [asnotes.io](https://www.asnotes.io/pricing)
2. Enter your key using one of these methods:
   - Run **AS Notes: Enter Licence Key** from the Command Palette (`Ctrl+Shift+P`)
   - Or open VS Code Settings (`Ctrl+,`), search for `as-notes.licenceKey`, and paste your key there

When active, the status bar shows **AS Notes (Pro)**.
