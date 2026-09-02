import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import type { Category, Transaction, CategoryTotals, CategoryLimits, MonthlyTotal, QuarterlyTotal, YearlyTotal, RecurringRule, Frequency, Account, Transfer, Goal, TransactionKind } from '../store/useBudgetStore';
import { advance } from '../lib/recurrence';

// Native uses a persistent on-disk SQLite file. Web uses an in-memory database:
// expo-sqlite's web backend persists via the Origin Private File System (OPFS),
// whose SyncAccessHandle locking is fragile in dev (worker/HMR crashes leave the
// file locked, causing unrecoverable "sqlite3_open_v2" / "createSyncAccessHandle"
// errors). Web is a dev-preview target only — the product is the mobile app — so
// an in-memory DB (no OPFS, no locks, no corruption) is the right trade-off.
// Tradeoff: web data resets on page reload.
const DB_NAME = Platform.OS === 'web' ? ':memory:' : 'chronobudget.db';

const SCHEMA_VERSION = 9;

// Open the connection AND run migrations as one atomic operation, then memoize
// the resulting promise. Because every DB helper calls getDb(), this guarantees
// the schema is fully migrated before any query runs — even helpers that fire
// independently of initDb() (e.g. ExpenseInput reading 'input_mode' on mount).
// Previously migrations lived in initDb() while getDb() only opened the file, so
// a query could hit a not-yet-created table. On native the tables persisted on
// disk and hid the race; the in-memory web DB starts empty and exposed it.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DB_NAME);

  // WAL needs a shared-memory (-shm) sidecar that only makes sense for an on-disk
  // DB. Skip it for the in-memory web DB.
  if (Platform.OS !== 'web') {
    await database.execAsync('PRAGMA journal_mode = WAL;');
  }
  await database.execAsync('PRAGMA foreign_keys = ON;');

  const [{ user_version }] = await database.getAllAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );

  if (user_version < 1) {
    await database.execAsync(`
      DROP TABLE IF EXISTS transactions;

      CREATE TABLE transactions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        amount      REAL    NOT NULL CHECK(amount > 0),
        category    TEXT    NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
        note        TEXT    NOT NULL DEFAULT '',
        timestamp   INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX idx_transactions_category  ON transactions(category);
      CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
    `);
  }

  if (user_version < 2) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS budget_limits (
        category TEXT PRIMARY KEY CHECK(category IN ('needs', 'wants', 'savings')),
        amount   REAL NOT NULL CHECK(amount > 0)
      );
    `);
  }

  if (user_version < 3) {
    await database.execAsync(`
      ALTER TABLE transactions ADD COLUMN subcategory TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS app_settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  if (user_version < 4) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS keyword_learn (
        keyword     TEXT PRIMARY KEY,
        category    TEXT NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
        subcategory TEXT NOT NULL DEFAULT '',
        count       INTEGER NOT NULL DEFAULT 1,
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
  }

  if (user_version < 5) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        amount      REAL    NOT NULL CHECK(amount > 0),
        category    TEXT    NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
        subcategory TEXT    NOT NULL DEFAULT '',
        note        TEXT    NOT NULL DEFAULT '',
        frequency   TEXT    NOT NULL CHECK(frequency IN ('weekly', 'monthly', 'yearly')),
        next_run    INTEGER NOT NULL,
        active      INTEGER NOT NULL DEFAULT 1,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
  }

  if (user_version < 6) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS category_balance (
        category TEXT PRIMARY KEY CHECK(category IN ('needs', 'wants', 'savings')),
        amount   REAL NOT NULL CHECK(amount >= 0)
      );
    `);
  }

  if (user_version < 7) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        balance     REAL    NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );

      ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id);
      ALTER TABLE recurring    ADD COLUMN account_id INTEGER REFERENCES accounts(id);

      CREATE TABLE IF NOT EXISTS transfers (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        from_account   INTEGER NOT NULL REFERENCES accounts(id),
        to_account     INTEGER NOT NULL REFERENCES accounts(id),
        amount         REAL    NOT NULL CHECK(amount > 0),
        note           TEXT    NOT NULL DEFAULT '',
        timestamp      INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
  }

  if (user_version < 8) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS goals (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL,
        target_amount   REAL    NOT NULL,
        current_amount  REAL    NOT NULL DEFAULT 0,
        created_at      INTEGER NOT NULL DEFAULT (unixepoch())
      );

      ALTER TABLE transactions ADD COLUMN goal_id INTEGER REFERENCES goals(id);
    `);
  }

  if (user_version < 9) {
    // Savings transactions had no direction: every row was implicitly "money
    // added". 'kind' distinguishes a deposit (grows the category total / a
    // tagged goal's progress) from a withdrawal (shrinks them) — see
    // [[savings-goals-schema]]. Meaningful only for category = 'savings';
    // Needs/Wants rows keep the default and are never shown a way to change it.
    // No CHECK constraint (see the ALTER-CHECK precedent in the goals migration
    // above) — validated in application code instead.
    await database.execAsync(`
      ALTER TABLE transactions ADD COLUMN kind TEXT NOT NULL DEFAULT 'deposit';
    `);
  }

  await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);

  return database;
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

