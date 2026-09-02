# Components

File-by-file breakdown of the app as of schema v8. Screens live in `app/` (Expo Router, file-based), shared UI in `components/`, pure logic in `lib/`, static data in `constants/`.

## Routing shell

### `app/_layout.tsx` — root layout
Wraps the app in `GestureHandlerRootView` (black background) and renders a headerless `Stack` with a light `StatusBar`. No tab logic and no explicit `SafeAreaProvider` — screens call `useSafeAreaInsets()` directly and pad themselves. Note `expo-status-bar`'s `StatusBarProps` no longer accepts `backgroundColor`; it was removed here when CI started gating on `tsc --noEmit`.

### `app/(tabs)/_layout.tsx` — tab bar
Three tabs (Dashboard / History / Trends) with MaterialCommunityIcons, a dark tab bar, and neon-green active tint. Subscribes to `useBudgetStore((s) => s.language)` **purely to force a re-render on a language switch** — `t()` reads a module-level variable rather than a Zustand field, so without a subscription the labels freeze. It must be `language` specifically: `symbol` only changes with country/currency, so a language-only switch wouldn't fire. This was a real bug, fixed 2026-07-27.

### `app/modal.tsx`, `app/+not-found.tsx`, `app/+html.tsx`
Expo Router scaffolding from the template. `+html.tsx` is the web document shell. None carry product logic.

## Screens

### `app/(tabs)/index.tsx` — Dashboard
The main screen and the app's initialisation point. On mount it runs `initDb()` → `processRecurring()` → `Promise.all([loadLocale, loadLearnedKeywords, loadRecurring])` before revealing the UI, so amounts render in the right currency and the smart input can classify immediately. Then it checks `getSetting('onboarding_complete')` to decide whether to show the onboarding overlay. A second effect keyed on `refreshCounter` re-fetches totals, recent transactions, limits, balances, accounts and goals.

