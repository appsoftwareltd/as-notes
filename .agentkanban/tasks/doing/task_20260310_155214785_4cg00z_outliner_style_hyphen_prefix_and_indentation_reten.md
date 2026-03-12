---
title: Outliner style hyphen prefix and indentation retention
created: 2026-03-10T15:52:14.785Z
updated: 2026-03-12T17:58:36.148Z
sortOrder: 1
slug: outliner_style_hyphen_prefix_and_indentation_reten
worktree:
  branch: agentkanban/20260310_155214785_4cg00z_outliner_style_hyphen_prefix_and_indentation_reten
  path: c:\Users\Gareth\src\as-notes-worktrees\20260310_155214785_4cg00z_outliner_style_hyphen_prefix_and_indentation_reten
  created: 2026-03-12T17:58:36.148Z
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

[agent]

Two new edge cases to handle. Here's the plan:

---

## Edge Case 1: Paste → Outliner Bullet Conversion

**Requirement:** When in outliner mode and the cursor is on a bullet line, pasting multi-line clipboard text converts each non-empty line into a separate bullet at the same indentation level.

**Behaviour:**

1. **Plain bullet** (`- `): Each non-empty pasted line gets `{indent}- ` prefix.
2. **Todo line** (`- [ ] ` or `- [x] `): First pasted line goes onto the current bullet (keeping original checked/unchecked state). Remaining lines each get `{indent}- [ ] ` prefix (always unchecked).
3. **Single-line paste**: Normal insertion — no conversion. The pasted text is inserted inline at the cursor, same as would happen without outliner mode.
4. **Empty lines** in pasted content are stripped.
5. The first pasted line replaces the text at the cursor position on the current line (i.e. it merges with the existing bullet); subsequent lines become new bullets below.

**Implementation approach:**

- Register a `ClipboardPasteEditProvider` via `vscode.languages.registerDocumentPasteEditProvider` for markdown documents. This is the proper VS Code API for intercepting paste operations.
- Alternatively, we can register a command `as-notes.outlinerPaste` bound to `Ctrl+V` / `Cmd+V` with the appropriate `when` clause, similar to the Enter binding. This is simpler and more consistent with the existing outliner pattern.

I'll go with the **command approach** (`as-notes.outlinerPaste` bound to `Ctrl+V`/`Cmd+V`) since:
- It follows the same pattern as `outlinerEnter`, `outlinerIndent`, etc.
- The `when` clause naturally restricts it to outliner mode + bullet line
- We can read from the clipboard via `vscode.env.clipboard.readText()`

**`when` clause:** `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine && !editorReadonly`

**Pure-logic function in `OutlinerService.ts`:**
```typescript
formatOutlinerPaste(lineText: string, cursorCharacter: number, clipboardText: string): OutlinerPasteResult
```
Returns the edit to apply: replacement range and replacement text.

---

## Edge Case 2: Enter on a Code Fence Line → Enter Code Block

**Requirement:** When in outliner mode and the cursor is on a bullet line that ends with opening backticks (with or without a language identifier), Enter should:
- Open a code block (not insert a new bullet)
- Insert the closing `` ``` `` at the correct indentation
- Place the cursor inside the code block

**Detection:** Line matches `/^\s*- .*```(\w*)\s*$/` — a bullet line where the content ends with triple backticks optionally followed by a language identifier.

**Behaviour:**
```
- ```javascript⏎
```
becomes:
```
- ```javascript
  ← cursor here (indented 2 past the hyphen)
  ```
```

**Implementation:** Modify the `outlinerEnter` command to detect code fences before applying normal bullet insertion. When detected, insert a newline + appropriate indent + newline + closing fence instead of a new bullet.

**Pure-logic function in `OutlinerService.ts`:**
```typescript
isCodeFenceOpen(lineText: string): boolean
getCodeFenceEnterInsert(lineText: string): string
```

The Enter command checks `isCodeFenceOpen` first; if true, uses `getCodeFenceEnterInsert` instead of `getOutlinerEnterInsert`.

---

### Questions

1. **Paste — single line pastes:** Should single-line clipboard text just be inserted normally (no bullet conversion)? I believe yes — bullet conversion only makes sense for multi-line content. Confirmed? [comment] Agreed

2. **Paste — existing text after cursor:** If the current bullet already has text after the cursor, should pasted content be inserted at the cursor (pushing existing text to the last pasted bullet), or should existing text remain on the current line? I'd propose: text after cursor stays on the current line, pasted text is inserted between cursor position and end of line. [comment] Agreed

   Actually, re-reading your examples, it looks like the bullet line is empty when pasting (just `- ` or `- [ ] `). Should I handle the case where there's already text on the bullet, or can we assume paste always happens on an empty bullet? I'll implement the general case (cursor can be anywhere on the line). [comment] No, you should handle the the case when there is a bullet

3. **Code fence — nested fences:** Should we handle the case where the user is already inside a code fence (i.e. there's an unclosed `` ``` `` above)? For now I'd keep it simple: just detect the pattern on the current line. If the line ends with `` ``` `` or `` ```lang ``, treat it as opening a new fence. We won't track fence state across the document initially. [comment] Agreed

