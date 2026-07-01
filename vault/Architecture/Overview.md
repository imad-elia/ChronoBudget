# Architecture Overview

## High-level diagram

```
┌─────────────────────────────────────────────────────┐
│                   Expo Router                        │
│  app/_layout.tsx  (root — StatusBar, fonts)          │
│  app/(tabs)/_layout.tsx  (tab bar config)            │
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │  index.tsx       │  │  history.tsx             │  │
│  │  Dashboard       │  │  History + filter chips  │  │
│  └────────┬────────┘  └───────────┬──────────────┘  │
└───────────┼───────────────────────┼─────────────────┘
            │                       │
    ┌───────▼───────────────────────▼──────┐
    │           Zustand store               │
    │  useBudgetStore.ts                    │
    │  refreshCounter · categoryTotals      │
    │  recentTransactions · limits          │
    └──────────────────┬────────────────────┘
                       │
    ┌──────────────────▼────────────────────┐
    │           db/database.ts              │
    │  expo-sqlite (chronobudget.db)        │
    │  WAL mode · schema v3                 │
    │  tables: transactions, budget_limits, │
    │           app_settings                │
    └───────────────────────────────────────┘
```

## Key design decisions

- **Offline-only**: no network calls anywhere. All persistence is SQLite.
- **No style library**: after removing react-native-unistyles (JSI-only, incompatible with Expo Go), all styles use `StyleSheet.create` + a static `theme` object from `theme/index.ts`.
- **Refresh pattern**: mutations call `triggerRefresh()` which increments a counter in Zustand; screens watch that counter in `useEffect` deps and re-fetch from SQLite.
- **Schema migration**: incremental `PRAGMA user_version` blocks. v1 is destructive (drop+recreate), v2+ are additive (`ALTER TABLE` / `CREATE TABLE IF NOT EXISTS`).

## Related notes

- [[Components]] — per-file breakdown
- [[DataFlow]] — data lifecycle
- [[APIs]] — no external APIs; see for env vars and SQLite schema
