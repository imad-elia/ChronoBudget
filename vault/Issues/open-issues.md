# Open Issues

## Active

None.

## Known non-issues (won't fix)

- **iOS Simulator keyboard log spam** — `[CoreHaptics] hapticpatternlibrary.plist ... no such file`, `[RemoteTextInput] RTIInputSystemClient ... valid sessionID`, `[TextInputUI] Result accumulator timeout`. Simulator-only system-framework noise on every keypress; never occurs on real devices. Not project code.

- **Web: `props.pointerEvents is deprecated. Use style.pointerEvents`** — emitted by a dependency (React Navigation / Expo internals), not project code. Cosmetic; resolves when those libs update.
- **Web: onboarding re-shows on every reload, starting balances "don't apply"** — expected, same root cause: web uses an in-memory DB ([[web-inmemory-db]]), so `onboarding_complete` and `category_balance` both reset on every reload. Native persists correctly. Verified 2026-07-21 that balances apply correctly within a session (no bug in the save path) — see [[2026-07-21-session]]. Caveat found while testing: two preview tabs open to the same origin at once can throw `createSyncAccessHandle ... Access Handle cannot be created` — an OPFS lock race between tabs, not an end-user scenario; close extra tabs if seen.

## Resolved (for reference)

- **CI `e2e` job failed on commit `349ee65` ("month-scoped dashboard totals implemented")** — the Playwright onboarding spec (`e2e/onboarding.spec.ts:7`) hardcoded `getByText('TOTAL SPENT')`, which broke when the dashboard header label was renamed to "Spent This Month" as part of that change (the `test` job — unit tests + typecheck — passed fine, only the separate `e2e` job caught it). Fixed by updating the assertion to `getByText('SPENT THIS MONTH')`. Verified locally via `npx playwright test` (all 3 specs pass) before re-pushing. Fixed 2026-07-27.
- **Dashboard "Total Spent" was all-time instead of monthly, despite budget limits being labeled "monthly"** — `fetchCategoryTotals()` (`db/database.ts`) had no date filter. Fixed by adding an optional `monthKey` param defaulting to the current month via a new `currentMonthKey()` helper; `fetchCategoryTotals(null)` still gives all-time (used by the `processRecurring` catch-up test, which spans multiple months by design). Found and fixed a real timezone bug along the way: SQLite's `strftime(..., 'unixepoch')` computes the month in UTC while JS's `getFullYear()/getMonth()` are local-time, which silently disagree near midnight in non-UTC zones (confirmed: UTC+2 local flips the month boundary ~2 hours early). Fixed by adding the `'localtime'` modifier to the SQL so both sides agree. Header label changed from "Total Spent" to "Spent This Month" to match the new scope. Verified via a new Jest case (mocked `Date.now` across a month boundary, asserting both the default current-month total and the `null` all-time total) and live in the browser (added a transaction, confirmed the header and Wants card both updated to the same monthly figure). Fixed 2026-07-27.
- **`npx tsc --noEmit` had 4 pre-existing type errors, invisible until CI started gating on it** — none were runtime bugs (app worked fine), but they blocked the new CI typecheck step: `StyleSheet.absoluteFillObject` was removed from RN's types (5 call sites → `StyleSheet.absoluteFill`); plain `FlatList`'s types don't include the Reanimated-only `itemLayoutAnimation` prop (dashboard list → `Animated.FlatList`); `expo-status-bar`'s `StatusBarProps` dropped `backgroundColor` (removed from `app/_layout.tsx`); `ExternalLink.tsx`'s `href` needed a cast since it takes arbitrary external URLs, not typed app routes. All behavior-preserving, verified in browser preview. See [[testing-strategy]]. Fixed 2026-07-23.
- **GitHub Actions "Node.js 20 is deprecated" warning on every CI run** — `actions/checkout@v4`/`actions/setup-node@v4`'s own runtime targets Node 20 (separate from the `node-version` input passed to setup-node, which was already correctly set). Fixed by bumping both actions to v5, which target Node 24 natively. Fixed 2026-07-23.

- **Onboarding Continue button invisible on iOS (country step)** — the button reused `styles.nextBtn` (`flex: 2`, meant for a horizontal row); in the vertical country card Yoga collapsed it to 0 height. `flexBasis: 'auto'` overrides fix web but not native (Yoga treats `auto` as unset). Fixed with a self-contained flex-free `continueBtn` style + footer-pinned card layout (scrollable body, `windowHeight - 80` cap). See [[2026-07-03-session]]. Fixed 2026-07-03.
- **BentoCard "Remaining" balance line too faint to notice** — `styles.remaining` used `labelSmall` (10px) in `textMuted` (`#4A5168`), nearly invisible against the card's near-black gradient. Fixed by bumping to `bodyMedium` (14px, weight 600) and switching the positive-case color to `textSecondary` (#8B92A5); negative case keeps the existing neon-pink override. See [[2026-07-21-session]]. Fixed 2026-07-21.

- **"no such column: category"** — stale browser SQLite DB from before schema v1. Fixed by schema versioning + v1 migration.
- **"Unistyles runtime is not available" on Expo Go Android** — react-native-unistyles requires JSI. Fixed by removing the library and replacing with a static `theme` object + `StyleSheet.create`.
- **Keyboard hides input fields** — fixed by wrapping in `KeyboardAvoidingView`.
- **"Total Spent" hidden behind status bar** — fixed by passing `topInset` prop to `DashboardHeader`.
- **Reanimated transform overwritten by layout animation** — fixed by splitting into two nested `Animated.View` elements (outer for entering/exiting/layout, inner for transform style).
- **"no such column: subcategory"** — stale browser DB at schema v2. Fixed by clearing browser site data so the v3 migration runs.
- **History subcategory not shown** — `HistoryRow` was reading `item.note || cfg.label`, missing `item.subcategory`. Fixed 2026-07-01.
- **Web `shadow*` deprecation warning** — `BentoCard` used RN shadow props on web. Fixed with `Platform.OS === 'web'` conditional using `boxShadow`. Fixed 2026-07-01.
- **Web `createSyncAccessHandle` / `sqlite3_open_v2` / `no such table`** — expo-sqlite OPFS locking + a migration race. Fixed by switching web to in-memory SQLite and moving migrations into `getDb()`. See [[web-inmemory-db]]. Fixed 2026-07-01.
- **Android CSV export crash — `writeAsStringAsync ... is deprecated`** — the default `expo-file-system` entry deprecated (and now throws on) the classic API in SDK 54+. Fixed by importing from `expo-file-system/legacy`. Fixed 2026-07-01.
- **CSV export button missing on web** — was intentionally hidden because `expo-sharing` has no web backend. Replaced with a platform branch: web exports via a Blob + anchor download; native uses `expo-file-system`/`expo-sharing`. Button now shown on all platforms. Fixed 2026-07-01.
- **Budget limit stuck at 100% with no overspend signal** — `BentoCard` clamped the ratio with `Math.min(amount / limit, 1)`, so spending past a category limit still displayed 100% and never told the user. Fixed by computing the label from the real (unclamped) ratio while keeping the bar fill capped at 100% width, forcing the magenta `#FF2D78` bar/label when over, and adding a small `alert-circle` + `OVER` pill. Verified on web (Needs $68 / $50 → **136%** + OVER badge). Fixed 2026-07-01.

## Related notes

- [[ChronoBudget]] — project overview
- [[APIs]] — schema details
