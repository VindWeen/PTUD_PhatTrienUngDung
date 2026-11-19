import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool, getDbPoolConfig } from '../config/database.js';
import { insertId } from './shared.js';
import { canReadVersion, canUseVersion, canManageRegulation, listAccessiblePinnedContexts } from './regulationAccess.js';

test('SQL Server distribution isolates private rules and preserves separate explicit organization pins',async()=>{
 const pool=new Pool(getDbPoolConfig()),c=await pool.connect(),db=c.query.bind(c);
 await db('BEGIN');
 try {
  const tag=randomUUID();
  const user=async label=>insertId(c,'users','email','$1',[`${tag}-${label}@example.test`]);
  const owner=await user('owner'),alice=await user('alice'),bob=await user('bob'),admin=await user('admin');
  await insertId(c,'global_role_grants','user_id,role_code',"$1,'SYSTEM_ADMIN'",[admin]);
  const org=async(label,parent=null)=>insertId(c,'organizations','code,name,organization_type,created_by_user_id,parent_id',"$1,$1,'TEAM',$2,$3",[`${tag}-${label}`,owner,parent]);
  const school=await org('school'),faculty=await org('faculty',school),other=await org('other');
  const join=async(who,where)=>{
   const invite=await insertId(c,'membership_invitations','organization_id,invitee_user_id,invited_by_user_id,status,created_at,expires_at,responded_at,responded_by_user_id',"$1,$2,$3,'ACCEPTED','2020-01-01','2099-01-01','2026-01-01',$2",[where,who,owner]);
   return insertId(c,'memberships','organization_id,user_id,invitation_id,valid_from',"$1,$2,$3,'2026-01-01'",[where,who,invite]);
  };
  const aliceMembership=await join(alice,faculty);await join(bob,other);
  const personal=await insertId(c,'regulations','code,name,created_by_user_id',"$1,'Private',$2",[`${tag}-private`,owner]);
  const version=async(reg,label)=>{
   const v=await insertId(c,'regulation_versions','regulation_id,version_label,effective_from,source_title,applicability_json,created_by_user_id',"$1,$2,'2020-01-01','Test source','{}',$3",[reg,label,owner]);
   await insertId(c,'criteria','regulation_version_id,code,title,rule_json,source_reference',"$1,'COUNT','One activity','{\"type\":\"count\",\"target\":1}','Article 1'",[v]);
   await db("UPDATE app.regulation_versions SET publication_status='PUBLISHED',published_at=SYSUTCDATETIME(),published_by_user_id=$1 WHERE id=$2",[owner,v]);
   return v;
  };
  const privateVersion=await version(personal,'v1');
  assert.equal(await canReadVersion(owner,privateVersion,db),true);
  assert.equal(await canUseVersion(owner,privateVersion,db),true);
  assert.equal(await canReadVersion(alice,privateVersion,db),false);
  assert.equal(await canReadVersion(admin,privateVersion,db),false);
  assert.equal(await canManageRegulation(admin,personal,db),false);
  const rule=await insertId(c,'regulations','code,name,created_by_user_id,owner_type,owner_organization_id,is_internal,is_public',"$1,'Organization rule',$2,'ORGANIZATION',$3,1,1",[`${tag}-org`,owner,school]);
  const v1=await version(rule,'v1'),v2=await version(rule,'v2');
  assert.equal(await canReadVersion(bob,v1,db),true,'public discovery allows viewing');
  assert.equal(await canUseVersion(bob,v1,db),false,'public discovery does not imply adoption');
  assert.equal(await canManageRegulation(alice,rule,db),false,'membership does not grant editing');
  const adopt=async(v,where,who=null,source='PUBLIC',share=null)=>insertId(c,'regulation_adoptions','regulation_id,regulation_version_id,organization_id,user_id,source_type,share_id,adopted_by_user_id','$1,$2,$3,$4,$5,$6,$7',[rule,v,where,who,source,share,owner]);
  await adopt(v1,school,null,'OWNED');
  assert.equal(await canUseVersion(alice,v1,db),true);
  assert.equal(await canUseVersion(alice,v2,db),false,'published v2 does not replace issuer pin');
  assert.equal(await canUseVersion(alice,v1,db,school),true,'subject member needs no management grant');
  assert.equal(await canUseVersion(bob,v1,db,school),false);
  await adopt(v2,null,bob);
  await db('UPDATE app.regulations SET is_public=0 WHERE id=$1',[rule]);
  assert.equal(await canUseVersion(bob,v2,db),true,'public-off retains already adopted version');
  const share=await insertId(c,'regulation_shares','regulation_id,regulation_version_id,recipient_organization_id,shared_by_user_id','$1,$2,$3,$4',[rule,v1,other,owner]);
  assert.equal(await canUseVersion(bob,v1,db),false,'pending share does not reach members');
  await db("UPDATE app.regulation_shares SET status='ACCEPTED',responded_at=SYSUTCDATETIME(),responded_by_user_id=$1 WHERE id=$2",[bob,share]);
  await adopt(v1,other,null,'SHARE',share);
  await db("UPDATE app.regulation_shares SET status='REVOKED',revoked_at=SYSUTCDATETIME() WHERE id=$1",[share]);
  assert.equal(await canUseVersion(bob,v1,db),true,'accepted pin survives share withdrawal');
  const contexts=await listAccessiblePinnedContexts(bob,db);
  assert.ok(contexts.some(x=>x.context_type==='PERSONAL'&&Number(x.regulation_version_id)===v2));
  assert.ok(contexts.some(x=>x.context_type==='ORGANIZATION'&&Number(x.regulation_version_id)===v1));
  await db("UPDATE app.memberships SET valid_to=DATEADD(day,-1,SYSUTCDATETIME()) WHERE id=$1",[aliceMembership]);
  assert.equal(await canUseVersion(alice,v1,db),false,'former membership stops inheritance');
  assert.equal(await canReadVersion(alice,v1,db),false,'private source is no longer readable after membership ends');
 } finally {await db('ROLLBACK');await c.release();await pool.end();}
});

