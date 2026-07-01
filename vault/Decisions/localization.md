# Decision: Currency/formatting localization + i18n-ready string structure

**Date:** 2026-07-01
**Status:** Accepted

## Context

Currency was hardcoded as `en-US` / `USD` (and a literal `$`) in 6+ places. Users
in other countries need their own currency and number formatting. Full UI
translation is a large ongoing effort; the immediate, high-value slice is
currency + formatting. The user asked to **ship English-only display now** but with
a strings-file structure so translations can be added later.

## Decision

Two layers, both centralized:

1. **Currency / number / date formatting** — `lib/format.ts` exposes
   `formatCurrency`, `formatCompactCurrency`, `formatNumber`, `formatDate`, reading
   the active `locale`/`currency`/`symbol`/`currencyDecimals` from the Zustand store.
   Each tries `Intl.NumberFormat(locale, …)` and **falls back** to a manual
   `symbol + grouped digits` formatter in a try/catch, because Hermes' bundled Intl
   does not support every locale/currency. The explicit `symbol` per country (in
   `constants/countries.ts`) guarantees the fallback never renders blank.
   All hardcoded `en-US`/`USD`/`$` sites now call these helpers.

2. **i18n scaffolding (English only today)** — `constants/i18n/en.ts` is the flat
   "properties file" of all user-facing strings; `lib/i18n.ts` exposes `t(key, vars)`
   with an `en`-only registry, language-prefix matching, and key/`en` fallback.
   Adding a language = a sibling file (e.g. `fr.ts`) registered in `lib/i18n.ts`.

## Data & entry points

- `constants/countries.ts` — 20 countries → {code, name, locale, currency, symbol,
  language, decimals}. Persisted via existing `app_settings` key `country` (no schema
  change). Store actions `loadLocale()` / `setCountry()`; `setCountry` bumps
  `refreshCounter` so currency-formatting screens that read via `getState()` re-render.
- **Onboarding** first step "Where are you?" pre-fills from `expo-localization`
  device region for the user to approve.
- **Settings** — new `components/SettingsModal.tsx` (gear icon in the dashboard
  header, LimitsModal pattern) to change country/currency later.

## Consequences

- One new Expo dependency: `expo-localization` (Expo Go compatible).
- Currency updates everywhere immediately on change; verified on web (USD→GBP).
- UI text stays English but every string is already routed through `t()`, so
  translation is drop-in with no code changes.

## Related notes

- [[smart-input-classifier]] — shipped in the same session
- [[APIs]] — settings keys and DB functions
- [[Components]] — SettingsModal, OnboardingOverlay
