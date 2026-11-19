import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { migrateUp,getMigrationFiles,migrationsDir,calculateChecksum,splitBatches } from '../scripts/migrate.js';
import { seedDatabase } from '../scripts/seed.js';
function fakePool(applied=[],failBatch=false){
  const log=[];
  const client={ async query(sql,params){
    log.push({sql,params});
    if(sql.includes('sp_getapplock')) return {rows:[{lock_result:0}]};
    if(sql.includes('SELECT name, checksum')) return {rows:applied};
    if(failBatch&&sql.includes('CREATE TABLE app.users')) throw new Error('fixture batch failure');
    return {rows:[]};
  },async release(){log.push({sql:'RELEASE'});}};
  return {log,async connect(){return client;},async end(){throw new Error('Custom pool must not be closed');}};
}
test('migration parser handles GO and checksum normalizes CRLF',()=>{
  assert.equal(splitBatches('SELECT 1;\nGO\nSELECT 2;\ngo -- test\nSELECT 3;').length,3);
  assert.equal(calculateChecksum('SELECT 1;\r\n'),calculateChecksum('SELECT 1;\n'));
  assert.ok(migrationsDir.includes('sqlserver'));
  assert.ok(migrationsDir.replaceAll('\\','/').endsWith('/sqlserver/migrations/'));
});
test('already applied files are validated and not executed again',async()=>{
  const applied=getMigrationFiles().map(name=>({name,checksum:calculateChecksum(fs.readFileSync(path.join(migrationsDir,name),'utf8'))}));
  const pool=fakePool(applied);
  const result=await migrateUp(pool);
  assert.equal(result.appliedCount,0);
  assert.equal(pool.log[0].sql,'BEGIN');
  assert.ok(pool.log.some(e=>e.sql==='COMMIT'));
  assert.ok(!pool.log.some(e=>e.sql.startsWith('-- SQL Server 2017+')));
});
test('checksum mismatch fails closed and rolls back',async()=>{
  const pool=fakePool([{name:getMigrationFiles()[0],checksum:'invalid'}]);
  await assert.rejects(migrateUp(pool),/Checksum mismatch/);
  assert.ok(pool.log.some(e=>e.sql==='ROLLBACK'));
  assert.ok(!pool.log.some(e=>e.sql==='COMMIT'));
});
test('failed schema batch rolls back the whole run without recording a migration',async()=>{
  const pool=fakePool([],true);
  await assert.rejects(migrateUp(pool),/fixture batch failure/);
  assert.ok(pool.log.some(e=>e.sql==='ROLLBACK'));
  assert.ok(!pool.log.some(e=>e.sql.includes('INSERT INTO app._schema_migrations')));
});
test('demo seed requires explicit authorization before opening a connection',async()=>{
  const pool={async connect(){throw new Error('must not connect');}};
  await assert.rejects(seedDatabase(pool),/requires --apply/);
});

test('V2 baseline refuses an existing unversioned schema',async()=>{
  const pool=fakePool();
  const connect=pool.connect;
  pool.connect=async()=>{
    const client=await connect();
    const query=client.query.bind(client);
    client.query=async(sql,params)=>sql.includes('COUNT(*) AS table_count')
      ? {rows:[{table_count:53}]} : query(sql,params);
    return client;
  };
  await assert.rejects(migrateUp(pool),/requires an empty database/);
  assert.ok(pool.log.some(e=>e.sql==='ROLLBACK'));
});

test('legacy seed is blocked even with explicit apply on V2',async()=>{
  const pool={async connect(){throw new Error('must not connect');}};
  await assert.rejects(seedDatabase(pool,{apply:true}),/V2 seed is not available/);
});
