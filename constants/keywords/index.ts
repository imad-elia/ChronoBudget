import { EN_KEYWORDS, type KeywordTarget } from './en';
import { FR_KEYWORDS } from './fr';

export type { KeywordTarget };

// Keyword-dictionary registry. Adding a language = import its keyword file and
// register it here (mirrors lib/i18n.ts's BUNDLES pattern for UI strings).
export const KEYWORD_MAPS: Record<string, Record<string, KeywordTarget>> = {
  en: EN_KEYWORDS,
  fr: FR_KEYWORDS,
};

export function getKeywordMap(language: string): Record<string, KeywordTarget> {
  return KEYWORD_MAPS[language] ?? KEYWORD_MAPS.en;
}
