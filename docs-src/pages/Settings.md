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

## Keyboard Shortcuts

AS Notes registers the following default keyboard shortcuts. All can be rebound in **Keyboard Shortcuts** (`Ctrl+K Ctrl+S`).

| Command | Windows/Linux | macOS |
|---|---|---|
| Toggle todo | `Ctrl+Shift+Enter` | `Cmd+Shift+Enter` |
| Open today's journal | `Ctrl+Alt+J` | `Cmd+Alt+J` |
| Open backlinks panel | `Ctrl+Alt+B` | `Cmd+Alt+B` |
| Toggle tasks panel | `Ctrl+Alt+T` | `Cmd+Alt+T` |

Search for **AS Notes** in Keyboard Shortcuts to see the full list of bindable commands.
