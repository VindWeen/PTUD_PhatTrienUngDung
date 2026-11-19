import express from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { query, withTransaction } from '../utils/dbHelper.js';
import { hashPassword, comparePassword, generateAccessToken } from '../utils/crypto.js';
import config from '../config/env.js';
import { AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors.js';
import { authenticate, authorizeOrg, canAccessOrg, canAccessOrgDirectly, hasGlobalRole, permissions } from './access.js';

const router=express.Router();
const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const ok=(res,data,status=200)=>res.status(status).json({success:true,data});
const number=z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const text=max=>z.string().trim().min(1).max(max);
const password=z.string().min(8).max(72).refine(v=>Buffer.byteLength(v)<=72,'Mật khẩu tối đa 72 byte');
function input(schema,value) { const p=schema.safeParse(value); if(!p.success) throw new ValidationError('Dữ liệu không hợp lệ',p.error.flatten().fieldErrors); return p.data; }
const ident=v=>input(number,v);
const hash=v=>crypto.createHash('sha256').update(v).digest();
const cookieOptions=()=>({httpOnly:true,secure:config.COOKIE_SECURE??config.NODE_ENV==='production',sameSite:config.COOKIE_SAME_SITE||'lax',path:'/',...(config.COOKIE_DOMAIN?{domain:config.COOKIE_DOMAIN}:{})});
function clearCookie(res) { res.clearCookie('ptud_refresh_token',cookieOptions()); }
async function one(db,sql,params=[]) { const row=(await db(sql,params)).rows[0]; if(!row) throw new NotFoundError(); return row; }
async function audit(db,actor,org,action,entity,id,details={}) { await db(`INSERT INTO app.audit_events(actor_user_id,organization_id,action_code,entity_type,entity_id,details_json) VALUES($1,$2,$3,$4,$5,$6)`,[actor,org,action,entity,String(id),JSON.stringify(details)]); }
async function notify(db,to,from,org,type,title,body=null) { await db(`INSERT INTO app.notifications(recipient_user_id,sender_user_id,organization_id,notification_type,title,body) VALUES($1,$2,$3,$4,$5,$6)`,[to,from,org,type,title,body]); }
export async function getUserProfile(userId,db=query) {
  const u=await one(db,`SELECT u.id,u.email,u.account_status,p.full_name,p.person_type,p.birth_date,p.phone,p.headline,p.biography,p.avatar_storage_key,p.attributes_json FROM app.users u JOIN app.person_profiles p ON p.user_id=u.id WHERE u.id=$1`,[userId]);
  const roles=(await db(`SELECT DISTINCT role_code FROM app.global_role_grants WHERE user_id=$1 AND valid_from<=SYSUTCDATETIME() AND (valid_to IS NULL OR valid_to>SYSUTCDATETIME())`,[userId])).rows.map(x=>x.role_code);
  const memberships=(await db(`SELECT m.*,o.name AS organization_name,o.code AS organization_code FROM app.memberships m JOIN app.organizations o ON o.id=m.organization_id WHERE m.user_id=$1 AND m.valid_from<=SYSUTCDATETIME() AND (m.valid_to IS NULL OR m.valid_to>SYSUTCDATETIME())`,[userId])).rows;
  const orgGrants=(await db(`SELECT g.*,o.name AS organization_name FROM app.org_access_grants g JOIN app.organizations o ON o.id=g.organization_id WHERE g.user_id=$1 AND g.valid_from<=SYSUTCDATETIME() AND (g.valid_to IS NULL OR g.valid_to>SYSUTCDATETIME())`,[userId])).rows;
  return {...u,userId:u.id,fullName:u.full_name,personType:u.person_type,roles:['MEMBER',...roles],roleCodes:['MEMBER',...roles],memberships,orgGrants,attributes:JSON.parse(u.attributes_json||'{}')};
}
async function issue(db,userId,req,days=7) {
  const raw=crypto.randomBytes(48).toString('hex');
  const session=await one(db,`INSERT INTO app.auth_sessions(user_id,refresh_token_hash,expires_at,client_description) OUTPUT INSERTED.id VALUES($1,$2,DATEADD(day,$3,SYSUTCDATETIME()),$4)`,[userId,hash(raw),days,String(req.headers['user-agent']||'').slice(0,400)]);
  return {raw,days,accessToken:generateAccessToken({userId,sessionId:session.id}),tokenType:'Bearer',user:await getUserProfile(userId,db)};
}
function sessionResponse(res,data,status=200) { const {raw,days,...safe}=data; res.cookie('ptud_refresh_token',raw,{...cookieOptions(),maxAge:days*86400000}); return ok(res,safe,status); }
router.post('/auth/register',route(async(req,res)=>{
  const b=input(z.object({email:z.string().trim().email().max(254),password,fullName:text(200).optional(),full_name:text(200).optional(),personType:z.enum(['STUDENT','LECTURER','STAFF','OTHER']).default('OTHER')}).refine(b=>b.fullName||b.full_name),req.body);
  const ph=await hashPassword(b.password);
  const result=await withTransaction(async({query:db})=>{
    const u=await one(db,`INSERT INTO app.users(email,password_hash) OUTPUT INSERTED.id VALUES($1,$2)`,[b.email,ph]);
    await db(`INSERT INTO app.person_profiles(user_id,full_name,person_type) VALUES($1,$2,$3)`,[u.id,b.fullName||b.full_name,b.personType]);
    await audit(db,u.id,null,'ACCOUNT_REGISTERED','users',u.id);
    return issue(db,u.id,req);
  }); sessionResponse(res,result,201);
}));
router.post('/auth/login',route(async(req,res)=>{
  const b=input(z.object({email:z.string().optional(),username:z.string().optional(),password:z.string().min(1).max(1000),rememberMe:z.boolean().default(false)}).refine(x=>x.email||x.username),req.body);
  const u=(await query(`SELECT id,password_hash FROM app.users WHERE normalized_email=LOWER(LTRIM(RTRIM($1))) AND account_status='ACTIVE'`,[b.email||b.username])).rows[0];
  if(!u?.password_hash||!await comparePassword(b.password,u.password_hash)) throw new UnauthorizedError('Email hoặc mật khẩu không đúng');
  sessionResponse(res,await withTransaction(async({query:db})=>{
    const live=await one(db,`SELECT password_hash,account_status FROM app.users WITH(UPDLOCK,HOLDLOCK) WHERE id=$1`,[u.id]);
    if(live.password_hash!==u.password_hash||live.account_status!=='ACTIVE') throw new UnauthorizedError();
    return issue(db,u.id,req,b.rememberMe?30:7);
  }));
}));
router.post('/auth/refresh',route(async(req,res)=>{
  const raw=req.cookies?.ptud_refresh_token;
  if(typeof raw!=='string'||raw.length>200) throw new UnauthorizedError();
  const result=await withTransaction(async({query:db})=>{
    const s=(await db(`SELECT s.*,u.account_status FROM app.auth_sessions s WITH(UPDLOCK,HOLDLOCK) JOIN app.users u ON u.id=s.user_id WHERE s.refresh_token_hash=$1`,[hash(raw)])).rows[0];
    if(!s) return null;
    if(s.revoked_at) { await db(`UPDATE app.auth_sessions SET revoked_at=COALESCE(revoked_at,SYSUTCDATETIME()) WHERE user_id=$1`,[s.user_id]); return null; }
    if(s.account_status!=='ACTIVE'||new Date(s.expires_at)<=new Date()) return null;
    await db(`UPDATE app.auth_sessions SET revoked_at=SYSUTCDATETIME() WHERE id=$1`,[s.id]);
    return issue(db,s.user_id,req,Math.max(1,Math.ceil((new Date(s.expires_at)-new Date())/86400000)));
  });
  if(!result) { clearCookie(res); throw new UnauthorizedError(); } sessionResponse(res,result);
}));
router.post('/auth/logout',route(async(req,res)=>{
  const raw=req.cookies?.ptud_refresh_token;
  if(typeof raw==='string'&&raw.length<=200) await query(`UPDATE app.auth_sessions SET revoked_at=COALESCE(revoked_at,SYSUTCDATETIME()) WHERE refresh_token_hash=$1`,[hash(raw)]);
  clearCookie(res); ok(res,{loggedOut:true});
}));
router.post('/auth/forgot-password',route(async(req,res)=>{
  const b=input(z.object({email:z.string().trim().email().max(254)}),req.body);
  let base; try { base=new URL(config.APP_PUBLIC_URL); } catch { throw new AppError('Chưa cấu hình email khôi phục mật khẩu',503,'RESET_UNAVAILABLE'); }
  if(!config.RESET_EMAIL_API_KEY||!config.RESET_EMAIL_FROM||!['http:','https:'].includes(base.protocol)||(config.NODE_ENV==='production'&&base.protocol!=='https:')||base.username||base.password||base.search||base.hash) throw new AppError('Chưa cấu hình email khôi phục mật khẩu',503,'RESET_UNAVAILABLE');
  const u=(await query(`SELECT id,email FROM app.users WHERE normalized_email=LOWER($1) AND account_status='ACTIVE'`,[b.email])).rows[0];
  if(u) {
    const raw=crypto.randomBytes(48).toString('hex');
    await query(`INSERT INTO app.auth_tokens(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'RESET_PASSWORD',DATEADD(minute,30,SYSUTCDATETIME()))`,[u.id,hash(raw)]);
    const url=new URL('reset-password',base.href.endsWith('/')?base.href:`${base.href}/`); url.hash=new URLSearchParams({token:raw}).toString();
    try { const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.RESET_EMAIL_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:config.RESET_EMAIL_FROM,to:[u.email],subject:'Đặt lại mật khẩu',text:`Liên kết có hiệu lực 30 phút: ${url.href}`}),signal:AbortSignal.timeout(10000)}); if(!r.ok) throw new Error(); } catch { console.error('Không thể gửi email khôi phục mật khẩu'); }
  } ok(res,{message:'Nếu email tồn tại, hướng dẫn khôi phục sẽ được gửi.'});
}));
router.post('/auth/reset-password',route(async(req,res)=>{
  const b=input(z.object({token:text(200),password}),req.body),ph=await hashPassword(b.password);
  await withTransaction(async({query:db})=>{
    const t=(await db(`SELECT t.* FROM app.auth_tokens t WITH(UPDLOCK,HOLDLOCK) JOIN app.users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.purpose='RESET_PASSWORD' AND t.consumed_at IS NULL AND t.expires_at>SYSUTCDATETIME() AND u.account_status='ACTIVE'`,[hash(b.token)])).rows[0];
    if(!t) throw new ValidationError('Liên kết không hợp lệ hoặc hết hạn');
    await db(`UPDATE app.users SET password_hash=$1,updated_at=SYSUTCDATETIME() WHERE id=$2`,[ph,t.user_id]);
    await db(`UPDATE app.auth_tokens SET consumed_at=SYSUTCDATETIME() WHERE user_id=$1 AND purpose='RESET_PASSWORD' AND consumed_at IS NULL`,[t.user_id]);
    await db(`UPDATE app.auth_sessions SET revoked_at=COALESCE(revoked_at,SYSUTCDATETIME()) WHERE user_id=$1`,[t.user_id]);
    await audit(db,t.user_id,null,'PASSWORD_RESET','users',t.user_id);
  }); clearCookie(res); ok(res,{changed:true});
}));
router.use(['/auth/me','/auth/change-password','/me/profile','/me/invitations','/me/join-requests','/organizations','/invitations','/organization-link-requests','/admin'],authenticate);
router.get('/auth/me',route(async(req,res)=>ok(res,await getUserProfile(req.user.userId))));
router.get('/me/profile',route(async(req,res)=>ok(res,await getUserProfile(req.user.userId))));
router.patch('/me/profile',route(async(req,res)=>{
  const b=input(z.object({fullName:text(200).optional(),personType:z.enum(['STUDENT','LECTURER','STAFF','OTHER']).optional(),birthDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),phone:z.string().max(40).nullable().optional(),headline:z.string().max(300).nullable().optional(),biography:z.string().max(30000).nullable().optional(),attributes:z.record(z.unknown()).optional()}).strict(),req.body);
  const fields={fullName:'full_name',personType:'person_type',birthDate:'birth_date',phone:'phone',headline:'headline',biography:'biography',attributes:'attributes_json'};
  const entries=Object.entries(b); if(entries.length) await query(`UPDATE app.person_profiles SET ${entries.map(([k],i)=>`${fields[k]}=$${i+1}`).join(',')},updated_at=SYSUTCDATETIME() WHERE user_id=$${entries.length+1}`,[...entries.map(([k,v])=>k==='attributes'?JSON.stringify(v):v),req.user.userId]);
  ok(res,await getUserProfile(req.user.userId));
}));
router.post('/auth/change-password',route(async(req,res)=>{
  const b=input(z.object({oldPassword:z.string().min(1).max(1000),newPassword:password}),req.body),ph=await hashPassword(b.newPassword);
  await withTransaction(async({query:db})=>{
    const u=await one(db,`SELECT password_hash FROM app.users WITH(UPDLOCK,HOLDLOCK) WHERE id=$1`,[req.user.userId]);
    if(!u.password_hash||!await comparePassword(b.oldPassword,u.password_hash)) throw new ValidationError('Mật khẩu hiện tại không đúng');
    await db(`UPDATE app.users SET password_hash=$1,updated_at=SYSUTCDATETIME() WHERE id=$2`,[ph,req.user.userId]);
    await db(`UPDATE app.auth_sessions SET revoked_at=COALESCE(revoked_at,SYSUTCDATETIME()) WHERE user_id=$1`,[req.user.userId]);
    await db(`UPDATE app.auth_tokens SET consumed_at=SYSUTCDATETIME() WHERE user_id=$1 AND consumed_at IS NULL`,[req.user.userId]);
    await audit(db,req.user.userId,null,'PASSWORD_CHANGED','users',req.user.userId);
  }); clearCookie(res); ok(res,{changed:true,reauthenticate:true});
}));

