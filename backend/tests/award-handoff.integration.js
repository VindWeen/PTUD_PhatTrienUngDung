// Real HTTP/PostgreSQL checks; all schema and fixture changes are rolled back.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';
const schema=`handoff_test_${randomBytes(6).toString('hex')}`;
const rewrite=sql=>sql.replace(/\bapp\b/g,schema);
const pool=new Pool({...getDbPoolConfig(),max:1,connectionTimeoutMillis:5000});
let client,server,passed=0;
try {
 client=await pool.connect();await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='20s'");
 const sql=(query,values)=>client.query(rewrite(query),values);
 for(const name of (await fs.readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(v=>v.endsWith('.sql')).sort()) await sql(await fs.readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8'));
 await sql(await fs.readFile(new URL('../../supabase/seed.sql',import.meta.url),'utf8'));
 const query=async (q,v)=>{
  if(q==='BEGIN')return client.query('SAVEPOINT handoff_mutation');
  if(q==='COMMIT')return client.query('RELEASE SAVEPOINT handoff_mutation');
  if(q==='ROLLBACK'){await client.query('ROLLBACK TO SAVEPOINT handoff_mutation');return client.query('RELEASE SAVEPOINT handoff_mutation');}
  return sql(q,v);
 };
 setPool({query,connect:async()=>({query,release(){}})});
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}/api/v1`;
 const tokens=Object.fromEntries([1,5].map(userId=>[userId,generateAccessToken({userId})]));
 async function call(method,path,body,user=5,status=200){
  const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${tokens[user]}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();assert.equal(response.status,status,`${method} ${path}: ${JSON.stringify(data)}`);passed++;return data.data;
 }
 // Controlled historical fixtures. The latest immutable input differs from stale mutable arrays.
 const achievement=async (lecturer,unit)=>(await sql(`INSERT INTO app.achievements(lecturer_id,unit_id,context_unit_id,title,status,recognition_year,created_by) VALUES($1,$2,2,'Synthetic source','VERIFIED',2026,1) RETURNING *`,[lecturer,unit])).rows[0];
 const source1=await achievement(1,null),source2=await achievement(1,null),collectiveSource=await achievement(null,2);
 const application=async (lecturer,unit,type,source,status='RECOMMENDED')=>{
  const a=(await sql(`INSERT INTO app.award_applications(award_period_id,lecturer_id,unit_id,target_award_type_id,context_unit_id,created_by,purpose,achievement_ids,status) VALUES(1,$1,$2,$3,2,1,'Synthetic reviewed application',$4,$5) RETURNING *`,[lecturer,unit,type,[source1.achievement_id],status])).rows[0];
  for(const [version,record] of [[1,source1],[2,source]])await sql('INSERT INTO app.award_application_inputs(application_id,input_version,snapshot,submitted_by) VALUES($1,$2,$3,1)',[a.application_id,version,JSON.stringify({target:{award_type_id:type},achievements:[{record}],awards:[]})]);
  return a;
 };
 const a=await application(1,null,1,source2),collective=await application(null,2,4,collectiveSource),pending=await application(1,null,2,source2,'SUBMITTED');
 const decision=await call('POST','/award-decisions',{decisionNumber:'SYNTHETIC-HANDOFF',decisionDate:'2026-11-03',issuer:'Synthetic',title:'Handoff decision'},5,201);
 const path=`/award-applications/${a.application_id}/award-record`,body={applicationVersion:Number(a.version),decisionId:Number(decision.decision_id),recognitionYear:2026};
 await call('GET','/award-applications/ready-for-award?contextUnitId=2',null,1,403);
 await call('GET','/award-applications/ready-for-award?contextUnitId=999999',null,5,403);
 const queue=await call('GET','/award-applications/ready-for-award?contextUnitId=2&pageSize=1');
 assert.equal(queue.items.length,1);assert.equal(queue.hasMore,true);assert.equal(String(queue.items[0].application_id),String(collective.application_id));assert.ok(queue.items[0].subject_name);assert.ok(queue.items[0].award_type_name);
 await call('POST',path,body,1,403);
 await call('POST',path,{...body,awardTypeId:2},5,400);
 await call('POST','/award-records',{lecturerId:1,awardTypeId:1,decisionId:Number(decision.decision_id),recognitionYear:2026,applicationId:Number(a.application_id)},5,400);
 await call('POST',path,{...body,applicationVersion:999},5,409);
 await call('POST',`/award-applications/${pending.application_id}/award-record`,body,5,409);
 await sql("UPDATE app.achievements SET status='REVOKED' WHERE achievement_id=$1",[source2.achievement_id]);await call('POST',path,body,5,400);
 await sql("UPDATE app.achievements SET status='VERIFIED' WHERE achievement_id=$1",[source2.achievement_id]);
 await sql('UPDATE app.award_types SET is_active=FALSE WHERE award_type_id=1');await call('POST',path,body,5,400);await sql('UPDATE app.award_types SET is_active=TRUE WHERE award_type_id=1');
 // Later employment changes must not silently move the approved context.
 await sql("UPDATE app.lecturer_assignments SET valid_to=NOW()-INTERVAL '1 second' WHERE lecturer_id=1 AND valid_from<=NOW() AND (valid_to IS NULL OR valid_to>NOW())");
 const r=await call('POST',path,body,5,201);
 assert.equal(String(r.lecturer_id),'1');assert.equal(String(r.award_type_id),'1');assert.equal(String(r.context_unit_id),'2');assert.equal(String(r.application_id),String(a.application_id));assert.equal(r.application_input_version,2);
 const detail=await call('GET',`/award-records/${r.record_id}`);assert.deepEqual(detail.achievementIds.map(String),[String(source2.achievement_id)]);
 await call('POST',path,body,5,409);
 const linked=(await call('GET','/award-applications/ready-for-award?contextUnitId=2')).items.find(v=>String(v.application_id)===String(a.application_id));assert.equal(String(linked.linked_record_id),String(r.record_id));assert.equal(linked.linked_record_status,'DRAFT');
 const c=await call('POST',`/award-applications/${collective.application_id}/award-record`,{...body,applicationVersion:Number(collective.version)},5,201);assert.equal(String(c.unit_id),'2');assert.equal(String(c.award_type_id),'4');
 const form=new FormData();form.append('file',new Blob(['%PDF-1.7 synthetic handoff'],{type:'application/pdf'}),'synthetic.pdf');
 const upload=await fetch(`${base}/award-decisions/${decision.decision_id}/files`,{method:'POST',headers:{Authorization:`Bearer ${tokens[5]}`},body:form});assert.equal(upload.status,201,JSON.stringify(await upload.json()));passed++;
 await sql("UPDATE app.award_applications SET status='NOT_RECOMMENDED' WHERE application_id=$1",[a.application_id]);await call('POST',`/award-records/${r.record_id}/record`,{version:1},5,409);await sql("UPDATE app.award_applications SET status='RECOMMENDED' WHERE application_id=$1",[a.application_id]);
 await sql('UPDATE app.award_records SET award_type_id=2 WHERE record_id=$1',[r.record_id]);await call('POST',`/award-records/${r.record_id}/record`,{version:1},5,409);await sql('UPDATE app.award_records SET award_type_id=1 WHERE record_id=$1',[r.record_id]);
 await call('POST',`/award-records/${r.record_id}/record`,{version:1});await call('POST',`/award-records/${c.record_id}/record`,{version:1});await call('POST',path,body,5,409);
 await call('POST',`/award-records/${r.record_id}/revoke`,{version:2,reason:'Synthetic replacement'});
 const newDecision=await call('POST','/award-decisions',{decisionNumber:'SYNTHETIC-HANDOFF-REPLACE',decisionDate:'2026-11-03',issuer:'Synthetic',title:'Replacement'},5,201);
 const replacement=await call('POST',path,{...body,decisionId:Number(newDecision.decision_id)},5,201);assert.equal(String(replacement.replaces_award_record_id),String(r.record_id));
 // PostgreSQL also guards a writer that bypasses the service's application lock.
 await sql('SAVEPOINT duplicate_guard');await assert.rejects(sql(`INSERT INTO app.award_records(lecturer_id,context_unit_id,award_type_id,decision_id,recognition_year,created_by,status,application_id,application_input_version) VALUES(1,2,1,$1,2026,5,'DRAFT',$2,2)`,[newDecision.decision_id,a.application_id]),e=>e.code==='23505');await sql('ROLLBACK TO SAVEPOINT duplicate_guard');await sql('RELEASE SAVEPOINT duplicate_guard');passed++;
 await sql("UPDATE app.user_unit_scopes SET valid_to=NOW()-INTERVAL '1 second' WHERE user_id=5");await call('GET','/award-applications/ready-for-award?contextUnitId=2',null,5,403);await call('POST',path,{...body,decisionId:Number(newDecision.decision_id)},5,403);
 console.log(`PASS award handoff: ${passed} real HTTP/PostgreSQL checks plus linkage/source invariants. Isolated schema rolled back.`);
} finally {
 if(client){const files=await client.query(rewrite('SELECT storage_key FROM app.award_decision_files')).catch(()=>({rows:[]}));const {default:storage}=await import('../src/modules/evidences/storage/localStorageAdapter.js');for(const f of files.rows)await storage.deleteFile(f.storage_key);}
 if(server)await new Promise(resolve=>server.close(resolve));if(client){await client.query('ROLLBACK');client.release();}await pool.end();
}
