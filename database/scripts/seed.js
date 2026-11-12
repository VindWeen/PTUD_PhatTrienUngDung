import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, getDbPoolConfig } from '../../backend/src/config/database.js';
import { splitBatches } from './migrate.js';

export const seedSqlPath = fileURLToPath(new URL('../sqlserver/seed.sql', import.meta.url));
export async function seedDatabase(customPool = null, { apply = false } = {}) {
  if (!apply) throw new Error('Demo seed requires --apply / {apply:true}; only an empty SQL Server app schema is allowed.');
  const pool = customPool || new Pool(getDbPoolConfig());
  let client;
  try {
    const sql = fs.readFileSync(seedSqlPath, 'utf8');
    client = await pool.connect();
    await client.query('BEGIN');
    try {
      const locked = await client.query(`DECLARE @result INT;
        EXEC @result = sys.sp_getapplock @Resource=N'lhu_sqlserver_demo_seed',
          @LockMode=N'Exclusive', @LockOwner=N'Transaction', @LockTimeout=15000;
        SELECT @result AS lock_result;`);
      if (!locked.rows?.length || Number(locked.rows[0].lock_result) < 0) throw new Error('Cannot acquire demo seed lock.');
      for (const batch of splitBatches(sql)) await client.query(batch);
      await client.query('COMMIT');
      console.log('SQL Server demo seed applied to empty target; names/data are synthetic development examples.');
      return { applied: true };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* XACT_ABORT may already have rolled back. */ }
      throw error;
    }
  } finally {
    if (client) await client.release();
    if (!customPool) await pool.end();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--apply')) {
    console.log('Usage: node database/scripts/seed.js --apply\nOnly an empty, migrated SQL Server target is accepted. Existing data is never deleted.');
  } else seedDatabase(null, { apply: true }).catch(error => { console.error(`Seed refused/failed: ${error.message}`); process.exitCode = 1; });
}
