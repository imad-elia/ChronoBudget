import type { Category } from '../store/useBudgetStore';
import { getActiveKeywordMap, type KeywordTarget } from '../constants/keywordMap';
import { getActiveLocale } from './i18n';

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

/**
 * Strip diacritics (é→e, à→a, ç→c, ...) so accented input matches the
 * unaccented dictionary keys used by constants/keywords/fr.ts (and any future
 * accented-language dictionary), regardless of whether the user typed the
 * accent.
 */
function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokenize(desc: string): string[] {
  return stripDiacritics(desc.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Candidate stems to retry as an exact lookup when a token has no direct hit.
 * Handles the common English suffix cases: consonant+y plurals ("bakeries" →
 * "bakery"), -ing forms that dropped a silent e ("commuting" → "commute"),
 * and plain -s/-es plurals. Order doesn't matter here — all candidates are
 * tried and the caller stops at the first dictionary hit.
 */
function stemCandidatesEn(token: string): string[] {
  const candidates: string[] = [];
  if (token.endsWith('ies') && token.length - 3 >= 3) {
    candidates.push(token.slice(0, -3) + 'y');
  }
  if (token.endsWith('ing') && token.length - 3 >= 3) {
    const stem = token.slice(0, -3);
    candidates.push(stem, stem + 'e');
  }
  if (token.endsWith('es') && token.length - 2 >= 3) {
    candidates.push(token.slice(0, -2));
  }
  if (token.endsWith('s') && token.length - 1 >= 3) {
    candidates.push(token.slice(0, -1));
  }
  return candidates;
}

/**
 * French suffix variants: plain -s/-x plurals ("factures" → "facture"),
 * feminine -e ("etudiante" → "etudiant"), and common verb endings
 * ("mangeons"-style -ez/-ent conjugations reduced toward their stem).
 */
function stemCandidatesFr(token: string): string[] {
  const candidates: string[] = [];
  if ((token.endsWith('s') || token.endsWith('x')) && token.length - 1 >= 3) {
    candidates.push(token.slice(0, -1));
  }
  if (token.endsWith('ent') && token.length - 3 >= 3) {
    candidates.push(token.slice(0, -3));
  }
  if (token.endsWith('ez') && token.length - 2 >= 3) {
    candidates.push(token.slice(0, -2) + 'er');
  }
  if (token.endsWith('e') && token.length - 1 >= 3) {
    candidates.push(token.slice(0, -1));
  }
  return candidates;
}

function stemCandidates(token: string): string[] {
  return getActiveLocale() === 'fr' ? stemCandidatesFr(token) : stemCandidatesEn(token);
}

/** Bounded Levenshtein distance check — returns false early if a match at `maxDistance` is impossible. */
function withinLevenshtein(a: string, b: string, maxDistance: number): boolean {
  if (Math.abs(a.length - b.length) > maxDistance) return false;

  const prevRow = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prevRow[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prevRow[0];
    prevRow[0] = i;
    let rowMin = prevRow[0];
    for (let j = 1; j <= b.length; j++) {
      const temp = prevRow[j];
      prevRow[j] = a[i - 1] === b[j - 1]
        ? prevDiag
        : 1 + Math.min(prevDiag, prevRow[j], prevRow[j - 1]);
      prevDiag = temp;
      if (prevRow[j] < rowMin) rowMin = prevRow[j];
    }
    if (rowMin > maxDistance) return false;
  }

  return prevRow[b.length] <= maxDistance;
}

/**
 * Fuzzy fallback for a single token: exact-lookup a stemmed variant first,
 * then a bounded-edit-distance scan of the dictionary keys. `learned` is
 * checked before `KEYWORD_MAP` at each tier, mirroring the exact-match
 * precedence. Tokens under 3 characters are skipped entirely — too short for
 * edit-distance matching to avoid false positives against unrelated words.
 */
function fuzzyLookup(token: string, learned: LearnedMap): KeywordTarget | undefined {
  if (token.length < 3) return undefined;

  const keywordMap = getActiveKeywordMap();

  for (const stem of stemCandidates(token)) {
    const hit = learned[stem] ?? keywordMap[stem];
    if (hit) return hit;
  }

  const maxDistance = token.length <= 5 ? 1 : 2;
  for (const key of Object.keys(learned)) {
    if (withinLevenshtein(token, key, maxDistance)) return learned[key];
  }
  for (const key of Object.keys(keywordMap)) {
    if (withinLevenshtein(token, key, maxDistance)) return keywordMap[key];
  }

  return undefined;
}

/**
 * Classify a free-text description into a category + subcategory.
 *
 * Two-pass token scan:
 * 1. Exact: learned map first, then the seed KEYWORD_MAP — first token that
 *    matches wins, as before.
 * 2. Fuzzy fallback (only if pass 1 found nothing): the same tokens, in the
 *    same order, tried against stemmed/typo-tolerant variants. This means an
 *    exact match on a later token always beats a fuzzy match on an earlier
 *    one, since pass 1 always completes first.
 *
 * No match in either pass → default category with the description
 * (title-cased) as the subcategory, and matched=false. Fuzzy hits set
 * matched=true just like exact hits, so they aren't auto-learned unless the
 * user overrides the guess (see ExpenseInput's learn-on-override trigger).
 */
export function detectCategory(description: string, learned: LearnedMap = {}): Detection {
  const desc = (description ?? '').trim();
  if (!desc) {
    return { category: DEFAULT_CATEGORY, subcategory: '', matched: false };
  }

  const tokens = tokenize(desc);

  const keywordMap = getActiveKeywordMap();

  for (const token of tokens) {
    const hit = learned[token] ?? keywordMap[token];
    if (hit) {
      return { category: hit.category, subcategory: hit.subcategory, matched: true };
    }
  }

  for (const token of tokens) {
    const hit = fuzzyLookup(token, learned);
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
  const tokens = tokenize(description ?? '');
  return tokens[0] ?? '';
}
