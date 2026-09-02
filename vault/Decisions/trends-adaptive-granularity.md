# Decision: Trends adapts bar granularity to the selected range, with tap-to-drill

**Date:** 2026-09-02
**Status:** Accepted (supersedes the "horizontal scroll, stay monthly" choice from earlier the same day)

## Context

Trends' range picker (1M/3M/6M/1Y/3Y/5Y/All — see [[Architecture/Components]]) originally kept every range at a fixed one-bar-per-month granularity, with the bar row becoming horizontally scrollable once a range's bar count exceeded the row width (3Y = 36 bars, 5Y = 60, All = however many months of history exist). That was itself a deliberate, user-confirmed choice at the time, over auto-aggregating to coarser buckets for long ranges.

Using it surfaced the real flaw: at 3Y/5Y/All the same `Jan`/`Feb`/`Mar`… labels repeat once per year with nothing distinguishing them, and scrolling through up to 60 near-identical bars to find anything is poor UX. The user, evaluating it as a UI/UX reviewer, asked for a genuine redesign rather than a label patch.

## Decision

**Adaptive granularity**: each `RANGE_OPTIONS` entry (`app/(tabs)/trends.tsx`) now carries a `granularity: 'month' | 'quarter' | 'year'`:
- `1m`/`3m`/`6m`/`1y` → month (unchanged — a trailing window of ≤12 months never repeats a month name, so no ambiguity was ever possible here)
- `3y` → quarter (12 quarter-bars — same bar count as the already-comfortable 1Y view)
- `5y` → year (5 bars)
- `all` → year, count derived from history (mirrors the existing `'all'`-anchoring approach)

This alone eliminates the ambiguity structurally: 3Y/5Y/All no longer render at month grain by default, so the repeated-month-name problem can't occur. It also eliminates the "60 bars to scroll through" complaint for the default view of every range — 12 quarters and 5 years both comfortably fit without scrolling (verified in-browser). The horizontal-scroll fallback built for the previous design (`minWidth` + `flex` trick on `monthGroup`, see [[Architecture/Components]]) stays in place as a safety net for pathological cases (e.g. "All" on an account with an unusually long history), unchanged.

**Tap-to-drill, one level deep**: per the user's explicit follow-up ("is it possible to... dive deeper"), tapping a year or quarter bar drills into that specific slice at month granularity — the year/quarter picked, not "the last N months from today." A small back pill (chevron + label, e.g. "‹ 2023" or "‹ Q1 2023") replaces the normal subtitle while drilled in, tappable to return. Drilling is not recursive — a month bar is always the finest grain and a tap on one is a no-op. Switching range chips always clears any active drill (chips mean "reset to this top-level view"). Drill state is intentionally **not persisted** (unlike `range`) — it's a transient exploration state, not a durable preference.

## Implementation

- **`db/database.ts`**: two new functions mirroring `fetchMonthlyTotals`'s established shape (JS loop building bucket keys → one `SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END)` query bucketed with the mandatory `'localtime'` modifier → zero-filled `Map`):
  - `fetchQuarterlyTotals(quarters = 12)` → `QuarterlyTotal { quarter: 'YYYY-Q1', ... }`. The quarter bucket is computed in SQL as `strftime('%Y', ...) || '-Q' || ((CAST(strftime('%m', ...) AS INTEGER) - 1) / 3 + 1)` — same-width year + single-digit quarter means the resulting strings sort/compare correctly, so `BETWEEN` bounds work exactly like they do for month keys.
  - `fetchYearlyTotals(range: number | 'all' = 5)` → `YearlyTotal { year: 'YYYY', ... }`, bucketed by plain `strftime('%Y', ...)`. `'all'` anchors to `MIN(timestamp)`'s year, same approach as `fetchMonthlyTotals('all')`.
  - `fetchMonthlyTotals` gained a third `range` shape, `{ startMonth: string; endMonth: string }` (both `'YYYY-MM'`) — this is what powers drill-down (an explicit inclusive month window, unrelated to "now"), alongside the existing `number` and `'all'` shapes. Required generalizing the query's WHERE clause from an open-ended `>= monthKeys[0]` to `BETWEEN monthKeys[0] AND monthKeys[last]` — a no-op behavior change for the two existing shapes (both already only ever produced `monthKeys` ending at the current month; a stray future-dated row was already silently dropped by the merge step regardless of the WHERE clause), but required for a window that doesn't end at "now".
- **`app/(tabs)/trends.tsx`**: the chart component (renamed `MonthlyChart` → `TrendsChart`) now draws from a normalized shape, `ChartBar { key, label, needs, wants, savings }`, instead of being hard-wired to `MonthlyTotal` — each fetch result maps into it via `monthToBar`/`quarterToBar`/`yearToBar` before rendering, with only label formatting differing per granularity (month: existing `shortMonth()`; quarter: `"Q1 '24"`; year: `"2024"`). The bar-drawing/scaling/horizontal-scroll code is unchanged and entirely granularity-agnostic. An optional `onBarPress?: (key: string) => void` prop drives the drill interaction; the screen passes `undefined` at month granularity (nothing finer to drill into) so bars render as plain `View`s rather than `TouchableOpacity`s there.
- Quarter labels are locale-aware: `getActiveLocale() === 'fr' ? 'T' : 'Q'` — French convention is "trimestre" (T1-T4), not the English "Q1-Q4". No new i18n dictionary keys were needed for this or the back-pill label (numbers, and a `‹` chevron, read the same in both languages).

## Consequences

- Every range's default view fits on screen with zero ambiguity and (short of a pathological "All" history) zero scrolling.
- Drilling in always lands on months, and a single year or quarter never repeats a month name — so the redesign doesn't reintroduce the original bug at one level of remove.
- Trends' finest grain stays "one month" — no drill into History or individual transactions from a bar tap; that was explicitly kept out of scope to bound this change.
- Three DB functions are near-duplicates of each other by construction (same shape, different bucket granularity). Accepted as the simplest option — collapsing them into one parameterized function would trade this file's very legible copy-paste-and-adjust pattern (already established by `fetchMonthlyTotals`/`fetchCategoryTotals`/`fetchSavingsWithdrawn`) for a more abstract, harder-to-read single implementation, for three call sites total.

## Related notes

- [[Architecture/Components]] — Trends component description, updated for the drill interaction
- [[Architecture/APIs]] — new function signatures, updated
- [[web-inmemory-db]] — why the web browser-verification session below needed re-seeding test data after every reload
