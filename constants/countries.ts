// Country → locale / currency / symbol / language. `symbol` is stored explicitly
// so currency formatting has a reliable fallback when Hermes' bundled Intl does
// not support a given locale/currency (see lib/format.ts).
export interface Country {
  code: string;      // ISO 3166-1 alpha-2
  name: string;
  locale: string;    // BCP-47 locale for Intl formatting
  currency: string;  // ISO 4217 code
  symbol: string;    // display symbol used by the fallback formatter
  language: string;  // BCP-47 language (for future i18n)
  decimals: number;  // fraction digits for the fallback formatter
}

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States',  locale: 'en-US', currency: 'USD', symbol: '$',  language: 'en', decimals: 2 },
  { code: 'GB', name: 'United Kingdom', locale: 'en-GB', currency: 'GBP', symbol: '£',  language: 'en', decimals: 2 },
  { code: 'DE', name: 'Germany',        locale: 'de-DE', currency: 'EUR', symbol: '€',  language: 'de', decimals: 2 },
  { code: 'FR', name: 'France',         locale: 'fr-FR', currency: 'EUR', symbol: '€',  language: 'fr', decimals: 2 },
  { code: 'ES', name: 'Spain',          locale: 'es-ES', currency: 'EUR', symbol: '€',  language: 'es', decimals: 2 },
  { code: 'IT', name: 'Italy',          locale: 'it-IT', currency: 'EUR', symbol: '€',  language: 'it', decimals: 2 },
  { code: 'CA', name: 'Canada',         locale: 'en-CA', currency: 'CAD', symbol: 'CA$', language: 'en', decimals: 2 },
  { code: 'AU', name: 'Australia',      locale: 'en-AU', currency: 'AUD', symbol: 'A$', language: 'en', decimals: 2 },
  { code: 'JP', name: 'Japan',          locale: 'ja-JP', currency: 'JPY', symbol: '¥',  language: 'ja', decimals: 0 },
  { code: 'IN', name: 'India',          locale: 'en-IN', currency: 'INR', symbol: '₹',  language: 'en', decimals: 2 },
  { code: 'CN', name: 'China',          locale: 'zh-CN', currency: 'CNY', symbol: '¥',  language: 'zh', decimals: 2 },
  { code: 'BR', name: 'Brazil',         locale: 'pt-BR', currency: 'BRL', symbol: 'R$', language: 'pt', decimals: 2 },
  { code: 'MX', name: 'Mexico',         locale: 'es-MX', currency: 'MXN', symbol: '$',  language: 'es', decimals: 2 },
  { code: 'MA', name: 'Morocco',        locale: 'ar-MA', currency: 'MAD', symbol: 'DH', language: 'ar', decimals: 2 },
  { code: 'SA', name: 'Saudi Arabia',   locale: 'ar-SA', currency: 'SAR', symbol: 'SR', language: 'ar', decimals: 2 },
  { code: 'AE', name: 'UAE',            locale: 'ar-AE', currency: 'AED', symbol: 'AED', language: 'ar', decimals: 2 },
  { code: 'CH', name: 'Switzerland',    locale: 'de-CH', currency: 'CHF', symbol: 'CHF', language: 'de', decimals: 2 },
  { code: 'SE', name: 'Sweden',         locale: 'sv-SE', currency: 'SEK', symbol: 'kr', language: 'sv', decimals: 2 },
  { code: 'ZA', name: 'South Africa',   locale: 'en-ZA', currency: 'ZAR', symbol: 'R',  language: 'en', decimals: 2 },
  { code: 'NG', name: 'Nigeria',        locale: 'en-NG', currency: 'NGN', symbol: '₦',  language: 'en', decimals: 2 },
];

export const DEFAULT_COUNTRY: Country = COUNTRIES[0]; // United States

export function findCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}
