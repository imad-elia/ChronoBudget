import { create } from 'zustand';
import { COUNTRIES, DEFAULT_COUNTRY, findCountry } from '../constants/countries';
import { setActiveLocale } from '../lib/i18n';
import {
  fetchLearnedKeywords,
  fetchRecurring,
  getSetting,
  setSetting,
} from '../db/database';

type Category = 'needs' | 'wants' | 'savings';

type Frequency = 'weekly' | 'monthly' | 'yearly';

type LearnedKeywords = Record<string, { category: Category; subcategory: string }>;

interface RecurringRule {
  id: number;
  amount: number;
  category: Category;
  subcategory: string;
  note: string;
  frequency: Frequency;
  nextRun: number;
  active: number;
}

interface Transaction {
  id: number;
  amount: number;
  category: Category;
  subcategory: string;
  note: string;
  timestamp: number;
}

interface CategoryTotals {
  needs: number;
  wants: number;
  savings: number;
}

type CategoryLimits = CategoryTotals;

interface BudgetStore {
  refreshCounter: number;
  triggerRefresh: () => void;

  categoryTotals: CategoryTotals;
  recentTransactions: Transaction[];
  setCategoryTotals: (totals: CategoryTotals) => void;
  setRecentTransactions: (transactions: Transaction[]) => void;

  limits: CategoryLimits;
  setLimits: (limits: CategoryLimits) => void;

  // Smart-input learned keywords (cached from SQLite for synchronous detection)
  learnedKeywords: LearnedKeywords;
  loadLearnedKeywords: () => Promise<void>;

  // Recurring rules (cached from SQLite for the manager modal)
  recurring: RecurringRule[];
  loadRecurring: () => Promise<void>;

  // Localization (currency + formatting)
  country: string;
  locale: string;
  currency: string;
  symbol: string;
  currencyDecimals: number;
  loadLocale: () => Promise<void>;
  setCountry: (code: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetStore>((set) => ({
  refreshCounter: 0,
  triggerRefresh: () => set((s) => ({ refreshCounter: s.refreshCounter + 1 })),

  categoryTotals: { needs: 0, wants: 0, savings: 0 },
  recentTransactions: [],
  setCategoryTotals: (totals) => set({ categoryTotals: totals }),
  setRecentTransactions: (transactions) => set({ recentTransactions: transactions }),

  limits: { needs: 0, wants: 0, savings: 0 },
  setLimits: (limits) => set({ limits }),

  learnedKeywords: {},
  loadLearnedKeywords: async () => {
    const map = await fetchLearnedKeywords();
    set({ learnedKeywords: map });
  },

  recurring: [],
  loadRecurring: async () => {
    const rules = await fetchRecurring();
    set({ recurring: rules });
  },

  country: DEFAULT_COUNTRY.code,
  locale: DEFAULT_COUNTRY.locale,
  currency: DEFAULT_COUNTRY.currency,
  symbol: DEFAULT_COUNTRY.symbol,
  currencyDecimals: DEFAULT_COUNTRY.decimals,
  loadLocale: async () => {
    const code = await getSetting('country');
    const country = findCountry(code) ?? DEFAULT_COUNTRY;
    setActiveLocale(country.locale);
    set({
      country: country.code,
      locale: country.locale,
      currency: country.currency,
      symbol: country.symbol,
      currencyDecimals: country.decimals,
    });
  },
  setCountry: async (code) => {
    const country = findCountry(code) ?? DEFAULT_COUNTRY;
    await setSetting('country', country.code);
    setActiveLocale(country.locale);
    // Bump refreshCounter so screens that format currency via getState() (e.g.
    // transaction rows) re-render with the new locale/symbol.
    set((s) => ({
      country: country.code,
      locale: country.locale,
      currency: country.currency,
      symbol: country.symbol,
      currencyDecimals: country.decimals,
      refreshCounter: s.refreshCounter + 1,
    }));
  },
}));

export { COUNTRIES };

interface MonthlyTotal {
  month: string;
  needs: number;
  wants: number;
  savings: number;
}

export type { Transaction, Category, CategoryTotals, CategoryLimits, MonthlyTotal, RecurringRule, Frequency };
