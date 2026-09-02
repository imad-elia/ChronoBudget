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

## Addendum — target_amount guarded in application code, not by a CHECK (2026-08-29)

A QA code review found that `goals.target_amount` is the only money column in the schema without a positive constraint — `transactions.amount`, `budget_limits.amount`, `transfers.amount` all carry `CHECK(… > 0)` and `category_balance.amount` carries `>= 0`. A non-positive target divides by zero in `ProgressBar`'s fill maths.

Fixed with an `assertPositiveTarget()` guard in `insertGoal`/`updateGoal` (`db/database.ts`) rather than a v9 migration. SQLite cannot `ALTER TABLE … ADD CONSTRAINT`; adding a real `CHECK` means create-copy-drop-rename, and `goals` is referenced by `transactions.goal_id` with `PRAGMA foreign_keys = ON`, so the rebuild is materially riskier than the latent defect it closes. The guard throws a `CHECK constraint failed: goals.target_amount` message so the failure reads identically to its sibling columns, and `GoalsModal`'s existing `try/catch` already surfaces it as `input.errSave`.

This is consistent with existing precedent for DB-layer guards in this codebase: `learnKeyword()` early-returns on an empty key, and `setLimit()`/`setBalance()` handle `amount <= 0` in the helper rather than leaving it to the UI. If the schema is ever rebuilt for another reason, add the real `CHECK` then. See [[open-issues]], [[2026-08-29b-session]].

## Addendum — Savings transactions gain a direction: deposit vs. withdrawal (2026-09-02)

**Problem:** `transactions.amount` has always been `CHECK(amount > 0)` with no sign anywhere in the schema. Every category was summed identically as "money spent this period" — correct for Needs/Wants, but wrong for Savings, where logging a transaction could only mean "money added". There was no way to record taking money *out* of savings (e.g. using the "Car repair fund" to actually pay for a repair) — it would either wrongly inflate the savings total further, or (logged under Needs instead) leave the Savings total/goal progress permanently overstated since the money leaving was never reflected. Raised by the user, not found in testing.

**Decision:** schema migration **v9** adds a `kind` column:
```sql
ALTER TABLE transactions ADD COLUMN kind TEXT NOT NULL DEFAULT 'deposit';
```
No `CHECK` — same reasoning as the `target_amount` addendum above (ALTER-added `CHECK` constraints are avoidable risk in SQLite; validated in TS instead, via the `TransactionKind = 'deposit' | 'withdrawal'` union type). `kind` is only ever shown/editable in the UI when `category === 'savings'` (`ExpenseInput.tsx`/`EditTransactionModal.tsx`, same conditional-render pattern the goal-chip picker already used) — Needs/Wants rows always keep the default and are never shown a way to change it.

**Key correctness detail:** a signed `delta` (`kind === 'withdrawal' ? -amount : amount`) is computed once in `insertTransaction`/`updateTransaction`/`deleteTransaction` and applied to **both** side effects that previously assumed "spend": a tagged goal's `current_amount` (`+= delta`), and — easy to miss — a tagged account's `balance` (`-= delta`, so a withdrawal *credits* the account instead of debiting it, since money is coming back out of the abstract savings bucket into spendable cash). `fetchCategoryTotals`/`fetchMonthlyTotals` net deposits and withdrawals via `SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END)` — a no-op for Needs/Wants, correct netting for Savings. Nothing downstream (`BentoCard`, `BentoCardDetailModal`, `LimitsModal`, Trends) needed to change, since they only ever consumed the totals number, which is now correctly net.

Transaction-list rows (`TransactionRow` in `app/(tabs)/index.tsx`, `HistoryRow` in `app/(tabs)/history.tsx`) needed a visible cue too — without one, a withdrawal row looks identical to a deposit row, reintroducing the exact confusion this change fixes. New `formatSignedAmount()` (`lib/format.ts`) prefixes a withdrawal's amount with `-`.

