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

## Iteration 2 — Insert at task start + cursor restore

- [x] Add `TASK_PREFIX_RE` constant and `insertTagAtTaskStart(editor, tag)` helper to `DatePickerService.ts`
- [x] Update `insertTaskDueDate()` to call `insertTagAtTaskStart`
- [x] Convert #P1, #P2, #P3, #W slash commands to command-based in `SlashCommandProvider.ts`
- [x] Register `as-notes.insertTaskHashtag` command in `extension.ts`
- [x] Verify build compiles without errors
