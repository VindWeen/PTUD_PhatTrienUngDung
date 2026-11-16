import { Router } from 'express';
import { z } from 'zod';
import { ZipArchive } from 'archiver';
import fs from 'node:fs/promises';
import PizZip from 'pizzip';
import { authenticate } from './access.js';
import { query, route, ok, id, body, insertId, one, pageParams, parseJson } from './shared.js';
import { filePath } from './files.js';
import { NotFoundError } from '../utils/errors.js';

const router=Router();
router.use(authenticate);
const eventSchema=z.object({title:z.string().trim().min(1).max(300),description:z.string().max(20000).nullable().optional(),startsAt:z.string().datetime({offset:true}),endsAt:z.string().datetime({offset:true}),remindAt:z.string().datetime({offset:true}).nullable().optional(),goalId:z.number().int().positive().nullable().optional(),status:z.enum(['SCHEDULED','COMPLETED','CANCELLED']).default('SCHEDULED')}).strict().refine(d=>Date.parse(d.endsAt)>Date.parse(d.startsAt),'Thời gian kết thúc phải sau bắt đầu.').refine(d=>!d.remindAt||Date.parse(d.remindAt)<=Date.parse(d.startsAt),'Nhắc lịch phải trước thời gian bắt đầu.');
const eventView=r=>({id:r.id,eventId:r.id,title:r.title,description:r.description||'',startsAt:new Date(r.starts_at).toISOString(),endsAt:new Date(r.ends_at).toISOString(),remindAt:r.remind_at?new Date(r.remind_at).toISOString():null,goalId:r.goal_id,status:r.status});
// datetime2 stores UTC without an offset; normalize offset-bearing input before SQL conversion.
const utc=value=>value?new Date(value).toISOString():null;
router.get(['/me/calendar/events','/me/calendar'],route(async(req,res)=>ok(res,(await query('SELECT * FROM app.calendar_events WHERE owner_user_id=$1 ORDER BY starts_at,id',[req.user.userId])).rows.map(eventView))));
router.post(['/me/calendar/events','/me/calendar'],route(async(req,res)=>{
  const d=body(eventSchema,req);if(d.goalId)await one('SELECT id FROM app.kpi_goals WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL',[d.goalId,req.user.userId]);
  const key=await insertId(null,'calendar_events','owner_user_id,title,description,starts_at,ends_at,remind_at,goal_id,status','$1,$2,$3,$4,$5,$6,$7,$8',[req.user.userId,d.title,d.description||null,utc(d.startsAt),utc(d.endsAt),utc(d.remindAt),d.goalId||null,d.status]);
  return ok(res,eventView(await one('SELECT * FROM app.calendar_events WHERE id=$1',[key])),201);
}));
router.patch('/me/calendar/events/:id',route(async(req,res)=>{
  const key=id(req.params.id),existing=eventView(await one('SELECT * FROM app.calendar_events WHERE id=$1 AND owner_user_id=$2',[key,req.user.userId]));
  const {id:ignoredId,eventId:ignoredEventId,...fields}=existing;
  const d=eventSchema.parse({...fields,...req.body});
  if(d.goalId)await one('SELECT id FROM app.kpi_goals WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL',[d.goalId,req.user.userId]);
  await query('UPDATE app.calendar_events SET title=$3,description=$4,starts_at=$5,ends_at=$6,remind_at=$7,goal_id=$8,status=$9 WHERE id=$1 AND owner_user_id=$2',[key,req.user.userId,d.title,d.description||null,utc(d.startsAt),utc(d.endsAt),utc(d.remindAt),d.goalId||null,d.status]);return ok(res,eventView(await one('SELECT * FROM app.calendar_events WHERE id=$1',[key])));
}));
router.delete(['/me/calendar/events/:id','/me/calendar/:id'],route(async(req,res)=>{
  const key=id(req.params.id);await one('SELECT id FROM app.calendar_events WHERE id=$1 AND owner_user_id=$2',[key,req.user.userId]);await query('DELETE app.calendar_events WHERE id=$1 AND owner_user_id=$2',[key,req.user.userId]);return ok(res,{id:key});
}));
router.get('/notifications',route(async(req,res)=>{
  const {page,pageSize,offset}=pageParams(req);
  const items=(await query('SELECT id,title,body,notification_type,created_at,read_at,payload_json FROM app.notifications WHERE recipient_user_id=$1 ORDER BY created_at DESC,id DESC OFFSET $2 ROWS FETCH NEXT $3 ROWS ONLY',[req.user.userId,offset,pageSize])).rows.map(r=>({id:r.id,notificationId:r.id,title:r.title,message:r.body,body:r.body,type:r.notification_type,createdAt:r.created_at,readAt:r.read_at,isRead:!!r.read_at,payload:parseJson(r.payload_json)}));
  const counts=(await query('SELECT COUNT(*) AS total,SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unreadCount FROM app.notifications WHERE recipient_user_id=$1',[req.user.userId])).rows[0];
  return ok(res,{items,total:counts.total,unreadCount:counts.unreadCount||0,page,pageSize});
}));
router.patch('/notifications/:id/read',route(async(req,res)=>{
  const key=id(req.params.id);await one('SELECT id FROM app.notifications WHERE id=$1 AND recipient_user_id=$2',[key,req.user.userId]);await query('UPDATE app.notifications SET read_at=COALESCE(read_at,SYSUTCDATETIME()) WHERE id=$1 AND recipient_user_id=$2',[key,req.user.userId]);return ok(res,{id:key});
}));
router.post('/notifications/read-all',route(async(req,res)=>{await query('UPDATE app.notifications SET read_at=SYSUTCDATETIME() WHERE recipient_user_id=$1 AND read_at IS NULL',[req.user.userId]);return ok(res,{success:true});}));
router.get(['/reports','/reports/dashboard','/dashboard'],route(async(req,res)=>{
  const summary=(await query(`SELECT
    (SELECT COUNT(*) FROM app.achievements WHERE owner_user_id=$1 AND deleted_at IS NULL) AS achievementCount,
    (SELECT COUNT(*) FROM app.kpi_goals WHERE owner_user_id=$1 AND deleted_at IS NULL) AS kpiCount,
    (SELECT COUNT(*) FROM app.cvs WHERE owner_user_id=$1) AS cvCount,
    (SELECT COUNT(*) FROM app.notifications WHERE recipient_user_id=$1 AND read_at IS NULL) AS unreadCount,
    (SELECT COUNT(*) FROM app.assessment_runs WHERE subject_user_id=$1) AS assessmentCount`,[req.user.userId])).rows[0];
  const items=(await query('SELECT TOP(10) id,title,achieved_at AS achievedAt,issuer FROM app.achievements WHERE owner_user_id=$1 AND deleted_at IS NULL ORDER BY achieved_at DESC,id DESC',[req.user.userId])).rows;
  return ok(res,{summary,items,total:summary.achievementCount});
}));
router.get('/selections',route(async(req,res)=>ok(res,{achievementTypes:(await query('SELECT id,code,name FROM app.achievement_types WHERE is_active=1 ORDER BY name')).rows})));
router.post('/ai/export-dossier-zip',route(async(req,res)=>{
  const d=body(z.object({runId:z.number().int().positive()}).strict(),req);
  const run=await one("SELECT * FROM app.assessment_runs WHERE id=$1 AND subject_user_id=$2 AND status='COMPLETED'",[d.runId,req.user.userId]);
  const results=(await query('SELECT * FROM app.criterion_results WHERE run_id=$1',[run.id])).rows;
  const files=(await query(`SELECT DISTINCT f.id,f.storage_key,f.original_filename FROM app.result_evidence e JOIN app.criterion_results r ON r.id=e.criterion_result_id JOIN app.evidence_files f ON f.achievement_id=e.achievement_id JOIN app.achievements a ON a.id=f.achievement_id WHERE r.run_id=$1 AND e.subject_user_id=$2 AND a.owner_user_id=$2 AND f.owner_user_id=$2 AND f.deleted_at IS NULL AND a.deleted_at IS NULL`,[run.id,req.user.userId])).rows;
  const buffers=[];for(const file of files){try{buffers.push({name:`${file.id}-${file.original_filename.replace(/[^\p{L}\p{N}._ -]/gu,'_')}`,buffer:await fs.readFile(filePath(file.storage_key))});}catch{throw new NotFoundError('Một tệp minh chứng không còn trong kho; vui lòng bổ sung trước khi xuất.');}}
  const archive=new ZipArchive({zlib:{level:6}});res.attachment(`ho-so-${run.id}.zip`);archive.on('error',error=>res.destroy(error));archive.pipe(res);
  archive.append(JSON.stringify({run,results},null,2),{name:'ket-qua-kham.json'});for(const file of buffers)archive.append(file.buffer,{name:file.name});await archive.finalize();
}));
function xml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');}
router.get('/me/cv/export-docx',route(async(req,res)=>{
  const profile=await one('SELECT TOP(1) c.*,p.full_name FROM app.cvs c JOIN app.person_profiles p ON p.user_id=c.owner_user_id WHERE c.owner_user_id=$1 ORDER BY c.id',[req.user.userId]);
  const items=(await query('SELECT a.title,a.achieved_at FROM app.cv_achievements ca JOIN app.achievements a ON a.id=ca.achievement_id WHERE ca.cv_id=$1 AND a.owner_user_id=$2 AND a.deleted_at IS NULL ORDER BY ca.sort_order',[profile.id,req.user.userId])).rows;
  const paragraphs=[profile.full_name,parseJson(profile.content_json).headline||'',profile.introduction||'',...items.map(a=>`${a.title} (${a.achieved_at})`)];
  const zip=new PizZip();zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map(p=>`<w:p><w:r><w:t xml:space="preserve">${xml(p)}</w:t></w:r></w:p>`).join('')}<w:sectPr/></w:body></w:document>`);
  res.attachment('CV-ca-nhan.docx').type('application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(zip.generate({type:'nodebuffer'}));
}));
export default router;
