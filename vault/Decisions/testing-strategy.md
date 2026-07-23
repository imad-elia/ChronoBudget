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

## Known gaps
None currently open. If new gaps surface (e.g. native-only behavior Playwright's web target can't exercise), log them here rather than silently letting coverage drift.

## How to run
- Unit/component: `npm test` (or `npm run test:watch`). Runs headless, no simulator/emulator required.
- E2E: `npm run test:e2e` (Playwright, Chromium, drives the Expo web build). Requires `npx playwright install --with-deps chromium` once per machine.
- CI runs both automatically on push/PR to `main` (`test` and `e2e` jobs), plus `tsc --noEmit`.

## Related notes
- [[ChronoBudget]]
- [[2026-07-23-session]]