const managerPermission=z.object({permissionCode:z.enum(permissions),includeDescendants:z.boolean().default(false)}).strict();
const orgFields=z.object({code:text(80),name:text(250),organizationType:z.enum(['UNIVERSITY','FACULTY','DEPARTMENT','CLASS','COMPANY','TEAM','OTHER']),parentId:number.nullable().optional(),managerUserId:number.optional(),managerEmail:z.string().trim().email().max(254).optional(),managerPermissions:z.array(managerPermission).min(1).max(permissions.length).refine(items=>new Set(items.map(x=>x.permissionCode)).size===items.length,'Quyền không được lặp lại').optional()});
export async function initialManagerPermissions(actor,parentId,requested,db=query) {
  let grants=requested;
  if(!grants) {
    grants=[];
    for(const permissionCode of permissions) {
      if(!parentId||await canAccessOrg(actor,parentId,permissionCode,db,true)) grants.push({permissionCode,includeDescendants:true});
    }
  }
  // Creating an independent root establishes ownership. A child is inside an
  // existing scope: even an exact-child grant requires the actor's parent grant
  // to cover descendants, independently of STRUCTURE_MANAGE at the parent.
  if(parentId) for(const grant of grants) await authorizeOrg(actor,parentId,grant.permissionCode,db,true);
  if(!grants.some(g=>g.permissionCode==='ACCESS_MANAGE')) throw new ForbiddenError('Cần quyền quản lý truy cập bao gồm tổ chức con để chỉ định người quản lý ban đầu');
  return grants;
}
async function activeOrg(db,id,lock=false) { return one(db,`SELECT * FROM app.organizations ${lock?'WITH(UPDLOCK,HOLDLOCK)':''} WHERE id=$1 AND status='ACTIVE'`,[id]); }
router.get('/organizations',route(async(req,res)=>{
  // Organization names are a directory; membership and private profiles have separate guards.
  ok(res,(await query(`SELECT id,parent_id,code,name,organization_type,status FROM app.organizations WHERE status='ACTIVE' ORDER BY name`)).rows);
}));
router.post('/organizations',route(async(req,res)=>{
  const b=input(orgFields,req.body);
  if(b.managerUserId&&b.managerEmail)throw new ValidationError('Chỉ chọn một cách xác định người quản lý.');
  const org=await withTransaction(async({query:db})=>{
    if(b.parentId) { await activeOrg(db,b.parentId); await authorizeOrg(req.user.userId,b.parentId,'STRUCTURE_MANAGE',db); }
    const initialGrants=await initialManagerPermissions(req.user.userId,b.parentId,b.managerPermissions,db);
    const manager=b.managerEmail
      ? (await one(db,"SELECT id FROM app.users WHERE normalized_email=LOWER($1) AND account_status='ACTIVE'",[b.managerEmail])).id
      : b.managerUserId||req.user.userId;
    await one(db,`SELECT id FROM app.users WHERE id=$1 AND account_status='ACTIVE'`,[manager]);
    const o=await one(db,`DECLARE @created TABLE(id bigint); INSERT INTO app.organizations(parent_id,code,name,organization_type,created_by_user_id) OUTPUT INSERTED.id INTO @created VALUES($1,$2,$3,$4,$5); SELECT o.* FROM app.organizations o JOIN @created c ON c.id=o.id;`,[b.parentId||null,b.code,b.name,b.organizationType,req.user.userId]);
    for(const grant of initialGrants) await db(`INSERT INTO app.org_access_grants(organization_id,user_id,permission_code,include_descendants,granted_by_user_id) VALUES($1,$2,$3,$4,$5)`,[o.id,manager,grant.permissionCode,grant.includeDescendants,req.user.userId]);
    if(b.parentId) await db(`INSERT INTO app.organization_link_history(child_organization_id,new_parent_id,changed_by_user_id,reason) VALUES($1,$2,$3,N'Tạo tổ chức con mới')`,[o.id,b.parentId,req.user.userId]);
    await audit(db,req.user.userId,o.id,'ORGANIZATION_CREATED','organizations',o.id,{managerUserId:manager,managerPermissions:initialGrants});
    return o;
  }); ok(res,org,201);
}));
router.get('/organizations/:id',route(async(req,res)=>ok(res,await activeOrg(query,ident(req.params.id)))));
router.patch('/organizations/:id',route(async(req,res)=>{
  const org=ident(req.params.id),b=input(orgFields.pick({code:true,name:true,organizationType:true}).partial().strict(),req.body);
  await withTransaction(async({query:db})=>{
    await activeOrg(db,org,true); await authorizeOrg(req.user.userId,org,'STRUCTURE_MANAGE',db);
    const cols={code:'code',name:'name',organizationType:'organization_type'},e=Object.entries(b);
    if(e.length) await db(`UPDATE app.organizations SET ${e.map(([k],i)=>`${cols[k]}=$${i+1}`).join(',')},updated_at=SYSUTCDATETIME() WHERE id=$${e.length+1}`,[...e.map(([,v])=>v),org]);
    await audit(db,req.user.userId,org,'ORGANIZATION_UPDATED','organizations',org,b);
  }); ok(res,await activeOrg(query,org));
}));
router.delete('/organizations/:id',route(async(req,res)=>{
  const org=ident(req.params.id);
  await withTransaction(async({query:db})=>{
    await treeLock(db); await activeOrg(db,org,true); await authorizeOrg(req.user.userId,org,'STRUCTURE_MANAGE',db);
    if((await db(`SELECT TOP(1) id FROM app.organizations WHERE parent_id=$1 AND status='ACTIVE'`,[org])).rows.length) throw new ConflictError('Hãy tách hoặc chuyển các tổ chức con trước');
    if((await db(`SELECT TOP(1) id FROM app.memberships WHERE organization_id=$1 AND valid_from<=SYSUTCDATETIME() AND (valid_to IS NULL OR valid_to>SYSUTCDATETIME())`,[org])).rows.length) throw new ConflictError('Hãy kết thúc quan hệ thành viên trước');
    if((await db(`SELECT TOP(1) id FROM app.organization_link_requests WHERE status='PENDING' AND expires_at>SYSUTCDATETIME() AND (child_organization_id=$1 OR previous_parent_id=$1 OR target_parent_id=$1)`,[org])).rows.length) throw new ConflictError('Tổ chức đang có yêu cầu liên kết chưa hoàn tất');
    await db(`UPDATE app.membership_invitations SET status='CANCELLED',responded_at=SYSUTCDATETIME(),responded_by_user_id=$1 WHERE organization_id=$2 AND status='PENDING'`,[req.user.userId,org]);
    await db(`UPDATE app.organizations SET status='ARCHIVED',updated_at=SYSUTCDATETIME() WHERE id=$1`,[org]);
    await audit(db,req.user.userId,org,'ORGANIZATION_ARCHIVED','organizations',org);
  }); ok(res,{archived:true});
}));
router.get('/organizations/:id/members',route(async(req,res)=>{
  const org=ident(req.params.id); await authorizeOrg(req.user.userId,org,'MEMBERS_VIEW');
  const descendants=req.query.includeDescendants==='true' || (req.query.includeDescendants==='auto' && await canAccessOrg(req.user.userId,org,'MEMBERS_VIEW',query,true)); if(descendants) await authorizeOrg(req.user.userId,org,'MEMBERS_VIEW',query,true);
  ok(res,(await query(`WITH scope AS (SELECT id FROM app.organizations WHERE id=$1 AND status='ACTIVE' UNION ALL SELECT o.id FROM app.organizations o JOIN scope s ON o.parent_id=s.id WHERE $2=1 AND o.status='ACTIVE')
  SELECT m.id,m.user_id,m.organization_id,m.title,m.valid_from,p.full_name,p.person_type,u.email,o.name AS organization_name FROM scope s JOIN app.memberships m ON m.organization_id=s.id JOIN app.person_profiles p ON p.user_id=m.user_id JOIN app.users u ON u.id=m.user_id JOIN app.organizations o ON o.id=s.id WHERE m.valid_from<=SYSUTCDATETIME() AND (m.valid_to IS NULL OR m.valid_to>SYSUTCDATETIME()) AND u.account_status='ACTIVE' OPTION(MAXRECURSION 32767)`,[org,descendants?1:0])).rows);
}));
router.get('/me/invitations',route(async(req,res)=>ok(res,(await query(`SELECT i.*,o.name AS organization_name FROM app.membership_invitations i JOIN app.organizations o ON o.id=i.organization_id WHERE i.invitee_user_id=$1 ORDER BY i.created_at DESC`,[req.user.userId])).rows)));
router.get('/me/join-requests',route(async(req,res)=>{
  ok(res,(await query(`SELECT r.*,o.name AS organization_name FROM app.membership_join_requests r
    JOIN app.organizations o ON o.id=r.organization_id WHERE r.user_id=$1 ORDER BY r.id DESC`,[req.user.userId])).rows);
}));
router.get('/organizations/:id/join-requests',route(async(req,res)=>{
  const org=ident(req.params.id);
  await authorizeOrg(req.user.userId,org,'MEMBERS_MANAGE');
  ok(res,(await query(`SELECT r.*,u.email FROM app.membership_join_requests r
    JOIN app.users u ON u.id=r.user_id WHERE r.organization_id=$1 ORDER BY r.id DESC`,[org])).rows);
}));
async function hasCurrentMembership(db,org,user) {
  return (await db(`SELECT id FROM app.memberships WHERE organization_id=$1 AND user_id=$2
    AND valid_from<=SYSUTCDATETIME() AND (valid_to IS NULL OR valid_to>SYSUTCDATETIME())`,[org,user])).rows.length>0;
}
router.post('/organizations/:id/join-requests',route(async(req,res)=>{
  const org=ident(req.params.id),user=req.user.userId;
  const b=input(z.object({reason:text(500).optional()}).strict(),req.body);
  const request=await withTransaction(async({query:db})=>{
    await activeOrg(db,org,true);
    if(await hasCurrentMembership(db,org,user)) throw new ConflictError('Bạn đã là thành viên');
    if((await db("SELECT id FROM app.membership_join_requests WHERE organization_id=$1 AND user_id=$2 AND status='PENDING'",[org,user])).rows.length)
      throw new ConflictError('Bạn đã có yêu cầu đang chờ');
    return one(db,`INSERT INTO app.membership_join_requests(organization_id,user_id,reason)
      OUTPUT INSERTED.* VALUES($1,$2,$3)`,[org,user,b.reason??null]);
  });
  ok(res,request,201);
}));
router.post('/organizations/:id/join-requests/:requestId/respond',route(async(req,res)=>{
  const org=ident(req.params.id),key=ident(req.params.requestId),actor=req.user.userId;
  const {accept}=input(z.object({accept:z.boolean()}).strict(),req.body);
  await withTransaction(async({query:db})=>{
    await activeOrg(db,org,true);
    await authorizeOrg(actor,org,'MEMBERS_MANAGE',db);
    const r=await one(db,'SELECT * FROM app.membership_join_requests WITH(UPDLOCK,HOLDLOCK) WHERE id=$1 AND organization_id=$2',[key,org]);
    if(r.status!=='PENDING') throw new ConflictError('Yêu cầu đã được xử lý');
    if(accept && Number(r.user_id)===Number(actor) && !await canAccessOrgDirectly(actor,org,'MEMBERS_MANAGE',db))
      throw new ForbiddenError('Yêu cầu của bạn cần quản lý trực tiếp của đơn vị duyệt.');
    if(accept) await one(db,"SELECT id FROM app.users WHERE id=$1 AND account_status='ACTIVE'",[r.user_id]);
    await db('UPDATE app.membership_join_requests SET status=$2,responded_at=SYSUTCDATETIME(),responded_by_user_id=$3 WHERE id=$1',[key,accept?'ACCEPTED':'DECLINED',actor]);
    if(accept && !await hasCurrentMembership(db,org,r.user_id))
      await db('INSERT INTO app.memberships(organization_id,user_id,join_request_id) VALUES($1,$2,$3)',[org,r.user_id,key]);
    await notify(db,r.user_id,actor,org,'ORGANIZATION_MESSAGE',accept?'Yêu cầu gia nhập đã được chấp nhận':'Yêu cầu gia nhập đã bị từ chối');
    await audit(db,actor,org,accept?'JOIN_REQUEST_ACCEPTED':'JOIN_REQUEST_DECLINED','membership_join_requests',key);
  });
  ok(res,{accepted:accept});
}));
router.get('/organizations/:id/invitations',route(async(req,res)=>{
  const org=ident(req.params.id); await authorizeOrg(req.user.userId,org,'MEMBERS_MANAGE');
  ok(res,(await query(`SELECT i.*,p.full_name,u.email FROM app.membership_invitations i JOIN app.person_profiles p ON p.user_id=i.invitee_user_id JOIN app.users u ON u.id=i.invitee_user_id WHERE i.organization_id=$1 ORDER BY i.created_at DESC`,[org])).rows);
}));
router.post('/organizations/:id/invitations',route(async(req,res)=>{
  const org=ident(req.params.id),b=input(z.object({email:z.string().trim().email().max(254),title:z.string().max(200).optional()}),req.body);
  const inv=await withTransaction(async({query:db})=>{
    await activeOrg(db,org,true); await authorizeOrg(req.user.userId,org,'MEMBERS_MANAGE',db);
    const u=await one(db,`SELECT id FROM app.users WHERE normalized_email=LOWER($1) AND account_status='ACTIVE'`,[b.email]);
    if(Number(u.id)===Number(req.user.userId) && !await canAccessOrgDirectly(req.user.userId,org,'MEMBERS_MANAGE',db))
      throw new ForbiddenError('Bạn cần được quản lý trực tiếp của đơn vị mời.');
    if((await db(`SELECT id FROM app.memberships WHERE organization_id=$1 AND user_id=$2 AND valid_from<=SYSUTCDATETIME() AND (valid_to IS NULL OR valid_to>SYSUTCDATETIME())`,[org,u.id])).rows.length) throw new ConflictError('Người dùng đã là thành viên');
    await db(`UPDATE app.membership_invitations SET status='EXPIRED',responded_at=SYSUTCDATETIME() WHERE organization_id=$1 AND invitee_user_id=$2 AND status='PENDING' AND expires_at<=SYSUTCDATETIME()`,[org,u.id]);
    const i=await one(db,`INSERT INTO app.membership_invitations(organization_id,invitee_user_id,invited_by_user_id,title,expires_at) OUTPUT INSERTED.* VALUES($1,$2,$3,$4,DATEADD(day,7,SYSUTCDATETIME()))`,[org,u.id,req.user.userId,b.title||null]);
    await notify(db,u.id,req.user.userId,org,'MEMBERSHIP_INVITATION','Bạn có lời mời tham gia tổ chức');
    await audit(db,req.user.userId,org,'MEMBER_INVITED','membership_invitations',i.id); return i;
  }); ok(res,inv,201);
}));
router.post('/invitations/:id/respond',route(async(req,res)=>{
  const id=ident(req.params.id),b=input(z.object({accept:z.boolean()}),req.body);
  await withTransaction(async({query:db})=>{
    const i=await one(db,`SELECT * FROM app.membership_invitations WITH(UPDLOCK,HOLDLOCK) WHERE id=$1`,[id]);
    if(Number(i.invitee_user_id)!==Number(req.user.userId)) throw new ForbiddenError();
    if(i.status!=='PENDING'||new Date(i.expires_at)<=new Date()) throw new ConflictError('Lời mời không còn hiệu lực');
    await activeOrg(db,i.organization_id,true);
    await db(`UPDATE app.membership_invitations SET status=$1,responded_at=SYSUTCDATETIME(),responded_by_user_id=$2 WHERE id=$3`,[b.accept?'ACCEPTED':'DECLINED',req.user.userId,id]);
    if(b.accept && !await hasCurrentMembership(db,i.organization_id,req.user.userId))
      await db(`INSERT INTO app.memberships(organization_id,user_id,invitation_id,title) VALUES($1,$2,$3,$4)`,[i.organization_id,req.user.userId,id,i.title]);
    await audit(db,req.user.userId,i.organization_id,b.accept?'INVITATION_ACCEPTED':'INVITATION_DECLINED','membership_invitations',id);
  }); ok(res,{accepted:b.accept});
}));
router.delete('/invitations/:id',route(async(req,res)=>{
  const iid=ident(req.params.id);
  await withTransaction(async({query:db})=>{
    const i=await one(db,`SELECT * FROM app.membership_invitations WITH(UPDLOCK,HOLDLOCK) WHERE id=$1 AND status='PENDING'`,[iid]);
    await authorizeOrg(req.user.userId,i.organization_id,'MEMBERS_MANAGE',db);
    await db(`UPDATE app.membership_invitations SET status='CANCELLED',responded_at=SYSUTCDATETIME(),responded_by_user_id=$1 WHERE id=$2`,[req.user.userId,iid]);
    await audit(db,req.user.userId,i.organization_id,'INVITATION_CANCELLED','membership_invitations',iid);
  }); ok(res,{cancelled:true});
}));
router.delete('/organizations/:id/members/:membershipId',route(async(req,res)=>{
  const org=ident(req.params.id),mid=ident(req.params.membershipId);
  await withTransaction(async({query:db})=>{
    const m=await one(db,`SELECT * FROM app.memberships WITH(UPDLOCK,HOLDLOCK) WHERE id=$1 AND organization_id=$2 AND valid_to IS NULL`,[mid,org]);
    await authorizeManagerChange(db,req.user.userId,org,m.user_id);
    if(Number(m.user_id)!==Number(req.user.userId)) await authorizeOrg(req.user.userId,org,'MEMBERS_MANAGE',db);
    await db(`UPDATE app.memberships SET valid_to=CASE WHEN valid_from>=SYSUTCDATETIME() THEN DATEADD(millisecond,1,valid_from) ELSE SYSUTCDATETIME() END,ended_by_user_id=$1,end_reason=N'Kết thúc quan hệ thành viên' WHERE id=$2`,[req.user.userId,mid]);
    // Organization privileges are independently granted, but must be revoked when removing a member.
    await db(`UPDATE app.org_access_grants SET valid_to=CASE WHEN valid_from>=SYSUTCDATETIME() THEN DATEADD(millisecond,1,valid_from) ELSE SYSUTCDATETIME() END WHERE user_id=$1 AND organization_id=$2 AND valid_to IS NULL`,[m.user_id,org]);
    await audit(db,req.user.userId,org,'MEMBERSHIP_ENDED','memberships',mid);
  }); ok(res,{ended:true});
}));
router.get('/organizations/:id/access',route(async(req,res)=>{
  const org=ident(req.params.id); await authorizeOrg(req.user.userId,org,'ACCESS_MANAGE');
  ok(res,(await query(`SELECT g.*,p.full_name,u.email FROM app.org_access_grants g JOIN app.person_profiles p ON p.user_id=g.user_id JOIN app.users u ON u.id=g.user_id WHERE g.organization_id=$1 AND g.valid_from<=SYSUTCDATETIME() AND (g.valid_to IS NULL OR g.valid_to>SYSUTCDATETIME())`,[org])).rows);
}));
router.put('/organizations/:id/access/users/:userId',route(async(req,res)=>{
  const org=ident(req.params.id), userId=ident(req.params.userId), actor=req.user.userId;
  const body=input(z.object({
    grantIds:z.array(number),
    permissions:z.array(managerPermission).max(permissions.length)
      .refine(items=>new Set(items.map(item=>item.permissionCode)).size===items.length)
  }).strict(),req.body);

  await withTransaction(async({query:db})=>{
    await activeOrg(db,org,true);
    await authorizeManagerChange(db,actor,org,userId);
    await authorizeOrg(actor,org,'ACCESS_MANAGE',db);
    const current=(await db(`SELECT * FROM app.org_access_grants WHERE organization_id=$1 AND user_id=$2
      AND valid_from<=SYSUTCDATETIME() AND (valid_to IS NULL OR valid_to>SYSUTCDATETIME())`,[org,userId])).rows;
    const snapshot=new Set(body.grantIds);
    if(current.length!==snapshot.size || current.some(grant=>!snapshot.has(Number(grant.id)))) {
      throw new ConflictError('Quyền đã thay đổi. Hãy đóng và mở lại hộp thoại để tải quyền mới nhất.');
    }
    const existing=new Map();
    for(const grant of current) {
      existing.set(grant.permission_code,!!grant.include_descendants || existing.get(grant.permission_code)===true);
    }
    const desired=new Map(body.permissions.map(grant=>[grant.permissionCode,grant.includeDescendants]));
    const removals=current.filter(grant=>desired.get(grant.permission_code)!==existing.get(grant.permission_code));
    const additions=body.permissions.filter(grant=>existing.get(grant.permissionCode)!==grant.includeDescendants);

    if(additions.length) {
      if(!current.length && !await hasCurrentMembership(db,org,userId)) throw new NotFoundError();
      await one(db,`SELECT id FROM app.users WHERE id=$1 AND account_status='ACTIVE'`,[userId]);
    }
    // Authorize the full change before writing, including changes to the actor's own grants.
    for(const grant of removals) {
      await authorizeOrg(actor,org,'ACCESS_MANAGE',db,!!grant.include_descendants);
      await authorizeOrg(actor,org,grant.permission_code,db,!!grant.include_descendants);
    }
    for(const grant of additions) await authorizeGrant(actor,org,grant,db);
    for(const grant of removals) await revokeGrant(db,actor,org,grant.id);
    for(const grant of additions) await insertGrant(db,actor,org,{...grant,userId});
  });
  ok(res,{updated:true});
}));

