# Decision: SQLite schema migration strategy

**Date:** 2026-06-28  
**Status:** Accepted

## Context

The app needs to evolve its SQLite schema across app updates without losing user data.

## Decision

Use `PRAGMA user_version` as a schema version counter. `initDb()` checks `user_version` and runs sequential `if (user_version < N)` blocks. Each block is idempotent (uses `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN`). After all migrations run, set `PRAGMA user_version = SCHEMA_VERSION`.

v1 was deliberately destructive (DROP + recreate `transactions`) because it ran during early development when no real user data existed.

## Rationale

- No extra dependencies
- Incremental: only missing migrations run
- Additive from v2 onward: safe for production upgrades

## Consequences

- Schema can only grow additively after v1 (no column renames or type changes without a new migration block)
- SQLite's `ALTER TABLE` only supports `ADD COLUMN` — more complex changes require creating a new table, copying data, dropping the old table

## Related notes

- [[APIs]] — full schema
- [[open-issues]] — past incidents caused by stale browser DB
