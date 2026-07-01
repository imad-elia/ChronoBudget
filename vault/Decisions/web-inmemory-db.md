# Decision: In-memory SQLite on web, migrations inside getDb()

**Date:** 2026-07-01
**Status:** Accepted

## Context

Running the app on web (Chrome, Windows) produced a cascade of expo-sqlite failures that never appeared on native:

1. `createSyncAccessHandle ... another open Access Handle` — two concurrent `openDatabaseAsync` calls racing for the same OPFS file.
2. `sqlite3_open_v2` — the OPFS-backed SQLite file became corrupt/locked after crashed dev sessions (WAL `-wal`/`-shm` sidecars left inconsistent). This survives page reloads and even "Clear site data", and **cannot** be cleared from the same page whose worker holds the lock.
3. `no such table: app_settings` — a query ran before migrations had created the table.

Root causes:
- expo-sqlite's **web** backend persists via the Origin Private File System (OPFS). Its `SyncAccessHandle` locking is fragile in dev (HMR/worker crashes leave the file locked). WAL mode makes it worse because the `-shm` shared-memory sidecar assumes cross-origin isolation (COOP/COEP headers) that the app doesn't set.
- `getDb()` only *opened* the connection; `initDb()` ran migrations separately. Helpers that call `getDb()` directly (e.g. `ExpenseInput` reading `input_mode` on mount) could query before `initDb()` finished. On native the on-disk tables persisted and hid the race; the fresh web DB exposed it.

## Decision

Two changes in `db/database.ts`:

1. **Web uses an in-memory database** (`:memory:`); native keeps the persistent file (`chronobudget.db`).
   `const DB_NAME = Platform.OS === 'web' ? ':memory:' : 'chronobudget.db';`
   In-memory never touches OPFS → no locks, no corruption, no `sqlite3_open_v2`. Web is a dev-preview target only (the product is the mobile app), so resetting web data on reload is an acceptable trade-off.

2. **Migrations run inside the memoized open promise** via `openAndMigrate()`. `getDb()` now returns a fully-migrated database, so every helper automatically waits for the schema. `initDb()` is now just `await getDb()`.

3. **WAL only on native.** `PRAGMA journal_mode = WAL` is skipped on web (no on-disk sidecar to justify it). This preserves CLAUDE.md's WAL requirement where it applies.

## Consequences

- Web preview data does not persist across reloads (onboarding re-shows each reload on web). Expected and acceptable.
- Native behaviour is unchanged: persistent WAL SQLite, data survives launches.
- The migrations-in-getDb change also fixed a latent race that could have hit native on a fresh install (any query racing `initDb`).
- If persistent web storage is ever needed, revisit OPFS with proper COOP/COEP headers — not worth it for a dev preview.

## Related notes

- [[sqlite-schema-migration]] — the PRAGMA user_version strategy (unchanged)
- [[APIs]] — DB function list
- [[Overview]] — architecture
