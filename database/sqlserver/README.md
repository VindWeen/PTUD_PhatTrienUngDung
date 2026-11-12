# SQL Server schema and safe initialization

Runtime schema source: `database/sqlserver/migrations/`. PostgreSQL files under
`supabase/` are an archived comparison source; the runtime migration and seed runners
never execute them or fall back to them.

From the repository root, with the backend SQL Server environment configured:

```powershell
node database/scripts/migrate.js up
node database/scripts/migrate.js status
# Optional synthetic demo only; refuses any populated application table:
node database/scripts/seed.js --apply
node --test database/sqlserver/schema.test.mjs database/sqlserver/runner.test.mjs
node database/sqlserver/verify-live.mjs
```

`migrateUp(customPool)` / `migrateStatus(customPool)` accept the backend pool contract.
Parameters use native `@p1`, `@p2`, etc. All pending migrations and their checksums
are committed atomically; a transaction-owned application lock serializes runners.
Previously applied files with changed checksums or unknown history fail closed.
Do not edit an applied migration; add a new numbered file.

The baseline reconciles all 31 archived migrations into 53 business tables, preserving
snake_case table/column names, identity BIGINT keys, BIGINT application versions,
final status sets, snapshots, histories and application-to-award handoff links.
`schema-manifest.json` lists source hashes, final columns and representation differences.
The offline `build-baseline.mjs` and `build-seed.mjs` regenerate comparison artifacts;
they are development tools, never runtime SQL translators. Do not regenerate applied
files when evolving a deployed database.

## Representation decisions

- Unicode text uses NVARCHAR with explicit binary collation for PostgreSQL-style
  case-sensitive values. The three normalized catalog codes have UPPER computed
  columns and unique indexes. Nullable PostgreSQL UNIQUE references use filtered
  unique indexes so multiple NULL values remain permitted.
- TIMESTAMPTZ becomes UTC DATETIME2(3), with SYSUTCDATETIME defaults. Calendar
  `starts_at`/`ends_at` deliberately retain Vietnam local wall-clock semantics.
- JSONB becomes checked NVARCHAR(MAX). BIGINT[] / REAL[] also become JSON text;
  application code must serialize writes and parse reads, using OPENJSON where needed.
- Unbounded PostgreSQL NUMERIC is DECIMAL(28,8) for KPI quantities. An importer must
  reject values outside that precision/scale instead of silently rounding them.
- Physical FK deletes are NO ACTION rather than cascading/unlinking history. This is
  intentionally stricter than the archived schema and avoids SQL Server cascade-path
  restrictions. Normal business revocation keeps rows; source deletion is never part
  of initialization or transfer.
- Five set-based triggers preserve organization cycle checks, half-open assignment
  overlaps, immutable application inputs and criteria source-rule approval/audit.
  Range checks serialize with table locks: correctness is prioritized over write
  concurrency for these small administrative tables.
- Source-rule change detection compares serialized JSON text. Semantically equal
  JSON with different key ordering/spacing can conservatively invalidate approval;
  callers should submit canonical JSON. Revisions and source history are retained.
- SQL Server trigger tables require OUTPUT INTO followed by SELECT, or a separate
  SELECT after the write. Source-rule SELECT must occur after the trigger updates.
  Evidence repositories set `updated_at`; there is no extra evidence timestamp trigger.

## Seed and verification

The demo seed has no DELETE/TRUNCATE. It checks and locks all 53 application tables,
requires the explicit `--apply` flag, and includes synthetic accounts from the archived
base seed plus `council.demo` to exercise the sixth role. Demo password: `demo1234`.
It does not transfer current PostgreSQL data and must not run before a real-data import
that requires an empty target.

`verify-live.mjs --seed-rollback` requires an empty migrated target. It runs demo and
negative integrity fixtures in separate transactions and rolls everything back. On
11/11/2026 this passed against the local project SQL Server database: 53 tables,
5 enabled triggers, all FKs trusted/enabled, cycle and overlaps rejected, inputs
immutable, source rules revision/audit and approval invalidation correct, Vietnamese
text intact, populated-target seed refused. The target was empty after verification.
Migration rerun returned zero pending changes. These are bounded database checks,
not a claim that every application workflow has been accepted.

When importing exact existing source-rule rows/history, disable only
`app.criteria_source_rules_after` inside the controlled target transaction, import
the original revision/approval/history, then re-enable it before commit. Otherwise
the normal insert trigger intentionally creates a new history and resets approval.
