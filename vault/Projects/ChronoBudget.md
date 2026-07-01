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

## Current status (as of 2026-07-01)

- Dashboard screen: fully working
- History screen: fully working (+ CSV export on native)
- Trends screen: implemented (custom bar chart, last 6 months) — see [[Components]]
- Onboarding overlay: implemented (4 steps)
- Dual input mode (Fast / Detailed): implemented with subcategory chips
- Smart input: Fast free-text ("15 coffee" → Wants · Dining) + Detailed auto-suggest, with a local keyword classifier that learns from corrections. See [[smart-input-classifier]].
- Localization: country picker (onboarding + Settings) sets currency + number formatting app-wide; English-only display with i18n-ready string files. See [[localization]].
- Budget limits: implemented with progress bars in BentoCards
- Web build: functional. Web uses in-memory SQLite (dev preview); native uses persistent WAL. See [[web-inmemory-db]].

## Known issues

See [[open-issues]].

## Next steps

- Full UI translation: string structure is ready ([[localization]]); add locale files (e.g. `fr.ts`) when desired.
- Possible future work: recurring transactions, account-aware budgeting, CSV *import*.

## Related notes

- [[Overview]] — architecture
- [[Components]] — file-by-file breakdown
- [[DataFlow]] — how data moves
