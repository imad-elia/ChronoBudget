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

## Subcategory display translation (2026-07-27, later session)

User report: editing a transaction while in French still showed English text.
Found a translation-readiness gap distinct from the ones above: **subcategory
names** (`constants/subcategories.ts`'s `SUBCATEGORIES` — Rent, Dining, Emergency
Fund, etc.) were never routed through `t()` at all, unlike categories. The raw
English string doubles as both the DB-stored value and the chip display label,
so every render site (`ExpenseInput.tsx`, `EditTransactionModal.tsx`,
`KeywordsModal.tsx`, `RecurringModal.tsx`, plus the Dashboard/History recent-
transaction row labels in `index.tsx`/`history.tsx`) just echoed it back
untranslated.

Fixed with a **display-only** translation layer, mirroring `CATEGORY_LABEL_KEY`:
15 new `subcategory.*` keys in `en.ts`/`fr.ts`, and a `SUBCATEGORY_LABEL_KEY`
map + `subcategoryLabel()` helper (both in `constants/subcategories.ts`) that
looks up the canonical English string and translates it for display, falling
through unchanged for user-typed custom subcategories. The canonical string
itself is untouched — still what's stored in `transactions.subcategory` and
still what the EN/FR keyword dictionaries in `lib/detectCategory.ts` target —
so this was purely a rendering fix, no schema/detection changes. See
[[open-issues]] for the full list of call sites and verification notes.

## More frozen-t()-at-import-time instances + tab bar (2026-07-27, part 5)

Follow-up to the "Frozen module-scope `t()` calls" fix above: the same bug
(computing a `CATEGORY_LABEL` object once at module load instead of at render
time) was still present in **two files that fix missed**:
`EditTransactionModal.tsx` and `RecurringModal.tsx`. Both switched to the
`CATEGORY_LABEL_KEY` map + `t(CATEGORY_LABEL_KEY[id])`-at-render pattern, same
as `ExpenseInput.tsx`.

Also fixed: the tab bar (`app/(tabs)/_layout.tsx`) had never been localized
at all — `title: 'Dashboard'` etc. were literal strings with zero `t()`
involvement. Now uses `t('tabs.dashboard')` (new key) and the existing
`history.title`/`trends.title` keys, with the layout component subscribed to
`useBudgetStore((s) => s.symbol)` purely to force a re-render on language
change (same forcing pattern as `KeywordsModal.tsx`).

This round was verified via `tsc --noEmit` + full test suite only, at the
user's explicit request (no live browser check) — see [[open-issues]] for
what to manually verify.

## Tab bar reactivity fix (2026-07-27, part 6)

The tab bar title fix in part 5 above worked on a fresh app load but not for a
live in-session language switch — user caught this by changing language from
Settings without restarting. Root cause: `app/(tabs)/_layout.tsx` subscribed to
`useBudgetStore((s) => s.symbol)` purely to force a re-render on language
change, copying the "no-op subscription" trick used in `KeywordsModal.tsx`
(part 5). But that trick only works if the subscribed field actually changes
on the event you care about — `symbol` changes with country/currency, not with
a same-country language-only switch via `setLanguage()` (which only touches
`language` and `refreshCounter`). Every *other* screen happened to already
subscribe to `refreshCounter` for unrelated reasons (refetching data on
change), so they re-rendered correctly; the tab layout had no such
subscription. Fixed by subscribing to `s.language` directly — the one field
guaranteed to change on every language switch, explicit rather than a proxy.
**Lesson for future no-op-subscription forcing hooks: subscribe to the field
that actually changes for the event in question, not one that happens to
change for a different, related reason.**

## Onboarding tour copy translated + confirmed location-based first-time language (2026-08-29)

Two loose ends closed after the user confirmed the part-6 tab bar/country-dropdown fixes were all good:

