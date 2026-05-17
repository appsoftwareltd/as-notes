---
title: AS Notes - The Power of Nested Wikilinks in Markdown Knowledge Bases
description: Nested wikilinks in AS Notes let you link concepts from within the wikilink itself - creating a hierarchy of navigable targets and natural backlinks from a single reference.
date: 2026-03-25
author: Gareth Brown
public: true
order: 3
---

# AS Notes - The Power of Nested Wikilinks in Markdown Knowledge Bases

**Most wikilink implementations give you a link to a single page. AS Notes gives you a link to each concept embedded in the full wikilink.**

A standard wikilink is a shortcut to a file. Type `[[AS Notes Changelog]]`, click it, open the file. This is useful, but limited. The link only connects two pages - the one you're writing and the one you're pointing to.

Nested wikilinks in work differently. When a page name itself contains a concept, you can make that concept explicit - and navigable - right inside the link:

```
[[[[AS Notes]] Changelog]]
```

That single expression creates two independently navigable targets: `AS Notes.md` and `[[AS Notes]] Changelog.md`. Both are clickable. Both receive a backlink. Neither requires a separate mention in the text.

> Download from [AS Notes - VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes), or explore the [demo notes](https://github.com/appsoftwareltd/as-notes-demo-notes).

## How nested wikilinks work

The syntax nests naturally - just wrap inner concepts in their own `[[` brackets:

```
[[Specific [[Topic]] Details]]
```

AS Notes provides completion behaviour for each target page.

![Nested Wikilink Completion](../assets/images/nested-wikilink-completion.png)

This wikilink resolves this into two navigable targets:

| You click on... | You navigate to... |
|---|---|
| `[[Topic]]` (the inner brackets) | `Topic.md` |
| `[[Specific` or `Details]]` (the outer portions) | `Specific [[Topic]] Details.md` |

Nesting can go deeper. This:

```
[[[[[[Deep]] Topic]] Notes]]
```

Resolves three links: `Deep.md`, `[[Deep]] Topic.md`, and `[[[[Deep]] Topic]] Notes.md`.

Each level is independently navigable. Your cursor position determines which link is active - the extension always highlights the innermost link at the cursor, so `Ctrl+Click` takes you exactly where you intend to go.

## Why this matters for knowledge management

Most PKM tools treat page names as opaque strings. `[[AS Notes Changelog]]` is a pointer to one file.

Nested wikilinks treat the name as structured. `[[[[AS Notes]] Changelog]]` expresses: this page is a child of `AS Notes`. The hierarchy is expressed in the link rather than in a folder structure or in a separate tag or in a YAML field you have to remember to fill in.

The benefit shows up in the backlinks panel. Navigate to `AS Notes.md` and you'll see incoming links from every note that mentions `[[As Notes]]` - including those that mention it only as part of a nested link inside a longer page reference. You didn't have to write a separate `[[AS Notes]]` mention. It was already there, embedded in the child reference.

This creates backlinks without the overhead of backlinks. You reference the thing you're writing about, and the parent concept gets connected automatically.

## A practical example

Take a software project knowledge base. You have:

- `API.md` - documentation for the project API
- `[[API]] Authentication.md` - the authentication section
- `[[API]] Authentication Rate Limiting.md` - how rate limiting works within auth

In your note about a bug, you write:

```
Fixed in [[[[[[API]] Authentication]] Rate Limiting]]
```

That one line creates three backlinks: `API.md` receives a backlink, `[[API]] Authentication.md` receives a backlink, and the rate limiting page receives a backlink - all from a single mention, all without writing three separate `[[wikilinks]]` and without duplicating context.

The [AS Notes demo notes](https://github.com/appsoftwareltd/as-notes-demo-notes) include working examples of this pattern. Clone the repository, open it in VS Code with AS Notes installed, and navigate the backlinks panel to see how the hierarchy builds up from nested references.

## Autocomplete makes it effortless

You don't need to know the exact nesting in advance. Type `[[` anywhere in a document and autocomplete fires immediately - showing all indexed page names and aliases.

Type `[[` again inside an already-open wikilink and autocomplete suggests matching pages for the inner link. VS Code's completion list keeps up with however deep you nest. The full name of the outer page is assembled from whatever you type around the inner links.

## How nested wikilinks publish to HTML

When you publish your notes with AS Notes, nested wikilinks resolve to multiple HTML `<a>` elements in the output - one for each navigable target.

A nested wikilink like:

```
See [[[[AS Notes]] Changelog]] for recent changes.
```

Produces something like:

```html
See <a href="as-notes.html">AS Notes</a> <a href="as-notes-changelog.html">Changelog</a> for recent changes.
```

Each resolved target maps to its own slugified HTML filename. `AS Notes.md` becomes `as-notes.html`. `[[AS Notes]] Changelog.md` becomes `as-notes-changelog.html`. The converter handles the slug transformation - brackets are stripped, spaces become hyphens, everything lowercased.

If a nested target isn't a published page, the converter logs a dead link warning but continues. Only public pages produce live `<a href>` tags. This means your nested hierarchy can include pages you haven't published yet without breaking the build.

## All resolution rules apply

Nested wikilinks follow the same resolution logic as flat ones:

- **Case-insensitive** - `[[my page]]` matches `My Page.md` at any nesting level
- **Global scope** - the link resolves to the correct file anywhere in the workspace, regardless of folder depth
- **Alias-aware** - inner links can use page aliases, not just exact filenames
- **Rename-synced** - rename `Topic.md` and every wikilink that contains `[[Topic]]` at any nesting depth is updated, including the outer links that embed it

The last point to highlight: Renaming a deeply embedded concept propagates correctly through every nested reference that contains it, so you're not left with stale inner brackets that point nowhere.

## Getting started

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes). Open the Command Palette and run **AS Notes: Initialise Workspace**.

To see nested wikilinks in practice, clone the [demo repository](https://github.com/appsoftwareltd/as-notes-demo-notes) and explore the backlinks panel on a few pages. The patterns become obvious quickly once you can see the connections in context.

## Resources

- [AS Notes on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
- [AS Notes demo notes](https://github.com/appsoftwareltd/as-notes-demo-notes)
- [AS Notes documentation](https://www.asnotes.io)
- [Publishing a Static Site docs](https://docs.asnotes.io/publishing-a-static-site.html)
- [AS Notes on GitHub](https://github.com/appsoftwareltd/as-notes)
