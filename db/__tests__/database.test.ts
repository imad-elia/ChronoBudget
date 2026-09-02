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
    expect(user_version).toBe(9);

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
        'goals',
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
    expect(user_version).toBe(9);

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

  // Regression: this query used to bucket in UTC while fetchCategoryTotals
  // bucketed in local time, so a transaction logged near a month boundary in a
  // non-UTC zone landed in a different month on Trends than on the dashboard.
  // The two instants below sit at either edge of the current local month — the
  // only places the disagreement can surface. Note this can only fail when the
  // runner's timezone is not UTC (CI runs in UTC); the on-device proof is the
  // manual T-TZ-01 case.
  it('buckets by local time, agreeing with fetchCategoryTotals at both month edges', async () => {
    const now = new Date();
    const firstInstant = new Date(now.getFullYear(), now.getMonth(), 1, 0, 30).getTime();
    const lastInstant = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 30).getTime();

    await database.insertTransactionsBulk([
      { amount: 42, category: 'wants', subcategory: 'Dining', note: '', timestamp: firstInstant },
      { amount: 58, category: 'wants', subcategory: 'Dining', note: '', timestamp: lastInstant },
    ]);

    const monthKey = database.currentMonthKey();
    const totals = await database.fetchCategoryTotals(monthKey);
    const thisMonth = (await database.fetchMonthlyTotals(1)).find((m) => m.month === monthKey)!;

    expect(totals.wants).toBe(100);
    expect(thisMonth.wants).toBe(totals.wants);
  });

  it("'all' returns an empty array when there are no transactions", async () => {
    expect(await database.fetchMonthlyTotals('all')).toEqual([]);
  });

  it("'all' spans from the earliest transaction's month through the current month, zero-filling the gap", async () => {
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15).getTime();

    await database.insertTransactionsBulk([
      { amount: 40, category: 'needs', subcategory: 'Groceries', note: '', timestamp: twoMonthsAgo },
    ]);
    await database.insertTransaction(60, 'wants', 'Dining', '');

    const monthlyTotals = await database.fetchMonthlyTotals('all');
    expect(monthlyTotals).toHaveLength(3); // two-months-ago, one-month-ago (zero), current

    const earliestKey = `${new Date(twoMonthsAgo).getFullYear()}-${String(new Date(twoMonthsAgo).getMonth() + 1).padStart(2, '0')}`;
    const currentKey = database.currentMonthKey();

    expect(monthlyTotals[0].month).toBe(earliestKey);
    expect(monthlyTotals[0].needs).toBe(40);
    expect(monthlyTotals.at(-1)!.month).toBe(currentKey);
    expect(monthlyTotals.at(-1)!.wants).toBe(60);

    const middleMonth = monthlyTotals.find((m) => m.month !== earliestKey && m.month !== currentKey)!;
    expect(middleMonth.needs).toBe(0);
    expect(middleMonth.wants).toBe(0);
    expect(middleMonth.savings).toBe(0);
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

  // Regression: the guard checked transactions and recurring only, so an
  // account referenced solely by a transfer passed it and the DELETE then hit
  // the transfers foreign key inside SQLite instead of returning false.
  it('refuses to delete an account still referenced by a transfer, from either side', async () => {
    await database.insertAccount('Checking', 100);
    await database.insertAccount('Savings', 50);
    const [checking, savings] = await database.fetchAccounts();
    await database.insertTransfer(checking.id, savings.id, 40, '');

    await expect(database.deleteAccount(checking.id)).resolves.toBe(false);
    await expect(database.deleteAccount(savings.id)).resolves.toBe(false);
    expect(await database.fetchAccounts()).toHaveLength(2);
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

  // Regression: proves withTransactionAsync actually rolls back. insertTransfer
  // debits the source account, credits the destination, then INSERTs the
  // transfer row — so a destination that does not exist fails on the foreign
  // key *after* the source has already been debited. Without a real
  // BEGIN/ROLLBACK the debit would survive and money would vanish.
  it('rolls back a partially-applied transfer when the insert fails', async () => {
    await database.insertAccount('Checking', 100);
    const [checking] = await database.fetchAccounts();
    const missingAccountId = checking.id + 999;

    await expect(
      database.insertTransfer(checking.id, missingAccountId, 40, ''),
    ).rejects.toThrow();

    const [after] = await database.fetchAccounts();
    expect(after.balance).toBe(100);
    expect(await database.fetchTransfers()).toHaveLength(0);
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

describe('goals', () => {
  it('inserts a goal with a target amount and fetches it back with a zero starting balance', async () => {
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    expect(goal).toMatchObject({ name: 'Car repair fund', targetAmount: 2000, currentAmount: 0 });
  });

  it('renames a goal and updates its target without touching current_amount', async () => {
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    await database.insertTransaction(500, 'savings', '', '', null, goal.id);

    await database.updateGoal(goal.id, 'Car fund', 2500);

    const [updated] = await database.fetchGoals();
    expect(updated).toMatchObject({ name: 'Car fund', targetAmount: 2500, currentAmount: 500 });
  });

  it('credits current_amount when a savings transaction is tagged with a goal', async () => {
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    await database.insertTransaction(500, 'savings', '', '', null, goal.id);
    const [after] = await database.fetchGoals();
    expect(after.currentAmount).toBe(500);
  });

  it('reverses the old amount and applies the new one when a tagged transaction is updated', async () => {
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    await database.insertTransaction(500, 'savings', '', '', null, goal.id);
    const [tx] = await database.fetchTransactions();

    await database.updateTransaction(tx.id, {
      amount: 800,
      category: 'savings',
      subcategory: '',
      note: '',
      goalId: goal.id,
    });

    const [after] = await database.fetchGoals();
    expect(after.currentAmount).toBe(800); // 500 reversed (-500) then +800
  });

  it('debits current_amount back when a tagged transaction is deleted', async () => {
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    await database.insertTransaction(500, 'savings', '', '', null, goal.id);
    const [tx] = await database.fetchTransactions();

    await database.deleteTransaction(tx.id);

    const [after] = await database.fetchGoals();
    expect(after.currentAmount).toBe(0);
  });

  it('refuses to delete a goal still referenced by a transaction', async () => {
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    await database.insertTransaction(500, 'savings', '', '', null, goal.id);

    const deleted = await database.deleteGoal(goal.id);
    expect(deleted).toBe(false);
    expect(await database.fetchGoals()).toHaveLength(1);
  });

  // Regression: goals.target_amount is the one money column with no CHECK
  // constraint, so a non-positive target would reach the DB and then divide by
  // zero in ProgressBar's fill maths. Guarded in db/database.ts instead.
  it('rejects a non-positive target amount on insert and on update', async () => {
    await expect(database.insertGoal('Bad goal', 0)).rejects.toThrow(/target_amount/);
    await expect(database.insertGoal('Bad goal', -100)).rejects.toThrow(/target_amount/);
    await expect(database.insertGoal('Bad goal', NaN)).rejects.toThrow(/target_amount/);
    expect(await database.fetchGoals()).toHaveLength(0);

    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    await expect(database.updateGoal(goal.id, 'Car fund', 0)).rejects.toThrow(/target_amount/);

    const [unchanged] = await database.fetchGoals();
    expect(unchanged).toMatchObject({ name: 'Car repair fund', targetAmount: 2000 });
  });

  it('deletes a goal with no references', async () => {
    await database.insertGoal('Empty goal', 100);
    const [goal] = await database.fetchGoals();

    const deleted = await database.deleteGoal(goal.id);
    expect(deleted).toBe(true);
    expect(await database.fetchGoals()).toHaveLength(0);
  });
});

// Every transaction implicitly defaults to 'deposit' — Needs/Wants never see
// a withdrawal option, only Savings does. These cover the signed-delta math
// that makes a withdrawal net out of both the category total and (if tagged)
// a goal's progress, and — easy to miss — credit rather than debit a tagged
// account, since money is coming back OUT of the abstract savings bucket.
describe('savings deposit/withdrawal direction', () => {
  it('defaults to deposit when kind is omitted, unchanged from before this existed', async () => {
    await database.insertTransaction(500, 'savings', '', '');
    const totals = await database.fetchCategoryTotals(null);
    expect(totals.savings).toBe(500);
  });

  it('nets a withdrawal out of the monthly category total', async () => {
    await database.insertTransaction(500, 'savings', '', '', null, null, 'deposit');
    await database.insertTransaction(200, 'savings', '', '', null, null, 'withdrawal');
    const totals = await database.fetchCategoryTotals(null);
    expect(totals.savings).toBe(300);
  });

  it('decrements a tagged goal\'s current_amount on withdrawal', async () => {
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    await database.insertTransaction(500, 'savings', '', '', null, goal.id, 'deposit');
    await database.insertTransaction(150, 'savings', '', '', null, goal.id, 'withdrawal');
    const [after] = await database.fetchGoals();
    expect(after.currentAmount).toBe(350);
  });

  it('credits (not debits) a tagged account on withdrawal', async () => {
    await database.insertAccount('Checking', 100);
    const [account] = await database.fetchAccounts();
    await database.insertTransaction(500, 'savings', '', '', account.id, null, 'deposit');
    const [afterDeposit] = await database.fetchAccounts();
    expect(afterDeposit.balance).toBe(-400); // 100 - 500

    await database.insertTransaction(200, 'savings', '', '', account.id, null, 'withdrawal');
    const [afterWithdrawal] = await database.fetchAccounts();
    expect(afterWithdrawal.balance).toBe(-200); // -400 + 200
  });

  it('reverses the previous kind and applies the new one when a transaction\'s kind is edited', async () => {
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    await database.insertTransaction(500, 'savings', '', '', null, goal.id, 'deposit');
    const [tx] = await database.fetchTransactions();

    await database.updateTransaction(tx.id, {
      amount: 500,
      category: 'savings',
      subcategory: '',
      note: '',
      goalId: goal.id,
      kind: 'withdrawal',
    });

    const [after] = await database.fetchGoals();
    expect(after.currentAmount).toBe(-500); // 500 reversed (-500) then -500 applied
  });

  it('reverses a withdrawal\'s effect (adds back) when it is deleted', async () => {
    await database.insertGoal('Car repair fund', 2000);
    const [goal] = await database.fetchGoals();
    await database.insertTransaction(800, 'savings', '', '', null, goal.id, 'deposit');
    await database.insertTransaction(300, 'savings', '', '', null, goal.id, 'withdrawal');
    const all = await database.fetchTransactions();
    const withdrawalTx = all.find((t) => t.kind === 'withdrawal')!;

    await database.deleteTransaction(withdrawalTx.id);

    const [after] = await database.fetchGoals();
    expect(after.currentAmount).toBe(800);
  });

  // fetchSavingsWithdrawn is the figure Limit/Balance consumption should react
  // to for Savings — depositing (growing savings) must never count against a
  // Savings limit or reduce a Savings balance's remaining; only withdrawing should.
  it('fetchSavingsWithdrawn sums only withdrawals, ignoring deposits and other categories', async () => {
    await database.insertTransaction(500, 'savings', '', '', null, null, 'deposit');
    await database.insertTransaction(150, 'savings', '', '', null, null, 'withdrawal');
    await database.insertTransaction(80, 'savings', '', '', null, null, 'withdrawal');
    await database.insertTransaction(999, 'needs', 'Groceries', ''); // unaffected — different category

    expect(await database.fetchSavingsWithdrawn(null)).toBe(230);
  });

  it('fetchSavingsWithdrawn returns 0 when the only Savings activity is deposits', async () => {
    await database.insertTransaction(500, 'savings', '', '', null, null, 'deposit');
    expect(await database.fetchSavingsWithdrawn(null)).toBe(0);
  });
});

describe('clock edge cases', () => {
  const NOW = new Date(2026, 6, 1, 12, 0, 0).getTime(); // 2026-07-01

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // A device clock jumped far forward must not hang the app on launch:
  // processRecurring loops once per missed occurrence, and only terminates
  // because advance() is strictly increasing.
  it('bounds catch-up when the clock jumps two years forward', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await database.insertRecurring({
      amount: 10,
      category: 'needs',
      subcategory: 'Bills',
      note: '',
      frequency: 'weekly',
    });

    const twoYearsOn = new Date(2028, 6, 1, 12, 0, 0).getTime();
    jest.spyOn(Date, 'now').mockReturnValue(twoYearsOn);

    const started = performance.now();
    const inserted = await database.processRecurring();
    const elapsed = performance.now() - started;

    // 2026-07-01 → 2028-07-01 is 731 days; one posting per 7 days, counting
    // the anchor occurrence itself.
    expect(inserted).toBe(105);
    expect(elapsed).toBeLessThan(10_000);

    const [rule] = await database.fetchRecurring();
    expect(rule.nextRun).toBeGreaterThan(twoYearsOn);
  });

  it('posts nothing and leaves next_run intact when the clock moves backwards', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await database.insertRecurring({
      amount: 25,
      category: 'wants',
      subcategory: 'Subscriptions',
      note: '',
      frequency: 'monthly',
      startDate: new Date(2026, 7, 1, 12, 0, 0).getTime(), // future: 2026-08-01
    });
    const [before] = await database.fetchRecurring();

    // Device clock dragged back a month.
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 1, 12, 0, 0).getTime());
    expect(await database.processRecurring()).toBe(0);

    const [after] = await database.fetchRecurring();
    expect(after.nextRun).toBe(before.nextRun);
    expect((await database.fetchCategoryTotals(null)).wants).toBe(0);
  });

  // advance() steps weekly rules by an absolute 7 days, so a DST transition
  // shifts the local posting hour but must never skip or duplicate a week.
  // Only meaningful under a DST-observing timezone (see the CI matrix); in
  // UTC it still holds, trivially.
  it('posts exactly one occurrence per week across a DST transition', async () => {
    // 2026-03-01, before both the US and EU spring transitions.
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 2, 1, 12, 0, 0).getTime());
    await database.insertRecurring({
      amount: 5,
      category: 'needs',
      subcategory: 'Transport',
      note: '',
      frequency: 'weekly',
    });

    // Six weeks on, spanning any spring-forward transition in between. The
    // cutoff is late in the day on purpose: a DST shift moves each occurrence's
    // local hour by one, and a midday cutoff would flip the last occurrence in
    // or out of range depending on the runner's timezone.
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 3, 12, 23, 0, 0).getTime());
    const inserted = await database.processRecurring();
    expect(inserted).toBe(7);
    expect((await database.fetchCategoryTotals(null)).needs).toBe(35);

    // The invariant that actually matters: every posting sits exactly one week
    // after the previous one, so no week is skipped or posted twice.
    const posted = (await database.fetchTransactions())
      .map((row) => row.timestamp)
      .sort((a, b) => a - b);
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    for (let i = 1; i < posted.length; i++) {
      expect(posted[i] - posted[i - 1]).toBe(WEEK_MS);
    }
  });

  it('files a late-night entry into the month the user is actually in', async () => {
    const lateOnLastDay = new Date(2026, 6, 31, 23, 59, 0).getTime(); // 2026-07-31 23:59 local
    jest.spyOn(Date, 'now').mockReturnValue(lateOnLastDay);
    await database.insertTransaction(12, 'wants', 'Dining', 'late snack');

    expect(database.currentMonthKey()).toBe('2026-07');
    expect((await database.fetchCategoryTotals('2026-07')).wants).toBe(12);
    expect((await database.fetchCategoryTotals('2026-08')).wants).toBe(0);
  });
});

