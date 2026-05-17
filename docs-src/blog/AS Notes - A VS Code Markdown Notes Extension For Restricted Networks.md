---
title: AS Notes - A VS Code Markdown Notes Extension For Restricted Networks
description: AS Notes runs entirely offline inside VS Code. No Electron app to approve, no cloud sync, no data leaving your machine. A markdown knowledge base that works where Obsidian and Logseq can't.
date: 2026-03-25
author: Gareth Brown
public: true
order: 2
---

# AS Notes - A VS Code Markdown Notes Extension For Restricted Networks

**Your IT department already approved VS Code. AS Notes runs inside it. No new application to vet, no network access required, no data leaving your machine.**

If you work in an organisation with a locked-down desktop policy, you may have come across this problem. You want a knowledge management tool — something with wikilinks, backlinks, daily journals, task tracking — but the tools that do this well (Obsidian, Logseq, Notion) require installing a separate application. That means a procurement request, a security review, and weeks of waiting for an answer that might be no.

AS Notes is a VS Code extension. If your organisation permits VS Code (and most do — it's the default editor for millions of developers, data engineers, and DevOps teams), then AS Notes is already installable from the marketplace. No additional binary. No Electron wrapper. No separate runtime.

> Download from [AS Notes - VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)

## What you get

AS Notes is a Personal Knowledge Management System that runs as a VS Code extension. You write markdown files, link them with `[[wikilinks]]`, and the extension handles resolution, backlinks, renaming, and navigation across your entire workspace.

It reaches feature parity with standalone PKMS tools on the things that matter:

**Wikilinks that actually work.** Links resolve globally across your workspace. Rename a link and every reference updates. Case-insensitive matching, page aliases, nested links, subfolder resolution — the edge cases are handled.

**Backlinks with full context.** The backlinks panel shows every incoming link as a chain — the full outline path from root to link. Group by page or by chain pattern. Click any link to jump straight to the source line.

**Task management built into your notes.** Toggle TODOs with `Ctrl+Shift+Enter`. Add priority (`#P1`, `#P2`, `#P3`), due dates (`#D-2026-03-20`), and waiting flags (`#W`) as inline hashtags. The Tasks panel aggregates everything across your workspace.

**Daily journaling.** `Ctrl+Alt+J` creates today's journal from a template. A calendar panel in the sidebar shows which days have entries.

**Kanban boards backed by markdown.** Each card is a `.md` file with YAML front matter. Drag cards between lanes, add entries, attach files. Every change is a diffable text file under version control.

**Outliner mode.** Toggle it on and every line starts with a bullet. Tab/Shift+Tab for indentation, Enter continues the list.

All of it runs on plain markdown files. No proprietary format. No database you can't read. Git-friendly from day one.

## Nothing leaves your machine

This is the part that matters for restricted environments.

AS Notes does not need to connect to external servers. There is no telemetry, no analytics, no cloud sync. The extension is fully functional on an air-gapped machine with no network access.

All indexing runs locally via an embedded SQLite database (`.asnotes/index.db`) using `sql.js` — a WASM build of SQLite with zero native dependencies. Your notes are indexed on your filesystem and nowhere else.

The extension is also [source-available](https://github.com/appsoftwareltd/as-notes). Security teams can audit the code and verify these claims for themselves. There's no obfuscated binary to trust blindly.

## Encrypted notes

For sensitive content, AS Notes Pro supports AES-256-GCM encryption with PBKDF2-SHA256 key derivation (100,000 iterations). Encrypted files use the `.enc.md` extension and contain a single-line ciphertext marker — they're unreadable without the passphrase.

Your passphrase is stored in the OS keychain via VS Code's `SecretStorage` API. It is never written to disk or to settings files.

A fresh 12-byte random nonce is generated per save, so encrypting the same content twice produces different ciphertext. No pattern analysis from repeated edits.

AS Notes also installs a Git pre-commit hook that blocks commits containing any `.enc.md` files still in plaintext. An accidental push of unencrypted sensitive notes is caught before it happens.

## VS Code gives you the rest for free

Choosing VS Code as the host means you inherit everything it already does well:

- **Cross-platform** — Windows, macOS, Linux, plus browser-based via VS Code for the Web
- **Remote development** — SSH, containers, Codespaces, WSL. Your notes travel with your dev environment
- **AI chat** — GitHub Copilot, Claude, and other LLM extensions can query and work with your notes directly
- **Extensions** — Mermaid diagrams, Vim keybindings, PDF preview, draw.io, and thousands more — all usable alongside AS Notes
- **Themes and keyboard shortcuts** — everything you've already configured
- **Git integration** — staging, diffing, branching, and merge conflict resolution built in

You don't need to learn a new application. You already know this one.

## Obsidian and Logseq compatibility

AS Notes workspaces are plain markdown files in plain folders. If you've been using Obsidian or Logseq, your existing notes work in AS Notes without migration. The file structures are similar enough that you can point AS Notes at the same directory.

There are format and behavioural differences between tools, but your data isn't locked in. Move between them freely — they're all reading the same markdown.

## Publishing internal docs with GitOps

AS Notes includes a [built-in static site generator](https://docs.asnotes.io/publishing-a-static-site.html) that converts your markdown into a deployable website. The same notes you write in VS Code become your team's documentation site, internal wiki, or public knowledge base.

The workflow fits how engineering teams already operate:

1. Write and edit docs in VS Code as markdown files
2. Link pages with `[[wikilinks]]` — the converter resolves them to HTML links
3. Push to Git
4. CI/CD builds and deploys the static site

Every change is a Git commit. Every page is a reviewable pull request. Every deployment is traceable. Access control is whatever your Git host provides.

Deploy to GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any internal static file server. This blog itself is [published using AS Notes on Cloudflare Pages](https://blog.asnotes.io/as-notes-a-static-site-generator-in-your-markdown-knowledgebase.html).

No CMS to manage. No wiki software to maintain. No database backups to worry about. Your documentation lives in the same Git repository as the thing it documents.

## Getting started

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes). Open the Command Palette and run **AS Notes: Initialise Workspace**. That's it.

For a sample knowledge base to explore, clone the [demo repository](https://github.com/appsoftwareltd/as-notes-demo-notes).

AS Notes is free. Pro features (templates, table commands, kanban, encrypted notes) are available with a licence key from [asnotes.io](https://www.asnotes.io/pricing).

## Resources

- [AS Notes on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
- [AS Notes documentation](https://www.asnotes.io)
- [Publishing a Static Site docs](https://docs.asnotes.io/publishing-a-static-site.html)
- [AS Notes on GitHub](https://github.com/appsoftwareltd/as-notes)