// Kept for the explicit call in the Dashboard's mount effect. Now simply ensures
// the DB is opened and migrated (all the real work lives in openAndMigrate).
export async function initDb(): Promise<void> {
  await getDb();
}

// ─── App settings ─────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    key,
  );
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

// ─── Learned keywords (smart input) ─────────────────────────────────────────────

export async function fetchLearnedKeywords(): Promise<
  Record<string, { category: Category; subcategory: string }>
> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    keyword: string;
    category: Category;
    subcategory: string;
  }>('SELECT keyword, category, subcategory FROM keyword_learn');
  const map: Record<string, { category: Category; subcategory: string }> = {};
  for (const r of rows) {
    map[r.keyword] = { category: r.category, subcategory: r.subcategory };
  }
  return map;
}

export async function learnKeyword(
  keyword: string,
  category: Category,
  subcategory: string,
): Promise<void> {
  const key = keyword.trim().toLowerCase();
  if (!key) return;
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO keyword_learn (keyword, category, subcategory, count, updated_at)
     VALUES (?, ?, ?, 1, unixepoch())
     ON CONFLICT(keyword) DO UPDATE SET
       category    = excluded.category,
       subcategory = excluded.subcategory,
       count       = count + 1,
       updated_at  = excluded.updated_at`,
    key,
    category,
    subcategory,
  );
}

export async function deleteLearnedKeyword(keyword: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM keyword_learn WHERE keyword = ?', keyword.trim().toLowerCase());
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function insertTransaction(
  amount: number,
  category: Category,
  subcategory: string,
  note: string,
  accountId?: number | null,
  goalId?: number | null,
  kind: TransactionKind = 'deposit',
): Promise<void> {
  const database = await getDb();
  // A withdrawal reverses the usual "money leaves the account, joins the
  // goal/category" direction — it's money coming back OUT of savings.
  const delta = kind === 'withdrawal' ? -amount : amount;
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'INSERT INTO transactions (amount, category, subcategory, note, timestamp, account_id, goal_id, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      amount,
      category,
      subcategory.trim(),
      note.trim(),
      Date.now(),
      accountId ?? null,
      goalId ?? null,
      kind,
    );
    if (accountId) {
      await database.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', delta, accountId);
    }
    if (goalId) {
      await database.runAsync('UPDATE goals SET current_amount = current_amount + ? WHERE id = ?', delta, goalId);
    }
  });
}

export async function updateTransaction(
  id: number,
  fields: {
    amount: number;
    category: Category;
    subcategory: string;
    note: string;
    accountId?: number | null;
    goalId?: number | null;
    kind?: TransactionKind;
  },
): Promise<void> {
  const database = await getDb();
  const nextKind = fields.kind ?? 'deposit';
  await database.withTransactionAsync(async () => {
    const [prev] = await database.getAllAsync<{ amount: number; account_id: number | null; goal_id: number | null; kind: TransactionKind }>(
      'SELECT amount, account_id, goal_id, kind FROM transactions WHERE id = ?',
      id,
    );
    const nextAccountId = fields.accountId ?? null;
    const nextGoalId = fields.goalId ?? null;
    const prevDelta = prev ? (prev.kind === 'withdrawal' ? -prev.amount : prev.amount) : 0;
    const nextDelta = nextKind === 'withdrawal' ? -fields.amount : fields.amount;

    // Reverse the previous transaction's effect on its account/goal, then apply
    // the new one — handles amount/kind changes, account/goal changes, and removal.
    if (prev?.account_id) {
      await database.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', prevDelta, prev.account_id);
    }
    if (nextAccountId) {
      await database.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', nextDelta, nextAccountId);
    }
    if (prev?.goal_id) {
      await database.runAsync('UPDATE goals SET current_amount = current_amount - ? WHERE id = ?', prevDelta, prev.goal_id);
    }
    if (nextGoalId) {
      await database.runAsync('UPDATE goals SET current_amount = current_amount + ? WHERE id = ?', nextDelta, nextGoalId);
    }

    await database.runAsync(
      `UPDATE transactions
       SET amount = ?, category = ?, subcategory = ?, note = ?, account_id = ?, goal_id = ?, kind = ?
       WHERE id = ?`,
      fields.amount,
      fields.category,
      fields.subcategory.trim(),
      fields.note.trim(),
      nextAccountId,
      nextGoalId,
      nextKind,
      id,
    );
  });
}

// Bulk-inserts imported transactions in one DB transaction (CSV round-trip
// import — see lib/csv.ts). None of these carry an account tag: the exported
// CSV format has no account column.
export async function insertTransactionsBulk(
  rows: { amount: number; category: Category; subcategory: string; note: string; timestamp: number }[],
): Promise<void> {
  if (rows.length === 0) return;
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    for (const row of rows) {
      await database.runAsync(
        'INSERT INTO transactions (amount, category, subcategory, note, timestamp) VALUES (?, ?, ?, ?, ?)',
        row.amount,
        row.category,
        row.subcategory.trim(),
        row.note.trim(),
        row.timestamp,
      );
    }
  });
}

export async function deleteTransaction(id: number): Promise<void> {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    const [prev] = await database.getAllAsync<{ amount: number; account_id: number | null; goal_id: number | null; kind: TransactionKind }>(
      'SELECT amount, account_id, goal_id, kind FROM transactions WHERE id = ?',
      id,
    );
    const delta = prev ? (prev.kind === 'withdrawal' ? -prev.amount : prev.amount) : 0;
    if (prev?.account_id) {
      await database.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', delta, prev.account_id);
    }
    if (prev?.goal_id) {
      await database.runAsync('UPDATE goals SET current_amount = current_amount - ? WHERE id = ?', delta, prev.goal_id);
    }
    await database.runAsync('DELETE FROM transactions WHERE id = ?', id);
  });
}

// monthKey defaults to the current month ('YYYY-MM'); pass null for all-time.
export function currentMonthKey(): string {
  const now = new Date(Date.now());
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function fetchCategoryTotals(
  monthKey: string | null = currentMonthKey(),
): Promise<CategoryTotals> {
  const database = await getDb();
  // Withdrawals subtract rather than add — this nets Savings deposits and
  // withdrawals into one figure. A no-op for Needs/Wants, which are always 'deposit'.
  const rows = await database.getAllAsync<{ category: Category; total: number }>(
    monthKey
      ? `SELECT category, COALESCE(SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END), 0) AS total
         FROM transactions
         WHERE strftime('%Y-%m', datetime(timestamp / 1000, 'unixepoch', 'localtime')) = ?
         GROUP BY category`
      : `SELECT category, COALESCE(SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END), 0) AS total
         FROM transactions
         GROUP BY category`,
    ...(monthKey ? [monthKey] : []),
  );
  const totals: CategoryTotals = { needs: 0, wants: 0, savings: 0 };
  for (const row of rows) {
    totals[row.category] = row.total;
  }
  return totals;
}

// How much has been drawn OUT of savings — the figure that Limit/Balance
// consumption should react to, as distinct from fetchCategoryTotals' net
// (deposits − withdrawals) figure that drives the headline display amount.
// Depositing grows savings (good); only withdrawing should count against a
// Savings limit or reduce a Savings starting-balance remaining.
export async function fetchSavingsWithdrawn(
  monthKey: string | null = currentMonthKey(),
): Promise<number> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ total: number }>(
    monthKey
      ? `SELECT COALESCE(SUM(amount), 0) AS total
         FROM transactions
         WHERE category = 'savings' AND kind = 'withdrawal'
           AND strftime('%Y-%m', datetime(timestamp / 1000, 'unixepoch', 'localtime')) = ?`
      : `SELECT COALESCE(SUM(amount), 0) AS total
         FROM transactions
         WHERE category = 'savings' AND kind = 'withdrawal'`,
    ...(monthKey ? [monthKey] : []),
  );
  return rows[0]?.total ?? 0;
}

export async function fetchRecentTransactions(limit = 20): Promise<Transaction[]> {
  const database = await getDb();
  return database.getAllAsync<Transaction>(
    `SELECT id, amount, category, subcategory, note, timestamp, account_id AS accountId, goal_id AS goalId, kind
     FROM transactions
     ORDER BY timestamp DESC
     LIMIT ?`,
    limit,
  );
}

export async function fetchTransactions(
  limit = 500,
  category?: Category,
): Promise<Transaction[]> {
  const database = await getDb();
  if (category) {
    return database.getAllAsync<Transaction>(
      `SELECT id, amount, category, subcategory, note, timestamp, account_id AS accountId, goal_id AS goalId, kind
       FROM transactions
       WHERE category = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      category,
      limit,
    );
  }
  return database.getAllAsync<Transaction>(
    `SELECT id, amount, category, subcategory, note, timestamp, account_id AS accountId, goal_id AS goalId, kind
     FROM transactions
     ORDER BY timestamp DESC
     LIMIT ?`,
    limit,
  );
}