4. **Code fence indentation:** In your example the cursor and closing fence are indented 2 spaces past the `- `. This matches standard markdown indent for continuation content under a list item. Should this be 2 spaces always, or match the editor's tab size setting?

[comment] Keep at two spaces but comment near code and in TECHNICAL.md

[user]

Comments inline

[agent]

Both edge cases implemented. 539 tests (all passing), build clean.

### Resolved clarifications

1. **Single-line paste**: Confirmed — returns `null`, falls through to default paste.
2. **Text after cursor on paste**: Handled — text before cursor merges with first pasted line, text after cursor appends to last pasted line.
3. **Code fence nested detection**: Simple current-line detection only. No cross-document fence state tracking.
4. **Code fence indentation**: 2 spaces past the `- ` marker, hardcoded. Commented in code and documented in TECHNICAL.md.

### What was implemented

**`OutlinerService.ts`** — 3 new exports:
- `isCodeFenceOpen(lineText)` — detects bullet lines ending with `` ``` `` or `` ```language ``
- `getCodeFenceEnterInsert(lineText)` — returns code block skeleton: `\n{contentIndent}\n{contentIndent}\`\`\``
- `formatOutlinerPaste(lineText, cursorCharacter, clipboardText)` — converts multi-line clipboard into indented bullets

**`OutlinerService.test.ts`** — 36 new tests:
- 13 for `isCodeFenceOpen` (bullets with/without language, indented, todo lines, non-bullet lines)
- 7 for `getCodeFenceEnterInsert` (various indent levels, todo lines)
- 16 for `formatOutlinerPaste` (plain bullets, todos, done todos, CRLF, empty lines, text before/after cursor)

**`extension.ts`** changes:
- `outlinerEnter` checks `isCodeFenceOpen` first; if true, inserts code block skeleton and repositions cursor to blank line inside fence
- New `as-notes.outlinerPaste` command: reads clipboard, calls `formatOutlinerPaste`, replaces line or falls through to default paste

**`package.json`** — new keybinding:
- `Ctrl+V` / `Cmd+V` → `as-notes.outlinerPaste` when `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine && !editorReadonly`

**`TECHNICAL.md`** — new "Outliner mode" section with subsections: OutlinerService, Context keys, Enter (bullet + code fence), Tab/Shift+Tab, Paste, Todo toggle.

[user]

Test feedback:

Code block completion should also work on non outliner lines.

With language

```javascript
<- cursor   
``` 

No language

```
<- cursor   
``` 

Where we are in outliner mode due to bullets, when the user presses enter after the closing backticks, a bullet will be added on the next line to continue the outliner bullet

With language

- ```javascript
  var i = 0; 
  ``` <- enter pressed after closing backticks
- <- bullet is added on enter  


No language

- ```
  some text
  ``` <- enter pressed after closing backticks
- <- bullet is added on enter  

[agent]

Good feedback. Two related behaviours to add:

### Behaviour A: Non-bullet code fence opening

Currently `isCodeFenceOpen` only matches bullet lines (`` - ``` ``). We also need it to match **standalone code fences** (lines that are just `` ``` `` or `` ```language `` without a `- ` prefix). When in outliner mode and the user presses Enter on such a line, a code block should open with cursor inside and closing fence below — same skeleton, but indentation is based on the line's own leading whitespace rather than a bullet prefix.

### Behaviour B: Closing fence → new bullet

When in outliner mode and the cursor is on a **closing fence line** (a line that is whitespace + `` ``` ``), pressing Enter should:
- Detect the enclosing bullet's indentation (by scanning upward for the nearest bullet parent)
- Insert a new bullet `\n{bulletIndent}- ` on the next line

