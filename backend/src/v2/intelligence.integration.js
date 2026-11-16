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
  await insertId(client,'global_role_grants','user_id,role_code',"$1,'REGULATION_MANAGER'",[owner]);
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
  await insertId(client,'org_access_grants','organization_id,user_id,permission_code,granted_by_user_id',"$1,$2,'REGULATIONS_CREATE',$2",[parent,owner]);
  const orgDoc=(await call('post','/regulations/documents',{}, {code:tag+'-org',name:'Organization rule',owner_organization_id:parent})).data;
  const orgVersion=(await call('post','/regulations/documents/:id/versions',{id:orgDoc.id},{version_label:'v1',effective_from:'2020-01-01',source_title:'DEMO organization source'})).data;
  await call('post','/regulations/versions/:id/criteria',{id:orgVersion.id},{code:'COUNT',title:'Two activities',source_reference:'DEMO article',rule:{type:'count',target:2}});
  await call('post','/regulations/versions/:id/publish',{id:orgVersion.id});
  await insertId(client,'regulation_adoptions','regulation_id,regulation_version_id,organization_id,source_type,adopted_by_user_id',"$1,$2,$3,'OWNED',$4",[orgDoc.id,orgVersion.id,parent,owner]);
  const direct=(await call('post','/organizations/units/:id/ai-scan',{id:parent},{regulation_version_id:orgVersion.id,include_descendants:false})).data;assert.equal(direct.items.length,0);
  const scan=(await call('post','/organizations/units/:id/ai-scan',{id:parent},{regulation_version_id:orgVersion.id,include_descendants:true})).data;assert.equal(scan.items.length,1);assert.equal(scan.items[0].subject_user_id,foreign);
  await assert.rejects(call('post','/organizations/units/:id/ai-scan',{id:parent},{regulation_version_id:orgVersion.id,include_descendants:true},foreign),e=>e.statusCode===403);
  // Expire deterministically in this transaction without wall-clock sleeps.
  await client.query('UPDATE app.org_access_grants SET valid_from=DATEADD(day,-2,SYSUTCDATETIME()),valid_to=DATEADD(day,-1,SYSUTCDATETIME()) WHERE id=$1',[viewGrant]);
  await assert.rejects(call('get','/ai/evaluations/structured/:id',{id:scan.items[0].id}),e=>e.statusCode===403);
 } finally {setPool(pool);await client.query('ROLLBACK');await client.release();await closeDB();}
});
