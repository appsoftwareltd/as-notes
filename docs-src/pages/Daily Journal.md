# Daily Journal

The daily journal gives you a dedicated markdown file for each day, opened with a single keyboard shortcut.

## Opening Today's Journal

Press `Ctrl+Alt+J` (Cmd+Alt+J on macOS).

If today's journal file already exists, it opens immediately. If not, a new file is created from your journal template and then opened.

> The daily journal requires an initialised workspace. See [[Getting Started]] if you haven't set one up yet.

## File Naming and Location

Journal files are created as:

```
journals/YYYY_MM_DD.md
```

For example, `journals/2026_03_07.md` for 7 March 2026.

The folder name defaults to `journals/` and can be changed in [[Settings]] via `as-notes.journalFolder`. The folder is created automatically on first use.

## Journal Template

New journal files are generated from a `journal_template.md` file in your workspace root. The placeholder `YYYY-MM-DD` in the template is replaced with today's date.

A default template is created automatically on first use:

```markdown
# YYYY-MM-DD

## Notes

## Tasks

```

Edit `journal_template.md` to add your own sections, prompts, or daily structure. Changes take effect the next time a new journal file is created.

## Wikilink Integration

Journal files are indexed immediately when created, so you can link to them using [[Wikilinks]] from other notes straight away:

```
Daily notes from [[2026_03_07]] onwards.
```

Because journal filenames follow a consistent `YYYY_MM_DD` pattern, the [[Backlinks]] panel lists journal backlinks in chronological order in flat view.

## Inserting Today's Date as a Wikilink

You can also insert a wikilink for today's date anywhere in your notes using the [[Slash Commands]] menu — type `/` and choose **Today**.
