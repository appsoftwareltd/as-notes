# Kanban Board

The **AS Notes Kanban** sidebar and editor panel let you manage work visually with cards organised into lanes.

## Boards

A workspace can contain any number of named boards, stored as plain files in a `kanban/` directory at the AS Notes root. Each board has its own lanes and set of cards.

- **Create a board** — run **AS Notes: Create Kanban Board** from the Command Palette and enter a name. The first board is selected automatically on activation.
- **Switch board** — type in the board-switcher field in the sidebar to filter and select from existing boards. The editor panel opens automatically.
- **Rename board** — click **Rename** in the sidebar board header, or run **AS Notes: Rename Kanban Board**.
- **Delete board** — click **Delete** in the sidebar board header, or run **AS Notes: Delete Kanban Board**. Requires confirmation; all cards and assets are removed.

## Lanes

Each board starts with three lanes: **TODO**, **DOING**, and **DONE**. TODO and DONE are protected and cannot be removed or renamed.

In the editor panel:

- **Add lane** — click **+ Lane** in the board header.
- **Rename lane** — click the pencil icon on any non-protected lane header.
- **Remove lane** — click the × button; if the lane contains cards a confirmation is shown and cards are deleted along with it.
- **Reorder lanes** — drag a lane header to a new position.

## Cards

Cards are the primary unit of work. Each card is stored as a **Markdown file** with YAML front-matter for structured fields (title, lane, priority, assignee, labels, due date) and a Markdown body for free-form description. This means every card is a readable `.md` file you can open, edit, and diff with standard tools.

- **Create card** — click **+ Card** in any lane, or run **AS Notes: New Kanban Card**.
- **Move card** — drag a card between lanes, or use the lane drop-down in the card editor.
- **Open card editor** — click a card to open an inline modal with all fields editable.
- **Delete card** — click the trash icon in the card editor.
- **Open card file** — click the **Open File** button in the card editor to open the Markdown file directly.

**Priority levels:** P1 · P2 · P3 · P4 · P5 · none

## Entries (comments)

Each card has a log of timestamped entries. Type in the entry field at the bottom of the card modal and press **Add Entry** (or **Ctrl+Enter**). Entries show the author name (optional) and date in reverse-chronological order.

## Assets

Files can be attached to a card. In the card editor, drag and drop a file onto the attachment area, or click **Add Files**. Images render as thumbnails; other files show as named links. Clicking a file opens it in VS Code. Assets are stored in `kanban/<board>/assets/<card-id>/`.

A size warning is shown for files exceeding `as-notes.kanbanAssetSizeWarningMB` (default: 10 MB).

## Storage format

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

## Commands

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