**Explicitly out of scope (user-confirmed, standalone withdrawal chosen over a linked transfer):**
- A withdrawal is *not* linked to a Needs/Wants entry — if the user wants "car repair: $200" to also show up under Needs spending/Trends, they log that as a separate ordinary transaction. No cross-category transfer concept was added.
- CSV export/import doesn't round-trip `kind` (same accepted gap as `account_id`/`goal_id` — see `lib/csv.ts`'s header comment).
- Recurring rules stay deposit-only — matches the existing "Scope (v1)" note above that recurring Savings contributions don't support goal-tagging either.
- No floor/guard preventing a withdrawal from taking a goal's `current_amount` (or the category total) negative — consistent with existing precedent (`accounts.balance` already has no floor check anywhere).

See [[open-issues]], [[2026-09-02-session]].

## Addendum — same-day correction: Fast mode hid the direction, and Limit/Balance used the wrong figure (2026-09-02)

The initial deposit/withdrawal pass above shipped with two real defects the user caught within the same session:

1. **Fast mode's Savings entries silently defaulted to Deposit with no visible indication** — the toggle only existed inside the collapsed "tap to change" override panel (`showOverride`), so a withdrawal typed in Fast mode had no way to be corrected without deliberately opening that panel.
2. **The very "OVER limit" backwards-framing flagged as a follow-up in the addendum above turned out to be a real bug, not just an unfortunate framing.** `BentoCard`/`BentoCardDetailModal` computed Limit-consumption (`isOverLimit`) and Balance-remaining (`remaining = balance - amount`) from the *net* Savings total (deposits − withdrawals). That meant **depositing** — growing savings — could trigger the red OVER badge or a negative remaining balance, while **withdrawing** could silently clear those alerts. The user's framing: Limit and Balance should track "how much have you drawn down," not "how much have you saved."

**Fix for #2:** new `fetchSavingsWithdrawn(monthKey)` in `db/database.ts` (mirrors `fetchCategoryTotals`'s month-scoping, but `WHERE category = 'savings' AND kind = 'withdrawal'`). `BentoCard`/`BentoCardDetailModal` gained an optional `consumption?: number` prop, used for all Limit/Balance math (`rawRatio`, `isOverLimit`, `remaining`, `isOverBalance`) instead of `amount`; defaults to `amount` when omitted, so Needs/Wants and every previously-existing test/call site are unaffected. `app/(tabs)/index.tsx` fetches `savingsWithdrawn` alongside `totals` and passes it as `consumption` only to the Savings card/modal.

Per the user's explicit ask ("the saving should reflect how much was saved and how much was used, both are needed"), the detail sheet doesn't just silently fix the math — when `consumption` is provided it swaps the single "Spent This Month" row for **Net saved this month** / **Deposited** / **Withdrawn** (`card.netSaved`/`card.deposited`/`card.withdrawn`, en/fr). `Deposited` is derived (`amount + consumption`) rather than a third query, since net = deposited − withdrawn.

**Fix for #1:** `ExpenseInput.tsx`'s `renderPreview()` gained an inline Deposit/Withdrawal chip, shown whenever `mode === 'fast' && category === 'savings'`, directly in the always-visible preview row (not gated behind the override panel) — tappable to flip `kind` instantly. Since this now covers Fast mode's need, the override panel's own copy of the toggle (which used to render for Fast mode too) was removed to avoid two controls for the same state being visible at once; Detailed mode's in-form toggle is untouched. Clearing the Fast-mode field mid-typing now also resets `kind` to `'deposit'`, matching the same "brand-new entry" reset already applied to `overridden`/`showOverride`.

Both fixes were scoped via `AskUserQuestion` before implementation — the user picked the inline-chip treatment over an auto-expanding panel or a submit-time confirmation step, and picked the Deposited/Withdrawn breakdown over a silent calculation-only fix.

See [[open-issues]], [[2026-09-02-session]].

## Related notes
- [[account-aware-budgeting]] — the precedent this pattern follows (dedicated entity table over extending `category_balance`)
- [[category-balance-schema]] — the fixed-enum pattern both `accounts` and `goals` diverge from
- [[sqlite-schema-migration]]
- [[APIs]]
