# Decision — jest-expo + RNTL for automated unit/component tests

**Date:** 2026-07-23
**Status:** accepted

## Context
The project had zero test infrastructure — no runner, no config, no CI — and regressions were only ever caught by manual verification in the preview browser. The user asked for an automated test suite that must pass before each build, scoped to unit tests + component tests run locally (no E2E/Detox/Maestro, no CI wiring yet).

## Decision
- **Runner/preset: `jest-expo`** (Expo's official Jest preset) over hand-rolling a config. It ships the correct RN/Expo transform and `transformIgnorePatterns` for SDK 56 out of the box. First attempt overrode `transformIgnorePatterns` with a hand-copied pattern from older Expo-Jest docs and it broke on `expo-modules-core` (`Cannot use import statement outside a module`) — removing the override and trusting the preset's own default fixed it immediately. Lesson: don't override jest-expo's transform config unless a specific package needs it.
- **Component tests: `@testing-library/react-native` v14.** Its `render()` is async in this version — tests must `await render(...)` before querying `screen`; omitting `await` fails with a cryptic `` `render` function has not been called `` because the internal `screen` singleton hasn't been bound yet.
- **`tsconfig.json`** needed `"types": ["jest"]` added so `npx tsc --noEmit` recognizes `describe`/`it`/`expect`/`jest.*` in test files (this project has no separate test tsconfig).
- **DB round-trip tests for `db/database.ts` — closed 2026-07-23.** `expo-sqlite`'s native module (`NativeDatabase`) is unavailable under jest-expo's default test environment, so `db/database.ts` is exercised against a manual Jest mock of the `expo-sqlite` module (`__mocks__/expo-sqlite.ts`, root-level per Jest's node_modules-mock convention) backed by **`sql.js`** — a pure-JS/WASM SQLite engine. `db/database.ts` itself is unmodified; the mock only implements the `openDatabaseAsync`/`execAsync`/`getAllAsync`/`runAsync`/`withTransactionAsync` surface it actually calls, wrapping a real `sql.js` `Database` so migrations, `CHECK` constraints, and upserts all run as genuine SQL.
  - **Pitfall:** sql.js ships both a WASM build (default) and a pure-JS `sql-asm.js` build. The WASM build throws an unhelpful empty `Error` from `new SQL.Database()` under Jest — a known incompatibility where Jest runs each test file in its own `vm` context and V8's `WebAssembly` instances don't behave correctly across realms. Switched the mock to `sql.js/dist/sql-asm.js` (plain JS, no WASM) and it worked immediately.
  - `getDb()` memoizes its connection promise at module scope, so `db/__tests__/database.test.ts` calls `jest.resetModules()` + re-requires `db/database` in `beforeEach` to get an isolated in-memory DB per test.
  - One test deliberately triggers a `CHECK constraint failed` (inserting a transaction with `amount <= 0`) to prove the mock runs real SQL rather than being a no-op stub.
- **Component tests for `ExpenseInput`, `EditTransactionModal`, `RecurringModal`, `KeywordsModal` — added 2026-07-23.** Same `jest.mock('../../db/database')` pattern as the store tests (these are component tests, not integration tests against real SQL — that's what the DB suite above covers).
  - **Pitfall:** RNTL v14's `fireEvent.*` (not just `render()`) is also async. Calling `fireEvent.changeText(...)` without `await` lets the subsequent `fireEvent.press(...)` fire before the state update from `changeText` has flushed, so the press reads stale form state — surfaced as a save going through with the *previous* field value instead of the new one, plus React "overlapping act()" console warnings. Every `fireEvent.*` call must be awaited.
  - Added a `testID` to a small number of icon-only buttons that had no other reliable query target (`EditTransactionModal`'s delete button, `RecurringModal`'s per-rule delete button, `KeywordsModal`'s per-keyword delete button) — a one-line, no-behavior-change addition, and arguably a pre-existing accessibility gap (icon-only touch targets had no accessible name either).
- **CI — added 2026-07-23.** `.github/workflows/ci.yml` runs `npm ci && npm test && npx tsc --noEmit` on push/PR to `main`, on `ubuntu-latest` (nothing in the suite needs a real mobile runtime — jest-expo's mocks and the sql.js DB mock are pure JS/WASM).
- **Migration idempotency — closed 2026-07-23.** `openAndMigrate()` is now exported from `db/database.ts` (no behavior change, matches the existing `getDb`/`initDb` export pattern). The `expo-sqlite` mock's `openDatabaseAsync` now memoizes its `sql.js` `Database` per name in a `Map`, so repeat opens of the same name (`'chronobudget.db'`) return the *same* underlying data — mirroring how real native SQLite reuses the same on-disk file across app relaunches (previously the mock handed out a fresh empty DB on every call, which made a true idempotency test impossible). New test in `db/__tests__/database.test.ts` inserts data, calls `openAndMigrate()` a second time against the same named DB, and asserts no error, `user_version` still 6, and the data survived.
- **E2E — closed 2026-07-23, web via Playwright.** User chose web E2E over native Detox/Maestro: it drives the existing Expo web build in a real headless Chromium browser and runs on `ubuntu-latest` in the same CI, with no simulator/emulator/macOS-runner infra (Detox/Maestro would need a dev build + running simulator/emulator, and iOS would need the macOS VM already used for native builds — out of proportion for an early-stage app, and this Windows machine has no local Android emulator set up either).
  - New `e2e/` directory (`onboarding.spec.ts`, `transactions.spec.ts`, `navigation.spec.ts`) + `e2e/helpers.ts` (`completeOnboarding()` — web's in-memory DB resets every page load, so each spec starts from fresh onboarding, no seeding/teardown needed). `playwright.config.ts` spins up `npx expo start --web --port 8081` via Playwright's `webServer` option (reuses an already-running dev server locally, spins a fresh one in CI).
  - **Pitfall:** Playwright's `getByText()` does substring matching by default, not exact — `getByText('Continue')` ambiguously matched both the actual Continue button and unrelated copy containing the word "Continue" ("Highlighted country applies if you tap Continue."). Fixed with `{ exact: true }` where needed.
  - **Pitfall:** Playwright has no RNTL-style `getByDisplayValue()`. Added a `testID="edit-amount-input"` to `EditTransactionModal`'s amount field (same minimal-testID pattern as the delete buttons) and asserted via `toHaveValue()` instead.
  - **Pitfall:** Jest's default `testMatch` also picked up `e2e/*.spec.ts` as Jest tests, and Playwright's `test()` throws when it detects it's running inside Jest. Fixed by adding `"testPathIgnorePatterns": ["/node_modules/", "<rootDir>/e2e/"]` to the `jest` config in `package.json`.
  - CI: new parallel `e2e` job in `.github/workflows/ci.yml` (`npm ci && npx playwright install --with-deps chromium && npm run test:e2e`).
- **CI hardening — 2026-07-23.** After both CI jobs were green, ran `npm audit`: 4 advisories. Fixed 3 (`brace-expansion`, `js-yaml`, `shell-quote` — all high-severity, all transitive build-tooling deps, all non-breaking via plain `npm audit fix`). Left the 4th (`uuid`, moderate) alone — fixing it requires `--force` and would downgrade `expo` to `46.0.21`, wrecking the whole SDK 56 setup; it's buried in Expo's own native-tooling chain (`xcode` → `@expo/config-plugins` → `@expo/cli` → `expo`), used at build/prebuild time, not exposed to runtime input. Also fixed a "Node.js 20 is deprecated" warning on every CI run: not the `node-version` input (already correctly `24`), but `actions/checkout@v4`/`actions/setup-node@v4`'s own runtime — bumped both to `v5`, which target Node 24 natively.

## What's covered
- `lib/detectCategory.ts` — `parseEntry`, `detectCategory` (seed vs. learned precedence, fallback), `learnKey`.
- `lib/recurrence.ts` — `advance()` for weekly/monthly/yearly, including month-length clamping and leap-year edge cases.
- `lib/format.ts` — currency/number/date formatting, including the `Intl`-throws fallback path (store-seeded via `useBudgetStore.setState`).
- `store/useBudgetStore.ts` — simple setters plus the async actions (`loadLearnedKeywords`, `loadRecurring`, `loadLocale`, `setCountry`), with `db/database.ts` mocked via `jest.mock`.
- `components/BentoCard.tsx` — amount formatting, balance/remaining line (positive/negative/absent), limit progress bar tiers and the OVER badge.
- `components/ExpenseInput.tsx` — fast-mode auto-detection preview, mode toggle persistence, amount validation, submit + keyword-learning behavior.
- `components/EditTransactionModal.tsx` — prefill (preset vs. custom subcategory), save, validation, delete.
- `components/RecurringModal.tsx` — list/empty state, add/edit/save (insert vs. update, `processRecurring` + reload + refresh sequencing), delete.
- `components/KeywordsModal.tsx` — list/empty state, add validation (word/subcategory), save, edit prefill, delete.
- `db/database.ts` — schema migration ladder (fresh DB → `user_version = 6`, all 6 tables), a real `CHECK` constraint violation, migration idempotency (re-running `openAndMigrate()` against already-migrated data), settings CRUD, limits/balances delete-on-`<=0` convention, transactions CRUD + totals, learned-keyword upsert, `processRecurring` catch-up posting (multiple missed occurrences via real `advance()`), `fetchMonthlyTotals` bucketing.
- `e2e/` (Playwright, web) — onboarding flow end-to-end, add/edit/delete a transaction from the dashboard, a transaction appearing in History, and Trends rendering with no console errors.

## Automation pass — 2026-08-29 (Tiers 1 + 2 of the manual test plan)

Written after the 190-case manual release plan, to automate the ~85 cases a Node/browser harness can genuinely stand in for. Native remains uncovered by choice — see "What is deliberately not covered" below.

### Two infrastructure defects found first

- **The transaction mock was a no-op.** `__mocks__/expo-sqlite.ts` implemented `withTransactionAsync` as `await callback()` — no BEGIN, no COMMIT, no ROLLBACK. Every assertion about money moving "atomically" was really asserting statement order. It now issues real SQL with ROLLBACK on throw. No app defect surfaced once it was fixed, but nothing had been proving the property either.
- **Jest was loading a stale mock.** jest-haste-map found two manual mocks named `expo-sqlite` — the project's and a copy under `.claude/worktrees/exciting-bose-b67c07/` — and resolved the worktree's. The DB suite had never run against the project's own mock. Fixed with `modulePathIgnorePatterns` rather than by deleting the worktree, which is the user's to remove. This also cleared the parallel-worker timeouts that made a plain `npx jest` run untrustworthy: the suite went from six failing suites in 24s to clean in 7s.

Lesson worth keeping: a duplicate module tree does not merely produce warnings, it silently changes which code is under test.

### What was added

- **Migration ladder** (`db/__tests__/migrations.test.ts`) — seeds a populated DB at each shipped version (v3–v7) from frozen DDL snapshots, migrates it forward with the real `openAndMigrate()`, and asserts v8 is reached with every table present and no row lost. Plus a guard that the destructive v1 block never runs against a DB already at v1+. The DDL snapshots are history and must never be "updated" to match the current schema — that would defeat the test. Mutation-checked: disabling the v8 migration turns them red.
- **Clock edges** — a two-year forward jump (bounded catch-up, 105 postings, terminates), a backward clock (posts nothing, `next_run` intact), a DST transition (postings stay exactly one week apart), and a late-night month boundary.
- **Validation, robustness and pinned behaviour** — every money writer rejects non-positives; running balances stay within a cent across 450 operations; long, tiny, large, injection-shaped and unicode values round-trip. CSV re-import is pinned as *doubling* the data, since no de-duplication exists and that is an open product question (HIST-10), not an accident.
- **CSV variants** — CRLF, trailing blank lines, accents, quoted commas, doubled quotes, and a UTF-8 BOM. The BOM case documents an incidental correctness: JS `trim()` treats U+FEFF as whitespace, so the header check is BOM-proof only as long as it keeps using `trim()`.
- **CI timezone matrix** — the `test` job now runs in UTC, Pacific/Auckland and America/Los_Angeles.
- **Static checks** (`scripts/`, via `npm run check`, its own CI job) — frozen `t()` at module scope, hardcoded UI strings, release config plus the offline claim, and WCAG contrast.
- **Playwright specs** — a French language sweep across every surface, onboarding navigation, fast input, accounts/goals, and a zero-external-request assertion.

### The timezone matrix, and why the variable is CB_TZ

The localtime bug fixed earlier the same day could not fail in CI, because `ubuntu-latest` runs in UTC where local and UTC bucketing are identical by definition.

Spiked before committing to the approach, and both assumptions held: sql.js resolves SQLite's `localtime` modifier through Emscripten, which derives its offset from JS `Date`, so setting the timezone in-process reaches the SQL layer. Verified by deliberate failure — with the `localtime` fix reverted, the UTC job still passes while Auckland fails 58 vs 100, exactly the misbucketed first-of-month transaction.

**The knob is `CB_TZ`, not `TZ`.** Under Git Bash on Windows, MSYS intercepts and mangles `TZ`, so neither `TZ=... npx jest` nor `export TZ=...` reaches node.exe — `process.env.TZ` arrives undefined. `CB_TZ` passes through untouched on every platform, and `jest.globalSetup.js` assigns `process.env.TZ` from it before Jest forks its workers, which inherit the environment.

Any new date-bucketing query needs the `'localtime'` modifier. This has been fixed twice now.

### Static checks — design notes

Written against the TypeScript compiler API and run by Node 24's native type stripping, so no new dependency was needed. `tsconfig.json` gained `"node"` types and `allowImportingTsExtensions` so the scripts are typechecked alongside the app.

- `check-frozen-i18n` flags `t()` whose nearest enclosing function is null. Deliberately narrow — that is the exact defect and nothing else. It found a seventh live instance on its first run: `RecurringModal`'s `FREQUENCY_LABEL` froze the Weekly/Monthly/Yearly labels in the rule list, with the correct keys-only pattern sitting three lines above it.
- `check-hardcoded-strings` flags untranslated copy inside `<Text>`. Six existing violations, all in Expo template scaffolding, are allowlisted with reasons so the check hard-fails on new violations in product code rather than warning about known ones forever — a warning in CI is a warning nobody reads.
- `check-release-config` asserts store identity, versioning and the iOS privacy manifest are present, pins the config-plugin list so a new native module cannot slip in unconsidered, and greps app source for networking primitives that would contradict the published "data never leaves your device" claim.
- `check-contrast` computes WCAG AA ratios for the theme's real text/surface pairs. Two known failures are baselined as visible warnings rather than silently fixed: `textMuted` is 2.51:1 on sheets and 2.25:1 on cards against a 4.5:1 floor. Raising it changes the low-glare look the palette exists for, so it needs a product decision. If either pair later passes, the check *fails* until the marker is removed, so it goes back under protection.

### What is deliberately not covered

A green CI run is not evidence of release readiness. Nothing here touches native WAL persistence across an app kill, upgrade-install data retention, real gestures, keyboard behaviour, share sheets, the document picker, the device matrix, real performance, or anything visual. Jest runs against `sql.js`; Playwright drives the **web** build with an in-memory database. Neither is the shipped native app.

Tier 3 (Maestro on an Android emulator) is the only route to the native gaps and was deliberately deferred. The manual plan stays the release gate — this narrows it to roughly 105 cases, concentrated in the platform, privacy and store-submission suites.

Two further scope calls, both recorded in the specs themselves: goal tagging and the delete-blocked path stay manual (GOAL-02 / GOAL-06), since driving the chip picker through the web renderer added selector churn without adding coverage over the SQL-level tests.

### Working notes for the next person

- Playwright has no `getByDisplayValue` — assert via `getByPlaceholder(...)` + `toHaveValue`, or add a testID.
- React Native Web keeps closed `Modal`s mounted, so the same text can match in several sheets at once. Scope with `.first()` / `.last()` or a role.
- `AccountsModal` and `GoalsModal` list views have no Done control; they close on a backdrop tap. `SettingsModal` and the form views do have one.
- `getByText` is substring *and* case-insensitive by default; `{ exact: true }` is usually what you want.
- The language sweep must not reload between surfaces — a reload masks exactly the bug it hunts.

## Known gaps
None currently open. If new gaps surface (e.g. native-only behavior Playwright's web target can't exercise), log them here rather than silently letting coverage drift.

## How to run
- Unit/component: `npm test` (or `npm run test:watch`). Runs headless, no simulator/emulator required.
- E2E: `npm run test:e2e` (Playwright, Chromium, drives the Expo web build). Requires `npx playwright install --with-deps chromium` once per machine.
- CI runs both automatically on push/PR to `main` (`test` and `e2e` jobs), plus `tsc --noEmit`.

## Related notes
- [[ChronoBudget]]
- [[2026-07-23-session]]
