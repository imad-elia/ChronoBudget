# Open Issues

## Active

### Web: `shadow*` style props deprecation warning
**Severity:** Cosmetic (web only)  
**Source:** `components/BentoCard.tsx` — uses `shadowOffset`, `shadowOpacity`, `shadowRadius` in `StyleSheet.create`. These are React Native shadow props; React Native Web prefers `boxShadow`.  
**Fix:** Add `Platform.OS === 'web'` conditional to BentoCard wrapper style, using `boxShadow: '0 0 16px <color>59'` on web and the existing RN shadow props otherwise.

### History screen: subcategory not shown in row label
**Severity:** Minor UX gap  
**Source:** `app/(tabs)/history.tsx` `HistoryRow` — the row label renders `item.note || cfg.label`. It does not fall back to `item.subcategory` the way `TransactionRow` in the Dashboard does (`item.subcategory || item.note || config.title`).  
**Fix:** Change `HistoryRow` note display to `item.subcategory || item.note || cfg.label`.

## Resolved (for reference)

- **"no such column: category"** — stale browser SQLite DB from before schema v1. Fixed by schema versioning + v1 migration.
- **"Unistyles runtime is not available" on Expo Go Android** — react-native-unistyles requires JSI. Fixed by removing the library and replacing with a static `theme` object + `StyleSheet.create`.
- **Keyboard hides input fields** — fixed by wrapping in `KeyboardAvoidingView`.
- **"Total Spent" hidden behind status bar** — fixed by passing `topInset` prop to `DashboardHeader`.
- **Reanimated transform overwritten by layout animation** — fixed by splitting into two nested `Animated.View` elements (outer for entering/exiting/layout, inner for transform style).
- **"no such column: subcategory"** — stale browser DB at schema v2. Fixed by clearing browser site data so the v3 migration runs.

## Related notes

- [[ChronoBudget]] — project overview
- [[APIs]] — schema details
