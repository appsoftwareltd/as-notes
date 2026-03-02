# Changelog

All notable changes to AS Notes will be documented here.

## [1.0.5] — 2026-03-02

### Added

- Backlinks panel
- TODO panel

## [1.0.4] — 2026-03-02

### Added

- Added a LEFT JOIN aliases to the query, excluding link targets whose page_filename matches a known alias_filename (case-insensitive). (When a wikilink like [[Plants]] pointed to an alias (where Plants.md doesn't exist as a page but "Plants" is an alias for Plant.md), the query incorrectly returned it as a forward reference with the "not yet created" label)
