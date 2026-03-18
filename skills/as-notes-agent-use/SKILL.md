---
name: as-notes-agent-use
description: "Use when working with the AS Notes VS Code extension - a Personal Knowledge Management System (PKMS). Two use cases: (1) writing/contributing notes in AS Notes format (wikilinks, task tags, aliases, journal entries, kanban cards, outliner mode) - notes can also be published as a static HTML site, and (2) helping users use, configure, and troubleshoot AS Notes (settings, commands, keyboard shortcuts, workspace setup, backlinks, encryption). Use this skill whenever the user mentions AS Notes, .asnotes, wikilinks, [[double bracket links]], backlinks, outliner mode, kanban boards, encrypted notes, .enc.md, daily journal, task tags (#P1, #P2, #W, #D-), slash commands, todo toggle, task panel, rebuilding the index, .asnotesignore, or any as-notes.* VS Code setting. Also use when the user is writing or editing markdown notes that use wikilink syntax, managing tasks with priority/due-date tags, setting up a notes workspace, or publishing notes to static HTML."
---

# AS Notes - VS Code Extension

AS Notes turns VS Code into a PKMS. Activates when `.asnotes/` exists at the workspace root.

- VS Code Marketplace: `appsoftwareltd.as-notes`
- Docs: https://docs.asnotes.appsoftware.com
- Demo: https://github.com/appsoftwareltd/as-notes-demo-notes

---

## Agent Directives

### When writing or editing notes (use case 1)

