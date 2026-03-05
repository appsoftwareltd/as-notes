# What If Your Note-Taking App Was Already Open?

*An introduction to AS Notes — wikilink-based knowledge management, right inside VS Code.*

---

I've tried most of the PKM apps. Obsidian for a couple of years. A brief but enthusiastic Logseq phase. Notion before that. Roam Research before that. They're all doing interesting things, and I've learned something from each of them.

But I always ended up in the same place: eventually closing the app, switching back to VS Code, and leaving a half-finished thought in a tab I'd never find again.

The problem wasn't the apps. It was the switching. When you're a developer, VS Code is already open. It's always open. Your brain is already in it. Every time you jump to a separate note-taking app — even a good one — there's a small but real cost: the context switch, the loading time, the "where was I" moment. And the cumulative cost of that, over months and years, is a knowledge base you neglect.

So I built something that doesn't make you switch at all.

---

## Meet AS Notes

**AS Notes** is a VS Code extension that turns the editor you're already using into a proper [Personal Knowledge Management System](https://www.appsoftware.com/blog/as-notes-turn-vs-code-into-your-personal-knowledge-management-system-pkms). Wikilinks, backlinks, tasks, a daily journal, autocomplete — the works. No Electron wrapper. No separate window. No account. Just your markdown files, in a folder you control, in the editor you already have open.

Install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes), open a folder, run **AS Notes: Initialise Workspace** from the Command Palette, and you're done. That's genuinely it.

---

## How Does It Compare to Obsidian and Logseq?

Fair question, since Obsidian and Logseq are the two most popular choices in this space right now. Let me be direct about the trade-offs.

### Obsidian

Obsidian is polished, has a massive plugin ecosystem, and looks great. Its graph view is genuinely impressive and its community is enormous. If you want a standalone app with a visual knowledge graph and dozens of first-party plugins, Obsidian is hard to beat.

The friction points with Obsidian, for me:

- **It's a separate app.** Electron-based, its own window, its own set of keyboard shortcuts you have to maintain alongside VS Code's.
- **The sync story isn't free.** Local-only is fine, but any cross-device sync costs you a Obsidian Sync subscription. The files are yours, but the infrastructure isn't free.
- **The editor is VS Code-adjacent, not VS Code.** You lose GitHub Copilot, your exact theme configuration, your snippets, your extensions. You get a reasonable editor, but you already have a better one.

### Logseq

Logseq takes a different philosophical approach — it's outliner-first. Every piece of content is a bullet. The graph database and block-level backlinking are genuinely powerful for certain workflows, particularly research and incremental note-taking.

The friction points:

- **Everything is a bullet.** If you don't want to think in outlines, Logseq feels slightly alien. Prose-heavy notes feel forced.
- **A proprietary block format.** Your markdown files work, but the Logseq semantic layer (block references, block IDs, journal-default structure) means your notes aren't quite plain markdown anymore. Try opening them in another editor and you'll see what I mean.
- **The Electron/WASM web app is heavy.** Logseq has been working on a database version for some time. The file-based version has known performance issues with large knowledge bases.

### AS Notes

AS Notes is not trying to be either of those things. It's not trying to win on plugin ecosystem, and it won't give you a 3D graph view. What it does instead:

- **It lives inside VS Code.** Your existing keybindings, your Copilot, your Vim plugin, your themes, your terminal — it all works alongside your notes.
- **Your files are just markdown.** No proprietary block format, no block IDs, no JSON database lurking behind your notes. Open any file in any editor and it looks exactly like what it is.
- **It's fast on large knowledge bases.** Power users with 15,000–20,000 markdown files have been the primary stress test. The SQLite index (running as WASM — no native dependencies) keeps everything responsive.
- **It's private by default.** Nothing leaves your machine. No telemetry, no cloud service, no account required.

The honest summary: if you want a dedicated, beautiful PKM app with a graph view and a marketplace of plugins, Obsidian is probably the right choice. If you already live in VS Code and want your notes to live there too, AS Notes is built for you.

---

## The Features

### Wikilinks — Including Nested Ones

Type `[[` anywhere in a markdown file to trigger autocomplete. Every page and alias in your workspace appears. Select one, and `[[Page Name]]` is inserted. Ctrl+Click to navigate. If the page doesn't exist, it's created.

This is standard stuff. What's less standard is **nested wikilink support**:

```markdown
[[Specific [[Topic]] Details]]
```

This creates two navigable targets. Click on `Topic` and you go to `Topic.md`. Click on the outer portions and you go to `Specific [[Topic]] Details.md`. Nesting works to arbitrary depth, and the extension always highlights the innermost link under your cursor so you know exactly where you're going.

