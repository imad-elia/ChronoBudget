# Open Issues

## Active

None.

## Known non-issues (won't fix)

- **Web: `props.pointerEvents is deprecated. Use style.pointerEvents`** — emitted by a dependency (React Navigation / Expo internals), not project code. Cosmetic; resolves when those libs update.
- **Web: onboarding re-shows on every reload** — expected. Web uses an in-memory DB ([[web-inmemory-db]]), so the `onboarding_complete` flag resets each reload. Native persists correctly.

## Resolved (for reference)

- **"no such column: category"** — stale browser SQLite DB from before schema v1. Fixed by schema versioning + v1 migration.
- **"Unistyles runtime is not available" on Expo Go Android** — react-native-unistyles requires JSI. Fixed by removing the library and replacing with a static `theme` object + `StyleSheet.create`.
- **Keyboard hides input fields** — fixed by wrapping in `KeyboardAvoidingView`.
- **"Total Spent" hidden behind status bar** — fixed by passing `topInset` prop to `DashboardHeader`.
- **Reanimated transform overwritten by layout animation** — fixed by splitting into two nested `Animated.View` elements (outer for entering/exiting/layout, inner for transform style).
- **"no such column: subcategory"** — stale browser DB at schema v2. Fixed by clearing browser site data so the v3 migration runs.
- **History subcategory not shown** — `HistoryRow` was reading `item.note || cfg.label`, missing `item.subcategory`. Fixed 2026-07-01.
- **Web `shadow*` deprecation warning** — `BentoCard` used RN shadow props on web. Fixed with `Platform.OS === 'web'` conditional using `boxShadow`. Fixed 2026-07-01.
- **Web `createSyncAccessHandle` / `sqlite3_open_v2` / `no such table`** — expo-sqlite OPFS locking + a migration race. Fixed by switching web to in-memory SQLite and moving migrations into `getDb()`. See [[web-inmemory-db]]. Fixed 2026-07-01.
- **Android CSV export crash — `writeAsStringAsync ... is deprecated`** — the default `expo-file-system` entry deprecated (and now throws on) the classic API in SDK 54+. Fixed by importing from `expo-file-system/legacy`. Fixed 2026-07-01.
- **CSV export button missing on web** — was intentionally hidden because `expo-sharing` has no web backend. Replaced with a platform branch: web exports via a Blob + anchor download; native uses `expo-file-system`/`expo-sharing`. Button now shown on all platforms. Fixed 2026-07-01.

## Related notes

- [[ChronoBudget]] — project overview
- [[APIs]] — schema details