- Always use `[[wikilinks]]` for cross-references between pages - never raw markdown links for internal pages
- Omit `.md` in wikilinks: `[[My Page]]` not `[[My Page.md]]`
- Add `aliases:` front matter only when a page genuinely needs alternative names
- Use task tags (`#P1`, `#D-YYYY-MM-DD`, etc.) inline on task lines - do not invent new tag formats
- In outliner mode every line must start with `- `; use indentation for hierarchy
- When the user's notes may be published as a static HTML site, ensure wikilinks and structure are clean - the `html-conversion` tool converts them to relative `.html` links
- See [Writing Notes in AS Notes Format](#writing-notes-in-as-notes-format) for templates

### When helping or troubleshooting (use case 2)

- Check whether `.asnotes/` exists before suggesting features that require an initialised workspace
- Refer users to specific commands (e.g. **AS Notes: Rebuild Index**) rather than manual workarounds
- For backlink/index issues, follow the [Troubleshooting Checklist](#troubleshooting-checklist) below
- Quote exact setting names (`as-notes.*`) and keyboard shortcuts for the user's platform
- See reference sections below for full feature details

---

## Writing Notes in AS Notes Format

### Standard page

```markdown
---
aliases:
  - Short Name
  - Another Name
---

# Page Title

Link to [[Page Name]] or [[Subfolder/Topic]].
Nested wikilinks: [[Specific [[Topic]] Details]].
```

- YAML front matter optional; include only when aliases are needed
- First `# heading` is the page title in the index
- Omit `.md` in wikilinks - `[[My Page]]` resolves to `My Page.md`

### Task lines

```markdown
- [ ] Plain task
- [ ] #P1 Critical
- [ ] #P2 #W Waiting on approval #D-2026-03-20
- [ ] #P3 Low priority #C-2026-03-15
- [x] Completed task
```

- Tags appear anywhere; stripped from display text
- Only first priority tag (`#P1`–`#P9`) is used
- `#W` toggles; dates must be `YYYY-MM-DD`

### Daily journal entry

File: `journals/2026_03_15.md` (folder configurable via `as-notes.journalFolder`)

```markdown
# 2026-03-15

## Tasks
- [ ] Morning standup
- [ ] Review [[Project Alpha]] PR

## Notes
Discussed [[Team Meeting]] outcomes with [[Alice]].
```

### Outliner-mode page

Every line begins with `- `. Structure with indentation:

```markdown
- # Page Title
- Top level idea about [[Topic]]
  - Supporting detail
    - Nested detail
- [ ] #P2 Task #D-2026-03-20
  - [ ] Sub-task
```

### Kanban card file

Save as `card_YYYYMMDD_HHmmssfff_<id>_<slug>.md` inside `kanban/<board-slug>/`:

```markdown
---
title: Card title
lane: todo
priority: medium
assignee: 
labels: []
dueDate: ""
created: "2026-03-15T10:00:00.000Z"
updated: "2026-03-15T10:00:00.000Z"
---
Card description in Markdown.

## entry 2026-03-15T10:00:00.000Z
Timestamped comment.
```

---

## Workspace Initialisation

Requires `.asnotes/` at workspace root. Without it: passive mode (no index, commands prompt to initialise).

**Initialise:** Command Palette → **AS Notes: Initialise Workspace**

- **AS Notes: Rebuild Index** - drop and recreate the index
- **AS Notes: Clean Workspace** - remove `.asnotes/`, reset to passive mode (preserves `.asnotesignore`)

### .asnotesignore

Gitignore-syntax file at workspace root. Watched; re-scans on change. Default:

```
logseq/
.obsidian/
.trash/
```

- No `/` prefix → matches at any depth; `/` prefix → anchored to workspace root
- VS Code `files.exclude` / `search.exclude` settings are also respected

---

## Supported File Types

`.md` and `.markdown`

---

## Wikilinks

```markdown
[[Page Name]]
[[Subfolder/Page Name]]
[[Outer [[Inner]] text]]    ← nested; each balanced pair is a valid link
```

**Resolution order:** direct filename match → alias match → auto-create in source directory

**Disambiguation** (multiple files with same name): same directory wins, otherwise closest folder by distance.

**Aliases** - YAML front matter: `aliases: [Short Name, Another Name]`
`[[Short Name]]` navigates to the page declaring that alias. Hover shows `Short Name.md → ActualPage.md`. Backlink counts include alias refs.

**Rename sync** - editing wikilink text and moving the cursor away offers to rename the `.md` file and update all matching links.

**Autocomplete** - type `[[` to list all pages/aliases; selecting appends `]]`.

**Colour** - `as-notes.wikilinkColour` (hex, e.g. `#3794ff`); empty = theme default.

---

## Task / TODO Management

**Toggle:** `Ctrl+Shift+Enter` / `Cmd+Shift+Enter` - cycles `plain → - [ ] → - [x] → plain` on the current line. Multi-cursor supported.

### Metadata tags

| Tag | Description |
|---|---|
| `#P1` / `#P2` / `#P3` | Priority - Critical / High / Normal |
| `#W` | Waiting |
| `#D-YYYY-MM-DD` | Due date |
| `#C-YYYY-MM-DD` | Completion date |

Tags stripped from display. First priority tag wins. Dates: `YYYY-MM-DD`.

### Tasks sidebar - `Ctrl+Alt+T` / `Cmd+Alt+T`

**Group By:** Page · Priority (P1→P2→P3→None, sorted by due date) · Due Date (Overdue/Today/This Week/Later/None) · Completion Date

**Filters:** TODO ONLY (default on) · WAITING ONLY · Filter by page (case-insensitive)

---

## Backlinks Panel - `Ctrl+Alt+B` / `Cmd+Alt+B`

All incoming wikilink references to the current file, displayed as context chains.

- **Flat by page** (default) - sorted by source page name
- **Grouped by chain** - grouped by link chain pattern (e.g. `[[Project]] → [[Tasks]] → [[Topic]]`)
- Default mode: `as-notes.backlinkGroupByChain` (default `false`)
- Context verbosity: compact or wrapped - `as-notes.backlinkWrapContext` (default `false`)
- Right-click any wikilink → **View Backlinks** for that page (works with aliases and forward refs)

---

## Daily Journal - `Ctrl+Alt+J` / `Cmd+Alt+J`

Creates or opens today's file. Filename: `YYYY_MM_DD.md` in `journals/` (or `as-notes.journalFolder`). Template: `journal_template.md` - `YYYY-MM-DD` replaced on creation. Folder and template auto-created on first use.

---

## Slash Commands

Type `/` in any markdown file. Filter by typing. Suppressed in code blocks, inline code, and YAML front matter.

### General

| Command | Action |
|---|---|
| **Today** | Insert `[[YYYY_MM_DD]]` wikilink |
| **Date Picker** | Date input → insert as wikilink |
| **Code (inline)** | Insert `` ` ` `` with cursor inside |
| **Code (multiline)** | Insert fenced code block |
| **Table** | Prompt for cols/rows, insert table |
| **Table: Add Column(s)** | Add cols after cursor |
| **Table: Add Row(s)** | Add rows after cursor |
| **Table: Format** | Normalise column widths |
| **Table: Remove Row (Current)** | Remove row at cursor |
| **Table: Remove Column (Current)** | Remove column at cursor |
| **Table: Remove Row(s) Above/Below** | Prompt for count, remove |
| **Table: Remove Column(s) Right/Left** | Prompt for count, remove |

Table commands shown as **(Pro)** for free users.

### Task commands *(on a task line only)*

| Command | Action |
|---|---|
| **Task: Priority 1/2/3** | Insert/replace priority tag |
| **Task: Waiting** | Toggle `#W` |
| **Task: Due Date** | Date input → insert/replace `#D-YYYY-MM-DD` |
| **Task: Completion Date** | Date input → insert/replace `#C-YYYY-MM-DD` |

---

## Outliner Mode

Enable: `as-notes.outlinerMode` or **AS Notes: Toggle Outliner Mode**. Every line begins with `- `.

| Key | Action |
|---|---|
| **Enter** | New bullet at same indent (todo lines continue as `- [ ]`) |
| **Tab** | Indent one level (max: one deeper than line above) |
| **Shift+Tab** | Outdent one level |
| **Ctrl+Shift+Enter** | Cycle bullet → `- [ ]` → `- [x]` → bullet |
| **Ctrl+V / Cmd+V** | Each clipboard line → separate bullet |

**Code block completion** (all markdown files): type `` ``` `` + optional language + Enter → closing `` ``` `` inserted with cursor inside.

---

## File Drag & Drop / Paste

Drop files or paste images onto a markdown editor. Saved to `<workspace>/<as-notes.assetPath>/<filename>` (default: `assets/images`).

---

## Kanban Board *(Pro)*

```
kanban/<board-slug>/
  board.yaml
  card_YYYYMMDD_HHmmssfff_<id>_<slug>.md
  assets/<card-id>/<filename>
```

See [Kanban card file](#kanban-card-file) above for card format. Priority levels: `critical` · `high` · `medium` · `low` · `none`

Default lanes: **TODO**, **DOING**, **DONE** (TODO and DONE protected). Add/rename/reorder/remove additional lanes in the editor panel. Attach files to cards via drag & drop; size warning: `as-notes.kanbanAssetSizeWarningMB` (default 10 MB).

| Command | Description |
|---|---|
| **AS Notes: Open Kanban Board** | Open editor panel |
| **AS Notes: New Kanban Card** | Create card |
| **AS Notes: Select Kanban Board** | Pick board from list |
| **AS Notes: Create Kanban Board** | New board |
| **AS Notes: Rename Kanban Board** | Rename current board |
| **AS Notes: Delete Kanban Board** | Delete board and all data |

---

## Encrypted Notes *(Pro)*

`.enc.md` files are encrypted at rest, excluded from the search index, never read as plain text.

- **Algorithm:** AES-256-GCM, random 12-byte nonce per encryption
- **Key derivation:** PBKDF2-SHA256, 100,000 iterations
- **Storage:** passphrase in OS keychain (VS Code SecretStorage) - never written to disk
- **File marker:** `ASNOTES_ENC_V1:<base64url payload>` - detected by Git pre-commit hook

| Command | Description |
|---|---|
| **AS Notes: Set Encryption Key** | Save passphrase to keychain |
| **AS Notes: Clear Encryption Key** | Remove passphrase |
| **AS Notes: Create Encrypted Note** | New `.enc.md` file |
| **AS Notes: Create Encrypted Journal Note** | Today's journal as `.enc.md` |
| **AS Notes: Encrypt / Decrypt All Notes** | Encrypt or decrypt all `.enc.md` files |
| **AS Notes: Encrypt / Decrypt Current Note** | Encrypt or decrypt active file |

---

## Pro Licence

Setting: `as-notes.licenceKey` (machine-scoped, not synced). Status bar shows **AS Notes (Pro)** when active. Contact: https://www.appsoftware.com/contact

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.periodicScanInterval` | `300` | Background scan interval (seconds). `0` disables. Min: `30`. |
| `as-notes.journalFolder` | `journals` | Journal folder, relative to workspace root. |
| `as-notes.licenceKey` | *(empty)* | Pro licence key. Machine-scoped. |
| `as-notes.assetPath` | `assets/images` | Folder for dropped/pasted files. |
| `as-notes.enableLogging` | `false` | Diagnostic logging to `.asnotes/logs/`. Requires reload. Also: `AS_NOTES_DEBUG=1`. |
| `as-notes.wikilinkColour` | *(empty)* | Hex wikilink colour (e.g. `#3794ff`). Empty = theme default. |
| `as-notes.backlinkGroupByChain` | `false` | Backlinks: group by chain (`true`) or flat by page (`false`). |
| `as-notes.backlinkWrapContext` | `false` | Backlinks: wrap context (`true`) or compact (`false`). |
| `as-notes.outlinerMode` | `false` | Outliner Mode. Window-scoped. |
| `as-notes.kanbanAssetSizeWarningMB` | `10` | Kanban attachment size warning (MB). `0` disables. |

---

## Troubleshooting Checklist

When a user reports a problem, work through these checks in order:

1. **Is the workspace initialised?** Check for `.asnotes/` directory. If missing → **AS Notes: Initialise Workspace**
2. **Is the file indexed?** If backlinks/tasks are missing for a specific file:
   - Check `.asnotesignore` - is the file matched by an exclude pattern?
   - Check VS Code `files.exclude` / `search.exclude` settings - AS Notes respects these
   - Is the file saved to disk? Unsaved files are not indexed
3. **Is the index stale?** Suggest **AS Notes: Rebuild Index** if features worked before but stopped
4. **Is the extension in a bad state?** (e.g. WASM errors after crash) → **AS Notes: Clean Workspace**, then re-initialise
5. **Pro feature without licence?** Check `as-notes.licenceKey` is set. Status bar should show **AS Notes (Pro)**
6. **Performance issues?** Check if the workspace is under file sync tool management (OneDrive, Dropbox, Google Drive) - these can cause slowness. Recommend Git instead
7. **Enable logging** for deeper diagnosis: set `as-notes.enableLogging` to `true` (requires reload), then check `.asnotes/logs/`

---

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|---|---|---|
| Toggle todo | `Ctrl+Shift+Enter` | `Cmd+Shift+Enter` |
| Backlinks panel | `Ctrl+Alt+B` | `Cmd+Alt+B` |
| Daily journal | `Ctrl+Alt+J` | `Cmd+Alt+J` |
| Tasks panel | `Ctrl+Alt+T` | `Cmd+Alt+T` |

---

## Publishing to Static HTML

`html-conversion` is a Node.js tool (`html-conversion/` in the repo) that converts a notes workspace to a static HTML site.

- Scans `--input` for `.md` → outputs `.html` files
- `[[wikilinks]]` → relative `.html` links; auto-generates `<nav>` sidebar
- Creates placeholder pages for missing wikilink targets
- Content in `<article class="markdown-body">` - compatible with `github-markdown-css`
- **Wipes output directory before each run**

```bash
cd html-conversion && npm install && npm run build
npm run convert -- --input <notes-dir> --output <output-dir>
```

| Flag | Description |
|---|---|
| `--input <dir>` | Source `.md` directory |
| `--output <dir>` | Output directory (wiped each run) |
| `--stylesheet <url>` | Inject `<link rel="stylesheet">`. Repeatable; CDN URLs or relative paths. |
| `--asset <file>` | Copy local file to output. Repeatable. |

```bash
npm run convert -- \
  --input ../docs-src/pages --output ../docs \
  --stylesheet https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-light.css \
  --stylesheet docs.css --asset ../docs-src/docs.css
```

**GitHub Pages / CI:** commit output to `docs/`; enable GitHub Pages in repo settings.

```yaml
- name: Build docs
  run: |
    cd html-conversion && npm ci && npm run build
    npm run convert -- --input ../docs-src/pages --output ../docs
```

`index.md` → `index.html` (shown as "Home"). Pages listed alphabetically; `index` always first.