Obsidian doesn't support nested wikilinks. AS Notes handles them correctly in navigation, hover tooltips, autocomplete, rename tracking, and markdown preview rendering.

### Rename Tracking

Edit a wikilink's text, move your cursor away, and AS Notes asks if you want to rename the target file and update every reference across your entire workspace. One confirmation dialog. Done.

This works with nested links too — editing the inner link in `[[Outer [[Inner]] text]]` offers to rename both the inner and outer pages simultaneously.

### Backlinks Panel

`Ctrl+Alt+B` opens the Backlinks panel. It shows every page that links to the file you're currently editing, with the surrounding line for context. It stays in sync as you move between files. Click any entry to jump directly to the source.

Backlinks include alias references too (more on aliases below).

### Page Aliases

Sometimes a concept has multiple names. Add them in YAML front matter:

```yaml
---
aliases:
  - JS
  - ECMAScript
---
```

Now `[[JS]]` and `[[ECMAScript]]` both navigate to `JavaScript.md`. Hover tooltips show the resolution path, autocomplete lists aliases with an arrow to their canonical page, and backlink counts include alias references.

### Tasks Panel

Every `- [ ] todo item` across your entire knowledge base, aggregated in one panel in the Explorer sidebar. Click to jump to the source line. Toggle done/pending directly from the panel. Filter to show only unchecked items.

Or just press `Ctrl+Shift+Enter` on any line to cycle through the three states: no marker → `[ ]` → `[x]` → no marker.

If you've been keeping a running todo list as a markdown file in Obsidian, this is a considerable upgrade.

### Daily Journal

`Ctrl+Alt+J` creates or opens today's journal entry. Files are named `YYYY_MM_DD.md` and generated from a template you control. Add your own sections, prompts, or front matter. Journal files are indexed immediately — wikilinks and backlinks work from the moment the file is created.

### `.asnotesignore` — Because You Might Already Have a Knowledge Base

Here's something both Obsidian and Logseq solve with their own directory structures: keeping their internal metadata out of your notes. AS Notes does it differently — when you initialise a workspace, it creates a `.asnotesignore` file at the root. It uses standard `.gitignore` syntax to tell AS Notes which paths to skip.

The defaults exclude `logseq/`, `.obsidian/`, and `.trash/` — which means if you have an Obsidian or Logseq vault, AS Notes can run alongside it without indexing the metadata directories. You can edit the file freely. It's version-controlled, never overwritten.

### Encrypted Notes (Pro)

Any file with a `.enc.md` extension is treated as an encrypted note. Your passphrase lives in the OS keychain — never written to disk. Encryption uses AES-256-GCM with a per-encryption random nonce and PBKDF2-SHA256 key derivation. There's also a Git pre-commit hook that blocks accidental commits of decrypted `.enc.md` files.

This is a Pro feature. Free users get everything else described above.

---

## What You Get For Free by Being in VS Code

This is the part that often gets overlooked in comparisons. AS Notes doesn't have to build a lot of things because VS Code already has them:

- **AI chat on your notes.** GitHub Copilot, Claude for VS Code, or any other AI extension can read, edit, and reason about your markdown files. Ask it to summarise a page, extract action items, or draft a note based on another. This is not a feature AS Notes needs to build — it just works.
- **Vim mode.** [VSCodeVim](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim) runs on top of AS Notes with zero configuration.
- **Mermaid diagrams.** Any Mermaid extension renders your diagrams in preview. Your notes can have architecture diagrams, flowcharts, and sequence diagrams right alongside the prose.
- **Git.** Your knowledge base is just a folder of markdown files. Commit, diff, branch, and review your notes the same way you review code. Obsidian has a community plugin for this. VS Code has had it since day one.
- **Multi-cursor editing.** Yes, you can edit multiple wikilinks simultaneously.
- **Multiline outliner.** `Ctrl+[` and `Ctrl+]` indent and dedent selected lines — Logseq-style bullet hierarchy without needing a dedicated outliner app.

---

## Getting Started

1. Install [AS Notes from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
2. Open any folder in VS Code
3. Open the Command Palette (`Ctrl+Shift+P`) and run **AS Notes: Initialise Workspace**
4. Type `[[` in any markdown file

That's it. If you want a sample knowledge base to explore first, clone the [demo notes repository](https://github.com/appsoftwareltd/as-notes-demo-notes) and follow the setup instructions there.

The source is on [GitHub](https://github.com/appsoftwareltd/as-notes). Free for personal use, Pro licence available for encrypted notes.

---

If you've been meaning to sort out your note-taking workflow, you probably don't need a new app. You need to stop switching to one.

---

*[Gareth Brown](https://www.appsoftware.com/contact) is a UK based software engineer. AS Notes is available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes).*
