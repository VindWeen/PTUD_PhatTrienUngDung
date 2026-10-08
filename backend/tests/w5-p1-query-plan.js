// Only inspect a schema produced by W5-P1, never shared app data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Pool, getDbPoolConfig } from '../src/config/database.js';
const schema=process.argv[2];assert.match(schema||'',/^w5p1_test_[a-f0-9]{12}$/);
const pool=new Pool({...getDbPoolConfig(),connectionTimeoutMillis:10000,statement_timeout:30000});
try {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query(`DROP INDEX IF EXISTS ${schema}.idx_achievements_updated_id`);
  const sql=`SELECT achievement_id FROM ${schema}.achievements ORDER BY updated_at DESC,achievement_id DESC LIMIT 20`;
  const explain=async()=> (await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql)).rows[0]['QUERY PLAN'];
  const before=await explain();
  await client.query(`CREATE INDEX w5_p1_candidate ON ${schema}.achievements(updated_at DESC,achievement_id DESC)`);
  const after=await explain();
  await fs.mkdir(new URL('../../output/w5-p1/',import.meta.url),{recursive:true});
  await fs.writeFile(new URL('../../output/w5-p1/query-plan.json',import.meta.url),JSON.stringify({before,after,scope:'candidate index rolled back; ordering portion of list query only'},null,2));
  console.log(JSON.stringify({beforeMs:before[0]['Execution Time'],afterMs:after[0]['Execution Time'],beforeNode:before[0].Plan.Plans[0]['Node Type'],afterNode:after[0].Plan.Plans[0]['Node Type']}));
 }finally{await client.query('ROLLBACK');client.release();}
}finally{await pool.end();}
