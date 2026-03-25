# Settings

All AS Notes settings are available in VS Code Settings (`Ctrl+,`). Search for `as-notes` to see them all.

## General Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.periodicScanInterval` | `300` | Seconds between automatic background scans for file changes. Set to `0` to disable periodic scanning. Minimum effective value: `30`. |
| `as-notes.assetPath` | `assets/images` | Workspace-relative folder where dropped and pasted files (images, etc.) are saved. See [[Images and Files]]. |
| `as-notes.enableLogging` | `false` | Enable diagnostic logging to `.asnotes/logs/`. Uses rolling 10 MB files (max 5). Requires a VS Code window reload after changing. Also activated by setting the `AS_NOTES_DEBUG=1` environment variable. |

## Journal Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.journalFolder` | `journals` | Folder for daily journal files, relative to the workspace root. See [[Daily Journal]]. |

## Backlinks Panel Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.backlinkGroupByChain` | `false` | Default view mode for the Backlinks panel. `false` = flat by page, `true` = grouped by chain pattern. See [[Backlinks]]. |
| `as-notes.backlinkWrapContext` | `false` | Default context verbosity. `false` = compact (single-line), `true` = wrapped (full text). |

## Pro Settings

| Setting | Default | Description |
|---|---|---|
| `as-notes.licenceKey` | *(empty)* | AS Notes Pro licence key (format: `ASNO-XXXX-XXXX-XXXX-XXXX`). Unlocks table commands and encrypted notes. Enter via **AS Notes: Enter Licence Key** in the Command Palette, or paste directly here. Stored at machine scope (not synced across devices). See [[Encrypted Notes]]. |

## Inline Editor Settings

The inline editor renders Markdown formatting directly in the text editor (Typora-like syntax shadowing). All settings are under the `as-notes.inlineEditor` namespace.

| Setting | Default | Description |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | Enable/disable inline Markdown rendering. Also togglable via the **AS Notes: Toggle Inline Editor** command or the eye icon in the editor title bar. |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | Opacity (0-1) for syntax characters in ghost state (cursor on the same line but outside the construct). |
| `as-notes.inlineEditor.decorations.frontmatterDelimiterOpacity` | `0.6` | Opacity for YAML frontmatter `---` delimiters. |
| `as-notes.inlineEditor.decorations.codeBlockLanguageOpacity` | `0.5` | Opacity for the language identifier on fenced code blocks (e.g. `javascript`). |
| `as-notes.inlineEditor.defaultBehaviors.diffView.applyDecorations` | `false` | Apply inline decorations in diff views. |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | Open links with a single click instead of Ctrl+Click. |
| `as-notes.inlineEditor.defaultBehaviors.emoji` | `true` | Render `:emoji:` shortcodes as emoji characters. |
| `as-notes.inlineEditor.defaultBehaviors.math` | `true` | Render `$...$` and `$$...$$` math expressions inline. |
| `as-notes.inlineEditor.defaultBehaviors.mentionLinks` | `true` | Render `@user` mentions as clickable links. |

Colour overrides (leave empty to use theme defaults):

| Setting | Default | Description |
|---|---|---|
| `as-notes.inlineEditor.colors.heading1` | *(empty)* | Colour for H1 headings |
| `as-notes.inlineEditor.colors.heading2` | *(empty)* | Colour for H2 headings |
| `as-notes.inlineEditor.colors.heading3` | *(empty)* | Colour for H3 headings |
| `as-notes.inlineEditor.colors.heading4` | *(empty)* | Colour for H4 headings |
| `as-notes.inlineEditor.colors.heading5` | *(empty)* | Colour for H5 headings |
| `as-notes.inlineEditor.colors.heading6` | *(empty)* | Colour for H6 headings |
| `as-notes.inlineEditor.colors.bold` | *(empty)* | Colour for bold text |
| `as-notes.inlineEditor.colors.italic` | *(empty)* | Colour for italic text |
| `as-notes.inlineEditor.colors.strikethrough` | *(empty)* | Colour for strikethrough text |
| `as-notes.inlineEditor.colors.link` | *(empty)* | Colour for links |
| `as-notes.inlineEditor.colors.inlineCode` | *(empty)* | Colour for inline code |

## Keyboard Shortcuts

AS Notes registers the following default keyboard shortcuts. All can be rebound in **Keyboard Shortcuts** (`Ctrl+K Ctrl+S`).

| Command | Windows/Linux | macOS |
|---|---|---|
| Toggle todo | `Ctrl+Shift+Enter` | `Cmd+Shift+Enter` |
| Open today's journal | `Ctrl+Alt+J` | `Cmd+Alt+J` |
| Open backlinks panel | `Ctrl+Alt+B` | `Cmd+Alt+B` |
| Toggle tasks panel | `Ctrl+Alt+T` | `Cmd+Alt+T` |

Search for **AS Notes** in Keyboard Shortcuts to see the full list of bindable commands.
