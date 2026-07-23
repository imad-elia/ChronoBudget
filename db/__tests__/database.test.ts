jest.mock('expo-sqlite');

import { advance } from '../../lib/recurrence';

// `getDb()` memoizes a module-level connection promise, so each test gets an
// isolated in-memory DB by resetting the module registry and re-requiring
// db/database fresh (mirrors the "one DB per app lifetime" real usage).
let database: typeof import('../database');

beforeEach(() => {
  jest.resetModules();
  database = require('../database');
});

describe('schema migration', () => {
  it('migrates a fresh DB to the latest schema version with all tables', async () => {
    const conn = await database.getDb();
    const [{ user_version }] = await conn.getAllAsync<{ user_version: number }>('PRAGMA user_version');
    expect(user_version).toBe(6);

    const tables = await conn.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'transactions',
        'budget_limits',
        'app_settings',
        'keyword_learn',
        'recurring',
        'category_balance',
      ]),
    );
  });

  it('enforces the amount > 0 CHECK constraint on transactions (proves real SQL runs, not a stub)', async () => {
    await expect(database.insertTransaction(0, 'needs', 'Test', '')).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe('migration idempotency', () => {
  it('re-running openAndMigrate against an already-migrated DB does not error or wipe data', async () => {
    await database.getDb();
    await database.insertTransaction(20, 'needs', 'Groceries', '');
    await database.setSetting('country', 'US');

    // Simulates the app relaunching: openAndMigrate() opens the same named DB
    // (mocked to reuse the same underlying data, like a real on-disk file) and
    // re-runs the full migration ladder against it.
    await expect(database.openAndMigrate()).resolves.toBeDefined();

    const conn = await database.getDb();
    const [{ user_version }] = await conn.getAllAsync<{ user_version: number }>('PRAGMA user_version');
    expect(user_version).toBe(6);

    const totals = await database.fetchCategoryTotals();
    expect(totals.needs).toBe(20);
    expect(await database.getSetting('country')).toBe('US');
  });
});

describe('app settings', () => {
  it('round-trips a setting and upserts on repeated writes', async () => {
    expect(await database.getSetting('country')).toBeNull();
    await database.setSetting('country', 'US');
    expect(await database.getSetting('country')).toBe('US');
    await database.setSetting('country', 'FR');
    expect(await database.getSetting('country')).toBe('FR');
  });
});

describe('budget limits and balances (delete-on-<=0 convention)', () => {
  it('setLimit stores a positive amount and deletes on <= 0', async () => {
    await database.setLimit('needs', 500);
    expect((await database.fetchLimits()).needs).toBe(500);
    await database.setLimit('needs', 0);
    expect((await database.fetchLimits()).needs).toBe(0);
  });

  it('setBalance stores a positive amount and deletes on <= 0', async () => {
    await database.setBalance('wants', 300);
    expect((await database.fetchBalances()).wants).toBe(300);
    await database.setBalance('wants', -10);
    expect((await database.fetchBalances()).wants).toBeUndefined();
  });
});

describe('transactions CRUD', () => {
  it('inserts, updates, deletes, and totals transactions', async () => {
    await database.insertTransaction(20, 'needs', 'Groceries', '');
    await database.insertTransaction(10, 'wants', 'Dining', 'coffee');
    let totals = await database.fetchCategoryTotals();
    expect(totals).toEqual({ needs: 20, wants: 10, savings: 0 });

    const [row] = await database.fetchRecentTransactions();
    await database.updateTransaction(row.id, {
      amount: 15,
      category: 'wants',
      subcategory: 'Dining',
      note: 'coffee, edited',
    });
    totals = await database.fetchCategoryTotals();
    expect(totals.wants).toBe(15);

    await database.deleteTransaction(row.id);
    totals = await database.fetchCategoryTotals();
    expect(totals.wants).toBe(0);
  });
});

describe('learned keywords', () => {
  it('learns a keyword, increments count on repeat, and can be deleted', async () => {
    await database.learnKeyword('Gymbox', 'wants', 'Entertainment');
    let map = await database.fetchLearnedKeywords();
    expect(map.gymbox).toEqual({ category: 'wants', subcategory: 'Entertainment' });

    await database.learnKeyword('gymbox', 'needs', 'Health');
    map = await database.fetchLearnedKeywords();
    expect(map.gymbox).toEqual({ category: 'needs', subcategory: 'Health' });

    await database.deleteLearnedKeyword('gymbox');
    map = await database.fetchLearnedKeywords();
    expect(map.gymbox).toBeUndefined();
  });
});

describe('processRecurring (catch-up posting)', () => {
  const NOW = new Date(2026, 6, 1, 0, 0, 0).getTime(); // 2026-07-01

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts one transaction per missed monthly occurrence and advances next_run past now', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);

    await database.insertRecurring({
      amount: 50,
      category: 'needs',
      subcategory: 'Rent',
      note: '',
      frequency: 'monthly',
    });
    const [rule] = await database.fetchRecurring();

    // Back-date next_run to 2026-03-15 (noon) — no month-length clamping
    // ambiguity, so the expected occurrence count is unambiguous.
    const pastNextRun = new Date(2026, 2, 15, 12, 0, 0).getTime();
    const conn = await database.getDb();
    await conn.runAsync('UPDATE recurring SET next_run = ? WHERE id = ?', pastNextRun, rule.id);

    const inserted = await database.processRecurring();

    // Occurrences at Mar 15, Apr 15, May 15, Jun 15 are all <= "now" (Jul 1).
    expect(inserted).toBe(4);

    const totals = await database.fetchCategoryTotals();
    expect(totals.needs).toBe(50 * 4);

    const [updatedRule] = await database.fetchRecurring();
    const expectedNextRun = advance(advance(advance(advance(pastNextRun, 'monthly'), 'monthly'), 'monthly'), 'monthly');
    expect(updatedRule.nextRun).toBe(expectedNextRun);
  });
});

describe('fetchMonthlyTotals', () => {
  it('buckets totals by month and fills zero for months with no activity', async () => {
    const now = new Date();
    await database.insertTransaction(25, 'needs', 'Groceries', '');

    const monthlyTotals = await database.fetchMonthlyTotals(3);
    expect(monthlyTotals).toHaveLength(3);

    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonth = monthlyTotals.find((m) => m.month === currentKey)!;
    expect(currentMonth.needs).toBe(25);

    const otherMonths = monthlyTotals.filter((m) => m.month !== currentKey);
    for (const m of otherMonths) {
      expect(m.needs).toBe(0);
      expect(m.wants).toBe(0);
      expect(m.savings).toBe(0);
    }
  });
});
