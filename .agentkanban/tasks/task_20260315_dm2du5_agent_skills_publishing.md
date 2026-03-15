---
title: Agent Skills publishing
lane: test
created: 2026-03-15T19:46:30.654Z
updated: 2026-03-15T20:20:31.212Z
sortOrder: 5
slug: agent_skills_publishing
---

## Conversation

### user

Develop agent skills for this extension.

Based on README.md, create the `.agent/skills/SKILL.md` skills folder at the root of this repository, generate the skill file and document it's availability and installation via the Vercel skills (`npx skills add ...`).

### agent

## Plan

### Goal

Create a `SKILL.md` agent skill file for the AS Notes VS Code extension so that AI assistants can learn how to help users work with and configure it. Publish the skill so users can install it via the open agent skills ecosystem (`npx skills add appsoftwareltd/as-notes`).

### What a SKILL.md Is

The open agent skills ecosystem (skills.sh / `npx skills`) uses a `SKILL.md` file in `.agent/skills/` at the repo root. When a user runs:

```bash
npx skills add appsoftwareltd/as-notes
```

The CLI fetches the skill and installs it locally so the AI assistant can access it. The skill file has:
- **YAML frontmatter** — `name`, `description`, `license`, `metadata` (author, version)
- **Markdown body** — domain knowledge for the AI: syntax, commands, settings, patterns, examples

### What the SKILL.md Should Cover

Based on README.md, the skill should document the following topics so an AI can help AS Notes users effectively:

| Section | Content |
|---|---|
| **Overview** | What AS Notes is, how to initialise a workspace, `.asnotes/` directory |
| **Wikilink syntax** | `[[wikilink]]`, nested wikilinks, aliases, autocomplete, rename tracking |
| **Task / TODO system** | Toggle syntax, metadata tags (`#P1`, `#W`, `#D-YYYY-MM-DD`), Tasks panel |
| **Backlinks panel** | How to open (keyboard shortcuts), chain display, flat vs grouped modes |
| **Daily journal** | Keyboard shortcut, file format, template, configurable folder |
| **Slash commands** | Full command table including table commands, task commands, date picker |
| **Outliner mode** | Keybindings, code block completion |
| **Encryption (Pro)** | `.enc.md`, commands, AES-256-GCM details, key management |
| **Kanban board** | Board/lane/card structure, storage format, commands |
| **Settings reference** | All `as-notes.*` settings with defaults |
| **Workspace init & maintenance** | Init, Rebuild Index, Clean Workspace, `.asnotesignore` |
| **File types** | `.md`, `.markdown` |
| **Installation** | `npx skills add` command |

### File Location

```
.agent/
  skills/
    SKILL.md    ← skill file to create
```

### Skill Metadata

- **name:** `as-notes`
- **description:** A concise trigger description — use when user is working with AS Notes in VS Code (PKMS wikilinks, tasks, backlinks, journal, kanban, slash commands, encryption, settings)
- **license:** `Elastic-2.0` (matching the extension)
- **author:** `appsoftwareltd`

### Install Command (to document in README)

```bash
npx skills add appsoftwareltd/as-notes
```

### Questions / Decisions

1. **Licence Rationale** — The extension uses Elastic License 2.0. Should the skill itself use a different licence (e.g. MIT) to maximise adoption? Or match the extension? I'll default to matching the extension unless you say otherwise. [comment: It can use MIT]
2. **README update** — Should I add an "Agent Skills" section to `README.md` documenting installation? Included in scope unless you'd prefer to skip. [comment: Yes - include]
3. **Pro features** — The skill will document Pro features (encryption, table commands) as they are documented publicly in README. Confirm this is desired. [comment: Yes include]

### agent

## Implementation Summary

**Decisions applied from plan comments:**
- Licence: MIT (for broader adoption)
- README update: included
- Pro features: included

**Files created/modified:**

1. **`.agent/skills/SKILL.md`** (created) — Full agent skill for AS Notes covering:
   - Workspace initialisation, `.asnotes/` directory, `.asnotesignore`
   - Wikilink syntax, nesting, aliases, autocomplete, rename tracking, disambiguation
   - Task/TODO toggle, metadata tags (`#P1`–`#P3`, `#W`, `#D-`, `#C-`), Tasks sidebar
   - Backlinks panel (keyboard shortcuts, flat/chain modes, context verbosity, context menu)
   - Daily journal (shortcut, filename format, template, settings)
   - Slash commands — full table including table and task sub-commands
   - Outliner mode (keybindings, code block completion)
   - File drag & drop / paste asset path
   - Kanban board (storage format, card format, boards/lanes/cards, commands) — Pro
   - Encrypted notes (AES-256-GCM, PBKDF2, commands, OS keychain) — Pro
   - All settings (`as-notes.*`) with defaults
   - Keyboard shortcuts summary
   - Passive mode note

