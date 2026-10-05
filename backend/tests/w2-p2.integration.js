// Real Express + pg + Supabase tests in a temporary schema, entirely rolled back.
// No seed or migration is applied to the shared app schema.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

const schema = `w2p2_test_${randomBytes(6).toString('hex')}`;
assert.match(schema,/^w2p2_test_[a-f0-9]{12}$/);
const rewrite = sql => sql.replace(/\bapp\b/g,schema);
const pool = new Pool({ ...getDbPoolConfig(),max:1,connectionTimeoutMillis:5000 });
let client, server;
let passed = 0;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='20s'");
  const files = (await fs.readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(v => v.endsWith('.sql')).sort();
  for (const name of files) await client.query(rewrite(await fs.readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8')));
  await client.query(rewrite(await fs.readFile(new URL('../../supabase/seed.sql',import.meta.url),'utf8')));
  const adapted = {
    query: async (sql,values) => {
      if (sql === 'BEGIN') return client.query('SAVEPOINT admin_mutation');
      if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT admin_mutation');
      if (sql === 'ROLLBACK') { await client.query('ROLLBACK TO SAVEPOINT admin_mutation'); return client.query('RELEASE SAVEPOINT admin_mutation'); }
      return client.query(rewrite(sql),values);
    },
    release() {},
  };
  let queue = Promise.resolve();
  const serialized = (sql,values) => {
    const result = queue.then(() => adapted.query(sql,values));
    queue = result.catch(() => {});
    return result;
  };
  setPool({ query: serialized,connect: async () => ({ query:serialized,release() {} }) });
  server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const tokens = Object.fromEntries([1,2,3,4,5].map(id => [id,generateAccessToken({ userId:id })]));
  async function call(method,path,body,user=3,expected=200) {
    const response = await fetch(`${base}${path}`,{ method,headers:{ Authorization:`Bearer ${tokens[user]}`,'Content-Type':'application/json' },...(body ? { body:JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(data.error || {})}`);
    passed++;
    return data.data;
  }
  const decision = await call('POST','/award-decisions',{decisionNumber:'SYNTHETIC-W2-P2',decisionDate:'2026-10-05',issuer:'Synthetic test',title:'Synthetic decision'},5,201);
  const body={lecturerId:1,awardTypeId:1,decisionId:Number(decision.decision_id),recognitionYear:2026};
  await call('POST','/award-records',body,3,403);
  const r=await call('POST','/award-records',body,5,201);
  await call('POST',`/award-records/${r.record_id}/record`,{version:1},5,400);
  const form=new FormData();form.append('file',new Blob(['%PDF-1.7 synthetic'],{type:'application/pdf'}),'synthetic.pdf');
  const upload=await fetch(`${base}/award-decisions/${decision.decision_id}/files`,{method:'POST',headers:{Authorization:`Bearer ${tokens[5]}`},body:form});
  assert.equal(upload.status,201,JSON.stringify(await upload.json()));passed++;
  await call('POST',`/award-records/${r.record_id}/record`,{version:1},5);
  await call('POST',`/award-records/${r.record_id}/record`,{version:1},5,409);
  const dup=await call('POST','/award-records',body,5,201);
  await call('POST',`/award-records/${dup.record_id}/record`,{version:1},5,409);
  const other=await call('POST','/award-records',{...body,lecturerId:2},5,201);
  await call('POST',`/award-records/${other.record_id}/record`,{version:1},5);
  const collective=await call('POST','/award-records',{organizationUnitId:2,awardTypeId:4,decisionId:Number(decision.decision_id),recognitionYear:2026},5,201);
  await call('POST',`/award-records/${collective.record_id}/record`,{version:1},5);
  const duplicateCollective=await call('POST','/award-records',{organizationUnitId:2,awardTypeId:4,decisionId:Number(decision.decision_id),recognitionYear:2026},5,201);
  await call('POST',`/award-records/${duplicateCollective.record_id}/record`,{version:1},5,409);
  const lockedUpload=await fetch(`${base}/award-decisions/${decision.decision_id}/files`,{method:'POST',headers:{Authorization:`Bearer ${tokens[5]}`},body:form});
  assert.equal(lockedUpload.status,409);passed++;
  const detail=await call('GET',`/award-records/${r.record_id}`,null,5);
  const download=await fetch(`${base}/award-decision-files/${detail.files[0].decision_file_id}/download`,{headers:{Authorization:`Bearer ${tokens[5]}`}});
  assert.equal(download.status,200);assert.equal(await download.text(),'%PDF-1.7 synthetic');passed++;
  await call('POST',`/award-records/${r.record_id}/revoke`,{version:2},5,400);
  await call('POST',`/award-records/${r.record_id}/revoke`,{version:2,reason:'Synthetic correction'},5);
  await call('POST','/award-records',{...body,replacesAwardRecordId:Number(r.record_id)},5,201);
  const {getTitlesAndHonors}=await import('../src/modules/profiles/profileRepository.js');
  assert.ok((await getTitlesAndHonors(1)).some(a=>String(a.awardRecordId)===String(r.record_id)));passed++;
  await call('POST',`/award-records/${dup.record_id}/record`,{version:1},5);
  assert.equal((await call('GET',`/award-records/${r.record_id}`,null,5)).histories.length,3);
  await client.query(rewrite('UPDATE app.user_unit_scopes SET valid_to=NOW()-INTERVAL \'1 second\' WHERE user_id=5'));
  await call('GET',`/award-records/${r.record_id}`,null,5,403);
  await call('GET','/award-records?contextUnitId=2',null,5,403);
  const forbiddenDownload=await fetch(`${base}/award-decision-files/${detail.files[0].decision_file_id}/download`,{headers:{Authorization:`Bearer ${tokens[5]}`}});
  assert.equal(forbiddenDownload.status,403);passed++;
  console.log(`PASS W2-P2: ${passed} real HTTP/PostgreSQL assertions. Isolated schema rolled back.`);
} finally {
  if(client) {
    const files=await client.query(rewrite('SELECT storage_key FROM app.award_decision_files')).catch(()=>({rows:[]}));
    const {default:storage}=await import('../src/modules/evidences/storage/localStorageAdapter.js');
    for(const f of files.rows) await storage.deleteFile(f.storage_key);
  }
  if(server) await new Promise(resolve=>server.close(resolve));
  if(client){await client.query('ROLLBACK');client.release();}
  await pool.end();
}
