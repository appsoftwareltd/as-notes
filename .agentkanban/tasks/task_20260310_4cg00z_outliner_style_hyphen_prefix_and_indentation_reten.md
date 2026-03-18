---
title: Outliner style hyphen prefix and indentation retention
lane: doing
created: 2026-03-10T15:52:14.785Z
updated: 2026-03-11T10:32:01.819Z
sortOrder: 1
---

## Conversation

[user]

We want a workpace setting that the user can also toggle via the commands to turn on / off "Outliner Mode"

In outliner mode

```
- Test
- <- next line automatically gets a hyphen + single space
```


```
- Test
    - Test
    - <- On enter indentation is retained, and a hyphen + single space is inserted
        - Test 
        - <- On enter indentation is retained, and a hyphen + single space is inserted
```

I want to bind the behaviour that you would get with `Ctrl + [ / ]` to the tab key - that is single an multiline tab indentation an un-indent

Shift tab already provides this behaviour for unidenting, but tab on its own only provides the correct behaviour in this context if the cursor is infront of the hyphen at the start (indented or otherwise) of the line

We want tab to behave like `Ctrl + ]` (I think that just means that we can't do a normal tab in outliner mode). This may not be an issue but say if you think there is a good work around (we can't use Ctrl + Tab or Alt + Tab or Command / Windows Key + Tab as these are bound to other functions). 

If outliner mode only applies if the line indented or otherwise starts with a hyphen, then we should be able to work in normal markdown mode in other areas of the document

[agent]

Good plan. Here's the proposed design:

## Outliner Mode — Design Plan

### Setting

A new workspace setting `as-notes.outlinerMode` (boolean, default `false`) with description explaining outliner behaviour. Toggled via command `as-notes.toggleOutlinerMode`, which appears in the command palette and updates the workspace setting.

### Context Keys (VS Code `when` clause variables)

Two context keys will be maintained:

- **`as-notes.outlinerMode`** — mirrors the setting value; updated on activation and on config change.
- **`as-notes.onBulletLine`** — `true` when the active cursor line (in a markdown editor) matches `/^\s*- /`; updated continuously via `onDidChangeTextEditorSelection`.

This combination allows keybindings to be scoped precisely: they only activate when in outliner mode *and* the cursor is on a bullet line. This preserves normal behaviour everywhere else in the document, satisfying the "normal markdown mode in other areas" requirement without any manual fall-through logic.

[comment] Does this mean we could have outliner mode without the bullet line? Is this necessary? Whats the benefit? Does it over -complicate this?

### Behaviour

#### Enter key

Keybinding: `Enter` when `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine && !suggestWidgetVisible && editorHasSelection == false`

Logic (`as-notes.outlinerEnter` command):

1. Detect the indentation depth and `- ` prefix on the current line.
2. **Empty bullet** (content after `- ` is whitespace-only, cursor is at/after the `- `): replace the whole line with just the indentation (escape mechanism — removes the trailing empty bullet).
3. **Non-empty bullet**: replace from cursor to end-of-line with `\n{indent}- {text_after_cursor}`, effectively splitting the line and creating a new bullet with the same indentation.

#### Tab key

Keybinding: `Tab` when `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine`

Executes the built-in `editor.action.indentLines` (same as `Ctrl+]`). Since this only fires when `as-notes.onBulletLine` is true, Tab reverts to normal VS Code behaviour on non-bullet lines with no extra logic needed.

**Note**: Tab cannot insert a literal tab character in this mode on bullet lines, but this is acceptable per the task description ("I think that just means that we can't do a normal tab in outliner mode").

#### Shift+Tab key

Keybinding: `Shift+Tab` when `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine`

Executes the built-in `editor.action.outdentLines` (same as `Ctrl+[`). The user notes this already works via Shift+Tab, so this just makes it explicit and consistent.

### Files

- **New**: `vs-code-extension/src/OutlinerService.ts` — pure logic (`isOnBulletLine`, `handleOutlinerEnter`), no VS Code dependencies, fully unit-testable.
- **New**: `vs-code-extension/src/test/OutlinerService.test.ts` — unit tests for the logic.
- **Modified**: `vs-code-extension/src/extension.ts` — register commands and listeners in `activate()` (not in `enterFullMode()`, as outliner mode needs no index).
- **Modified**: `vs-code-extension/package.json` — new setting, commands, and keybindings.

### Questions / Clarifications

1. **Empty bullet escape**: On an empty `- ` line, should Enter remove the line entirely (leaving a blank line) or remove just the `- ` and leave the indentation-only line? I've proposed removing the `- ` and leaving the indent — but we could also remove the whole line. [comment: I think I would prefer to leave the hyphen and the indent]

