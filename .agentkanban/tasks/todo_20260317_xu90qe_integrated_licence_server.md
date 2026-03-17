# Iteration 1

- [x] Rewrite `LicenceService.ts` — new ASNO format validation, `LicenceProduct` type, `LicenceState` interface, `hasProEditorAccess()` / `hasProAiSyncAccess()` helpers
- [x] Rewrite `LicenceService.test.ts` — tests for ASNO format validation and helper functions
- [x] Rewrite `LicenceActivationService.ts` — real HTTP calls to `/activate` and `/validate`, JWT decoding, `lastValidated` persistence, grace period, retry with backoff, error handling, env var base URL
- [x] Create `LicenceActivationService.test.ts` — tests for activation, validation, token handling, grace period, error handling (mocked HTTP)
- [x] Update `extension.ts` — replace imports, `licenceState` variable, remove `isProLicenced()`, add `hasProEditor()` / `hasProAiSync()`, update activation/config-change handlers, add periodic validation timer, update status bar
- [x] Update all `isProLicenced()` call sites in `extension.ts` (20 sites) → `hasProEditor()`
- [x] Update `SlashCommandProvider.ts` — rename callback from `isProLicenced` to `hasProEditor`
- [x] Update `package.json` — licence key setting description to reference ASNO format
- [x] Run tests, fix compilation errors, verify green
