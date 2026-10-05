import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyStatusChanged, eventSchema, listSchema } from '../src/modules/notifications/notificationService.js';
import { AwardService } from '../src/modules/awards/awardService.js';
test('contract rejects injected recipients/content, invalid pagination and missing transaction',async()=>{
 const event={entityType:'AWARD',entityId:1,version:2,fromStatus:'DRAFT',toStatus:'RECORDED'};
 assert.equal(eventSchema.safeParse({...event,userId:99}).success,false);
 assert.equal(eventSchema.safeParse({...event,title:'private'}).success,false);
 for(const q of [{page:0},{pageSize:101},{unreadOnly:'1'},{userId:2}]) assert.equal(listSchema.safeParse(q).success,false);
 await assert.rejects(notifyStatusChanged(null,event));
 await assert.rejects(notifyStatusChanged({query:async()=>({rows:[]})},event));
 await assert.rejects(notifyStatusChanged({query:async()=>({rows:[]})},{...event,toStatus:'VERIFIED'}));
});
test('notification failure aborts award status/history and audit transaction',async()=>{
 const calls=[];
 const c={query:async sql=>{
  calls.push(sql);
  return {rows:sql.includes('SELECT * FROM app.award_records')?[{record_id:1,decision_id:1,context_unit_id:2,status:'RECORDED',version:2}]:sql.includes('UPDATE app.award_records')?[{record_id:1,status:'REVOKED',version:3}]:[]};
 },release(){calls.push('release');}};
 const service=new AwardService({pool:()=>({connect:async()=>c}),roles:async()=>[{Code:'RECORDS_OFFICER'}],scope:async()=>true,
  audit:async()=>{calls.push('audit');},notify:async(client,event)=>{
   assert.equal(client,c);assert.equal(event.version,3);assert.equal(event.fromStatus,'RECORDED');throw Error('notification failure');
  }});
 await assert.rejects(service.transition(1,{version:2,reason:'synthetic'},{userId:5},'REVOKED'),/notification failure/);
 assert.ok(calls.some(sql=>sql.includes('INSERT INTO app.award_record_histories')));
 assert.ok(calls.includes('ROLLBACK'));assert.ok(calls.includes('release'));
 assert.ok(!calls.includes('COMMIT'));assert.ok(!calls.includes('audit'));
});
