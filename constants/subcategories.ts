import type { Category } from '../store/useBudgetStore';
import type { StringKey } from './i18n/en';
import { t } from '../lib/i18n';

export const SUBCATEGORIES: Record<Category, string[]> = {
  needs:   ['Rent', 'Groceries', 'Transport', 'Bills', 'Health', 'Education'],
  wants:   ['Dining', 'Entertainment', 'Shopping', 'Travel', 'Subscriptions'],
  savings: ['Emergency Fund', 'Investment', 'Retirement', 'Goal'],
};

// Canonical (stored/English) subcategory string -> its t() key. Custom
// user-typed subcategories have no entry here and stay untranslated.
const SUBCATEGORY_LABEL_KEY: Record<string, StringKey> = {
  'Rent': 'subcategory.rent',
  'Groceries': 'subcategory.groceries',
  'Transport': 'subcategory.transport',
  'Bills': 'subcategory.bills',
  'Health': 'subcategory.health',
  'Education': 'subcategory.education',
  'Dining': 'subcategory.dining',
  'Entertainment': 'subcategory.entertainment',
  'Shopping': 'subcategory.shopping',
  'Travel': 'subcategory.travel',
  'Subscriptions': 'subcategory.subscriptions',
  'Emergency Fund': 'subcategory.emergencyFund',
  'Investment': 'subcategory.investment',
  'Retirement': 'subcategory.retirement',
  'Goal': 'subcategory.goal',
};

export function subcategoryLabel(s: string): string {
  const key = SUBCATEGORY_LABEL_KEY[s];
  return key ? t(key) : s;
}