2. **`README.md`** (modified) — Added "Agent Skills" section early in the document:
   ```bash
   npx skills add appsoftwareltd/as-notes
   ```

### user

One of the use cases is that the agent can write and contribute to notes in the as notes format (using wikilinks, task tags, and other features that build on markdown). The second use case is the agent being able to help the user use and troubleshoot AS notes.

Make this clear early in the documentation and ensure that the skill has enough information to support both use cases.

### agent

## Plan

Two use cases to surface explicitly:
1. **Writing notes** — agent creates/edits markdown in AS Notes format
2. **Helping users** — agent answers questions, configures settings, troubleshoots

**Changes to `.agent/skills/SKILL.md`:**
- Update `description` frontmatter to name both use cases
- Add "How to Use This Skill" section (use case 1 + use case 2) right after the overview
- Add "Writing Notes in AS Notes Format" section with templates: standard page with front matter/aliases, task lines with all tag variants, daily journal entry, outliner-mode bullets, kanban card file

## Implementation Summary

**Files modified:** `.agent/skills/SKILL.md`

1. **`description` frontmatter** updated to v1.1 — explicitly names writing notes and troubleshooting/help as the two use cases
2. **"How to Use This Skill"** section added before feature docs — states both use cases, cross-links to the writing templates section and reference sections below
3. **"Writing Notes in AS Notes Format"** section added — practical templates:
   - Standard page (YAML front matter + aliases + wikilinks in prose)
   - Task lines (all tag variants with inline examples)
   - Daily journal entry (filename convention + template body)
   - Outliner-mode page (bullet-first format)
   - Kanban card file (front matter template + filename convention)

### user

Note the use case description the publishing / html conversion capability that can be used to generate documentation and content from notes 

### agent

## Plan

Add the `html-conversion` publishing capability as a third use case in SKILL.md.

**Changes:**
1. **`description` frontmatter (v1.2)** — add publishing/static site generation as a third named capability
2. **Use case 3** block in "How to Use This Skill" — agent can help run or configure the `html-conversion` tool; cross-link to reference section
3. **"Publishing to Static HTML"** section — full reference: what the tool does, basic usage, CLI flags (`--input`, `--output`, `--stylesheet`, `--asset`), full example command, GitHub Pages/CI guidance, output structure

## Implementation Summary

**Files modified:** `.agent/skills/SKILL.md`

1. `description` frontmatter updated to v1.2 — names all three use cases including publishing
2. "Use case 3: Publishing notes as a static HTML site" block added to "How to Use This Skill", cross-linking to the new reference section
3. "Publishing to Static HTML" section added before "Passive Mode" — covers: what the tool does, `npm run convert` usage, all CLI flags, stylesheet/asset example, GitHub Actions step example, output structure

### user

That was not really a 3rd usecase - I just wanted to note that the agent may contribute to notes that can be published to support documentation and content generation

### agent

## Plan

Publishing is part of use case 1 (writing notes), not a separate use case. Corrections needed:
- Remove standalone "Use case 3" block from "How to Use This Skill"
- Fold the publishing angle into use case 1 — note that notes authored by the agent can be converted to a static HTML site for docs/content generation
- Update `description` frontmatter to reference 2 use cases (not 3), with publishing mentioned as part of use case 1
- Retain the "Publishing to Static HTML" reference section (still valuable)

## Implementation Summary

**Files modified:** `.agent/skills/SKILL.md`

1. `description` frontmatter updated to v1.2 — 2 use cases; publishing noted inline within use case 1
2. Use case 3 block removed
3. Use case 1 extended — added publishing sentence: *"Notes authored in AS Notes format can also be published as a static HTML site using the `html-conversion` tool — wikilinks become relative HTML links and a nav sidebar is generated automatically."*

### user

Now optimise for conciseness - retain all information but reduce anything unnecessary

### agent

## Plan

Rewrite `.agent/skills/SKILL.md` (v1.3) to be more concise throughout while retaining every fact.

Key cuts:
- "How to Use This Skill" — prose condensed to two bold one-liner entries
- Wikilinks — removed alias code block (already in Writing Notes), condensed resolution/disambiguation to inline sentences
- Task toggle — "plain → - [ ] → - [x] → plain" compressed to one line
- Task metadata tags table — collapsed P1/P2/P3 into one row
- Backlinks — removed "Shows all incoming..." sentence (obvious from heading)
- Daily Journal — merged auto-setup, idempotent, template notes into one sentence
- Slash commands — collapsed row pairs (Remove Above/Below, Right/Left)
- Kanban — removed verbose board/lane/card prose; collapsed storage diagram; table trimmed
- Encrypted Notes — command table collapsed Encrypt/Decrypt All and Current into two rows
- Publishing — removed duplicate "compiled CLI" block; condensed What it does bullets; merged CI step

## Implementation Summary

**Files modified:** `.agent/skills/SKILL.md` (v1.2 → v1.3) — full rewrite for conciseness. All information retained.

### user


