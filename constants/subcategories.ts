import type { Category } from '../store/useBudgetStore';

export const SUBCATEGORIES: Record<Category, string[]> = {
  needs:   ['Rent', 'Groceries', 'Transport', 'Bills', 'Health', 'Education'],
  wants:   ['Dining', 'Entertainment', 'Shopping', 'Travel', 'Subscriptions'],
  savings: ['Emergency Fund', 'Investment', 'Retirement', 'Goal'],
};
