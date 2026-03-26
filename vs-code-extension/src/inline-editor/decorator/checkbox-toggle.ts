import { Position, Range, Selection, WorkspaceEdit, type TextEditor, workspace } from 'vscode';

/**
 * Handles checkbox toggle when user clicks inside [ ] or [x].
 * Detects if cursor is positioned inside a checkbox and toggles it.
 *
 * @returns true if a checkbox was toggled, false otherwise
 */
export function handleCheckboxClick(editor: TextEditor): boolean {
  const selection = editor.selection;

  // Only handle single cursor clicks (no selection range)
  if (!selection.isEmpty) return false;

  const document = editor.document;
  const line = document.lineAt(selection.active.line);
  const cursorChar = selection.active.character;

  // Find checkbox pattern on this line: [ ] or [x] or [X]
  const checkboxRegex = /\[([ xX])\]/g;
  let match: RegExpExecArray | null;

  while ((match = checkboxRegex.exec(line.text)) !== null) {
    const bracketStart = match.index;
    const bracketEnd = match.index + 3; // [ ] is 3 chars

    // Check if cursor is on or inside the checkbox [ ] range
    // Include bracketStart because clicking the ☐ decoration lands cursor there
    if (cursorChar >= bracketStart && cursorChar <= bracketEnd) {
      const currentState = match[1];
      const newState = currentState === ' ' ? 'x' : ' ';

      // Toggle the checkbox
      const edit = new WorkspaceEdit();
      const charPosition = new Position(selection.active.line, bracketStart + 1);
      edit.replace(
        document.uri,
        new Range(charPosition, charPosition.translate(0, 1)),
        newState
      );

      workspace.applyEdit(edit);

      // Move cursor after the checkbox to avoid re-triggering
      const newCursorPos = new Position(selection.active.line, bracketEnd + 1);
      editor.selection = new Selection(newCursorPos, newCursorPos);

      return true;
    }
  }

  return false;
}
