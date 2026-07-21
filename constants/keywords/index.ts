import { EN_KEYWORDS, type KeywordTarget } from './en';

export type { KeywordTarget };

// Keyword-dictionary registry. Only English ships today; adding a language =
// import its keyword file and register it here (mirrors lib/i18n.ts's BUNDLES
// pattern for UI strings).
export const KEYWORD_MAPS: Record<string, Record<string, KeywordTarget>> = {
  en: EN_KEYWORDS,
};

export function getKeywordMap(language: string): Record<string, KeywordTarget> {
  return KEYWORD_MAPS[language] ?? KEYWORD_MAPS.en;
}