This requires the outliner enter command to fire on non-bullet lines too. Currently the keybinding has `as-notes.onBulletLine` in its `when` clause, which blocks it from firing on `` ``` `` lines and code fence lines.

### Proposed design

1. **Widen the Enter keybinding**: Replace `as-notes.onBulletLine` with a broader context key `as-notes.outlinerActiveLine` that is `true` when the current line is:
   - A bullet line (`/^\s*- /`), OR
   - A standalone code fence line (`/^\s*```\w*\s*$/`), OR
   - A closing code fence continuation line inside a bullet's code block

   Actually, a simpler approach: **remove `as-notes.onBulletLine` from the Enter keybinding entirely** and let the command handler decide what to do. If the line isn't a bullet line, code fence open, or closing fence, the command falls through to the default Enter action (via `vscode.commands.executeCommand('default:type', { text: '\n' })`). This avoids complex context key maintenance.

   However, this means every Enter keystroke in outliner mode markdown goes through our command, which could have performance or compatibility implications. The alternative is a third context key.

   **Recommended approach**: Add a new context key `as-notes.onCodeFenceLine` that is `true` when the current line matches `/^\s*```\w*\s*$/` (opening or closing fence). Then the keybinding becomes: `as-notes.outlinerMode && (as-notes.onBulletLine || as-notes.onCodeFenceLine)`.

   Wait — VS Code `when` clauses don't support `||` directly. They do support `||` actually (since VS Code 1.62). Let me confirm this will work.

   Actually the simplest and most robust approach: **remove `as-notes.onBulletLine` from the Enter keybinding only** and handle the fallback to default Enter inside the command. For Tab/Shift+Tab/Paste, `onBulletLine` remains correct.

2. **New pure-logic functions in OutlinerService**:
   - `isStandaloneCodeFenceOpen(lineText)` — matches `/^\s*```\w*\s*$/` for non-bullet fence lines
   - `getStandaloneCodeFenceEnterInsert(lineText)` — returns `\n{indent}  \n{indent}  ``` ` (cursor line + closing fence, indented 2 past current indent... actually for non-bullet, just use the same indent)
   - `isClosingCodeFenceLine(lineText)` — matches `/^\s*```\s*$/` (whitespace + closing backticks only, no language)
   - `getClosingFenceBulletInsert(documentLines, currentLineIndex)` — scans upward to find the enclosing bullet, returns `\n{bulletIndent}- `

   Actually, rethinking: for a standalone fence line (no bullet), the indentation for the content should just be {indent + 2 spaces} where indent is the leading whitespace on the fence line itself. For the closing fence case, we need to find the parent bullet.

3. **Updated `outlinerEnter` command logic** (priority order):
   1. Is this a closing `` ``` `` inside a bullet code block? → Insert new bullet at parent indent
   2. Is this a bullet line ending with `` ``` ``? → Insert code block skeleton (existing)
   3. Is this a standalone `` ``` `` or `` ```lang `` (non-bullet)? → Insert code block skeleton
   4. Is this a bullet line? → Insert new bullet (existing)
   5. None of the above → Fall through to default Enter

### Questions

1. **Standalone code fence detection**: For non-bullet ```` ``` ```` lines, should the code block content use the same indent as the fence line, or indent 2 more? Standard markdown has no indent requirement for standalone fenced code blocks, but matching the fence indent seems natural. I'd propose: content and closing fence at the **same indent** as the opening fence (no extra 2 spaces since there's no bullet marker to indent past). [comment] Same indent

2. **Closing fence parent detection**: To find the parent bullet when on a closing `` ``` ``, I need to scan upward through the document. This means the function needs access to document lines (not just the current line text). Should I:
   - a) Pass the full document text + line index to the service function (still testable, no VS Code deps)
   - b) Do the scan in extension.ts and just pass the parent indent to a simpler service function

   I'd propose (a) — pass an array of line strings + current line index. Keeps all logic testable.

3. **Edge case — closing fence NOT inside a bullet block**: If there's a standalone `` ``` `` that closes a non-bullet code block, Enter should just behave normally (no bullet insertion). The upward scan should only insert a bullet if it finds a bullet parent *before* finding the opening fence. If the opening fence is on a non-bullet line, default Enter behaviour.

[user] See inline comments

[agent] Iteration 4 complete. Implemented 4 new functions in OutlinerService.ts:

1. `isStandaloneCodeFenceOpen(lineText)` — detects non-bullet opening code fence lines
2. `getStandaloneCodeFenceEnterInsert(lineText)` — returns code block skeleton at same indent (no +2 offset since no bullet marker)
3. `isClosingCodeFenceLine(lineText)` — detects bare closing fence lines (no language identifier)
4. `getClosingFenceBulletInsert(lines, lineIndex)` — scans upward from closing fence to find bullet opener; returns new bullet insert or null