// ─── Budget limits ────────────────────────────────────────────────────────────

export async function fetchLimits(): Promise<CategoryLimits> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ category: Category; amount: number }>(
    'SELECT category, amount FROM budget_limits',
  );
  const limits: CategoryLimits = { needs: 0, wants: 0, savings: 0 };
  for (const row of rows) {
    limits[row.category] = row.amount;
  }
  return limits;
}

export async function setLimit(category: Category, amount: number): Promise<void> {
  const database = await getDb();
  if (amount <= 0) {
    await database.runAsync('DELETE FROM budget_limits WHERE category = ?', category);
  } else {
    await database.runAsync(
      `INSERT INTO budget_limits (category, amount) VALUES (?, ?)
       ON CONFLICT(category) DO UPDATE SET amount = excluded.amount`,
      category,
      amount,
    );
  }
}

// ─── Starting balances ────────────────────────────────────────────────────────

// Optional one-time starting money per category. A category with no row has no
// balance set; the dashboard then shows spending only (no "Remaining" line).
export async function fetchBalances(): Promise<Partial<Record<Category, number>>> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ category: Category; amount: number }>(
    'SELECT category, amount FROM category_balance',
  );
  const balances: Partial<Record<Category, number>> = {};
  for (const row of rows) {
    balances[row.category] = row.amount;
  }
  return balances;
}

