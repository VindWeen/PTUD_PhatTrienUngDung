import test from 'node:test';
import assert from 'node:assert/strict';
import { AwardService, recordSchema, decisionSchema } from '../src/modules/awards/awardService.js';
const officer = {userId:5,roles:['RECORDS_OFFICER']};
test('XOR, year, immutable workflow fields and decision metadata',()=>{
 const r={lecturerId:1,awardTypeId:1,decisionId:1,recognitionYear:2026};
 assert.equal(recordSchema.parse(r).achievementIds.length,0);
 for(const b of [{...r,organizationUnitId:2},{...r,lecturerId:null},{...r,recognitionYear:2101},{...r,status:'RECORDED'}]) assert.equal(recordSchema.safeParse(b).success,false);
 assert.equal(decisionSchema.safeParse({decisionNumber:' ',decisionDate:'2026-02-30',issuer:'X',title:'X'}).success,false);
});
test('Admin does not bypass role; RecordsOfficer needs current scope',async()=>{
 const s=new AwardService({roles:async uid=>uid===5 ? [{Code:'RECORDS_OFFICER'}] : [{Code:'ADMIN'}],scope:async()=>false});
 await assert.rejects(s.authorize({userId:3,roles:['ADMIN']},2),e=>e.statusCode===403);
 await assert.rejects(s.authorize(officer,2),e=>e.code==='OUT_OF_SCOPE');
});
test('record requires file; stale version and invalid state reject',async()=>{
 let r={record_id:'1',decision_id:'1',context_unit_id:2,status:'DRAFT',version:'1'};
 const c={query:async sql=>({rows:sql.includes('SELECT * FROM app.award_records')?[r]:[],rowCount:0}),release(){}};
 const s=new AwardService({roles:async uid=>uid===5 ? [{Code:'RECORDS_OFFICER'}] : [{Code:'ADMIN'}],pool:()=>({connect:async()=>c}),scope:async()=>true,audit:async()=>{}});
 await assert.rejects(s.transition(1,{version:1},officer,'RECORDED'),e=>e.statusCode===400);
 await assert.rejects(s.transition(1,{version:2},officer,'RECORDED'),e=>e.statusCode===409);
 r={...r,status:'RECORDED'};
 await assert.rejects(s.transition(1,{version:1},officer,'RECORDED'),e=>e.statusCode===409);
 await assert.rejects(s.transition(1,{version:1},officer,'REVOKED'),e=>e.statusCode===400);
});
test('audit failure rolls back and file is cleaned up',async()=>{
 const calls=[];
 const c={query:async sql=>{calls.push(sql);return {rows:sql.includes('SELECT * FROM app.award_decisions')?[{decision_id:1}]:sql.includes('SELECT * FROM app.award_records')?[{context_unit_id:2,status:'DRAFT'}]:sql.includes('RETURNING decision_file_id')?[{decision_file_id:1,decision_id:1}]:[]};},release(){}};
 const s=new AwardService({roles:async uid=>uid===5 ? [{Code:'RECORDS_OFFICER'}] : [{Code:'ADMIN'}],pool:()=>({connect:async()=>c}),scope:async()=>true,audit:async()=>{throw Error('audit');},adapter:{saveFile:async()=>calls.push('save'),deleteFile:async()=>calls.push('delete')}});
 await assert.rejects(s.upload(1,{originalname:'synthetic.pdf',mimetype:'application/pdf',size:8,buffer:Buffer.from('%PDF-1.7')},officer));
 assert.ok(calls.includes('ROLLBACK'));assert.ok(calls.includes('delete'));assert.ok(!calls.includes('COMMIT'));
});

