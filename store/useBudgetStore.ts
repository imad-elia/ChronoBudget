import { create } from 'zustand';
import { COUNTRIES, DEFAULT_COUNTRY, findCountry } from '../constants/countries';
import { setActiveLocale } from '../lib/i18n';
import {
  fetchLearnedKeywords,
  fetchRecurring,
  getSetting,
  setSetting,
} from '../db/database';

// Only languages with an actual translation bundle (constants/i18n) and
// keyword dictionary (constants/keywords) can be picked explicitly.
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function resolveLanguage(lang: string | null | undefined): SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang ?? '')
    ? (lang as SupportedLanguage)
    : 'en';
}

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
  accountId?: number | null;
}

interface Transaction {
  id: number;
  amount: number;
  category: Category;
  subcategory: string;
  note: string;
  timestamp: number;
  accountId?: number | null;
  goalId?: number | null;
}

interface Account {
  id: number;
  name: string;
  balance: number;
}

interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
}

interface Transfer {
  id: number;
  fromAccount: number;
  toAccount: number;
  amount: number;
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

  // Optional one-time starting balances per category (Remaining = balance − spent)
  balances: Partial<Record<Category, number>>;
  setBalances: (balances: Partial<Record<Category, number>>) => void;

  // Smart-input learned keywords (cached from SQLite for synchronous detection)
  learnedKeywords: LearnedKeywords;
  loadLearnedKeywords: () => Promise<void>;

  // Recurring rules (cached from SQLite for the manager modal)
  recurring: RecurringRule[];
  loadRecurring: () => Promise<void>;

  // Accounts (where money sits) + transfers between them
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  transfers: Transfer[];
  setTransfers: (transfers: Transfer[]) => void;

  // Savings goals (sinking funds within the Savings category)
  goals: Goal[];
  setGoals: (goals: Goal[]) => void;

  // Localization (currency + formatting)
  country: string;
  locale: string;
  currency: string;
  symbol: string;
  currencyDecimals: number;
  loadLocale: () => Promise<void>;
  setCountry: (code: string) => Promise<void>;

  // UI/classifier language — independent of country once explicitly chosen.
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
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

  balances: {},
  setBalances: (balances) => set({ balances }),

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

  accounts: [],
  setAccounts: (accounts) => set({ accounts }),
  transfers: [],
  setTransfers: (transfers) => set({ transfers }),

  goals: [],
  setGoals: (goals) => set({ goals }),

  country: DEFAULT_COUNTRY.code,
  locale: DEFAULT_COUNTRY.locale,
  currency: DEFAULT_COUNTRY.currency,
  symbol: DEFAULT_COUNTRY.symbol,
  currencyDecimals: DEFAULT_COUNTRY.decimals,
  loadLocale: async () => {
    const code = await getSetting('country');
    const country = findCountry(code) ?? DEFAULT_COUNTRY;

    const savedLanguage = await getSetting('language');
    const language = resolveLanguage(savedLanguage ?? country.language);
    setActiveLocale(language);

    set({
      country: country.code,
      locale: country.locale,
      currency: country.currency,
      symbol: country.symbol,
      currencyDecimals: country.decimals,
      language,
    });
  },
  setCountry: async (code) => {
    const country = findCountry(code) ?? DEFAULT_COUNTRY;
    await setSetting('country', country.code);

    // Only follow the country's default language if the user has never
    // explicitly picked one via setLanguage — an explicit choice persists
    // across later country changes (e.g. currency-only switches).
    const savedLanguage = await getSetting('language');
    let language: SupportedLanguage | undefined;
    if (!savedLanguage) {
      language = resolveLanguage(country.language);
      setActiveLocale(language);
    }

    // Bump refreshCounter so screens that format currency via getState() (e.g.
    // transaction rows) re-render with the new locale/symbol.
    set((s) => ({
      country: country.code,
      locale: country.locale,
      currency: country.currency,
      symbol: country.symbol,
      currencyDecimals: country.decimals,
      ...(language ? { language } : {}),
      refreshCounter: s.refreshCounter + 1,
    }));
  },

  language: resolveLanguage(DEFAULT_COUNTRY.language),
  setLanguage: async (lang) => {
    await setSetting('language', lang);
    setActiveLocale(lang);
    set((s) => ({ language: lang, refreshCounter: s.refreshCounter + 1 }));
  },
}));

export { COUNTRIES };

interface MonthlyTotal {
  month: string;
  needs: number;
  wants: number;
  savings: number;
}

export type { Transaction, Category, CategoryTotals, CategoryLimits, MonthlyTotal, RecurringRule, Frequency, Account, Transfer, Goal };
