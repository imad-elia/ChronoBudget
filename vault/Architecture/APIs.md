# APIs & External Services

## External APIs

None. ChronoBudget is fully offline. No HTTP requests, no authentication, no analytics, no crash reporting.

## Environment variables

None. No `.env` files are used.

## SQLite storage backend (platform-split)

- **Native:** persistent file `chronobudget.db`, WAL journal mode.
- **Web:** in-memory database (`:memory:`), default journal mode. Web data resets on reload — it's a dev-preview target only. See [[web-inmemory-db]].

`PRAGMA foreign_keys = ON` is set on every open, on both platforms.

`getDb()` opens the connection **and runs migrations** as one memoized promise (`openAndMigrate`), so every helper waits for a fully-migrated schema. `initDb()` is just `await getDb()`.

## SQLite schema (schema version 8)

Nine tables. `transactions` is the only one the budget-category totals ever read — `transfers` deliberately sits outside it (see [[account-aware-budgeting]]).

### `transactions`

```sql
CREATE TABLE transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  amount      REAL    NOT NULL CHECK(amount > 0),
  category    TEXT    NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
  note        TEXT    NOT NULL DEFAULT '',
  timestamp   INTEGER NOT NULL DEFAULT (unixepoch()),
  subcategory TEXT    NOT NULL DEFAULT '',                  -- v3
  account_id  INTEGER REFERENCES accounts(id),              -- v7, nullable
  goal_id     INTEGER REFERENCES goals(id)                  -- v8, nullable
);

CREATE INDEX idx_transactions_category  ON transactions(category);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
```

`timestamp` is stored in **milliseconds** (JS `Date.now()`), not seconds — every query that buckets by date divides by 1000 first. `goal_id` is only meaningful when `category = 'savings'`; that rule is enforced in the UI, not the DB.

### `budget_limits`

```sql
CREATE TABLE budget_limits (
  category TEXT PRIMARY KEY CHECK(category IN ('needs', 'wants', 'savings')),
  amount   REAL NOT NULL CHECK(amount > 0)
);
```

### `app_settings`

