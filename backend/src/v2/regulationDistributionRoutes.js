import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizeOrg, canAccessOrg } from './access.js';
import { authorizeRegulation, canReadVersion, listAccessiblePinnedContexts } from './regulationAccess.js';
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
 const items=await listAccessiblePinnedContexts(actor(req));
 for(const c of items){const latest=(await query("SELECT TOP(1) id,version_label FROM app.regulation_versions WHERE regulation_id=$1 AND publication_status='PUBLISHED' ORDER BY published_at DESC,id DESC",[c.regulation_id])).rows[0];c.update_available=latest&&Number(latest.id)!==Number(c.regulation_version_id);c.latest_version_id=latest?.id;c.latest_version_label=latest?.version_label;}
 ok(res,{items});
}));
router.patch('/regulations/documents/:id/distribution',route(async(req,res)=>{
 const b=body(z.object({is_public:z.boolean().optional(),is_internal:z.boolean().optional()}).strict(),req),key=id(req.params.id);
 await withTransaction(async({query:db})=>{await authorizeRegulation(actor(req),key,db,'REGULATIONS_SHARE');const r=await one('SELECT * FROM app.regulations WITH(UPDLOCK,HOLDLOCK) WHERE id=$1',[key],db);if(r.owner_type!=='ORGANIZATION')throw new ValidationError('Chỉ tổ chức được phân phối quy chế.');await db('UPDATE app.regulations SET is_public=$2,is_internal=$3 WHERE id=$1',[key,b.is_public??r.is_public,b.is_internal??r.is_internal]);});ok(res,{id:key});
}));
router.post('/regulations/versions/:id/adopt',route(async(req,res)=>{
 const b=body(z.object({organization_id:num.optional()}).strict(),req),versionId=id(req.params.id);
 const key=await withTransaction(async({query:db,client})=>{
  const v=await published(versionId,db),r=await one('SELECT * FROM app.regulations WHERE id=$1',[v.regulation_id],db);
  const old=(await db('SELECT id FROM app.regulation_adoptions WHERE regulation_id=$1 AND ((user_id=$2 AND $3 IS NULL) OR organization_id=$3)',[r.id,actor(req),b.organization_id??null])).rows[0];
  if(b.organization_id)await authorizeOrg(actor(req),b.organization_id,old?'REGULATIONS_UPDATE':'REGULATIONS_ADOPT',db);
  let source='PUBLIC',shareId=null;
  if(r.owner_type==='PERSONAL'){if(Number(r.owner_user_id)!==actor(req)||b.organization_id)throw new ForbiddenError();source='OWNED';}
  else if(b.organization_id&&Number(r.owner_organization_id)===b.organization_id){await authorizeRegulation(actor(req),r.id,db,'REGULATIONS_ADOPT');source='OWNED';}
  else if(!r.is_public){const share=(await db("SELECT TOP(1) id FROM app.regulation_shares WHERE regulation_version_id=$1 AND recipient_organization_id=$2 AND status='ACCEPTED'",[versionId,b.organization_id??null])).rows[0];if(!share)throw new ForbiddenError();source='SHARE';shareId=share.id;}
  return adoptVersion({userId:actor(req),organizationId:b.organization_id,versionId,sourceType:source,shareId,actorId:actor(req)},db,client);
 });ok(res,await one('SELECT * FROM app.regulation_adoptions WHERE id=$1',[key]),201);
}));
router.post('/regulations/versions/:id/shares',route(async(req,res)=>{
 const b=body(z.object({recipient_organization_id:num}).strict(),req),versionId=id(req.params.id);
 const key=await withTransaction(async({query:db,client})=>{const v=await published(versionId,db);await authorizeRegulation(actor(req),v.regulation_id,db,'REGULATIONS_SHARE');const r=await one('SELECT * FROM app.regulations WHERE id=$1',[v.regulation_id],db);if(r.owner_type!=='ORGANIZATION'||Number(r.owner_organization_id)===b.recipient_organization_id)throw new ValidationError('Chọn tổ chức nhận khác tổ chức sở hữu.');await one("SELECT id FROM app.organizations WHERE id=$1 AND status='ACTIVE'",[b.recipient_organization_id],db);if((await db("SELECT id FROM app.regulation_shares WITH(UPDLOCK,HOLDLOCK) WHERE regulation_version_id=$1 AND recipient_organization_id=$2 AND status='PENDING'",[versionId,b.recipient_organization_id])).rows.length)throw new ValidationError('Đã có lời chia sẻ đang chờ.');return insertId(client,'regulation_shares','regulation_id,regulation_version_id,recipient_organization_id,shared_by_user_id','$1,$2,$3,$4',[v.regulation_id,versionId,b.recipient_organization_id,actor(req)]);});ok(res,await one('SELECT * FROM app.regulation_shares WHERE id=$1',[key]),201);
}));
router.get('/regulations/shares',route(async(req,res)=>{
 const items=[];for(const s of (await query('SELECT s.*,r.name,v.version_label,o.name AS recipient_name FROM app.regulation_shares s JOIN app.regulations r ON r.id=s.regulation_id JOIN app.regulation_versions v ON v.id=s.regulation_version_id JOIN app.organizations o ON o.id=s.recipient_organization_id ORDER BY s.id DESC')).rows){const canRespond=await canAccessOrg(actor(req),s.recipient_organization_id,'REGULATIONS_ADOPT');if(canRespond||await canAccessOrg(actor(req),s.recipient_organization_id,'REGULATIONS_UPDATE'))items.push({...s,can_respond:canRespond});else if(await canReadVersion(actor(req),s.regulation_version_id)&&Number(s.shared_by_user_id)===actor(req))items.push({...s,can_respond:false});}ok(res,{items});
}));
router.post('/regulations/shares/:id/respond',route(async(req,res)=>{
 const key=id(req.params.id),b=body(z.object({accept:z.boolean()}).strict(),req);
 await withTransaction(async({query:db,client})=>{const s=await one('SELECT * FROM app.regulation_shares WITH(UPDLOCK,HOLDLOCK) WHERE id=$1',[key],db);await authorizeOrg(actor(req),s.recipient_organization_id,'REGULATIONS_ADOPT',db);if(s.status!=='PENDING')throw new ValidationError('Lời chia sẻ đã được xử lý.');const old=(await db('SELECT id FROM app.regulation_adoptions WHERE regulation_id=$1 AND organization_id=$2',[s.regulation_id,s.recipient_organization_id])).rows[0];if(old&&b.accept)await authorizeOrg(actor(req),s.recipient_organization_id,'REGULATIONS_UPDATE',db);await db('UPDATE app.regulation_shares SET status=$2,responded_at=SYSUTCDATETIME(),responded_by_user_id=$3 WHERE id=$1',[key,b.accept?'ACCEPTED':'REJECTED',actor(req)]);if(b.accept)await adoptVersion({organizationId:s.recipient_organization_id,versionId:s.regulation_version_id,sourceType:'SHARE',shareId:key,actorId:actor(req)},db,client);});ok(res,await one('SELECT * FROM app.regulation_shares WHERE id=$1',[key]));
}));
router.post('/regulations/shares/:id/revoke',route(async(req,res)=>{
 const key=id(req.params.id);await withTransaction(async({query:db})=>{const s=await one('SELECT * FROM app.regulation_shares WITH(UPDLOCK,HOLDLOCK) WHERE id=$1',[key],db);await authorizeRegulation(actor(req),s.regulation_id,db,'REGULATIONS_SHARE');if(s.status==='REVOKED')return;await db("UPDATE app.regulation_shares SET status='REVOKED',revoked_at=SYSUTCDATETIME() WHERE id=$1",[key]);});ok(res,{id:key});
}));
export default router;
