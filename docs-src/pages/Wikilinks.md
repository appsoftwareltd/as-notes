# Wikilinks

Wikilinks are a way to link between notes using a simple double-bracket syntax. They are the core navigation primitive in AS Notes, popularised by tools like Roam Research, Logseq, and Obsidian.

## Basic Syntax

Wrap any page name in double square brackets to create a link:

```
[[Page Name]]
```

AS Notes resolves the link to the matching file anywhere in your workspace — you do not need to specify a folder path or file extension. If a file called `Page Name.md` exists anywhere in the workspace, the link will navigate to it.

## How Resolution Works

Links are resolved by page name only. Given a workspace with these files:

```
notes/
  Project Ideas.md
  journal/
    2026_03_07.md
```

The link `[[Project Ideas]]` resolves correctly regardless of which file it appears in or how deeply nested the files are.

## Nested Wikilinks

AS Notes supports wikilinks nested inside other wikilinks. This allows page names to themselves reference other pages, making it possible to build composite page names that remain fully navigable.

### Single nesting

The outer link's page name includes the inner link text (brackets and all):

```
[[[[AS Notes]] Features]]
```

This creates two links:
- `[[[[AS Notes]] Features]]` — links to a page named `[[AS Notes]] Features`
- `[[AS Notes]]` — links to a page named `AS Notes`

### Double nesting

```
[[[[[[Deep]] Nested]] Page]]
```

This resolves three links:
- `[[[[[[Deep]] Nested]] Page]]` — links to `[[[[Deep]] Nested]] Page`
- `[[[[Deep]] Nested]]` — links to `[[Deep]] Nested`
- `[[Deep]]` — links to `Deep`

### Practical use

Nested wikilinks are useful when you have a topic hierarchy where sub-pages share their parent's name. For example, if you have a page called `AS Notes` and a page called `[[AS Notes]] Changelog`, you can write:

```
See the [[[[AS Notes]] Changelog]] for recent changes.
```

Both the parent and the composite page name remain independently navigable.

## Backlinks

AS Notes maintains a backlink index as you write. The **Backlinks Panel** (`Ctrl+Alt+B` / `Cmd+Alt+B`) shows every note that links to the currently open page, including links via nested wikilinks.

## Rename Tracking

When you rename a file, AS Notes automatically updates all wikilinks that reference that file across your entire workspace — including nested wikilinks where the renamed page appears as an inner component.

## Missing Links

A wikilink to a page that does not yet exist is still valid syntax. AS Notes will highlight it differently and you can navigate to it to create the page. This makes it easy to link-first and write later.
