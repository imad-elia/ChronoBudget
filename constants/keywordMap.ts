import { getKeywordMap, type KeywordTarget } from './keywords';

export type { KeywordTarget };

// Active-language seed dictionary. English-only today (see constants/keywords) —
// swapping in the user's active locale is a documented future step.
export const KEYWORD_MAP: Record<string, KeywordTarget> = getKeywordMap('en');
