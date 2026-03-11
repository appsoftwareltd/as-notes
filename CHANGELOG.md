# Changelog

All notable changes to AS Notes will be documented here.

## Pending Release

- Slash commands `/` for task #hashtags

### Added

## [2.1.0] - 2026-03-010

### Added

- Add outliner mode

## [2.0.1] - 2026-03-010

### Added

- Fix sidebar display / readiness bug

## [2.0.0] - 2026-03-010

### Added

- Updated task view with hash tags for priority, due date, waiting

## [1.0.13] - 2026-03-06

- Documentation: LICENCE

### Added

## [1.0.12] - 2026-03-06

### Added

- Feature: Backlink pane improved layout and options for compact / wrapped context, flat ordering or grouping by wiki link chain.

## [1.0.11] - 2026-03-06

### Added

- Feature: Backlinks now based on mention and on indentation relationships - "outliner" style.

## [1.0.10] - 2026-03-05

### Added

- Bug Fix: Resolution of OOM on rebuild index for large (20k) `.md` file knowledge bases.

## [1.0.9] - 2026-03-04

### Added

- Feature: Added image drag drop / copy paste path handling and hover preview for images

## [1.0.8] - 2026-03-03

### Added

- Feature: Added encryption (`.enc.md`) files (Pro feature)

## [1.0.7] - 2026-03-02

### Added

- Documentation: Documentation / README

## [1.0.6] - 2026-03-02

### Added

- Feature: Daily journal

## [1.0.5] - 2026-03-02

### Added

- Feature: Backlinks panel
- Feature: Tasks panel

## [1.0.4] - 2026-03-02

### Added

- Added a LEFT JOIN aliases to the query, excluding link targets whose page_filename matches a known alias_filename (case-insensitive). (When a wikilink like [[Plants]] pointed to an alias (where Plants.md doesn't exist as a page but "Plants" is an alias for Plant.md), the query incorrectly returned it as a forward reference with the "not yet created" label)
