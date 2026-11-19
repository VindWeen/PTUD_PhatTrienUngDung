import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, getDbPoolConfig } from '../../backend/src/config/database.js';
import { getMigrationFiles, migrationsDir, migrateStatus } from '../scripts/migrate.js';

export async function verifyV2({ expectEmpty = false } = {}) {
  const pool = new Pool(getDbPoolConfig());
  try {
    const files = getMigrationFiles();
    const expected = files.flatMap(file => [...fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      .matchAll(/CREATE TABLE app\.([a-z_]+)/g)].map(match => match[1])).sort();
    const actual = (await pool.query("SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=N'app' AND t.name<>N'_schema_migrations' ORDER BY t.name")).rows.map(row => row.name);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Live tables do not match the V2 migration files.');
    const disabled = (await pool.query(`SELECT name FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1
      UNION ALL SELECT name FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1
      UNION ALL SELECT name FROM sys.triggers WHERE is_disabled=1 AND is_ms_shipped=0`)).rows;
    if (disabled.length) throw new Error('Disabled or untrusted integrity objects: ' + disabled.map(row => row.name).join(', '));
    const rowCounts = [];
    for (const name of actual) {
      if (!/^[a-z_]+$/.test(name)) throw new Error('Unexpected table identifier.');
      const result = await pool.query(`SELECT COUNT_BIG(*) AS row_count FROM app.[${name}]`);
      rowCounts.push({ table: name, rows: Number(result.rows[0].row_count) });
    }
    if (expectEmpty && rowCounts.some(table => table.rows !== 0)) throw new Error('Expected empty V2 business tables; found persisted rows.');
    const migrations = await migrateStatus(pool);
    if (migrations.some(item => item.status !== 'APPLIED')) throw new Error('V2 migrations are pending.');
    return {
      verifiedAtUtc: new Date().toISOString(),
      database: (await pool.query('SELECT DB_NAME() AS name')).rows[0].name,
      businessTableCount: actual.length,
      foreignKeyCount: (await pool.query('SELECT COUNT(*) AS total FROM sys.foreign_keys')).rows[0].total,
      checkConstraintCount: (await pool.query('SELECT COUNT(*) AS total FROM sys.check_constraints')).rows[0].total,
      triggerCount: (await pool.query('SELECT COUNT(*) AS total FROM sys.triggers WHERE is_ms_shipped=0')).rows[0].total,
      empty: rowCounts.every(table => table.rows === 0),
      migrations: migrations.map(({ name, status }) => ({ name, status })),
      tables: rowCounts,
    };
  } finally { await pool.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyV2({ expectEmpty: process.argv.includes('--expect-empty') }).then(report => {
    const directory = fileURLToPath(new URL('../../output/database-v2/', import.meta.url));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'schema-verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
