# Getting Started

This page gets you from zero to a working AS Notes workspace in a few minutes.

## 1. Install the Extension

Install **AS Notes** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes).

Open VS Code, go to the Extensions view (`Ctrl+Shift+X`), search for **AS Notes**, and click **Install**.

## 2. Open a Folder

AS Notes works on a VS Code workspace folder — a folder containing your markdown notes. If you don't have one yet, create an empty folder and open it in VS Code (`File → Open Folder`).

> Want a ready-made example? Clone the [AS Notes demo notes](https://github.com/appsoftwareltd/as-notes-demo-notes) repository and open it in VS Code.

## 3. Initialise the Workspace

AS Notes does not activate until you initialise your workspace. You will see a status bar item at the bottom of VS Code inviting you to do so.

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **AS Notes: Initialise Workspace**

This creates a `.asnotes/` directory at the workspace root, builds a SQLite index of all your markdown files, and activates all extension features. The index file is automatically added to `.gitignore`.

After initialisation the status bar shows **AS Notes** (or **AS Notes (Pro)** if you have a licence key configured).

## 4. Write Your First Note

Create a new `.md` file and start writing. Type `[[` anywhere to trigger [[Wikilinks]] autocomplete — a list of all your pages appears immediately.

## 5. Explore the Features

| What you want to do | Where to look |
|---|---|
| Link between notes | [[Wikilinks]] |
| See what links to a page | [[Backlinks]] |
| Open today's journal | [[Daily Journal]] |
| Manage your todos | [[Task Management]] |
| Insert tables, code, dates | [[Slash Commands]] |
| Drop images into notes | [[Images and Files]] |
| Store sensitive notes | [[Encrypted Notes]] |
| Publish notes as a website | [[Publishing a Static Site]] |
| Adjust extension settings | [[Settings]] |
| Inline formatting preview | [[Inline Editor]] |

## Excluding Files from the Index

When AS Notes initialises, it creates a `.asnotesignore` file at the workspace root. This file controls which files and directories are excluded from the index, using [`.gitignore` pattern syntax](https://git-scm.com/docs/gitignore).

The default contents exclude some common tool directories:

```
# Logseq metadata and backup directories
logseq/

# Obsidian metadata and trash directories
.obsidian/
.trash/
```

Edit `.asnotesignore` any time — AS Notes watches the file and re-scans automatically when it changes. Newly ignored files are removed from the index; un-ignored files are added.

> `.asnotesignore` is version-controlled and user-editable. AS Notes will never overwrite it after initial creation.

## Rebuilding the Index

If the index ever becomes stale or corrupted, run **AS Notes: Rebuild Index** from the Command Palette. This drops and recreates the entire index with a progress indicator.

## Cleaning the Workspace

If the extension is in a bad state (e.g. persistent errors after a crash), run **AS Notes: Clean Workspace** to remove the `.asnotes/` directory and reset all in-memory state. Your `.asnotesignore` file is preserved. Run **AS Notes: Initialise Workspace** afterwards to start fresh.

## Compatibility With Other Tools

AS Notes workspaces are plain markdown files in plain folders — they are compatible with Obsidian and Logseq due to similar file structures. Be aware there are format and behavioural differences, but you can use the same notes folder with multiple tools.
