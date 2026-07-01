# Components

## Screens

### `app/(tabs)/index.tsx` — Dashboard
The main screen. Initialises the database on mount via `initDb()`, then checks `getSetting('onboarding_complete')` to decide whether to show the onboarding overlay. Contains three local sub-components defined in the same file: `DashboardHeader` (total spent + BentoCard grid + limits button), `TransactionRow` (animated swipeable row with delete), `LimitsModal` (bottom-sheet Modal with three TextInputs for per-category budget limits). Uses `FlatList` for the recent-transactions list and a sticky `ExpenseInput` footer. Wraps everything in `KeyboardAvoidingView`.

### `app/(tabs)/history.tsx` — History
Fetches up to 500 transactions, groups them by date into sections (Today / Yesterday / full date), and renders a `SectionList` with sticky headers. Provides four filter chips (All / Needs / Wants / Savings). Each row is a `HistoryRow` component defined in the same file, with animated enter/exit and a delete button. Watches `refreshCounter` from Zustand so deletions on the Dashboard are reflected immediately.

## Components

### `components/BentoCard.tsx`
Stat card used in the Dashboard header grid. Receives `title`, `amount`, `color`, `glowColor`, `gradientColors`, `icon`, and optional `limit`. When `limit > 0`, renders a progress bar whose color shifts through green → yellow → orange → pink as the ratio approaches and exceeds 100%. Uses `expo-linear-gradient` for the card background.

### `components/ExpenseInput.tsx`
The sticky input footer on the Dashboard. Maintains two modes — **Fast** (category chips + amount) and **Detailed** (adds subcategory chip row + note field). Mode is persisted to SQLite via `setSetting('input_mode', ...)` and restored on mount. Subcategory chips are sourced from `constants/subcategories.ts`; a "+ Custom" chip reveals an inline TextInput. On submit calls `insertTransaction` then `triggerRefresh`.

### `components/OnboardingOverlay.tsx`
Full-screen transparent `Modal` shown once on first launch. Four steps defined in a `STEPS` array: Welcome (centred), Fast Mode (anchored near bottom), Detailed Mode (anchored near bottom), Budget Limits (centred). Progress dots, Back/Next buttons, Skip link. On completion writes `setSetting('onboarding_complete', '1')`.

### `components/BentoCard.tsx`
See above.

## Utilities / Data

### `db/database.ts`
All SQLite access. Exports: `initDb`, `getSetting`, `setSetting`, `insertTransaction`, `deleteTransaction`, `fetchCategoryTotals`, `fetchRecentTransactions`, `fetchTransactions`, `fetchLimits`, `setLimit`. Schema version is `SCHEMA_VERSION = 3`. See [[APIs]] for full schema.

### `store/useBudgetStore.ts`
Zustand store. Exports types `Transaction`, `Category`, `CategoryTotals`, `CategoryLimits`. State: `refreshCounter`, `categoryTotals`, `recentTransactions`, `limits`. Mutations: `triggerRefresh`, `setCategoryTotals`, `setRecentTransactions`, `setLimits`.

### `theme/index.ts`
Single source of truth for design tokens: `colors` (bgPrimary `#000000`, neonGreen `#00FF87`, neonPink `#FF2D78`, neonBlue `#00BFFF`, surface, glassBorder, text variants), `spacing` (xs–xxl), `radius` (sm–full), `typography` (displayLarge through labelSmall). Exported as a plain `const` — no runtime overhead.

### `constants/subcategories.ts`
Static map of predefined subcategory strings per category:
- `needs`: Rent, Groceries, Transport, Bills, Health, Education
- `wants`: Dining, Entertainment, Shopping, Travel, Subscriptions
- `savings`: Emergency Fund, Investment, Retirement, Goal

## Related notes

- [[Overview]] — architecture diagram
- [[DataFlow]] — how these components interact at runtime