test('SQL Server prevents draft adoption',async()=>{
 const pool=new Pool(getDbPoolConfig()),c=await pool.connect(),db=c.query.bind(c);
 await db('BEGIN');
 try {
  const owner=await insertId(c,'users','email','$1',[`${randomUUID()}@example.test`]);
  const reg=await insertId(c,'regulations','code,name,created_by_user_id',"$1,'Private',$2",[randomUUID(),owner]);
  const draft=await insertId(c,'regulation_versions','regulation_id,version_label,effective_from,source_title,applicability_json,created_by_user_id',"$1,'draft','2020-01-01','Source','{}',$2",[reg,owner]);
  await assert.rejects(insertId(c,'regulation_adoptions','regulation_id,regulation_version_id,user_id,source_type,adopted_by_user_id',"$1,$2,$3,'OWNED',$3",[reg,draft,owner]),/published/i);
 } finally {try {await db('ROLLBACK');} catch {} await c.release();await pool.end();}
});

for (const scenario of ['ownership','published source','published metadata','response timestamp']) test(`SQL Server enforces ${scenario} integrity`,async()=>{
 const pool=new Pool(getDbPoolConfig()),c=await pool.connect(),db=c.query.bind(c);
 await db('BEGIN');
 try {
  const owner=await insertId(c,'users','email','$1',[`${randomUUID()}@example.test`]);
  const other=await insertId(c,'users','email','$1',[`${randomUUID()}@example.test`]);
  const org=await insertId(c,'organizations','code,name,organization_type,created_by_user_id',"$1,'Demo','TEAM',$2",[randomUUID(),owner]);
  const reg=await insertId(c,'regulations','code,name,created_by_user_id,owner_type,owner_organization_id',"$1,'Rule',$2,'ORGANIZATION',$3",[randomUUID(),owner,org]);
  const v=await insertId(c,'regulation_versions','regulation_id,version_label,effective_from,source_title,applicability_json,created_by_user_id',"$1,'v1','2020-01-01','Source','{}',$2",[reg,owner]);
  const file=await insertId(c,'regulation_source_files','regulation_version_id,owner_user_id,storage_key,original_filename,mime_type,byte_size,sha256',"$1,$2,$3,'demo.pdf','application/pdf',100,$4",[v,owner,`${randomUUID()}.pdf`,Buffer.alloc(32)]);
  await insertId(c,'criteria','regulation_version_id,code,title,rule_json,source_reference',"$1,'C1','Test','{}','Article 1'",[v]);
  await db("UPDATE app.regulation_versions SET publication_status='PUBLISHED',published_at=SYSUTCDATETIME(),published_by_user_id=$1 WHERE id=$2",[owner,v]);
  if(scenario==='ownership') await assert.rejects(db('UPDATE app.regulations SET owner_organization_id=NULL,owner_type=\'PERSONAL\',owner_user_id=$1 WHERE id=$2',[other,reg]),/ownership.*immutable/i);
  if(scenario==='published source') await assert.rejects(db('UPDATE app.regulation_source_files SET sha256=$1 WHERE id=$2',[Buffer.alloc(32,1),file]),/immutable/i);
  if(scenario==='published metadata') await assert.rejects(db("UPDATE app.regulation_versions SET coverage_json='{\"tampered\":true}' WHERE id=$1",[v]),/immutable/i);
  if(scenario==='response timestamp') await assert.rejects(insertId(c,'regulation_shares','regulation_id,regulation_version_id,recipient_organization_id,status,shared_by_user_id,responded_by_user_id',"$1,$2,$3,'ACCEPTED',$4,$4",[reg,v,await insertId(c,'organizations','code,name,organization_type,created_by_user_id',"$1,'Recipient','TEAM',$2",[randomUUID(),owner]),owner]),/CHECK constraint/i);
 } finally {try {await db('ROLLBACK');} catch {} await c.release();await pool.end();}
});
