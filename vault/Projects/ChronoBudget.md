# ChronoBudget

## What it does

Offline-first mobile expense tracker built for OLED dark-mode phones. Users log spending in one of three budget categories (Needs, Wants, Savings), set monthly limits per category, and review history. All data lives on-device in SQLite — no backend, no accounts.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 56 / React Native 0.85.3 |
| Navigation | Expo Router (file-based tabs) |
| Database | expo-sqlite (WAL mode, schema versioning via `PRAGMA user_version`) |
| State | Zustand 5 |
| Animations | react-native-reanimated 4 |
| Styling | Plain `StyleSheet.create` + static `theme` object (no style libraries) |
| Icons | `@expo/vector-icons` (MaterialCommunityIcons) |
| Gradients | expo-linear-gradient |
| Safe area | react-native-safe-area-context |

## Current status (as of 2026-07-21)

- Dashboard screen: fully working
- History screen: fully working (+ CSV export on native)
- Trends screen: implemented (custom bar chart, last 6 months) — see [[Components]]
- Onboarding overlay: implemented (4 steps)
- Dual input mode (Fast / Detailed): implemented with subcategory chips
- Smart input: Fast free-text ("15 coffee" → Wants · Dining) + Detailed auto-suggest, with a local keyword classifier (~350-word seed dictionary, per-language-ready) that learns from corrections, plus a "My Keywords" screen (Settings) for directly adding/editing/deleting keyword → category/subcategory mappings. See [[smart-input-classifier]].
- Localization: country picker (onboarding + Settings) sets currency + number formatting app-wide; English-only display with i18n-ready string files. See [[localization]].
- Budget limits: implemented with progress bars in BentoCards; over-limit state shows the true % (uncapped) + a magenta OVER badge.
- Recurring transactions: weekly/monthly/yearly rules (Recurring manager modal, autorenew header icon) that auto-post real transactions on app open, with month-end-clamped date math and missed-period catch-up. Optional custom start date at creation (hand-rolled month-grid picker, `components/DatePickerField.tsx`) — past dates immediately catch up, future dates wait. See [[recurring-transactions]].
- Web build: functional. Web uses in-memory SQLite (dev preview); native uses persistent WAL. See [[web-inmemory-db]].
- Edit transaction: tap any row (dashboard or history) to open a full edit modal (amount/category/subcategory/note + delete). See [[2026-07-21-session]].
- Starting balances: optional per-category one-time balances (onboarding step + Settings); BentoCards show "left" (Remaining = balance − spent, magenta when negative). Schema v6 `category_balance` — see [[category-balance-schema]].
- iOS build: verified working on iOS Simulator (iPhone 17 Pro, iOS 26.5) via macOS 13 VM (Intel, Xcode 26.5). `ios.bundleIdentifier` set in `app.json`. Onboarding country picker redesigned as a bounded table panel; native-only flex-collapse bug fixed. See [[2026-07-03-session]].
- Automated tests: `jest-expo` + `@testing-library/react-native`, run via `npm test` (246 tests as of 2026-07-27). Covers `lib/detectCategory.ts` (incl. French dictionary + accent-stripping), `lib/recurrence.ts`, `lib/format.ts`, `lib/csv.ts`, `store/useBudgetStore.ts` (incl. language/account state), `components/BentoCard.tsx`/`ExpenseInput.tsx`/`EditTransactionModal.tsx`/`RecurringModal.tsx`/`KeywordsModal.tsx`/`DatePickerField.tsx`, and `db/database.ts` (schema migrations + idempotency, CRUD, `processRecurring`, accounts/transfers, bulk import) against a `sql.js`-backed mock of `expo-sqlite`. Plus 3 Playwright E2E specs (`e2e/`) driving the Expo web build end-to-end (onboarding, add/edit/delete a transaction, History/Trends navigation). CI (`.github/workflows/ci.yml`) runs the unit suite + `tsc --noEmit` + the E2E suite (parallel jobs) on every push/PR to `main`. See [[testing-strategy]] — no open testing gaps currently.
- Dashboard totals are month-scoped: `fetchCategoryTotals()` in `db/database.ts` now defaults to the current month (`currentMonthKey()`, using `strftime(..., 'localtime')` to stay consistent with JS's local-time month key), with `fetchCategoryTotals(null)` for all-time. Header label changed from "Total Spent" to "Spent This Month". Fixed 2026-07-27.
- Full UI translation: French now ships (`constants/i18n/fr.ts`, ~100 keys); language now has its own independent picker (see below) rather than being tied only to country selection. Fixed several frozen-label bugs and a `KeywordsModal` reactivity gap along the way, and routed the last ~15 hardcoded UI strings (category names, empty states, budget-limits modal, onboarding tour buttons) through `t()`. See [[localization]].
- Smart input: fuzzy/stemming matching implemented — hand-rolled two-pass fallback (stemming + bounded Levenshtein) in `lib/detectCategory.ts`, no new dependency. Exact matches always still win over fuzzy ones. See [[smart-input-classifier]].
- `LimitsModal`'s hardcoded `$` currency prefix fixed — now subscribes to `symbol` from `useBudgetStore` like every other money-input surface. Fixed 2026-07-27.
- Non-English smart-input keyword dictionary: French seed dictionary (`constants/keywords/fr.ts`, ~250 entries) added alongside the English one, with per-language stemming (`lib/detectCategory.ts`) and accent-insensitive matching (NFD diacritic stripping) so "café"/"cafe" both resolve. `constants/keywordMap.ts` is now a live accessor (`getActiveKeywordMap()`) instead of a frozen constant, reacting to language changes at runtime.
- Independent language selector: `language` is now a store field separate from `country`/`locale` (`store/useBudgetStore.ts`), persisted via `app_settings`. Country selection still sets a sensible default language on first pick, but never overrides an explicit choice made via the new picker in `SettingsModal.tsx` (English/Français for now — the two locales with real translation + keyword bundles).
- Account-aware budgeting: schema v7 adds `accounts` and `transfers` tables plus a nullable `account_id` on `transactions`/`recurring`. Transactions can optionally tag an account (chips in `ExpenseInput.tsx`/`EditTransactionModal.tsx`); account balances update atomically on insert/edit/delete. Transfers move money between two accounts without touching budget-category totals (they live outside the `transactions` table). Managed via the new `AccountsModal.tsx`, reachable from Settings. See [[account-aware-budgeting]].
- CSV round-trip import: `lib/csv.ts` parses CSVs matching the app's own export format only (no generic bank-CSV mapping); malformed rows are skipped and counted rather than aborting the import. Import button added next to Export in History (web: `<input type="file">`; native: new `expo-document-picker` dependency + `expo-file-system`). Bulk-inserted via `insertTransactionsBulk()`.
- Recurring rules can now optionally tag an account too, same chip picker as one-off transactions (`RecurringModal.tsx`); `processRecurring()`'s posting loop applies the matching account-balance debit per posted occurrence. Dashboard also gained a small read-only accounts-balance row (`DashboardHeader` in `index.tsx`, tap to open `AccountsModal`), hidden when no accounts exist. See [[account-aware-budgeting]].

## Known issues

See [[open-issues]].

## Next steps

- Non-English keyword dictionaries beyond French (e.g. German, Spanish) for locales that already have translation bundles pending, or new locales entirely.
- CSV import stays intentionally round-trip-only (this app's own export format); generic bank-CSV import with column mapping would be a separate, larger feature — confirmed out of scope for now.
- Android payment-notification auto-entry was evaluated (2026-07-21) and shelved: requires a native notification-listener service (no Expo Go support, needs EAS dev build), manual per-user permission grant, Play Store declared-use justification, and fragile per-bank text parsing. Not started.

## Related notes

- [[Overview]] — architecture
- [[Components]] — file-by-file breakdown
- [[DataFlow]] — how data moves
- [[testing-strategy]] — automated test suite setup
- [[account-aware-budgeting]] — accounts + transfers schema decision
- [[localization]] — independent language selector, French keyword dictionary
