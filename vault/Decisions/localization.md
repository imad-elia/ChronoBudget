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

2. **i18n scaffolding** — `constants/i18n/en.ts` is the flat "properties file" of
   all user-facing strings; `lib/i18n.ts` exposes `t(key, vars)` with a registry,
   language-prefix matching, and key/`en` fallback. Adding a language = a sibling
   file registered in `lib/i18n.ts` — confirmed drop-in: `constants/i18n/fr.ts`
   shipped 2026-07-27 (full French translation, ~100 keys) with no other code
   changes needed for already-`t()`-routed strings.

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

## French locale + i18n reactivity fixes (2026-07-27)

Shipping the first real second language (French) surfaced two latent bugs and a
translation-readiness gap in the scaffolding above:

- **Frozen module-scope `t()` calls** — four files (`SettingsModal.tsx`,
  `OnboardingOverlay.tsx`, `KeywordsModal.tsx`, `ExpenseInput.tsx`) computed a
  `t()`-derived label array/object once at import time (e.g.
  `const CATEGORY_LABEL = { needs: t('category.needs'), … }`), so the label was
  frozen to whichever locale was active on first load and never updated. Fixed by
  keeping only the `StringKey` mapping at module scope (e.g.
  `CATEGORY_LABEL_KEY = { needs: 'category.needs', … } as const`) and calling
  `t(CATEGORY_LABEL_KEY[id])` inside the render, so it re-evaluates every render.
  The `ExpenseInput.tsx` instance was found live in the browser during
  verification, after the other three had already been scoped — same bug class,
  same fix.
- **Reactivity gap** — `t()` reads a plain module-level variable, not a
  subscribed Zustand field. `setCountry()`/`loadLocale()` already bump
  `refreshCounter`/`symbol` alongside `locale`, and every screen/modal calling
  `t()` already subscribed to one of those *except* `KeywordsModal.tsx`. Fixed by
  adding a no-op `useBudgetStore((s) => s.symbol)` subscription there purely to
  force a re-render on locale change — same pattern already used elsewhere, no
  Context introduced.
- **Translation-readiness gap** — ~15 hardcoded strings across `BentoCard.tsx`,
  `OnboardingOverlay.tsx`, `trends.tsx`, `history.tsx`, and `index.tsx` were never
  routed through `t()` at all (the "OVER" badge, tour Back/Next/Skip buttons,
  screen titles/empty states, budget-limits modal, category names baked directly
  into `BENTO_CONFIG`/`CATEGORY_CONFIG`/`FILTERS` module constants instead of
  looked up via `t('category.*')`). All now route through `t()`, with new keys
  added to `en.ts`/`fr.ts` (duplicates like `history.title`/`trends.title`/
  `history.empty`/`edit.cancel` were reused rather than creating near-duplicate
  keys).
- Also found but **out of scope, flagged separately**: `LimitsModal` (in
  `index.tsx`) hardcodes a literal `$` prefix instead of subscribing to the
  store's `symbol`, unlike every other money input in the app. (Fixed
  2026-07-27 — see [[open-issues]].)

## Independent language selector (2026-07-27)

The scope decision above ("language stays derived from country selection
only") was revisited: `store/useBudgetStore.ts` gained a `language` field
independent of `country`/`locale`, persisted via `app_settings` key
`language`. `setCountry()` only sets a default `language` when no explicit
choice has ever been persisted (checked via `getSetting('language')` — if
present, a later country/currency change no longer silently flips the UI
language). `setLanguage()` persists explicitly and is the only way to change
language after a first pick. A picker (`SUPPORTED_LANGUAGES` — currently
`en`/`fr`, i.e. only locales with a real translation bundle) was added to
`SettingsModal.tsx`, right below the country list. `getActiveLocale()` was
added to `lib/i18n.ts` so other modules (the smart-input keyword map) can
read the active language without importing the store directly.

## Related notes

- [[smart-input-classifier]] — shipped in the same session; French keyword
  dictionary (2026-07-27) reuses `getActiveLocale()` from this note's export
- [[APIs]] — settings keys and DB functions
- [[Components]] — SettingsModal, OnboardingOverlay
