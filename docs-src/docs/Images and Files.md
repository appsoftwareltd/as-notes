---
order: 8
---

# Images and Files

AS Notes makes it easy to work with images and other files in your markdown notes — drag them in, paste from the clipboard, or hover to preview.

## Drag and Drop

Drag any file from your file manager (Windows Explorer, Finder, etc.) onto an open markdown editor. VS Code inserts the correct markdown link and saves the file to your configured asset folder automatically.

> **Tip:** Hold `Shift` while dragging to see a cursor position indicator before you release — useful for placing the link precisely within a paragraph.

## Paste from Clipboard

Copy an image to your clipboard (e.g. a screenshot) and paste it into a markdown editor with `Ctrl+V` (Cmd+V on macOS). VS Code saves the image to your asset folder and inserts the markdown link.

## Where Files Are Saved

AS Notes configures the VS Code `markdown.copyFiles.destination` workspace setting so dropped and pasted files go to a dedicated folder instead of sitting next to your markdown file.

The default destination is `assets/images` (relative to the workspace root). Change it in [[Settings]] via `as-notes.assetPath`.

The asset folder is created automatically by VS Code on first use.

## Image Hover Preview

Hover over any image link in a markdown file — standard `![alt](path)` or a dropped/pasted image link — to see an inline preview of the image. This is provided by VS Code's built-in markdown extension and requires no configuration.
