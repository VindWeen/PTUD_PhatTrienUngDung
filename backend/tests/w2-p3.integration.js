// Real Express + pg + Supabase tests in a temporary schema, entirely rolled back.
// No seed or migration is applied to the shared app schema.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

const schema = `w2p3_test_${randomBytes(6).toString('hex')}`;
assert.match(schema,/^w2p3_test_[a-f0-9]{12}$/);
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
  const { AwardService } = await import('../src/modules/awards/awardService.js');
  const { notifyStatusChanged } = await import('../src/modules/notifications/notificationService.js');
  const privacy=(await client.query(`SELECT has_table_privilege('anon',$1,'SELECT') AS anon_read,has_table_privilege('authenticated',$1,'SELECT') AS authenticated_read`,[`${schema}.notifications`])).rows[0];
  assert.equal(privacy.anon_read,false);assert.equal(privacy.authenticated_read,false);
  const service = new AwardService({adapter:{fileExists:async()=>true}});
  const officer={userId:5};
  const d=await service.createDecision({decisionNumber:'SYNTHETIC-W2-P3',decisionDate:'2026-10-05',issuer:'Synthetic',title:'Synthetic'},officer);
  const r=await service.createRecord({lecturerId:1,awardTypeId:1,decisionId:Number(d.decision_id),recognitionYear:2026},officer);
  await client.query(rewrite(`INSERT INTO app.award_decision_files(decision_id,version_no,original_file_name,storage_key,mime_type,file_extension,file_size,sha256_hash,uploaded_by) VALUES($1,1,'synthetic.pdf','synthetic-w2p3','application/pdf','.pdf',8,$2,5)`),[d.decision_id,'a'.repeat(64)]);
  await service.transition(r.record_id,{version:1},officer,'RECORDED');
  let inbox=await call('GET','/notifications',null,1);
  assert.equal(inbox.total,1);assert.equal(inbox.unreadCount,1);assert.equal(inbox.items[0].toStatus,'RECORDED');
  const nid=inbox.items[0].notificationId;
  assert.deepEqual(Object.keys(inbox.items[0]).sort(),['notificationId','entityType','entityId','version','fromStatus','toStatus','createdAt','readAt'].sort());
  assert.equal((await call('GET','/notifications',null,2)).total,0);
  assert.equal((await call('GET','/notifications',null,3)).total,0);
  await call('PATCH',`/notifications/${nid}/read`,{},2,404);
  const first=await call('PATCH',`/notifications/${nid}/read`,{},1);
  const second=await call('PATCH',`/notifications/${nid}/read`,{},1);
  assert.equal(first.readAt,second.readAt);
  assert.equal((await call('GET','/notifications?unreadOnly=true',null,1)).total,0);
  await call('GET','/notifications?pageSize=101',null,1,400);
  await call('GET','/notifications?userId=1',null,2,400);
  const unauth=await fetch(`${base}/notifications`);assert.equal(unauth.status,401);passed++;
  const event={entityType:'AWARD',entityId:r.record_id,version:2,fromStatus:'DRAFT',toStatus:'RECORDED'};
  assert.equal((await notifyStatusChanged(adapted,event)).length,0);
  await assert.rejects(notifyStatusChanged(adapted,{...event,version:3}));
  // Failure after notifications were inserted must undo status, history, audit AND notification.
  const failAudit=new AwardService({audit:async()=>{throw Error('synthetic audit failure');}});
  await assert.rejects(failAudit.transition(r.record_id,{version:2,reason:'synthetic'},officer,'REVOKED'),/synthetic audit failure/);
  assert.equal((await service.detail(r.record_id,officer)).status,'RECORDED');
  assert.equal((await service.detail(r.record_id,officer)).histories.length,2);
  assert.equal((await call('GET','/notifications',null,1)).total,1);
  // Database failure during notification insertion must also undo status/history.
  await client.query('SAVEPOINT failing_insert');
  await client.query(rewrite("ALTER TABLE app.notifications ADD CONSTRAINT synthetic_failure CHECK(to_status<>'REVOKED')"));
  await assert.rejects(service.transition(r.record_id,{version:2,reason:'synthetic'},officer,'REVOKED'),e=>e.code==='23514');
  assert.equal((await service.detail(r.record_id,officer)).status,'RECORDED');
  await client.query('ROLLBACK TO SAVEPOINT failing_insert');await client.query('RELEASE SAVEPOINT failing_insert');
  await service.transition(r.record_id,{version:2,reason:'synthetic'},officer,'REVOKED');
  inbox=await call('GET','/notifications?pageSize=1',null,1);
  assert.equal(inbox.total,2);assert.equal(inbox.items.length,1);assert.equal(inbox.items[0].toStatus,'REVOKED');assert.equal(inbox.unreadCount,1);
  const page2=await call('GET','/notifications?page=2&pageSize=1',null,1);
  assert.equal(String(page2.items[0].notificationId),String(nid));
  assert.equal((await call('GET','/notifications?page=99',null,1)).items.length,0);
  // Collective recipient and removal of current authority.
  const rep=(await client.query(rewrite("SELECT user_id FROM app.unit_representatives WHERE unit_id=2 AND revoked_at IS NULL AND valid_from<=NOW() AND (valid_to IS NULL OR valid_to>NOW())"))).rows[0];
  assert.ok(rep,'seed must include collective representative');
  const collective=await service.createRecord({organizationUnitId:2,awardTypeId:4,decisionId:Number(d.decision_id),recognitionYear:2026},officer);
  await service.transition(collective.record_id,{version:1},officer,'RECORDED');
  const repInbox=await call('GET','/notifications',null,Number(rep.user_id));
  const collectiveNotification=repInbox.items.find(n=>String(n.entityId)===String(collective.record_id));assert.ok(collectiveNotification);
  await client.query(rewrite('UPDATE app.unit_representatives SET revoked_at=NOW() WHERE user_id=$1'),[rep.user_id]);
  assert.ok(!(await call('GET','/notifications',null,Number(rep.user_id))).items.some(n=>String(n.notificationId)===String(collectiveNotification.notificationId)));
  await call('PATCH',`/notifications/${collectiveNotification.notificationId}/read`,{},Number(rep.user_id),404);
  // Achievement producer is provisional; exercise scoped delivery on persisted synthetic state.
  const a=(await client.query(rewrite("INSERT INTO app.achievements(lecturer_id,context_unit_id,title,status,version,created_by,submitted_by,recognition_year) VALUES(1,2,'Synthetic','SUBMITTED',2,1,1,2026) RETURNING achievement_id"))).rows[0];
  await notifyStatusChanged(adapted,{entityType:'ACHIEVEMENT',entityId:a.achievement_id,version:2,fromStatus:'DRAFT',toStatus:'SUBMITTED'});
  const managers=(await client.query(rewrite("SELECT user_id FROM app.notifications WHERE entity_type='ACHIEVEMENT' AND entity_id=$1"),[a.achievement_id])).rows;
  assert.ok(managers.length);assert.ok(managers.every(m=>String(m.user_id)!=='1' && String(m.user_id)!=='3'));
  for(const m of managers) {
   const list=await call('GET','/notifications',null,Number(m.user_id));assert.ok(list.items.some(n=>n.entityType==='ACHIEVEMENT'));
   await client.query('SAVEPOINT descendant_test');
   await client.query(rewrite('UPDATE app.user_unit_scopes SET include_descendants=FALSE WHERE user_id=$1 AND unit_id<>2'),[m.user_id]);
   assert.ok(!(await call('GET','/notifications',null,Number(m.user_id))).items.some(n=>n.entityType==='ACHIEVEMENT'));
   await client.query('ROLLBACK TO SAVEPOINT descendant_test');await client.query('RELEASE SAVEPOINT descendant_test');
   await client.query(rewrite("UPDATE app.user_unit_scopes SET revoked_at=NOW() WHERE user_id=$1 AND role_id=(SELECT role_id FROM app.roles WHERE code='MANAGER')"),[m.user_id]);
   assert.ok(!(await call('GET','/notifications',null,Number(m.user_id))).items.some(n=>n.entityType==='ACHIEVEMENT'));
  }
  // No writes survive the outer transaction, including the isolated schema.
  console.log(`PASS W2-P3: ${passed} real HTTP assertions plus DB recipient, idempotency and rollback assertions. Isolated schema rolled back.`);
} finally {
  if(server) await new Promise(resolve=>server.close(resolve));
  if(client){await client.query('ROLLBACK');client.release();}
  await pool.end();
}
