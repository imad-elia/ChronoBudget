# Decision: Local keyword classifier with learning for smart input

**Date:** 2026-07-01
**Status:** Accepted

## Context

Fast mode originally accepted only a numeric amount and filed everything under the
last-selected category with no subcategory. The product intent was a single natural
entry like "15 coffee" → **Wants · Dining** with zero taps. The app is offline-first
with no backend and no account system, which rules out a cloud LLM classifier.

## Decision

A **local keyword dictionary that also learns** from the user's manual corrections.

- **`lib/detectCategory.ts`** — pure, RN-free (unit-testable) module:
  - `parseEntry(raw)` extracts the first numeric token as the amount ("15 coffee",
    "coffee 15", "15.50", "15,50") and the rest as a description.
  - `detectCategory(desc, learned)` normalizes → tokens; looks up the **learned map
    first**, then the seed `KEYWORD_MAP`. First token match wins. No match →
    default category (`needs`) + title-cased description as the subcategory.
  - `learnKey(desc)` returns the first meaningful token to store when learning.
- **`constants/keywordMap.ts`** — ~90 seeded keywords → {category, subcategory},
  mapping onto the existing `SUBCATEGORIES` names so override chips always match.
- **Learning storage** — schema **v4** table `keyword_learn(keyword PK, category,
  subcategory, count, updated_at)`. `learnKeyword()` upserts (count++), and
  `fetchLearnedKeywords()` loads the whole table into a Zustand cache
  (`learnedKeywords`) for **synchronous** detection while typing.
- **When we learn:** only on `overridden || !matched` at submit — i.e. the user
  corrected the guess or accepted a no-match. We never learn the dictionary's own
  untouched hits (nothing new to store).

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
  corrected once — the learning layer fixes this per user.
- Web (in-memory DB) forgets learned keywords on reload; native persists them.

## Related notes

- [[web-inmemory-db]] — why web loses learned data on reload
- [[localization]] — shipped alongside in the same session
- [[APIs]] — DB function list (schema v4)
- [[Components]] — ExpenseInput
