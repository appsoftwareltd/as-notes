---
task: task_20260310_155214785_4cg00z_outliner_style_hyphen_prefix_and_indentation_reten
---

## TODO

- [x] Write OutlinerService tests (TDD — failing first)
- [x] Implement OutlinerService.ts (make tests pass)
- [x] Update package.json — setting, commands, keybindings
- [x] Register outliner commands and listeners in extension.ts
- [x] Build and verify no compile errors
- [x] Add toggleOutlinerTodoLine tests (TDD)
- [x] Implement toggleOutlinerTodoLine in OutlinerService
- [x] Update toggleTodoCommand to use outliner variant when in outliner mode

### Iteration 3 — Code fence + Paste edge cases

- [x] Write code-fence tests (TDD — isCodeFenceOpen, getCodeFenceEnterInsert)
- [x] Implement code-fence logic in OutlinerService.ts
- [x] Update outlinerEnter command in extension.ts for code-fence detection
- [x] Write paste tests (TDD — formatOutlinerPaste)
- [x] Implement paste logic in OutlinerService.ts
- [x] Wire paste command in extension.ts + package.json keybinding
- [x] Build and run all tests
- [x] Update TECHNICAL.md with outliner mode section

### Iteration 4 — Standalone fence open + Closing fence → bullet

- [x] Write tests for isStandaloneCodeFenceOpen, getStandaloneCodeFenceEnterInsert
- [x] Write tests for isClosingCodeFenceLine, getClosingFenceBulletInsert
- [x] Implement standalone fence + closing fence logic in OutlinerService
- [x] Add onCodeFenceLine context key in extension.ts
- [x] Update Enter keybinding when clause (add onCodeFenceLine)
- [x] Update outlinerEnter command handler for new cases + fallthrough
- [x] Build and run all tests (573 passing, 14 files)
- [x] Update TECHNICAL.md

### Iteration 5 — Code fence completion outside outliner mode

- [x] Register codeFenceEnter command in extension.ts
- [x] Add Enter keybinding for code fence when !outlinerMode
- [x] Build and run all tests (573 passing, 14 files)
- [x] Update TECHNICAL.md

### Iteration 6 — Fence balance detection + codeFenceEnter in both modes

- [x] Write isCodeFenceUnbalanced tests (TDD — 14 tests)
- [x] Implement isCodeFenceUnbalanced in OutlinerService
- [x] Rewrite codeFenceEnter handler with balance check + bullet closer detection
- [x] Simplify outlinerEnter (remove standalone/closing fence branches)
- [x] Update keybindings (codeFenceEnter in both modes, outlinerEnter bullet-only)
- [x] Build and run all tests (587 passing, 14 files)
- [x] Update TECHNICAL.md

### Iteration 7 — Hybrid fence balance + indent guard

- [x] Write failing tests for isCodeFenceUnbalanced updates + getMaxOutlinerIndent (TDD — 11 failing)
- [x] Upgrade isCodeFenceUnbalanced to hybrid 2-phase algorithm (language-aware + surrounding-balanced)
- [x] Implement getMaxOutlinerIndent in OutlinerService
- [x] Update outlinerIndent handler with indent guard
- [x] Build and run all tests (597 passing, 14 files)
- [x] Update TECHNICAL.md

### Iteration 8 — Bare fence after balanced pair + context key fix

- [x] Add 4 tests for bare ``` after balanced pair scenarios (all pass — algorithm correct)
- [x] Fix syncOutlinerLineContext to also check isClosingCodeFenceLine
- [x] Build and run all tests (601 passing, 14 files)
