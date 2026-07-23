# Decision — jest-expo + RNTL for automated unit/component tests

**Date:** 2026-07-23
**Status:** accepted

## Context
The project had zero test infrastructure — no runner, no config, no CI — and regressions were only ever caught by manual verification in the preview browser. The user asked for an automated test suite that must pass before each build, scoped to unit tests + component tests run locally (no E2E/Detox/Maestro, no CI wiring yet).

## Decision
- **Runner/preset: `jest-expo`** (Expo's official Jest preset) over hand-rolling a config. It ships the correct RN/Expo transform and `transformIgnorePatterns` for SDK 56 out of the box. First attempt overrode `transformIgnorePatterns` with a hand-copied pattern from older Expo-Jest docs and it broke on `expo-modules-core` (`Cannot use import statement outside a module`) — removing the override and trusting the preset's own default fixed it immediately. Lesson: don't override jest-expo's transform config unless a specific package needs it.
- **Component tests: `@testing-library/react-native` v14.** Its `render()` is async in this version — tests must `await render(...)` before querying `screen`; omitting `await` fails with a cryptic `` `render` function has not been called `` because the internal `screen` singleton hasn't been bound yet.
- **`tsconfig.json`** needed `"types": ["jest"]` added so `npx tsc --noEmit` recognizes `describe`/`it`/`expect`/`jest.*` in test files (this project has no separate test tsconfig).
- **No DB round-trip tests for `db/database.ts`.** Tried it: `expo-sqlite`'s native module (`NativeDatabase`) is unavailable under jest-expo's default (native) test environment — calling `getDb()` throws `TypeError: _ExpoSQLite.default.NativeDatabase is not a constructor`. Building a working in-memory SQLite mock is disproportionate infra for an early-stage app (CLAUDE.md: avoid premature complexity), so DB logic is untested for now — see Known gap below.
- **No CI wiring, no E2E.** Explicitly out of scope for this pass; suite runs locally via `npm test` before each build.

## What's covered
- `lib/detectCategory.ts` — `parseEntry`, `detectCategory` (seed vs. learned precedence, fallback), `learnKey`.
- `lib/recurrence.ts` — `advance()` for weekly/monthly/yearly, including month-length clamping and leap-year edge cases.
- `lib/format.ts` — currency/number/date formatting, including the `Intl`-throws fallback path (store-seeded via `useBudgetStore.setState`).
- `store/useBudgetStore.ts` — simple setters plus the async actions (`loadLearnedKeywords`, `loadRecurring`, `loadLocale`, `setCountry`), with `db/database.ts` mocked via `jest.mock`.
- `components/BentoCard.tsx` — amount formatting, balance/remaining line (positive/negative/absent), limit progress bar tiers and the OVER badge.

## Known gap
`db/database.ts` (schema migrations, CRUD, `processRecurring` catch-up logic) has no automated test coverage — it needs a real or well-mocked SQLite backend that wasn't feasible to stand up in this pass. If this becomes a pain point (e.g. a future migration regression), revisit with `expo-sqlite`'s own test utilities or a lightweight sql.js-based substitute.

## How to run
`npm test` (or `npm run test:watch`). Runs headless, no simulator/emulator required.

## Related notes
- [[ChronoBudget]]
- [[2026-07-23-session]]