describe('money-column validation audit', () => {
  // Every writer taking an amount must refuse non-positive values before
  // anything reaches SQLite. goals.target_amount is the one column with no
  // CHECK constraint behind it, so its guard lives in db/database.ts.
  it('insertTransaction rejects zero and negative amounts', async () => {
    await expect(database.insertTransaction(0, 'needs', '', '')).rejects.toThrow();
    await expect(database.insertTransaction(-5, 'needs', '', '')).rejects.toThrow();
  });

  it('insertGoal and updateGoal reject zero and negative targets', async () => {
    await expect(database.insertGoal('Goal', 0)).rejects.toThrow();
    await expect(database.insertGoal('Goal', -5)).rejects.toThrow();
  });

  it('insertTransfer rejects zero and negative amounts', async () => {
    await database.insertAccount('A', 10);
    await database.insertAccount('B', 10);
    const [a, b] = await database.fetchAccounts();

    await expect(database.insertTransfer(a.id, b.id, 0, '')).rejects.toThrow();
    await expect(database.insertTransfer(a.id, b.id, -5, '')).rejects.toThrow();

    // And the rollback left both balances untouched.
    const accounts = await database.fetchAccounts();
    expect(accounts.map((acc) => acc.balance)).toEqual([10, 10]);
  });

  it('setLimit and setBalance delete rather than store a non-positive amount', async () => {
    await database.setLimit('needs', 100);
    await database.setBalance('needs', 100);
    await database.setLimit('needs', -1);
    await database.setBalance('needs', -1);
    expect((await database.fetchLimits()).needs).toBe(0);
    expect((await database.fetchBalances()).needs).toBeUndefined();
  });
});

