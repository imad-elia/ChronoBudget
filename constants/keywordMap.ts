import { getActiveLocale } from '../lib/i18n';
import { getKeywordMap, type KeywordTarget } from './keywords';

export type { KeywordTarget };

// Active-language seed dictionary, re-read on every call so it follows the
// user's current language (see lib/i18n.ts's activeLocale) instead of being
// frozen at import time.
export function getActiveKeywordMap(): Record<string, KeywordTarget> {
  return getKeywordMap(getActiveLocale());
}
