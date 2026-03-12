---
title: Integrate a Kanban board
created: 2026-03-12T17:17:56.419Z
updated: 2026-03-12T17:31:25.370Z
sortOrder: 4
slug: integrate_a_kanban_board
worktree:
  branch: agentkanban/20260312_171756419_z5xd2k_integrate_a_kanban_board
  path: c:\Users\Gareth\src\as-notes-worktrees\20260312_171756419_z5xd2k_integrate_a_kanban_board
  created: 2026-03-12T17:31:25.370Z
---

## Conversation

[user]

We have a kanban extension we have built at `C:\Users\Gareth\src\vscode-agent-kanban`.

This kanban extension is aimed at assisting AI agent flows linked to a kanbanboard.

We want to take the kanban board and bring it into this project, but it will not have agent or git worktree functionality integrated.

Features to retain:

- Directory / file backed tasks (renamed stories to be distinct from existing markdown style tasks in this extension - can you recomend a better name thatn stories??) (these will be stored in the `kanban` directory relative to the root of the directory rather than an extension specific hidden directory, with directories for each lane as in the referenced implementation). 
- Multiple kanban boards will be supported. The user will be able to select and switch kanban boards from a text completion control like the wikilink search control in the sidebar in this extension. This will mean the lane directories will sit under kanban board directories
- Tailwind styling (look and feel is the same)
- Drag and drop kanban board
- Retain labels and assignees (the PKMS may be shared) - use a similar board.yaml

Features to change:

- Story files will be YAML based, and intended to be edited in the edit story (previously task view). YAML will help to break up entries / comments in the story and give structure - but still human readable, and version controllable
- Remove any Git / worktree functionality and check if there is anything else unnecessary that you want to ask me about