// amount <= 0 removes the balance — same convention as setLimit.
export async function setBalance(category: Category, amount: number): Promise<void> {
  const database = await getDb();
  if (amount <= 0) {
    await database.runAsync('DELETE FROM category_balance WHERE category = ?', category);
  } else {
    await database.runAsync(
      `INSERT INTO category_balance (category, amount) VALUES (?, ?)
       ON CONFLICT(category) DO UPDATE SET amount = excluded.amount`,
      category,
      amount,
    );
  }
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function fetchAccounts(): Promise<Account[]> {
  const database = await getDb();
  return database.getAllAsync<Account>('SELECT id, name, balance FROM accounts ORDER BY id ASC');
}

export async function insertAccount(name: string, initialBalance: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO accounts (name, balance) VALUES (?, ?)',
    name.trim(),
    initialBalance,
  );
}

export async function updateAccount(id: number, name: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('UPDATE accounts SET name = ? WHERE id = ?', name.trim(), id);
}

// Refuses to delete an account still referenced by a transaction, a recurring
// rule or a transfer, so historical spend never silently loses its account tag.
// Returns false (no-op) if blocked, true if deleted. The transfers check also
// keeps this guard in step with the FK constraints: transfers.from_account /
// to_account REFERENCE accounts(id) and foreign_keys is ON, so skipping it let
// the DELETE fail deep in SQLite instead of returning false.
export async function deleteAccount(id: number): Promise<boolean> {
  const database = await getDb();
  const [{ count: txCount }] = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transactions WHERE account_id = ?',
    id,
  );
  const [{ count: recurringCount }] = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM recurring WHERE account_id = ?',
    id,
  );
  const [{ count: transferCount }] = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transfers WHERE from_account = ? OR to_account = ?',
    id,
    id,
  );
  if (txCount > 0 || recurringCount > 0 || transferCount > 0) return false;

  await database.runAsync('DELETE FROM accounts WHERE id = ?', id);
  return true;
}

