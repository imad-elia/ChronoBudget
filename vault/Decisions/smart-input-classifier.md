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
- **Fast:** single smart field; always follows the guess; "change" reveals the
  category/subcategory override chips.
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

- **Fuzzy/stemming matching** — considered and deliberately deferred (2026-07-21).
  Matching is currently exact single-token only (`lib/detectCategory.ts`), so
  "groceries" vs. "grocery shopping" both need explicit seed entries rather than
  resolving from one root word. A lightweight offline stemming/NLP library (e.g.
  `compromise`) would reduce the need for exhaustive word-variant lists, but adds a
  runtime dependency (against the project's "avoid unnecessary libraries" rule) and
  matching complexity. Revisit if the expanded seed list + manual keywords still
  leave common variants unmatched in practice.
- **Active-locale keyword map** — `constants/keywordMap.ts` currently hardcodes
  `getKeywordMap('en')`; swapping in the user's actual active language (once
  non-English keyword files exist) is a small follow-up, not done in this pass.

## Related notes

- [[web-inmemory-db]] — why web loses learned data on reload
- [[localization]] — shipped alongside in the same session
- [[APIs]] — DB function list (schema v4)
- [[Components]] — ExpenseInput
