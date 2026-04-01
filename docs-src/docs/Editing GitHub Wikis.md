---
order: 14
---

# Editing GitHub Wikis with AS Notes

Every GitHub repository comes with a built-in wiki. It is a separate Git repository that stores markdown files, supports `[[wikilinks]]` between pages, and can be organised into subdirectories.

[AS Notes](https://www.asnotes.io) is compatible with Github Wiki structure. Github wikis can be cloned locally. , Where initialised in the repository root, AS Notes provides wikilink autocompletion, markdown tooling and inline editor formatting (including Mermaid and LaTeX rendering [[Inline Markdown Editing Mermaid and LaTeX Rendering]]).

**Clone a GitHub wiki locally, open it in VS Code (or Cursor, Antigravity, Windsurf), initialise AS Notes, and you get backlinks, autocomplete, task tracking, inline rendering, and other AS Notes features on top of your wiki content. Edit locally, commit, push, and your changes appear on GitHub immediately.**

## Why Edit GitHub Wikis Locally?

GitHub's browser-based wiki editor is basic, having has no autocomplete, no backlinks, no live preview of linked pages, and no way to rename a page and update all references. Editing locally with AS Notes provides:

- **Wikilink autocomplete** - type `[[` and every wiki page appears in a completion list. No more guessing page names or fixing broken links.
- **Backlinks** - see which pages reference the current page without leaving the editor.
- **Rename synchronisation** - rename a page and AS Notes updates every wikilink that points to it, across the entire wiki.
- **Batch editing** - use VS Code's multi-file search, find-and-replace, and refactoring tools across your whole wiki at once.
- **Offline access** - work on your wiki without an internet connection, then push when you are ready.
- **Full AS Notes feature set** - [[Task Management]], [[Slash Commands]], [[Kanban Board]], inline markdown rendering, and everything else in AS Notes works in a wiki workspace just as it does in any other. Anything you don't want committed to the wiki repository can be excluded in `.gitignore`.

## Enable the Wiki on Your Repository

GitHub wikis are disabled by default on new repositories.

1. Go to your repository on GitHub
2. Click **Settings**
3. Scroll down to the **Features** section
4. Check **Wikis**

You need to create at least one page through the browser before the wiki Git repository exists. Click the **Wiki** tab on your repository and create a `Home` page with any placeholder content.

## Clone the Wiki

Every GitHub wiki is a standalone Git repository at `YOUR-REPO.wiki.git`. Clone it like any other repo:

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.wiki.git
```

This results in a local folder containing markdown files - one per wiki page.

## Open in VS Code and Initialise AS Notes

1. Open the cloned wiki folder in VS Code (`File → Open Folder`)
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **AS Notes: Initialise Workspace**

AS Notes creates its `.asnotes/` directory and indexes every markdown file. Wikilink highlighting, autocomplete, and backlinks activate immediately.

> Add `.asnotes/` to `.gitignore` in the wiki repo to keep AS Notes metadata out of version control. The initialisation command does this automatically if a `.gitignore` exists.

## Wikilinks: Same Syntax, Same Behaviour

GitHub wiki uses `[[Page Name]]` wikilinks to link between pages - which AS Notes uses. When you type `[[` in AS Notes, you see every page in the wiki and can insert a link with a single keystroke. GitHub renders these links on the wiki when you push.

**Page name resolution** works the same way in both systems: `[[Getting Started]]` links to `Getting-Started.md` on GitHub (GitHub converts spaces to hyphens in URLs) and to `Getting Started.md` in AS Notes. AS Notes resolves by display name, so you write the natural page title and both systems understand it.

Note that Github wiki does not support nested wikilinks, so you will likely want to avoid the use of nested wikilinks supported by AS Notes.

## Subdirectories

GitHub wiki supports subdirectories when you work locally. You can organise pages into folders:

```
wiki/
  Home.md
  guides/
    Installation.md
    Configuration.md
  reference/
    API.md
    CLI.md
```

Wikilinks resolve across subdirectories in both GitHub wiki and AS Notes - `[[Installation]]` links correctly regardless of which folder the source file is in.

> **Note:** The GitHub wiki browser UI shows a flat list of pages regardless of directory structure. Subdirectories are a local organisational convenience - they do not create navigation hierarchy on GitHub.

## Workflow

Once initialised, the day-to-day workflow is straightforward:

1. **Edit** wiki pages in VS Code with full AS Notes support
2. **Create new pages** by creating `.md` files (or navigating to a wikilink for a page that doesn't exist yet)
3. **Commit** your changes: `git add . && git commit -m "Update wiki"`
4. **Push** to GitHub: `git push`

Changes appear on the GitHub wiki immediately after pushing.

To pull changes made by collaborators through the GitHub browser UI:

```bash
git pull
```

## Tips

**Use `.asnotesignore` to exclude non-wiki files.** If your wiki repo contains images or other assets you don't want indexed, add patterns to `.asnotesignore`. See [[Getting Started]] for details.

**Keep page names simple.** Avoid special characters (`\ / : * ? " < > |`) in filenames - GitHub wiki does not support them.

**Leverage templates.** If you create many wiki pages with a consistent structure, use AS Notes [[Slash Commands]] templates to insert boilerplate.

## Limitations

- GitHub wiki does not support AS Notes front matter fields like `public`, `layout`, or `order`. Front matter in wiki pages is ignored by GitHub.
- The GitHub wiki browser UI does not display subfolder structure - all pages appear in a flat sidebar list.
- GitHub wiki `[[wikilinks]]` use MediaWiki-style display syntax (`[[Page|Display Text]]`), while AS Notes uses the reversed order. Links without display text (`[[Page Name]]`) work identically in both.

## Example

The AS Notes repository has a live wiki with example pages edited using this workflow. See [github.com/appsoftwareltd/as-notes/wiki](https://github.com/appsoftwareltd/as-notes/wiki) for a working example.