// ─── Savings goals ────────────────────────────────────────────────────────────

export async function fetchGoals(): Promise<Goal[]> {
  const database = await getDb();
  return database.getAllAsync<Goal>(
    `SELECT id, name, target_amount AS targetAmount, current_amount AS currentAmount
     FROM goals
     ORDER BY id ASC`,
  );
}

// goals.target_amount is the one money column with no CHECK constraint — adding
// one now would mean rebuilding a table that transactions.goal_id references,
// which is not worth the risk. Guarding here instead gives the same protection:
// a non-positive target divides by zero in ProgressBar's fill maths.
function assertPositiveTarget(targetAmount: number): void {
  if (!(targetAmount > 0)) {
    throw new Error('CHECK constraint failed: goals.target_amount must be > 0');
  }
}

export async function insertGoal(name: string, targetAmount: number): Promise<void> {
  assertPositiveTarget(targetAmount);
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO goals (name, target_amount) VALUES (?, ?)',
    name.trim(),
    targetAmount,
  );
}

export async function updateGoal(id: number, name: string, targetAmount: number): Promise<void> {
  assertPositiveTarget(targetAmount);
  const database = await getDb();
  await database.runAsync(
    'UPDATE goals SET name = ?, target_amount = ? WHERE id = ?',
    name.trim(),
    targetAmount,
    id,
  );
}

// Refuses to delete a goal still referenced by a transaction, so historical
// savings never silently lose their goal tag. Returns false (no-op) if
// blocked, true if deleted — same convention as deleteAccount.
export async function deleteGoal(id: number): Promise<boolean> {
  const database = await getDb();
  const [{ count: txCount }] = await database.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transactions WHERE goal_id = ?',
    id,
  );
  if (txCount > 0) return false;

  await database.runAsync('DELETE FROM goals WHERE id = ?', id);
  return true;
}

// ─── Transfers ────────────────────────────────────────────────────────────────

export async function fetchTransfers(limit = 50): Promise<Transfer[]> {
  const database = await getDb();
  return database.getAllAsync<Transfer>(
    `SELECT id, from_account AS fromAccount, to_account AS toAccount, amount, note, timestamp
     FROM transfers
     ORDER BY timestamp DESC
     LIMIT ?`,
    limit,
  );
}

// Moves money between two accounts: debits fromAccount, credits toAccount,
// and records the transfer — all atomically. Transfers live outside the
// `transactions` table entirely, so they never count toward budget-category
// totals (fetchCategoryTotals/fetchMonthlyTotals only ever query transactions).
export async function insertTransfer(
  fromAccount: number,
  toAccount: number,
  amount: number,
  note: string,
): Promise<void> {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    await database.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', amount, fromAccount);
    await database.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', amount, toAccount);
    await database.runAsync(
      'INSERT INTO transfers (from_account, to_account, amount, note, timestamp) VALUES (?, ?, ?, ?, ?)',
      fromAccount,
      toAccount,
      amount,
      note.trim(),
      Date.now(),
    );
  });
}

// ─── Recurring transactions ──────────────────────────────────────────────────

export async function fetchRecurring(): Promise<RecurringRule[]> {
  const database = await getDb();
  return database.getAllAsync<RecurringRule>(
    `SELECT id, amount, category, subcategory, note, frequency, next_run AS nextRun, active, account_id AS accountId
     FROM recurring
     ORDER BY next_run ASC`,
  );
}

export async function insertRecurring(rule: {
  amount: number;
  category: Category;
  subcategory: string;
  note: string;
  frequency: Frequency;
  // Optional custom anchor date; defaults to now so the first occurrence
  // posts on the next processRecurring(). A past startDate is allowed and
  // simply catches up via processRecurring()'s existing due-occurrence loop.
  startDate?: number;
  accountId?: number | null;
}): Promise<void> {
  const database = await getDb();
  const nextRun = rule.startDate ?? Date.now();
  await database.runAsync(
    `INSERT INTO recurring (amount, category, subcategory, note, frequency, next_run, created_at, account_id)
     VALUES (?, ?, ?, ?, ?, ?, unixepoch(), ?)`,
    rule.amount,
    rule.category,
    rule.subcategory.trim(),
    rule.note.trim(),
    rule.frequency,
    nextRun,
    rule.accountId ?? null,
  );
}

