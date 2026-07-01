import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import type { Category, Transaction, CategoryTotals, CategoryLimits, MonthlyTotal } from '../store/useBudgetStore';

// Native uses a persistent on-disk SQLite file. Web uses an in-memory database:
// expo-sqlite's web backend persists via the Origin Private File System (OPFS),
// whose SyncAccessHandle locking is fragile in dev (worker/HMR crashes leave the
// file locked, causing unrecoverable "sqlite3_open_v2" / "createSyncAccessHandle"
// errors). Web is a dev-preview target only — the product is the mobile app — so
// an in-memory DB (no OPFS, no locks, no corruption) is the right trade-off.
// Tradeoff: web data resets on page reload.
const DB_NAME = Platform.OS === 'web' ? ':memory:' : 'chronobudget.db';

const SCHEMA_VERSION = 4;

// Open the connection AND run migrations as one atomic operation, then memoize
// the resulting promise. Because every DB helper calls getDb(), this guarantees
// the schema is fully migrated before any query runs — even helpers that fire
// independently of initDb() (e.g. ExpenseInput reading 'input_mode' on mount).
// Previously migrations lived in initDb() while getDb() only opened the file, so
// a query could hit a not-yet-created table. On native the tables persisted on
// disk and hid the race; the in-memory web DB starts empty and exposed it.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
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

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function insertTransaction(
  amount: number,
  category: Category,
  subcategory: string,
  note: string,
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO transactions (amount, category, subcategory, note, timestamp) VALUES (?, ?, ?, ?, ?)',
    amount,
    category,
    subcategory.trim(),
    note.trim(),
    Date.now(),
  );
}

export async function deleteTransaction(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function fetchCategoryTotals(): Promise<CategoryTotals> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ category: Category; total: number }>(
    `SELECT category, COALESCE(SUM(amount), 0) AS total
     FROM transactions
     GROUP BY category`,
  );
  const totals: CategoryTotals = { needs: 0, wants: 0, savings: 0 };
  for (const row of rows) {
    totals[row.category] = row.total;
  }
  return totals;
}

export async function fetchRecentTransactions(limit = 20): Promise<Transaction[]> {
  const database = await getDb();
  return database.getAllAsync<Transaction>(
    `SELECT id, amount, category, subcategory, note, timestamp
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
      `SELECT id, amount, category, subcategory, note, timestamp
       FROM transactions
       WHERE category = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      category,
      limit,
    );
  }
  return database.getAllAsync<Transaction>(
    `SELECT id, amount, category, subcategory, note, timestamp
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

// ─── Monthly totals (for Trends screen) ──────────────────────────────────────

export async function fetchMonthlyTotals(months = 6): Promise<MonthlyTotal[]> {
  const database = await getDb();

  // Build a list of the last N months as 'YYYY-MM' strings
  const monthKeys: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const rows = await database.getAllAsync<{ month: string; category: Category; total: number }>(
    `SELECT
       strftime('%Y-%m', datetime(timestamp / 1000, 'unixepoch')) AS month,
       category,
       SUM(amount) AS total
     FROM transactions
     WHERE strftime('%Y-%m', datetime(timestamp / 1000, 'unixepoch')) >= ?
     GROUP BY month, category
     ORDER BY month ASC`,
    monthKeys[0],
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
