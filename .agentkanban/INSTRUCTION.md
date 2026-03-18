# Agent Kanban — Instruction

You are working with the **Agent Kanban** extension.

IMPORTANT: Follow these workspace structure, file format, and workflow rules strictly.

Agent Kanban structures a `plan → todo → implement` workflow where conversation between you (the agent) and the user happens in task files. Use the chat window only for summaries and chain of thought. Planning, decisions, and actions taken go in the task file to maintain a clear record.

IMPORTANT: Always respond in the task file, not the chat window. Stay in the assigned task file until a new one is given.

## Task Directory Structure

```
.agentkanban/
  .gitignore          # Auto-generated — ignores logs/
  board.yaml          # Lane definitions (slug list) and base prompt
  memory.md           # Persistent memory across tasks (reset via command)
  INSTRUCTION.md      # This file — agent instructions
  tasks/
    task_<id>_<slug>.md    # Task files (lane stored in frontmatter)
    todo_<id>_<slug>.md    # TODO files (lane stored in frontmatter)
    archive/               # Archived tasks (hidden from board)
  logs/               # Diagnostic logs (gitignored)
```

## Task File Format

IMPORTANT: The task lane is managed by the user/extension via frontmatter. You do not change the lane.

Each task is a markdown file with YAML frontmatter. Conversation flows under `### user` and `### agent` headings. The user may add inline comments `[comment: <text>]` on your responses — check for these:

```markdown
---
title: <Task Title>
lane: <lane-slug>
created: <ISO 8601>
updated: <ISO 8601>
description: <Brief description>
---

## Conversation

### user

<message>

### agent

<response> [comment: <inline comment by the user>]

### user

...
```

**Rules:**

- Append new entries at the end — never modify or delete existing ones
- Start each message with `### user` or `### agent` on its own line; blank line between messages
- After your response, add `### user` on a new line for the user's next entry
- Honour inline `[comment: <text>]` annotations from the user
- Ask questions and give options where needed to improve the final outcome
- Start and finish chat window turns with `Conversing in file: task_<YYYYMMdd>_<unique_id>_<slug>.md` (do not add this to the task markdown)
- Re-read this INSTRUCTION.md at the start of every action
- **Confirm which task file you are working in at the start of each response.** If none is in context, ask the user to select one with `@kanban /task`.
- If no task file reference is found, ask the user to run `@kanban /task` or `/refresh`.

## TODOs

Track implementation progress with `- [ ]` / `- [x]` checkboxes in the corresponding todo file for th task. Mark items as completed during / following implementation. Always add new items and iterations to the bottom of the todos.

```markdown

# Iteration <iteration number>

- [ ] Uncompleted item
- [x] Completed item
```

## Memory

`.agentkanban/memory.md` persists across tasks. Read it at the start of each task. Update it with project conventions, key decisions, and useful context.

## Technical Document

Maintain `TECHNICAL.md` at workspace root with implementation details for agents and humans. Update the relevant section when making changes.

### Workflow

Iterative cycle: **plan** → **todo** → **implement**

The user sets the working task via `@kanban /task <name>` and uses `@kanban /refresh` to re-inject context in long conversations. The user then types a command verb (`plan`, `todo`, `implement`) to direct the agent.

In a **worktree workspace**, AGENTS.md permanently contains the task reference — context is always available without `/task` or `/refresh`.

IMPORTANT: Do not implement changes unless the `implement` verb is used.
IMPORTANT: Do not add or commit to version control unless specifically instructed.

### Command Verbs

Command verbs direct the action during each phase. The user may combine verbs (e.g. `todo implement`) to action multiple phases in one turn.

Shorthand single-letter aliases are also accepted and may be combined freely (e.g. `ti` or `t i` means `todo implement`, `pti` means `plan todo implement`):

| Verb | Shorthand |
|------|-----------|
| `plan` | `p` |
| `todo` | `t` |
| `implement` | `i` |

The intent of each verb is:

#### plan
Discuss, analyse, and plan the task collaboratively. Read the conversation, reason about requirements, explore approaches, record decisions. **No code, no files, no TODOs.**

#### todo
Create/update the TODO checklist from the planning conversation. Write clear, actionable `- [ ]` items. **No implementation** unless the user explicitly asks.

#### implement
Implement per the plan and TODOs. Read both task and todo files. Write clean, robust code. Check off items as completed. Append a summary to the conversation. **Do not deviate** from the plan without noting why.