async function authorizeGrant(actor,org,grant,db) {
  await authorizeManagerChange(db,actor,org,grant.userId);
  await authorizeOrg(actor,org,'ACCESS_MANAGE',db,grant.includeDescendants);
  await authorizeOrg(actor,org,grant.permissionCode,db,grant.includeDescendants);
  if((grant.permissionCode.startsWith('REGULATIONS_') || ['ACCESS_MANAGE','ASSESSMENTS_RUN','MEMBERS_MANAGE'].includes(grant.permissionCode)) &&
    !await canAccessOrgDirectly(actor,org,'ACCESS_MANAGE',db)) throw new ForbiddenError();
}

async function authorizeManagerChange(db,actor,org,userId) {
  if(!userId) return;
  const manager=(await db(`SELECT id FROM app.org_access_grants WHERE organization_id=$1 AND user_id=$2 AND permission_code='ACCESS_MANAGE'
    AND valid_from<=SYSUTCDATETIME() AND (valid_to IS NULL OR valid_to>SYSUTCDATETIME())`,[org,userId])).rows.length;
  if(!manager || await hasGlobalRole(actor,'SYSTEM_ADMIN',db)) return;
  const organization=await activeOrg(db,org);
  if(!organization.parent_id || !await canAccessOrg(actor,organization.parent_id,'ACCESS_MANAGE',db,true)) {
    throw new ForbiddenError('Cần người quản lý cấp trên để thay đổi người quản lý tổ chức.');
  }
}

