# Changelog

All notable changes to AS Notes will be documented here.

## [0.1.0] — 2026-03-01

### Added

- Wikilink highlighting — default subtle blue, active bright blue with underline when cursor is inside
- Ctrl+Click (Cmd+Click on macOS) navigation via `[[wikilinks]]` to open target `.md` files
- Auto-create missing pages on navigation with an information notification
- Hover tooltips showing target filename, existence status, and backlink count
- Nested wikilink support to arbitrary depth — each nesting level is independently navigable
- Link rename synchronisation — editing wikilink text offers to rename the corresponding file and update all matching links across the workspace
- Page aliases via YAML front matter (`aliases:` field) — alias rename tracking and alias-aware hover tooltips
- Subfolder link resolution with global index search, same-directory preference, and closest-folder disambiguation
- Wikilink autocomplete triggered by `[[` — pages, forward references, and aliases, with auto-close `]]`
- Persistent SQLite index (`.asnotes/index.db`) tracking pages, links, aliases, and backlinks
- Case-insensitive file matching across all platforms
- Filename sanitisation — invalid characters replaced with `_`
- Forward-reference links — linking to pages before they exist; they appear in autocomplete
- Background periodic scan to keep the index in sync with external file changes
- `.asnotes/` directory as workspace initialisation marker (`AS Notes: Initialise Workspace` command)
- `AS Notes: Rebuild Index` command for manual index recovery
