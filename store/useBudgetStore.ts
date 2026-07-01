import { create } from 'zustand';

type Category = 'needs' | 'wants' | 'savings';

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
}));

interface MonthlyTotal {
  month: string;
  needs: number;
  wants: number;
  savings: number;
}

export type { Transaction, Category, CategoryTotals, CategoryLimits, MonthlyTotal };
