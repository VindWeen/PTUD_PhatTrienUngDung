import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDB, setPool, closeDB } from '../config/database.js';
import router from './intelligenceRoutes.js';
import { insertId } from './shared.js';

test('SQL Server V2 regulation → assessment → owned gap KPI; immutable and foreign-source checks',async()=>{
 const pool=await connectDB(),client=await pool.connect();await client.query('BEGIN');
 // Every route uses the same rollback-only transaction; route transactions become save boundaries.
 const tx={query:(sql,params)=>/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)?Promise.resolve({rows:[],rowCount:0}):client.query(sql,params),release:async()=>{}};
 setPool({query:tx.query,connect:async()=>tx});
 try{
  const tag=`integration-${Date.now()}`;
  const owner=await insertId(client,'users','email','$1',[`${tag}@example.test`]);
  const foreign=await insertId(client,'users','email','$1',[`${tag}-foreign@example.test`]);
  await client.query("INSERT app.person_profiles(user_id,full_name,person_type) VALUES($1,'Integration','STUDENT')",[owner]);
  async function call(method,path,params={},body={},user=owner){const layer=router.stack.find(x=>x.route?.path===path&&x.route.methods[method]);assert.ok(layer,`route ${path}`);return new Promise((resolve,reject)=>{let status=200;const req={user:{userId:user},params,body,query:{}};const res={status(n){status=n;return this;},json(value){resolve({status,...value});return this;}};layer.route.stack[0].handle(req,res,reject);});}
  const doc=(await call('post','/regulations/documents',{}, {code:tag,name:'Integration rule'})).data;
  const v=(await call('post','/regulations/documents/:id/versions',{id:doc.id},{version_label:'v1',effective_from:'2020-01-01',source_title:'Official test source',source_url:'https://example.test/regulation'})).data;
  await call('post','/regulations/versions/:id/criteria',{id:v.id},{code:'COUNT',title:'Two activities',source_reference:'Article 1',rule:{type:'count',target:2}});
  await call('post','/regulations/versions/:id/publish',{id:v.id});
  await assert.rejects(call('patch','/regulations/versions/:id',{id:v.id},{source_title:'Tamper'}),e=>e.statusCode===400);
  const run=(await call('post','/ai/evaluations/structured',{}, {regulation_version_id:v.id,evaluation_date:'2026-11-15'})).data;
  assert.equal(run.conclusion,'NOT_MET');assert.equal(run.stale,false);assert.equal(run.results.length,1);assert.equal(run.results[0].missing_details.remaining,2);
  const goal=(await call('post','/kpi/from-ai-gap',{}, {source_result_id:run.results[0].id})).data;
  assert.equal(Number(goal.target_value),2);assert.equal(goal.source_result_id,run.results[0].id);
  await assert.rejects(call('post','/kpi/from-ai-gap',{}, {source_result_id:run.results[0].id},foreign),e=>e.statusCode===404);
  await assert.rejects(call('get','/ai/evaluations/structured/:id',{id:run.id},{},foreign),e=>e.statusCode===403);
  const progress=(await call('post','/kpi/goals/:id/progress',{id:goal.id},{current_value:1})).data;assert.equal(progress.current_value,1);
  await insertId(client,'achievements','owner_user_id,title,achieved_at',"$1,'New activity','2026-10-01'",[owner]);
  const stale=(await call('get','/ai/evaluations/structured/:id',{id:run.id})).data;assert.equal(stale.stale,true);
  await assert.rejects(call('post','/kpi/from-ai-gap',{}, {source_result_id:run.results[0].id}),e=>e.statusCode===400);
  const parent=await insertId(client,'organizations','code,name,organization_type,created_by_user_id',"$1,'Parent','UNIVERSITY',$2",[`${tag}-parent`,owner]);
  const child=await insertId(client,'organizations','parent_id,code,name,organization_type,created_by_user_id',"$1,$2,'Child','CLASS',$3",[parent,`${tag}-child`,owner]);
  await insertId(client,'org_access_grants','organization_id,user_id,permission_code,include_descendants,granted_by_user_id',"$1,$2,'ASSESSMENTS_RUN',1,$2",[parent,owner]);
  const viewGrant=await insertId(client,'org_access_grants','organization_id,user_id,permission_code,include_descendants,granted_by_user_id',"$1,$2,'ASSESSMENTS_VIEW',1,$2",[parent,owner]);
  const invitation=await insertId(client,'membership_invitations','organization_id,invitee_user_id,invited_by_user_id,status,created_at,expires_at,responded_at,responded_by_user_id',"$1,$2,$3,'ACCEPTED',DATEADD(day,-1,SYSUTCDATETIME()),DATEADD(day,1,SYSUTCDATETIME()),SYSUTCDATETIME(),$2",[child,foreign,owner]);
  await insertId(client,'memberships','organization_id,user_id,invitation_id','$1,$2,$3',[child,foreign,invitation]);
  for(const permission of ['REGULATIONS_CREATE','REGULATIONS_MANAGE','REGULATIONS_PUBLISH','REGULATIONS_SHARE']){
   await insertId(client,'org_access_grants','organization_id,user_id,permission_code,granted_by_user_id',"$1,$2,$3,$2",[parent,owner,permission]);
  }
  const orgDoc=(await call('post','/regulations/documents',{}, {code:tag+'-org',name:'Organization rule',owner_organization_id:parent,is_internal:true})).data;
  const orgVersion=(await call('post','/regulations/documents/:id/versions',{id:orgDoc.id},{version_label:'v1',effective_from:'2020-01-01',source_title:'DEMO organization source'})).data;
  await call('post','/regulations/versions/:id/criteria',{id:orgVersion.id},{code:'COUNT',title:'Two activities',source_reference:'DEMO article',rule:{type:'count',target:2}});
  await call('post','/regulations/versions/:id/publish',{id:orgVersion.id});
  await insertId(client,'regulation_adoptions','regulation_id,regulation_version_id,organization_id,source_type,adopted_by_user_id',"$1,$2,$3,'OWNED',$4",[orgDoc.id,orgVersion.id,parent,owner]);
  const direct=(await call('post','/organizations/units/:id/ai-scan',{id:parent},{regulation_version_id:orgVersion.id,include_descendants:false})).data;assert.equal(direct.items.length,0);
  const scan=(await call('post','/organizations/units/:id/ai-scan',{id:parent},{regulation_version_id:orgVersion.id,include_descendants:true})).data;assert.equal(scan.items.length,1);assert.equal(scan.items[0].subject_user_id,foreign);
  const selected=(await call('post','/organizations/units/:id/ai-scan',{id:parent},{regulation_version_id:orgVersion.id,include_descendants:true,user_ids:[foreign]})).data;
  assert.equal(selected.items.length,1);
  await assert.rejects(call('post','/organizations/units/:id/ai-scan',{id:parent},{regulation_version_id:orgVersion.id,include_descendants:true,user_ids:[owner]}),e=>e.statusCode===403);
  const available=(await call('get','/organizations/units/:id/assessment-options',{id:parent})).data;
  assert.ok(available.some(version=>Number(version.id)===Number(orgVersion.id)));
  assert.equal(available.find(version=>Number(version.id)===Number(orgVersion.id)).publication_status,'PUBLISHED');
  await assert.rejects(call('post','/ai/evaluations/structured/:id/notify',{id:selected.items[0].id}),e=>e.statusCode===403);
  const notifyPath='/organizations/units/:id/assessment-notifications';
  const address={id:parent};
  await assert.rejects(call('post',notifyPath,address,{runIds:[selected.items[0].id]}),e=>e.statusCode===403);

  await insertId(client,'org_access_grants','organization_id,user_id,permission_code,include_descendants,granted_by_user_id',"$1,$2,'MEMBERS_NOTIFY',1,$2",[parent,owner]);
  await call('post','/ai/evaluations/structured/:id/notify',{id:selected.items[0].id});
  assert.equal((await client.query("SELECT id FROM app.notifications WHERE recipient_user_id=$1 AND notification_type='ASSESSMENT_RESULT'",[foreign])).rows.length,1);
  const otherDoc=(await call('post','/regulations/documents',{}, {code:tag+'-other',name:'Second organization rule',owner_organization_id:parent,is_internal:true})).data;
  const otherVersion=(await call('post','/regulations/documents/:id/versions',{id:otherDoc.id},{version_label:'v1',effective_from:'2020-01-01',source_title:'DEMO source'})).data;
  await call('post','/regulations/versions/:id/criteria',{id:otherVersion.id},{code:'COUNT',title:'One activity',source_reference:'DEMO article',rule:{type:'count',target:1}});
  await call('post','/regulations/versions/:id/publish',{id:otherVersion.id});
  await insertId(client,'regulation_adoptions','regulation_id,regulation_version_id,organization_id,source_type,adopted_by_user_id',"$1,$2,$3,'OWNED',$4",[otherDoc.id,otherVersion.id,parent,owner]);
  const second=(await call('post','/organizations/units/:id/ai-scan',address,{regulation_version_id:otherVersion.id,include_descendants:true,user_ids:[foreign]})).data;
  const runIds=[selected.items[0].id,second.items[0].id];
  await assert.rejects(call('post',notifyPath,address,{runIds:[scan.items[0].id,selected.items[0].id]}),e=>e.statusCode===400);
  const summary=(await call('post',notifyPath,address,{runIds,note:'Bổ sung hồ sơ',deadline:'2026-12-01'})).data;
  assert.equal(summary.alreadySent,false);
  const duplicate=(await call('post',notifyPath,address,{runIds:[...runIds].reverse()})).data;
  assert.equal(duplicate.id,summary.id);
  assert.equal(duplicate.alreadySent,true);
  const sent=(await client.query('SELECT body FROM app.notifications WHERE id=$1 AND recipient_user_id=$2',[summary.id,foreign])).rows[0];
  assert.match(sent.body,/Organization rule/);
  assert.match(sent.body,/Second organization rule/);
  assert.match(sent.body,/01\/12\/2026/);
  assert.match(sent.body,/Bổ sung hồ sơ/);
  const resendKey='1f81f609-6ddb-4096-a962-74cf541d5b7d';
  const resent=(await call('post',notifyPath,address,{runIds,resendKey})).data;
  assert.notEqual(resent.id,summary.id);
  assert.equal((await call('post',notifyPath,address,{runIds,resendKey})).data.id,resent.id);
  const event=await insertId(client,'calendar_events','owner_user_id,goal_id,title,starts_at,ends_at',"$1,$2,N'KPI reminder','2026-11-20T09:00:00','2026-11-20T10:00:00'",[owner,goal.id]);
  await assert.rejects(call('delete','/kpi/goals/:id',{id:goal.id},{},foreign),error=>error.statusCode===404);
  await call('delete','/kpi/goals/:id',{id:goal.id});
  await assert.rejects(call('get','/kpi/goals/:id',{id:goal.id}),error=>error.statusCode===404);
  const retained=(await client.query('SELECT goal_id,title FROM app.calendar_events WHERE id=$1',[event])).rows[0];
  assert.equal(retained.goal_id,null);
  assert.equal(retained.title,'KPI reminder');
  assert.equal((await client.query('SELECT id FROM app.kpi_progress WHERE goal_id=$1',[goal.id])).rows.length,1);
  assert.equal((await call('get','/ai/evaluations/structured/:id',{id:run.id})).data.id,run.id);


  await assert.rejects(call('post','/organizations/units/:id/ai-scan',{id:parent},{regulation_version_id:orgVersion.id,include_descendants:true},foreign),e=>e.statusCode===403);
  // Expire deterministically in this transaction without wall-clock sleeps.
  await client.query('UPDATE app.org_access_grants SET valid_from=DATEADD(day,-2,SYSUTCDATETIME()),valid_to=DATEADD(day,-1,SYSUTCDATETIME()) WHERE id=$1',[viewGrant]);
  await assert.rejects(call('get','/ai/evaluations/structured/:id',{id:scan.items[0].id}),e=>e.statusCode===403);
 } finally {setPool(pool);await client.query('ROLLBACK');await client.release();await closeDB();}
});
