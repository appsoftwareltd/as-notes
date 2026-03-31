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
|Install | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes) / [Open VSX](https://open-vsx.org/extension/appsoftwareltd/as-notes)|
|Pro Features | [asnotes.io/pricing](https://www.asnotes.io?attr=src_readme)|
|Docs | [docs.asnotes.io](https://docs.asnotes.io)|
|Blog | [blog.asnotes.io](https://blog.asnotes.io)|
|Roadmap / Project Board| [docs.asnotes.io/development-roadmap](https://docs.asnotes.io/development-roadmap.html) / [github.com](https://github.com/orgs/appsoftwareltd/projects/16)|

## What is AS Notes?

**AS Notes brings markdown and `[[wikilink]]` editing for notes, documentation, blogs and wikis directly into [VS Code](https://code.visualstudio.com/) and compatible editors (e.g. [Antigravity](https://antigravity.google/), [Cursor](https://cursor.com/), [Windsurf](https://windsurf.com/)).**

**Capture ideas, link concepts, write, and stay focused - without ever leaving your editor.**

AS Notes provides productivity tooling that turns your favourite IDE into a personal knowledge management system (PKMS), including a backlinks view, task management, journals, a kanban board, markdown editing tools, mermaid, LaTeX math support and Jekyll / Hugo like publishing.

(1 minute introduction video)

[![AS Notes demo](https://img.youtube.com/vi/bwYopQ1Sc5o/maxresdefault.jpg)](https://www.youtube.com/watch?v=bwYopQ1Sc5o)

(1 minute demo video)

[![AS Notes demo](https://img.youtube.com/vi/liRULtb8Rm8/maxresdefault.jpg)](https://youtu.be/liRULtb8Rm8)

## Why VS Code?

Many of us use VS Code like compatible editors daily, and even where we use a separate tool for notes and knowledge management, we often still write documentation, blogs and wikis in our IDE. AS Notes provides the tools to do everything in your IDE.

Some key benefits of managing notes in VS Code in addition to those that AS Notes provides directly:

- Cross platform compatibility + Web (via Workspaces)
- Acceptenance in restricted work envrionments that other knowledge management tools may not have
- Huge extension library that can be used along side AS Notes to extend the capabilities even further
- Built in AI Agent Harness (GitHub CoPilot / Claude etc.) you can use to work with your notes
- State of the art text editing and UI features
- Syntax highlighting
- And all of the many features that VS Code has

## AS Notes Features

### General

- Privacy focused - AS Notes does not send your data or telemetry anywhere
- Version control friendly (Git & GitOps)
- Lightweight indexing of your notes (local sqlite3 WASM)

- Performant on large (~20k markdown files) knowledge bases

### Wikilinking

- Logseq / Roam / Obsidian style `[[wikilinks]]` with nested link support e.g. `[[[[AS Notes]] Page]]`
- Links resolve to the target page anywhere in your workspace. Nested wikilinks can resolve multiple targets
- Renaming a link updates the target file and all matching references
- Automatic wikilink / file rename tracking

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/wikilinks.png" alt="AS Notes backlinks wikilinks" style="max-height:200px; margin-top: 10px">

See [Wikilinks documentation](https://docs.asnotes.io/wikilinks.html) for further information on wikilinks.

### Task Management

Toggle markdown TODOs with `Ctrl+Shift+Enter` (Windows/Linux) / `Cmd+Shift+Enter` (macOS):

```
- [ ] Marker for todo added
- [x] Marker for todo marked done
Marker for todo removed
```

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/task-management-panel.png" alt="AS Notes todo panel" style="max-height:260px; margin-top: 10px; margin-bottom: 10px;">

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

Example usage:

```markdown
- [ ] #P1 Fix the critical production bug
- [ ] #P2 #W Waiting on design sign-off for the new dashboard
- [x] #D-2026-03-10 Submit the quarterly report
```

Multiple tags can be combined. Only one priority tag is used — if more than one is present, the first wins.

#### Task Management

The **AS Notes** activity bar icon opens the Tasks sidebar, which shows all tasks across your entire workspace.

**Group By** — choose how tasks are grouped:

| View | Description |
|---|---|
| **Page** | Tasks grouped alphabetically by source page |
| **Priority** | Tasks grouped by priority level (P1 → P2 → P3 → No Priority), sorted by due date within each group |
| **Due Date** | Tasks grouped by due date |
| **Completion Date** | Tasks grouped by completion date |

**Filters:**

- **TODO ONLY** — show only incomplete tasks (default on)
- **WAITING ONLY** — show only tasks tagged `#W`
- **Filter by page** — type to narrow tasks to pages whose name contains the search text (case-insensitive)

### Backlinks Panel

The backlinks panel shows references to page. References are captured by page mention, outliner style indentation under another wikilink or nesting in another wikilink. Backlink tracking capture surrounding context, works for forward references (pages that have wikilinks but have not been created yet) and are updated live on changes to the index.

Open the backlinks editor tab alongside your current tab using: `Ctrl+Alt+B` (Windows/Linux) / `Cmd+Alt+B` (macOS)

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/as-notes-backlink-panel.png" alt="AS Notes backlinks panel" style="max-height:400px; margin-top: 10px">

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

### Kanban Board

AS Notes has a built in Kanban board backed by markdown files that can be used and edited just like any other page under AS Notes.

Use the Kanban board for tracking long running projects. Standard tasks can be used in Kanban card files just like any other note in AS Notes.

### Daily Journal

Press **Ctrl+Alt+J** (Cmd+Alt+J on macOS) to create or open today's daily journal page.

Journal files are created as `YYYY-MM-DD.md` in a dedicated `journals/` folder (configurable). New pages are generated from the `Journal.md` template in the templates folder (default: `templates/`). Edit `Journal.md` to add your own sections and prompts. All template placeholders are supported -- see [Templates](#templates).

A **Calendar** panel in the sidebar shows the current month with journal indicators. Click any day to open its journal entry. See [Calendar](#calendar) for details.

> **Note:** Daily journal requires an initialised workspace (`.asnotes/` directory). See [Getting started](#getting-started).

### Compatibility With Other Markdown PKMS

AS Notes can work alongside knowledge bases created in Obsidian or Logseq due to similar file structures. Be aware there are format and behavioural differences differences however.

### Slash Commands

Type `/` in any markdown file to open a quick command menu. Keep typing to filter the list, press Enter to run a command, or press Escape to dismiss and leave the `/` in place. Slash commands are suppressed inside fenced code blocks, inline code spans, and YAML front matter.

#### Standard Commands

| Command | Action |
|---|---|
| **Today** | Inserts a wikilink for today's date, e.g. `[[2026-03-06]]` |
| **Date Picker** | Opens a date input box pre-filled with today's date. Edit the date or press Enter to insert it as a wikilink |
| **Code (inline)** | Inserts `` ` `` `` ` `` with the cursor placed between the backticks |
| **Code (multiline)** | Inserts a fenced code block with the cursor after the opening ` ``` ` -- type the language identifier (e.g. `js`) then press Enter |

#### Publishing Commands *(front matter)*

These commands toggle or cycle publishing-related fields in the file's YAML front matter. See [Publishing a Static Site](#publishing-a-static-site) for details.

| Command | Action |
|---|---|
| **Public** | Toggles `public: true` / `public: false` in front matter |
| **Layout** | Cycles `layout` through `docs`, `blog`, and `minimal` in front matter |
| **Retina** | Toggles `retina: true` / `retina: false` in front matter |
| **Assets** | Toggles `assets: true` / `assets: false` in front matter |

#### Kanban Card Commands *(kanban card files only)*

The following command only appears when editing a kanban card file (`kanban/card_*.md`).

| Command | Action |
|---|---|
| **Card: Entry Date** | Inserts a `## entry YYYY-MM-DD` heading at the cursor, pre-filled with today's date |

#### Task Commands *(task lines only)*

These commands only appear when the cursor is on a task line (`- [ ]` or `- [x]`). Tags are inserted after the checkbox and after any existing hashtags already on the line.

| Command | Action |
|---|---|
| **Task: Priority 1** | Inserts `#P1` at the start of the task text. Replaces any existing priority tag (`#P1`--`#P9`) on the line |
| **Task: Priority 2** | Inserts `#P2`, replacing any existing priority tag |
| **Task: Priority 3** | Inserts `#P3`, replacing any existing priority tag |
| **Task: Waiting** | Toggles `#W` at the start of the task text (inserts if absent, removes if present) |
| **Task: Due Date** | Opens a date input pre-filled with today (YYYY-MM-DD). Inserts `#D-YYYY-MM-DD` at the start of the task text. Replaces any existing due date tag |
| **Task: Completion Date** | Opens a date input pre-filled with today (YYYY-MM-DD). Inserts `#C-YYYY-MM-DD` at the start of the task text. Replaces any existing completion date tag |
| **Convert to Kanban Card** *(Pro)* | Marks the task as done, creates a Kanban card in the **TODO** lane with the task title (stripped of tags), matching priority and due date, and the **Waiting** flag set. Only available on unchecked tasks |

Priority and waiting tags toggle: issuing the same tag again removes it. Issuing a different priority replaces the existing one. Due date and completion date tags replace any existing tag of the same type.

#### Pro Commands

Pro commands are available with a Pro licence. Free users see them listed with **(Pro)** appended in the menu.

| Command | Action |
|---|---|
| **Template** | Opens a quick-pick list of templates from the templates folder and inserts the selected template at the cursor. Supports placeholders (see [Templates](#templates)) |
| **Table** | Prompts for column and row count, then inserts a formatted markdown table |
| **Table: Format** | Normalises all column widths in the surrounding table to the longest cell content |
| **Table: Add Column(s)** | Prompts for count, then adds columns after the cursor's current column in the surrounding table |
| **Table: Add Row(s)** | Prompts for count, then adds rows after the cursor's current row in the surrounding table |
| **Table: Remove Row (Current)** | Removes the row at the cursor (refuses header/separator) |
| **Table: Remove Column (Current)** | Removes the column at the cursor (refuses single-column tables) |
| **Table: Remove Row(s) Above** | Prompts for count, then removes data rows above the cursor (clamps to available) |
| **Table: Remove Row(s) Below** | Prompts for count, then removes rows below the cursor (clamps to available) |
| **Table: Remove Column(s) Right** | Prompts for count, then removes columns to the right of the cursor (clamps to available) |
| **Table: Remove Column(s) Left** | Prompts for count, then removes columns to the left of the cursor (clamps to available, preserves indent) |

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

Hover over any image link in a markdown file to see a preview of the image inline. The standard implementation is provided by VS Code's built-in markdown extension and requires no configuration - it works with both standard `![alt](path)` links and dropped/pasted images. An enhanced image display is included with inline markdown editor mode.

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/image-preview.png" alt="AS Notes Image Preview" style="max-height:300px; margin-top: 10px; margin-bottom: 10px;">

#### Code Block Completion

Code block completion works in **all** markdown files — outliner mode is not required.

When you type `` ``` `` (with optional language, e.g. `` ```javascript ``) and press **Enter**, AS Notes automatically inserts the closing `` ``` `` and places the cursor inside the block. On a bullet line the content is indented to match markdown list continuation.

The extension is aware of existing fence pairs: if the backticks are already balanced (i.e. there is a matching closing fence at the same indentation), Enter simply inserts a newline instead of a second skeleton.

In outliner mode, pressing Enter on a closing `` ``` `` line that belongs to a bullet code block inserts a new bullet at the parent's indentation.

## AS Notes Pro Features

A **Pro licence** unlocks premium features. When a valid key is active the status bar shows **AS Notes (Pro)**.

To obtain a licence key, visit [asnotes.io](https://www.asnotes.io/pricing)

**Entering your licence key:**

- Run **AS Notes: Enter Licence Key** from the Command Palette (`Ctrl+Shift+P`) — the quickest way.
- Or open VS Code Settings (`Ctrl+,`), search for `as-notes.licenceKey`, and paste your key there.

### Inline Editor Markdown Styling, Mermaid and LaTeX Rendering (Pro)

AS Notes Pro includes optional inline markdown Typora like styling, Mermaid diagram and LaTeX rendering inside VS Code (or compatible editor) editor tabs. Standard Markdown syntax characters (`**`, `##`, `[]()`, etc.) are replaced with their visual equivalents as you write.

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/asnotes-inline-editor-markdown-styling-mermaid-andlatex-rendering.png" alt="Inline Editor Markdown Styling, Mermaid and LaTeX Rendering" style="max-height:400px; margin-top: 10px">

See [Inline Editor Markdown Styling, Mermaid and LaTeX Rendering](https://docs.asnotes.io/inline-markdown-editing-mermaid-and-latex-rendering.html) for further information.

AS Notes includes a built-in inline Markdown editor that renders formatting directly in the text editor, similar to Typora.

**Three-state visibility:**

| State | When | What you see |
|---|---|---|
| **Rendered** | Cursor is elsewhere | Clean formatted text (syntax hidden) |
| **Ghost** | Cursor is on the line | Syntax characters at reduced opacity |
| **Raw** | Cursor is inside the construct | Full Markdown source |

**Supported constructs:**

Bold, italic, strikethrough, headings (H1-H6), inline code, links, images, blockquotes, horizontal rules, unordered/task lists, code blocks (with language labels), YAML frontmatter, GFM tables, emoji shortcodes (`:smile:` etc.), Mermaid diagrams (inline SVG), LaTeX/math (KaTeX/MathJax), GitHub mentions and issue references.

**Toggle:** Use the **AS Notes: Toggle Inline Editor** command or click the eye icon in the editor title bar. The toggle state is persisted per workspace.

**Outliner mode awareness:** When outliner mode is active, bullet markers and checkbox syntax are styled inline (bullets render as styled bullets, checkboxes render with bullet and checkbox graphic) alongside the outliner structure.

| Setting | Default | Description |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | Enable/disable inline rendering |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | Opacity for ghost-state syntax characters |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | Open links with a single click (instead of Ctrl+Click) |

See [Settings](#settings) for the full list of inline editor settings.

### Templates (Pro)

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

### Encrypted notes (Pro)

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

### Outliner Mode

Enable **Outliner Mode** (`as-notes.outlinerMode` setting or the **AS Notes: Toggle Outliner Mode** command) to turn the editor into a bullet-first outliner. Every line begins with `-` and custom keybindings keep you in flow:

| Key | Action |
|---|---|
| **Enter** | Inserts a new bullet at the same indentation. Todo lines (`- [ ]`) continue as unchecked todos. |
| **Tab** | Indents the bullet one level (capped at one level deeper than the bullet above). |
| **Shift+Tab** | Outdents the bullet one level. |
| **Ctrl+Shift+Enter** | Cycles: plain bullet → `- [ ]` → `- [x]` → plain bullet. |
| **Ctrl+V / Cmd+V** | Multi-line paste: each clipboard line becomes a separate bullet. |

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

---

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

### Publishing to HTML from AS Notes (HTML Conversion)

The converter is published as an npm package:

```bash
npx asnotes-publish --config ./asnotes-publish.json
```

See [Publishing a Static Site](https://docs.asnotes.io/publishing-a-static-site.html) for full documenation

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
git commit -m "Release v2.3.1"   # change version
git tag v2.3.1                   # change version
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
