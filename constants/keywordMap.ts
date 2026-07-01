import type { Category } from '../store/useBudgetStore';

export interface KeywordTarget {
  category: Category;
  subcategory: string;
}

// Seed dictionary: lowercase keyword → target category + subcategory.
// Subcategories intentionally map onto the existing SUBCATEGORIES lists so the
// override chips always have a matching entry. Learned corrections (SQLite)
// take precedence over these at detection time — see lib/detectCategory.ts.
export const KEYWORD_MAP: Record<string, KeywordTarget> = {
  // ─── needs · Groceries ──────────────────────────────────────────────
  groceries: { category: 'needs', subcategory: 'Groceries' },
  grocery: { category: 'needs', subcategory: 'Groceries' },
  supermarket: { category: 'needs', subcategory: 'Groceries' },
  market: { category: 'needs', subcategory: 'Groceries' },
  aldi: { category: 'needs', subcategory: 'Groceries' },
  lidl: { category: 'needs', subcategory: 'Groceries' },
  walmart: { category: 'needs', subcategory: 'Groceries' },
  costco: { category: 'needs', subcategory: 'Groceries' },
  food: { category: 'needs', subcategory: 'Groceries' },

  // ─── needs · Transport ──────────────────────────────────────────────
  uber: { category: 'needs', subcategory: 'Transport' },
  taxi: { category: 'needs', subcategory: 'Transport' },
  cab: { category: 'needs', subcategory: 'Transport' },
  bus: { category: 'needs', subcategory: 'Transport' },
  metro: { category: 'needs', subcategory: 'Transport' },
  train: { category: 'needs', subcategory: 'Transport' },
  subway: { category: 'needs', subcategory: 'Transport' },
  fuel: { category: 'needs', subcategory: 'Transport' },
  gas: { category: 'needs', subcategory: 'Transport' },
  petrol: { category: 'needs', subcategory: 'Transport' },
  parking: { category: 'needs', subcategory: 'Transport' },

  // ─── needs · Rent ───────────────────────────────────────────────────
  rent: { category: 'needs', subcategory: 'Rent' },
  mortgage: { category: 'needs', subcategory: 'Rent' },

  // ─── needs · Bills ──────────────────────────────────────────────────
  bill: { category: 'needs', subcategory: 'Bills' },
  bills: { category: 'needs', subcategory: 'Bills' },
  electricity: { category: 'needs', subcategory: 'Bills' },
  water: { category: 'needs', subcategory: 'Bills' },
  internet: { category: 'needs', subcategory: 'Bills' },
  phone: { category: 'needs', subcategory: 'Bills' },
  wifi: { category: 'needs', subcategory: 'Bills' },

  // ─── needs · Health ─────────────────────────────────────────────────
  pharmacy: { category: 'needs', subcategory: 'Health' },
  doctor: { category: 'needs', subcategory: 'Health' },
  dentist: { category: 'needs', subcategory: 'Health' },
  medicine: { category: 'needs', subcategory: 'Health' },
  gym: { category: 'needs', subcategory: 'Health' },

  // ─── needs · Education ──────────────────────────────────────────────
  book: { category: 'needs', subcategory: 'Education' },
  books: { category: 'needs', subcategory: 'Education' },
  course: { category: 'needs', subcategory: 'Education' },
  tuition: { category: 'needs', subcategory: 'Education' },

  // ─── wants · Dining ─────────────────────────────────────────────────
  coffee: { category: 'wants', subcategory: 'Dining' },
  starbucks: { category: 'wants', subcategory: 'Dining' },
  latte: { category: 'wants', subcategory: 'Dining' },
  cappuccino: { category: 'wants', subcategory: 'Dining' },
  restaurant: { category: 'wants', subcategory: 'Dining' },
  lunch: { category: 'wants', subcategory: 'Dining' },
  dinner: { category: 'wants', subcategory: 'Dining' },
  breakfast: { category: 'wants', subcategory: 'Dining' },
  pizza: { category: 'wants', subcategory: 'Dining' },
  burger: { category: 'wants', subcategory: 'Dining' },
  beer: { category: 'wants', subcategory: 'Dining' },
  bar: { category: 'wants', subcategory: 'Dining' },
  snack: { category: 'wants', subcategory: 'Dining' },

  // ─── wants · Entertainment ──────────────────────────────────────────
  movie: { category: 'wants', subcategory: 'Entertainment' },
  cinema: { category: 'wants', subcategory: 'Entertainment' },
  game: { category: 'wants', subcategory: 'Entertainment' },
  games: { category: 'wants', subcategory: 'Entertainment' },
  concert: { category: 'wants', subcategory: 'Entertainment' },

  // ─── wants · Shopping ───────────────────────────────────────────────
  clothes: { category: 'wants', subcategory: 'Shopping' },
  shoes: { category: 'wants', subcategory: 'Shopping' },
  amazon: { category: 'wants', subcategory: 'Shopping' },
  shopping: { category: 'wants', subcategory: 'Shopping' },

  // ─── wants · Travel ─────────────────────────────────────────────────
  flight: { category: 'wants', subcategory: 'Travel' },
  hotel: { category: 'wants', subcategory: 'Travel' },
  trip: { category: 'wants', subcategory: 'Travel' },
  vacation: { category: 'wants', subcategory: 'Travel' },

  // ─── wants · Subscriptions ──────────────────────────────────────────
  netflix: { category: 'wants', subcategory: 'Subscriptions' },
  spotify: { category: 'wants', subcategory: 'Subscriptions' },
  subscription: { category: 'wants', subcategory: 'Subscriptions' },
  youtube: { category: 'wants', subcategory: 'Subscriptions' },

  // ─── savings · Emergency Fund ───────────────────────────────────────
  emergency: { category: 'savings', subcategory: 'Emergency Fund' },
  savings: { category: 'savings', subcategory: 'Emergency Fund' },

  // ─── savings · Investment ───────────────────────────────────────────
  investment: { category: 'savings', subcategory: 'Investment' },
  stocks: { category: 'savings', subcategory: 'Investment' },
  crypto: { category: 'savings', subcategory: 'Investment' },

  // ─── savings · Retirement ───────────────────────────────────────────
  retirement: { category: 'savings', subcategory: 'Retirement' },
  pension: { category: 'savings', subcategory: 'Retirement' },
};