export async function updateRecurring(
  id: number,
  fields: {
    amount: number;
    category: Category;
    subcategory: string;
    note: string;
    frequency: Frequency;
    accountId?: number | null;
  },
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `UPDATE recurring
     SET amount = ?, category = ?, subcategory = ?, note = ?, frequency = ?, account_id = ?
     WHERE id = ?`,
    fields.amount,
    fields.category,
    fields.subcategory.trim(),
    fields.note.trim(),
    fields.frequency,
    fields.accountId ?? null,
    id,
  );
}

export async function deleteRecurring(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM recurring WHERE id = ?', id);
}

// Catch-up pass: for every active rule whose next_run is due, post one real
// transaction per missed occurrence (with the occurrence's own timestamp so it
// lands in the correct month for Trends), then advance next_run past now.
// Returns the number of transactions inserted so the caller can trigger a refresh.
export async function processRecurring(): Promise<number> {
  const database = await getDb();
  const now = Date.now();
  const due = await database.getAllAsync<{
    id: number;
    amount: number;
    category: Category;
    subcategory: string;
    note: string;
    frequency: Frequency;
    next_run: number;
    account_id: number | null;
  }>('SELECT * FROM recurring WHERE active = 1 AND next_run <= ?', now);

  let inserted = 0;
  await database.withTransactionAsync(async () => {
    for (const rule of due) {
      let run = rule.next_run;
      // advance() is strictly increasing, so this loop always terminates.
      while (run <= now) {
        await database.runAsync(
          'INSERT INTO transactions (amount, category, subcategory, note, timestamp, account_id) VALUES (?, ?, ?, ?, ?, ?)',
          rule.amount,
          rule.category,
          rule.subcategory,
          rule.note,
          run,
          rule.account_id,
        );
        if (rule.account_id) {
          await database.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', rule.amount, rule.account_id);
        }
        inserted += 1;
        run = advance(run, rule.frequency);
      }
      await database.runAsync('UPDATE recurring SET next_run = ? WHERE id = ?', run, rule.id);
    }
  });

  return inserted;
}

// ─── Monthly totals (for Trends screen) ──────────────────────────────────────

export type MonthlyRange = number | 'all' | { startMonth: string; endMonth: string };

