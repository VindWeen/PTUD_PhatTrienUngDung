import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { authenticate, authorizeOrg, hasGlobalRole } from './access.js';
import { query, withTransaction, route, ok, id, body, parseJson, insertId, one, pageParams } from './shared.js';
import { upload, validateFile, writeFile, discardFile, filePath } from './files.js';
import { extractCertificateInfo } from './vision.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

const router = Router();
const nullableText = max => z.string().trim().max(max).nullable().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value);
const achSchema = z.object({ title: z.string().trim().min(1).max(300), description: nullableText(20000), achievedAt: day, achievementTypeId: z.number().int().positive().nullable().optional(), issuer: nullableText(300), levelCode: nullableText(80), attributes: z.record(z.unknown()).optional() }).strict();
function achView(row) {
  return { id: row.id, achievementId: row.id, title: row.title, description: row.description || '', achievedAt: row.achieved_at, achievementDate: row.achieved_at, recognitionYear: Number(String(row.achieved_at).slice(0,4)), achievementTypeId: row.achievement_type_id, typeName: row.type_name || '', issuer: row.issuer || '', levelCode: row.level_code || '', attributes: parseJson(row.attributes_json), deletedAt: row.deleted_at, createdAt: row.created_at, updatedAt: row.updated_at, evidenceCount: row.evidence_count || 0 };
}
const achProjection = `SELECT a.*,t.name AS type_name,(SELECT COUNT(*) FROM app.evidence_files f WHERE f.achievement_id=a.id AND f.deleted_at IS NULL) AS evidence_count FROM app.achievements a LEFT JOIN app.achievement_types t ON t.id=a.achievement_type_id`;
async function ownAchievement(userId, achievementId, includeDeleted = false, read = query) {
  return one(`${achProjection} WHERE a.id=$1 AND a.owner_user_id=$2 ${includeDeleted ? '' : 'AND a.deleted_at IS NULL'}`, [achievementId, userId], read);
}
const fileView = row => ({ id: row.id, evidenceFileId: row.id, evidenceId: row.id, achievementId: row.achievement_id, originalFileName: row.original_filename, mimeType: row.mime_type, fileSize: row.byte_size, createdAt: row.created_at });
async function audit(read, actor, action, type, target) { await read('INSERT app.audit_events(actor_user_id,action_code,entity_type,entity_id) VALUES($1,$2,$3,$4)', [actor, action, type, String(target)]); }

const templates = [
  { id: 'Modern', code: 'Modern', name: 'Hiện đại' },
  { id: 'Academic', code: 'Academic', name: 'Học thuật' },
  { id: 'Minimalist', code: 'Minimalist', name: 'Tối giản' },
];
const reservedSlugs = new Set(['admin','api','auth','system','login','settings','help','root','me','public','export-docx','download','cv','profile','default']);
const cvSchema = z.object({
  slug: z.string().trim().toLowerCase().max(100).nullable().optional(), 
  templateId: z.string().trim().transform(val => ['Modern','Academic','Minimalist'].includes(val) ? val : 'Modern').default('Modern'),
  isPublic: z.boolean().default(false), headline: z.string().trim().max(300).default(''), bio: z.string().max(20000).default(''),
  selectedAchievementIds: z.array(z.number().int().positive()).max(300).default([]), showEmail: z.boolean().default(false), showPhone: z.boolean().default(false),
}).strict();
async function cvData(owner, cvId = null, isPublic = false) {
  const stored = (await query(`SELECT TOP(1) c.*,t.code AS template_code FROM app.cvs c LEFT JOIN app.cv_templates t ON t.id=c.template_id WHERE c.owner_user_id=$1 ${cvId ? 'AND c.id=$2' : ''} ORDER BY c.id`, cvId ? [owner, cvId] : [owner])).rows[0];
  const contact = await one('SELECT u.email,p.full_name,p.phone,p.headline FROM app.users u LEFT JOIN app.person_profiles p ON p.user_id=u.id WHERE u.id=$1 AND u.account_status=\'ACTIVE\'', [owner]);
  const selected = stored ? (await query(`SELECT a.*,t.name AS type_name FROM app.cv_achievements ca JOIN app.achievements a ON a.id=ca.achievement_id AND a.owner_user_id=ca.owner_user_id LEFT JOIN app.achievement_types t ON t.id=a.achievement_type_id WHERE ca.cv_id=$1 AND a.deleted_at IS NULL ORDER BY ca.sort_order,a.id`, [stored.id])).rows : [];
  const settings = parseJson(stored?.public_contact_settings_json, { email: false, phone: false });
  const content = parseJson(stored?.content_json);
  return { profileId: stored?.id || null, id: stored?.id || null, slug: stored?.public_slug || null, isPublic: stored?.publication_status === 'PUBLIC', templateId: stored?.template_code || 'Modern', headline: content.headline || '', bio: stored?.introduction || '', showEmail: settings.email === true, showPhone: settings.phone === true,
    contact: { fullName: contact.full_name || '', email: !isPublic || settings.email === true ? contact.email : '', phone: !isPublic || settings.phone === true ? contact.phone || '' : '' },
    selectedAchievementIds: selected.map(a => a.id), achievements: isPublic ? selected.map(a => ({ id:a.id, achievementId:a.id,title:a.title,recognitionYear:Number(String(a.achieved_at).slice(0,4)),achievementDate:a.achieved_at,type:a.type_name || '',issuer:a.issuer || '' })) : (await query(`${achProjection} WHERE a.owner_user_id=$1 AND a.deleted_at IS NULL ORDER BY a.achieved_at DESC,a.id DESC`, [owner])).rows.map(achView),
  };
}
router.get('/public/cv/:slug', route(async(req,res)=>{
  const row = (await query("SELECT c.id,c.owner_user_id FROM app.cvs c JOIN app.users u ON u.id=c.owner_user_id WHERE c.public_slug=$1 AND c.publication_status='PUBLIC' AND u.account_status='ACTIVE'", [req.params.slug])).rows[0];
  if (!row) throw new NotFoundError('CV không tồn tại hoặc đã ngừng chia sẻ.');
  res.set('Cache-Control','no-store');
  return ok(res,await cvData(row.owner_user_id,row.id,true));
}));
router.use(authenticate);

