import { en, type StringKey } from '../constants/i18n/en';
import { fr } from '../constants/i18n/fr';

// Locale registry. Adding a language = import its strings file and register
// it here (keys mirror en.ts). The active locale is driven by the store
// (useBudgetStore.locale); detection falls back to 'en'.
const BUNDLES: Record<string, Partial<Record<StringKey, string>>> = {
  en,
  fr,
};

let activeLocale = 'en';

/** Called by the store when the user's locale changes. */
export function setActiveLocale(locale: string): void {
  // Match by language prefix (e.g. 'fr-FR' → 'fr'); fall back to 'en'.
  const lang = (locale || 'en').split('-')[0].toLowerCase();
  activeLocale = BUNDLES[lang] ? lang : 'en';
}

/**
 * Translate a key. Falls back to the English string, then to the key itself,
 * so a missing translation is always visible rather than blank.
 * Supports {placeholder} interpolation via `vars`.
 */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  const bundle = BUNDLES[activeLocale] ?? en;
  let str: string = bundle[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}
