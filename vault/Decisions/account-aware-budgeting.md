# Decision — accounts as a dedicated entity table, not an extension of `category_balance`

**Date:** 2026-07-27
**Status:** accepted

## Context
"Account-aware budgeting" (tracking where money actually sits — checking, cash, savings account — separately from the Needs/Wants/Savings budget categories) had been an unscoped roadmap item. The closest existing precedent, `category_balance` ([[category-balance-schema]]), keys a balance directly to the fixed 3-value `Category` enum via a `PRIMARY KEY CHECK(category IN (...))`. Accounts needed to be open-ended (user creates arbitrarily many, named freely), which that pattern can't express.

## Decision
Schema migration **v7** adds two new tables plus a nullable FK column, instead of reusing `category_balance`'s shape:

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE recurring    ADD COLUMN account_id INTEGER REFERENCES accounts(id);

CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_account INTEGER NOT NULL REFERENCES accounts(id),
  to_account   INTEGER NOT NULL REFERENCES accounts(id),
  amount REAL NOT NULL CHECK(amount > 0),
  note TEXT NOT NULL DEFAULT '',
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);
```

`account_id` is nullable everywhere — a transaction/recurring rule with no account tag behaves exactly as before. `accounts.balance` is a running total, kept in sync by application code (not a computed view): `insertTransaction`/`updateTransaction`/`deleteTransaction` and `insertTransfer` all adjust it atomically inside `withTransactionAsync`, mirroring the existing pattern in `processRecurring()`.

## Rationale
- Accounts are user-defined and open-ended (unlike the fixed 3-category enum), so they need their own primary key, not a value constrained by `CHECK`.
- A dedicated `accounts` table lets `deleteAccount()` check for references (`transactions`/`recurring` rows) before deleting, preventing historical spend from silently losing its account tag — not expressible with a `category_balance`-style row.
- Transfers are modeled as a **separate table**, not a new `category` value on `transactions`. Adding a 4th category value would have broken the `CHECK(category IN ('needs','wants','savings'))` constraint present on 4+ tables (`transactions`, `budget_limits`, `keyword_learn`, `recurring`, `category_balance`) and every `Category` union type in the app. Keeping transfers in their own table also means `fetchCategoryTotals()`/`fetchMonthlyTotals()` need zero changes — they only ever query `transactions`, so transfers are automatically excluded from budget-category totals.

## Scope (v1)
- Full accounts + transfers (not just named accounts) was the confirmed scope — see [[2026-07-27-session]] (evening) / this session's plan.
- Account tagging UI exists on `ExpenseInput.tsx`/`EditTransactionModal.tsx` (optional chips, hidden entirely when no accounts exist).

## RecurringModal + Dashboard follow-up (2026-07-27, later session)

Both v1 gaps above were closed in a follow-up pass:

- **`RecurringModal.tsx`** now has the same account-chip picker as the one-off transaction forms. `fetchRecurring()`/`insertRecurring()`/`updateRecurring()` gained `accountId`, and `processRecurring()`'s posting loop now includes `account_id` in the `INSERT INTO transactions` it runs per due occurrence, plus applies the matching `UPDATE accounts SET balance = balance - ?` when the rule carries an account — same atomic pattern as `insertTransaction`, still inside the existing `withTransactionAsync` block so multi-occurrence catch-ups stay atomic.
- **Dashboard accounts summary** — a horizontal row of small read-only account cards (name + balance, negative styled like `BentoCard`'s over-limit color) was added directly inside `DashboardHeader` (`app/(tabs)/index.tsx`), between the Needs/Wants/Savings grid and the "RECENT" label. Hidden entirely when `accounts.length === 0`. Tapping a card opens `AccountsModal` via a new `onOpenAccounts` prop, wired the same way as the existing `onOpenLimits`/`onOpenSettings`/`onOpenRecurring` props. Inlined rather than extracted into its own component file — used in exactly one place.

Generic bank-CSV import remains explicitly out of scope (confirmed with the user) — the app's CSV import stays round-trip-only against its own export format.

## Addendum — the delete guard must count transfers too (2026-08-29)

`deleteAccount()`'s reference check originally counted rows in `transactions` and `recurring` only, which left a hole: `transfers.from_account`/`to_account` also `REFERENCES accounts(id)`, and `foreign_keys` is `ON`. An account referenced *solely* by a transfer therefore passed the guard, and the `DELETE` then failed on the foreign key inside SQLite — a raw exception instead of the guard's intended `false` return. Fixed by adding a third count over `transfers` (either side). The rule to carry forward: **every table that gains an FK to `accounts` must also be added to this guard**, since the guard exists precisely to convert an FK failure into a polite refusal. See [[open-issues]], [[2026-08-29b-session]].

## Related notes
- [[category-balance-schema]] — the pattern this deliberately diverges from
- [[sqlite-schema-migration]]
- [[APIs]]