2. **Multi-cursor support**: All the behaviour will work with multiple cursors (each cursor on its own bullet line). Do you want to support the case where some cursors are on bullet lines and some are not simultaneously? (Current plan: if any selection's active line triggers `as-notes.onBulletLine`, all cursors run the outliner behaviour — similar to how Ctrl+] works.) [comment Yes - all cursors run the outliner behaviour]

3. **Shift+Tab override**: I've proposed also explicitly binding Shift+Tab. Given you said it already works, would you prefer to leave Shift+Tab untouched? [comment - no, make the binding explicit]

4. **`- [ ]` and `- [x]` lines**: Todo-checkbox lines also start with `- `. Should Enter on these lines create a new `- ` (plain bullet) or a new `- [ ] ` (new todo item), or should these be excluded from outliner enter behaviour? [comment - a new a new `- [ ] `]

[user] See inline comments

[agent]

Thanks — all comments received. Here's the finalised plan with all points resolved:

### Resolved clarifications

**1. `onBulletLine` context key** (your comment: "Does this mean we could have outliner mode without the bullet line? Is this necessary? Whats the benefit? Does it over-complicate this?")

The `as-notes.onBulletLine` context key is required, low complexity, and is not user-facing. VS Code keybinding `when` clauses can only use context keys — they can't call arbitrary logic. Without `onBulletLine`, Tab and Enter would be intercepted on *all lines* when outliner mode is on, breaking normal typing everywhere else. The context key is maintained via a single `onDidChangeTextEditorSelection` listener (a few lines) and is transparent to the user. There is no simpler correct approach.

**2. Empty bullet behaviour** (your comment: "I think I would prefer to leave the hyphen and the indent")

Understood — no escape mechanism. Enter on an empty `- ` always inserts a new `- ` below at the same indent. The bullet and indent are always preserved. To escape, the user toggles outliner mode off, or simply edits manually.

**3. Multi-cursor** (your comment: "Yes - all cursors run the outliner behaviour")

Confirmed — all cursors apply outliner Enter regardless of whether some are on non-bullet lines.

**4. `- [ ]` / `- [x]` lines** (your comment: "a new `- [ ] `")

Confirmed — Enter on a todo checkbox line (`- [ ] ...` or `- [x] ...`) inserts a new `- [ ] ` at the same indentation.

---

### Finalised Design

**Setting:** `as-notes.outlinerMode` (bool, default `false`, workspace scope). Toggled via `as-notes.toggleOutlinerMode` command.

**Context keys** (internal, managed in `activate()`):
- `as-notes.outlinerMode` — synced to setting on activation and config change
- `as-notes.onBulletLine` — `true` when active line matches `/^\s*-\s/`, updated on cursor move

**Enter (`as-notes.outlinerEnter`):**
- When: `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine && !suggestWidgetVisible && editorHasSelection == false`
- Logic for each cursor:
  - Line is `- [ ] ...` or `- [x] ...` → insert `\n{indent}- [ ] ` (new unchecked todo)
  - Line is `- ...` (plain bullet) → insert `\n{indent}- ` (new plain bullet)
  - Empty bullet (`- ` with nothing after, or only whitespace) → same as above (no escape; always creates new bullet)

**Tab (`as-notes.outlinerIndent`):**
- When: `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine`
- Executes: `editor.action.indentLines`

**Shift+Tab (`as-notes.outlinerOutdent`):**
- When: `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine`
- Executes: `editor.action.outdentLines`

**Files:**
- **New** `vs-code-extension/src/OutlinerService.ts` — pure logic, no VS Code deps
- **New** `vs-code-extension/src/test/OutlinerService.test.ts` — unit tests (TDD first)
- **Modified** `vs-code-extension/src/extension.ts` — register in `activate()` (no index needed)
- **Modified** `vs-code-extension/package.json` — setting, commands, keybindings

Ready to proceed to `todo` and `implement` when you are.

[user]

todo implement

[agent]

Implementation complete. All 487 tests pass, build clean.

### What was implemented

**New file: `vs-code-extension/src/OutlinerService.ts`**
Pure-logic service (no VS Code dependencies):
- `isOnBulletLine(lineText)` — returns `true` for any line starting with optional whitespace + `- ` 
- `getOutlinerEnterInsert(lineText)` — returns the string to insert at cursor:
  - `\n{indent}- [ ] ` for todo lines (`- [ ]` / `- [x]`)
  - `\n{indent}- ` for plain bullets

**New file: `vs-code-extension/src/test/OutlinerService.test.ts`**
24 unit tests (written first, TDD).

**Modified: `vs-code-extension/package.json`**
- New setting: `as-notes.outlinerMode` (bool, default `false`, workspace scope)
- New commands: `as-notes.toggleOutlinerMode`, `as-notes.outlinerEnter`, `as-notes.outlinerIndent`, `as-notes.outlinerOutdent`
- New keybindings (all scoped to `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine`):
  - `Enter` → `as-notes.outlinerEnter` (also guards `!suggestWidgetVisible && editorHasSelection == false && !inlineSuggestionVisible`)
  - `Tab` → `as-notes.outlinerIndent`
  - `Shift+Tab` → `as-notes.outlinerOutdent`

**Modified: `vs-code-extension/src/extension.ts`**
Registered in `activate()` (no index required):
- `as-notes.outlinerMode` context key — synced to setting on activation and config change
- `as-notes.onBulletLine` context key — updated on every selection change and editor change
- `as-notes.toggleOutlinerMode` — flips the workspace setting and shows a notification
- `as-notes.outlinerEnter` — for each cursor: deletes text from cursor to end-of-line, then inserts `\n{indent}- ` or `\n{indent}- [ ] `
- `as-notes.outlinerIndent` / `as-notes.outlinerOutdent` — delegate to `editor.action.indentLines` / `editor.action.outdentLines`

[user]

This works well. One edge case. If we are in outliner mode and the user toggles a task (Ctrl + Shift + Enter) the flow goes as follows. On the 3rd toggle the bullet is removed where we would actual want `- ` to remain

```
- [ ] <- Toggle 1 
- [x] <- Toggle 2
      <- Toggle 3 
-     <- Desired on Toggle 3
```

[agent]

Good catch. The existing `toggleTodoLine` cycle on a done todo strips the `- ` entirely (done → plain text). In Outliner Mode on a bullet line we want to keep the `- ` (done → plain bullet).

### Proposed fix

Add a new function `toggleOutlinerBulletLine(lineText)` to `OutlinerService.ts` that runs a modified 3-state cycle:

| Current state | Normal toggle result | Outliner toggle result |
|---|---|---|
| `- [x] text` (done) | `text` (plain text, no bullet) | `- text` (plain bullet) |
| `- [ ] text` (unchecked) | `- [x] text` | `- [x] text` (same) |
| `- text` (plain bullet) | `- [ ] text` (adds checkbox) | `- [ ] text` (same) |

In `extension.ts`, `toggleTodoCommand` currently calls `toggleTodoLine(line.text)` for every cursor. The fix is: if `as-notes.outlinerMode` is enabled AND the line `isOnBulletLine`, use `toggleOutlinerBulletLine` instead.

This keeps `TodoToggleService.ts` untouched and the outliner-specific cycle lives entirely in `OutlinerService.ts` where it belongs.

One question: your desired Toggle 3 shows `- ` with trailing space and no content after (since the original `- [ ]` had no content). That's correct — the plain bullet prefix is always `{indent}- ` regardless of content. Confirmed?

[user]

todo implement

[agent]

Edge case fix implemented. 497 tests, all passing, build clean.

### What changed

**`vs-code-extension/src/test/OutlinerService.test.ts`** — 10 new tests for `toggleOutlinerTodoLine`:
- plain bullet → unchecked todo
- unchecked todo → done todo
- done todo → plain bullet (the fix — keeps `- ` instead of stripping it)
- full 3-state cycle: `- item` → `- [ ] item` → `- [x] item` → `- item`

**`vs-code-extension/src/OutlinerService.ts`** — new `toggleOutlinerTodoLine(lineText)` export:
- Same 3-state cycle as `toggleTodoLine` except: **done → plain bullet** (not plain text)
- `- [x] item` → `- item` (indent preserved)

**`vs-code-extension/src/extension.ts`** — `toggleTodoCommand` updated:
- When `as-notes.outlinerMode` is on AND the line `isOnBulletLine`, uses `toggleOutlinerTodoLine`
- Otherwise falls back to the original `toggleTodoLine` — no change to non-outliner behaviour

[user] Agreed

[user]

Further edge cases identified:

### If the user pastes data, the data, when in outliner mode needs to added as separate bullet points with line breaks removed. e.g

```
Hello,

This is some email correspondence

Bye
```

becomes

```
- Hello,
- This is some email correspondence
- Bye
```

If the original bullet is indented:

```
- Parent
    - <- Original bullet
```

becomes

```
- Parent
    - Hello,
    - This is some email correspondence
    - Bye
```

### If the user is on a task line

```
- Parent
    - [ ] <- Original bullet
```

becomes

```
- Parent
    - [ ] Hello,
    - [ ] This is some email correspondence
    - [ ] Bye
```
* Createed tasks will always be unchecked
* If the line that was pasted onto was checked to being with, that remains checked while the newly created ones are unchecked

```
- Parent
    - [x] <- Original bullet
```

becomes

```
- Parent
    - [x] Hello,
    - [ ] This is some email correspondence
    - [ ] Bye
```



### If the user opens multiline backticks and hits enter (with or without lang), no bullet is added for the next line and indentation is retained


```
- Parent
    - ``` <- Enter key press
```

becomes

```
- Parent
    - ```
      <- Cursor placed inside
      ```
```

Or with language


```
- Parent
    - ```javascript <- Enter key press
```

becomes

```
- Parent
    - ```javascript
      <- Cursor placed inside
      ```
```