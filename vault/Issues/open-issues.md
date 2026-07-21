# Open Issues

## Active

None.

## Known non-issues (won't fix)

- **iOS Simulator keyboard log spam** — `[CoreHaptics] hapticpatternlibrary.plist ... no such file`, `[RemoteTextInput] RTIInputSystemClient ... valid sessionID`, `[TextInputUI] Result accumulator timeout`. Simulator-only system-framework noise on every keypress; never occurs on real devices. Not project code.

- **Web: `props.pointerEvents is deprecated. Use style.pointerEvents`** — emitted by a dependency (React Navigation / Expo internals), not project code. Cosmetic; resolves when those libs update.
- **Web: onboarding re-shows on every reload** — expected. Web uses an in-memory DB ([[web-inmemory-db]]), so the `onboarding_complete` flag resets each reload. Native persists correctly.

## Resolved (for reference)

- **Onboarding Continue button invisible on iOS (country step)** — the button reused `styles.nextBtn` (`flex: 2`, meant for a horizontal row); in the vertical country card Yoga collapsed it to 0 height. `flexBasis: 'auto'` overrides fix web but not native (Yoga treats `auto` as unset). Fixed with a self-contained flex-free `continueBtn` style + footer-pinned card layout (scrollable body, `windowHeight - 80` cap). See [[2026-07-03-session]]. Fixed 2026-07-03.

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
- **Budget limit stuck at 100% with no overspend signal** — `BentoCard` clamped the ratio with `Math.min(amount / limit, 1)`, so spending past a category limit still displayed 100% and never told the user. Fixed by computing the label from the real (unclamped) ratio while keeping the bar fill capped at 100% width, forcing the magenta `#FF2D78` bar/label when over, and adding a small `alert-circle` + `OVER` pill. Verified on web (Needs $68 / $50 → **136%** + OVER badge). Fixed 2026-07-01.

## Related notes

- [[ChronoBudget]] — project overview
- [[APIs]] — schema details
