import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool, getDbPoolConfig } from '../../backend/src/config/database.js';

// V2 is a fresh baseline. Never mix the historical workflow migrations into this chain.
export const migrationsDir = fileURLToPath(new URL('../sqlserver/v2/migrations/', import.meta.url));
export function getMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) throw new Error(`SQL Server migrations not found: ${migrationsDir}`);
  const files = fs.readdirSync(migrationsDir).filter(file => /^\d+_[\w-]+\.sql$/.test(file)).sort();
  if (!files.length) throw new Error('No SQL Server migration files; refusing PostgreSQL fallback.');
  return files;
}
export function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content.replace(/\r\n/g, '\n').trim()).digest('hex');
}
export function splitBatches(sql) {
  return sql.split(/^\s*GO\s*(?:--[^\r\n]*)?$/im).filter(batch => batch.trim());
}
async function lock(client) {
  const result = await client.query(`DECLARE @result INT;
    EXEC @result = sys.sp_getapplock @Resource=N'lhu_sqlserver_schema_migrations',
      @LockMode=N'Exclusive', @LockOwner=N'Transaction', @LockTimeout=15000;
    SELECT @result AS lock_result;`);
  if (Number(result.rows?.[0]?.lock_result) < 0 || !result.rows?.length) throw new Error('Cannot acquire SQL Server migration lock.');
}
async function ensureMigrationsTable(client) {
  await client.query(`IF SCHEMA_ID(N'app') IS NULL EXEC(N'CREATE SCHEMA app');
    IF OBJECT_ID(N'app._schema_migrations',N'U') IS NULL
    CREATE TABLE app._schema_migrations (
      migration_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      name NVARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
      checksum CHAR(64) NOT NULL,
      execution_time_ms INT NULL
    );`);
}
async function getApplied(client) {
  return (await client.query('SELECT name, checksum, applied_at FROM app._schema_migrations ORDER BY migration_id;')).rows;
}
function checkHistory(files, applied) {
  const known = new Set(files);
  for (const item of applied) {
    if (!known.has(item.name)) throw new Error(`Unknown database migration: ${item.name}. Check the SQL Server target.`);
    const expected = calculateChecksum(fs.readFileSync(path.join(migrationsDir, item.name), 'utf8'));
    if (item.checksum !== expected) throw new Error(`Checksum mismatch for applied migration ${item.name}. Restore the original file; never edit applied migrations.`);
  }
}
export async function migrateUp(customPool = null) {
  const files = getMigrationFiles();
  const pool = customPool || new Pool(getDbPoolConfig());
  let client, inTransaction = false;
  try {
    client = await pool.connect();
    // One atomic migration run pins the mssql transaction connection. An application
    // lock owned by that transaction also serializes first-time tracking-table creation.
    await client.query('BEGIN'); inTransaction = true;
    await lock(client);
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    checkHistory(files, applied);
    if (!applied.length) {
      const existing = await client.query("SELECT COUNT(*) AS table_count FROM sys.tables WHERE is_ms_shipped=0 AND NOT (schema_id=SCHEMA_ID(N'app') AND name=N'_schema_migrations');");
      if (Number(existing.rows?.[0]?.table_count || 0) > 0) {
        throw new Error('V2 baseline requires an empty database; existing tables were found. No automatic legacy conversion is performed.');
      }
    }
    const known = new Set(applied.map(item => item.name));
    let appliedCount = 0;
    for (const file of files) {
      if (known.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = calculateChecksum(sql), start = Date.now();
      try {
        for (const batch of splitBatches(sql)) await client.query(batch);
        await client.query('INSERT INTO app._schema_migrations(name,checksum,execution_time_ms) VALUES(@p1,@p2,@p3);', [file, checksum, Date.now() - start]);
        appliedCount++;
        console.log(`Applied SQL Server migration ${file}`);
      } catch (error) {
        throw new Error(`SQL Server migration ${file} failed: ${error.message}`, { cause: error });
      }
    }
    await client.query('COMMIT'); inTransaction = false;
    return { appliedCount, total: files.length };
  } finally {
    if (inTransaction) { try { await client.query('ROLLBACK'); } catch { /* XACT_ABORT may already have aborted the transaction. */ } }
    if (client) await client.release();
    if (!customPool) await pool.end();
  }
}
export async function migrateStatus(customPool = null) {
  const files = getMigrationFiles(), pool = customPool || new Pool(getDbPoolConfig());
  let client;
  try {
    client = await pool.connect();
    const exists = await client.query("SELECT OBJECT_ID(N'app._schema_migrations',N'U') AS object_id;");
    const applied = exists.rows?.[0]?.object_id ? await getApplied(client) : [];
    checkHistory(files, applied);
    const known = new Map(applied.map(item => [item.name, item]));
    const status = files.map(name => ({ name, status: known.has(name) ? 'APPLIED' : 'PENDING', applied_at: known.get(name)?.applied_at ?? null }));
    for (const row of status) console.log(`[${row.status}] ${row.name}`);
    return status;
  } finally {
    if (client) await client.release();
    if (!customPool) await pool.end();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] || 'up';
  const action = command === 'up' ? migrateUp : command === 'status' ? migrateStatus : null;
  if (!action) { console.error('Usage: node database/scripts/migrate.js [up|status]'); process.exitCode = 1; }
  else action().then(result => { if (command === 'up') console.log(result); }).catch(error => {
    console.error(error.message);
    for (const detail of error.cause?.precedingErrors || []) console.error(detail.message);
    process.exitCode = 1;
  });
}
