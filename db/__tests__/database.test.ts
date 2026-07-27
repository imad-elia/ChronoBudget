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
    expect(user_version).toBe(7);

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
        'accounts',
        'transfers',
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
    expect(user_version).toBe(7);

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

describe('fetchCategoryTotals (month-scoped)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to the current month, excluding prior months, but includes all-time when passed null', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 15).getTime()); // 2026-06-15
    await database.insertTransaction(30, 'needs', 'Groceries', '');

    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 6, 1).getTime()); // 2026-07-01
    await database.insertTransaction(20, 'needs', 'Groceries', '');

    const currentMonthTotals = await database.fetchCategoryTotals();
    expect(currentMonthTotals.needs).toBe(20);

    const allTimeTotals = await database.fetchCategoryTotals(null);
    expect(allTimeTotals.needs).toBe(50);
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

    const totals = await database.fetchCategoryTotals(null);
    expect(totals.needs).toBe(50 * 4);

    const [updatedRule] = await database.fetchRecurring();
    const expectedNextRun = advance(advance(advance(advance(pastNextRun, 'monthly'), 'monthly'), 'monthly'), 'monthly');
    expect(updatedRule.nextRun).toBe(expectedNextRun);
  });

  it('debits the tagged account balance once per posted occurrence', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);

    await database.insertAccount('Checking', 500);
    const [account] = await database.fetchAccounts();

    await database.insertRecurring({
      amount: 50,
      category: 'needs',
      subcategory: 'Rent',
      note: '',
      frequency: 'monthly',
      accountId: account.id,
    });
    const [rule] = await database.fetchRecurring();
    expect(rule.accountId).toBe(account.id);

    const pastNextRun = new Date(2026, 2, 15, 12, 0, 0).getTime();
    const conn = await database.getDb();
    await conn.runAsync('UPDATE recurring SET next_run = ? WHERE id = ?', pastNextRun, rule.id);

    const inserted = await database.processRecurring();
    expect(inserted).toBe(4);

    const [after] = await database.fetchAccounts();
    expect(after.balance).toBe(500 - 50 * 4);
  });
});

describe('insertRecurring (custom start date)', () => {
  const NOW = new Date(2026, 6, 1, 0, 0, 0).getTime(); // 2026-07-01

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults next_run to ~now when startDate is omitted', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);

    await database.insertRecurring({
      amount: 10,
      category: 'needs',
      subcategory: 'Rent',
      note: '',
      frequency: 'monthly',
    });
    const [rule] = await database.fetchRecurring();
    expect(rule.nextRun).toBe(NOW);
  });

  it('seeds next_run from a future startDate and does not post it early', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    const futureStart = new Date(2026, 7, 15, 12, 0, 0).getTime(); // 2026-08-15

    await database.insertRecurring({
      amount: 30,
      category: 'wants',
      subcategory: 'Streaming',
      note: '',
      frequency: 'monthly',
      startDate: futureStart,
    });
    const [rule] = await database.fetchRecurring();
    expect(rule.nextRun).toBe(futureStart);

    const inserted = await database.processRecurring();
    expect(inserted).toBe(0);
  });

  it('seeds next_run from a past startDate and immediately catches up via processRecurring', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    const pastStart = new Date(2026, 2, 15, 12, 0, 0).getTime(); // 2026-03-15

    await database.insertRecurring({
      amount: 40,
      category: 'savings',
      subcategory: 'Investing',
      note: '',
      frequency: 'monthly',
      startDate: pastStart,
    });

    const inserted = await database.processRecurring();
    // Occurrences at Mar 15, Apr 15, May 15, Jun 15 are all <= "now" (Jul 1).
    expect(inserted).toBe(4);

    const totals = await database.fetchCategoryTotals(null);
    expect(totals.savings).toBe(40 * 4);
  });
});