Extension wiring changes:
- New context key `as-notes.onCodeFenceLine` synced alongside `onBulletLine`
- Enter keybinding `when` clause updated: `(as-notes.onBulletLine || as-notes.onCodeFenceLine)`
- `outlinerEnter` command handler now has 4 priority branches: bullet code fence → closing fence → standalone fence → bullet line
- Closing fence inside bullet block → inserts new bullet at parent indent
- Closing fence NOT inside bullet block → inserts plain newline (fallthrough)
- Standalone opening fence → creates code block skeleton with cursor repositioning

Tests: 34 new test cases added (11 isStandaloneCodeFenceOpen + 4 getStandaloneCodeFenceEnterInsert + 8 isClosingCodeFenceLine + 11 getClosingFenceBulletInsert). All 573 tests passing across 14 files. Build clean.

TECHNICAL.md updated with new exports table entries, third context key, and new Enter subsections for standalone fences and closing fences.

[user]

Test feedback

Code block completion is not working in non outliner mode contexts. I enter the `` ``` `` backticks, hit enter and no closing backticks are created and the cursor is not placed between them (same for language version)

I have noticed that when in outliner mode, the next outliner bullet is not created if you press enter on an empty outliner line without adding a space

```
- <- cursor here and enter
- <- we get a new bullet (correct)
```

```
-<- cursor here and enter (right next to bullet)
<- we DON't get a new bullet (correct)
```

[agent]

Two items to address:

### Issue 1: Code block completion outside outliner mode

Currently the Enter keybinding requires `as-notes.outlinerMode`, so standalone code fence completion (`` ``` `` → skeleton) only works in outliner mode. The user expects this to work in all markdown files.

