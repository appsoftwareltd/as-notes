---
title: Integrated licence server
lane: doing
created: 2026-03-17T08:45:56.939Z
updated: 2026-03-17T08:47:12.797Z
priority: critical
sortOrder: 2
slug: integrated_licence_server
worktree:
  branch: agentkanban/20260317_xu90qe_integrated_licence_server
  path: c:\Users\Gareth\src\as-notes-worktrees\20260317_xu90qe_integrated_licence_server
  created: 2026-03-17T08:46:01.444Z
---

## Conversation

### user

We're going to integrate this extension with the AS Notes licence server.

The specification document for how to integrate with the server is here `C:\Users\Gareth\src\as-notes-corporate-worktrees\20260316_1oua0u_licence_flow_imlementation\docs\LICENCE_SERVER_INTEGRATION.md`

Additional context for implementation:

A single licence key from the server is to be pasted into settings in this extension to activate "Pro Editor" and "Pro AI and Sync" licence types. Depending on the licence type (or use better terminoogy from the spec), this extension will record and allow features as allowed by the licence.

Currently we have detection of a Pro licence based on simple temporary placeholder licence key logic. 

We are now moving to licence keys that are activated and validated as per the spec, and gating features behind two licence levels for each of the licence types. All of the currently gated features can be considered as falling within the "Pro Editor" licence type - we have no features yet that fall under "Pro AI and Sync" but the mechanism should be there to gate features that would. So well have a mechanism that works something like (pseudo code):

```
licenceType = GetLicenceType()

// If feature requires pro editor

if (licenceType === pro_editor || licenceType === pro_ai_sync)
{
    // Allow feature use
}

// If feature requires pro AI and sync

if (licenceType === pro_ai_sync)
{
    // Allow feature use
}

```

A pro AI and sync licence is a subscription licence would allow access to all features under the pro editor licence which is a single lifetime purchase licence (for context)

### agent

Confirmed I am working in file: `task_20260317_xu90qe_integrated_licence_server.md`. I have read README.md, AGENTS.md, INSTRUCTION.md, the task file, the licence server integration spec, and all relevant source files.

## Plan — Integrated Licence Server

### Current State

- **`LicenceService.ts`** — pure-logic module with a placeholder 24-char format validation. Exports `LicenceStatus = 'valid' | 'invalid' | 'not-entered'`, `validateLicenceKey()`, and `isValidStatus()`.
- **`LicenceActivationService.ts`** — stub server integration that stores a fake `stub:<base64>` token in VS Code `SecretStorage`. Contains `_callServer()`, `_buildToken()`, `_verifyToken()` stubs.
- **`extension.ts`** — module-level `licenceStatus` variable, a single `isProLicenced()` gate, and 20+ call sites that all check the same binary gate (pro or not). Licence key comes from `as-notes.licenceKey` setting (scope: machine).
- **`package.json`** — setting description references "24-character licence key".
- **Tests** — `LicenceService.test.ts` covers the placeholder validation rules.

### Target State

Replace the placeholder system with real licence server integration per the spec at `LICENCE_SERVER_INTEGRATION.md`, introducing two product tiers (`pro_editor`, `pro_ai_sync`) where `pro_ai_sync` is a superset of `pro_editor`.

### Key Design Decisions

**1. Licence key format validation (local)**

Replace the 24-char placeholder with the real `ASNO-XXXX-XXXX-XXXX-XXXX` format check (prefix + 4 segments of 4 hex chars). This is a fast pre-flight check before hitting the server — rejects obviously invalid input immediately.

**2. Product-aware `LicenceStatus` type**

Expand the type to encode the product tier:

```typescript
export type LicenceProduct = 'pro_editor' | 'pro_ai_sync';
export type LicenceStatus = 'not-entered' | 'invalid' | 'valid';

export interface LicenceState {
    status: LicenceStatus;
    product: LicenceProduct | null; // null when status !== 'valid'
}
```

This keeps the existing `LicenceStatus` type compatible for simple checks while adding product awareness via the new `LicenceState` interface.

**3. Tiered feature gating**

Replace single `isProLicenced()` with two gates:

```typescript
export function hasProEditor(): boolean {
    // pro_editor OR pro_ai_sync grants editor features
    return isOfficialBuild && licenceState.status === 'valid'
        && (licenceState.product === 'pro_editor' || licenceState.product === 'pro_ai_sync');
}

export function hasProAiSync(): boolean {
    // Only pro_ai_sync grants AI & sync features
    return isOfficialBuild && licenceState.status === 'valid'
        && licenceState.product === 'pro_ai_sync';
}
```

All 20+ existing call sites switch from `isProLicenced()` to `hasProEditor()` (since all currently gated features are editor-tier). `hasProAiSync()` is available for future AI/sync feature gates.

**4. Real server integration in `LicenceActivationService.ts`**

