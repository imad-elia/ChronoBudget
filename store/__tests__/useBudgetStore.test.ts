jest.mock('../../db/database', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
  fetchLearnedKeywords: jest.fn(),
  fetchRecurring: jest.fn(),
}));

import { useBudgetStore } from '../useBudgetStore';
import * as db from '../../db/database';

const initialState = useBudgetStore.getState();

beforeEach(() => {
  useBudgetStore.setState(initialState, true);
  jest.clearAllMocks();
});

describe('simple setters', () => {
  it('triggerRefresh increments refreshCounter', () => {
    expect(useBudgetStore.getState().refreshCounter).toBe(0);
    useBudgetStore.getState().triggerRefresh();
    expect(useBudgetStore.getState().refreshCounter).toBe(1);
    useBudgetStore.getState().triggerRefresh();
    expect(useBudgetStore.getState().refreshCounter).toBe(2);
  });

  it('setCategoryTotals replaces the totals', () => {
    const totals = { needs: 10, wants: 20, savings: 30 };
    useBudgetStore.getState().setCategoryTotals(totals);
    expect(useBudgetStore.getState().categoryTotals).toEqual(totals);
  });

  it('setRecentTransactions replaces the list', () => {
    const tx = [{ id: 1, amount: 5, category: 'needs' as const, subcategory: '', note: '', timestamp: 0, kind: 'deposit' as const }];
    useBudgetStore.getState().setRecentTransactions(tx);
    expect(useBudgetStore.getState().recentTransactions).toEqual(tx);
  });

  it('setLimits replaces the limits', () => {
    const limits = { needs: 100, wants: 200, savings: 300 };
    useBudgetStore.getState().setLimits(limits);
    expect(useBudgetStore.getState().limits).toEqual(limits);
  });

  it('setBalances replaces the balances', () => {
    const balances = { needs: 500 };
    useBudgetStore.getState().setBalances(balances);
    expect(useBudgetStore.getState().balances).toEqual(balances);
  });

  it('setGoals replaces the goals', () => {
    const goals = [{ id: 1, name: 'Car repair fund', targetAmount: 2000, currentAmount: 500 }];
    useBudgetStore.getState().setGoals(goals);
    expect(useBudgetStore.getState().goals).toEqual(goals);
  });
});

describe('loadLearnedKeywords', () => {
  it('loads keywords from the db layer into state', async () => {
    const map = { gymbox: { category: 'wants' as const, subcategory: 'Entertainment' } };
    (db.fetchLearnedKeywords as jest.Mock).mockResolvedValue(map);

    await useBudgetStore.getState().loadLearnedKeywords();

    expect(useBudgetStore.getState().learnedKeywords).toEqual(map);
  });
});

describe('customSubcategories', () => {
  it('loadCustomSubcategories loads the persisted JSON blob into state', async () => {
    (db.getSetting as jest.Mock).mockResolvedValue(
      JSON.stringify({ needs: ['Pet care'], wants: [], savings: [] }),
    );

    await useBudgetStore.getState().loadCustomSubcategories();

    expect(useBudgetStore.getState().customSubcategories).toEqual({
      needs: ['Pet care'],
      wants: [],
      savings: [],
    });
  });

  it('loadCustomSubcategories leaves the default when nothing is persisted yet', async () => {
    (db.getSetting as jest.Mock).mockResolvedValue(null);

    await useBudgetStore.getState().loadCustomSubcategories();

    expect(useBudgetStore.getState().customSubcategories).toEqual({ needs: [], wants: [], savings: [] });
  });

  it('addCustomSubcategory appends and persists, so it is available for the next entry', async () => {
    await useBudgetStore.getState().addCustomSubcategory('needs', 'Vet bills');

    expect(useBudgetStore.getState().customSubcategories.needs).toEqual(['Vet bills']);
    expect(db.setSetting).toHaveBeenCalledWith(
      'customSubcategories',
      JSON.stringify({ needs: ['Vet bills'], wants: [], savings: [] }),
    );
  });

  it('addCustomSubcategory does not add a duplicate for the same category', async () => {
    await useBudgetStore.getState().addCustomSubcategory('wants', 'Gym extras');
    await useBudgetStore.getState().addCustomSubcategory('wants', 'Gym extras');

    expect(useBudgetStore.getState().customSubcategories.wants).toEqual(['Gym extras']);
  });

  it('addCustomSubcategory ignores a blank/whitespace-only name', async () => {
    await useBudgetStore.getState().addCustomSubcategory('savings', '   ');

    expect(useBudgetStore.getState().customSubcategories.savings).toEqual([]);
    expect(db.setSetting).not.toHaveBeenCalled();
  });
});

describe('loadRecurring', () => {
  it('loads recurring rules from the db layer into state', async () => {
    const rules = [
      { id: 1, amount: 10, category: 'needs' as const, subcategory: '', note: '', frequency: 'monthly' as const, nextRun: 0, active: 1 },
    ];
    (db.fetchRecurring as jest.Mock).mockResolvedValue(rules);

    await useBudgetStore.getState().loadRecurring();

    expect(useBudgetStore.getState().recurring).toEqual(rules);
  });
});

describe('loadLocale', () => {
  it('falls back to the default country when no setting is stored', async () => {
    (db.getSetting as jest.Mock).mockResolvedValue(null);

    await useBudgetStore.getState().loadLocale();

    expect(useBudgetStore.getState().country).toBe(initialState.country);
  });

  it('applies a stored country setting', async () => {
    (db.getSetting as jest.Mock).mockResolvedValue('FR');

    await useBudgetStore.getState().loadLocale();

    expect(useBudgetStore.getState().country).toBe('FR');
  });
});

describe('setCountry', () => {
  it('persists the setting and bumps refreshCounter', async () => {
    const before = useBudgetStore.getState().refreshCounter;

    await useBudgetStore.getState().setCountry('DE');

    expect(db.setSetting).toHaveBeenCalledWith('country', 'DE');
    expect(useBudgetStore.getState().country).toBe('DE');
    expect(useBudgetStore.getState().refreshCounter).toBe(before + 1);
  });

  it('follows the new country\'s default language when none was explicitly set', async () => {
    (db.getSetting as jest.Mock).mockResolvedValue(null); // no saved 'language'

    await useBudgetStore.getState().setCountry('FR');

    expect(useBudgetStore.getState().language).toBe('fr');
  });

  it('does not override an explicitly chosen language on a later country change', async () => {
    (db.getSetting as jest.Mock).mockResolvedValue('en'); // user already picked English

    await useBudgetStore.getState().setCountry('FR');

    expect(useBudgetStore.getState().language).toBe('en');
    expect(db.setSetting).not.toHaveBeenCalledWith('language', expect.anything());
  });
});

describe('setLanguage', () => {
  it('persists the choice and bumps refreshCounter', async () => {
    const before = useBudgetStore.getState().refreshCounter;

    await useBudgetStore.getState().setLanguage('fr');

    expect(db.setSetting).toHaveBeenCalledWith('language', 'fr');
    expect(useBudgetStore.getState().language).toBe('fr');
    expect(useBudgetStore.getState().refreshCounter).toBe(before + 1);
  });
});