Renders an `Animated.FlatList` (Reanimated's `itemLayoutAnimation` needs the animated variant — plain `FlatList` has no such prop in its types) with a sticky `ExpenseInput` footer inside a `KeyboardAvoidingView`. Owns the open/closed state for six modals.

Four sub-components are defined in the same file:
- **`DashboardHeader`** — "Spent this month" total, the three `BentoCard`s, a horizontal read-only accounts row and a goals-progress row (each hidden entirely when empty), and the header icon row: recurring (autorenew), accounts, settings gear rightmost.
- **`TransactionRow`** — animated swipeable row; tap to edit, swipe to delete.
- **`LimitsModal`** — bottom sheet with three amount inputs. Subscribes to `symbol` so the currency prefix follows the selected country.
- **`EmptyState`** — shown when there are no transactions.

### `app/(tabs)/history.tsx` — History
Fetches up to 500 transactions, groups them into Today / Yesterday / explicit-date sections, and renders a `SectionList` with sticky headers. Four filter chips (All / Needs / Wants / Savings). Watches `refreshCounter` so deletions elsewhere appear immediately.

Also owns **CSV export and import**, the app's only file I/O, on a platform branch:
- **Web** — export via a `Blob` + temporary anchor download; import via a hidden `<input type="file">`.
- **Native** — export via `expo-file-system` (imported from `expo-file-system/legacy`, since the default entry deprecated and now throws on the classic API in SDK 54+) then `expo-sharing`; import via `expo-document-picker`.

Native modules are `require`d lazily behind `Platform.OS !== 'web'` so the web bundle never touches them.

### `app/(tabs)/trends.tsx` — Trends
Bar chart built by hand — no charting library. A range picker (`1M`/`3M`/`6M`/`1Y`/`3Y`/`5Y`/`All`) drives the fetch on `refreshCounter`/range change; selection persists via `getSetting`/`setSetting('trends_range', ...)`, same pattern as `ExpenseInput`'s `input_mode`, defaulting to `6M`. **Bar granularity adapts to the range** (2026-09-02, see [[Decisions/trends-adaptive-granularity]]): `1M`-`1Y` render monthly (`fetchMonthlyTotals`), `3Y` renders 12 quarterly bars (`fetchQuarterlyTotals`), `5Y`/`All` render yearly bars (`fetchYearlyTotals`) — this is what actually fixed the original "same month labels repeat every year with no way to tell which year" bug; a fixed horizontal-scroll-only approach was tried first and reverted the same day once it didn't solve the ambiguity. Tapping a year or quarter bar drills one level into its months (via `fetchMonthlyTotals({ startMonth, endMonth })`) with a small "‹ 2023"-style back pill replacing the subtitle while drilled in; a month bar is the finest grain and a tap on one is a no-op. Drill state doesn't persist (unlike `range`) and always clears when a range chip is tapped.

Three local sub-components share a normalized `ChartBar { key, label, needs, wants, savings }` shape regardless of granularity: `TrendsChart` (the bars — wrapped in a horizontal `ScrollView` with a `minWidth` floor per bar group so an overflowing range scrolls instead of squeezing bars illegibly thin, while a range that fits still fills the row edge-to-edge exactly as before), `SummaryChips` (headline figures) and `Legend`. Falls back to an empty state when every bar is zero.

## Input & transaction components

### `components/ExpenseInput.tsx`
The sticky input footer, and the most stateful component in the app. Two modes:
- **Fast** — one free-text field ("15 coffee") parsed by `lib/detectCategory.ts` into an amount, a category/subcategory and a leftover description. The leftover is saved as the transaction's note. Tapping the "Category · Subcategory" preview text toggles override chips — there is no separate edit button, matching the tap-the-chip pattern used everywhere else.
- **Detailed** — explicit amount, category chips, subcategory chips (from `SUBCATEGORIES`, plus a "+ Custom" chip revealing an inline input), and a note field.

Both modes optionally tag an account, and a goal when the category is Savings and at least one goal exists. Changing the category away from Savings clears the goal. Mode is persisted via `setSetting('input_mode', …)` and restored on mount. Submitting calls `insertTransaction`, learns the keyword when the user overrode the detection, then `triggerRefresh()`.

The `overridden` flag resets when the field is cleared back to empty — a "new entry" signal — so an override sticks while refining the current entry but never leaks into an unrelated one.

### `components/EditTransactionModal.tsx`
Full edit sheet reached by tapping any row on the Dashboard or in History. Prefills every field (a custom subcategory lands in the custom input rather than falsely selecting a chip), supports re-tagging account and goal, and has a delete button. Saving routes through `updateTransaction`, which reverses the old account/goal effects before applying the new ones. Does not change the transaction's timestamp.

### `components/DatePickerField.tsx`
Hand-rolled month-grid date picker, built because no date-picker pattern existed in the codebase and the obvious library (`@react-native-community/datetimepicker`) has no web support. Used only for a recurring rule's optional custom start date.

## Modals reached from the Dashboard or Settings

### `components/SettingsModal.tsx`
The hub. One outer `ScrollView` wraps the whole body — the sheet previously capped its own height with only the country list independently scrollable, which reliably hid the rows below it on Android. Contains: a collapsed country **dropdown** (`countryExpanded`), an independent language picker (English / Français — the two locales with both a translation bundle and a keyword dictionary), per-category starting-balance inputs, and menu rows opening Accounts, Goals and My Keywords.

### `components/AccountsModal.tsx`
List and form views for accounts, plus transfers between them. Creating an account may set an initial balance; editing renames only. Deleting is refused when the account is still referenced.

### `components/GoalsModal.tsx`
List and form views for savings goals. The form has name and target only — there is deliberately no way to type a progress figure, so a goal's `current_amount` always reflects money that actually moved through a transaction. Rejects a non-positive target before it reaches the DB. Goal rows render the shared `ProgressBar`.

### `components/RecurringModal.tsx`
Create, edit and delete recurring rules (weekly / monthly / yearly), with the same account chip picker as one-off transactions and an optional custom start date via `DatePickerField`. Saving runs `processRecurring()` then reloads and refreshes. No goal tagging — a known v1 gap.

### `components/KeywordsModal.tsx`
"My Keywords" — add, edit and delete keyword → category/subcategory mappings directly, on top of what the classifier learns from corrections. Subscribes to a store field purely to re-render on a locale change, matching the pattern every other locale-aware screen uses.

### `components/OnboardingOverlay.tsx`
Full-screen transparent `Modal`, three phases held in one `phase` state: `country` → `balance` → `tour`.
- **country** — picker pre-filled from `expo-localization`'s device region; the pick sets currency and, on a genuine first run only, the default language.
- **balance** — optional per-category starting balances, with a "‹ Back" link to the country step.
- **tour** — four steps from a `STEPS` array holding `titleKey`/`bodyKey` `StringKey` refs resolved through `t()` at render time (never at module load). The card's top edge is pinned at 16% of screen height on every step so it doesn't jump as copy length changes. Step 0's Back button returns to the balance phase; Back sits alongside "Skip tutorial" as a matching text link.

Completing or skipping writes `setSetting('onboarding_complete', '1')`.

## Shared presentational components

### `components/BentoCard.tsx`
Stat card in the Dashboard grid. Takes `title`, `amount`, `color`, `glowColor`, `gradientColors`, `icon`, and optional `limit` and `balance`. With a limit it renders a `ProgressBar`; with a balance it renders a "Remaining" line (balance − spent) that switches to neon pink when negative. Uses `expo-linear-gradient`, and a `Platform.OS === 'web'` branch for `boxShadow` vs RN shadow props.

### `components/ProgressBar.tsx`
Extracted from `BentoCard` so `GoalsModal` could share it. Exports `progressColor(ratio, color)` — green → yellow (≥0.7) → orange (≥0.9) → pink (≥1) — and the `ProgressBar` component, which caps the **fill width** at 100% while displaying the **true uncapped percentage**, plus an optional OVER badge. That split is deliberate: a clamped ratio once hid overspending behind a permanent 100%.

### `components/ExternalLink.tsx`, `Themed.tsx`, `StyledText.tsx`, `useColorScheme.ts`, `useClientOnlyValue.ts`
Expo template leftovers. `ExternalLink` needs a `href` cast since it takes arbitrary external URLs rather than typed app routes. The themed/colour-scheme helpers are effectively unused — the app uses the static `theme` object and is dark-only.

## State

### `store/useBudgetStore.ts`
Zustand store. Exports the shared types (`Transaction`, `Category`, `CategoryTotals`, `CategoryLimits`, `MonthlyTotal`, `RecurringRule`, `Frequency`, `Account`, `Transfer`, `Goal`), `SUPPORTED_LANGUAGES`, and a re-export of `COUNTRIES`.

State: `refreshCounter`, `categoryTotals`, `recentTransactions`, `limits`, `balances`, `learnedKeywords`, `recurring`, `accounts`, `transfers`, `goals`, plus localization (`country`, `locale`, `currency`, `symbol`, `currencyDecimals`, `language`).

Async actions: `loadLearnedKeywords`, `loadRecurring`, `loadLocale`, `setCountry`, `setLanguage`. `setCountry()` bumps `refreshCounter` so rows that format currency via `getState()` re-render, and only defaults the language when no `language` setting has ever been written — an explicit choice survives later country changes.

`refreshCounter` is the app's single invalidation signal: any write calls `triggerRefresh()` and every screen re-fetches.

## Utilities & static data

### `db/database.ts`
All SQLite access — schema, migrations and every helper. See [[APIs]] for the full surface.

### `theme/index.ts`
Design tokens as a plain `const`: `colors` (bgPrimary `#000000`, neonGreen `#00FF87`, neonPink `#FF2D78`, neonBlue `#00BFFF`, surface, glassBorder, text variants), `spacing` (xs–xxl), `radius` (sm–full), `typography` (displayLarge → labelSmall). No style library — see [[remove-unistyles]].

### `constants/subcategories.ts`
`SUBCATEGORIES` is the canonical, DB-stored English form:
- `needs`: Rent, Groceries, Transport, Bills, Health, Education
- `wants`: Dining, Entertainment, Shopping, Travel, Subscriptions
- `savings`: Emergency Fund, Investment, Retirement, Goal

`subcategoryLabel(s)` translates for **display only** via a `SUBCATEGORY_LABEL_KEY` map — the stored value and the keyword-dictionary match target are untouched, so the classifier needs no changes. Custom subcategories have no map entry and pass through unchanged.

### `constants/i18n/`, `constants/keywords/`, `constants/countries.ts`, `constants/keywordMap.ts`
Translation bundles (`en`, `fr`), seed keyword dictionaries (~350 English, ~250 French), the country/currency table, and the live keyword-map accessor. See [[localization]] and [[smart-input-classifier]].

### `lib/`
`format.ts`, `i18n.ts`, `detectCategory.ts`, `recurrence.ts`, `csv.ts` — all pure and all unit-tested. See [[APIs]].

## Recurring gotchas worth knowing before editing

- **Never compute a `t()`-derived label at module scope.** Keep a `StringKey` map at module level and call `t()` inside the render. This bug has been fixed in six separate files.
- **Locale-aware screens need a store subscription** even if they don't read the value, because `t()` isn't reactive.
- **Avoid `flex` on buttons in vertical card layouts.** Yoga collapses them to zero height on native while web renders fine; `flexBasis: 'auto'` does not save you.
- **Every bottom sheet needs one outer `ScrollView`**, not just a scrollable list inside it.

## Related notes

- [[Overview]] — architecture diagram
- [[DataFlow]] — how these components interact at runtime
- [[APIs]] — schema and DB function reference
- [[open-issues]] — the bugs behind the gotchas above
