# V2 private-storage backup and restore

New backups use manifest format 3. They include one engine `COPY_ONLY` SQL Server
BAK with checksum plus `storage_backup/evidences/` and
`storage_backup/regulations/`. `STORAGE_DIR` and backup `--storage-dir` still name
the evidence directory; regulation sources resolve to its sibling `regulations`
directory, exactly as the backend does.

Every database evidence/source reference is checked against the copied file's
size and SHA256. Source references retain `regulation_version_id`. A missing or
changed source fails the complete backup. Partial SQL checkpoints are explicitly
marked and cannot be used as complete application backups.

Stop the backend, seed jobs and every other database/file writer before running:

```powershell
node scripts/backup.mjs --writers-stopped --out-dir=C:/Backups/PTUD_new --server-backup-dir=C:/SqlShared
node scripts/restore.mjs --backup-dir=C:/Backups/PTUD_new --verify-only
node scripts/restore.mjs --backup-dir=C:/Backups/PTUD_new --target-db=PTUD_restore_20261115 --target-storage-dir=C:/Restore/PTUD_new/private --apply
```

`--writers-stopped` is an operator assertion, not an automatic writer lock.
The command also compares reference metadata and table counts before and after
copying. Counts alone cannot detect every database edit; quiescing writers is
required for the SQL/file snapshot to describe the same application state.

For v3 restores, set `STORAGE_DIR` to the reported
`targetEvidenceDirectory` (`NEW_FOLDER/evidences`). Source files then resolve to
`NEW_FOLDER/regulations`. Legacy v2 evidence-only archives are still readable and
restore directly into `NEW_FOLDER`; they cannot claim to contain source files.
Existing databases/storage paths are refused. Isolated restores verify exact
reference metadata (including source version links), all hashes, table counts
and database constraints. SQL service and Node both need access to the server BAK
staging folder. Credentials are never written to manifests.

Run file workflow tests with:

```powershell
node --test scripts/storageBackup.test.mjs
```

These tests copy real files from isolated temporary directories, verify v2/v3
archives and detect corruption/path escapes. Their SQL pool and BAK bytes are
fixtures; passing them does **not** prove SQL Server engine backup/restore. A
real engine rehearsal requires the `--verify-only` command and an isolated
`--apply` restore above, with retained runtime evidence.

## Real SQL Server engine rehearsal — 16/11/2026

Completed against two newly created, isolated databases retained for inspection:

- Source: `PTUD_test_backup_20261116021229735`.
- Restored target: `PTUD_restore_test_20261116021229735`.
- All five current V2 migrations applied to the isolated source (36 app tables).
  Minimal fixture: one user, one achievement/evidence PDF, one regulation/version
  with a source PDF. The two private stores deliberately use the same basename
  `same.pdf` to exercise distinct `evidences/` and `regulations/` namespaces.

Windows integrated SQL Server access confirmed a sysadmin principal. The installed
sqlcmd lacked its ODBC driver, so the retained harness used a persistent .NET
SqlClient connection through PowerShell as the live query pool for the existing
`runBackup` / `runRestore` functions. Every query and BAK came from the actual SQL
Server engine; no SQL results or BAK bytes were mocked. Existing application login
access was mapped only inside the new restored fixture database for verification.

Fixture writes stopped before the backup and neither the application nor seed
jobs use that exclusively owned database/storage. `writersStopped` was asserted
only for this isolated fixture. **PTUD_LHU was not modified and its live writers
were not claimed to be stopped.** This proves the V2 backup/restore mechanism,
not a quiesced production backup of the active application database.

Actual engine results:

- `BACKUP DATABASE ... WITH COPY_ONLY,CHECKSUM`: passed. BAK size **6,475,776
  bytes**, SHA256 `bf1c4302d323a145a7b45957309f0152567e457f3a4fa96273160fdf36b018c0`.
- Archive manifest and private-file SHA256 validation: passed.
- `RESTORE VERIFYONLY ... WITH CHECKSUM`: passed.
- Isolated `RESTORE DATABASE ... WITH CHECKSUM,RECOVERY`: passed; no replacement
  of an existing database or storage folder.
- All **36 table counts** and exact private-reference metadata matched the backup;
  the source reference retained `regulation_version_id=1`.
- **2 files / 2 references**, total **2,196,514 bytes**. Each readable PDF has
  SHA256 `86666e5aad39da111a6de960f4f71ecbd1a42383397db60fca268363c90133ad` and
  size **1,098,257 bytes**; restored namespace paths and hashes matched.
- `DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS`: passed.
- Subsequent `DBCC CHECKDB` with `NO_INFOMSGS, DATA_PURITY`: passed. Both isolated
  databases are `ONLINE`; msdb confirms a full `COPY_ONLY` backup with checksums.

Retained evidence under `output/storage-backup-rehearsal-20261116/`:

- `engine-rehearsal.log`: actual backup, VERIFYONLY and restore output.
- `rehearsal-report.json`: completed engine/file/reference checks and isolated
  database names.
- `engine-audit.json`: subsequent engine backup history and physical CHECKDB.
- `archive_20261116021229735/backup_manifest.json` and its SHA256 file, native
  `database.bak`, both archived private stores.
- `restored_20261116021229735/restore_report.json` and restored private stores.
- `rehearsal.mjs` / `sql-bridge.ps1`: bounded harness for reproduction with fresh
  unique test database/path names; never drops or overwrites existing databases.

The source and restored databases, staging BAK and all fixture/archive/restored
files remain available. This rehearsal does not change any separate historical
backup's missing-file status.
