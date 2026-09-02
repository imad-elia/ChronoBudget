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

// Meaningful only for Savings transactions — a deposit adds to the category
// total / a tagged goal's progress, a withdrawal subtracts. Needs/Wants
// transactions are always implicitly 'deposit' (i.e. spend).
export type TransactionKind = 'deposit' | 'withdrawal';

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
  kind: TransactionKind;
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

  // User-typed custom subcategories, remembered per category so they show up
  // as a chip on later entries (persisted via app_settings as one JSON blob).
  customSubcategories: Record<Category, string[]>;
  loadCustomSubcategories: () => Promise<void>;
  addCustomSubcategory: (category: Category, name: string) => Promise<void>;

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

export const useBudgetStore = create<BudgetStore>((set, get) => ({
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

  customSubcategories: { needs: [], wants: [], savings: [] },
  loadCustomSubcategories: async () => {
    const raw = await getSetting('customSubcategories');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      set({
        customSubcategories: {
          needs: Array.isArray(parsed.needs) ? parsed.needs : [],
          wants: Array.isArray(parsed.wants) ? parsed.wants : [],
          savings: Array.isArray(parsed.savings) ? parsed.savings : [],
        },
      });
    } catch {
      // Ignore corrupt/legacy stored value — keep the empty default.
    }
  },
  addCustomSubcategory: async (category, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = get().customSubcategories;
    if (current[category].includes(trimmed)) return;
    const next = { ...current, [category]: [...current[category], trimmed] };
    set({ customSubcategories: next });
    await setSetting('customSubcategories', JSON.stringify(next));
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

interface QuarterlyTotal {
  quarter: string; // 'YYYY-Q1'
  needs: number;
  wants: number;
  savings: number;
}

interface YearlyTotal {
  year: string; // 'YYYY'
  needs: number;
  wants: number;
  savings: number;
}

export type { Transaction, Category, CategoryTotals, CategoryLimits, MonthlyTotal, QuarterlyTotal, YearlyTotal, RecurringRule, Frequency, Account, Transfer, Goal };
