# Decision — starting balances stored in a `category_balance` table

**Date:** 2026-07-21
**Status:** accepted

## Context
Users can optionally set one-time starting money per category (Needs/Wants/Savings); the dashboard shows Remaining = balance − spent. Storage options: (a) rows in the existing `app_settings` key/value store, or (b) a dedicated table.

## Decision
Dedicated table via schema migration **v6**:

```sql
CREATE TABLE IF NOT EXISTS category_balance (
  category TEXT PRIMARY KEY CHECK(category IN ('needs','wants','savings')),
  amount   REAL NOT NULL CHECK(amount >= 0)
);
```

Helpers `fetchBalances()` / `setBalance(category, amount)`; `amount <= 0` deletes the row (absence = "no balance set"), mirroring `setLimit`/`budget_limits` exactly.

## Rationale
- Typed REAL amounts with DB-level CHECK constraints, instead of stringly-typed settings values.
- Mirrors the existing `budget_limits` shape — one obvious pattern for per-category numeric config.
- Trivially joinable/queryable next to totals if future features need it (e.g. month-scoped remaining).

## Semantics
Balance is a **one-time pot**, not a monthly allocation. Remaining is computed against **all-time** category spend (`fetchCategoryTotals`). If month-scoped totals land later, revisit whether Remaining should follow.

## Related notes
- [[2026-07-21-session]]
- [[APIs]]
