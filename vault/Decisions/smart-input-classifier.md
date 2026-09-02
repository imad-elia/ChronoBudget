# Decision: Local keyword classifier with learning for smart input

**Date:** 2026-07-01
**Status:** Accepted

## Context

Fast mode originally accepted only a numeric amount and filed everything under the
last-selected category with no subcategory. The product intent was a single natural
entry like "15 coffee" → **Wants · Dining** with zero taps. The app is offline-first
with no backend and no account system, which rules out a cloud LLM classifier.

## Decision

A **local keyword dictionary that also learns** from the user's manual corrections,
plus a direct-teach UI for manually adding keywords.

- **`lib/detectCategory.ts`** — pure, RN-free (unit-testable) module:
  - `parseEntry(raw)` extracts the first numeric token as the amount ("15 coffee",
    "coffee 15", "15.50", "15,50") and the rest as a description.
  - `detectCategory(desc, learned)` normalizes → tokens; looks up the **learned map
    first**, then the seed `KEYWORD_MAP`. First token match wins. No match →
    default category (`needs`) + title-cased description as the subcategory.
  - `learnKey(desc)` returns the first meaningful token to store when learning.
- **`constants/keywords/`** — per-language keyword registry (2026-07-21 restructure,
  mirrors `lib/i18n.ts`'s `BUNDLES` pattern):
  - `constants/keywords/en.ts` — `EN_KEYWORDS`, ~350 seeded keywords → {category,
    subcategory}, mapping onto the existing `SUBCATEGORIES` names so override chips
    always match. Grown from the original ~90-entry seed list for broader real-world
    coverage (more grocery/retail chains, transport/rideshare brands, delivery apps,
    streaming/subscription services, etc.).
  - `constants/keywords/index.ts` — `KEYWORD_MAPS` registry + `getKeywordMap(lang)`;
    only `en` is registered today. Adding a language = a sibling keyword file
    registered here, same shape as `lib/i18n.ts`.
  - `constants/keywordMap.ts` — thin re-export (`KEYWORD_MAP = getKeywordMap('en')`)
    kept for import-path stability; swapping in the user's active locale instead of
    a hardcoded `'en'` is a documented future step, not done yet.
- **Learning storage** — schema **v4** table `keyword_learn(keyword PK, category,
  subcategory, count, updated_at)`. `learnKeyword()` upserts (count++),
  `fetchLearnedKeywords()` loads the whole table into a Zustand cache
  (`learnedKeywords`) for **synchronous** detection while typing, and
  `deleteLearnedKeyword()` (added 2026-07-21) removes a row.
- **When we learn:** only on `overridden || !matched` at submit — i.e. the user
  corrected the guess or accepted a no-match. We never learn the dictionary's own
  untouched hits (nothing new to store).
- **Manual keyword management (2026-07-21)** — `components/KeywordsModal.tsx`,
  opened via a "My Keywords" row in `SettingsModal.tsx`. Lets a user directly
  add/edit/delete entries in the same `keyword_learn` table used by correction-based
  learning (`learnKeyword()`/`deleteLearnedKeyword()` called straight from the UI,
  no new storage). Reuses the category/subcategory chip pattern from
  `EditTransactionModal.tsx`. There is no separate UI for editing the seed
  dictionary — it stays a static, code-only asset; all user-added words land in
  `keyword_learn`, which already takes precedence over the seed map at detection
  time.

## UX

- **Both** input modes show a live "→ Category · Subcategory" preview.
- **Fast:** single smart field; always follows the guess; tapping the preview
  itself ("Needs · Dining", with a small inline pencil icon) reveals the
  category/subcategory override chips (2026-08-29 — previously a separate
  "change" pencil+label button; consolidated into one tap target on the
  preview text, matching the tap-the-chip-to-change-it pattern used by every
  other chip in the app).
- **Detailed:** keeps explicit chips + note; typing the note **auto-selects** the
  chips, but only on a real keyword match, so it never fights a manual pick. Any
  manual chip tap sets `overridden` and stops auto-overriding for that entry.

## Consequences

- Fully offline, instant, deterministic, zero new runtime deps.
- Quality depends on the seed list; unknown words route to the default until
  corrected once, or a user adds one directly via My Keywords — the learning layer
  and manual management both fix this per user.
- Web (in-memory DB) forgets learned and manually-added keywords on reload; native
  persists them.

## Future work

- **Fuzzy/stemming matching** — shipped 2026-07-27, hand-rolled (no new library,
  per "avoid unnecessary libraries"). `detectCategory` is now a **two-pass** token
  scan:
  1. Exact (unchanged): learned map then `KEYWORD_MAP`, first token to hit wins.
  2. Fuzzy fallback, only if pass 1 found nothing: the same tokens, in the same
     order, each tried against (a) a stemmed exact lookup — handles consonant+y
     plurals ("bakeries" → "bakery"), -ing forms that dropped a silent e
     ("commuting" → "commute"), and plain -s/-es plurals — then (b) a bounded
     Levenshtein scan of the dictionary keys (distance ≤1 for tokens ≤5 chars,
     ≤2 for longer; tokens under 3 chars skip fuzzy matching entirely to avoid
     false positives). `learned` candidates are checked before `KEYWORD_MAP`
     candidates at each tier, mirroring exact-match precedence.
  Because pass 1 always completes in full before pass 2 ever runs, an exact match
  on a later token always beats a fuzzy match on an earlier one — no interleaving
  ambiguity. Fuzzy hits set `matched: true` just like exact hits (the `Detection`
  interface is unchanged — no new `matchType` field), so they are **not**
  auto-learned into `keyword_learn` unless the user overrides the guess: the
  existing `overridden || !matched` learn-trigger in `ExpenseInput.tsx` already
  skips learning when `matched` is true, which avoids polluting the learned table
  with fuzzy/distance-2 guesses that might be false positives — the stemmer/
  Levenshtein will simply catch the same input again next time regardless.
  All logic lives in `lib/detectCategory.ts` (`stemCandidates`, `withinLevenshtein`,
  `fuzzyLookup`); no other files changed.
- **Active-locale keyword map + French dictionary** — shipped 2026-07-27.
  `constants/keywords/fr.ts` (~250 entries) added and registered in
  `KEYWORD_MAPS`. `constants/keywordMap.ts` changed from the frozen
  `getKeywordMap('en')` constant to a live `getActiveKeywordMap()` accessor
  (re-reads the active language via `lib/i18n.ts`'s new `getActiveLocale()`
  on every call), so switching language (see [[localization]]'s independent
  language selector) immediately changes classifier behavior. The English
  suffix stemmer (`stemCandidates`) was split into locale-specific
  `stemCandidatesEn`/`stemCandidatesFr` variants selected by active locale;
  the Levenshtein fallback tier stayed language-agnostic, no change needed.
  Also added `stripDiacritics()` (Unicode NFD + combining-mark strip) so
  accented French input ("café") matches the unaccented dictionary keys used
  in `fr.ts` regardless of whether the user typed the accent.

## Fast mode now saves its leftover text as the note (2026-08-29)

User report: typing "10 coffee" correctly detected Wants · Dining, but "coffee"
seemed to vanish — it wasn't saved anywhere. The classifier itself never
discarded it (`parseEntry`/`detectCategory` in `lib/detectCategory.ts` never
mutate or truncate the description; "coffee" survives intact as
`parseEntry(raw).description`). The bug was one line downstream, in
`components/ExpenseInput.tsx`'s `handleSubmit`: the `insertTransaction` call
unconditionally passed `''` as the note for Fast-mode submissions —
`mode === 'detailed' ? note : ''` — throwing away whatever text had been
typed and used only transiently for classification.

Fixed by passing `description` (already computed once per render at
`ExpenseInput.tsx:66`, the leftover text after the amount is parsed out)
instead of `''` in the Fast-mode branch: `mode === 'detailed' ? note :
description`. Stores the **whole leftover phrase**, not just the single
matched keyword — `detectCategory` doesn't expose which token matched, and a
multi-word entry like "morning coffee run" is more useful saved in full than
truncated to "coffee". No DB/schema change: `insertTransaction`'s `note`
param was already a plain trimmed string with no fast/detailed distinction.
Updated the one test that pinned the old empty-note behavior
(`components/__tests__/ExpenseInput.test.tsx`, the `"15 coffee"` submit
assertion, `''` → `'coffee'`).

## Manual override stuck across unrelated entries (2026-08-29, later)

User report: type "15 coffee" (detects Wants · Dining), manually override to
Needs · Groceries via the preview tap, then clear the field completely and
type "15 coffee" again — it stayed on Needs · Groceries instead of
re-detecting Wants · Dining.

Root cause: `overridden` (set by `selectCategory`/`selectSubcategory`) is a
plain boolean with no concept of "which entry" it applies to. The auto-apply
effect (`useEffect` watching `detection`/`overridden`/`mode`) skips entirely
whenever `overridden` is true, and nothing ever set it back to `false` except
a full form reset after a successful submit (`resetFields()`, called from
`handleSubmit`). So a manual override, once made, silently stuck for every
subsequent entry typed in the same session until the user actually submitted
something — even a fully unrelated fresh entry.

Fixed by resetting `overridden` (and closing the override panel,
`showOverride`) whenever the fast-mode field is cleared back to empty
(`onChangeText` on the smart field, in `ExpenseInput.tsx`) — a fully cleared
field is the natural signal for "starting a new entry," distinct from just
continuing to edit/refine the current one (which intentionally keeps
respecting the override, so a manual pick doesn't get clobbered mid-edit).
Confirms the existing intended behavior: **detection is per-entry and
resets on its own; only explicit corrections at submit time (`overridden ||
!matched`) feed the learning table** — clearing the field must not require
submitting first to "unstick" a stale override. Added a regression test
(`components/__tests__/ExpenseInput.test.tsx`) covering exactly this
override → clear → retype → re-detect sequence.

## Dictionary expansion (2026-09-02)

User asked to substantially grow the seed dictionaries for broader real-world
coverage. Scoped via `AskUserQuestion`: a ~2-3x expansion, staying within the
existing regional footprint (US/UK/Canada/Western Europe for `en.ts`,
mainland France for `fr.ts` — no new countries/languages).

`constants/keywords/en.ts` grew from ~350 to **690** entries; `constants/
keywords/fr.ts` grew from ~265 to **514** entries — both counted
programmatically (a small Node script scanning for `key: { category:` lines),
not by hand, since a file this size is easy to miscount. Growth was weighted
toward the thinnest subcategories first — the four Savings subcategories
(Emergency Fund, Investment, Retirement, Goal) had only 4/11/5/3 EN entries
and 5/9/3/3 FR entries before this pass, the weakest coverage in the whole
dictionary — followed by a smaller top-up to the already-larger Needs/Wants
subcategories (more regional grocery/retail chains, brokerages/banks,
streaming/software services, airlines/hotel chains, and everyday nouns, not
just brand names).

**Collision safety was the one real risk** in a content-only change of this
size, because of the existing fuzzy/Levenshtein fallback (see "Future work"
above) and because both files are a single flat `Record<string, ...>` where a
duplicate key silently overwrites the earlier one with no compiler error.
Handled two ways:
1. Manual care while drafting — e.g. `subway` (needs · Transport, a
   pre-existing entry) was deliberately *not* also added as a Subway-the-
   sandwich-chain Dining keyword, since that would silently overwrite it.
   French has a sharper version of this risk than English: `bourse` (already
   pension/investment-adjacent — "the stock exchange") and `portefeuille`
   ("wallet" *and* "investment portfolio") are genuine homonyms in French:
   each kept a single, deliberate placement (`bourse` → Investment,
   `portefeuille` → Shopping/wallet) rather than being added to both
   plausible subcategories.
2. **Automated verification after drafting** — a Node one-liner (`Bash`, not
   committed as a script) regex-scanned both files for duplicate keys (found
   none) and checked that no new key collided with the fixed test fixtures in
   `lib/__tests__/detectCategory.test.ts` (`grocry`, `xyzzy`, `xyzzyplugh`,
   `ab`, `gymbox` — none matched). Given ~1200 new entries across both files,
   this check mattered more than the manual care — hand-tracking global
   uniqueness across a file that size reliably misses something.

Added a small number of new spot-check assertions to `lib/__tests__/
detectCategory.test.ts` (one new EN grocery chain, one new EN brokerage, one
new EN goal-savings phrase, the `subway` non-collision case, and three
parallel French cases including the `bourse` homonym) — matching the file's
existing style of representative spot checks rather than exhaustive
per-keyword coverage. `tsc --noEmit`, `npm run check`, `npm test` all clean,
**249/249** passing.

## Related notes

- [[web-inmemory-db]] — why web loses learned data on reload
- [[localization]] — shipped alongside in the same session; independent
  language selector added 2026-07-27
- [[APIs]] — DB function list (schema v4)
- [[Components]] — ExpenseInput
