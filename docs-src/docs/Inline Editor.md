# Inline Editor

AS Notes includes a built-in inline Markdown editor that renders formatting directly in the text editor, similar to Typora. Standard Markdown syntax characters are replaced with their visual equivalents as you write, giving you a clean reading experience without switching between edit and preview modes.

## Three-State Visibility

The inline editor uses a three-state system to manage syntax visibility:

| State | When | What you see |
|---|---|---|
| **Rendered** | Cursor is on a different line | Clean formatted text with syntax hidden |
| **Ghost** | Cursor is on the same line, outside the construct | Syntax characters at reduced opacity (30% by default) |
| **Raw** | Cursor is inside the construct | Full Markdown source |

This cycle lets you read comfortably while always having access to the raw Markdown when you need to edit.

**Example with bold text:**

- **Rendered:** The word appears **bold** with no asterisks visible
- **Ghost:** Move your cursor to the same line and faint `**` markers appear around the bold word
- **Raw:** Click directly on the bold word and the full `**bold**` syntax is shown

## Supported Constructs

The inline editor renders the following Markdown constructs:

### Text Formatting

- **Bold** (`**text**`) - rendered as bold text
- *Italic* (`*text*`) - rendered as italic text
- ***Bold italic*** (`***text***`) - rendered as both
- ~~Strikethrough~~ (`~~text~~`) - rendered with a line through it
- `Inline code` (`` `code` ``) - rendered with code styling

### Headings

Headings (`# H1` through `###### H6`) are rendered at progressively larger font sizes with bold styling. The `#` markers are hidden when rendered, visible at full opacity when the cursor is on the heading line (heading markers do not use ghost-faint like other constructs).

| Level | Font size |
|---|---|
| H1 | 180% |
| H2 | 140% |
| H3 | 120% |
| H4 | 110% |
| H5 | 105% |
| H6 | 100% |

Heading colours can be customised per level in [[Settings]].

### Links and Images

- **Links** (`[text](url)`) - syntax hidden, link text shown with link colour. Hover to preview the URL. Ctrl+Click to navigate.
- **Images** (`![alt](path)`) - hover to see an image preview.

### Blockquotes and Horizontal Rules

- **Blockquotes** (`> text`) - the `>` marker is styled, text is indented
- **Horizontal rules** (`---` or `***`) - rendered as a visual separator

### Lists

- **Unordered lists** (`- item`) - the `-` marker is replaced with a styled bullet
- **Task lists** (`- [ ] item` / `- [x] item`) - rendered with a styled bullet and checkbox. Click the checkbox to toggle it.
- **Ordered lists** (`1. item`) - numbers are styled

### Code Blocks

Fenced code blocks (` ``` `) display the language label at reduced opacity when rendered. Move the cursor inside the block to see the full raw source.

### Tables

GFM pipe tables are rendered with visual grid styling. Move the cursor inside the table to see the raw pipe syntax. AS Notes' table slash commands (add/remove rows and columns) work alongside the visual rendering.

### YAML Frontmatter

Frontmatter blocks (`---` delimiters and content) are rendered at reduced opacity when the cursor is elsewhere. Move the cursor inside to see the full raw YAML.

### Emoji

Emoji shortcodes like `:smile:` or `:seedling:` are rendered as their emoji characters. The shortcode is visible in ghost/raw state.

### Mermaid Diagrams

Mermaid diagram code blocks (` ```mermaid `) are rendered as inline SVG diagrams. Hover over the code block for a preview.

### Math / LaTeX

Inline math (`$...$`) and display math (`$$...$$`) are rendered using KaTeX/MathJax. Enable or disable via the `as-notes.inlineEditor.defaultBehaviors.math` setting.

### GitHub Mentions and Issues

`@username` mentions and `#123` issue references are rendered with styled decorations. Enable or disable via the `as-notes.inlineEditor.defaultBehaviors.mentionLinks` setting.

## Toggle

Toggle the inline editor on or off using any of these methods:

- **Command Palette:** Run **AS Notes: Toggle Inline Editor** (`Ctrl+Shift+P`)
- **Editor title bar:** Click the eye icon
- **Setting:** Set `as-notes.inlineEditor.enabled` to `false` in VS Code settings

When toggled off, all inline decorations are removed and you see plain Markdown.

## Outliner Mode

When [[Settings|outliner mode]] is active, the inline editor works alongside it. Bullet markers and checkbox syntax are styled (bullets show as `bullet`, checkboxes show bullet + checkbox graphic) rather than being hidden. The three-state visibility still applies to inline formatting within bullet content (bold, italic, code, links, etc.).

## Conflict Detection

If you have the standalone [Markdown Inline Editor](https://github.com/SeardnaSchmid/markdown-inline-editor-vscode) extension installed, AS Notes will show a warning notification on activation. Running both will cause duplicate decorations and broken checkbox toggles. The notification offers two options:

- **Disable Extension** - disables the standalone extension
- **Disable Inline Editor** - disables the AS Notes inline editor, keeping the standalone extension active

## Settings

All inline editor settings are under the `as-notes.inlineEditor` namespace. See [[Settings]] for the full list.

Key settings:

| Setting | Default | Description |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | Master toggle |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | Opacity for ghost-state syntax |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | Open links with single click |
| `as-notes.inlineEditor.defaultBehaviors.emoji` | `true` | Render emoji shortcodes |
| `as-notes.inlineEditor.defaultBehaviors.math` | `true` | Render math expressions |
| `as-notes.inlineEditor.colors.*` | *(theme)* | Override heading, link, code colours |

## Troubleshooting

**Inline editor not active:** AS Notes must be in full mode (`.asnotes/` directory exists). Check the status bar - it should show "AS Notes" not "AS Notes (passive)".

**Decorations not appearing on a file:** The inline editor only activates for Markdown files within the AS Notes root directory. Files outside the root (e.g. a `README.md` at the workspace root when `rootDirectory` is set) are not decorated.

**Performance on large files:** The inline editor uses a parse cache and incremental updates. If you notice lag on very large files (1000+ lines), toggle the inline editor off for that session.

**Heading sizes not rendering:** This is a known VS Code platform behaviour where the `fontWeight` decoration property interferes with CSS font-size injection via `textDecoration`. AS Notes works around this by injecting `font-weight` through the CSS string. If heading sizes still don't appear, please report the issue with your VS Code version.
