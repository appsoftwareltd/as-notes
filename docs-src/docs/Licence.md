---
order: 100
---

# Licence

Elastic License 2.0

URL: <https://www.elastic.co/licensing/elastic-license>

## Acceptance

By using the software, you agree to all of the terms and conditions below.

## Copyright License

The licensor grants you a non-exclusive, royalty-free, worldwide,
non-sublicensable, non-transferable license to use, copy, distribute, make
available, and prepare derivative works of the software, in each case subject
to the limitations and conditions below.

## Limitations

You may not provide the software to third parties as a hosted or managed
service, where the service provides users with access to any substantial set of
the features or functionality of the software.

You may not move, change, disable, or circumvent the license key functionality
in the software, and you may not remove or obscure any functionality in the
software that is protected by the license key.

You may not alter, remove, or obscure any licensing, copyright, or other
notices of the licensor in the software. Any use of the licensor's trademarks
is subject to applicable law.

## Patents

The licensor grants you a license, under any patent claims the licensor can
license, or chooses to license, to make, have made, use, sell, offer for sale,
import and have imported the software, in each case subject to the limitations
and conditions in this license. This license does not cover any patent claims
that you cause to be infringed by modifications or additions to the software.
If you or your company make any written claim that the software infringes or
contributes to infringement of any patent, your patent license for the software
granted under these terms ends immediately. If your company makes such a claim,
your patent license ends immediately for work on behalf of your company.

## Notices

You must ensure that anyone who gets a copy of any part of the software from
you also gets a copy of these terms.

If you modify the software, you must include in any modified copies of the
software prominent notices stating that you have modified the software.

## No Other Rights

These terms do not imply any licenses other than those expressly granted in
these terms.

## Termination

If you use the software in violation of these terms, such use is not licensed,
and your licenses will automatically terminate. If the licensor provides you
with a notice of your violation, and you cease all violation of this license no
later than 30 days after you receive that notice, your licenses will
automatically be reinstated unless the licensor notifies you otherwise. If you
violate these terms after reinstatement, your licenses will automatically and
permanently terminate.

## No Liability

As far as the law allows, the software comes as is, without any warranty or
condition, and the licensor will not be liable to you for any damages arising
out of these terms or the use or nature of the software, under any kind of
legal claim.

## Definitions

The *licensor* is the entity offering these terms, and the *software* is the
software the licensor makes available under these terms, including any portion
of it.

*you* refers to the individual or entity agreeing to these terms.

*your company* is any legal entity, sole proprietorship, or other kind of
organization that you work for, plus all organizations that have control over,
are under the control of, or are under common control with that organization.
*control* means ownership of substantially all the assets of an entity, or the
power to direct its management and legal policies by vote, contract, or
otherwise. Control can be direct or indirect.

*your licenses* are all the licenses granted to you for the software under
these terms.

*use* includes copying, distributing, making available, modifying and, in each
case, also for the purposes of your internal business operations.

---

Copyright (c) 2026 App Software Ltd (<https://www.appsoftware.com>)

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
