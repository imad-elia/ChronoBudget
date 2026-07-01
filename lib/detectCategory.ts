import type { Category } from '../store/useBudgetStore';
import { KEYWORD_MAP, type KeywordTarget } from '../constants/keywordMap';

// Map of user-learned keywords → target, loaded from SQLite (keyword_learn).
export type LearnedMap = Record<string, KeywordTarget>;

export interface ParsedEntry {
  amount: number | null;
  description: string;
}

export interface Detection {
  category: Category;
  subcategory: string;
  matched: boolean;
}

const DEFAULT_CATEGORY: Category = 'needs';

/**
 * Parse a raw Fast-mode entry like "15 coffee" or "coffee 15" into an amount
 * and a description. The first number-like token (supporting "15", "15.50",
 * "15,50") becomes the amount; every other token forms the description.
 */
export function parseEntry(raw: string): ParsedEntry {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { amount: null, description: '' };

  const tokens = trimmed.split(/\s+/);
  let amount: number | null = null;
  const descTokens: string[] = [];

  for (const token of tokens) {
    if (amount === null) {
      const normalized = token.replace(',', '.');
      // Pure number token (optionally with a leading currency symbol).
      const numeric = normalized.replace(/^[^\d.]+/, '');
      if (numeric !== '' && /^\d*\.?\d+$/.test(numeric)) {
        const parsed = parseFloat(numeric);
        if (!isNaN(parsed)) {
          amount = parsed;
          continue;
        }
      }
    }
    descTokens.push(token);
  }

  return { amount, description: descTokens.join(' ') };
}

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Classify a free-text description into a category + subcategory.
 * Lookup order: learned map first, then the seed KEYWORD_MAP. The first token
 * that matches wins. No match → default category with the description
 * (title-cased) as the subcategory, and matched=false.
 */
export function detectCategory(description: string, learned: LearnedMap = {}): Detection {
  const desc = (description ?? '').trim();
  if (!desc) {
    return { category: DEFAULT_CATEGORY, subcategory: '', matched: false };
  }

  const tokens = desc
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const hit = learned[token] ?? KEYWORD_MAP[token];
    if (hit) {
      return { category: hit.category, subcategory: hit.subcategory, matched: true };
    }
  }

  return { category: DEFAULT_CATEGORY, subcategory: titleCase(desc), matched: false };
}

/**
 * The keyword we store when learning from a correction: the first meaningful
 * token of the description (lowercased, punctuation-stripped).
 */
export function learnKey(description: string): string {
  const tokens = (description ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return tokens[0] ?? '';
}