export async function fetchMonthlyTotals(range: MonthlyRange = 6): Promise<MonthlyTotal[]> {
  const database = await getDb();
  const now = new Date();

  let monthKeys: string[];
  if (typeof range === 'object') {
    // Drill-down: an explicit inclusive month window (e.g. one past year's 12
    // months, or one quarter's 3 months) — not anchored to "now" at all, so
    // this branch doesn't touch the months-back logic below.
    monthKeys = [];
    const [startYear, startMonth] = range.startMonth.split('-').map(Number);
    const [endYear, endMonth] = range.endMonth.split('-').map(Number);
    let d = new Date(startYear, startMonth - 1, 1);
    const end = new Date(endYear, endMonth - 1, 1);
    while (d <= end) {
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  } else {
    let months: number;
    if (range === 'all') {
      // Anchor "all" to the earliest transaction's local month instead of a
      // fixed lookback, same local-time convention as `now` below (plain Date
      // accessors, no UTC) so it lines up with the 'localtime' bucketing in
      // the query further down.
      const [{ minTs }] = await database.getAllAsync<{ minTs: number | null }>(
        'SELECT MIN(timestamp) AS minTs FROM transactions',
      );
      if (minTs == null) return [];
      const earliest = new Date(minTs);
      months =
        (now.getFullYear() - earliest.getFullYear()) * 12 +
        (now.getMonth() - earliest.getMonth()) +
        1;
    } else {
      months = range;
    }

    // Build a list of the last N months as 'YYYY-MM' strings
    monthKeys = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  // 'localtime' matters: monthKeys above are built from local-time Date parts,
  // and fetchCategoryTotals buckets in local time too. Without it SQLite would
  // bucket in UTC, so a transaction logged near a month boundary in a non-UTC
  // zone would land in a different month here than on the dashboard.
  const rows = await database.getAllAsync<{ month: string; category: Category; total: number }>(
    `SELECT
       strftime('%Y-%m', datetime(timestamp / 1000, 'unixepoch', 'localtime')) AS month,
       category,
       SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END) AS total
     FROM transactions
     WHERE strftime('%Y-%m', datetime(timestamp / 1000, 'unixepoch', 'localtime')) BETWEEN ? AND ?
     GROUP BY month, category
     ORDER BY month ASC`,
    monthKeys[0],
    monthKeys[monthKeys.length - 1],
  );

  // Merge into one object per month, filling zeros for missing categories
  const map = new Map<string, MonthlyTotal>();
  for (const key of monthKeys) {
    map.set(key, { month: key, needs: 0, wants: 0, savings: 0 });
  }
  for (const row of rows) {
    const entry = map.get(row.month);
    if (entry) entry[row.category] = row.total;
  }

  return Array.from(map.values());
}

export async function fetchQuarterlyTotals(quarters = 12): Promise<QuarterlyTotal[]> {
  const database = await getDb();
  const now = new Date();
  const curQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;

  // Build a list of the last N quarters as 'YYYY-Qn' strings. Same-width
  // year + single-digit quarter means these sort/compare correctly as plain
  // strings, so BETWEEN below works exactly like it does for monthKeys.
  const quarterKeys: string[] = [];
  for (let i = quarters - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), curQuarterStartMonth - i * 3, 1);
    quarterKeys.push(`${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`);
  }

  const rows = await database.getAllAsync<{ quarter: string; category: Category; total: number }>(
    `SELECT
       strftime('%Y', datetime(timestamp / 1000, 'unixepoch', 'localtime')) || '-Q' ||
         ((CAST(strftime('%m', datetime(timestamp / 1000, 'unixepoch', 'localtime')) AS INTEGER) - 1) / 3 + 1) AS quarter,
       category,
       SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END) AS total
     FROM transactions
     WHERE strftime('%Y', datetime(timestamp / 1000, 'unixepoch', 'localtime')) || '-Q' ||
         ((CAST(strftime('%m', datetime(timestamp / 1000, 'unixepoch', 'localtime')) AS INTEGER) - 1) / 3 + 1)
       BETWEEN ? AND ?
     GROUP BY quarter, category
     ORDER BY quarter ASC`,
    quarterKeys[0],
    quarterKeys[quarterKeys.length - 1],
  );

  const map = new Map<string, QuarterlyTotal>();
  for (const key of quarterKeys) {
    map.set(key, { quarter: key, needs: 0, wants: 0, savings: 0 });
  }
  for (const row of rows) {
    const entry = map.get(row.quarter);
    if (entry) entry[row.category] = row.total;
  }

  return Array.from(map.values());
}

export async function fetchYearlyTotals(range: number | 'all' = 5): Promise<YearlyTotal[]> {
  const database = await getDb();
  const now = new Date();

  let years: number;
  if (range === 'all') {
    const [{ minTs }] = await database.getAllAsync<{ minTs: number | null }>(
      'SELECT MIN(timestamp) AS minTs FROM transactions',
    );
    if (minTs == null) return [];
    const earliest = new Date(minTs);
    years = now.getFullYear() - earliest.getFullYear() + 1;
  } else {
    years = range;
  }

  const yearKeys: string[] = [];
  for (let i = years - 1; i >= 0; i--) {
    yearKeys.push(String(now.getFullYear() - i));
  }

  const rows = await database.getAllAsync<{ year: string; category: Category; total: number }>(
    `SELECT
       strftime('%Y', datetime(timestamp / 1000, 'unixepoch', 'localtime')) AS year,
       category,
       SUM(CASE WHEN kind = 'withdrawal' THEN -amount ELSE amount END) AS total
     FROM transactions
     WHERE strftime('%Y', datetime(timestamp / 1000, 'unixepoch', 'localtime')) BETWEEN ? AND ?
     GROUP BY year, category
     ORDER BY year ASC`,
    yearKeys[0],
    yearKeys[yearKeys.length - 1],
  );

  const map = new Map<string, YearlyTotal>();
  for (const key of yearKeys) {
    map.set(key, { year: key, needs: 0, wants: 0, savings: 0 });
  }
  for (const row of rows) {
    const entry = map.get(row.year);
    if (entry) entry[row.category] = row.total;
  }

  return Array.from(map.values());
}
