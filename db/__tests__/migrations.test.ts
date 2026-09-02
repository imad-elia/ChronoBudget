jest.mock('expo-sqlite');

// Upgrade-path coverage. db/__tests__/database.test.ts only ever migrates a
// *fresh* database to v8; nothing exercised what actually happens on a user's
// device, which is a populated DB at an older user_version being migrated
// forward. The v1 block is destructive (DROP TABLE transactions), so getting
// this wrong loses real data.
//
// Mechanic worth understanding before editing: the expo-sqlite mock memoizes
// its sql.js Database per name, and jest.resetModules() clears that map. So a
// fixture must be seeded and migrated inside ONE module registry — require the
// mock, seed through it, then require db/database, all after the same reset.

const DB_NAME = 'chronobudget.db'; // what db/database.ts resolves to off-web

// Frozen snapshots of the schema as it shipped at each version. These are
// history and must never be "updated" to match the current schema — that would
// defeat the entire point of the test.
const V3_DDL = `
  CREATE TABLE transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    amount      REAL    NOT NULL CHECK(amount > 0),
    category    TEXT    NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
    note        TEXT    NOT NULL DEFAULT '',
    timestamp   INTEGER NOT NULL DEFAULT (unixepoch()),
    subcategory TEXT    NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_transactions_category  ON transactions(category);
  CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
  CREATE TABLE budget_limits (
    category TEXT PRIMARY KEY CHECK(category IN ('needs', 'wants', 'savings')),
    amount   REAL NOT NULL CHECK(amount > 0)
  );
  CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

const V4_DDL = `
  CREATE TABLE keyword_learn (
    keyword     TEXT PRIMARY KEY,
    category    TEXT NOT NULL CHECK(category IN ('needs', 'wants', 'savings')),
    subcategory TEXT NOT NULL DEFAULT '',
    count       INTEGER NOT NULL DEFAULT 1,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
`;

const V5_DDL = `
  CREATE TABLE recurring (
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
`;

const V6_DDL = `
  CREATE TABLE category_balance (
    category TEXT PRIMARY KEY CHECK(category IN ('needs', 'wants', 'savings')),
    amount   REAL NOT NULL CHECK(amount >= 0)
  );
`;

const V7_DDL = `
  CREATE TABLE accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    balance    REAL    NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id);
  ALTER TABLE recurring    ADD COLUMN account_id INTEGER REFERENCES accounts(id);
  CREATE TABLE transfers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    from_account INTEGER NOT NULL REFERENCES accounts(id),
    to_account   INTEGER NOT NULL REFERENCES accounts(id),
    amount       REAL    NOT NULL CHECK(amount > 0),
    note         TEXT    NOT NULL DEFAULT '',
    timestamp    INTEGER NOT NULL DEFAULT (unixepoch())
  );
