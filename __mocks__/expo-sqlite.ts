// Manual Jest mock for `expo-sqlite`, backed by a real in-memory SQLite engine
// (sql.js, pure WASM — no native build step). db/database.ts is exercised
// unmodified against real SQL (migrations, CHECK constraints, upserts,
// aggregation), unlike a hand-stubbed fake that would just echo back
// whatever the test expected.
// Use the pure-JS asm.js build, not the WASM build: sql.js's WASM build hits a
// known Jest incompatibility (Jest runs each test file in its own vm context,
// and V8's WebAssembly instances don't behave correctly across realms) —
// `new SQL.Database()` throws an unhelpful empty Error under jest-expo. The
// asm.js build is plain JS and has no such realm issue.
import initSqlJs, { type Database } from 'sql.js/dist/sql-asm.js';

let SQLPromise: ReturnType<typeof initSqlJs> | null = null;

function getSQL() {
  if (!SQLPromise) SQLPromise = initSqlJs();
  return SQLPromise;
}

class FakeSQLiteDatabase {
  constructor(private db: Database) {}

  async execAsync(sql: string): Promise<void> {
    this.db.run(sql);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    const bindParams = flattenParams(params);
    this.db.run(sql, bindParams as any);
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const bindParams = flattenParams(params);
    const stmt = this.db.prepare(sql);
    if (bindParams.length > 0) stmt.bind(bindParams as any);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  async withTransactionAsync(callback: () => Promise<void>): Promise<void> {
    await callback();
  }
}

// expo-sqlite's real API takes bind params either as a single array/object or
// as trailing variadic args (both used across db/database.ts). Normalize both
// shapes into a flat array for sql.js's prepare/bind.
function flattenParams(params: unknown[]): unknown[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0] as unknown[];
  }
  return params;
}

export async function openDatabaseAsync(_name: string): Promise<FakeSQLiteDatabase> {
  const SQL = await getSQL();
  return new FakeSQLiteDatabase(new SQL.Database());
}
