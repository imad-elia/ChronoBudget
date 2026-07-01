# Decision: Recurring transactions (auto-posting rules)

**Date:** 2026-07-01
**Status:** Accepted

## Context

ChronoBudget only recorded one-off spending. Regular expenses (rent, subscriptions,
weekly groceries, yearly insurance) had to be re-entered every period. The product
principle is "set and forget," and the app is offline-first with no backend, so a
server-driven scheduler is out. We need recurring rules that generate **real
transactions** locally, surviving the app being closed for weeks or months.

## Decision

A `recurring` rules table (**schema v5**) plus a **catch-up pass on app open** that
posts every due occurrence.

- **Frequencies:** `weekly`, `monthly`, `yearly` (user choice).
- **Creation/management:** a dedicated **Recurring manager modal**
  (`components/RecurringModal.tsx`, autorenew icon in the dashboard header),
  reusing the LimitsModal/SettingsModal bottom-sheet pattern. List view (rows with
  amount, frequency, next date, delete) + an add/edit form (category chips,
  amount, subcategory chips from [[Components]], note, frequency pills). Keeps the
  fast daily input uncluttered.
- **Posting:** **auto-post on open**, silently. The user deletes any unwanted
  transaction from History.

## Data model & date math

```sql
CREATE TABLE recurring (
  id INTEGER PK, amount REAL>0, category, subcategory, note,
  frequency IN ('weekly','monthly','yearly'),
  next_run INTEGER,           -- next due timestamp (ms)
  active INTEGER DEFAULT 1, created_at
);
```

- **No anchor column.** The day-of-month / weekday / month-day is implicit in
  `next_run` and preserved by always advancing from the previous `next_run`. Rules
  anchor to the creation moment (`next_run = Date.now()` on insert, so the first
  occurrence posts immediately). A custom start date is a future enhancement.
- **`lib/recurrence.ts`** (pure, RN-free, like [[smart-input-classifier]]'s
  detectCategory): `advance(ts, freq)` — weekly `+7d`; monthly/yearly keep the same
  day **clamped to the target month's length** (Jan 31 → Feb 28/29; Feb 29 → Feb 28
  next year) so we never overflow into the following month.
- **`processRecurring()`** — for each active rule with `next_run <= now`, insert one
  transaction per missed occurrence (timestamp = that occurrence, so it lands in the
  correct month for Trends), advancing until `next_run > now`. Wrapped in
  `withTransactionAsync`. `advance` is strictly increasing → the loop always
  terminates. Returns the count so callers can refresh. Runs once in the dashboard
  mount effect (before the first fetch) and again after any create/edit in the modal.

## Consequences

- Fully offline, deterministic, zero new runtime dependencies.
- Missed periods self-heal on next open (no background task needed).
- Generated rows are ordinary transactions — they show in History/Trends, count
  toward budget limits, and can be individually deleted.
- Web (in-memory DB) forgets rules on reload; native persists them.

## Related notes

- [[web-inmemory-db]] — why web loses rules on reload
- [[APIs]] — schema v5, `recurring` table, DB functions
- [[Components]] — RecurringModal
- [[ChronoBudget]] — status
