import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connectDB,closeDB,setPool} from '../src/config/database.js';
import {AwardService} from '../src/modules/awards/awardService.js';
import {ApplicationService} from '../src/modules/awards/applicationService.js';
import {report} from '../src/modules/reports/reportService.js';
import storage from '../src/modules/evidences/storage/localStorageAdapter.js';

test('SQL Server complete application council decision award flow rolls back', {timeout:120000},async t=>{
 const p=await connectDB();const c=await p.connect();await c.query('BEGIN');
 let pending=Promise.resolve();const run=(q,a=[])=>{if(/^(BEGIN|COMMIT|ROLLBACK)$/i.test(q.trim()))return Promise.resolve({rows:[],rowCount:0});const r=pending.then(()=>c.query(q,a));pending=r.catch(()=>{});return r;};
 const client={query:run,release:async()=>{}};const pool={query:run,connect:async()=>client};setPool(pool);
 const marker='SQL_'+randomUUID().slice(0,8);const user={userId:1},manager={userId:2},officer={userId:5},council={userId:6};
 try {
  // Source files are checked through the real private-storage adapter (no mocked existence).
  const apps=new ApplicationService(),awards=new AwardService();
  await t.test('native report scopes pagination and search',async()=>{
   const admin=await report({pageSize:2},{userId:3});assert.equal(admin.items.length,2);assert.ok(admin.total>=admin.items.length);
   assert.ok(Array.isArray((await report({search:'nghiên'},{userId:1})).items));
   assert.ok((await report({},user)).items.every(r=>r.lecturer_id==='1'));
   assert.ok((await report({},{userId:3},true)).startsWith('\uFEFF'));
  });
  const cycle=await apps.createCycle({code:marker,name:'Kỳ thử SQL Server rollback',startDate:'2026-01-01',endDate:'2099-12-31'},officer);
  const target=(await c.query("SELECT TOP(1) award_type_id FROM app.award_types WHERE is_active=1 AND applicable_subject_type IN ('BOTH','LECTURER') ORDER BY award_type_id")).rows[0];
  let r=await apps.create({lecturerId:1,cycleId:cycle.award_period_id,targetAwardTypeId:target.award_type_id,purpose:'Kiểm tra quy trình SQL Server',achievementIds:[4],awardRecordIds:[]},user);
  await t.test('submit freezes source and immutable input',async()=>{
   r=await apps.transition(r.application_id,{version:r.version},user,'submit');assert.equal(r.status,'SUBMITTED');
   const snap=(await c.query('SELECT * FROM app.award_application_inputs WHERE application_id=$1',[r.application_id])).rows[0];assert.equal(snap.snapshot.source,'SQL_SERVER');assert.equal(snap.snapshot.achievements[0].record.achievement_id,4);
  });
  await t.test('unit forward council assignment correction and resubmit',async()=>{
   r=await apps.transition(r.application_id,{version:r.version,reason:'Đơn vị xác nhận nguồn hợp lệ'},manager,'forward');assert.equal(r.status,'COUNCIL_PENDING');
   r=await apps.review(r.application_id,{version:r.version,reviewerId:6,reason:'Phân công xem xét hồ sơ'},council,'assign');
   r=await apps.review(r.application_id,{version:r.version,reason:'Yêu cầu giải trình bổ sung'},council,'request-correction');assert.equal(r.status,'NEED_CORRECTION');
   r=await apps.update(r.application_id,{version:r.version,purpose:'Đã bổ sung nội dung giải trình SQL Server',achievementIds:[4],awardRecordIds:[]},user);
   r=await apps.review(r.application_id,{version:r.version,reason:'Giải trình và gửi lại hồ sơ'},user,'resubmit');
   r=await apps.transition(r.application_id,{version:r.version,reason:'Chuyển lại Hội đồng sau bổ sung'},manager,'forward');
   r=await apps.review(r.application_id,{version:r.version,reason:'Nguồn và giải trình đáp ứng yêu cầu'},council,'recommend');assert.equal(r.status,'RECOMMENDED');
   const inputs=(await c.query('SELECT input_version FROM app.award_application_inputs WHERE application_id=$1',[r.application_id])).rows;assert.equal(inputs.length,2);
  });
  await t.test('prepare award keeps sources and requires decision file',async()=>{
   const ready=await awards.readyApplications({contextUnitId:2},officer);assert.ok(ready.items.some(v=>v.application_id===r.application_id));
   const decision=await awards.createDecision({decisionNumber:marker,decisionDate:'2026-11-11',issuer:'Dữ liệu kiểm thử',title:'Quyết định kiểm thử SQL Server'},officer);
   const record=await awards.createFromApplication(r.application_id,{applicationVersion:r.version,decisionId:decision.decision_id,recognitionYear:2026},officer);
   await assert.rejects(()=>awards.transition(record.record_id,{version:record.version},officer,'RECORDED'),/file quyết định/);
   const file=(await c.query('SELECT TOP(1) * FROM app.award_decision_files ORDER BY decision_file_id')).rows[0];assert.ok(await storage.fileExists(file.storage_key));
   await c.query(`INSERT INTO app.award_decision_files(decision_id,version_no,original_file_name,storage_key,mime_type,file_extension,file_size,sha256_hash,uploaded_by) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8)`,[decision.decision_id,file.original_file_name,file.storage_key+'__not_used',file.mime_type,file.file_extension,file.file_size,file.sha256_hash,officer.userId]);
   // Keep DB-only fixture separate from disk: use a copy of the existing file via a deterministic test adapter.
   const withFixture=new AwardService({adapter:{...storage,fileExists:async key=>key===file.storage_key+'__not_used'?true:storage.fileExists(key)}});
   const recorded=await withFixture.transition(record.record_id,{version:record.version},officer,'RECORDED');assert.equal(recorded.status,'RECORDED');
   const revoked=await withFixture.transition(record.record_id,{version:recorded.version,reason:'Kết thúc kiểm thử rollback'},officer,'REVOKED');assert.equal(revoked.status,'REVOKED');
   assert.ok((await awards.detail(record.record_id,officer)).histories.length>=3);
  });
 }finally{await pending;await c.query('ROLLBACK');await c.release();setPool(p);assert.equal((await p.query('SELECT COUNT(*) n FROM app.award_periods WHERE code=$1',[marker])).rows[0].n,0);await closeDB();}
});
