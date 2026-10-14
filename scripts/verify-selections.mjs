import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool,getDbPoolConfig,setPool } from '../backend/src/config/database.js';
import { transactionPool } from '../database/scripts/seedScenario.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pool=new Pool({...getDbPoolConfig(),max:1,min:0});
let c,server,base,fingerprintSql,before;
const results=[],tokens={};
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
async function get(route,user,expected=200){
  const r=await fetch(base+route,{headers:user ? {Authorization:'Bearer '+tokens[user]} : {},signal:AbortSignal.timeout(20000)});
  const out=await r.json();assert.equal(r.status,expected,route+': '+JSON.stringify(out.error || {}));return out.data;
}
try {
  c=await pool.connect();
  const tables=(await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='app' AND table_type='BASE TABLE' ORDER BY table_name")).rows;
  fingerprintSql='SELECT * FROM ('+tables.map(({table_name:t})=>{if(!/^[a-z_]+$/.test(t))throw new Error('Invalid identifier');return `SELECT '${t}' table_name,md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text)::text,'[]')) hash FROM app.${t} r`;}).join(' UNION ALL ')+') hashes ORDER BY table_name';
  before=(await c.query(fingerprintSql)).rows;
  await c.query('BEGIN');setPool(transactionPool(c));
  server=(await import('../backend/src/app.js')).default.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  base=`http://127.0.0.1:${server.address().port}/api/v1`;
  for(const user of ['an.nv','bich.tt','cuong.lh','records.demo','council.demo','council.other','rep.expired','duc.pm','linh.pharm']) {
    const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:'demo1234'})});
    assert.equal(r.status,200);tokens[user]=(await r.json()).data.accessToken;
  }
  const units=Object.fromEntries((await c.query('SELECT code,unit_id FROM app.organization_units')).rows.map(u=>[u.code,Number(u.unit_id)]));
  const lecturerIds=Object.fromEntries((await c.query('SELECT u.username,l.lecturer_id FROM app.lecturers l JOIN app.users u USING(user_id)')).rows.map(u=>[u.username,Number(u.lecturer_id)]));
  await check('Authentication and purpose validation',async()=>{
    await get('/selection-options',null,401);await get('/selection-options?purpose=unknown','an.nv',400);
    await get('/selection-options?purpose=AWARD','an.nv',403);await get('/selection-options?purpose=KPI_MAPPING','bich.tt',403);
  });
  await check('Personal options use lecturer identity and named award catalogs',async()=>{
    const out=await get('/selection-options?purpose=APPLICATION','an.nv');
    assert.deepEqual(out.lecturers.map(l=>l.id),[lecturerIds['an.nv']]);assert.equal(out.lecturers[0].name,'Nguyễn Văn An');
    assert.ok(out.awardTypes.some(t=>t.name==='Chiến sĩ thi đua cơ sở'));assert.equal(out.subjectUnits.length,0);
    assert.ok(!JSON.stringify(out).match(/password_hash|refresh_token|"email"|"phone"/));
  });
  await check('Manager scope includes descendants and excludes Khoa Dược',async()=>{
    const out=await get('/selection-options?purpose=APPLICATION','bich.tt');
    assert.deepEqual(out.workflowUnits.map(u=>u.id).sort(),[units.FIT,units.FIT_SE,units.FIT_CS].sort());
    assert.ok(!out.workflowUnits.some(u=>u.id===units.PHARM));
  });
  await check('Representative chooses only the assigned collective; expired assignment excluded',async()=>{
    const out=await get('/selection-options?purpose=APPLICATION','cuong.lh');assert.deepEqual(out.subjectUnits.map(u=>u.id),[units.FIT_SE]);
    const expired=await get('/selection-options?purpose=APPLICATION','rep.expired');assert.equal(expired.subjectUnits.length,0);
    await get(`/selection-sources?purpose=APPLICATION&subjectType=UNIT&subjectId=${units.FIT_CS}`,'rep.expired',403);
  });
  await check('Application sources contain only verified, same-subject achievements and recorded awards',async()=>{
    const out=await get(`/selection-sources?purpose=APPLICATION&subjectType=LECTURER&subjectId=${lecturerIds['an.nv']}`,'an.nv');
    assert.ok(out.achievements.length);assert.ok(out.achievements.every(a=>a.status==='VERIFIED' && a.title));
    assert.ok(out.awardRecords.every(a=>a.status==='RECORDED' && a.decisionNumber));
    await get(`/selection-sources?purpose=APPLICATION&subjectType=LECTURER&subjectId=${lecturerIds['linh.pharm']}`,'an.nv',403);
    await get('/selection-sources?purpose=APPLICATION&subjectType=LECTURER&subjectId=NaN','an.nv',400);
  });
  await check('Officer sources and replacement records obey scope',async()=>{
    const out=await get('/selection-options?purpose=AWARD','records.demo');
    assert.ok(out.decisions.every(d=>d.title && d.decisionNumber));assert.ok(!out.lecturers.some(l=>l.id===lecturerIds['linh.pharm']));
    const sources=await get(`/selection-sources?purpose=AWARD&subjectType=LECTURER&subjectId=${lecturerIds['an.nv']}`,'records.demo');
    assert.ok(sources.awardRecords.every(r=>r.status==='REVOKED'));
    await get(`/selection-sources?purpose=AWARD&subjectType=LECTURER&subjectId=${lecturerIds['linh.pharm']}`,'records.demo',403);
  });
  await check('AI options select real lecturer IDs even when user ID differs',async()=>{
    const own=await get('/selection-options?purpose=AI','linh.pharm');assert.deepEqual(own.lecturers.map(l=>l.id),[lecturerIds['linh.pharm']]);
    const manager=await get('/selection-options?purpose=AI','bich.tt');assert.ok(!manager.lecturers.some(l=>l.id===lecturerIds['linh.pharm']));
  });
  await check('Report catalogs and admin identity choices are named',async()=>{
    const report=await get('/selection-options?purpose=REPORT','an.nv');assert.ok(report.academicYears.every(y=>y.name));assert.ok(report.units.some(u=>u.id===units.FIT_SE));
    const admin=await get('/selection-options?purpose=ORGANIZATION','duc.pm');assert.ok(admin.users.every(u=>u.name && u.username));assert.ok(admin.lecturers.some(l=>l.id===lecturerIds['linh.pharm']));
  });
  const candidate=(await c.query("SELECT application_id FROM app.award_applications WHERE context_unit_id=$1 AND lecturer_id=$2 AND status IN ('COUNCIL_PENDING','UNDER_REVIEW') ORDER BY application_id LIMIT 1",[units.FIT_SE,lecturerIds['an.nv']])).rows[0];
  assert.ok(candidate,'Need a council-stage demo application');
  await check('Reviewer choices require Council access and exclude newly revoked roles',async()=>{
    const route='/award-applications/'+candidate.application_id+'/reviewers';
    const rows=await get(route,'council.demo');assert.ok(rows.some(r=>r.username==='council.demo'));assert.ok(rows.every(r=>r.name));
    await get(route,'bich.tt',403);
    await c.query('SAVEPOINT revoke_reviewer');
    await c.query("UPDATE app.user_roles SET revoked_at=NOW() WHERE user_id=(SELECT user_id FROM app.users WHERE username='council.other')");
    const revoked=await get(route,'council.demo');assert.ok(!revoked.some(r=>r.username==='council.other'));
    await c.query('ROLLBACK TO SAVEPOINT revoke_reviewer');await c.query('RELEASE SAVEPOINT revoke_reviewer');
  });
  await check('Revoked roles cannot reuse stale JWT to load catalogs',async()=>{
    await c.query('SAVEPOINT revoke_account_role');
    await c.query("UPDATE app.user_roles SET revoked_at=NOW() WHERE user_id=(SELECT user_id FROM app.users WHERE username='an.nv')");
    await get('/selection-options?purpose=APPLICATION','an.nv',403);
    await c.query('ROLLBACK TO SAVEPOINT revoke_account_role');await c.query('RELEASE SAVEPOINT revoke_account_role');
  });
}catch(e){results.push({name:'Verification stopped',status:'FAIL',message:e.message});console.error(e.message);process.exitCode=1;}
finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  if(c){await c.query('ROLLBACK');try{assert.deepEqual((await c.query(fingerprintSql)).rows,before);results.push({name:'All app contents unchanged after rollback',status:'PASS'});}catch(e){process.exitCode=1;results.push({name:'Rollback fingerprint',status:'FAIL',message:e.message});}c.release();}
  setPool(null);await pool.end();fs.mkdirSync(path.join(root,'output/selections'),{recursive:true});fs.writeFileSync(path.join(root,'output/selections/verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),tests:results},null,2));
  console.log(results.filter(r=>r.status==='PASS').length+' selection checks passed.');
}
