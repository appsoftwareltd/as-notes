---
task: task_20260311_101026590_3r07rf_slash_commands_required_for_task_hashtags
---

## TODO

- [x] Read task file and investigate codebase context
- [x] Plan implementation approach (document in task file)
- [x] Add `insertTaskDueDate()` to `DatePickerService.ts`
- [x] Add 5 task slash commands to `SlashCommandProvider.ts` (P1, P2, P3, Waiting, Due Date)
- [x] Register `as-notes.insertTaskDueDate` command in `extension.ts`
- [x] Verify build compiles without errors

## Iteration 3 — Insert after existing hashtags + task-line-only visibility

- [x] Update `TASK_PREFIX_RE` with two capture groups to detect existing leading hashtags
- [x] Update insert column = `match[1].length + match[2].length`
- [x] Gate all 5 Task slash commands behind `isTaskLine` check in `SlashCommandProvider.ts`
- [x] Verify build compiles without errors

## Iteration 4 — Replace existing priority tag

- [x] Add `PRIORITY_TAG_RE` and `EXISTING_PRIORITY_RE` constants
- [x] Update `insertTagAtTaskStart` to replace existing priority instead of inserting
- [x] Verify build compiles without errors
## Iteration 2 — Insert at task start + cursor restore

- [x] Add `TASK_PREFIX_RE` constant and `insertTagAtTaskStart(editor, tag)` helper to `DatePickerService.ts`
- [x] Update `insertTaskDueDate()` to call `insertTagAtTaskStart`
- [x] Convert #P1, #P2, #P3, #W slash commands to command-based in `SlashCommandProvider.ts`
- [x] Register `as-notes.insertTaskHashtag` command in `extension.ts`
- [x] Verify build compiles without errors
