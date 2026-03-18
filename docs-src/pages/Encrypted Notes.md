# Encrypted Notes

AS Notes Pro lets you store sensitive notes in encrypted markdown files that are protected with AES-256-GCM encryption. Encrypted files are excluded from the search index and never read as plain text by the extension.

## AS Notes Pro

Encrypted notes are a **Pro feature**. To unlock them:

1. Obtain a licence key from [asnotes.io](https://www.asnotes.io/pricing)
2. Enter your key using one of these methods:
   - Run **AS Notes: Enter Licence Key** from the Command Palette (`Ctrl+Shift+P`) — the quickest way
   - Or open VS Code Settings (`Ctrl+,`), search for `as-notes.licenceKey`, and paste your key there

When active, the status bar shows **AS Notes (Pro)**.

## How Encrypted Notes Work

Any file with the `.enc.md` extension is treated as an encrypted note. When encrypted, the file contains a single-line marker:

```
ASNOTES_ENC_V1:<base64url payload>
```

When decrypted, it opens as normal markdown — you can read and edit it like any other note.

Encrypted files are excluded from the backlink index (see [[Backlinks]]) and wikilink autocomplete while encrypted.

## Setting Up Encryption

Before you can create encrypted notes, save a passphrase:

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **AS Notes: Set Encryption Key**
3. Enter your passphrase

Your passphrase is stored securely in the OS keychain (VS Code `SecretStorage`). It is **never written to disk or to settings files**.

## Creating an Encrypted Note

- **AS Notes: Create Encrypted Note** — prompts for a filename and creates a new `.enc.md` file
- **AS Notes: Create Encrypted Journal Note** — creates today's journal entry as `.enc.md` in your journal folder

Write the note in the editor as normal markdown. The file is plain text until you encrypt it.

## Encrypting and Decrypting

| Command | What it does |
|---|---|
| **AS Notes: Encrypt Current Note** | Encrypts the active `.enc.md` file (reads current unsaved editor content) |
| **AS Notes: Encrypt All Notes** | Encrypts all plaintext `.enc.md` files in the workspace |
| **AS Notes: Decrypt Current Note** | Decrypts the active `.enc.md` file (reads from disk) |
| **AS Notes: Decrypt All Notes** | Decrypts all encrypted `.enc.md` files in the workspace |

> Always encrypt notes before closing VS Code or committing to version control.

## Clearing the Passphrase

Run **AS Notes: Clear Encryption Key** to remove the stored passphrase from the OS keychain.

## Encryption Details

| Property | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Nonce | 12-byte random, generated fresh per encryption |
| Key derivation | PBKDF2-SHA256, 100,000 iterations |
| Key input | Your passphrase |
| File format | `ASNOTES_ENC_V1:<base64url payload>` |

The random nonce means that encrypting the same content twice produces different ciphertext — this prevents pattern analysis from repeated saves.

## Git Pre-Commit Hook

AS Notes installs a Git pre-commit hook in your workspace that checks for any `.enc.md` files that are still in plaintext and blocks the commit with a warning. This helps prevent accidentally committing unencrypted sensitive notes.
