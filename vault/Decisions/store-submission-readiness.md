# Decision — app.json/eas.json config for store submission readiness, and what's deliberately left for the user

**Date:** 2026-07-27
**Status:** accepted

## Context
An audit (prompted by the user asking whether the automated test suite covers what's needed for App Store/Play Store submission) found that CI (`.github/workflows/ci.yml`) only ever runs Jest + `tsc --noEmit` + Playwright against the **web** build — there is no native iOS/Android build, simulator, or device step anywhere in the pipeline. That's expected and fine (automated tests validate logic, not store compliance), but it also surfaced that the project was missing basic config needed to even *attempt* a native build or store submission: no Android `package`/`versionCode`, no iOS `buildNumber`, no `eas.json`, no iOS privacy manifest, and no privacy policy or store listing metadata anywhere in the repo.

The app is confirmed fully offline (no network calls, no analytics, no backend — see `vault/Architecture/APIs.md`), so none of this is remediating a real compliance risk; it's filling in config/metadata that simply didn't exist yet.

## Decision

### `app.json`
- Added `android.package: "com.imadelia.chronobudget"` (mirrors the existing iOS `bundleIdentifier`) and `android.versionCode: 1`.
- Added `ios.buildNumber: "1"`.
- Added `ios.privacyManifests` declaring exactly two "required reason" API categories: `NSPrivacyAccessedAPICategoryFileTimestamp` (reason `C617.1`) and `NSPrivacyAccessedAPICategoryDiskSpace` (reason `E174.1`). These are tied to `expo-file-system`'s actual usage for CSV export/import (`lib/csv.ts`, bulk import in `db/database.ts`) — file stat/read/write and disk-space checks. Deliberately did **not** declare `NSPrivacyAccessedAPICategoryUserDefaults`, since nothing in this app's own code touches it directly; over-declaring unused reasons is itself a review risk, not just noise.

### `eas.json` (new)
Standard `development`/`preview`/`production` build profiles, plus a `submit.production` skeleton. `ios` submit config is deliberately left empty (`eas submit` prompts for Apple ID/ASC App ID/team ID interactively on first run and caches them — no placeholder credentials were fabricated). `android` submit config points `serviceAccountKeyPath` at `./google-service-account.json`, which is now gitignored (added to `.gitignore` alongside the existing `*.jks`/`*.p8`/`*.p12`/`*.key` secret patterns) since it doesn't exist yet and must never be committed.

### Privacy policy + store metadata (new files)
- `docs/privacy-policy.html` — plain static page, intended to be served via GitHub Pages from `/docs` on `main` (zero extra infra). Content is accurate to the current code: no accounts, no data collection, no network calls, local-only storage, CSV export/import as the only file-system touchpoint. Has a `TODO: add contact email` placeholder the user needs to fill in before submission.
- `store-assets/metadata/en-US/{short_description,full_description,keywords,release_notes}.txt` — draft listing copy in the standard fastlane/EAS-submit layout, based on the actual current feature set (`vault/Projects/ChronoBudget.md`).
- `store-assets/README.md` documents what's explicitly **not** included and can't be automated: screenshots (need a real device/simulator capture), and the real contact email.

## What this does *not* do
This makes the project *config-ready* to build and submit — it does not and cannot produce or submit an actual binary. That requires the user's own Apple Developer Program and Google Play Console accounts, real credentials, and running `eas build`/`eas submit` themselves. Also unresolved: Apple's App Store Connect binary processing may flag additional "required reason" APIs pulled in transitively by other dependencies after the first TestFlight upload — normal and expected, and only discoverable by actually uploading a build, which is outside what this session can do.

## Related notes
- [[account-aware-budgeting]]
- [[savings-goals-schema]]
- [[APIs]] — confirms the "no backend, no network calls" claim this decision relies on