router.post('/achievements/ai-extract', upload, route(async(req,res)=>{
  validateFile(req.file);
  const result=await extractCertificateInfo(req.file);
  return ok(res,result);
}));

router.get('/achievements/catalogs', route(async(req,res)=>ok(res,{ achievementTypes: (await query('SELECT id,code,name FROM app.achievement_types WHERE is_active=1 ORDER BY name')).rows })));
router.post('/achievements/catalogs', route(async(req,res)=>{
  if (!await hasGlobalRole(req.user.userId,'SYSTEM_ADMIN')) throw new ForbiddenError();
  const data=body(z.object({code:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(200)}).strict(),req);
  const key=await insertId(null,'achievement_types','code,name','$1,$2',[data.code,data.name]); return ok(res,{id:key,...data},201);
}));
router.get('/achievements', route(async(req,res)=>{
  const {page,pageSize,offset}=pageParams(req), trash=req.query.trash==='true'||req.query.deleted==='true';
  const search=String(req.query.search||'').slice(0,300);
  const where=`a.owner_user_id=$1 AND a.deleted_at IS ${trash?'NOT ':''}NULL AND ($2='' OR a.title LIKE '%'+$2+'%')`;
  const rows=(await query(`${achProjection} WHERE ${where} ORDER BY a.achieved_at DESC,a.id DESC OFFSET $3 ROWS FETCH NEXT $4 ROWS ONLY`,[req.user.userId,search,offset,pageSize])).rows;
  const total=(await query(`SELECT COUNT(*) AS total FROM app.achievements a WHERE ${where}`,[req.user.userId,search])).rows[0].total;
  return ok(res,{items:rows.map(achView),total,page,pageSize});
}));
router.post('/achievements', route(async(req,res)=>{
  const d=body(achSchema,req);
  const key=await withTransaction(async({client,query:read})=>{
    if(d.achievementTypeId) await one('SELECT id FROM app.achievement_types WHERE id=$1 AND is_active=1',[d.achievementTypeId],read);
    const result=await insertId(client,'achievements','owner_user_id,title,description,achieved_at,achievement_type_id,issuer,level_code,attributes_json','$1,$2,$3,$4,$5,$6,$7,$8',[req.user.userId,d.title,d.description||null,d.achievedAt,d.achievementTypeId||null,d.issuer||null,d.levelCode||null,JSON.stringify(d.attributes||{})]);
    await audit(read,req.user.userId,'ACHIEVEMENT_CREATE','achievement',result);return result;
  });
  return ok(res,achView(await ownAchievement(req.user.userId,key)),201);
}));
router.get('/achievements/:id', route(async(req,res)=>{
  const key=id(req.params.id), item=achView(await ownAchievement(req.user.userId,key,true));
  item.evidences=(await query('SELECT * FROM app.evidence_files WHERE achievement_id=$1 AND owner_user_id=$2 AND deleted_at IS NULL ORDER BY id',[key,req.user.userId])).rows.map(fileView);return ok(res,item);
}));
router.patch('/achievements/:id', route(async(req,res)=>{
  const key=id(req.params.id), d=body(achSchema.partial().refine(value=>Object.keys(value).length>0),req);
  await withTransaction(async({query:read})=>{
    const current=await ownAchievement(req.user.userId,key,false,read), merged={...achView(current),...d};
    if(merged.achievementTypeId) await one('SELECT id FROM app.achievement_types WHERE id=$1 AND is_active=1',[merged.achievementTypeId],read);
    await read('UPDATE app.achievements SET title=$3,description=$4,achieved_at=$5,achievement_type_id=$6,issuer=$7,level_code=$8,attributes_json=$9,updated_at=SYSUTCDATETIME() WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL',[key,req.user.userId,merged.title,merged.description,merged.achievedAt,merged.achievementTypeId||null,merged.issuer,merged.levelCode,JSON.stringify(merged.attributes)]);
    await audit(read,req.user.userId,'ACHIEVEMENT_UPDATE','achievement',key);
  });return ok(res,achView(await ownAchievement(req.user.userId,key)));
}));
router.delete('/achievements/:id', route(async(req,res)=>{
  const key=id(req.params.id);await ownAchievement(req.user.userId,key);
  await query('UPDATE app.achievements SET deleted_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME() WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL',[key,req.user.userId]);return ok(res,{id:key});
}));
router.post('/achievements/:id/restore', route(async(req,res)=>{
  const key=id(req.params.id);await ownAchievement(req.user.userId,key,true);
  await query('UPDATE app.achievements SET deleted_at=NULL,updated_at=SYSUTCDATETIME() WHERE id=$1 AND owner_user_id=$2',[key,req.user.userId]);return ok(res,achView(await ownAchievement(req.user.userId,key)));
}));
router.get('/achievements/:id/evidences', route(async(req,res)=>{
  const key=id(req.params.id);await ownAchievement(req.user.userId,key);
  return ok(res,(await query('SELECT * FROM app.evidence_files WHERE achievement_id=$1 AND owner_user_id=$2 AND deleted_at IS NULL ORDER BY id',[key,req.user.userId])).rows.map(fileView));
}));
router.post('/achievements/:id/evidences', upload, route(async(req,res)=>{
  const key=id(req.params.id);await ownAchievement(req.user.userId,key);
  const file=await writeFile(req.file);
  try {
    const fileId=await withTransaction(async({client,query:read})=>{
      await ownAchievement(req.user.userId,key,false,read);
      const created=await insertId(client,'evidence_files','achievement_id,owner_user_id,storage_key,original_filename,mime_type,byte_size,sha256','$1,$2,$3,$4,$5,$6,$7',[key,req.user.userId,file.key,file.name,file.mime,file.size,file.hash]);
      await read('UPDATE app.achievements SET updated_at=SYSUTCDATETIME() WHERE id=$1',[key]);return created;
    });return ok(res,fileView(await one('SELECT * FROM app.evidence_files WHERE id=$1',[fileId])),201);
  } catch(error) {await discardFile(file.key);throw error;}
}));
router.delete('/evidences/:id', route(async(req,res)=>{
  const key=id(req.params.id);await one('SELECT id FROM app.evidence_files WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL',[key,req.user.userId]);
  await query('UPDATE app.evidence_files SET deleted_at=SYSUTCDATETIME() WHERE id=$1 AND owner_user_id=$2',[key,req.user.userId]);return ok(res,{id:key});
}));
router.get('/evidence-files/:id/download', route(async(req,res)=>{
  const key=id(req.params.id), f=await one('SELECT f.* FROM app.evidence_files f JOIN app.achievements a ON a.id=f.achievement_id WHERE f.id=$1 AND f.deleted_at IS NULL AND a.deleted_at IS NULL',[key]);
  let allowed=Number(f.owner_user_id)===req.user.userId;
  if(!allowed){
    const shares=(await query('SELECT * FROM app.evidence_shares WHERE evidence_file_id=$1 AND revoked_at IS NULL AND valid_from<=SYSUTCDATETIME() AND (valid_to IS NULL OR valid_to>SYSUTCDATETIME())',[key])).rows;
    for(const share of shares){
      if(Number(share.recipient_user_id)===req.user.userId){allowed=true;break;}
      if(share.recipient_organization_id){
        try{await authorizeOrg(req.user.userId,share.recipient_organization_id,'ASSESSMENTS_VIEW');allowed=true;break;}catch(error){if(!(error instanceof ForbiddenError))throw error;}
        if(share.include_descendants){
          const descendants=(await query(`WITH tree AS (SELECT id FROM app.organizations WHERE id=$1 UNION ALL SELECT o.id FROM app.organizations o JOIN tree t ON o.parent_id=t.id) SELECT DISTINCT g.id FROM app.org_access_grants g JOIN tree t ON t.id=g.organization_id WHERE g.user_id=$2 AND g.permission_code='ASSESSMENTS_VIEW' AND g.valid_from<=SYSUTCDATETIME() AND (g.valid_to IS NULL OR g.valid_to>SYSUTCDATETIME()) OPTION(MAXRECURSION 32767)`,[share.recipient_organization_id,req.user.userId])).rows;if(descendants.length){allowed=true;break;}
        }
      }
    }
  }
  if(!allowed)throw new ForbiddenError('Minh chứng chưa được chia sẻ với bạn.');
  const target=filePath(f.storage_key);try{await fs.access(target);}catch{throw new NotFoundError('Tệp không còn trên kho lưu trữ.');}
  res.set('Cache-Control','no-store');return res.type(f.mime_type).download(target,f.original_filename);
}));
router.post('/evidence-files/:id/shares', route(async(req,res)=>{
  const key=id(req.params.id);await one('SELECT id FROM app.evidence_files WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL',[key,req.user.userId]);
  const d=body(z.object({recipientUserId:z.number().int().positive().optional(),recipientOrganizationId:z.number().int().positive().optional(),includeDescendants:z.boolean().default(false),validTo:z.string().datetime().optional()}).strict().refine(v=>Boolean(v.recipientUserId)!==Boolean(v.recipientOrganizationId)).refine(v=>!v.recipientUserId||!v.includeDescendants),req);
  const created=await insertId(null,'evidence_shares','evidence_file_id,owner_user_id,recipient_user_id,recipient_organization_id,include_descendants,valid_to','$1,$2,$3,$4,$5,$6',[key,req.user.userId,d.recipientUserId||null,d.recipientOrganizationId||null,d.includeDescendants,d.validTo||null]);return ok(res,{id:created},201);
}));
router.delete('/evidence-shares/:id',route(async(req,res)=>{
  const key=id(req.params.id);await one('SELECT id FROM app.evidence_shares WHERE id=$1 AND owner_user_id=$2',[key,req.user.userId]);await query('UPDATE app.evidence_shares SET revoked_at=SYSUTCDATETIME() WHERE id=$1 AND owner_user_id=$2',[key,req.user.userId]);return ok(res,{id:key});
}));

