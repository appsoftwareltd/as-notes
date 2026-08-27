# Handoff: KeePass Password Safe (AS Notes Pro)

**Date:** 2026-07-09
**Repo:** `as-notes` (branch `main`, working tree clean, all work committed)
**Status:** Feature complete at unit/build level. **Never exercised interactively (no F5 run).**

---

## What this was

Designed and built a **KeePass password safe** feature for the AS Notes VS Code extension: open, edit and create standard **KDBX 4** (`.kdbx`) files, interoperable with KeePassXC. Gated as a **Pro** feature (like encrypted notes).

The design was arrived at through a `/grill-with-docs` session. **Do not re-litigate the settled decisions** - read the ADRs first.

## Read these first (do not duplicate here)

| Artifact | Path | What it holds |
|---|---|---|
| ADR-0003 | `docs/adr/0003-password-safe-uses-kdbx.md` | Why KDBX/`kdbxweb` over reusing `EncryptionService`; no key/passphrase reuse |
| ADR-0004 | `docs/adr/0004-safe-paths-in-workspacestate.md` | Why safe + key-file paths live in `workspaceState`, safe file outside the repo |
| ADR-0005 | `docs/adr/0005-safe-webview-auto-escaping-render.md` | Why the safe webview uses an auto-escaping ``html`` `` helper + guard test |
| Glossary | `CONTEXT.md` (§ Password safe) | Canonical terms: Safe, Entry, Group, Master password, Key file, Composite key, Unlock/Lock |
| User docs | `docs-src/docs/KeePass Password Safe.md` | Full feature + security documentation |
| Blog post | `docs-src/blog/AS Notes - A KeePass Password Safe in VS Code.md` | Announcement |

> ⚠️ **`docs/adr/` and `CONTEXT.md` are gitignored** (repo `.gitignore`, "Architecture docs"). They exist on disk but are **not in version control**. If you clone fresh, they will be missing. This is intentional repo policy, not an oversight.

## Code map

Extension host (crypto never touches the webview):

- `vs-code-extension/src/SafeService.ts` - crypto/data boundary. `kdbxweb` + `hash-wasm` Argon2id wiring, open/create/save, composite key, the **Draft** model (`createDraft`/`draftToView`/`applyDraft`), TOTP (RFC 6238, dual-convention read + Bitwarden-format normalisation), group listing. **No `vscode` import** (mirrors `EncryptionService.ts`).
- `vs-code-extension/src/SafeSessionService.ts` - owns the unlocked db, paths in `workspaceState`, idle auto-lock, dirty-gated saves, first-open backup confirmation, `onBeforeSaveOnLock` hook.
- `vs-code-extension/src/SafeFeature.ts` - registration: commands, Pro gate, context keys, tree view, create-safe wizard, shutdown flush.
- `vs-code-extension/src/SafeTreeProvider.ts` - sidebar tree + drag/drop controller.
- `vs-code-extension/src/SafeEditorPanel.ts` - buffered editor panel (host-side Draft, commit on Save, close prompt).
- `vs-code-extension/src/SafeAttachmentService.ts` - attachment temp-file hardening.
- `vs-code-extension/src/safeClipboard.ts`, `src/safeIcons.ts`
- Webview: `src/webview/safe.ts`, `safe.css`, `dom.ts` (the escaping primitive)

Tests: `src/test/SafeService.test.ts`, `src/test/safe-webview-no-innerhtml.test.ts` (ADR-0005 guard).

## Hard invariants - do not break these

1. **Preservation.** Never rebuild an entry from a known field set. Edit the parsed `kdbxweb` entry (via `Draft`/`applyDraft`) so unmodelled data (TOTP, attachments, history, custom fields) round-trips. Covered by a test.
2. **Webview escaping.** All safe-webview rendering goes through the auto-escaping ``html`` `` tag + `setHtml` in `dom.ts`. Bare `innerHTML` anywhere else in `src/webview/safe*.ts` **fails the build** via the guard test. Entry fields are untrusted input.
3. **Attachments: extract only, never render** in the webview (an SVG/HTML attachment would be XSS with the safe in memory).
4. **Crypto in the extension host only.** The webview receives one entry's view model, never the whole decrypted db.
5. **On lock:** wipe the db, dispose editor panels, wipe attachment temp files.
6. **The editor is a buffered form.** Edits mutate a host-side `Draft`; nothing reaches the entry or disk until Save. One history version per save (not per keystroke).

