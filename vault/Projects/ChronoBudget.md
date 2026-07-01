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

## Current status (as of 2026-06-28)

- Dashboard screen: fully working
- History screen: fully working
- Onboarding overlay: implemented (4 steps)
- Dual input mode (Fast / Detailed): implemented with subcategory chips
- Budget limits: implemented with progress bars in BentoCards
- Web build: functional; minor `shadow*` deprecation warning (cosmetic)

## Known issues

See [[open-issues]].

## Next steps

- Nothing formally scheduled yet. Possible future work: export transactions (CSV), charts/trends view, recurring transaction support.

## Related notes

- [[Overview]] — architecture
- [[Components]] — file-by-file breakdown
- [[DataFlow]] — how data moves
