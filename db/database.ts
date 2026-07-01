import * as SQLite from 'expo-sqlite';
import type { Category, Transaction, CategoryTotals, CategoryLimits } from '../store/useBudgetStore';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('chronobudget.db');
  }
  return db;
}

const SCHEMA_VERSION = 3;

export async function initDb(): Promise<void> {
  const database = await getDb();
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

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

  await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
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