- **`activateWithServer()`** — calls `POST /api/v1/licence/activate` with `licenceKey`, `deviceId` (from `vscode.env.machineId`), and `deviceInfo`. Returns `LicenceState` (status + product decoded from the response / stored token).
- **Token storage** — store the real JWT in `SecretStorage` (key: `as-notes.activationToken`). Also store `lastValidated` timestamp and the licence key itself in `SecretStorage` for grace period calculation.
- **Token parsing** — decode the JWT payload (base64, no signature verification per spec — tokens are opaque, verification is server-side) to extract the `product` claim for tier determination.
- **`_verifyToken()`** — replaced: check the stored JWT hasn't expired by decoding its `exp` claim. If expired, re-activate.

**5. Periodic background validation**

- On VS Code startup, after initial activation, schedule a `setInterval` (24 hours) calling `POST /api/v1/licence/validate`.
- If validation returns `revoked: true`, clear the token, set `licenceState` to `{ status: 'invalid', product: null }`, update the status bar, and show a message.
- If the server is unreachable and the token is expired, apply a 7-day grace period from `lastValidated`. If exceeded, fall back to free tier.

**6. Grace period handling**

Store `lastValidated` timestamp in `SecretStorage`. When the server is unreachable:
- If `lastValidated` is within 7 days: maintain current licence state
- If `lastValidated` is older than 7 days: fall back to free tier

**7. Error handling per spec**

| Status | Action |
|---|---|
| 200 | Process normally |
| 400 | Log error (extension bug) |
| 403 | Clear token, show "licence revoked" message |
| 404 | Clear token, prompt to re-enter key |
| 5xx | Retry up to 3× with exponential backoff (1s, 4s, 16s), then fall back to cached token |

**8. Base URL configuration**

Add an internal (non-user-facing) constant for the base URL. Default to production (`https://www.asnotes.io`). Allow override via a hidden setting `as-notes.licenceServerUrl` for development use only.

[comment: Add an environment variable for the override also that we can set like we set the debug flag in launch settings `AS_NOTES_LICENCE_SERVER_URL`. No setting will be available to the user]

**9. Package.json updates**

- Update `as-notes.licenceKey` description to reference the `ASNO-XXXX-XXXX-XXXX-XXXX` format
- Add hidden `as-notes.licenceServerUrl` setting (default: `https://www.asnotes.io`)

**10. Test updates**

- Rewrite `LicenceService.test.ts` to test the new `ASNO-` format validation
- Add tests for `LicenceState` construction, `hasProEditor()`, `hasProAiSync()` logic
- Add tests for `LicenceActivationService.ts` covering HTTP interaction (mocked), token storage, grace period, error handling

### Files to Change

| File | Change |
|---|---|
| `LicenceService.ts` | New format validation (`ASNO-` prefix + hex segments), `LicenceProduct` type, `LicenceState` interface, `hasProEditorAccess()` / `hasProAiSyncAccess()` helpers |
| `LicenceActivationService.ts` | Real HTTP calls to `/activate` and `/validate`, JWT decoding, `lastValidated` persistence, grace period logic, retry with backoff, error handling |
| `extension.ts` | Replace `licenceStatus` with `licenceState`, replace `isProLicenced()` with `hasProEditor()` / `hasProAiSync()`, update all 20+ call sites, add periodic validation timer |
| `SlashCommandProvider.ts` | Update `isProLicenced` callback to `hasProEditor` |
| `package.json` | Update setting descriptions, add hidden `licenceServerUrl` setting |
| `LicenceService.test.ts` | Rewrite tests for new validation format and helpers |
| New: `LicenceActivationService.test.ts` | Tests for HTTP integration, token handling, grace period |

### Questions / Options for Your Input

1. **Development override**: Is a hidden `as-notes.licenceServerUrl` setting acceptable for dev/test, or would you prefer an environment variable or compile-time flag?

[comment: Environment variable]

2. **JWT decoding**: The spec says tokens are opaque and not verifiable offline (HS256 server secret). I plan to decode the payload (not verify signature) purely to extract the `product` claim and `exp` for local tier determination and expiry checks. The server remains the authority via `/validate`. Is that acceptable?

[comment: Yes]

3. **Message wording**: When a licence is revoked or invalid, what message tone do you prefer? I'll draft something neutral like "Your AS Notes licence is no longer valid. Pro features have been disabled. Visit https://www.asnotes.io/billing to manage your licence."

[comment: Use: "Your AS Notes licence is not valid or is expired (Pro features have been disabled). Visit https://www.asnotes.io/billing to manage your licence."]

