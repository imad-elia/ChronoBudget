import type { Category } from '../store/useBudgetStore';
import type { StringKey } from './i18n/en';
import { en } from './i18n/en';
import { fr } from './i18n/fr';
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

/** Either locale's translated label -> canonical string, case-insensitively.
 *  Reverses subcategoryLabel() so a CSV exported with translated subcategory
 *  cells re-imports to the same canonical form regardless of which language
 *  it was exported in. Custom (never-translated) subcategories fall through
 *  unchanged, same as subcategoryLabel() itself. */
const CANONICAL_BY_LABEL: Record<string, string> = {};
for (const [canonical, key] of Object.entries(SUBCATEGORY_LABEL_KEY)) {
  CANONICAL_BY_LABEL[en[key].toLowerCase()] = canonical;
  CANONICAL_BY_LABEL[fr[key].toLowerCase()] = canonical;
}

export function canonicalSubcategory(label: string): string {
  return CANONICAL_BY_LABEL[label.trim().toLowerCase()] ?? label;
}