router.get('/cv/templates',route(async(req,res)=>ok(res,templates)));
router.get('/me/cv',route(async(req,res)=>ok(res,await cvData(req.user.userId))));
router.put('/me/cv',route(async(req,res)=>{
  const d=body(cvSchema,req), selected=[...new Set(d.selectedAchievementIds)], slug=d.slug||null;
  if(slug&&(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length<3||reservedSlugs.has(slug)))throw new ValidationError('Đường dẫn CV không hợp lệ hoặc là từ khóa hệ thống.');
  await withTransaction(async({client,query:read})=>{
    let template=(await read('SELECT id FROM app.cv_templates WITH(UPDLOCK,HOLDLOCK) WHERE code=$1',[d.templateId])).rows[0];
    if(!template)template={id:await insertId(client,'cv_templates','code,name,renderer_key','$1,$2,$1',[d.templateId,templates.find(t=>t.id===d.templateId).name])};
    const existing=(await read('SELECT TOP(1) id,public_slug FROM app.cvs WITH(UPDLOCK,HOLDLOCK) WHERE owner_user_id=$1 ORDER BY id',[req.user.userId])).rows[0];
    for(const key of selected) await ownAchievement(req.user.userId,key,false,read);
    const settings=JSON.stringify({email:d.showEmail,phone:d.showPhone}), content=JSON.stringify({headline:d.headline});
    let cvId=existing?.id;
    if(existing)await read("UPDATE app.cvs SET public_slug=$2,template_id=$3,publication_status=$4,introduction=$5,content_json=$6,public_contact_settings_json=$7,published_at=CASE WHEN $4='PUBLIC' THEN SYSUTCDATETIME() ELSE NULL END,updated_at=SYSUTCDATETIME() WHERE id=$1",[cvId,slug||existing.public_slug,template.id,d.isPublic?'PUBLIC':'PRIVATE',d.bio,content,settings]);
    else cvId=await insertId(client,'cvs','owner_user_id,title,public_slug,template_id,publication_status,introduction,content_json,public_contact_settings_json,published_at',"$1,N'CV cá nhân',$2,$3,$4,$5,$6,$7,CASE WHEN $4='PUBLIC' THEN SYSUTCDATETIME() ELSE NULL END",[req.user.userId,slug||randomUUID(),template.id,d.isPublic?'PUBLIC':'PRIVATE',d.bio,content,settings]);
    await read('DELETE FROM app.cv_achievements WHERE cv_id=$1',[cvId]);
    for(let i=0;i<selected.length;i++)await read('INSERT app.cv_achievements(cv_id,achievement_id,owner_user_id,sort_order) VALUES($1,$2,$3,$4)',[cvId,selected[i],req.user.userId,i]);
    await audit(read,req.user.userId,'CV_SAVE','cv',cvId);
  });return ok(res,await cvData(req.user.userId));
}));

export default router;
