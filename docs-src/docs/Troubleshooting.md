---
order: 13
---

# Troubleshooting

## "This file is not yet indexed"

The [[Backlinks]] panel shows this message when the current file is not in the AS Notes index.

**Common causes:**

**VS Code `files.exclude` or `search.exclude` settings**
AS Notes uses `vscode.workspace.findFiles()` to discover markdown files, which respects these VS Code settings. Files in excluded folders (e.g. `logseq/version-files/`) are silently omitted from the scan and never indexed. Check **Settings → Files: Exclude** and **Settings → Search: Exclude** if a file you expect to be indexed is missing.

**`.asnotesignore` patterns**
Files matching patterns in `.asnotesignore` at the workspace root are excluded from the index. See the **Excluding Files from the Index** section in [[Getting Started]] for details.

**Unsaved file**
New files that have never been saved to disk are not indexed until they are saved.

**Fix:** Check your workspace settings and `.asnotesignore`. If the file should be indexed, ensure it is not matched by any exclusion pattern, then run **AS Notes: Rebuild Index** from the Command Palette.

---

## Wikilinks Not Highlighted / Not Navigable

**Extension not initialised**
AS Notes only activates in workspaces that have a `.asnotes/` directory. Open the Command Palette and run **AS Notes: Initialise Workspace** if you haven't done so yet. See [[Getting Started]].

**File type not supported**
AS Notes activates for `.md` and `.markdown` files only.

---

## Index Appears Stale or Incorrect

Run **AS Notes: Rebuild Index** from the Command Palette. This drops and recreates the entire index from scratch.

---

## Extension in a Bad State (Persistent Errors)

If the extension behaves unexpectedly after a crash or upgrade:

1. Run **AS Notes: Clean Workspace** — this removes `.asnotes/` and resets all in-memory state. Your `.asnotesignore` file is preserved.
2. Run **AS Notes: Initialise Workspace** to start fresh.

---

## Encrypted Notes Cannot Be Decrypted

**Passphrase not set**
Run **AS Notes: Set Encryption Key** to enter your passphrase before decrypting. See [[Encrypted Notes]].

**Wrong passphrase**
The extension will report a decryption failure. Run **AS Notes: Set Encryption Key** again with the correct passphrase.

---

## Enabling Diagnostic Logging

If you need to investigate a problem in detail, enable logging:

1. Open VS Code Settings and set `as-notes.enableLogging` to `true`
2. Reload the VS Code window
3. Log files appear in `.asnotes/logs/` — rolling 10 MB files, max 5

You can also set the environment variable `AS_NOTES_DEBUG=1` and reload VS Code to activate logging without changing settings.

---

## Still Stuck?

Check the [GitHub issues page](https://github.com/appsoftwareltd/as-notes/issues) or open a new issue with:
- Your OS and VS Code version
- The extension version
- Any relevant log output from `.asnotes/logs/`
