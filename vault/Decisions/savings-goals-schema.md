# Decision — savings goals as a dedicated entity table, tagged onto Savings transactions

**Date:** 2026-07-27
**Status:** accepted

## Context
The product principles (`CLAUDE.md`) describe ChronoBudget as "specific to sinking funds and irregular expenses, not generic budgeting" — but until this change, "Savings" was just one flat category with a monthly limit and an optional one-time starting balance. There was no way to earmark savings toward a named goal (e.g. "Car repair fund: $500 of $2,000"), which is the app's stated core differentiator. This was raised as a proactive enhancement proposal (not a user-reported bug or a previously-scoped roadmap item) after re-verifying the vault's "next steps" and finding account-aware budgeting and CSV import already fully covered.

## Decision
Schema migration **v8** adds a `goals` table plus a nullable FK column on `transactions`, following the exact precedent set by `accounts` ([[account-aware-budgeting]]) rather than extending `category_balance` ([[category-balance-schema]]):

```sql
CREATE TABLE IF NOT EXISTS goals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  target_amount  REAL    NOT NULL,
  current_amount REAL    NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

ALTER TABLE transactions ADD COLUMN goal_id INTEGER REFERENCES goals(id);
```

`goal_id` is nullable and only meaningful when a transaction's category is `savings` (enforced in the UI, not the DB — the app-level chip picker in `ExpenseInput.tsx`/`EditTransactionModal.tsx` only renders when the selected category is Savings, and clears `goalId` whenever the category changes away from it). `goals.current_amount` is a running total kept in sync by application code: `insertTransaction`/`updateTransaction`/`deleteTransaction` all adjust it atomically inside the existing `withTransactionAsync` block, mirroring exactly how `accounts.balance` is maintained.

A goal's `current_amount` only grows through tagged transactions — there is no direct "set balance" field in `GoalsModal.tsx`'s form (unlike `AccountsModal.tsx`, which does allow an initial balance at creation). This keeps the invariant that a goal's progress always reflects money that actually moved through a transaction, not a manually-typed number.

## Rationale
- Goals are user-defined and open-ended (unlike the fixed 3-category enum), so — same argument as `accounts` — they need their own primary key, not a value constrained by `CHECK`.
- A dedicated `goals` table lets `deleteGoal()` check for referencing transactions before deleting (same `deleteAccount()` pattern), so historical savings never silently lose their goal tag.
- Goals are deliberately **not** modeled as a new dimension on `accounts` (e.g. "an account with a target") — accounts represent where money physically sits (checking, cash), while goals represent an earmarked purpose within the Savings category. Conflating the two would force every account to carry a meaningless target amount and would make an account's balance ambiguous (actual money vs. progress toward a target).
- The progress-bar rendering (`progressColor()` thresholds + fill-width math) was extracted from `BentoCard.tsx` into a new shared `components/ProgressBar.tsx`, since `BentoCard` itself is tightly coupled to the fixed Needs/Wants/Savings grid and isn't a clean fit for an arbitrary-length goals list. Both `BentoCard` and `GoalsModal`'s goal rows now render the same `ProgressBar` component.

## Scope (v1)
- Goal tagging UI exists on `ExpenseInput.tsx`/`EditTransactionModal.tsx` (optional chips, Savings category only, hidden entirely when no goals exist).
- `GoalsModal.tsx` (list/form views, no transfer concept) is reachable from `SettingsModal.tsx`, following the same menu-row pattern as the existing Accounts entry.
- A small read-only goals-progress row was added to the Dashboard (`DashboardHeader` in `app/(tabs)/index.tsx`), mirroring the existing accounts-summary row — hidden when no goals exist, tapping opens `GoalsModal`.
- Recurring rules (`RecurringModal.tsx`) do **not** get goal tagging in this pass — recurring Savings contributions to a specific goal were judged a plausible future extension, not required for v1.

## Related notes
- [[account-aware-budgeting]] — the precedent this pattern follows (dedicated entity table over extending `category_balance`)
- [[category-balance-schema]] — the fixed-enum pattern both `accounts` and `goals` diverge from
- [[sqlite-schema-migration]]
- [[APIs]]