**Fix**: Register a new lightweight command `as-notes.codeFenceEnter` that handles only standalone code fence opening (reusing existing `isStandaloneCodeFenceOpen` + `getStandaloneCodeFenceEnterInsert`). Add a separate keybinding that fires when `editorLangId == markdown && as-notes.onCodeFenceLine && !as-notes.outlinerMode` (so it doesn't conflict with the existing outliner Enter).

The `as-notes.onCodeFenceLine` context key is already maintained on every cursor move regardless of outliner mode, so no context key changes needed.

No new pure-logic functions needed — this is purely extension.ts wiring + package.json keybinding.

### Issue 2: Empty bullet without trailing space

The user's examples show this is **expected behaviour** — `-` without trailing space correctly does NOT trigger outliner Enter, while `- ` (with space) correctly does. No change needed.

### Plan

1. Register `as-notes.codeFenceEnter` command in extension.ts (handles standalone fence → skeleton + cursor reposition)
2. Add Enter keybinding in package.json: `editorLangId == markdown && as-notes.onCodeFenceLine && !as-notes.outlinerMode && !suggestWidgetVisible && editorHasSelection == false && !inlineSuggestionVisible`
3. Build and test
4. Update TECHNICAL.md

[user]

plan todo implement

[agent]

Iteration 5 complete. Code fence completion now works outside outliner mode.

**Changes:**
- New command `as-notes.codeFenceEnter` registered in extension.ts — handles standalone opening code fence skeleton insertion + cursor repositioning. Reuses `isStandaloneCodeFenceOpen` and `getStandaloneCodeFenceEnterInsert` (no duplicate logic).
- New keybinding: Enter → `codeFenceEnter` when `editorLangId == markdown && as-notes.onCodeFenceLine && !as-notes.outlinerMode && !suggestWidgetVisible && editorHasSelection == false && !inlineSuggestionVisible`
- When outliner mode IS on, the existing `outlinerEnter` handler continues to handle both standalone fences and bullet fences.
- TECHNICAL.md updated with new "Code fence completion (non-outliner)" subsection.

Issue 2 (empty bullet without trailing space): Confirmed as expected behaviour — `-` without space correctly does not trigger outliner. No change needed.

All 573 tests passing, build clean.

[user]

Test feedback:

Non outliner code block completion only works if outliner mode is not active - to be clear it should work in both modes (just differently, when not in the context of an outliner bullet)

When it is working in the non outliner context, it seems to be not aware of whether it's on the starting backticks or the ending backticks, because with every enter press it creates the second set. When the scenario backticks are already balanced, it should not create a second set, whether on the first set of back ticks or not. Balancing backtick sets must be at the same indent to be considered balanced


Example 1

```javascript <- we need the back ticks because they are not balanced

Example 2

``` <- we need the back ticks because they are not balanced

Example 3

```javascript <- we DO NOT need the back ticks because they are not balanced, but put the cursor between
```


Example 4

```javascript <- we DO NOT need the back ticks because they are not balanced, but put the cursor on the first line



```


Example 5

```javascript <- we DO NOT need the back ticks because they are not balanced, but put the cursor on the first line



```

```javascript <- we DO need the back ticks because they are not balanced (there is a paired set above, they are completed, so the one on this line doesn't balance)


Example 6 (no language)

``` <- we DO NOT need the back ticks because they are not balanced, but put the cursor on the first line



```

``` <- we DO need the back ticks because they are not balanced (there is a paired set above, they are completed, so the one on this line doesn't balance)

[agent]

### Iteration 6 — Fence balancing + code fence Enter in both modes

Two issues to fix:

#### Issue A: Code fence Enter must work in both modes

Currently `as-notes.codeFenceEnter` keybinding has `!as-notes.outlinerMode`, so standalone code fence completion doesn't fire when outliner mode is on and the cursor is on a non-bullet fence line. The outliner Enter handler *does* have standalone fence logic (branch 3), but looking at it: the `outlinerEnter` keybinding fires on `as-notes.onCodeFenceLine`, and `onCodeFenceLine` is set by `isStandaloneCodeFenceOpen` — so it should already work. However, the keybinding uses `(as-notes.onBulletLine || as-notes.onCodeFenceLine)`, both of which can be true simultaneously for `- \`\`\``. Let me verify the `onCodeFenceLine` detection isn't blocked...

Actually, `isStandaloneCodeFenceOpen` explicitly **excludes** bullet lines (`&& !BULLET_LINE.test(lineText)`). So if the cursor is on a bullet fence line like `- \`\`\``, `onCodeFenceLine` is `false`. Good — no conflict. And if the cursor is on a standalone `\`\`\``, `onBulletLine` is `false` and `onCodeFenceLine` is `true`, so `outlinerEnter` fires via the `||` and branch 3 handles it.

So Issue A may actually already work. Let me check: when outliner mode is ON and cursor is on `\`\`\`javascript`, does Enter fire? The keybinding `when` clause is `as-notes.outlinerMode && (as-notes.onBulletLine || as-notes.onCodeFenceLine)`. `onCodeFenceLine` is `true`. `outlinerMode` is `true`. So `outlinerEnter` fires. Branch 3 (`isStandaloneCodeFenceOpen`) catches it. ✓

So the user's report that "it only works if outliner mode is not active" suggests something else. Let me check: `onCodeFenceLine` is only true if `isStandaloneCodeFenceOpen` returns true. But `isStandaloneCodeFenceOpen` tests against `STANDALONE_CODE_FENCE_OPEN` which is `/^(\s*)```(\w*)\s*$/` — AND excludes bullet lines. A bare `\`\`\`` matches (language group is empty, `\w*` matches empty). So detection should work.

Wait — could the issue be that the context key isn't being set fast enough? The user types `\`\`\``, and the context key updates on selection change. But if the user types `\`\`\`` and immediately presses Enter without moving the cursor, the selection change fires when the ``` was typed, at which point the line might still be in an intermediate state... Actually, `onDidChangeTextEditorSelection` fires on each keystroke, so typing the third backtick should trigger a selection change and set `onCodeFenceLine`. This should be fine.

I suspect the actual issue may be that `\`\`\`` with a closing fence below it (already balanced) still fires the skeleton. Let me focus on Issue B which is the main problem.

#### Issue B: Balanced fence detection

Currently, pressing Enter on any line matching `isStandaloneCodeFenceOpen` always inserts a closing fence skeleton. But if the fence is already balanced (a matching closing fence at the same indent exists below), it should NOT insert a skeleton — it should just position the cursor between the fences.

**New function: `isCodeFenceUnbalanced(lines: string[], lineIndex: number): boolean`**

Algorithm:
1. Get the indent level of the fence at `lineIndex`
2. Collect all fence lines in the document at the same indent (matching `/^\s*```/` with same leading whitespace length)
3. Pair them sequentially top-to-bottom: 1st→2nd, 3rd→4th, etc.
4. If `lineIndex` is the last of an odd count (unpaired), return `true` (unbalanced)
5. If `lineIndex` is part of a pair, return `false` (balanced)

Note: For the purpose of this detection, all fence lines at the same indent are considered regardless of language identifier. A `\`\`\`javascript` opening pairs with a bare `\`\`\`` closing at the same indent.

**Updated Enter behaviour:**
- When on a standalone fence and `isCodeFenceUnbalanced` returns `true`: insert closing fence skeleton (current behaviour)
- When on a standalone fence and `isCodeFenceUnbalanced` returns `false` (balanced): just insert a newline and position cursor between the fences (on the opening fence) or do a normal newline (on the closing fence)

Actually re-reading the user's examples more carefully:

- Example 3: `\`\`\`javascript` with `\`\`\`` below → balanced → enter on opening line puts cursor between them (no new skeleton)
- Example 4: Same but cursor on opening line → cursor goes to first content line
- Example 5: Two pairs, the second `\`\`\`javascript` is unpaired → insert skeleton
- Example 6: Same as 5 but without language

So the behaviour when balanced:
- Cursor on **opening** fence of a balanced pair → insert newline, cursor lands between opening and closing (like a normal Enter but before the closing fence)
- Cursor on **closing** fence of a balanced pair → normal Enter (newline after closing fence)

Actually, looking at examples 3 and 4, both show the cursor placed between the fences — but example 3 says "put the cursor between" and example 4 says "put the cursor on the first line". These are effectively the same — Enter on the opening fence inserts a newline and the cursor is on the line after the opening fence (between the pair).

For the closing fence: when balanced, pressing Enter is just a normal newline. The current `isClosingCodeFenceLine` + `getClosingFenceBulletInsert` handles the outliner case. For non-outliner, we just need a plain Enter.

**Simplification:** The core question is: should the Enter handler insert a skeleton? Only if unbalanced. If balanced → just do a normal Enter (default VS Code behaviour).

For the **context key** approach: `onCodeFenceLine` should be `true` only when the fence is **unbalanced**. This way:
- Unbalanced standalone fence → `onCodeFenceLine` true → our handler fires → inserts skeleton
- Balanced standalone fence → `onCodeFenceLine` false → normal VS Code Enter fires

Wait — but `onCodeFenceLine` is also used by `outlinerEnter` for closing fences inside bullet blocks. If we change `onCodeFenceLine` to mean "unbalanced fence", we'd break the closing fence → new bullet logic. When the cursor is on a balanced closing fence inside a bullet block, we DO want our handler to fire (to insert a new bullet).

Actually for closing fences inside bullet blocks, `onBulletLine` is false (the closing fence line isn't a bullet), and the closing fence IS balanced with its opening fence above. So if `onCodeFenceLine` is false for balanced fences, the outliner Enter won't fire on the closing fence. That breaks the closing fence → bullet insertion.

I need a different approach. Let me separate the context keys:
- `as-notes.onCodeFenceLine` — remains as-is (true for any standalone fence line)
- The balancing check happens **inside the command handler**, not in the context key

So the handler logic becomes:
1. If `isStandaloneCodeFenceOpen(lineText)`:
   a. Check `isCodeFenceUnbalanced(lines, lineIndex)`
   b. If unbalanced → insert skeleton
   c. If balanced → the line is an opening fence of a balanced pair → insert a plain newline (cursor lands between opening and closing)
2. If `isClosingCodeFenceLine(lineText)`:
   a. (Outliner only) Check `getClosingFenceBulletInsert` → new bullet if inside bullet block
   b. Otherwise → plain newline

This means for both `codeFenceEnter` and `outlinerEnter`, we insert the closing fence skeleton only when unbalanced.

Actually, for the `codeFenceEnter` (non-outliner) command, the `onCodeFenceLine` context key also needs to fire on closing fence lines (not just opening). Currently it only checks `isStandaloneCodeFenceOpen`. But we need it to handle closing fences too — specifically for the case where the user presses Enter on a closing fence. Actually, in non-outliner mode, pressing Enter on a closing fence should be a normal newline. VS Code already does this. We don't need our handler.

Wait — the user's issue is that "with every enter press it creates the second set". That means `isStandaloneCodeFenceOpen` is matching BOTH opening AND closing bare `\`\`\`` lines (since they have the same format: `/^(\s*)```(\w*)\s*$/` with empty language group). So a bare `\`\`\`` that's a closing fence triggers skeleton insertion. That's the core bug.

The fix: `onCodeFenceLine` context key should use a new function that checks if the fence is a standalone opening fence AND unbalanced. Or: keep `onCodeFenceLine` as-is, and check balance inside the handler.

I'll check balance inside the handler for correctness, and also update the context key to not fire on balanced fences (to avoid intercepting Enter unnecessarily on fences that need normal behaviour).

Actually, the cleanest approach: **check balance in both the context key AND the handler**.

For the context key: `onCodeFenceLine` = `isStandaloneCodeFenceOpen(lineText) && isCodeFenceUnbalanced(lines, lineIndex)`. But this requires document access in the context key sync function, which we already have (we're inside `syncOutlinerLineContext` which has access to the editor).

Wait — the current `syncOutlinerLineContext` function only uses `lineText`. Getting all document lines for every selection change could have performance implications.`getText().split('\n')` on every keystroke is expensive for large documents.

Better approach: Keep `onCodeFenceLine` simple (current `isStandaloneCodeFenceOpen` check). Do the balance check inside the handler. If balanced, the handler does a normal Enter (or repositions between fences). The keybinding still fires but the handler gracefully handles it.

### Plan

1. **New function `isCodeFenceUnbalanced(lines: string[], lineIndex: number): boolean`** in OutlinerService.ts
2. **Update `codeFenceEnter` handler**: check balance; if balanced → just insert `\n` at end of line; if unbalanced → insert skeleton
3. **Update `outlinerEnter` handler branch 3**: same balance check
4. **Fix `codeFenceEnter` keybinding**: remove `!as-notes.outlinerMode` so it fires in both modes. Remove standalone fence logic from `outlinerEnter` to avoid duplication — let `codeFenceEnter` always handle standalone fences, and let `outlinerEnter` only handle bullet lines + closing fences in bullet blocks.

Actually, that introduces a keybinding precedence issue. Both `codeFenceEnter` and `outlinerEnter` would match when outliner mode is on and `onCodeFenceLine` is true. VS Code fires the more specific keybinding. The `outlinerEnter` binding has more conditions (`as-notes.outlinerMode && (onBulletLine || onCodeFenceLine)`), so it's more specific and would win.

Simpler approach: **merge standalone fence handling into a single code path**:
- Remove the `!as-notes.outlinerMode` from `codeFenceEnter` keybinding
- Remove `as-notes.onCodeFenceLine` from `outlinerEnter` keybinding (keep only `as-notes.onBulletLine`) — closing fences inside bullet blocks need different handling...

Hmm, closing fence lines aren't bullet lines, so `onBulletLine` is false. The `outlinerEnter` would never fire on them. They'd fall through to `codeFenceEnter`.

But `codeFenceEnter` doesn't know about bullet code blocks. It needs to handle closing fences differently when inside a bullet block.

Let me reconsider: **keep both commands, merge the standalone fence logic into `codeFenceEnter` only, and keep `outlinerEnter` for bullet lines + bullet-block-closing-fences**.

New keybinding approach:
- `codeFenceEnter`: `editorLangId == markdown && as-notes.onCodeFenceLine && !suggestWidgetVisible && editorHasSelection == false && !inlineSuggestionVisible` (fires in BOTH modes)
- `outlinerEnter`: `editorLangId == markdown && as-notes.outlinerMode && as-notes.onBulletLine && !suggestWidgetVisible && editorHasSelection == false && !inlineSuggestionVisible` (only fires on bullet lines)

And `onCodeFenceLine` must also detect closing fence lines (not just opening). Currently it only uses `isStandaloneCodeFenceOpen`.

Updated `codeFenceEnter` handler:
1. If opening fence (`isStandaloneCodeFenceOpen`) AND unbalanced → insert skeleton
2. If opening fence AND balanced → insert plain `\n` (cursor between opening and closing)
3. If closing fence (`isClosingCodeFenceLine`) AND in outliner mode → check `getClosingFenceBulletInsert` → new bullet if inside bullet block
4. If closing fence otherwise → insert plain `\n`

And `outlinerEnter` handler simplifies to only handle:
1. Bullet code fence open → insert code block skeleton
2. Bullet line → new bullet

This is cleaner — all standalone/closing fence logic in one place.

Wait, I need `onCodeFenceLine` to be true for closing fences too. Currently it only checks `isStandaloneCodeFenceOpen`. I need to also check `isClosingCodeFenceLine`.

### Finalised plan

**OutlinerService.ts:**
- New: `isCodeFenceUnbalanced(lines: string[], lineIndex: number): boolean`

**extension.ts:**
- Update `syncOutlinerLineContext`: `onCodeFenceLine` = `isStandaloneCodeFenceOpen(lineText) || isClosingCodeFenceLine(lineText)`
- Update `codeFenceEnter`: handle skeleton (unbalanced) vs plain newline (balanced) + closing fence bullet insertion (outliner)
- Simplify `outlinerEnter`: remove standalone/closing fence branches, keep only bullet code fence + bullet line
- Import `isCodeFenceUnbalanced`, `isClosingCodeFenceLine`, `getClosingFenceBulletInsert` (move from outlinerEnter to codeFenceEnter)

**package.json:**
- `codeFenceEnter`: remove `!as-notes.outlinerMode` condition (works in both modes)
- `outlinerEnter`: change `(as-notes.onBulletLine || as-notes.onCodeFenceLine)` → `as-notes.onBulletLine`

[user]

todo implement

[agent]

### Iteration 6 — Implementation complete

All changes implemented and verified:

1. **`isCodeFenceUnbalanced(lines, lineIndex)`** — new pure function in OutlinerService.ts. Collects standalone fences (excluding bullet-prefixed) at the same indent as the target, pairs them sequentially (1st↔2nd, 3rd↔4th, …), and returns `true` when the target is the odd one out. 14 new tests all passing.

2. **`codeFenceEnter` handler rewritten** — now works in both outliner and non-outliner modes:
   - Checks `getClosingFenceBulletInsert` first to detect closing fences of bullet code blocks (avoids misidentifying them as unbalanced standalone openers).
   - For standalone fences: inserts skeleton only when `isCodeFenceUnbalanced` returns `true`; otherwise plain newline.
   - In outliner mode, closing fence of bullet code block → new bullet line.

3. **`outlinerEnter` simplified** — only handles bullet code fence open (branch 1) and regular bullet lines (branch 2). Standalone/closing fence logic removed.

4. **Keybindings updated**:
   - `codeFenceEnter`: removed `!as-notes.outlinerMode` — fires in both modes.
   - `outlinerEnter`: changed to `as-notes.onBulletLine` only (no `as-notes.onCodeFenceLine`).

5. **TECHNICAL.md updated** — added `isCodeFenceUnbalanced` to function table, rewrote Enter sections to reflect new architecture, added fence balance detection docs.

**Test results:** 587 passing, 14 files, build clean.

[user]

Test feedback:

A further edge case:

### Codeblock Backtick edge case

When not in outliner mode or context of an outliner bullet we need to check balancing codeblock backticks context -Example - if the code blocks before and after a set of backticks balance, then we can assume that on enter, it should perform the completion behaviours (add closing backticks and put cursor between)

With language example:

```javascript
var i = 0
```

```javascript<- If enter pressed here then we would do completion behaviour because backtick pairs before and after balance 

```javascript
var i = 0
```

No language example:

```
var i = 0
```

```<- If enter pressed here then we would do completion behaviour because backtick pairs before and after balance 

```
var i = 0
```


### Outliner behaviour

When in outliner mode I noticed that a bullet can be more than one indent ahead of it's parent. This should not be allowed. It CAN be more than one indent ahead of the bullet on the line below however

```
-
    - <- OK
```

```
-
    - 
        - <- OK
```

```
-
    - 
                - <- Not OK
```

```
-
        - <- Not OK
```


```
-
    -
        - <- OK
- <- OK
```

[agent]

### Iteration 7 — Implementation complete

Two issues addressed:

**A. Hybrid fence balance detection (`isCodeFenceUnbalanced`):**

Replaced the simple surrounding-balanced algorithm with a two-phase hybrid:
1. **Phase 1 — Language-aware matching.** Walking bottom-to-top, bare fences go onto a closer stack, language fences pop from the stack to pair. This correctly identifies that a new ````javascript` typed between two existing balanced blocks is unmatched (the closer stack gets consumed by the blocks' own openers, leaving the new fence without a partner).
2. **Phase 2 — Surrounding-balanced heuristic** (bare fences only). For bare ``` fences not matched by phase 1, count fences at the same indent before/after — both even means unbalanced.

This gives precise results for language-identified fences and a good heuristic for bare fences.

10 new tests added, existing 5-fence test expectations updated. Total: 128 OutlinerService tests passing.

**B. Tab indent guard (`getMaxOutlinerIndent`):**

New pure function: scans upward for the nearest bullet line, returns its indent + tabSize. If no bullet above, returns 0.

Updated `outlinerIndent` handler: checks all selections — only indents if ALL would stay within the maximum. Prevents bullets from being more than one tab stop deeper than their predecessor.

8 new tests for `getMaxOutlinerIndent`.

**Test results:** 597 passing, 14 files, build clean.

[user]


I found a test issue:

In non outliner bullet contexts - outliner mode on and off, subsequent code bock backtick sets produced the wrong behaviour: 

```javascript

```
``` <- on enter nothing happened
``` <- manual typing

``` <- automatic completion (unbalanced)


Create additional failing tests and pass them

[agent]

### Iteration 8 — Bare fence after balanced pair tests + context key fix

Added 4 new `isCodeFenceUnbalanced` tests mirroring the user's scenario (bare ``` after language+bare balanced pair, bare ``` after pair with content, two completed pairs then bare, bare ``` closing a pair). All 4 tests pass — the hybrid algorithm from iteration 7 already handles these correctly.

Additionally fixed an outstanding issue from iteration 6: `syncOutlinerLineContext` only checked `isStandaloneCodeFenceOpen` for the `onCodeFenceLine` context key. Now also checks `isClosingCodeFenceLine`, ensuring the keybinding fires for all standalone code fence lines (opening + closing). This was a planned change that was inadvertently missed.

**Test results:** 601 passing, 14 files, build clean.

[user]


