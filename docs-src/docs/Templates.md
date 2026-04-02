---
order: 15
---

# Templates

AS Notes Pro lets you create reusable note templates as markdown files. Insert them anywhere via the `/Template` slash command.

## AS Notes Pro

Templates are a **Pro feature**. To unlock them:

1. Obtain a licence key from [asnotes.io](https://www.asnotes.io/pricing)
2. Enter your key using one of these methods:
   - Run **AS Notes: Enter Licence Key** from the Command Palette (`Ctrl+Shift+P`)
   - Or open VS Code Settings (`Ctrl+,`), search for `as-notes.licenceKey`, and paste your key there

When active, the status bar shows **AS Notes (Pro)**.

## Template Folder

Templates are stored in a dedicated folder within your AS Notes workspace. The default folder is `templates/` and can be changed in [[Settings]] via `as-notes.templateFolder`.

A default `Journal.md` template is created automatically when you initialise a workspace. This template is used for new daily journal entries (see [[Daily Journal]]).

## Creating a Template

Add any `.md` file to your templates folder. The filename (without extension) becomes the template name shown in the picker.

Subdirectories are supported. Templates in subfolders appear as `folder/name` in the picker, so you can organise templates by category:

```
templates/
  Journal.md
  Meeting Notes.md
  project/
    Sprint Review.md
    Retrospective.md
```

## Inserting a Template

1. Type `/` in any markdown file to open the slash command menu
2. Select **Template**
3. Pick a template from the list

The template content is inserted at the cursor position with all placeholders replaced.

See [[Slash Commands]] for the full list of available commands.

## Placeholders

Templates support placeholders that are replaced with dynamic values when the template is inserted.

| Placeholder | Description | Example output |
|---|---|---|
| `{{date}}` | Current date (YYYY-MM-DD) | `2026-03-18` |
| `{{time}}` | Current time (HH:mm:ss) | `14:30:45` |
| `{{datetime}}` | Full date and time (YYYY-MM-DD HH:mm:ss) | `2026-03-18 14:30:45` |
| `{{filename}}` | Current file name without extension | `My Page` |
| `{{title}}` | Alias for `{{filename}}` | `My Page` |
| `{{cursor}}` | Position where the cursor is placed after insertion | *(cursor lands here)* |
| Custom date format | Any combination of `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` tokens | `{{DD/MM/YYYY}}` becomes `18/03/2026` |

### Escaping Placeholders

To output a literal placeholder without replacement, prefix it with a backslash:

```
\{{date}}
```

This inserts the text `{{date}}` as-is, without substituting the current date.

### Custom Date Formats

Any placeholder containing date/time tokens (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`) is treated as a custom date format. For example:

| Placeholder | Output |
|---|---|
| `{{DD/MM/YYYY}}` | `18/03/2026` |
| `{{YYYY-MM-DD HH:mm}}` | `2026-03-18 14:30` |
| `{{MM-DD}}` | `03-18` |

## Example Template

A meeting notes template (`templates/Meeting Notes.md`):

```markdown
# Meeting: {{date}}

**Attendees:**

-

## Agenda

{{cursor}}

## Actions

- [ ] 
```

When inserted, `{{date}}` is replaced with the current date and the cursor is placed at the `{{cursor}}` position.

## Journal Template

The file `Journal.md` in the templates folder is used as the template for new daily journal entries created with `Ctrl+Alt+J` (Cmd+Alt+J on macOS). Edit it to customise future journal pages.

All placeholders listed above are supported in the journal template. See [[Daily Journal]] for more on the daily journal workflow.