`;

const DDL_BY_VERSION: Record<number, string> = {
  3: V3_DDL,
  4: V3_DDL + V4_DDL,
  5: V3_DDL + V4_DDL + V5_DDL,
  6: V3_DDL + V4_DDL + V5_DDL + V6_DDL,
  7: V3_DDL + V4_DDL + V5_DDL + V6_DDL + V7_DDL,
};

const ALL_TABLES = [
  'accounts', 'app_settings', 'budget_limits', 'category_balance',
  'goals', 'keyword_learn', 'recurring', 'transactions', 'transfers',
];

/**
 * Builds a populated database at `version`, then migrates it forward with the
 * real openAndMigrate(). Returns the freshly-required db/database module.
 */
async function seedAtVersionAndMigrate(version: number) {
  jest.resetModules();

  const SQLite = require('expo-sqlite');
  const seed = await SQLite.openDatabaseAsync(DB_NAME);
  await seed.execAsync(DDL_BY_VERSION[version]);

  // Representative user data, using only columns that existed at `version`.
  await seed.execAsync(`
    INSERT INTO transactions (amount, category, subcategory, note, timestamp)
      VALUES (25.5, 'needs', 'Groceries', 'weekly shop', 1750000000000);
    INSERT INTO transactions (amount, category, subcategory, note, timestamp)
      VALUES (9.99, 'wants', 'Dining', 'coffee', 1750100000000);
    INSERT INTO budget_limits (category, amount) VALUES ('needs', 500);
    INSERT INTO app_settings (key, value) VALUES ('country', 'FR');
    INSERT INTO app_settings (key, value) VALUES ('onboarding_complete', '1');
  `);
  if (version >= 4) {
    await seed.execAsync(
      "INSERT INTO keyword_learn (keyword, category, subcategory) VALUES ('gymbox', 'needs', 'Health');",
    );
  }
  if (version >= 5) {
    await seed.execAsync(
      `INSERT INTO recurring (amount, category, subcategory, note, frequency, next_run)
       VALUES (50, 'needs', 'Rent', 'monthly rent', 'monthly', 1760000000000);`,
    );
  }
  if (version >= 6) {
    await seed.execAsync("INSERT INTO category_balance (category, amount) VALUES ('needs', 800);");
  }
  if (version >= 7) {
    await seed.execAsync("INSERT INTO accounts (name, balance) VALUES ('Checking', 1200);");
  }
  await seed.execAsync(`PRAGMA user_version = ${version};`);

  const database = require('../database') as typeof import('../database');
  await database.openAndMigrate();
  return database;
}

async function userVersion(database: typeof import('../database')): Promise<number> {
  const conn = await database.getDb();
  const [{ user_version }] = await conn.getAllAsync<{ user_version: number }>('PRAGMA user_version');
  return user_version;
}

describe.each([3, 4, 5, 6, 7])('upgrade from schema v%i', (version) => {
  it('reaches v8 with every table present and no user data lost', async () => {
    const database = await seedAtVersionAndMigrate(version);

    expect(await userVersion(database)).toBe(9);

    const conn = await database.getDb();
    const tables = await conn.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(ALL_TABLES));

    // Transactions survive intact, including the v3 subcategory column.
    const totals = await database.fetchCategoryTotals(null);
    expect(totals.needs).toBe(25.5);
    expect(totals.wants).toBe(9.99);
    const rows = await database.fetchTransactions();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.subcategory).sort()).toEqual(['Dining', 'Groceries']);
    expect(rows.every((r) => r.accountId === null && r.goalId === null)).toBe(true);

    // Settings and limits survive.
    expect(await database.getSetting('country')).toBe('FR');
    expect(await database.getSetting('onboarding_complete')).toBe('1');
    expect((await database.fetchLimits()).needs).toBe(500);

    // Version-specific data survives.
    if (version >= 4) {
      expect((await database.fetchLearnedKeywords()).gymbox).toEqual({
        category: 'needs',
        subcategory: 'Health',
      });
    }
    if (version >= 5) {
      const [rule] = await database.fetchRecurring();
      expect(rule).toMatchObject({ amount: 50, frequency: 'monthly', note: 'monthly rent' });
      expect(rule.accountId).toBeNull();
    }
    if (version >= 6) {
      expect((await database.fetchBalances()).needs).toBe(800);
    }
    if (version >= 7) {
      const [account] = await database.fetchAccounts();
      expect(account).toMatchObject({ name: 'Checking', balance: 1200 });
    }
  });

  it('is writable end-to-end after the upgrade', async () => {
    const database = await seedAtVersionAndMigrate(version);

    // The v8 additions must work against a migrated (not freshly created) DB.
    await database.insertAccount('Cash', 100);
    const accounts = await database.fetchAccounts();
    const cash = accounts[accounts.length - 1];
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();

    await database.insertTransaction(40, 'savings', 'Emergency Fund', '', cash.id, goal.id);

    expect((await database.fetchGoals())[0].currentAmount).toBe(40);
    expect((await database.fetchAccounts()).find((a) => a.id === cash.id)!.balance).toBe(60);
  });
});

// The v1 block runs `DROP TABLE IF EXISTS transactions`. It must be
// unreachable for anyone who already has data, which means it may only ever
// run against user_version 0.
describe('the destructive v1 migration', () => {
  it('never runs against a database that is already at v1 or beyond', async () => {
    const database = await seedAtVersionAndMigrate(3);
    expect(await database.fetchTransactions()).toHaveLength(2);

    // Re-running the full ladder (an app relaunch) must not drop anything.
    await database.openAndMigrate();
    expect(await database.fetchTransactions()).toHaveLength(2);
    expect(await userVersion(database)).toBe(9);
  });
});
