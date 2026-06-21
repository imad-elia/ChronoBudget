import * as SQLite from 'expo-sqlite';
import type { Category, Transaction, CategoryTotals } from '../store/useBudgetStore';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('chronobudget.db');
  }
  return db;
}

export async function initDb(): Promise<void> {
  const database = await getDb();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS transactions (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      amount    REAL    NOT NULL CHECK(amount > 0),
      category  TEXT    NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
      note      TEXT    NOT NULL DEFAULT '',
      timestamp INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_category
      ON transactions(category);

    CREATE INDEX IF NOT EXISTS idx_transactions_timestamp
      ON transactions(timestamp DESC);
  `);
}

export async function insertTransaction(
  amount: number,
  category: Category,
  note: string,
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO transactions (amount, category, note, timestamp) VALUES (?, ?, ?, ?)',
    amount,
    category,
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
    `SELECT id, amount, category, note, timestamp
     FROM transactions
     ORDER BY timestamp DESC
     LIMIT ?`,
    limit,
  );
}
