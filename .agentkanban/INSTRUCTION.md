# Agent Kanban — Instruction

You are working with the **Agent Kanban** extension. Follow these workspace structure, file format, and workflow rules strictly.

## Directory Structure

```
.agentkanban/
  .gitignore          # Auto-generated — ignores logs/
  board.yaml          # Lane definitions (slug list) and base prompt
  memory.md           # Persistent memory across tasks (reset via command)
  INSTRUCTION.md      # This file — agent instructions
  tasks/
    todo/             # Lane directories — one per lane
      task_<id>_<slug>.md
      todo_<id>_<slug>.md
    doing/
    done/
    archive/          # Archived tasks (hidden from board)
  logs/               # Diagnostic logs (gitignored)
```

## Task File Format

Stored under `.agentkanban/tasks/<lane>/` as `task_<YYYYMMdd>_<HHmmssfff>_<unique_id>_<slug>.md`. The lane a task belongs to is determined by its directory (e.g. `tasks/doing/`), not by a frontmatter field. Stay working in the given task file until a new one is assigned.

Each task is a markdown file with YAML frontmatter:

```markdown
---
title: <Task Title>
created: <ISO 8601>
updated: <ISO 8601>
description: <Brief description>
---

IMPORTANT: The task lane is managed by the user / extension (by moving the file between directories). You do not change the lane.
IMPORTANT: The conversation should happen in the task file. You may use the chat window, but keep it to summary information. Planning and recording of what action was taken goes in the task file.

## Conversation

[user] 

<message>

[agent] 

<response>

[user]
```

**Rules:**

- Append new entries at the end — never modify or delete existing ones
- Start each message with `[user]` or `[agent]` on its own line; blank line between messages
- After your response, you must `[user]` on a new line for the user's next entry
- Look for and honor inline `[comment] <text>` annotations from the user
- Ask questions and give the user options if is needed or may improve the final implementation.
- ALWAYS start and finish conversations in the chat window with `Conversing in file: task_<YYYYMMdd>_<HHmmssfff>_<unique_id>_<slug>.md` (but do not add this text to the conversation markdown - keep it in the chat window)
- Always re-read this INSTRUCTION.md file at the start of every action.
- **At the start of each response, confirm which task file you are working in.** If no task file is in context, state this and ask the user to select one with `@kanban /task`.
- If you cannot find a task file reference in the conversation, search `.agentkanban/tasks/` for files in non-done lanes and ask the user which task to work on.

## TODO File Format

Mirrors the task filename with `todo_` prefix - `todo_<YYYYMMdd>_<HHmmssfff>_<unique_id>_<slug>.md`. **Create it if it doesn't exist.**

```markdown
---
task: task_<YYYYMMdd>_<HHmmssfff>_<unique_id>_<slug>
---

## TODO

- [ ] Uncompleted item
- [x] Completed item
```

**Rules:** Use `- [ ]` / `- [x]` checkboxes. Keep items concise and actionable. Check off items as completed. Group under iteration headings. Append new items at the end; preserve ordering.

## Memory

`.agentkanban/memory.md` persists across tasks. Read it at the start of each task. Update it with project conventions, key decisions, and useful context for future tasks.

## Technical Document

Maintain `TECHNICAL.md` at workspace root with implementation details (for agents/LLMs and humans). Update the appropriate section when making changes.

## Command Rules

A task file name exists in the context — converse and collaborate **only** in that file for this task.

### Flow

Iterative cycle: **plan** → **todo** → **implement**

Use `@kanban /plan`, `@kanban /todo`, or `@kanban /implement` in chat to refresh context and keep instructions prominent in long conversations. Combine verbs with `#` tags (e.g. `@kanban /todo #implement`). Then type **go** to begin.

### Verbs

Verbs can be combined (e.g. `@kanban /todo #implement`). Without `implement`, **never write code or create files**.

#### `plan`
Discuss, analyse, and plan the task collaboratively. Read the conversation, reason about requirements, explore approaches, record decisions. Append responses using `[agent]` markers. **No code, no files, no TODOs** unless combined with `implement`.

#### `todo`
Create/update the TODO checklist based on the planning conversation. Read the task conversation for context. Write clear, actionable `- [ ]` items. **No implementation** unless combined with `implement`.

#### `implement`
Implement per the plan and TODOs. Read both task and todo files. Write clean, robust code. Check off TODO items as completed. Append a summary to the conversation. **Do not deviate** from the agreed plan without noting why.