- **Tour copy was hardcoded English.** `OnboardingOverlay.tsx`'s 4-step tour
  (`STEPS` array: Welcome / Fast Mode / Detailed Mode / Budget Limits) held
  literal `title`/`body` strings, never routed through `t()` — the only
  onboarding step left in this state (the country and starting-balance steps
  were already `t()`-routed). Fixed the same way as the `CATEGORY_LABEL_KEY`
  pattern above: `Step.title`/`Step.body` became `Step.titleKey`/`bodyKey`
  (`StringKey` references), and the render call switched from `current.title`
  to `t(current.titleKey)` — resolved at render time, not baked into the
  module-level `STEPS` constant. 8 new keys added to `en.ts`/`fr.ts`
  (`onboarding.tourWelcomeTitle`/`Body`, `tourFastTitle`/`Body`,
  `tourDetailedTitle`/`Body`, `tourLimitsTitle`/`Body`).
- **"Can first-time language be chosen based on location?"** — investigated
  and confirmed this was **already implemented**, no new code needed: the
  country-picker step already pre-fills from `expo-localization`'s device
  region (`Localization.getLocales?.()[0]?.regionCode` → `findCountry()`),
  and `setCountry()` already defaults `language` from that country's
  `language` field via `resolveLanguage()` — but only on a genuine first pick
  (`getSetting('language')` unset), per the "Independent language selector"
  section above. Since onboarding's phase order is `country` → `balance` →
  `tour`, the language is already resolved by the time the (now-translated)
  tour renders, so a first-time French user sees the tour in French with no
  extra step. Confirmed via code read, not a new mechanism.

Verified via `tsc --noEmit` (clean) and `npm test` (261/261 — same
pre-existing worktree/Playwright noise as always). No live browser check this
round, per explicit user request; awaiting manual verification.

## Onboarding: back navigation across phases (2026-08-29, later)

Follow-up to the tour translation above: the user asked for a way to correct a
wrong country/currency pick without restarting onboarding. `OnboardingOverlay.tsx`'s
three phases (`country` → `balance` → `tour`) previously only went forward — the
balance step had no way back to country, and the tour's first step hid its Back
button entirely (it only ever stepped backward *within* the 4-step tour array).

Fixed by chaining Back across phases instead of just within the tour:
- Tour step 0's Back button (previously hidden via `!isFirst`) now always shows
  and calls a new `handleBack()`, which goes to the `balance` phase when
  `step === 0`, or decrements `step` otherwise.
- The balance phase gained a "‹ Back" link (reusing the existing `onboarding.back`
  key — no new i18n strings needed) next to the existing "Skip for now" link,
  in a new `countryStyles.bottomLinks` row, that calls `setPhase('country')`.
- No change needed to the country phase itself (nothing precedes it), or to
  state handling: `picked` (draft country selection) and `balanceDrafts` are
  plain component state that already persists across phase switches, so
  navigating back and forth doesn't lose in-progress input. Re-confirming a
  (possibly different) country on re-continue re-runs the existing
  `setCountry(picked)`, which already updates currency/symbol/language
  correctly (see "Independent language selector" above).

Deliberately used plain auto-sized text links for the new balance-phase Back
button rather than reusing the flex-sized `styles.backBtn`/`nextBtn` pair —
this file's own comment on `countryStyles.continueBtn` warns those flex-based
button styles collapse to 0 height in this component's vertical (non-row)
card layout on native Yoga; only fixed-size flex buttons hit that bug, so two
plain text touchables in a row is safe.

Verified via `tsc --noEmit` + full test suite only, per explicit user
request (no live browser check this round).

**Follow-up (same session):** the tour's Back button was moved out of the
bordered `actions` row (next to the primary Next/Got it button) and down to
the same row as "Skip tutorial", styled as a matching plain text link
(`styles.skipLabel`) instead of a bordered button. The primary `actions` row
now holds only the Next/Got it button (full width). Removed the now-unused
`backBtn`/`backLabel`/`skipBtn` styles; added a `bottomLinks` style (mirrors
`countryStyles.bottomLinks` added for the balance-phase Back link above) —
`flexDirection: 'row', justifyContent: 'space-between'` holding Back (always
shown) and Skip tutorial (hidden on the last step).

## Related notes

- [[smart-input-classifier]] — shipped in the same session; French keyword
  dictionary (2026-07-27) reuses `getActiveLocale()` from this note's export
- [[APIs]] — settings keys and DB functions
- [[Components]] — SettingsModal, OnboardingOverlay
