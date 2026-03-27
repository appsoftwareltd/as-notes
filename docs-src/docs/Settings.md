# Settings

All AS Notes settings are available in VS Code Settings (`Ctrl+,`). Search for `as-notes` to see them all.

## General Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.rootDirectory` | *(empty)* | Subdirectory within the workspace to use as the AS Notes root (e.g. `docs` or `notes`). When empty, the workspace root is used. All AS Notes data (`.asnotes/`, journals, templates, etc.) lives within this directory. Configure per workspace, not globally. Changing this after initialisation requires manually moving your notes directory. |
| `as-notes.periodicScanInterval` | `300` | Seconds between automatic background scans for file changes. Set to `0` to disable periodic scanning. Minimum effective value: `30`. |
| `as-notes.assetPath` | `assets/images` | Folder where dropped and pasted files are saved by VS Code's built-in markdown editor, relative to the AS Notes root directory. See [[Images and Files]]. |
| `as-notes.wikilinkColour` | *(empty)* | Hex colour for wikilinks in the editor (e.g. `#3794ff`). Leave empty to use your theme's link colour. |
| `as-notes.outlinerMode` | `false` | Enable Outliner Mode for markdown files. When enabled, Enter on a bullet line inserts a new bullet at the same indentation, Tab indents it, and Shift+Tab outdents it. Only applies to lines beginning with `- `. |
| `as-notes.enableLogging` | `false` | Enable diagnostic logging to `.asnotes/logs/`. Rolling 10 MB files, max 5. Requires a VS Code window reload after changing. Also activated by the `AS_NOTES_DEBUG=1` environment variable. |

## Notes and Templates Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.notesFolder` | `notes` | Folder for new notes, relative to the AS Notes root directory. Used when creating pages via wikilink navigation and the **Create Note** / **Create Encrypted Note** commands. |
| `as-notes.createNotesInCurrentDirectory` | `false` | When enabled, new notes created via wikilink navigation are placed in the same directory as the currently open file, rather than the notes folder. Ignored when the source file is in the journal folder. |
| `as-notes.templateFolder` | `templates` | Folder for note templates, relative to the AS Notes root directory. Templates are markdown files insertable via the `/Template` slash command. See [[Slash Commands]]. |

## Journal Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.journalFolder` | `journals` | Folder for daily journal files, relative to the AS Notes root directory. See [[Daily Journal]]. |

## Backlinks Panel Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.backlinkGroupByChain` | `false` | Default view mode for the Backlinks panel. `false` = flat by page, `true` = grouped by chain pattern. See [[Backlinks]]. |
| `as-notes.backlinkWrapContext` | `false` | Default context verbosity. `false` = compact (single-line), `true` = wrapped (full text). |

## Kanban Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.kanbanAssetSizeWarningMB` | `10` | Warn when attaching files larger than this size (in MB) to a Kanban card. Set to `0` to disable the warning. |

## Pro Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.licenceKey` | *(empty)* | AS Notes Pro licence key (format: `ASNO-XXXX-XXXX-XXXX-XXXX`). Unlocks Pro features including table commands, templates, and encrypted notes. Enter via **AS Notes: Enter Licence Key** in the Command Palette, or paste directly here. Stored at machine scope (not synced across devices). See [[Encrypted Notes]]. |

## Inline Editor Settings

The inline editor renders Markdown formatting directly in the text editor (Typora-like syntax shadowing). All settings are under the `as-notes.inlineEditor` namespace.

| Setting | Default | Description |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | Enable/disable inline Markdown rendering. Also togglable via the **AS Notes: Toggle Inline Editor** command or the eye icon in the editor title bar. |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | Opacity (0-1) for syntax characters in ghost state (cursor on the same line but outside the construct). |
| `as-notes.inlineEditor.decorations.frontmatterDelimiterOpacity` | `0.3` | Opacity for YAML frontmatter `---` delimiters when not actively editing them. |
| `as-notes.inlineEditor.decorations.codeBlockLanguageOpacity` | `0.3` | Opacity for the language identifier on fenced code block opening fences. |
| `as-notes.inlineEditor.defaultBehaviors.diffView.applyDecorations` | `false` | Apply inline editor decorations in diff/compare views. When `false`, diff views show raw Markdown. |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | Open links with a single click instead of Ctrl+Click. |
| `as-notes.inlineEditor.emojis.enabled` | `true` | Render `:emoji:` shortcodes as emoji characters inline. |
| `as-notes.inlineEditor.math.enabled` | `true` | Render LaTeX math expressions (`$...$`, `$$...$$`) inline using KaTeX. |
| `as-notes.inlineEditor.mentions.enabled` | `true` | Enable GitHub-style `@mention` and `#issue` reference detection and styling. |
| `as-notes.inlineEditor.mentions.linksEnabled` | *(auto)* | Force mention and issue links on or off. When unset, auto-detects from the git remote. |

Colour overrides (leave empty to use theme defaults):

| Setting | Default | Description |
|---|---|---|
| `as-notes.inlineEditor.colors.heading1` | *(empty)* | Colour for H1 headings |
| `as-notes.inlineEditor.colors.heading2` | *(empty)* | Colour for H2 headings |
| `as-notes.inlineEditor.colors.heading3` | *(empty)* | Colour for H3 headings |
| `as-notes.inlineEditor.colors.heading4` | *(empty)* | Colour for H4 headings |
| `as-notes.inlineEditor.colors.heading5` | *(empty)* | Colour for H5 headings |
| `as-notes.inlineEditor.colors.heading6` | *(empty)* | Colour for H6 headings |
| `as-notes.inlineEditor.colors.emphasis` | *(empty)* | Colour for bold and italic text |
| `as-notes.inlineEditor.colors.link` | *(empty)* | Colour for link text |
| `as-notes.inlineEditor.colors.listMarker` | *(empty)* | Colour for list markers (`-`, `*`, `+`) |
| `as-notes.inlineEditor.colors.inlineCode` | *(empty)* | Colour for inline code text |
| `as-notes.inlineEditor.colors.inlineCodeBackground` | *(empty)* | Background colour for inline code |
| `as-notes.inlineEditor.colors.blockquote` | *(empty)* | Colour for blockquote markers |
| `as-notes.inlineEditor.colors.image` | *(empty)* | Colour for image placeholder text |
| `as-notes.inlineEditor.colors.horizontalRule` | *(empty)* | Colour for horizontal rule lines |
| `as-notes.inlineEditor.colors.checkbox` | *(empty)* | Colour for checkbox symbols |

## Keyboard Shortcuts

AS Notes registers the following default keyboard shortcuts. All can be rebound in **Keyboard Shortcuts** (`Ctrl+K Ctrl+S`).

| Command | Windows/Linux | macOS |
|---|---|---|
| Toggle todo | `Ctrl+Shift+Enter` | `Cmd+Shift+Enter` |
| Open today's journal | `Ctrl+Alt+J` | `Cmd+Alt+J` |
| Open backlinks panel | `Ctrl+Alt+B` | `Cmd+Alt+B` |
| Toggle tasks panel | `Ctrl+Alt+T` | `Cmd+Alt+T` |

Search for **AS Notes** in Keyboard Shortcuts to see the full list of bindable commands.