```sql
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Known keys:
- `onboarding_complete` — `'1'` once the user has finished or skipped onboarding
- `input_mode` — `'fast'` or `'detailed'`
- `country` — ISO country code; drives locale, currency, symbol and decimals
- `language` — `'en'` or `'fr'`. Written only by an explicit `setLanguage()`; its *absence* is what lets `setCountry()` default the language on a genuine first pick. See [[localization]].

### `keyword_learn` (v4)

```sql
CREATE TABLE keyword_learn (
  keyword     TEXT PRIMARY KEY,
  category    TEXT NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
  subcategory TEXT NOT NULL DEFAULT '',
  count       INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Learned keyword → category/subcategory mappings for the smart input classifier. Keys are stored trimmed and lowercased. See [[smart-input-classifier]].

### `recurring` (v5)

```sql
CREATE TABLE recurring (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  amount      REAL    NOT NULL CHECK(amount > 0),
  category    TEXT    NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
  subcategory TEXT    NOT NULL DEFAULT '',
  note        TEXT    NOT NULL DEFAULT '',
  frequency   TEXT    NOT NULL CHECK(frequency IN ('weekly', 'monthly', 'yearly')),
  next_run    INTEGER NOT NULL,                             -- next due timestamp (ms)
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  account_id  INTEGER REFERENCES accounts(id)               -- v7, nullable
);
```

Day-of-month/weekday is implicit in `next_run` (no anchor column), which also doubles as the custom start-date seed. No `goal_id` — recurring goal tagging is a known v1 gap. See [[recurring-transactions]].

### `category_balance` (v6)

```sql
CREATE TABLE category_balance (
  category TEXT PRIMARY KEY CHECK(category IN ('needs', 'wants', 'savings')),
  amount   REAL NOT NULL CHECK(amount >= 0)
);
```

Optional one-time starting money per category. A category with no row shows no "Remaining" line. See [[category-balance-schema]].

### `accounts` and `transfers` (v7)

```sql
CREATE TABLE accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  balance    REAL    NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE transfers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  from_account INTEGER NOT NULL REFERENCES accounts(id),
  to_account   INTEGER NOT NULL REFERENCES accounts(id),
  amount       REAL    NOT NULL CHECK(amount > 0),
  note         TEXT    NOT NULL DEFAULT '',
  timestamp    INTEGER NOT NULL DEFAULT (unixepoch())
);
```

`accounts.balance` is a **running total maintained by application code**, not a computed view — every write path that touches an account adjusts it inside the same `withTransactionAsync` block. See [[account-aware-budgeting]].

### `goals` (v8)

```sql
CREATE TABLE goals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  target_amount  REAL    NOT NULL,
  current_amount REAL    NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
```

`current_amount` is a running total, same pattern as `accounts.balance`, and only ever moves through tagged transactions — there is no direct "set balance" path. Note `target_amount` is the one money column with **no `CHECK` constraint**; it is guarded in `insertGoal`/`updateGoal` instead, deliberately. See [[savings-goals-schema]].

## Migration history

| Version | Change |
|---------|--------|
| v1 | Drop + recreate `transactions` with the category column and indexes (**destructive** — dev-safe at the time) |
| v2 | Create `budget_limits` |
| v3 | `ALTER TABLE transactions ADD COLUMN subcategory`; create `app_settings` |
| v4 | Create `keyword_learn` (smart-input learning) |
| v5 | Create `recurring` |
| v6 | Create `category_balance` (starting balances) |
| v7 | Create `accounts` + `transfers`; add nullable `account_id` to `transactions` and `recurring` |
| v8 | Create `goals`; add nullable `goal_id` to `transactions` |

Migration strategy: incremental `if (user_version < N)` blocks in `openAndMigrate()`, then a single `PRAGMA user_version = SCHEMA_VERSION` at the end. v1 is destructive; v2–v8 are all additive. Idempotency is covered by a test that re-runs `openAndMigrate()` against an already-migrated database. See [[sqlite-schema-migration]].

## DB functions (`db/database.ts`)

### Lifecycle

| Function | Description |
|----------|-------------|
| `openAndMigrate()` | Open the connection, set WAL (native) and `foreign_keys`, run the migration ladder. Exported for the idempotency test. |
| `getDb()` | Memoized `openAndMigrate()` promise — every helper awaits this. |
| `initDb()` | `await getDb()`. Called once from the Dashboard's mount effect. |

### Settings

| Function | Description |
|----------|-------------|
| `getSetting(key)` | Read from `app_settings`; `null` when absent. |
| `setSetting(key, value)` | Upsert into `app_settings`. |

### Transactions

| Function | Description |
|----------|-------------|
| `insertTransaction(amount, category, subcategory, note, accountId?, goalId?)` | Insert, and atomically debit the account / credit the goal when tagged. |
| `updateTransaction(id, fields)` | Reverses the previous row's effect on its account and goal, then applies the new one — handles amount changes, re-tagging and untagging. Does **not** change `timestamp`. |
| `insertTransactionsBulk(rows)` | Bulk insert in one transaction (CSV import). Carries no account/goal tags — the export format has no such columns — and performs no de-duplication. |
| `deleteTransaction(id)` | Delete, reversing the account and goal effects. |
| `currentMonthKey()` | `'YYYY-MM'` for the current **local** month. |
| `fetchCategoryTotals(monthKey?)` | SUM per category, scoped to `currentMonthKey()` by default; pass `null` for all-time. |
| `fetchRecentTransactions(limit = 20)` | Latest N, newest first. |
| `fetchTransactions(limit = 500, category?)` | Filtered fetch for History. |

### Limits and starting balances

| Function | Description |
|----------|-------------|
| `fetchLimits()` / `setLimit(category, amount)` | `amount <= 0` **deletes** the row rather than storing a zero. |
| `fetchBalances()` / `setBalance(category, amount)` | Same delete-on-`<= 0` convention. Returns a `Partial<Record<Category, number>>` — an absent key means no balance set. |

### Accounts, goals and transfers

| Function | Description |
|----------|-------------|
| `fetchAccounts()` / `insertAccount(name, initialBalance)` / `updateAccount(id, name)` | Rename only — balance is never edited directly. |
| `deleteAccount(id)` | Returns `false` (no-op) when the account is still referenced by a transaction, a recurring rule **or a transfer**; `true` when deleted. Any future table with an FK to `accounts` must be added to this guard. |
| `fetchGoals()` / `insertGoal(name, targetAmount)` / `updateGoal(id, name, targetAmount)` | Both writers throw on a non-positive `targetAmount` — the schema has no `CHECK` for it. |
| `deleteGoal(id)` | Returns `false` when still referenced by a transaction, `true` when deleted. |
| `fetchTransfers(limit = 50)` / `insertTransfer(from, to, amount, note)` | Debit, credit and record atomically. Transfers never reach `transactions`, so they are automatically excluded from every category total. |

### Recurring

| Function | Description |
|----------|-------------|
| `fetchRecurring()` | All rules (`next_run` aliased to `nextRun`), ordered by next due. |
| `insertRecurring(rule)` | `next_run` seeds from `rule.startDate` if given, else `now`. A past `startDate` catches up on the next `processRecurring()`; a future one simply waits. |
| `updateRecurring(id, fields)` / `deleteRecurring(id)` | Edit / remove. Deleting a rule leaves already-posted transactions intact. |
| `processRecurring()` | Catch-up pass: posts one transaction per due/missed occurrence — each with the occurrence's own timestamp so it lands in the right month — applies the account debit per occurrence, advances `next_run` past now, and returns the number inserted. Called from the Dashboard mount effect *before* the first fetch. |

### Trends

| Function | Description |
|----------|-------------|
| `fetchMonthlyTotals(range: number \| 'all' \| { startMonth, endMonth } = 6)` | SUM per category grouped by calendar month, zero-filled for the covered months. `'all'` anchors to `MIN(timestamp)`'s local month instead of a fixed lookback (`[]` when there are no transactions). `{ startMonth: 'YYYY-MM', endMonth: 'YYYY-MM' }` (2026-09-02) is an explicit inclusive window unrelated to "now" — powers Trends' drill-down into a specific past year or quarter. Buckets with `'localtime'` so it agrees with `fetchCategoryTotals()` — see the note below. |
| `fetchQuarterlyTotals(quarters = 12)` | Same shape as `fetchMonthlyTotals`, bucketed by quarter (2026-09-02) — `QuarterlyTotal { quarter: 'YYYY-Q1', ... }`. Backs Trends' 3Y range (12 quarterly bars instead of 36 monthly ones). |
| `fetchYearlyTotals(range: number \| 'all' = 5)` | Same shape again, bucketed by year (2026-09-02) — `YearlyTotal { year: 'YYYY', ... }`. Backs Trends' 5Y/All ranges. `'all'` anchors to `MIN(timestamp)`'s year, same convention as `fetchMonthlyTotals('all')`. |

## Date bucketing — a standing gotcha

All month/quarter/year-bucketing queries must use `strftime('%Y-%m', datetime(timestamp / 1000, 'unixepoch', 'localtime'))` (or the `%Y`-only / quarter-computed variants of it). Without the `'localtime'` modifier SQLite buckets in UTC while the JS side (`currentMonthKey()`, and the bucket-key arrays `fetchMonthlyTotals`/`fetchQuarterlyTotals`/`fetchYearlyTotals` build) uses local-time `Date` parts, so the two silently disagree near a boundary in any non-UTC timezone. This has been fixed twice — once in `fetchCategoryTotals` (2026-07-27) and once in `fetchMonthlyTotals` (2026-08-29) — and the two newer functions (2026-09-02) were written with it from the start. Any new date-bucketing query needs the same modifier. See [[open-issues]].

## Formatting, i18n and classification helpers (not DB)

| Module | Exports |
|--------|---------|
| `lib/format.ts` | `formatCurrency`, `formatCompactCurrency`, `formatNumber`, `formatDate` — driven by the store's locale/currency, with a manual fallback when `Intl` throws. |
| `lib/i18n.ts` | `t(key, vars?)`, `setActiveLocale(locale)`, `getActiveLocale()`. `t()` reads a module-level variable, which is why locale-aware screens must subscribe to a store field to force a re-render. |
| `lib/detectCategory.ts` | `parseEntry`, `detectCategory`, `learnKey` (pure). Exact matches beat the stemming/Levenshtein fuzzy fallback. |
| `lib/recurrence.ts` | `advance(ts, freq)` — month-end-clamped, strictly increasing. |
| `lib/csv.ts` | `parseCsv(text)` → `{ rows, skipped }`. Round-trip parser for this app's own export format only; malformed rows are counted and skipped, never fatal. |
| `constants/countries.ts` | `COUNTRIES`, `DEFAULT_COUNTRY`, `findCountry(code)`. |
| `constants/subcategories.ts` | `SUBCATEGORIES` (canonical English, DB-stored), `subcategoryLabel(s)` (display translation only). |
| `constants/keywordMap.ts` | `getActiveKeywordMap()` — a live accessor, not a frozen constant, so it follows language changes at runtime. |
| `constants/keywords/index.ts` | `KEYWORD_MAPS`, `getKeywordMap(language)`. English and French only. |

## Related notes

- [[DataFlow]] — when each function is called
- [[Components]] — the files that call them
- [[Overview]] — why there are no external APIs
- [[sqlite-schema-migration]], [[account-aware-budgeting]], [[savings-goals-schema]], [[category-balance-schema]]
