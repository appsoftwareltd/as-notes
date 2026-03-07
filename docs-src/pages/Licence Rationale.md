# Licence Rationale

## Why Open Source?

AS Notes is source-available because:

- **Trust** - users invest heavily in their notes. Knowing the source is readable means they can verify their data stays private, and that their notes will always be accessible regardless of what happens to the publisher.
- **VS Code extensions are decompilable anyway** - closed-source provides no real protection; keeping the source readable is simply honest.
- **Commercial value comes from corporates** - individuals using the extension for personal knowledge management are not the target revenue source. Organisations wanting a support contract or clean compliance licence are.

## Why Elastic Licence 2.0 (ELv2)?

Several source-available licences were evaluated:

| Licence | Prohibits competing products | Prohibits all commercial use | Auto-converts to OSS |
|---|---|---|---|
| **ELv2** | ✅ | ❌ | ❌ |
| PolyForm Shield | ✅ | ❌ | ❌ |
| PolyForm Noncommercial | ❌ | ✅ | ❌ |
| Commons Clause + MIT | ❌ | ✅ (selling) | ❌ |
| BUSL 1.1 | ❌ | ✅ (configurable) | ✅ |

**ELv2 was chosen because:**

- Prohibits providing the software as a **competing managed service or product** - exactly the scenario we want to prevent.
- Does **not** prohibit general commercial use - corporates can use AS Notes internally with a Pro licence without legal friction.
- Battle-tested: used by Elastic, HashiCorp and others. Legal interpretation is well-established.
- Single short file, no CLA required.
- Does not prohibit personal, non-competing commercial use (e.g. using AS Notes as your company's internal notes tool).

PolyForm Shield is functionally similar; ELv2 was preferred for its wider adoption and clearer legal track record.

## Publisher ID Check

In addition to the licence, a lightweight runtime check guards Pro features against unofficial forks:

```typescript
const OFFICIAL_EXTENSION_ID = 'appsoftwareltd.as-notes';
isOfficialBuild = context.extension.id === OFFICIAL_EXTENSION_ID;
```

`isProLicenced()` returns `true` only when **both** `isOfficialBuild` and a valid licence key are present. If someone forks and republishes under a different publisher name, Pro features silently do not activate.

This is deliberately a **deterrent, not a lock** - The legal protection is the licence; the ID check is friction on misuse and a clear indication to the user that the version violates licence terms.

Local debugging (F5 Extension Development Host) is unaffected - the extension loads with its real ID from `package.json`.
