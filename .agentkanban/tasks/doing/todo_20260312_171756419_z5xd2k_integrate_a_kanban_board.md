---
task: task_20260312_171756419_z5xd2k_integrate_a_kanban_board
---

## TODO

### Iteration 1 — Core Types, Stores, and Build

- [ ] Create `KanbanTypes.ts` — Card, BoardConfig, Priority, Asset, lane helpers
- [ ] Create `KanbanStore.ts` — Read/write YAML card files, asset management
- [ ] Create `KanbanBoardConfigStore.ts` — board.yaml, lane mgmt, board CRUD, metadata reconciliation
- [ ] Add `yaml` npm dependency to vs-code-extension/package.json
- [ ] Write unit tests for KanbanTypes, KanbanStore, KanbanBoardConfigStore

### Iteration 2 — Editor Panel and Webview

- [ ] Create `KanbanEditorPanel.ts` — Full board WebviewPanel, message handlers
- [ ] Create `src/webview/kanban.ts` — Board rendering, drag-and-drop, modals, card detail, assets, lightbox
- [ ] Create `src/webview/kanban.css` — Tailwind + VS Code theme styling (port from vscode-agent-kanban)
- [ ] Update `build.mjs` — Add kanban webview entry point and CSS build

### Iteration 3 — Sidebar, Commands, and Registration

- [ ] Create `KanbanSidebarProvider.ts` — Board selector + lane summary (WebviewViewProvider)
- [ ] Create sidebar webview files if needed (or embed in provider)
- [ ] Update `package.json` — Commands, views, keybindings, configuration
- [ ] Register kanban components in `extension.ts` — commands, providers, file watchers
- [ ] Update `.asnotesignore` default to include `kanban/`
- [ ] Update `initWorkspace` to create `kanban/` directory

### Iteration 4 — Polish and Documentation

- [ ] Update `TECHNICAL.md` — Kanban board section
- [ ] Build and verify — `npm run build`, check for errors
- [ ] Run all tests — `npm test`

### Test Feedback — Iteration 4

- [x] Board switcher shows display names (not slugs) — send `{slug, name}[]` from provider
- [x] Delete button lighter grey colour
- [x] Compact lane counts — horizontal row with headers and counts
- [x] Confirm asset cleanup on card delete (already implemented)
- [x] Add rename board button floated right of board name in sidebar

### YAML → Markdown Transition

- [ ] KanbanTypes.ts: Remove CardEntry, add CardEntryDisplay, update Card interface
- [ ] KanbanStore.ts: Change filename format to card_<slug>_<uuid>.md
- [ ] KanbanStore.ts: Rewrite serialise() to output markdown+frontmatter
- [ ] KanbanStore.ts: Rewrite deserialise() to parse frontmatter + ## entry headings
- [ ] KanbanStore.ts: Update loadCardsFromDirectory() for .md files
- [ ] KanbanStore.ts: Update getCardUri(), save(), moveCardToLane(), delete() for .md extension
- [ ] KanbanEditorPanel.ts: Remove addEntry handler, remove pending entry logic
- [ ] webview/kanban.ts: Make entries read-only, remove entry creation UI
- [ ] SlashCommandProvider.ts: Add Card: Entry Date command for kanban files
- [ ] extension.ts: Remove kanban/ from default .asnotesignore patterns
- [ ] KanbanStore.test.ts: Rewrite tests for new format
- [ ] KanbanTypes.test.ts: Update for interface changes
- [ ] Build and run all tests