describe('numeric and text robustness', () => {
  it('keeps running balances within a cent across hundreds of operations', async () => {
    await database.insertAccount('Checking', 100);
    const [account] = await database.fetchAccounts();

    for (let i = 0; i < 300; i++) {
      await database.insertTransaction(0.07, 'needs', 'Groceries', '', account.id);
    }
    const rows = await database.fetchTransactions(150);
    for (const row of rows) {
      await database.deleteTransaction(row.id);
    }

    const [after] = await database.fetchAccounts();
    // 300 debits then 150 credits of 0.07 => 100 - (150 * 0.07) = 89.5
    expect(Math.abs(after.balance - 89.5)).toBeLessThan(0.01);
  });

  it('round-trips small, large and long values without loss', async () => {
    const longNote = 'x'.repeat(10_000);
    await database.insertTransaction(0.01, 'needs', 'Groceries', longNote);
    await database.insertTransaction(99999999.99, 'wants', 'Travel', '');

    const rows = await database.fetchTransactions();
    const small = rows.find((r) => r.category === 'needs')!;
    const large = rows.find((r) => r.category === 'wants')!;

    expect(small.amount).toBe(0.01);
    expect(small.note).toHaveLength(10_000);
    expect(large.amount).toBe(99999999.99);
    expect(String(large.amount)).not.toContain('e');
  });

  it('stores injection-shaped and unicode text verbatim', async () => {
    const nasty = String.fromCharCode(39) + '; DROP TABLE transactions;-- café "quoted", comma';
    await database.insertTransaction(5, 'wants', 'Dining', nasty);

    const [row] = await database.fetchTransactions();
    expect(row.note).toBe(nasty);
    // The table still exists and still holds exactly the one row.
    expect(await database.fetchTransactions()).toHaveLength(1);
  });
});

describe('CSV import de-duplication (pinned behaviour)', () => {
  // insertTransactionsBulk does no de-duplication, so importing the same
  // export twice doubles the data. Pinned deliberately: this is an open
  // product question (HIST-10), and changing it should be a decision rather
  // than an accident.
  it('doubles the totals when the same payload is imported twice', async () => {
    const payload = [
      { amount: 10, category: 'needs' as const, subcategory: 'Groceries', note: '', timestamp: 1750000000000 },
      { amount: 20, category: 'wants' as const, subcategory: 'Dining', note: '', timestamp: 1750100000000 },
    ];

    await database.insertTransactionsBulk(payload);
    await database.insertTransactionsBulk(payload);

    const totals = await database.fetchCategoryTotals(null);
    expect(totals.needs).toBe(20);
    expect(totals.wants).toBe(40);
    expect(await database.fetchTransactions()).toHaveLength(4);
  });
});
