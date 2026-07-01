# APIs & External Services

## External APIs

None. ChronoBudget is fully offline. No HTTP requests, no authentication, no analytics.

## Environment variables

None. No `.env` files are used.

## SQLite storage backend (platform-split)

- **Native:** persistent file `chronobudget.db`, WAL journal mode.
- **Web:** in-memory database (`:memory:`), default journal mode. Web data resets on reload — it's a dev-preview target only. See [[web-inmemory-db]].

`getDb()` opens the connection **and runs migrations** as one memoized promise (`openAndMigrate`), so every helper waits for a fully-migrated schema. `initDb()` is just `await getDb()`.

## SQLite schema (schema version 5)

### `transactions`

```sql
CREATE TABLE transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  amount      REAL    NOT NULL CHECK(amount > 0),
  category    TEXT    NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
  note        TEXT    NOT NULL DEFAULT '',
  timestamp   INTEGER NOT NULL DEFAULT (unixepoch()),
  subcategory TEXT    NOT NULL DEFAULT ''   -- added in v3
);

CREATE INDEX idx_transactions_category  ON transactions(category);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
```

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
- `onboarding_complete` — `'1'` when the user has dismissed the onboarding overlay
- `input_mode` — `'fast'` or `'detailed'`
- `country` — ISO country code selected in onboarding/Settings; drives locale + currency (see [[localization]])

### `keyword_learn` (schema v4)

```sql
CREATE TABLE keyword_learn (
  keyword     TEXT PRIMARY KEY,
  category    TEXT NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
  subcategory TEXT NOT NULL DEFAULT '',
  count       INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Stores learned keyword → category/subcategory mappings for the smart input
classifier (see [[smart-input-classifier]]).

### `recurring` (schema v5)

```sql
CREATE TABLE recurring (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  amount      REAL    NOT NULL CHECK(amount > 0),
  category    TEXT    NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
  subcategory TEXT    NOT NULL DEFAULT '',
  note        TEXT    NOT NULL DEFAULT '',
  frequency   TEXT    NOT NULL CHECK(frequency IN ('weekly', 'monthly', 'yearly')),
  next_run    INTEGER NOT NULL,             -- next due timestamp (ms)
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Recurring rules that auto-generate transactions. Day-of-month/weekday is implicit
in `next_run` (no anchor column). See [[recurring-transactions]].

## Migration history

| Version | Change |
|---------|--------|
| v1 | Drop + recreate `transactions` table with category column and indexes |
| v2 | Create `budget_limits` table |
| v3 | `ALTER TABLE transactions ADD COLUMN subcategory`; create `app_settings` table |
| v4 | Create `keyword_learn` table (smart-input learning) |
| v5 | Create `recurring` table (recurring transactions) |

Migration strategy: incremental `if (user_version < N)` blocks in `initDb()`. v1 was destructive (dev-safe at the time); v2 and v3 are additive.

## DB functions (db/database.ts)

| Function | Description |
|----------|-------------|
| `initDb()` | Run migrations, set WAL mode |
| `getSetting(key)` | Read from app_settings |
| `setSetting(key, value)` | Upsert into app_settings |
| `insertTransaction(amount, category, subcategory, note)` | Insert row |
| `deleteTransaction(id)` | Delete by id |
| `fetchCategoryTotals()` | SUM per category |
| `fetchRecentTransactions(limit)` | Latest N rows |
| `fetchTransactions(limit, category?)` | Filtered fetch for History screen |
| `fetchLimits()` | All rows from budget_limits |
| `setLimit(category, amount)` | Upsert or delete limit |
| `fetchMonthlyTotals(months = 6)` | SUM per category grouped by calendar month, for the Trends screen. Returns `MonthlyTotal[]` with zero-filled gaps for the last N months. |
| `fetchLearnedKeywords()` | Load all `keyword_learn` rows into a `Record<keyword, {category, subcategory}>` for the smart-input cache. |
| `learnKeyword(keyword, category, subcategory)` | Upsert a learned keyword mapping (increments `count`). See [[smart-input-classifier]]. |
| `fetchRecurring()` | All recurring rules (`next_run` aliased to `nextRun`), ordered by next due. |
| `insertRecurring(rule)` | Create a rule with `next_run = now` (first occurrence posts on next `processRecurring`). |
| `updateRecurring(id, fields)` / `deleteRecurring(id)` | Edit / remove a rule. |
| `processRecurring()` | Catch-up pass: post one transaction per due/missed occurrence, advance `next_run` past now; returns count inserted. See [[recurring-transactions]]. |

## Formatting & i18n helpers (not DB)

- `lib/format.ts` — `formatCurrency` / `formatCompactCurrency` / `formatNumber` /
  `formatDate`, driven by the store's locale/currency (Intl + manual fallback).
- `lib/i18n.ts` — `t(key, vars)` + `setActiveLocale`; strings in `constants/i18n/en.ts`.
- `lib/detectCategory.ts` — `parseEntry` / `detectCategory` / `learnKey` (pure).
- `lib/recurrence.ts` — `advance(ts, freq)` date math (pure). See [[recurring-transactions]].
- `constants/countries.ts`, `constants/keywordMap.ts` — static data.
- See [[localization]] and [[smart-input-classifier]].

## Related notes

- [[DataFlow]] — when each function is called
- [[Overview]] — why no external APIs
