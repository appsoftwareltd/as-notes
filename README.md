# AS Notes

> [Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)

AS Notes is a VS Code extension that turns your editor into a Personal Knowledge Management System (PKMS).

(Click for 1 minute Youtube video demo)

[![AS Notes demo](https://img.youtube.com/vi/liRULtb8Rm8/maxresdefault.jpg)](https://youtu.be/liRULtb8Rm8)

## Why VS Code?

Using VS Code as your main notes application gives you so much for free, even before using **AS Notes** features: 

- Cross platform + Web (via Workspaces)
- UI features such as Tabs, File Explorer, Themes
- Huge extension library that can be used along side AS Notes (Mermaid diagramming, Vim etc)
- AI Chat (GitHub CoPilot / Claude etc.) you can use to work with your notes
- Multiline editing Outliner functionality via `Ctrl + [ / ]`
- Code highlighting 
- And all of the many features that VS Code has

## Main Features

- Privacy focused - does not send your data anywhere
- Version control friendly (e.g. Git)
- Lightweight indexing of your notes (local sqlite3 WASM)
- Automatic wikilink / file rename tracking
- Performant on large (~20k markdown files) knowledge bases 

### Wikilinks

- Logseq / Roam / Obsidian style `[[wikilinks]]` with nested link support e.g. `[[[[AS Notes]] Page]]`
- Links resolve to the target page anywhere in your workspace
- Renaming a link updates the target file and all matching references

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

### Backlinks Panel

`Ctrl+Alt+B` (Windows/Linux) / `Cmd+Alt+B` (macOS)

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/backlinks.png" alt="AS Notes backlinks panel" style="max-height:400px; margin-top: 10px">

### Daily Journal

Press **Ctrl+Alt+J** (Cmd+Alt+J on macOS) to create or open today's daily journal page.

Journal files are created as `YYYY_MM_DD.md` in a dedicated `journals/` folder (configurable). New pages are generated from a `journal_template.md` template - edit it to add your own sections and prompts. The `YYYY-MM-DD` placeholder in the template is replaced with today's date on creation.

> **Note:** Daily journal requires an initialised workspace (`.asnotes/` directory). See [Getting started](#getting-started).

### Slash Commands

Type `/` in any markdown file to open a quick command menu. The following commands are available:

| Command | Action |
|---|---|
| **Today** | Inserts a wikilink for today's date, e.g. `[[2026_03_06]]` |
| **Date Picker** | Opens a date input box pre-filled with today's date — edit the date or press Enter to insert it as a wikilink |
| **Code (inline)** | Inserts `` ` `` `` ` `` with the cursor placed between the backticks |
| **Code (multiline)** | Inserts a fenced code block with the cursor after the opening ` ``` ` — type the language identifier (e.g. `js`) then press Enter |
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

Table commands are labelled **(Pro)** for free users. Pro users see clean names.

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

## AS Notes Pro Features

A **Pro licence** unlocks premium features. Enter your licence key in VS Code settings under `as-notes.licenceKey`. When a valid key is active the status bar shows **AS Notes (Pro)**.

To obtain a licence key, contact [appsoftware.com](https://www.appsoftware.com/contact).

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
- `AS Notes: Create Encrypted Note` - create a new named `.enc.md` file
- `AS Notes: Create Encrypted Journal Note` - create today's journal entry as `.enc.md`
- `AS Notes: Encrypt All Notes` - encrypt all plaintext `.enc.md` files
- `AS Notes: Decrypt All Notes` - decrypt all encrypted `.enc.md` files
- `AS Notes: Encrypt Current Note` - encrypt the active `.enc.md` file (reads unsaved editor content)
- `AS Notes: Decrypt Current Note` - decrypt the active `.enc.md` file (reads from disk)

## VS Code Marketplace

[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)


## Getting started

For a sample knowledge base, clone https://github.com/appsoftwareltd/as-notes-demo-notes and follow the instructions there to initialise.

### Initialise a workspace

AS Notes activates when it finds a `.asnotes/` directory in your workspace root (similar to `.git/` or `.obsidian/`). Without it, the extension runs in **passive mode** - you'll see a status bar item inviting you to initialise.

To initialise:

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **AS Notes: Initialise Workspace**

This creates the `.asnotes/` directory, builds a SQLite index of all markdown files, and activates all features. The index file (`.asnotes/index.db`) is excluded from git by an auto-generated `.gitignore`.

### Rebuild the index

If the index becomes stale or corrupted, run **AS Notes: Rebuild Index** from the Command Palette. This drops and recreates the entire index with a progress indicator.

### Clean workspace

If the extension is in a bad state (e.g. persistent WASM errors after a crash), run **AS Notes: Clean Workspace** from the Command Palette. This:

- Removes the `.asnotes/` directory (index database, logs, git hook config)
- Releases all in-memory state and switches to passive mode

`.asnotesignore` at the workspace root is intentionally preserved. Run **AS Notes: Initialise Workspace** afterwards to start fresh.

### Excluding files from the index

When AS Notes initialises a workspace it creates a `.asnotesignore` file at the workspace root. This file uses [`.gitignore` pattern syntax](https://git-scm.com/docs/gitignore) and controls which files and directories are excluded from the AS Notes index.

**Default contents:**

```
# Logseq metadata and backup directories
logseq/

# Obsidian metadata and trash directories
.obsidian/
.trash/
```

Patterns without a leading `/` match at any depth - `logseq/` excludes `logseq/pages/foo.md` and `vaults/work/logseq/pages/foo.md` equally. Prefix with `/` to anchor a pattern to the workspace root only (e.g. `/logseq/`).

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

Navigating to a page that doesn't exist creates it automatically, so you can write forward-references before the target page exists.

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

- **Filename format:** `YYYY_MM_DD.md` (e.g. `2026_03_02.md`)
- **Journal folder:** defaults to `journals/` (configurable via `as-notes.journalFolder`)
- **Template-based:** new files are created from `journal_template.md`, with `YYYY-MM-DD` replaced by the current date. Edit the template to customise future pages.
- **Auto-setup:** the journal folder and default template are created on first use
- **Instant indexing:** new journal files are indexed immediately for wikilink completion and backlinks
- **Idempotent:** pressing the shortcut again on the same day opens the existing file

## Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.periodicScanInterval` | `300` | Seconds between automatic background scans for file changes. Set to `0` to disable. Minimum: `30`. |
| `as-notes.journalFolder` | `journals` | Folder for daily journal files, relative to workspace root. |
| `as-notes.licenceKey` | *(empty)* | AS Notes Pro licence key. Scope: machine (not synced). |
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

### "This file is not yet indexed"

The backlinks panel shows this message when the current file is not in the AS Notes index. Common causes:

- **VS Code `files.exclude` / `search.exclude` settings** - AS Notes uses `vscode.workspace.findFiles()` to discover markdown files, which respects these VS Code settings. Files in excluded folders (e.g. `logseq/version-files/`) are silently omitted from the scan and will never be indexed. Check **Settings → Files: Exclude** and **Settings → Search: Exclude** if a file you expect to be indexed is missing.
- **`.asnotesignore` patterns** - Files matching patterns in `.asnotesignore` at the workspace root are excluded from the index. See [Excluding files from the index](#excluding-files-from-the-index) above.
- **File not yet saved** - New unsaved files are not indexed until they are saved to disk for the first time.

To resolve, check your workspace settings and `.asnotesignore` file. If the file should be indexed, ensure it is not matched by any exclusion pattern, then run **AS Notes: Rebuild Index** from the Command Palette.

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch mode (rebuilds on changes)
npm run watch

# Run unit tests
npm test

# Type-check
npm run lint
```

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
git add package.json CHANGELOG.md README.md
git commit -m "Release v1.x.x"   # change version
git tag v1.x.x                   # change version
git push origin main --tags
```

Pushing the tag triggers the [Release workflow](.github/workflows/release.yml), which creates a GitHub Release automatically with auto-generated release notes and the VS Code Marketplace install link.

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied. The authors and contributors accept no responsibility or liability for any loss, corruption, or damage to data, files, or systems arising from the use or misuse of this extension, including but not limited to operations that create, rename, move, or modify files in your workspace.

**You are solely responsible for maintaining backups of your data.** It is strongly recommended to use version control (e.g. git) or another backup strategy for any notes or files you manage with this extension.

This extension is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)](LICENSE).

You are free to use, share, and adapt this extension for **non-commercial purposes** with attribution. Commercial use requires a separate commercial license. See [LICENSE](LICENSE) for full terms or contact us https://www.appsoftware.com/contact.