async function insertGrant(db,actor,org,grant) {
  const row=await one(db,`INSERT INTO app.org_access_grants(organization_id,user_id,permission_code,include_descendants,granted_by_user_id) OUTPUT INSERTED.* VALUES($1,$2,$3,$4,$5)`,[org,grant.userId,grant.permissionCode,grant.includeDescendants,actor]);
  await audit(db,actor,org,'ORG_ACCESS_GRANTED','org_access_grants',row.id,grant);
  return row;
}

async function revokeGrant(db,actor,org,id) {
  await db(`UPDATE app.org_access_grants SET valid_to=CASE WHEN valid_from>=SYSUTCDATETIME() THEN DATEADD(millisecond,1,valid_from) ELSE SYSUTCDATETIME() END WHERE id=$1`,[id]);
  await audit(db,actor,org,'ORG_ACCESS_REVOKED','org_access_grants',id);
}

router.post('/organizations/:id/access',route(async(req,res)=>{
  const org=ident(req.params.id),b=input(z.object({userId:number,permissionCode:z.enum(permissions),includeDescendants:z.boolean().default(false)}),req.body);
  const grant=await withTransaction(async({query:db})=>{
    await activeOrg(db,org,true);
    await authorizeGrant(req.user.userId,org,b,db);
    await one(db,`SELECT id FROM app.users WHERE id=$1 AND account_status='ACTIVE'`,[b.userId]);
    return insertGrant(db,req.user.userId,org,b);
  }); ok(res,grant,201);
}));
router.delete('/organizations/:id/access/:grantId',route(async(req,res)=>{
  const org=ident(req.params.id),gid=ident(req.params.grantId);
  await withTransaction(async({query:db})=>{
    await activeOrg(db,org,true); const g=await one(db,`SELECT * FROM app.org_access_grants WHERE id=$1 AND organization_id=$2 AND valid_to IS NULL`,[gid,org]);
    await authorizeManagerChange(db,req.user.userId,org,g.user_id);
    await authorizeOrg(req.user.userId,org,'ACCESS_MANAGE',db,!!g.include_descendants);
    await authorizeOrg(req.user.userId,org,g.permission_code,db,!!g.include_descendants);
    await revokeGrant(db,req.user.userId,org,gid);
  }); ok(res,{revoked:true});
}));

