# Changelog

All notable changes to AS Notes will be documented here.

## Pending Release

## [2.3.0] - 2026-03-25

- Feature: Inline Markdown editor (Typora-like syntax shadowing). Bold, italic, headings, links, images, code blocks, tables, emoji, Mermaid diagrams, and LaTeX math are rendered inline with a three-state visibility model (rendered/ghost/raw). Toggle via command palette or editor title bar eye icon. Based on markdown-inline-editor-vscode by SeardnaSchmid (MIT).
- Feature: Detects conflicting Markdown Inline Editor extensions and offers to disable them.
- Feature: Outliner mode awareness -- bullet markers and checkbox syntax always remain visible when outliner mode is active.

## [2.3.1] - 2026-03-31

- Feature: Improved page / wikilink rename merge behaviours.
- Feature: Mermaid / LaTeX rendering in published HTML (static site rendering).

## [2.3.0] - 2026-03-28

- Feature: Integration of inline markdown editing.

## [2.2.9] - 2026-03-24

- Feature: Improved default themes for static HTML publishing.

## [2.2.8] - 2026-03-24

- Feature: Publishing to static HTML sites from AS Notes, including npm package for CI/CD.  

## [2.2.7] - 2026-03-23

- Feature: Move to offline licence activation for licence keys.

## [2.2.6] - 2026-03-19

- Bugfix: Non initialised directories showed permanent loading status in the sidebar / icon.

## [2.2.5] - 2026-03-19

- Calendar in side bar for navigating Journal files

## [2.2.4] - 2026-03-19

- Root directory setting so that AS Notes can be nested in project folders without interference

## [2.2.3] - 2026-03-18

- Templates and template placeholders
- Modified default note placement behaviour
- Kanban boards markdown formatting
- Kanban board card conversion from task (markdown todo)

## [2.2.0] - 2026-03-12

- Added Kanban boards
- Improved editor fenced codeblock completion behaviours in and out of outliner mode / context

## [2.1.1] - 2026-03-11

- Wikilink / alias search section in side bar
- Slash commands `/` for task #hashtags
- Rendering of task hashtags in HTML conversion

## [2.1.0] - 2026-03-10

- Add outliner mode

## [2.0.1] - 2026-03-10

- Fix sidebar display / readiness bug

## [2.0.0] - 2026-03-10

- Updated task view with hash tags for priority, due date, waiting

## [1.0.13] - 2026-03-06

- Documentation: LICENCE

## [1.0.12] - 2026-03-06

- Feature: Backlink pane improved layout and options for compact / wrapped context, flat ordering or grouping by wiki link chain.

## [1.0.11] - 2026-03-06

- Feature: Backlinks now based on mention and on indentation relationships - "outliner" style.

## [1.0.10] - 2026-03-05

- Bug Fix: Resolution of OOM on rebuild index for large (20k) `.md` file knowledge bases.

## [1.0.9] - 2026-03-04

- Feature: Added image drag drop / copy paste path handling and hover preview for images

## [1.0.8] - 2026-03-03

- Feature: Added encryption (`.enc.md`) files (Pro feature)

## [1.0.7] - 2026-03-02

- Documentation: Documentation / README

## [1.0.6] - 2026-03-02

- Feature: Daily journal

## [1.0.5] - 2026-03-02

- Feature: Backlinks panel
- Feature: Tasks panel

## [1.0.4] - 2026-03-02

- Alias matching query