4. **`isProLicenced()` deprecation**: Should I remove `isProLicenced()` entirely and replace all call sites, or keep it as an alias for `hasProEditor()` for backward compatibility? (I'd recommend removing it cleanly since this is all internal.)

[comment: Remove cleanly]

### user

Comments inline

### agent

Confirmed I am working in file: `task_20260317_xu90qe_integrated_licence_server.md`. All four answers received — updating the plan accordingly.

**Plan updates from your inline comments:**

1. **Base URL override** — Environment variable `AS_NOTES_LICENCE_SERVER_URL` only (no user-facing setting). Default remains `https://www.asnotes.io`. Set via launch config for dev, just like the debug flag.

2. **JWT decoding** — Confirmed. Decode payload for `product` + `exp` claims without signature verification. Server remains authority via `/validate`.

3. **Revocation message** — Using: *"Your AS Notes licence is not valid or is expired (Pro features have been disabled). Visit https://www.asnotes.io/billing to manage your licence."*

4. **`isProLicenced()` removal** — Clean removal. All call sites replaced with `hasProEditor()` / `hasProAiSync()` as appropriate.

**Revised item 8 (Base URL):**

Hardcode production URL `https://www.asnotes.io` as default. Check `process.env.AS_NOTES_LICENCE_SERVER_URL` at startup for override. No `package.json` setting — the `as-notes.licenceServerUrl` hidden setting is dropped from the plan.

**Revised item 9 (package.json):**

Only update the `as-notes.licenceKey` description to reference the `ASNO-XXXX-XXXX-XXXX-XXXX` format. No new settings added.

Plan is now finalised. Ready for `todo` when you are.

### user

todo implement

### agent

Confirmed I am working in file: `task_20260317_xu90qe_integrated_licence_server.md`.

## Implementation Complete

All changes implemented and tests passing (706/706). Summary of what was done:

### Files Changed

**`LicenceService.ts`** — Complete rewrite:
- New `ASNO-XXXX-XXXX-XXXX-XXXX` format validation via regex (case-insensitive hex)
- New types: `LicenceProduct` (`'pro_editor' | 'pro_ai_sync'`), `LicenceState` interface (`status` + `product`)
- Tier helpers: `hasProEditorAccess()` (pro_editor OR pro_ai_sync), `hasProAiSyncAccess()` (pro_ai_sync only)
- Factory functions: `defaultLicenceState()`, `invalidLicenceState()`
- Removed: old 24-char placeholder validation, `isValidStatus()`

**`LicenceActivationService.ts`** — Complete rewrite:
- Real HTTP calls to `POST /api/v1/licence/activate` and `POST /api/v1/licence/validate`
- JWT payload decoding (no signature verification) to extract `product` and `exp` claims
- Persistent storage: JWT token, licence key, `lastValidated` timestamp, and `LicenceState` in SecretStorage
- 7-day grace period when server is unreachable
- Retry with exponential backoff (1s, 4s, 16s) for 5xx and network errors
- Error handling per spec (403 → revoked, 404 → not found, 400 → bug)
- Base URL from `process.env.AS_NOTES_LICENCE_SERVER_URL` with `https://www.asnotes.io` default
- Device info sent: `vscode.env.machineId` + VS Code version + OS platform

**`extension.ts`** — Updated:
- Imports: replaced `isValidStatus` / `LicenceStatus` with `hasProEditorAccess` / `LicenceState` etc.
- Module state: `licenceStatus` → `licenceState: LicenceState`
- Gate functions: removed `isProLicenced()`, added `hasProEditor()` and `hasProAiSync()`
- All 20 call sites updated from `isProLicenced()` → `hasProEditor()`
- Activation/config-change handlers: now receive and store `LicenceState`
- Periodic validation: 24-hour `setInterval` calling `validateWithServer()`, detects revocation
- Deactivation: cleans up the validation interval
- Warning message updated to agreed wording

**`SlashCommandProvider.ts`** — Updated:
- Renamed `_isProLicenced` callback to `_hasProEditor`

**`package.json`** — Updated:
- `as-notes.licenceKey` description now references `ASNO-XXXX-XXXX-XXXX-XXXX` format

### New Files

**`LicenceActivationService.test.ts`** — 13 tests covering:
- Empty/invalid key handling
- Cached token reuse (matching key, not expired)
- Server activation (success, 403, 404)
- Grace period (within 7 days → maintain state, exceeded → fall back)
- Periodic validation (success, revocation, server unreachable)

### Test Results

All 706 tests pass across 17 test files. No new TypeScript compilation errors (6 pre-existing `as-notes-common` ESM import warnings are unchanged).


### user

We need a command "AS Notes: Enter Licence Key" that will set the licence key field so that the user doesn't need to find the settings in the settings UI

Can the notification show the URLs as links that the user can click to purchases a licence

How would I get instructions into the "Details" section in the attached screenshot when the user looks up the extension in VS Code?


### user

When the user enters a licence key and it is successfully validated, show a confirmation notification (with a green tick or some green success status if possible) 


### user

If the user clears their extension key, show the same notification as when invalid


### user

If the extension cannot reach the licence server it should show a notification, prompting the user to remove and re-add the licence key.


### user

This is not working well.

 If the user clears the licence key, don't try to validate it against the server (there is no licence key)

 If they do enter a licence key, we want to show the notification at the point where they have change the key.

 Confirm that normally licence key checks are periodic, not on start up

 
 ### user
 
 When the server is not available - it takes a long time for the server not reachable notification to show, presumably because of time out Can we show a loading spinner in the status bar next to the as notes pro indicator

 When the licence field is cleared, by command or settings, we do not see the invalid licence key notification as i specified earlier

 
 ### user
 
 When I emptied the key it still showed the validating notfication - it should not be calling the server when empty

 When it failed, it showed the key invalid notification - it should have shown the notification stating it could not contact the server
  