// Applying consent and changing the tree share one transaction and database tree lock.
async function treeLock(db) {
  await db(`DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'PTUD_V2_ORGANIZATION_TREE',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; IF @r<0 THROW 51001,'Cannot lock organization tree',1;`);
}
async function applyLink(db,r,actor) {
  const child=await activeOrg(db,r.child_organization_id,true);
  if(String(child.parent_id??'')!==String(r.previous_parent_id??'')) throw new ConflictError('Tổ chức đã đổi cha; hãy tạo yêu cầu mới');
  if(r.target_parent_id) await activeOrg(db,r.target_parent_id,true);
  // Recheck both consenters against current scope; an old grant is not permanent consent.
  if(r.child_consented_by_user_id) await authorizeOrg(r.child_consented_by_user_id,r.child_organization_id,'STRUCTURE_MANAGE',db);
  if(r.parent_consented_by_user_id) await authorizeOrg(r.parent_consented_by_user_id,r.target_parent_id||r.previous_parent_id,'STRUCTURE_MANAGE',db);
  await db(`UPDATE app.organization_link_requests SET status='ACCEPTED',child_consented_by_user_id=$1,parent_consented_by_user_id=$2,responded_at=SYSUTCDATETIME() WHERE id=$3 AND status='PENDING'`,[r.child_consented_by_user_id,r.parent_consented_by_user_id,r.id]);
  await db(`UPDATE app.organizations SET parent_id=$1,updated_at=SYSUTCDATETIME() WHERE id=$2`,[r.target_parent_id,r.child_organization_id]);
  await db(`INSERT INTO app.organization_link_history(child_organization_id,previous_parent_id,new_parent_id,request_id,changed_by_user_id,reason) VALUES($1,$2,$3,$4,$5,$6)`,[r.child_organization_id,r.previous_parent_id,r.target_parent_id,r.id,actor,r.reason||'Thay đổi liên kết tổ chức']);
  await audit(db,actor,r.child_organization_id,'ORGANIZATION_LINK_CHANGED','organization_link_requests',r.id);
}
router.get('/organizations/:id/link-requests',route(async(req,res)=>{
  const org=ident(req.params.id); await authorizeOrg(req.user.userId,org,'STRUCTURE_MANAGE');
  ok(res,(await query(`SELECT r.*,c.name AS child_name,p.name AS target_parent_name FROM app.organization_link_requests r JOIN app.organizations c ON c.id=r.child_organization_id LEFT JOIN app.organizations p ON p.id=r.target_parent_id WHERE r.child_organization_id=$1 OR r.previous_parent_id=$1 OR r.target_parent_id=$1 ORDER BY r.created_at DESC`,[org])).rows);
}));
router.get('/organizations/:id/link-history',route(async(req,res)=>{
  const org=ident(req.params.id); await authorizeOrg(req.user.userId,org,'STRUCTURE_MANAGE');
  ok(res,(await query(`SELECT * FROM app.organization_link_history WHERE child_organization_id=$1 OR previous_parent_id=$1 OR new_parent_id=$1 ORDER BY changed_at DESC`,[org])).rows);
}));
router.post('/organizations/:id/link-requests',route(async(req,res)=>{
  const org=ident(req.params.id),b=input(z.object({targetParentId:number.nullable(),reason:text(1000).optional()}),req.body);
  const result=await withTransaction(async({query:db})=>{
    await treeLock(db); const child=await activeOrg(db,org,true);
    if(String(child.parent_id??'')===String(b.targetParentId??'')) throw new ConflictError('Liên kết cha không thay đổi');
    if(b.targetParentId===org) throw new ValidationError('Tổ chức không thể thuộc chính nó');
    if(b.targetParentId) await activeOrg(db,b.targetParentId,true);
    const type=child.parent_id?(b.targetParentId?'MOVE':'DETACH'):'ATTACH';
    const childYes=await canAccessOrg(req.user.userId,org,'STRUCTURE_MANAGE',db);
    const parentYes=await canAccessOrg(req.user.userId,b.targetParentId||child.parent_id,'STRUCTURE_MANAGE',db);
    if(!childYes&&!parentYes) throw new ForbiddenError();
    await db(`UPDATE app.organization_link_requests SET status='EXPIRED',responded_at=SYSUTCDATETIME() WHERE child_organization_id=$1 AND status='PENDING' AND expires_at<=SYSUTCDATETIME()`,[org]);
    const r=await one(db,`INSERT INTO app.organization_link_requests(child_organization_id,previous_parent_id,target_parent_id,request_type,requested_by_user_id,child_consented_by_user_id,parent_consented_by_user_id,expires_at,reason) OUTPUT INSERTED.* VALUES($1,$2,$3,$4,$5,$6,$7,DATEADD(day,7,SYSUTCDATETIME()),$8)`,[org,child.parent_id,b.targetParentId,type,req.user.userId,childYes?req.user.userId:null,parentYes?req.user.userId:null,b.reason??null]);
    if(type==='DETACH'||(childYes&&parentYes)) { await applyLink(db,r,req.user.userId); r.status='ACCEPTED'; }
    await audit(db,req.user.userId,org,'ORGANIZATION_LINK_REQUESTED','organization_link_requests',r.id);
    return r;
  }); ok(res,result,201);
}));
router.post('/organization-link-requests/:id/respond',route(async(req,res)=>{
  const rid=ident(req.params.id),b=input(z.object({accept:z.boolean()}),req.body);
  const result=await withTransaction(async({query:db})=>{
    await treeLock(db);
    const r=await one(db,`SELECT * FROM app.organization_link_requests WITH(UPDLOCK,HOLDLOCK) WHERE id=$1`,[rid]);
    if(r.status!=='PENDING'||new Date(r.expires_at)<=new Date()) throw new ConflictError('Yêu cầu không còn hiệu lực');
    const childYes=await canAccessOrg(req.user.userId,r.child_organization_id,'STRUCTURE_MANAGE',db);
    const parentYes=await canAccessOrg(req.user.userId,r.target_parent_id||r.previous_parent_id,'STRUCTURE_MANAGE',db);
    if(!childYes&&!parentYes) throw new ForbiddenError();
    if(!b.accept) { await db(`UPDATE app.organization_link_requests SET status='DECLINED',responded_at=SYSUTCDATETIME() WHERE id=$1`,[rid]); await audit(db,req.user.userId,r.child_organization_id,'ORGANIZATION_LINK_DECLINED','organization_link_requests',rid); return {status:'DECLINED'}; }
    if(childYes) r.child_consented_by_user_id=req.user.userId;
    if(parentYes) r.parent_consented_by_user_id=req.user.userId;
    if(r.request_type==='DETACH'||(r.child_consented_by_user_id&&r.parent_consented_by_user_id)) { await applyLink(db,r,req.user.userId); return {status:'ACCEPTED'}; }
    await db(`UPDATE app.organization_link_requests SET child_consented_by_user_id=$1,parent_consented_by_user_id=$2 WHERE id=$3`,[r.child_consented_by_user_id,r.parent_consented_by_user_id,rid]);
    await audit(db,req.user.userId,r.child_organization_id,'ORGANIZATION_LINK_CONSENTED','organization_link_requests',rid); return {status:'PENDING'};
  }); ok(res,result);
}));
router.post('/organizations/:id/notifications',route(async(req,res)=>{
  const org=ident(req.params.id),b=input(z.object({title:text(300),body:z.string().max(10000).optional(),userIds:z.array(number).min(1).max(200),includeDescendants:z.boolean().default(false)}),req.body);
  await withTransaction(async({query:db})=>{
    await activeOrg(db,org,true); await authorizeOrg(req.user.userId,org,'MEMBERS_NOTIFY',db,b.includeDescendants);
    const scope=(await db(`WITH scope AS (SELECT id FROM app.organizations WHERE id=$1 AND status='ACTIVE' UNION ALL SELECT o.id FROM app.organizations o JOIN scope s ON o.parent_id=s.id WHERE $2=1 AND o.status='ACTIVE') SELECT DISTINCT m.user_id FROM scope s JOIN app.memberships m ON m.organization_id=s.id WHERE m.valid_from<=SYSUTCDATETIME() AND (m.valid_to IS NULL OR m.valid_to>SYSUTCDATETIME()) OPTION(MAXRECURSION 32767)`,[org,b.includeDescendants?1:0])).rows.map(x=>Number(x.user_id));
    if(b.userIds.some(u=>!scope.includes(u))) throw new ForbiddenError('Người nhận nằm ngoài phạm vi thành viên');
    for(const u of new Set(b.userIds)) await notify(db,u,req.user.userId,org,'ORGANIZATION_MESSAGE',b.title,b.body||null);
    await audit(db,req.user.userId,org,'MEMBERS_NOTIFIED','organizations',org,{count:new Set(b.userIds).size});
  }); ok(res,{sent:new Set(b.userIds).size});
}));
// A dedicated guard calls next; a terminal async route helper intentionally does not.
router.use('/admin',async(req,res,next)=>{try{if(!await hasGlobalRole(req.user.userId,'SYSTEM_ADMIN')) throw new ForbiddenError();next();}catch(e){next(e);}});
router.get('/admin/users',route(async(req,res)=>{
  const search=typeof req.query.search==='string'?req.query.search.slice(0,200):'';
  ok(res,(await query(`SELECT TOP(200) u.id,u.email,u.account_status,u.created_at,p.full_name,p.person_type FROM app.users u JOIN app.person_profiles p ON p.user_id=u.id WHERE u.account_status<>'DELETED' AND (u.email LIKE $1 OR p.full_name LIKE $1) ORDER BY u.id DESC`,[`%${search}%`])).rows);
}));
router.patch('/admin/users/:id',route(async(req,res)=>{
  const uid=ident(req.params.id),b=input(z.object({accountStatus:z.enum(['ACTIVE','DISABLED'])}),req.body);
  if(uid===Number(req.user.userId)&&b.accountStatus!=='ACTIVE') throw new ConflictError('Không thể tự vô hiệu hóa tài khoản');
  await withTransaction(async({query:db})=>{
    await one(db,`SELECT id FROM app.users WITH(UPDLOCK,HOLDLOCK) WHERE id=$1`,[uid]);
    await db(`UPDATE app.users SET account_status=$1,updated_at=SYSUTCDATETIME() WHERE id=$2`,[b.accountStatus,uid]);
    if(b.accountStatus!=='ACTIVE') await db(`UPDATE app.auth_sessions SET revoked_at=COALESCE(revoked_at,SYSUTCDATETIME()) WHERE user_id=$1`,[uid]);
    await audit(db,req.user.userId,null,'ACCOUNT_STATUS_CHANGED','users',uid,b);
  }); ok(res,{id:uid,account_status:b.accountStatus});
}));
router.get('/admin/global-roles',route(async(req,res)=>ok(res,(await query(`SELECT g.*,u.email,p.full_name FROM app.global_role_grants g JOIN app.users u ON u.id=g.user_id JOIN app.person_profiles p ON p.user_id=g.user_id WHERE g.valid_from<=SYSUTCDATETIME() AND (g.valid_to IS NULL OR g.valid_to>SYSUTCDATETIME()) ORDER BY g.id DESC`)).rows)));
router.post('/admin/global-roles',route(async(req,res)=>{
  const b=input(z.object({userId:number,roleCode:z.literal('SYSTEM_ADMIN')}),req.body);
  const g=await withTransaction(async({query:db})=>{
    await one(db,`SELECT id FROM app.users WHERE id=$1 AND account_status='ACTIVE'`,[b.userId]);
    const result=await one(db,`INSERT INTO app.global_role_grants(user_id,role_code,granted_by_user_id) OUTPUT INSERTED.* VALUES($1,$2,$3)`,[b.userId,b.roleCode,req.user.userId]);
    await audit(db,req.user.userId,null,'GLOBAL_ROLE_GRANTED','global_role_grants',result.id,b); return result;
  }); ok(res,g,201);
}));
router.delete('/admin/global-roles/:id',route(async(req,res)=>{
  const gid=ident(req.params.id);
  await withTransaction(async({query:db})=>{
    const g=await one(db,`SELECT * FROM app.global_role_grants WITH(UPDLOCK,HOLDLOCK) WHERE id=$1 AND valid_to IS NULL`,[gid]);
    if(g.role_code==='SYSTEM_ADMIN'&&Number(g.user_id)===Number(req.user.userId)) throw new ConflictError('Không thể tự thu hồi quyền quản trị hệ thống');
    await db(`UPDATE app.global_role_grants SET valid_to=CASE WHEN valid_from>=SYSUTCDATETIME() THEN DATEADD(millisecond,1,valid_from) ELSE SYSUTCDATETIME() END WHERE id=$1`,[gid]);
    await audit(db,req.user.userId,null,'GLOBAL_ROLE_REVOKED','global_role_grants',gid);
  }); ok(res,{revoked:true});
}));
export default router;