describe('recurring account tagging', () => {
  it('round-trips accountId through insert, fetch, and update', async () => {
    await database.insertAccount('Checking', 100);
    await database.insertAccount('Savings', 100);
    const [checking, savings] = await database.fetchAccounts();

    await database.insertRecurring({
      amount: 10,
      category: 'needs',
      subcategory: 'Rent',
      note: '',
      frequency: 'monthly',
      accountId: checking.id,
    });
    const [rule] = await database.fetchRecurring();
    expect(rule.accountId).toBe(checking.id);

    await database.updateRecurring(rule.id, {
      amount: 10,
      category: 'needs',
      subcategory: 'Rent',
      note: '',
      frequency: 'monthly',
      accountId: savings.id,
    });
    const [updated] = await database.fetchRecurring();
    expect(updated.accountId).toBe(savings.id);
  });

  it('defaults accountId to null when omitted', async () => {
    await database.insertRecurring({
      amount: 10,
      category: 'needs',
      subcategory: 'Rent',
      note: '',
      frequency: 'monthly',
    });
    const [rule] = await database.fetchRecurring();
    expect(rule.accountId).toBeNull();
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

describe('insertTransactionsBulk', () => {
  it('inserts every row in one pass', async () => {
    await database.insertTransactionsBulk([
      { amount: 10, category: 'needs', subcategory: 'Groceries', note: '', timestamp: 1 },
      { amount: 20, category: 'wants', subcategory: 'Dining', note: 'lunch', timestamp: 2 },
    ]);
    const totals = await database.fetchCategoryTotals(null);
    expect(totals.needs).toBe(10);
    expect(totals.wants).toBe(20);
  });

  it('is a no-op for an empty list', async () => {
    await expect(database.insertTransactionsBulk([])).resolves.toBeUndefined();
    const totals = await database.fetchCategoryTotals(null);
    expect(totals.needs + totals.wants + totals.savings).toBe(0);
  });
});

describe('accounts', () => {
  it('inserts an account with an initial balance and fetches it back', async () => {
    await database.insertAccount('Checking', 100);
    const [account] = await database.fetchAccounts();
    expect(account).toMatchObject({ name: 'Checking', balance: 100 });
  });

  it('renames an account without touching its balance', async () => {
    await database.insertAccount('Checking', 100);
    const [account] = await database.fetchAccounts();
    await database.updateAccount(account.id, 'Main Checking');
    const [renamed] = await database.fetchAccounts();
    expect(renamed).toMatchObject({ name: 'Main Checking', balance: 100 });
  });

  it('debits the account balance when a transaction is tagged with it', async () => {
    await database.insertAccount('Checking', 100);
    const [account] = await database.fetchAccounts();
    await database.insertTransaction(30, 'needs', 'Groceries', '', account.id);
    const [after] = await database.fetchAccounts();
    expect(after.balance).toBe(70);
  });

  it('reverses the old amount and applies the new one when a tagged transaction is updated', async () => {
    await database.insertAccount('Checking', 100);
    const [account] = await database.fetchAccounts();
    await database.insertTransaction(30, 'needs', 'Groceries', '', account.id);
    const [tx] = await database.fetchTransactions();

    await database.updateTransaction(tx.id, {
      amount: 50,
      category: 'needs',
      subcategory: 'Groceries',
      note: '',
      accountId: account.id,
    });

    const [after] = await database.fetchAccounts();
    expect(after.balance).toBe(50); // 100 - 30 reversed (+30) then - 50
  });

  it('credits the account balance back when a tagged transaction is deleted', async () => {
    await database.insertAccount('Checking', 100);
    const [account] = await database.fetchAccounts();
    await database.insertTransaction(30, 'needs', 'Groceries', '', account.id);
    const [tx] = await database.fetchTransactions();

    await database.deleteTransaction(tx.id);

    const [after] = await database.fetchAccounts();
    expect(after.balance).toBe(100);
  });

  it('refuses to delete an account still referenced by a transaction', async () => {
    await database.insertAccount('Checking', 100);
    const [account] = await database.fetchAccounts();
    await database.insertTransaction(30, 'needs', 'Groceries', '', account.id);

    const deleted = await database.deleteAccount(account.id);
    expect(deleted).toBe(false);
    expect(await database.fetchAccounts()).toHaveLength(1);
  });

  it('deletes an account with no references', async () => {
    await database.insertAccount('Empty', 0);
    const [account] = await database.fetchAccounts();

    const deleted = await database.deleteAccount(account.id);
    expect(deleted).toBe(true);
    expect(await database.fetchAccounts()).toHaveLength(0);
  });
});

describe('transfers', () => {
  it('moves money between two accounts atomically', async () => {
    await database.insertAccount('Checking', 100);
    await database.insertAccount('Savings', 50);
    const [checking, savings] = await database.fetchAccounts();

    await database.insertTransfer(checking.id, savings.id, 40, 'Move to savings');

    const accounts = await database.fetchAccounts();
    expect(accounts.find((a) => a.id === checking.id)!.balance).toBe(60);
    expect(accounts.find((a) => a.id === savings.id)!.balance).toBe(90);

    const [transfer] = await database.fetchTransfers();
    expect(transfer).toMatchObject({ fromAccount: checking.id, toAccount: savings.id, amount: 40 });
  });

  it('does not affect category totals (transfers live outside the transactions table)', async () => {
    await database.insertAccount('Checking', 100);
    await database.insertAccount('Savings', 50);
    const [checking, savings] = await database.fetchAccounts();

    await database.insertTransfer(checking.id, savings.id, 40, '');

    const totals = await database.fetchCategoryTotals(null);
    expect(totals.needs).toBe(0);
    expect(totals.wants).toBe(0);
    expect(totals.savings).toBe(0);
  });
});
