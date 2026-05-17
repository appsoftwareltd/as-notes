---
title: Introducing AS Notes
description: AS Notes is a Personal Knowledge Management extension for VS Code. Wikilinks, backlinks, tasks, journals, kanban, and a built-in static site generator - all running on plain markdown files in your editor.
date: 2026-03-24
author: Gareth Brown
order: 1
---

# Introducing AS Notes

**`[[wikilink]]`-style knowledge management inside VS Code. Plain markdown files, local SQLite index, no cloud account required.**

Most note-taking tools want you to leave your editor. AS Notes doesn't. It runs as a VS Code extension - so your notes live in the same environment as your code, your terminal, and your Git history.

> Download from [AS Notes - VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)

## What it does

You write standard markdown files, link pages with `[[wikilinks]]`, and the extension handles the rest: link resolution, backlinks, renaming, task tracking, journaling, and navigation across your workspace.

**Wikilinks.** Type `[[Page Name]]` and AS Notes resolves it globally - no folder paths, no extensions. Rename a file and every reference to it updates automatically. Case-insensitive matching, page aliases, subfolder resolution, and nested links are all handled.

**Backlinks with context.** The backlinks panel shows every page linking to the current one as a chain - the full outline path from root down to the link. Click any entry to jump to the source line.

**Tasks in your notes.** Toggle TODOs with `Ctrl+Shift+Enter`. Tag priority (`#P1`, `#P2`, `#P3`), due dates (`#D-2026-03-25`), and waiting flags (`#W`) inline. The Tasks panel aggregates everything across your workspace and groups by page, priority, or due date.

**Daily journal.** `Ctrl+Alt+J` opens today's entry from a template. A calendar panel in the sidebar shows which days have entries.

**Kanban backed by markdown.** Each card is a `.md` file with YAML front matter. Drag between lanes, add entries, attach files - every change is a plain text file you can diff.

**Outliner mode.** Every line becomes a bullet. Tab/Shift+Tab to indent, Enter to continue, multi-line paste splits into individual items.

**Slash commands.** Type `/` for dates, code blocks, tables (with add/remove row and column operations), templates, and task tags.

Everything runs on plain `.md` files. Nothing proprietary, nothing you can't open in any other editor tomorrow.

## VS Code as the host

VS Code is already installed for most developers. Using it as your notes app means you get a lot for nothing extra:

- **Remote development** - SSH, containers, WSL, Codespaces. Your notes follow your dev environment.
- **AI extensions** - GitHub Copilot, Claude, and others can read and work with your notes directly
- **The extension ecosystem** - Mermaid diagrams, Vim keybindings, draw.io, PDF preview, all usable alongside AS Notes
- **Git** - stage, diff, branch, and resolve conflicts without leaving the editor

If you already live in VS Code, there's no context switch.

## Your data stays local

AS Notes works fully offline.

The index is a local SQLite database at `.asnotes/index.db`, built using a WASM build of SQLite - no native dependencies. The source is [on GitHub](https://github.com/appsoftwareltd/as-notes) if you want to see how it works.

For sensitive content, AS Notes Pro supports AES-256-GCM encryption. The passphrase is stored in the OS keychain via VS Code's `SecretStorage` - never written to disk.

## Publishing

AS Notes can convert your markdown notes to a static website. This blog is built that way - each post is a `.md` file, pushed to Git, built by Cloudflare Pages. The same setup works with GitHub Pages, Netlify, Vercel, or any static host.

There's more detail in: [AS Notes - A Static Site Generator in your Markdown Knowledgebase](as-notes-a-static-site-generator-in-your-markdown-knowledgebase.html)

## Getting started

1. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
2. Open the Command Palette (`Ctrl+Shift+P`) and run **AS Notes: Initialise Workspace**
3. Type `[[` in any markdown file to start linking

To see a working knowledge base, clone the [demo notes repository](https://github.com/appsoftwareltd/as-notes-demo-notes) and open it in VS Code.

AS Notes is free. Templates, table commands, kanban, and encrypted notes are Pro features - licence keys at [asnotes.io/pricing](https://www.asnotes.io/pricing).

## Resources

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
- [Documentation](https://www.asnotes.io)
- [GitHub](https://github.com/appsoftwareltd/as-notes)
- [Demo notes](https://github.com/appsoftwareltd/as-notes-demo-notes)
- [Pricing](https://www.asnotes.io/pricing)
