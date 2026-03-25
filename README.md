# AS Notes (Personal Knowledge Management VS Code Extension)

Website: [asnotes.io](https://www.asnotes.io) | Developer: [App Software Ltd](https://www.appsoftware.com) | [Discord](https://discord.gg/QmwY57ts) | [Reddit](https://www.reddit.com/r/AS_Notes/) | [X](https://x.com/AppSoftwareLtd)

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/appsoftwareltd.as-notes?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![License](https://img.shields.io/badge/license-Elastic--2.0-lightgrey)](https://github.com/appsoftwareltd/as-notes/blob/main/LICENSE)
[![CI](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml)

|||
|--|--|
|Install | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)|
|Pro Features | [asnotes.io/pricing](https://www.asnotes.io)|
|Docs | [docs.asnotes.io](https://docs.asnotes.io)|
|Blog | [blog.asnotes.io](https://blog.asnotes.io)|

## What is AS Notes?

AS Notes brings [[wikilink]] style note-taking (and much more) directly into VS Code. Capture ideas, link concepts, and stay focused - without ever leaving your editor.

(1 minute introduction video)

[![AS Notes demo](https://img.youtube.com/vi/bwYopQ1Sc5o/maxresdefault.jpg)](https://www.youtube.com/watch?v=bwYopQ1Sc5o)

(1 minute demo video)

[![AS Notes demo](https://img.youtube.com/vi/liRULtb8Rm8/maxresdefault.jpg)](https://youtu.be/liRULtb8Rm8)

## Why VS Code?

Many of us spend a lot of time in VS Code and using VS Code as your main notes application gives you so much for free, even before using **AS Notes** features:

- Cross platform + Web (via Workspaces)
- UI features such as Tabs, File Explorer, Themes
- Huge extension library that can be used along side AS Notes (Mermaid diagramming, Vim etc)
- AI Chat (GitHub CoPilot / Claude etc.) you can use to work with your notes
- Multiline editing Outliner functionality via `Ctrl + [ / ]`
- Code highlighting
- And all of the many features that VS Code has

## Features

### General

- Privacy focused - does not send your data anywhere
- Version control friendly (Git & GitOps)
- Lightweight indexing of your notes (local sqlite3 WASM)

- Performant on large (~20k markdown files) knowledge bases

### Wikilinks

- Logseq / Roam / Obsidian style `[[wikilinks]]` with nested link support e.g. `[[[[AS Notes]] Page]]`
- Links resolve to the target page anywhere in your workspace
- Renaming a link updates the target file and all matching references
- Automatic wikilink / file rename tracking

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/wikilinks.png" alt="AS Notes backlinks wikilinks" style="max-height:200px; margin-top: 10px">

### Task Management

Toggle markdown TODOs with a keyboard shortcut:

```
- [ ] Marker for todo added
- [x] Marker for todo marked done
Marker for todo removed
```

`Ctrl+Shift+Enter` (Windows/Linux) / `Cmd+Shift+Enter` (macOS)

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/todopanel.png" alt="AS Notes todo panel" style="max-height:130px; margin-top: 10px; margin-bottom: 10px;">

#### Task Metadata Tags

Add structured hashtag metadata anywhere in a task line to categorise and organise tasks. Tags are stripped from the displayed task text — only the clean description is shown.

| Tag | Description |
|---|---|
| `#P1` | Priority 1 — Critical |
| `#P2` | Priority 2 — High |
| `#P3` | Priority 3 — Normal |
| `#W` | Waiting — task is blocked or waiting on someone/something |
| `#D-YYYY-MM-DD` | Due date — e.g. `#D-2026-03-15` |
| `#C-YYYY-MM-DD` | Completion date — e.g. `#C-2026-03-15` |

Tags can be placed anywhere on the task line:

```markdown
- [ ] #P1 Fix the critical production bug
- [ ] #P2 #W Waiting on design sign-off for the new dashboard #D-2026-03-20
- [ ] #D-2026-03-10 Submit the quarterly report
```

Multiple tags can be combined. Only one priority tag is used — if more than one is present, the first wins.

#### Task Managemnt

The **AS Notes** activity bar icon opens the Tasks sidebar, which shows all tasks across your entire workspace.

**Group By** — choose how tasks are grouped:

| View | Description |
|---|---|
| **Page** | Tasks grouped alphabetically by source page |
| **Priority** | Tasks grouped by priority level (P1 → P2 → P3 → No Priority), sorted by due date within each group |
| **Due Date** | Tasks grouped into buckets: Overdue / Today / This Week / Later / No Due Date |
| **Completion Date** | Tasks grouped into buckets: Completed Today / This Week / Earlier / No Completion Date |

**Filters:**

- **TODO ONLY** — show only incomplete tasks (default on)
- **WAITING ONLY** — show only tasks tagged `#W`
- **Filter by page** — type to narrow tasks to pages whose name contains the search text (case-insensitive)

### Backlinks Panel

`Ctrl+Alt+B` (Windows/Linux) / `Cmd+Alt+B` (macOS)

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/backlinks.png" alt="AS Notes backlinks panel" style="max-height:400px; margin-top: 10px">

### Kanban Board

AS Notes has a built in Kanban board backed by markdown files that can be used and edited just like any other page under AS Notes.

### Daily Journal

Press **Ctrl+Alt+J** (Cmd+Alt+J on macOS) to create or open today's daily journal page.

Journal files are created as `YYYY-MM-DD.md` in a dedicated `journals/` folder (configurable). New pages are generated from the `Journal.md` template in the templates folder (default: `templates/`). Edit `Journal.md` to add your own sections and prompts. All template placeholders are supported -- see [Templates](#templates).

A **Calendar** panel in the sidebar shows the current month with journal indicators. Click any day to open its journal entry. See [Calendar](#calendar) for details.

> **Note:** Daily journal requires an initialised workspace (`.asnotes/` directory). See [Getting started](#getting-started).

### Slash Commands

Type `/` in any markdown file to open a quick command menu. The following commands are available:

| Command | Action |
|---|---|
| **Today** | Inserts a wikilink for today's date, e.g. `[[2026-03-06]]` |
| **Date Picker** | Opens a date input box pre-filled with today's date — edit the date or press Enter to insert it as a wikilink |
| **Code (inline)** | Inserts `` ` `` `` ` `` with the cursor placed between the backticks |
| **Code (multiline)** | Inserts a fenced code block with the cursor after the opening ` ``` ` -- type the language identifier (e.g. `js`) then press Enter |
| **Template** | Opens a quick-pick list of templates from the templates folder and inserts the selected template at the cursor. Supports placeholders (see [Templates](#templates)) |
| **Table** | Prompts for column and row count, then inserts a formatted markdown table |
| **Table: Add Column(s)** | Prompts for count, then adds columns after the cursor's current column in the surrounding table |
| **Table: Add Row(s)** | Prompts for count, then adds rows after the cursor's current row in the surrounding table |
| **Table: Format** | Normalises all column widths in the surrounding table to the longest cell content |
| **Table: Remove Row (Current)** | Removes the row at the cursor (refuses header/separator) |
| **Table: Remove Column (Current)** | Removes the column at the cursor (refuses single-column tables) |
| **Table: Remove Row(s) Above** | Prompts for count, then removes data rows above the cursor (clamps to available) |
| **Table: Remove Row(s) Below** | Prompts for count, then removes rows below the cursor (clamps to available) |
| **Table: Remove Column(s) Right** | Prompts for count, then removes columns to the right of the cursor (clamps to available) |
| **Table: Remove Column(s) Left** | Prompts for count, then removes columns to the left of the cursor (clamps to available, preserves indent) |

Table commands are labelled **(Pro)** for free users. Template and table commands are Pro features -- free users see them listed with **(Pro)** appended.

#### Task Commands *(task lines only)*

The following commands only appear in the slash menu when the cursor is on a task line (`- [ ]` or `- [x]`). Tags are inserted after the checkbox and after any existing hashtags already on the line.

| Command | Action |
|---|---|
| **Task: Priority 1** | Inserts `#P1` at the start of the task text. Replaces any existing priority tag (`#P1`–`#P9`) on the line |
| **Task: Priority 2** | Inserts `#P2`, replacing any existing priority tag |
| **Task: Priority 3** | Inserts `#P3`, replacing any existing priority tag |
| **Task: Waiting** | Toggles `#W` at the start of the task text (inserts if absent, removes if present) |
| **Task: Due Date** | Opens a date input pre-filled with today (YYYY-MM-DD). Confirms and inserts `#D-YYYY-MM-DD` at the start of the task text. Replaces any existing due date tag |
| **Task: Completion Date** | Opens a date input pre-filled with today (YYYY-MM-DD). Confirms and inserts `#C-YYYY-MM-DD` at the start of the task text. Replaces any existing completion date tag |
| **Convert to Kanban Card** *(Pro)* | Marks the task as done, creates a Kanban card in the **TODO** lane with the task title (stripped of tags), matching priority and due date, and the **Waiting** flag set. Only available on unchecked tasks |

Priority and waiting tags toggle: issuing the same tag again removes it. Issuing a different priority replaces the existing one. Due date and completion date tags replace any existing tag of the same type.

The menu appears inline as you type and supports filtering — just keep typing to narrow the list. Press Escape or any non-matching key to dismiss and keep the `/` as-is.

Slash commands are suppressed inside fenced code blocks, inline code spans, and YAML front matter.

### File Drag & Drop / Copy + Paste

Drag files from your file manager onto a markdown editor, or paste images from the clipboard - VS Code's built-in markdown editor handles the copy and link insertion automatically.

AS Notes configures the built-in `markdown.copyFiles.destination` workspace setting so that dropped/pasted files are saved to a dedicated asset folder instead of next to your markdown file.

| Setting | Default | Description |
|---|---|---|
| `as-notes.assetPath` | `assets/images` | Workspace-relative folder where dropped/pasted files are saved |

The setting is applied automatically when AS Notes initialises or the value changes. The destination folder is created by VS Code on first use.

**Tips:**

- **Drag position indicator:** Hold **Shift** while dragging a file to see a cursor position guide before releasing - useful for placing the link precisely within your text.

### Image Hover Preview

Hover over any image link in a markdown file to see a preview of the image inline. This is provided by VS Code's built-in markdown extension and requires no configuration - it works with both standard `![alt](path)` links and dropped/pasted images.

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/image-preview.png" alt="AS Notes Image Preview" style="max-height:300px; margin-top: 10px; margin-bottom: 10px;">

### Compatibility With Other Markdown PKMS

AS Notes can work alongside knowledge bases created in Obsidian or Logseq due to similar file structures. Be aware there are format and behavioural differences differences however.

### Outliner Mode

Enable **Outliner Mode** (`as-notes.outlinerMode` setting or the **AS Notes: Toggle Outliner Mode** command) to turn the editor into a bullet-first outliner. Every line begins with `-` and custom keybindings keep you in flow:

| Key | Action |
|---|---|
| **Enter** | Inserts a new bullet at the same indentation. Todo lines (`- [ ]`) continue as unchecked todos. |
| **Tab** | Indents the bullet one level (capped at one level deeper than the bullet above). |
| **Shift+Tab** | Outdents the bullet one level. |
| **Ctrl+Shift+Enter** | Cycles: plain bullet → `- [ ]` → `- [x]` → plain bullet. |
| **Ctrl+V / Cmd+V** | Multi-line paste: each clipboard line becomes a separate bullet. |

#### Code Block Completion

Code block completion works in **all** markdown files — outliner mode is not required.

When you type `` ``` `` (with optional language, e.g. `` ```javascript ``) and press **Enter**, AS Notes automatically inserts the closing `` ``` `` and places the cursor inside the block. On a bullet line the content is indented to match markdown list continuation.

The extension is aware of existing fence pairs: if the backticks are already balanced (i.e. there is a matching closing fence at the same indentation), Enter simply inserts a newline instead of a second skeleton.

In outliner mode, pressing Enter on a closing `` ``` `` line that belongs to a bullet code block inserts a new bullet at the parent's indentation.

### Inline Editor (Syntax Shadowing)

AS Notes includes a built-in inline Markdown editor that renders formatting directly in the text editor, similar to Typora. Standard Markdown syntax characters (`**`, `##`, `[]()`, etc.) are replaced with their visual equivalents as you write.

**Three-state visibility:**

| State | When | What you see |
|---|---|---|
| **Rendered** | Cursor is elsewhere | Clean formatted text (syntax hidden) |
| **Ghost** | Cursor is on the line | Syntax characters at reduced opacity |
| **Raw** | Cursor is inside the construct | Full Markdown source |

**Supported constructs:**

Bold, italic, strikethrough, headings (H1-H6), inline code, links, images, blockquotes, horizontal rules, unordered/task lists, code blocks (with language labels), YAML frontmatter, GFM tables, emoji shortcodes (`:smile:` etc.), Mermaid diagrams (inline SVG), LaTeX/math (KaTeX/MathJax), GitHub mentions and issue references.

**Toggle:** Use the **AS Notes: Toggle Inline Editor** command or click the eye icon in the editor title bar. The toggle state is persisted per workspace.

**Outliner mode awareness:** When outliner mode is active, bullet markers and checkbox syntax are never hidden, ensuring the outliner structure is always visible.

| Setting | Default | Description |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | Enable/disable inline rendering |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | Opacity for ghost-state syntax characters |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | Open links with a single click (instead of Ctrl+Click) |

See [Settings](#settings) for the full list of inline editor settings.

> Based on [markdown-inline-editor-vscode](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode) by SeardnaSchmid (MIT licence).

## AS Notes Pro Features

A **Pro licence** unlocks premium features. When a valid key is active the status bar shows **AS Notes (Pro)**.

To obtain a licence key, visit [asnotes.io](https://www.asnotes.io/pricing)

**Entering your licence key:**

- Run **AS Notes: Enter Licence Key** from the Command Palette (`Ctrl+Shift+P`) — the quickest way.
- Or open VS Code Settings (`Ctrl+,`), search for `as-notes.licenceKey`, and paste your key there.

### Templates

Create reusable note templates as markdown files in a dedicated templates folder (default: `templates/`). Insert them anywhere via the `/Template` slash command.

**Setup:** Templates are created automatically when you initialise a workspace. A default `Journal.md` template is included for daily journal entries.

**Creating templates:** Add any `.md` file to the templates folder. Subdirectories are supported -- templates in subfolders appear as `folder/name` in the picker.

**Inserting a template:** Type `/` in any markdown file, select **Template**, then pick from the list. The template content is inserted at the cursor position with all placeholders replaced.

**Placeholders:**

| Placeholder        | Description                                                    | Example                               |
|--------------------|----------------------------------------------------------------|---------------------------------------|
| `{{date}}`         | Current date (YYYY-MM-DD)                                      | `2026-03-18`                          |
| `{{time}}`         | Current time (HH:mm:ss)                                        | `14:30:45`                            |
| `{{datetime}}`     | Full date and time (YYYY-MM-DD HH:mm:ss)                       | `2026-03-18 14:30:45`                 |
| `{{filename}}`     | Current file name without extension                            | `My Page`                             |
| `{{title}}`        | Alias for `{{filename}}`                                       | `My Page`                             |
| `{{cursor}}`       | Cursor position after insertion                                | *(cursor lands here)*                 |
| Custom date format | Any combination of `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` tokens | `{{DD/MM/YYYY}}` becomes `18/03/2026` |

To output a literal `{{date}}` in the template, escape with a backslash: `\{{date}}`.

**Journal template:** The file `Journal.md` in the templates folder is used as the template for new daily journal entries. Edit it to customise future journal pages.

### Table commands

All table operations in the slash command menu (`/`) are Pro features. Free users see them listed with **(Pro)** appended -- they are visible but blocked until a licence is active.

See [Slash Commands](#slash-commands) for the full list of table commands.

### Create Note

Run **AS Notes: Create Note** from the Command Palette to create a new note. You will be prompted for a title and the file is created in the configured notes folder (default: `notes/`).

### Encrypted notes

Pro users can store sensitive notes in encrypted files. Any file with the `.enc.md` extension is treated as an encrypted note - it is excluded from the search index and never read as plain text by the extension.

**Getting started with encryption:**

1. Run **AS Notes: Set Encryption Key** from the Command Palette. Your passphrase is stored securely in the OS keychain (VS Code SecretStorage) - it is never written to disk or settings files.
2. Create an encrypted note with **AS Notes: Create Encrypted Note** (or **AS Notes: Create Encrypted Journal Note** for a dated journal entry).
3. Write your note in the editor. When you want to lock it, run **AS Notes: Encrypt [All|Current] Note(s)** - all plaintext `.enc.md` files will be encrypted in place.
4. To read a note, run **AS Notes: [All|Current] Note(s)** - files are decrypted in place using your stored passphrase.

**Encryption details:**

- Algorithm: AES-256-GCM with a per-encryption random 12-byte nonce
- Key derivation: PBKDF2-SHA256 (100,000 iterations) from your passphrase
- File format: a single-line `ASNOTES_ENC_V1:<base64url payload>` marker - used to help prevent accidental commits via a Git pre-commit hook.

**Commands:**

- `AS Notes: Set Encryption Key` - save passphrase to OS keychain
- `AS Notes: Clear Encryption Key` - remove the stored passphrase
- `AS Notes: Create Encrypted Note` - create a new named `.enc.md` file in the notes folder
- `AS Notes: Create Encrypted Journal Note` - create today's journal entry as `.enc.md`
- `AS Notes: Encrypt All Notes` - encrypt all plaintext `.enc.md` files
- `AS Notes: Decrypt All Notes` - decrypt all encrypted `.enc.md` files
- `AS Notes: Encrypt Current Note` - encrypt the active `.enc.md` file (reads unsaved editor content)
- `AS Notes: Decrypt Current Note` - decrypt the active `.enc.md` file (reads from disk)

## VS Code Marketplace

[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)

## Getting started

For a sample knowledge base, clone <https://github.com/appsoftwareltd/as-notes-demo-notes> and follow the instructions there to initialise.

### Initialise a workspace

AS Notes activates when it finds a `.asnotes/` directory in your workspace root or configured `rootDirectory` subdirectory (similar to `.git/` or `.obsidian/`). Without it, the extension runs in **passive mode** -- commands show a friendly notification prompting you to initialise, and the status bar invites you to set up.

To initialise:

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **AS Notes: Initialise Workspace**

This creates the `.asnotes/` directory, builds a SQLite index of all markdown files, and activates all features. The index file (`.asnotes/index.db`) is excluded from git by an auto-generated `.gitignore`.

### Using AS Notes alongside source code

AS Notes works well as a knowledge base inside a software project. You can keep notes, journals, and documentation in a subdirectory (e.g. `docs/` or `notes/`) while the rest of the repository contains source code. When a root directory is configured, all AS Notes features (wikilink highlighting, completions, hover tooltips, slash commands) are scoped to that directory. Markdown files outside it, such as a `README.md` at the workspace root, are completely unaffected.

During initialisation, the **Initialise Workspace** command will ask you to choose a location:

- **Workspace root** - the default, uses the entire workspace
- **Choose a subdirectory** - opens a folder picker scoped to your workspace

The chosen path is saved as the `as-notes.rootDirectory` workspace setting. When set, all AS Notes data lives inside that directory: `.asnotes/`, `.asnotesignore`, journals, templates, notes, kanban boards, and the index. Scanning, file watching, and indexing are scoped to this directory so files outside it are unaffected.

If `as-notes.rootDirectory` is already configured before you run **Initialise Workspace**, the command uses the configured path directly.

> **Warning:** If you change `rootDirectory` after initialisation, you must manually move the notes directory (including `.asnotes/`) to the new location and reload the window. The extension will show a warning when the setting changes.

### Rebuild the index

If the index becomes stale or corrupted, run **AS Notes: Rebuild Index** from the Command Palette. This drops and recreates the entire index with a progress indicator.

### Clean workspace

If the extension is in a bad state (e.g. persistent WASM errors after a crash), run **AS Notes: Clean Workspace** from the Command Palette. This:

- Removes the `.asnotes/` directory (index database, logs, git hook config)
- Releases all in-memory state and switches to passive mode

`.asnotesignore` at the AS Notes root is intentionally preserved. Run **AS Notes: Initialise Workspace** afterwards to start fresh.

### Excluding files from the index

When AS Notes initialises a workspace it creates a `.asnotesignore` file at the AS Notes root directory. This file uses [`.gitignore` pattern syntax](https://git-scm.com/docs/gitignore) and controls which files and directories are excluded from the AS Notes index.

**Default contents:**

```
# Logseq metadata and backup directories
logseq/

# Obsidian metadata and trash directories
.obsidian/
.trash/
```

Patterns without a leading `/` match at any depth - `logseq/` excludes `logseq/pages/foo.md` and `vaults/work/logseq/pages/foo.md` equally. Prefix with `/` to anchor a pattern to the AS Notes root only (e.g. `/logseq/`).

Edit `.asnotesignore` at any time. AS Notes watches the file and automatically re-scans the index when it changes - newly ignored files are removed from the index and un-ignored files are added.

> **Note:** `.asnotesignore` is a user-editable, version-controlled file. AS Notes will never overwrite it after initial creation.

## Features

### Wikilink highlighting

Every `[[wikilink]]` in a markdown file is highlighted in blue. When your cursor is inside a link, that specific link is highlighted with a brighter blue, bold, and underlined - so you always know which link you're about to interact with.

### Nested wikilinks

Links can contain other links:

```markdown
[[Specific [[Topic]] Details]]
[[Specific [[[[Topic]] Variant]] Details]]
```

This creates **three** navigable targets:

| You click on... | You navigate to... |
|---|---|
| `[[Topic]]` | `Topic.md` |
| `[[Specific` or `Details]]` (the outer portions) | `Specific [[Topic]] Details.md` |
| `[[[[Topic]] Variant]]` (the outer portions) | `[[Topic]] Variant.md` |

Nesting works to arbitrary depth. The extension always identifies the innermost link under your cursor for highlighting, hover, and click targets.

### Click navigation

**Ctrl+Click** (Cmd+Click on macOS) on any wikilink to open the target `.md` file. Links resolve globally across the workspace (see [Subfolder link resolution](#subfolder-link-resolution)).

### Auto-create missing pages

Navigating to a page that doesn't exist creates it automatically in the configured notes folder (default: `notes/`). You can write forward-references before the target page exists.

When `as-notes.createNotesInCurrentDirectory` is enabled, new pages are created in the current editing file's directory instead, unless the source file is in the journal folder (in which case the notes folder is always used).

### Hover tooltips

Hover over any wikilink to see:

- The target filename (e.g. `My Page.md`)
- Whether the file already exists or will be created on click
- The number of backlinks (other pages that link to this target)

### Link rename synchronisation

When you edit a wikilink's text and move your cursor away (or switch files), AS Notes detects the change and offers to:

1. **Rename the corresponding `.md` file** (if it exists)
2. **Update every matching link** across all markdown files in the workspace

A single confirmation dialog covers all affected nesting levels. For example, editing `[[Inner]]` inside `[[Outer [[Inner]] text]]` offers to rename both the inner and outer pages.

You can decline - the link text change is kept but files and other links are left untouched.

### Case-insensitive file matching

`[[my page]]` resolves to `My Page.md` regardless of OS. On case-sensitive filesystems (Linux), a directory scan finds the match. On Windows and macOS the filesystem handles it natively.

### Filename sanitisation

Invalid filename characters (`/ ? < > \ : * | "`) are replaced with `_`:

```markdown
[[What is 1/2 + 1/4?]]  →  What is 1_2 + 1_4_.md
```

### Page aliases

Define alternative names for a page using YAML front matter at the top of any markdown file:

```yaml
---
aliases:
  - Short Name
  - Another Name
---
```

Or inline array style:

```yaml
---
aliases: [Short Name, Another Name]
---
```

Linking to `[[Short Name]]` or `[[Another Name]]` navigates to the page that declares those aliases - no extra file is created.

- **Hover tooltips** show alias resolution: `Short Name.md → ActualPage.md`
- **Rename tracking** is alias-aware - editing an alias link offers to update front matter and all matching references
- **Backlink counts** include both direct and alias references
- Alias values are plain strings; accidental `[[` / `]]` brackets are stripped automatically

### Subfolder link resolution

Wikilinks resolve globally across the workspace, not just in the current directory. The extension uses the persistent index to find matching files anywhere in the folder tree.

**Resolution order:**

1. **Direct filename match** - `[[My Page]]` finds `My Page.md` anywhere in the workspace
2. **Alias match** - if no file matches, check page aliases
3. **Auto-create** - if nothing matches, create the file in the same directory as the source

**Disambiguation** - when multiple files share the same name (e.g. `notes/Topic.md` and `archive/Topic.md`):

1. A file in the **same directory** as the source always wins
2. Otherwise, the **closest folder** is preferred (measured by directory distance)

### Wikilink autocomplete

Type `[[` in any markdown file to trigger autocomplete, listing all indexed pages and aliases. The list filters as you type.

- **Page suggestions** show the page name (without `.md`), with folder paths for disambiguation when names collide
- **Alias suggestions** show the alias with an arrow to the canonical page (e.g. `→ ActualPage`)
- **Auto-close** - selecting a suggestion inserts the name and appends `]]`
- **Nested wikilinks** - `[[` inside an unclosed `[[...` starts a new autocompletion for the inner link
- Completions are **suppressed inside front matter** blocks

### Persistent index

AS Notes maintains a SQLite database (`.asnotes/index.db`) that indexes all markdown files in the workspace. The index tracks:

- **Pages** - file paths, filenames, titles (extracted from the first `# heading`)
- **Links** - every wikilink in every file, with line, column, nesting depth, and parent references
- **Aliases** - alternative names declared in YAML front matter, with sanitised filenames
- **Backlinks** - reverse lookups for hover tooltips (including alias references)

The index is kept up-to-date automatically:

- On file save, create, delete, or rename
- On editor switch (captures unsaved edits)
- Via a configurable periodic background scan

### Todo toggle

Press **Ctrl+Shift+Enter** (Cmd+Shift+Enter on macOS) on any line in a markdown file to cycle through todo states:

| Current state | After toggle |
|---|---|
| `buy milk` | `- [ ] buy milk` |
| `- [ ] buy milk` | `- [x] buy milk` |
| `- [x] buy milk` | `buy milk` |

- **List-aware:** `- some text` becomes `- [ ] some text` (no re-wrapping)
- **Indentation preserved:** works correctly on indented/nested lines
- **Multi-cursor:** each cursor's line is toggled independently
- **Configurable keybinding:** search for "AS Notes: Toggle Todo" in **Keyboard Shortcuts** (`Ctrl+K Ctrl+S`)

### Tasks panel

The **AS Notes Tasks** panel appears in the Explorer sidebar when the workspace is initialised. It provides a tree view of all todo items across your markdown files, grouped by page.

- **Show TODO only** (default: on) - filters the list to show only unchecked (`- [ ]`) tasks. Toggle this with the filter icon in the panel title bar or via the **AS Notes: Toggle Show TODO Only** command.
- **Click to navigate** - clicking a task opens the file and scrolls to the exact line.
- **Inline toggle** - each task has a check button that toggles its done/todo state directly from the panel, without stealing focus from your active editor.
- **Keyboard shortcut** - press `Ctrl+Alt+T` (Cmd+Alt+T on macOS) to toggle the task panel's visibility.
- **Live sync** - the panel refreshes automatically on file save, edit, create, delete, rename, todo toggle, and periodic background scans.

### Backlinks panel

The **Backlinks** panel shows all incoming links to a target page. Open it with `Ctrl+Alt+B` (Cmd+Alt+B on macOS) for the active file, or right-click any wikilink and choose **"View Backlinks"** to see backlinks for that specific page (including forward references to pages that don't exist yet).

Every backlink is displayed as a **chain** - the full outline context path from root to the link. A standalone mention (with no outline nesting) is simply a chain of length 1.

#### View modes

The panel supports two view modes, toggled via a button in the panel header:

- **Flat by page** (default) - all backlink instances sorted alphabetically by source page name. Gives a linear timeline view where journal files sort chronologically.
- **Grouped by chain** - backlinks grouped by their chain pattern (the sequence of page names), with collapsible headers. Useful for concept-based exploration.

The default mode is configured via `as-notes.backlinkGroupByChain` (default `false`).

A separate toggle controls **context verbosity** - compact (single-line, truncated) or wrapped (full text visible). Default configured via `as-notes.backlinkWrapContext` (default `false`).

#### Chain-first display

- **Pattern grouping** - backlinks are grouped by their chain pattern (e.g. all `[[Project]] → [[Tasks]] → [[NGINX]]` from different files appear in one group).
- **Standalone mentions** - direct `[[wikilink]]` references appear as single-link chains, sorted first.
- **Outline context** - if a wikilink is indented below another wikilink, the full hierarchy is shown as a chain (e.g. `Page A → Page B → Page C`), with each link clickable.
- **Per-link line numbers** - each chain link shows its line number (e.g. `[L12]`) for precise navigation.
- **Line context** - each chain instance shows the surrounding line text with the wikilink highlighted, giving immediate context without opening the file.
- **Case-insensitive grouping** - `[[server]]` and `[[Server]]` produce the same chain pattern.

#### Context menu - View Backlinks

Right-click any wikilink in the editor to open backlinks for that specific page:

- Works with aliases - if the wikilink targets an alias, backlinks for the canonical page are shown.
- Works with forward references - pages that don't exist yet still show any incoming links.

---

**Common features:**

- **Alias-aware** - includes links that target the page via its aliases, not just direct filename references.
- **Live sync** - the panel auto-updates when you switch files, save, or when the index changes.
- **Editor-side display** - opens beside your active editor, giving you a spacious view of backlink context.
- **Collapsible groups** - click a chain group header to expand or collapse its instances.

### Daily journal

Press **Ctrl+Alt+J** (Cmd+Alt+J on macOS) to create or open today's daily journal. The extension creates a dated markdown file in a dedicated journal folder - one file per day.

- **Filename format:** `YYYY-MM-DD.md` (e.g. `2026-03-02.md`)
- **Journal folder:** defaults to `journals/` (configurable via `as-notes.journalFolder`)
- **Template-based:** new files are created from `Journal.md` in the templates folder (`templates/` by default). All template placeholders are supported. Edit `Journal.md` to customise future pages.
- **Auto-setup:** the journal folder and default `Journal.md` template are created on workspace initialisation
- **Instant indexing:** new journal files are indexed immediately for wikilink completion and backlinks
- **Idempotent:** pressing the shortcut again on the same day opens the existing file

> **Migrating from an earlier version or another PKMS?** If you have existing journal files in the `YYYY_MM_DD.md` format (e.g. from Logseq), run the command `AS Notes: DANGER (Back up first): Rename 'YYYY_MM_DD.md' journal files to 'YYYY-MM-DD.md' format` from the command palette (`Ctrl+Shift+P`) to batch-rename them.

### Calendar

The **Calendar** panel appears in the AS Notes sidebar, showing a month grid for quick journal navigation.

- **Month view** - displays the current month on activation, with Monday as the start of the week
- **Today highlight** - the current day is visually prominent (accent colour circle)
- **Journal indicators** - days with existing journal files show a small green dot beneath the date
- **Click to open** - click any day to open (or create) the daily journal for that date, including future dates for pre-planning
- **Month navigation** - arrow buttons step through months
- **Keyboard shortcut** - press `Ctrl+Alt+C` (Cmd+Alt+C on macOS) to focus the calendar panel
- **Live sync** - the dot indicators update automatically when journal files are created, deleted, or renamed

### Kanban board

The **AS Notes Kanban** sidebar and editor panel let you manage work visually with cards organised into lanes.

#### Boards

A workspace can contain any number of named boards, stored as plain files in a `kanban/` directory at the AS Notes root. Each board has its own lanes and set of cards.

- **Create a board** — run **AS Notes: Create Kanban Board** from the Command Palette and enter a name. The first board is selected automatically on activation.
- **Switch board** — type in the board-switcher field in the sidebar to filter and select from existing boards. The editor panel opens automatically.
- **Rename board** — click **Rename** in the sidebar board header, or run **AS Notes: Rename Kanban Board**.
- **Delete board** — click **Delete** in the sidebar board header, or run **AS Notes: Delete Kanban Board**. Requires confirmation; all cards and assets are removed.

#### Lanes

Each board starts with three lanes: **TODO**, **DOING**, and **DONE**. TODO and DONE are protected and cannot be removed or renamed.

In the editor panel:

- **Add lane** — click **+ Lane** in the board header.
- **Rename lane** — click the pencil icon on any non-protected lane header.
- **Remove lane** — click the × button; if the lane contains cards a confirmation is shown and cards are deleted along with it.
- **Reorder lanes** — drag a lane header to a new position.

#### Cards

Cards are the primary unit of work. Each card is stored as a **Markdown file** with YAML front-matter for structured fields (title, lane, priority, assignee, labels, due date) and a Markdown body for free-form description. This means every card is a readable `.md` file you can open, edit, and diff with standard tools.

- **Create card** — click **+ Card** in any lane, or run **AS Notes: New Kanban Card**.
- **Move card** — drag a card between lanes, or use the lane drop-down in the card editor.
- **Open card editor** — click a card to open an inline modal with all fields editable.
- **Delete card** — click the trash icon in the card editor.
- **Open card file** — click the **Open File** button in the card editor to open the Markdown file directly.

**Priority levels:** P1 · P2 · P3 · P4 · P5 · none

#### Entries (comments)

Each card has a log of timestamped entries. Type in the entry field at the bottom of the card modal and press **Add Entry** (or **Ctrl+Enter**). Entries show the author name (optional) and date in reverse-chronological order.

#### Assets

Files can be attached to a card. In the card editor, drag and drop a file onto the attachment area, or click **Add Files**. Images render as thumbnails; other files show as named links. Clicking a file opens it in VS Code. Assets are stored in `kanban/<board>/assets/<card-id>/`.

A size warning is shown for files exceeding `as-notes.kanbanAssetSizeWarningMB` (default: 10 MB).

#### Storage format

All kanban data is plain-text, version-control friendly, and human-readable. Board configuration uses YAML; cards are Markdown files with YAML front-matter:

```
kanban/
  <board-slug>/
    board.yaml              ← board name, lanes, users, labels
    card_YYYYMMDD_HHmmssfff_<id>_<slug>.md   ← card (front-matter + body)
    assets/
      <card-id>/
        <filename>
```

A typical card file looks like:

```markdown
---
title: Implement search
lane: doing
priority: p2
assignee: gareth
labels:
  - backend
  - v2
dueDate: "2026-03-20"
created: "2026-03-12T10:00:00.000Z"
updated: "2026-03-13T09:15:00.000Z"
---
Acceptance criteria:
- Full-text index across all notes
- Results ranked by relevance

## entry 2026-03-13T09:00:00.000Z
Started on the indexing module today.
```

Front-matter holds the structured fields; the Markdown body is the card description. Entries (timestamped comments) are appended as `## entry <ISO-timestamp>` sections, keeping the entire card history in one diffable file.

#### Commands

| Command | Description |
|---|---|
| **AS Notes: Open Kanban Board** | Open the editor panel for the current board |
| **AS Notes: New Kanban Card** | Open the editor panel with the create-card modal pre-opened |
| **AS Notes: Switch Kanban Board** | Switch to a board by slug (used internally by the sidebar) |
| **AS Notes: Select Kanban Board** | Pick a board from a quick-pick list |
| **AS Notes: Create Kanban Board** | Create a new board |
| **AS Notes: Rename Kanban Board** | Rename the current board |
| **AS Notes: Delete Kanban Board** | Delete the current board and all its data |
| **AS Notes: Convert Task to Kanban Card** | Mark the current task done and create a Kanban card from it *(Pro)* |

## Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.rootDirectory` | *(empty)* | Relative path from the workspace root to the AS Notes root directory (e.g. `docs` or `notes`). Leave empty to use the workspace root. All AS Notes data (`.asnotes/`, journals, templates, notes, kanban, `.asnotesignore`) lives within this directory. See [Using AS Notes in a subdirectory](#using-as-notes-in-a-subdirectory) below. |
| `as-notes.periodicScanInterval` | `300` | Seconds between automatic background scans for file changes. Set to `0` to disable. Minimum: `30`. |
| `as-notes.journalFolder` | `journals` | Folder for daily journal files, relative to the AS Notes root directory. |
| `as-notes.notesFolder` | `notes` | Folder for new notes, relative to the AS Notes root directory. Used when creating pages via wikilink navigation and the Create Note / Create Encrypted Note commands. |
| `as-notes.createNotesInCurrentDirectory` | `false` | When enabled, new notes created via wikilink navigation are placed in the current editing file's directory instead of the notes folder. Ignored when the source file is in the journal folder. |
| `as-notes.templateFolder` | `templates` | Folder for note templates, relative to the AS Notes root directory. Templates are markdown files inserted via the `/Template` slash command. |
| `as-notes.licenceKey` | *(empty)* | AS Notes Pro licence key (format: `ASNO-XXXX-XXXX-XXXX-XXXX`). Enter via **AS Notes: Enter Licence Key** in the Command Palette or directly in Settings. Scope: machine (not synced). |
| `as-notes.enableLogging` | `false` | Enable diagnostic logging to `.asnotes/logs/`. Rolling 10 MB files, max 5. Requires reload after changing. Also activated by setting the `AS_NOTES_DEBUG=1` environment variable. |

## Supported file types

The extension activates for files with `.md` and `.markdown` extensions.

## Wikilink syntax

A wikilink is any text enclosed in double square brackets:

```markdown
See [[Page Name]] for details.
```

The text between the brackets becomes both the display text and the page name. The target file is `Page Name.md` in the same directory.

### Nesting rules

Wikilinks can be nested by adding more bracket pairs:

```markdown
[[Outer [[Inner]] text]]
```

The parser uses a stack-based bracket matching algorithm. Each pair of `[[` and `]]` that balances correctly forms a valid wikilink. See [docs/TECHNICAL.md](docs/TECHNICAL.md) for a detailed explanation of the parsing algorithm and edge cases.

## Troubleshooting

### Poor performance when under file sync tool management

It has been observed that the VS Code editor can feel slower when the directory is under management by some sync tools (e.g. MS OneDrive, Google Drive, Dropbox etc).

AS Notes directories can be managed via sync, though Git is recommended as it does not watch files like the sync tools do and has full conflict resolution features.

### "This file is not yet indexed"

The backlinks panel shows this message when the current file is not in the AS Notes index. Common causes:

- **VS Code `files.exclude` / `search.exclude` settings** - AS Notes uses `vscode.workspace.findFiles()` to discover markdown files, which respects these VS Code settings. Files in excluded folders (e.g. `logseq/version-files/`) are silently omitted from the scan and will never be indexed. Check **Settings → Files: Exclude** and **Settings → Search: Exclude** if a file you expect to be indexed is missing.
- **`.asnotesignore` patterns** - Files matching patterns in `.asnotesignore` at the AS Notes root are excluded from the index. See [Excluding files from the index](#excluding-files-from-the-index) above.
- **File not yet saved** - New unsaved files are not indexed until they are saved to disk for the first time.

To resolve, check your workspace settings and `.asnotesignore` file. If the file should be indexed, ensure it is not matched by any exclusion pattern, then run **AS Notes: Rebuild Index** from the Command Palette.

## Development

The repository is structured as a monorepo with three packages:

| Package | Description |
|---|---|
| `common/` | Shared wikilink parsing library (`Wikilink`, `WikilinkService`, `MarkdownItWikilinkPlugin`) |
| `vs-code-extension/` | The VS Code extension |
| `publish/` | CLI utility that converts an AS Notes notebook (markdown + wikilinks) to static HTML |

Documentation source lives in `docs-src/` (an AS Notes workspace). The `publish` tool converts it to `docs/`.

### VS Code Extension

```bash
cd vs-code-extension
npm install
npm run build    # Build the extension
npm run watch    # Watch mode (rebuilds on changes)
npm test         # Run unit tests
npm run lint     # Type-check
```

### HTML Conversion

The converter is published as an npm package:

```bash
npx asnotes-publish --config ./asnotes-publish.json
```

For development from source:

```bash
cd publish
npm install
npm run build
npm run convert -- --input ../docs-src/pages --output ../docs --default-public
```

The conversion:

- Scans the input directory recursively for `.md` files
- Resolves `[[wikilinks]]` to relative `.html` links
- Generates a sidebar `<nav>` on each page (docs and blog layouts)
- Filters pages by `public: true` front matter (or all pages with `--default-public`)
- Always excludes `.enc.md` (encrypted) files from output
- Creates placeholder pages for missing wikilink targets
- Wipes the output directory before each run
- Generates `sitemap.xml` and `feed.xml`

**Config file** (recommended):

Create `asnotes-publish.json` in your notes root:

```json
{
    "inputDir": "./pages",
    "outputDir": "../docs",
    "defaultPublic": true,
    "layout": "docs",
    "theme": "default",
    "baseUrl": "",
    "includes": "./includes"
}
```

Then run with `--config`:

```bash
npm run convert -- --config ../asnotes-publish.json
```

**Layouts:**

| Layout | Description |
|---|---|
| `docs` (default) | Sidebar navigation + content area with TOC |
| `blog` | Sidebar navigation + narrower centered content + date metadata |
| `minimal` | Single-column, no navigation |

Custom layouts can be placed in the includes directory as `{layoutName}.html` with `{{content}}`, `{{nav}}`, `{{toc}}`, `{{title}}`, `{{header}}`, `{{footer}}`, `{{stylesheets}}`, `{{meta}}`, `{{date}}`, `{{base-url}}` tokens.

**Themes:**

| Theme | Description |
|---|---|
| `default` | Light theme with CSS Grid sidebar layout |
| `dark` | Dark theme with CSS Grid sidebar layout |

Both themes output formatted, human-editable CSS (`theme-{name}.css`). They use a 220px sidebar with sticky positioning, responsive collapse to single-column below 700px.

**CLI flags:**

| Flag | Description |
|---|---|
| `--config <path>` | Load settings from a publish config JSON file |
| `--input <dir>` | Input directory containing `.md` files |
| `--output <dir>` | Output directory for generated HTML |
| `--layout <name>` | Layout template: `docs`, `blog`, `minimal` (default: `docs`) |
| `--layouts <path>` | Directory containing editable layout templates |
| `--theme <name>` | Built-in CSS theme: `default`, `dark` |
| `--includes <path>` | Directory for custom headers and footers |
| `--stylesheet <url>` | Additional stylesheet (repeatable). CDN URLs or relative paths |
| `--asset <file>` | Copy a local file into the output directory (repeatable) |
| `--base-url <path>` | Base URL prefix for all links |
| `--default-public` | Publish all pages unless `public: false` |
| `--default-assets` | Copy all assets unless `assets: false` |
| `--retina` | Enable retina image sizing (auto-sets `width` to half intrinsic dimensions) |
| `--include-drafts` | Include pages with `draft: true` |
| `--exclude <dirname>` | Exclude directories from scanning (repeatable) |

In CI, the `build-docs` job runs the same steps automatically on push/PR to `main` (see `.github/workflows/ci.yml`).

### Debugging

Press **F5** in VS Code to launch the Extension Development Host with the extension loaded.

The debug version takes precedence over the marketplace install, so both can coexist.

VS Code remembers the last folder opened in the Extension Development Host. The [demo knowledge base](https://github.com/appsoftwareltd/as-notes-demo-notes) is designed to cover common usage scenarios.

### Testing

Unit tests use [vitest](https://vitest.dev/) and cover the wikilink parser, offset-based lookup, segment computation, index service CRUD, title extraction, rename detection data flow, and nested link indexing. Run with `npm test`.

### Publishing

Releases are published to the VS Code Marketplace manually, then a GitHub Release is created automatically when a version tag is pushed.

**Step 1 - bump the version**

Update `version` in `package.json` and add an entry to `CHANGELOG.md`.

**Step 2 - publish to the VS Code Marketplace**

```bash
npm run build
npx @vscode/vsce package
npx @vscode/vsce login appsoftwareltd   # enter PAT token if auth expired
npx @vscode/vsce publish
```

**Step 3 - tag and push**

```bash
git add .
git commit -m "Release v2.2.9"   # change version
git tag v2.2.9                   # change version
git push origin main --tags
```

Pushing the tag triggers the [Release workflow](.github/workflows/release.yml), which creates a GitHub Release automatically with auto-generated release notes and the VS Code Marketplace install link.

### Publishing the npm CLI (`asnotes-publish`)

**Step 1 - bump the version**

Update `version` in `publish/package.json`.

**Step 2 - build and publish**

```bash
cd publish
npm run build
npm login
npm publish
```

**Step 3 - verify**

```bash
npx asnotes-publish --help
```

## Agent Skills

An [agent skill](https://skills.sh/) is available for AS Notes. Install it to give your AI assistant (GitHub Copilot, Claude, etc.) full knowledge of the extension — wikilink syntax, commands, settings, keyboard shortcuts, and more.

```bash
npx skills add appsoftwareltd/as-notes/skills/as-notes-agent-use
```

Once installed, your AI assistant can answer questions about AS Notes, help configure settings, explain features, and assist with your notes workflow.

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied. The authors and contributors accept no responsibility or liability for any loss, corruption, or damage to data, files, or systems arising from the use or misuse of this extension, including but not limited to operations that create, rename, move, or modify files in your workspace.

**You are solely responsible for maintaining backups of your data.** It is strongly recommended to use version control (e.g. git) or another backup strategy for any notes or files you manage with this extension.

This extension is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)](LICENSE).

You are free to use, share, and adapt this extension for **non-commercial purposes** with attribution. Commercial use requires a separate commercial license. See [LICENSE](LICENSE) for full terms or contact us <https://www.appsoftware.com/contact>.
