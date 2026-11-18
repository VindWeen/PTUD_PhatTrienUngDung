import { Router } from 'express';
import { z } from 'zod';
import { authenticate, canAccessOrgDirectly } from './access.js';
import { authorizeRegulation, canReadVersion, listAccessiblePinnedContexts, isRetiredDemoRegulation } from './regulationAccess.js';
import { query, withTransaction, body, id, route, ok, one, insertId } from './shared.js';
import { ForbiddenError, ValidationError } from '../utils/errors.js';

const router=Router();router.use(authenticate);
const actor=req=>Number(req.user.userId),num=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
async function published(key,db){const v=await one('SELECT * FROM app.regulation_versions WHERE id=$1',[key],db);if(v.publication_status!=='PUBLISHED')throw new ValidationError('Chỉ tiếp nhận phiên bản đã công bố.');return v;}
export async function adoptVersion({userId,organizationId=null,versionId,sourceType,shareId=null,actorId},db,client){
 const v=await published(versionId,db);
 const old=(await db('SELECT * FROM app.regulation_adoptions WITH(UPDLOCK,HOLDLOCK) WHERE regulation_id=$1 AND ((user_id=$2 AND $3 IS NULL) OR organization_id=$3)',[v.regulation_id,userId,organizationId])).rows[0];
 if(old){await db('UPDATE app.regulation_adoptions SET regulation_version_id=$2,source_type=$3,share_id=$4,adopted_by_user_id=$5,updated_at=SYSUTCDATETIME() WHERE id=$1',[old.id,versionId,sourceType,shareId,actorId]);return old.id;}
 return insertId(client,'regulation_adoptions','regulation_id,regulation_version_id,user_id,organization_id,source_type,share_id,adopted_by_user_id','$1,$2,$3,$4,$5,$6,$7',[v.regulation_id,versionId,organizationId?null:userId,organizationId,sourceType,shareId,actorId]);
}
router.get('/regulations/library',route(async(req,res)=>{
 const items=(await listAccessiblePinnedContexts(actor(req))).filter(context=>!isRetiredDemoRegulation(context.code));
 for(const c of items){const latest=(await query("SELECT TOP(1) id,version_label FROM app.regulation_versions WHERE regulation_id=$1 AND publication_status='PUBLISHED' ORDER BY published_at DESC,id DESC",[c.regulation_id])).rows[0];c.update_available=latest&&Number(latest.id)!==Number(c.regulation_version_id);c.latest_version_id=latest?.id;c.latest_version_label=latest?.version_label;}
 ok(res,{items});
}));
router.patch('/regulations/documents/:id/distribution',route(async(req,res)=>{
 const b=body(z.object({is_public:z.boolean().optional(),is_internal:z.boolean().optional()}).strict(),req),key=id(req.params.id);
 await withTransaction(async({query:db})=>{await authorizeRegulation(actor(req),key,db,'REGULATIONS_SHARE');const r=await one('SELECT * FROM app.regulations WITH(UPDLOCK,HOLDLOCK) WHERE id=$1',[key],db);if(r.owner_type==='PERSONAL'&&b.is_internal)throw new ValidationError('Quy chế cá nhân không có phạm vi nội bộ.');await db('UPDATE app.regulations SET is_public=$2,is_internal=$3 WHERE id=$1',[key,b.is_public??r.is_public,b.is_internal??r.is_internal]);});ok(res,{id:key});
}));
router.post('/regulations/versions/:id/adopt',route(async(req,res)=>{
 const b=body(z.object({organization_id:num.optional()}).strict(),req),versionId=id(req.params.id);
 const key=await withTransaction(async({query:db,client})=>{
  const v=await published(versionId,db),r=await one('SELECT * FROM app.regulations WITH (UPDLOCK,HOLDLOCK) WHERE id=$1',[v.regulation_id],db);
  const old=(await db('SELECT id FROM app.regulation_adoptions WHERE regulation_id=$1 AND ((user_id=$2 AND $3 IS NULL) OR organization_id=$3)',[r.id,actor(req),b.organization_id??null])).rows[0];
  if(b.organization_id&&!await canAccessOrgDirectly(actor(req),b.organization_id,old?'REGULATIONS_UPDATE':'REGULATIONS_ADOPT',db))throw new ForbiddenError();
  let source='PUBLIC',shareId=null;
  if(r.owner_type==='PERSONAL'&&!b.organization_id&&Number(r.owner_user_id??r.created_by_user_id)===actor(req))source='OWNED';
  else if(b.organization_id&&Number(r.owner_organization_id)===b.organization_id){await authorizeRegulation(actor(req),r.id,db,'REGULATIONS_ADOPT');source='OWNED';}
  else if(!r.is_public){const share=(await db("SELECT TOP(1) id FROM app.regulation_shares WHERE regulation_version_id=$1 AND ((recipient_organization_id=$2 AND $2 IS NOT NULL) OR (recipient_user_id=$3 AND $2 IS NULL)) AND status='ACCEPTED'",[versionId,b.organization_id??null,actor(req)])).rows[0];if(!share)throw new ForbiddenError();source='SHARE';shareId=share.id;}
  if(!b.organization_id)await db('DELETE app.regulation_personal_exclusions WHERE user_id=$1 AND regulation_version_id=$2',[actor(req),versionId]);
  return adoptVersion({userId:actor(req),organizationId:b.organization_id,versionId,sourceType:source,shareId,actorId:actor(req)},db,client);
 });ok(res,await one('SELECT * FROM app.regulation_adoptions WHERE id=$1',[key]),201);
}));
router.delete('/regulations/versions/:id/adopt',route(async(req,res)=>{
 const versionId=id(req.params.id), userId=actor(req);
 await withTransaction(async({query:db})=>{
  if(!await canReadVersion(userId,versionId,db))throw new ForbiddenError();
  const v=await published(versionId,db);
  const document=await one('SELECT owner_type,owner_user_id,created_by_user_id FROM app.regulations WITH (UPDLOCK,HOLDLOCK) WHERE id=$1',[v.regulation_id],db);
  await db('DELETE app.regulation_adoptions WHERE user_id=$1 AND organization_id IS NULL AND regulation_version_id=$2',[userId,versionId]);
  if(document.owner_type==='PERSONAL'&&Number(document.owner_user_id??document.created_by_user_id)===userId){
   await db('INSERT app.regulation_personal_exclusions(user_id,regulation_version_id) SELECT $1,$2 WHERE NOT EXISTS (SELECT 1 FROM app.regulation_personal_exclusions WITH (UPDLOCK,HOLDLOCK) WHERE user_id=$1 AND regulation_version_id=$2)',[userId,versionId]);
  }
 });
 ok(res,{id:versionId});
}));
async function mayRespond(user,share,db=query){
 if(share.recipient_user_id!=null)return Number(share.recipient_user_id)===user;
 return canAccessOrgDirectly(user,share.recipient_organization_id,'REGULATIONS_ADOPT',db);
}
router.post('/regulations/versions/:id/shares',route(async(req,res)=>{
 const b=body(z.object({recipient_organization_id:num.optional(),recipient_email:z.string().trim().email().max(254).optional()})
  .strict().refine(b=>Boolean(b.recipient_organization_id)!==Boolean(b.recipient_email),'Chọn đúng một bên nhận.'),req);
 const versionId=id(req.params.id),sender=actor(req);
 const key=await withTransaction(async({query:db,client})=>{
  const v=await published(versionId,db);
  await authorizeRegulation(sender,v.regulation_id,db,'REGULATIONS_SHARE');
  const r=await one('SELECT * FROM app.regulations WITH(UPDLOCK,HOLDLOCK) WHERE id=$1',[v.regulation_id],db);
  const org=b.recipient_organization_id??null;
  if(org){
   await one("SELECT id FROM app.organizations WHERE id=$1 AND status='ACTIVE'",[org],db);
   if(Number(r.owner_organization_id)===org)throw new ValidationError('Chọn tổ chức khác tổ chức sở hữu.');
   if(r.owner_type==='PERSONAL'&&!(await db(`WITH ancestors AS (
      SELECT o.id,o.parent_id FROM app.memberships m JOIN app.organizations o ON o.id=m.organization_id AND o.status='ACTIVE'
      WHERE m.user_id=$1 AND m.valid_from<=SYSUTCDATETIME() AND (m.valid_to IS NULL OR m.valid_to>SYSUTCDATETIME())
      UNION ALL SELECT o.id,o.parent_id FROM app.organizations o JOIN ancestors a ON a.parent_id=o.id WHERE o.status='ACTIVE'
    ) SELECT TOP(1) id FROM ancestors WHERE id=$2 OPTION(MAXRECURSION 32767)`,[sender,org])).rows.length)
     throw new ForbiddenError();
  }
  const user=b.recipient_email?(await one("SELECT id FROM app.users WHERE normalized_email=LOWER($1) AND account_status='ACTIVE'",[b.recipient_email],db)).id:null;
  if(user!=null&&Number(user)===sender)throw new ValidationError('Chọn người nhận khác bản thân.');
  if((await db(`SELECT id FROM app.regulation_shares WHERE regulation_id=$1 AND status='PENDING'
    AND (recipient_organization_id=$2 OR recipient_user_id=$3)`,[r.id,org,user])).rows.length)
    throw new ValidationError('Đã có lời chia sẻ đang chờ.');
  return insertId(client,'regulation_shares','regulation_id,regulation_version_id,recipient_organization_id,recipient_user_id,shared_by_user_id','$1,$2,$3,$4,$5',[r.id,versionId,org,user,sender]);
 });
 ok(res,await one('SELECT * FROM app.regulation_shares WHERE id=$1',[key]),201);
}));
router.get('/regulations/shares',route(async(req,res)=>{
 const user=actor(req),items=[];
 const rows=(await query(`SELECT s.*,r.name,v.version_label,COALESCE(o.name,u.email) AS recipient_name
  FROM app.regulation_shares s JOIN app.regulations r ON r.id=s.regulation_id
  JOIN app.regulation_versions v ON v.id=s.regulation_version_id
  LEFT JOIN app.organizations o ON o.id=s.recipient_organization_id LEFT JOIN app.users u ON u.id=s.recipient_user_id
  WHERE s.recipient_user_id=$1 OR s.shared_by_user_id=$1 OR s.recipient_organization_id IS NOT NULL ORDER BY s.id DESC`,[user])).rows;
 for(const share of rows){
  const canRespond=await mayRespond(user,share);
  if(canRespond||Number(share.shared_by_user_id)===user)items.push({...share,can_respond:canRespond,can_revoke:Number(share.shared_by_user_id)===user});
 }
 ok(res,{items});
}));
router.post('/regulations/shares/:id/respond',route(async(req,res)=>{
 const key=id(req.params.id),{accept}=body(z.object({accept:z.boolean()}).strict(),req),user=actor(req);
 await withTransaction(async({query:db,client})=>{
  const s=await one('SELECT * FROM app.regulation_shares WITH(UPDLOCK,HOLDLOCK) WHERE id=$1',[key],db);
  if(!await mayRespond(user,s,db))throw new ForbiddenError();
  if(s.status!=='PENDING')throw new ValidationError('Lời chia sẻ đã được xử lý.');
  if(accept&&s.recipient_organization_id!=null){
   await one("SELECT id FROM app.organizations WHERE id=$1 AND status='ACTIVE'",[s.recipient_organization_id],db);
   const old=(await db('SELECT id FROM app.regulation_adoptions WHERE regulation_id=$1 AND organization_id=$2',[s.regulation_id,s.recipient_organization_id])).rows[0];
   if(old&&!await canAccessOrgDirectly(user,s.recipient_organization_id,'REGULATIONS_UPDATE',db))throw new ForbiddenError();
  }
  await db('UPDATE app.regulation_shares SET status=$2,responded_at=SYSUTCDATETIME(),responded_by_user_id=$3 WHERE id=$1',[key,accept?'ACCEPTED':'REJECTED',user]);
  if(accept)await adoptVersion({userId:s.recipient_user_id,organizationId:s.recipient_organization_id,versionId:s.regulation_version_id,sourceType:'SHARE',shareId:key,actorId:user},db,client);
 });
 ok(res,await one('SELECT * FROM app.regulation_shares WHERE id=$1',[key]));
}));
router.post('/regulations/shares/:id/revoke',route(async(req,res)=>{
 const key=id(req.params.id);await withTransaction(async({query:db})=>{const s=await one('SELECT * FROM app.regulation_shares WITH(UPDLOCK,HOLDLOCK) WHERE id=$1',[key],db);await authorizeRegulation(actor(req),s.regulation_id,db,'REGULATIONS_SHARE');if(s.status==='REVOKED')return;await db("UPDATE app.regulation_shares SET status='REVOKED',revoked_at=SYSUTCDATETIME() WHERE id=$1",[key]);});ok(res,{id:key});
}));
export default router;