## Build / verify

```bash
cd vs-code-extension
node build.mjs          # esbuild; also copies codicon assets to dist/webview
npx vitest run          # 1041 tests, all passing
```

**Trap:** `npx tsc --noEmit` (the `lint` script) has **pre-existing repo-wide errors** unrelated to this feature - `TS1479` ESM/CJS on `as-notes-common`, `indexScanner` possibly-undefined in `extension.ts`, `TS4104` `ExplorerRenameFile`. These predate the work (verified via `git stash`). The real build is esbuild. **Filter tsc output to the safe files** before concluding you broke something:

```bash
npx tsc --noEmit 2>&1 | grep -iE "src/(Safe|safeClipboard|safeIcons|webview/safe|webview/dom)"
```

## Known limitations / accepted trade-offs

- **Not interactively tested.** Everything is typechecked, bundled and unit-tested; no UI flow has been driven in an Extension Development Host. **An F5 click-through is the highest-value next step.**
- **Tab-close warning is after-the-fact.** A `WebviewPanel` close cannot be cancelled, so the Save/Discard prompt appears once the tab has gone (the draft is held host-side, so Save still works).
- **`autoSaveOnLock: false` + idle lock discards unsaved drafts** by design (idle = absent user, cannot prompt).
- **No KDBX merge.** Concurrent multi-device edits produce a file conflict the user must reconcile in KeePassXC. `kdbxweb` exposes `db.merge()` if this is ever wanted.
- **Icons are codicon approximations** of the 69 standard KeePass icons (no real KeePass icon graphics, no custom per-entry icons).
- **Sidebar drag cursor cannot be customised** - VS Code's `TreeDragAndDropController` exposes no `dropEffect`/cursor hook.
- **Toolbar icons show on hover** by default; that's the global `workbench.view.alwaysShowHeaderActions` setting, deliberately not changed on the user's behalf.

## Working preferences learned this session

- **No em dashes.** Ever. Use a spaced hyphen ` - `. All safe files and the CHANGELOG entry were swept.
- **British spelling**; user-facing copy in Gareth's voice (direct, honest caveats up front, no gush).
- **Icons: codicons**, not heroicons - the extension already bundles `@vscode/codicons` and uses them for the tree, Save button and icon picker.
- Command titles read `AS Notes: KeePass Safe: <Action>` (no em dash separators).
- The user reports bugs from real testing and expects them fixed **and** the root cause explained. Be honest when something is a VS Code API limitation rather than inventing a workaround.

## Suggested next steps

1. **F5 interactive smoke test** (highest value): create safe → add entry → set authenticator key → attachment open/save → drag entry between groups → filter → lock/unlock → close tab mid-edit (Save/Discard prompt).
2. Consider a **security review** of the feature before shipping (it holds credentials).
3. Optional: entry-level **KDBX merge** for concurrent edits; real KeePass icon assets; a docs/troubleshooting note about `workbench.view.alwaysShowHeaderActions`.

## Suggested skills

Invoke these in the next session as appropriate:

- **`as-notes-agent-use`** - AS Notes conventions (settings, commands, workspace layout). Use before touching extension behaviour.
- **`verify`** - drive the change end-to-end rather than trusting tests. Directly addresses the biggest gap here (no interactive run).
- **`run`** - launching the extension host to see the feature working.
- **`security-review`** - this feature stores and handles user credentials; worth a pass before release.
- **`code-review`** - for correctness/simplification sweeps over the safe modules.
- **`write-like-gareth`** - mandatory for any user-facing copy: docs, blog, CHANGELOG, UI strings. Remember: no em dashes.
- **`grill-with-docs`** - if a *new* design decision arises (this feature's decisions were settled this way; new ones should be too, and captured as ADRs).
- **`writing-plans`** - before starting any large new sub-feature (e.g. KDBX merge).

## Sensitive information

None captured. No master passwords, key files, safe contents or licence keys appear in this document, the code, or the committed artifacts. Safe and key-file **paths** are stored per-machine in VS Code `workspaceState` and are never committed.
