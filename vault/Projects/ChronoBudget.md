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
- Recurring transactions: weekly/monthly/yearly rules (Recurring manager modal, autorenew header icon) that auto-post real transactions on app open, with month-end-clamped date math and missed-period catch-up. See [[recurring-transactions]].
- Web build: functional. Web uses in-memory SQLite (dev preview); native uses persistent WAL. See [[web-inmemory-db]].
- Edit transaction: tap any row (dashboard or history) to open a full edit modal (amount/category/subcategory/note + delete). See [[2026-07-21-session]].
- Starting balances: optional per-category one-time balances (onboarding step + Settings); BentoCards show "left" (Remaining = balance − spent, magenta when negative). Schema v6 `category_balance` — see [[category-balance-schema]].
- iOS build: verified working on iOS Simulator (iPhone 17 Pro, iOS 26.5) via macOS 13 VM (Intel, Xcode 26.5). `ios.bundleIdentifier` set in `app.json`. Onboarding country picker redesigned as a bounded table panel; native-only flex-collapse bug fixed. See [[2026-07-03-session]].

## Known issues

See [[open-issues]].

## Next steps

- Month-scoped dashboard totals ("Total Spent" is currently all-time) — highest-value budgeting improvement.

- Full UI translation: string structure is ready ([[localization]]); add locale files (e.g. `fr.ts`) when desired.
- Recurring: optional custom start date (rules currently anchor to creation day). See [[recurring-transactions]].
- Smart input: fuzzy/stemming matching (deferred, see [[smart-input-classifier]] Future work); non-English keyword dictionaries once other locale UI strings ship.
- Possible future work: account-aware budgeting, CSV *import*.
- Android payment-notification auto-entry was evaluated (2026-07-21) and shelved: requires a native notification-listener service (no Expo Go support, needs EAS dev build), manual per-user permission grant, Play Store declared-use justification, and fragile per-bank text parsing. Not started.

## Related notes

- [[Overview]] — architecture
- [[Components]] — file-by-file breakdown
- [[DataFlow]] — how data moves
