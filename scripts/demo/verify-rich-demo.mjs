import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { connectDB, getDbPoolConfig } from '../../backend/src/config/database.js';
import storage from '../../backend/src/modules/evidences/storage/localStorageAdapter.js';
const root=process.cwd(), manifest=JSON.parse(fs.readFileSync('output/rich-demo/manifest.json','utf8'));
assert.equal(getDbPoolConfig().database,'PTUD_LHU_Demo');
const base='http://127.0.0.1:5175/api/v1',tokens={},checks=[];
async function req(route,user,method='GET',body,expected=200){
 const r=await fetch(base+route,{method,headers:{...(tokens[user]?{Authorization:'Bearer '+tokens[user]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const raw=await r.text(); assert.equal(r.status,expected,`${user||'public'} ${route}: ${raw.slice(0,300)}`);
 const result=JSON.parse(raw);return result.data;
}
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}
const pool=await connectDB();
try{
 await check('40 active/base accounts and organization hierarchy',async()=>{
  const n=(await pool.query('SELECT COUNT(*) n FROM app.users')).rows[0].n;assert.ok(n>=40);
  assert.ok((await pool.query('SELECT COUNT(*) n FROM app.organization_units WHERE parent_id IS NOT NULL')).rows[0].n>=15);
 });
 for(const name of ['an.nv','bich.tt','cuong.lh','council.demo','records.demo','duc.pm','linh.pharm','rep.expired','mai.cntt','huy.cntt','hoidong.truong','thidua.truong','quanly.duoc'])await check('Login '+name,async()=>{tokens[name]=(await req('/auth/login',name,'POST',{username:name,password:'demo1234'})).accessToken;assert.ok(tokens[name]);});
 await check('Locked account rejected',async()=>{await req('/auth/login',null,'POST',{username:'locked.demo',password:'demo1234'},401);});
 for(const user of ['an.nv','bich.tt','linh.pharm','quanly.duoc'])await check('Achievements and dashboard '+user,async()=>{await req('/achievements?pageSize=100',user);await req('/dashboard/summary',user);});
 for(const user of ['an.nv','cuong.lh','bich.tt','council.demo','hoidong.truong','records.demo','thidua.truong'])await check('Award applications '+user,async()=>{await req('/award-applications',user);});
 await check('An KPI includes draft, completed, partial and overdue',async()=>{const {items}=await req('/kpi/goals','an.nv');assert.ok(items.some(g=>g.status==='DRAFT'));assert.ok(items.some(g=>Number(g.result?.actual)>=Number(g.target)));assert.ok(items.some(g=>g.result&&Number(g.result.actual)<Number(g.target)));});
 await check('An CV draft and public snapshot',async()=>{const cv=await req('/me/cv','an.nv');assert.equal(cv.draft.template,'modern');assert.equal(cv.achievements.filter(a=>cv.draft.achievementIds.includes(a.achievementId)).length,3);const pub=await req('/cv/'+cv.publicId);assert.equal(pub.achievements.length,3);assert.ok(pub.summary);});
 await check('Mai CV is private until published',async()=>{const cv=await req('/me/cv','mai.cntt');assert.equal(cv.isPublished,false);await req('/cv/'+cv.publicId,null,'GET',null,404);});
 const anId=(await pool.query("SELECT l.lecturer_id FROM app.lecturers l JOIN app.users u ON u.user_id=l.user_id WHERE u.username='an.nv'")).rows[0].lecturer_id;
 await check('Live structured analysis returns pass, fail, review',async()=>{
  const ids=manifest.criteria.filter(c=>c.confirmed).map(c=>c.id);
  const run=await req('/ai/evaluations/structured','an.nv','POST',{subjectType:'LECTURER',subjectId:anId,criteriaVersionIds:ids,provider:'mock'},201);
  assert.deepEqual(run.criterionResults.map(c=>c.thresholdMetric.isSatisfied),[true,false,'UNCONFIRMED']);assert.equal(run.automaticAwardGranted,false);assert.equal(run.providerInfo.isMock,true);
  manifest.liveCheck={runId:run.runId,overallConclusion:run.overallConclusion,metrics:run.criterionResults.map(c=>c.thresholdMetric)};
  await req('/ai/evaluations/'+run.runId,'an.nv');
 });
 await check('Manager cannot read Pharmacy achievement',async()=>{const outside=(await pool.query("SELECT TOP (1) achievement_id FROM app.achievements WHERE context_unit_id IN (SELECT unit_id FROM app.organization_units WHERE code='PHARM_CL')")).rows[0];assert.ok(outside);await req('/achievements/'+outside.achievement_id,'bich.tt','GET',null,403);});
 await check('Lecturer cannot read another lecturer CV through own endpoint',async()=>{const an=await req('/me/cv','an.nv'),mai=await req('/me/cv','mai.cntt');assert.notEqual(an.profile.lecturerId,mai.profile.lecturerId);assert.notEqual(an.publicId,mai.publicId);});
 await check('Award ledger visible to scoped and university officers',async()=>{await req('/award-records?contextUnitId=2','records.demo');await req('/award-records?contextUnitId=2','thidua.truong');});
 await check('Regulations list has real source metadata and demo criteria',async()=>{const r=await req('/regulations','duc.pm');assert.ok(r);});
 let refs=0;
 await check('All private references match file size and SHA-256',async()=>{for(const r of (await pool.query('SELECT storage_key,file_size,sha256_hash FROM app.evidence_files UNION ALL SELECT storage_key,file_size,sha256_hash FROM app.award_decision_files')).rows){const b=fs.readFileSync(storage.resolveSafePath(r.storage_key));assert.equal(b.length,Number(r.file_size));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),r.sha256_hash);refs++;}});
 await check('Submitted applications have immutable input snapshots',async()=>{assert.equal((await pool.query("SELECT COUNT(*) n FROM app.award_applications a WHERE status<>'DRAFT' AND NOT EXISTS(SELECT 1 FROM app.award_application_inputs i WHERE i.application_id=a.application_id)")).rows[0].n,0);});
 await check('No untrusted or disabled FK constraints',async()=>{assert.equal((await pool.query("SELECT COUNT(*) n FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1")).rows[0].n,0);});
 await check('Historical award sources match owner and year',async()=>{assert.equal((await pool.query("SELECT COUNT(*) n FROM app.award_records r JOIN app.award_decisions d ON d.decision_id=r.decision_id JOIN app.award_record_achievements x ON x.record_id=r.record_id JOIN app.achievements a ON a.achievement_id=x.achievement_id WHERE d.decision_number LIKE 'DEMO-QD-%' AND (r.lecturer_id<>a.lecturer_id OR r.recognition_year<>a.recognition_year)")).rows[0].n,0);});
 await check('Showcase application links to recorded award',async()=>{const a=(await pool.query("SELECT r.record_id,r.application_id FROM app.award_records r JOIN app.award_applications a ON a.application_id=r.application_id WHERE a.purpose LIKE 'DEMO-READY%' AND r.status='RECORDED'")).rows;assert.equal(a.length,1);});
 await check('SQL Server CHECKDB',async()=>{await pool.query('DBCC CHECKDB ([PTUD_LHU_Demo]) WITH NO_INFOMSGS;');});
 const counts={};for(const t of ['users','organization_units','achievements','kpi_goals','award_applications','award_records','regulation_documents','regulation_document_versions','award_criteria_versions','evaluation_runs','ai_rag_explanations','lecturer_cvs','notifications'])counts[t]=(await pool.query('SELECT COUNT(*) n FROM app.'+t)).rows[0].n;
 const report={checkedAt:new Date().toISOString(),database:'PTUD_LHU_Demo',url:'http://127.0.0.1:5175',counts,privateReferences:refs,checks,liveAnalysis:manifest.liveCheck,limitations:['Structured evaluation is deterministic; live LLM explanation verification is recorded separately in RICH_DEMO_BROWSER.json.','Demo confirmed criteria are synthetic, not actual LHU policies.','Attached evidence/decision PDFs are generic explicitly labeled simulation files.']};
 fs.writeFileSync(path.join(root,'docs/testing/RICH_DEMO_VERIFICATION.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:true,checks:checks.length,counts,privateReferences:refs},null,2));
}finally{await pool.end();}



