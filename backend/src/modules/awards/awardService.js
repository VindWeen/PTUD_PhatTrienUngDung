import crypto from 'node:crypto';
import { z } from 'zod';
import { getPool } from '../../config/database.js';
import { isUnitInUserScope, getActiveRoles } from '../auth/authRepository.js';
import { recordAuditLog } from '../audit/auditService.js';
import { notifyStatusChanged } from '../notifications/notificationService.js';
import storage from '../evidences/storage/localStorageAdapter.js';
import { validateUploadedFile } from '../evidences/evidenceValidators.js';
import { ForbiddenError, OutOfScopeError, NotFoundError, ValidationError, ConflictError } from '../../utils/errors.js';

const id = z.coerce.number().int().positive().safe();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v);
export const decisionSchema = z.object({ decisionNumber: z.string().trim().min(1).max(100), decisionDate: date, issuer: z.string().trim().min(1).max(150), title: z.string().trim().min(1).max(255) }).strict();
export const recordSchema = z.object({ lecturerId: id.nullish(), organizationUnitId: id.nullish(), awardTypeId: id, decisionId: id, recognitionYear: z.coerce.number().int().min(1990).max(2100), achievementIds: z.array(id).max(100).default([]), replacesAwardRecordId: id.nullish() }).strict().refine(v => Boolean(v.lecturerId) !== Boolean(v.organizationUnitId), 'Chọn đúng một cá nhân hoặc tập thể');
export const transitionSchema = z.object({ version: id, reason: z.string().trim().max(1000).optional() }).strict();
export const applicationRecordSchema = z.object({ applicationVersion: id, decisionId: id, recognitionYear: z.coerce.number().int().min(1990).max(2100) }).strict();
export class AwardService {
 constructor({ pool = getPool, adapter = storage, scope = isUnitInUserScope, audit = recordAuditLog, roles = getActiveRoles, notify = notifyStatusChanged } = {}) { Object.assign(this, { pool, storage: adapter, scope, audit, roles, notify }); }
 async authorize(user, unit) {
  if (!user?.userId || !(await this.roles(user.userId)).some(r => (typeof r === 'string' ? r : r.Code || r.code) === 'RECORDS_OFFICER')) throw new ForbiddenError('Cần vai trò RecordsOfficer hiệu lực');
  if (unit && !await this.scope(user.userId, unit, 'RECORDS_OFFICER')) throw new OutOfScopeError();
 }
 async transaction(user, action, fn) {
  const c = await this.pool().connect();
  try { await c.query('BEGIN'); const result = await fn(c); await this.audit({ userId: user.userId, action, entityName: 'awards', entityId: result.record_id || result.decision_id || result.application_id || result.award_period_id, newValues: result, client: c, throwOnError: true }); await c.query('COMMIT'); return result; }
  catch (e) { await c.query('ROLLBACK'); if (e.code === '23505') throw new ConflictError('Trùng chủ thể–loại–quyết định hoặc số quyết định'); if (e.code === '23503') throw new ValidationError('Tham chiếu không tồn tại'); throw e; } finally { c.release(); }
 }
 async createDecision(body, user) {
  await this.authorize(user); const b = decisionSchema.parse(body);
  return this.transaction(user, 'CREATE_AWARD_DECISION', async c => (await c.query("INSERT INTO app.award_decisions(decision_number,decision_date,issuer,title,created_by) OUTPUT INSERTED.* VALUES($1,$2,$3,$4,$5)", [b.decisionNumber,b.decisionDate,b.issuer,b.title,user.userId])).rows[0]);
 }
 async createRecord(body, user) {
  const b = recordSchema.parse(body); await this.authorize(user);
  return this.transaction(user, 'CREATE_AWARD_RECORD', async c => {
   let unit = b.organizationUnitId;
   if (b.lecturerId) { const a = (await c.query(`SELECT la.unit_id FROM app.lecturer_assignments la JOIN app.lecturers l ON l.lecturer_id=la.lecturer_id WHERE la.lecturer_id=$1 AND l.is_active=1 AND la.is_primary=1 AND la.valid_from<=SYSUTCDATETIME() AND (la.valid_to IS NULL OR la.valid_to>SYSUTCDATETIME())`, [b.lecturerId])).rows; if (a.length !== 1) throw new ValidationError('Cá nhân cần đúng một đơn vị công tác chính hiệu lực'); unit = a[0].unit_id; }
   await this.authorize(user,unit);
   const type = (await c.query("SELECT * FROM app.award_types WHERE award_type_id=$1 AND is_active=1",[b.awardTypeId])).rows[0];
   if (!type || !['BOTH',b.lecturerId ? 'LECTURER' : 'UNIT'].includes(type.applicable_subject_type)) throw new ValidationError('Loại khen thưởng không áp dụng cho chủ thể');
   if (b.replacesAwardRecordId) { const old = (await c.query("SELECT * FROM app.award_records WITH (UPDLOCK, HOLDLOCK) WHERE record_id=$1",[b.replacesAwardRecordId])).rows[0]; if (!old || old.status !== 'REVOKED' || String(old.lecturer_id || '') !== String(b.lecturerId || '') || String(old.unit_id || '') !== String(b.organizationUnitId || '')) throw new ValidationError('Bản thay thế phải cùng chủ thể với bản đã thu hồi'); await this.authorize(user,old.context_unit_id); }
   const r = (await c.query(`INSERT INTO app.award_records(lecturer_id,unit_id,context_unit_id,award_type_id,decision_id,recognition_year,created_by,replaces_award_record_id,status) OUTPUT INSERTED.* VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT')`, [b.lecturerId || null,b.organizationUnitId || null,unit,b.awardTypeId,b.decisionId,b.recognitionYear,user.userId,b.replacesAwardRecordId || null])).rows[0];
   for (const aid of new Set(b.achievementIds)) { const a = (await c.query('SELECT * FROM app.achievements WHERE achievement_id=$1',[aid])).rows[0]; if (!a || String(a.lecturer_id || '') !== String(b.lecturerId || '') || String(a.unit_id || '') !== String(b.organizationUnitId || '')) throw new ValidationError('Thành tích phải cùng chủ thể'); await this.authorize(user,a.context_unit_id); await c.query('INSERT INTO app.award_record_achievements VALUES($1,$2,$3)',[r.record_id,aid,user.userId]); }
   await c.query("INSERT INTO app.award_record_histories(record_id,to_status,actor_id) VALUES($1,'DRAFT',$2)",[r.record_id,user.userId]); return r;
  });
 }
 async readyApplications(query,user) {
  const unit = id.parse(query.contextUnitId); await this.authorize(user,unit);
  const page = id.parse(query.page || 1), pageSize = z.coerce.number().int().min(1).max(100).parse(query.pageSize || 20);
  const items = (await this.pool().query(`SELECT a.*, COALESCE(l.full_name,u.name) AS subject_name,
   t.name AS award_type_name,p.name AS period_name,i.input_version,
   i.snapshot AS application_snapshot,
   r.record_id AS linked_record_id,r.status AS linked_record_status
   FROM app.award_applications a
   LEFT JOIN app.lecturers l ON l.lecturer_id=a.lecturer_id LEFT JOIN app.organization_units u ON u.unit_id=a.unit_id
   JOIN app.award_types t ON t.award_type_id=a.target_award_type_id JOIN app.award_periods p ON p.award_period_id=a.award_period_id
   CROSS APPLY (SELECT TOP (1) * FROM app.award_application_inputs WHERE application_id=a.application_id ORDER BY input_version DESC) i
   LEFT JOIN app.award_records r ON r.application_id=a.application_id AND r.status IN ('DRAFT','RECORDED')
   WHERE a.context_unit_id=$1 AND a.status='RECOMMENDED' ORDER BY a.application_id DESC OFFSET $3 ROWS FETCH NEXT $2 ROWS ONLY`,[unit,pageSize,(page-1)*pageSize])).rows;
  for (const row of items) {
   const snapshot=typeof row.application_snapshot==='string'?JSON.parse(row.application_snapshot):row.application_snapshot;
   row.achievement_ids=(snapshot.achievements||[]).map(v=>v.record.achievement_id);
   row.achievement_sources=(snapshot.achievements||[]).map(v=>({id:v.record.achievement_id,title:v.record.title,description:v.record.description,recognitionYear:v.record.recognition_year}));
   row.award_record_ids=(snapshot.awards||[]).map(v=>v.record.record_id);delete row.application_snapshot;
  }
  return {items,page,pageSize,hasMore:items.length===pageSize};
 }
 async approvedApplication(c,rawId,user,version) {
  const a = (await c.query("SELECT * FROM app.award_applications WITH (UPDLOCK, HOLDLOCK) WHERE application_id=$1",[id.parse(rawId)])).rows[0];
  if (!a) throw new NotFoundError(); await this.authorize(user,a.context_unit_id);
  if (a.status !== 'RECOMMENDED' || (version !== undefined && String(a.version)!==String(version))) throw new ConflictError('Hồ sơ đã thay đổi hoặc chưa được Hội đồng đề nghị khen thưởng');
  const i = (await c.query("SELECT TOP (1) * FROM app.award_application_inputs WHERE application_id=$1 ORDER BY input_version DESC",[a.application_id])).rows[0];
  const s = i?.snapshot;
  const same = r => String(r.lecturer_id || '')===String(a.lecturer_id || '') && String(r.unit_id || '')===String(a.unit_id || '');
  if (!s || String(s.target?.award_type_id)!==String(a.target_award_type_id) || !Array.isArray(s.achievements) || !s.achievements.length || !Array.isArray(s.awards)) throw new ValidationError('Hồ sơ thiếu bản chụp nguồn hợp lệ đã được xét');
  const target = (await c.query("SELECT * FROM app.award_types WITH (HOLDLOCK) WHERE award_type_id=$1 AND is_active=1",[a.target_award_type_id])).rows[0];
  if (!target || !['BOTH',a.lecturer_id ? 'LECTURER' : 'UNIT'].includes(target.applicable_subject_type)) throw new ValidationError('Loại khen thưởng đã ngừng hoạt động hoặc không áp dụng cho chủ thể');
  const subject = a.lecturer_id
   ? await c.query("SELECT lecturer_id FROM app.lecturers WITH (HOLDLOCK) WHERE lecturer_id=$1 AND is_active=1",[a.lecturer_id])
   : await c.query("SELECT unit_id FROM app.organization_units WITH (HOLDLOCK) WHERE unit_id=$1 AND is_active=1",[a.unit_id]);
  if (!subject.rows.length) throw new ValidationError('Chủ thể không còn hoạt động');
  const achievementIds = s.achievements.map(v=>id.parse(v.record?.achievement_id));
  for (const entry of [...s.achievements].sort((x,y)=>Number(x.record?.achievement_id)-Number(y.record?.achievement_id))) {
   const source = entry.record;
   const current = (await c.query("SELECT * FROM app.achievements WITH (HOLDLOCK) WHERE achievement_id=$1",[source.achievement_id])).rows[0];
   if (!same(source) || !current || !same(current) || current.status!=='VERIFIED') throw new ValidationError('Thành tích trong bản chụp đã thiếu, bị thu hồi hoặc khác chủ thể');
  }
  for (const entry of [...s.awards].sort((x,y)=>Number(x.record?.record_id)-Number(y.record?.record_id))) {
   const source = entry.record;
   const current = (await c.query("SELECT * FROM app.award_records WITH (HOLDLOCK) WHERE record_id=$1",[id.parse(source?.record_id)])).rows[0];
   if (!same(source) || !current || !same(current) || current.status!=='RECORDED') throw new ValidationError('Khen thưởng nguồn trong bản chụp đã thiếu, bị thu hồi hoặc khác chủ thể');
  }
  return {application:a,input:i,achievementIds};
 }
 async createFromApplication(rawId,body,user) {
  const b=applicationRecordSchema.parse(body); await this.authorize(user);
  return this.transaction(user,'CREATE_AWARD_FROM_APPLICATION',async c=>{
   const {application:a,input,achievementIds}=await this.approvedApplication(c,rawId,user,b.applicationVersion);
   if ((await c.query("SELECT record_id FROM app.award_records WHERE application_id=$1 AND status IN ('DRAFT','RECORDED')",[a.application_id])).rows.length) throw new ConflictError('Hồ sơ đã có bản khen thưởng; mở bản hiện có để tiếp tục');
   if (!(await c.query("SELECT decision_id FROM app.award_decisions WITH (HOLDLOCK) WHERE decision_id=$1",[b.decisionId])).rows.length) throw new ValidationError('Quyết định không tồn tại');
   const old=(await c.query("SELECT TOP (1) record_id FROM app.award_records WHERE application_id=$1 AND status='REVOKED' ORDER BY record_id DESC",[a.application_id])).rows[0];
   const r=(await c.query(`INSERT INTO app.award_records(lecturer_id,unit_id,context_unit_id,award_type_id,decision_id,recognition_year,created_by,status,application_id,application_input_version,replaces_award_record_id)
    OUTPUT INSERTED.* VALUES($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9,$10)`,[a.lecturer_id,a.unit_id,a.context_unit_id,a.target_award_type_id,b.decisionId,b.recognitionYear,user.userId,a.application_id,input.input_version,old?.record_id || null])).rows[0];
   for (const aid of new Set(achievementIds)) await c.query('INSERT INTO app.award_record_achievements VALUES($1,$2,$3)',[r.record_id,aid,user.userId]);
   await c.query("INSERT INTO app.award_record_histories(record_id,to_status,actor_id) VALUES($1,'DRAFT',$2)",[r.record_id,user.userId]);
   return r;
  });
 }
 async getRecord(rawId,user,c = this.pool(),lock = false) {
  await this.authorize(user); const r = (await c.query(`SELECT * FROM app.award_records ${lock ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE record_id=$1 AND decision_id IS NOT NULL`, [id.parse(rawId)])).rows[0];
  if (!r) throw new NotFoundError(); await this.authorize(user,r.context_unit_id); return r;
 }
 async transition(rawId,body,user,target) {
  const b = transitionSchema.parse(body); await this.authorize(user);
  return this.transaction(user, 'AWARD_'+target, async c => {
   const r = await this.getRecord(rawId,user,c,true);
   if (String(r.version) !== String(b.version) || r.status !== (target === 'RECORDED' ? 'DRAFT' : 'RECORDED')) throw new ConflictError('Sai trạng thái hoặc phiên bản');
   if (target === 'REVOKED' && !b.reason) throw new ValidationError('Thu hồi cần lý do');
   if (target === 'RECORDED' && r.application_id) {
    const {application:a,input,achievementIds}=await this.approvedApplication(c,r.application_id,user);
    const linked=(await c.query('SELECT achievement_id FROM app.award_record_achievements WHERE record_id=$1',[r.record_id])).rows.map(v=>String(v.achievement_id)).sort();
    if (String(r.application_input_version)!==String(input.input_version) || String(r.award_type_id)!==String(a.target_award_type_id) || String(r.context_unit_id)!==String(a.context_unit_id) || String(r.lecturer_id || '')!==String(a.lecturer_id || '') || String(r.unit_id || '')!==String(a.unit_id || '') || JSON.stringify(linked)!==JSON.stringify([...new Set(achievementIds.map(String))].sort())) throw new ConflictError('Bản khen thưởng không khớp hồ sơ đã được xét');
   }
   await c.query("SELECT decision_id FROM app.award_decisions WITH (UPDLOCK, HOLDLOCK) WHERE decision_id=$1",[r.decision_id]);
   if (target === 'RECORDED') { const f = (await c.query("SELECT TOP (1) storage_key FROM app.award_decision_files WHERE decision_id=$1 ORDER BY version_no DESC",[r.decision_id])).rows[0]; if (!f || !await this.storage.fileExists(f.storage_key)) throw new ValidationError('Cần file quyết định tồn tại trong kho private'); }
   const updated = (await c.query(`UPDATE app.award_records SET status=CAST($2 AS NVARCHAR(30)),version=version+1,updated_at=SYSUTCDATETIME(),recorded_by=CASE WHEN CAST($2 AS NVARCHAR(30))='RECORDED' THEN $3 ELSE recorded_by END,recorded_at=CASE WHEN CAST($2 AS NVARCHAR(30))='RECORDED' THEN SYSUTCDATETIME() ELSE recorded_at END OUTPUT INSERTED.* WHERE record_id=$1`,[r.record_id,target,user.userId])).rows[0];
   await c.query('INSERT INTO app.award_record_histories(record_id,from_status,to_status,actor_id,reason) VALUES($1,$2,$3,$4,$5)',[r.record_id,r.status,target,user.userId,b.reason || null]);
   await this.notify(c,{entityType:'AWARD',entityId:r.record_id,version:updated.version,fromStatus:r.status,toStatus:target});
   return updated;
  });
 }
 async upload(rawId,file,user) {
  await this.authorize(user); const decisionId = id.parse(rawId); const meta = validateUploadedFile(file); const key = `awards/${decisionId}/${crypto.randomUUID()}${meta.fileExtension}`;
  let saved = false;
  try { return await this.transaction(user,'UPLOAD_AWARD_DECISION_FILE',async c => {
   if (!(await c.query("SELECT * FROM app.award_decisions WITH (UPDLOCK, HOLDLOCK) WHERE decision_id=$1",[decisionId])).rows[0]) throw new NotFoundError();
   const records = (await c.query('SELECT * FROM app.award_records WHERE decision_id=$1',[decisionId])).rows;
   if (!records.length) throw new ValidationError('Tạo bản nháp trong phạm vi trước khi tải file');
   for (const r of records) { await this.authorize(user,r.context_unit_id); if (r.status !== 'DRAFT') throw new ConflictError('Quyết định đã sử dụng bị khóa'); }
   await this.storage.saveFile(key,file.buffer); saved = true;
   return (await c.query(`INSERT INTO app.award_decision_files(decision_id,version_no,original_file_name,storage_key,mime_type,file_extension,file_size,sha256_hash,uploaded_by) OUTPUT INSERTED.decision_file_id, INSERTED.decision_id, INSERTED.version_no, INSERTED.original_file_name, INSERTED.mime_type, INSERTED.file_size SELECT $1,COALESCE(MAX(version_no),0)+1,$2,$3,$4,$5,$6,$7,$8 FROM app.award_decision_files WHERE decision_id=$1`,[decisionId,meta.originalFileName,key,meta.mimeType,meta.fileExtension,meta.fileSize,meta.sha256Hash,user.userId])).rows[0];
  }); } catch(e) { if(saved) await this.storage.deleteFile(key); throw e; }
 }
 async detail(rawId,user) {
  const r = await this.getRecord(rawId,user); const c = this.pool();
  r.subject_name = r.lecturer_id ? (await c.query('SELECT full_name FROM app.lecturers WHERE lecturer_id=$1',[r.lecturer_id])).rows[0]?.full_name : (await c.query('SELECT name FROM app.organization_units WHERE unit_id=$1',[r.unit_id])).rows[0]?.name;
  r.decision = (await c.query('SELECT * FROM app.award_decisions WHERE decision_id=$1',[r.decision_id])).rows[0];
  r.files = (await c.query('SELECT decision_file_id,version_no,original_file_name,mime_type,file_size FROM app.award_decision_files WHERE decision_id=$1 ORDER BY version_no',[r.decision_id])).rows;
  r.histories = (await c.query('SELECT * FROM app.award_record_histories WHERE record_id=$1 ORDER BY history_id',[r.record_id])).rows;
  r.achievementIds = (await c.query('SELECT achievement_id FROM app.award_record_achievements WHERE record_id=$1',[r.record_id])).rows.map(a=>a.achievement_id); return r;
 }
 async list(query,user) {
  const unit = id.parse(query.contextUnitId); await this.authorize(user,unit);
  const page = id.parse(query.page || 1), pageSize = z.coerce.number().int().min(1).max(100).parse(query.pageSize || 20);
  const items = (await this.pool().query("SELECT * FROM app.award_records WHERE context_unit_id=$1 AND decision_id IS NOT NULL ORDER BY record_id DESC OFFSET $3 ROWS FETCH NEXT $2 ROWS ONLY",[unit,pageSize,(page-1)*pageSize])).rows;
  return { items, page, pageSize, hasMore: items.length === pageSize };
 }
 async download(rawId,user) {
  await this.authorize(user); const f = (await this.pool().query('SELECT * FROM app.award_decision_files WHERE decision_file_id=$1',[id.parse(rawId)])).rows[0]; if(!f) throw new NotFoundError();
  const records = (await this.pool().query('SELECT context_unit_id FROM app.award_records WHERE decision_id=$1',[f.decision_id])).rows;
  let allowed = false; for(const r of records) if(await this.scope(user.userId,r.context_unit_id,'RECORDS_OFFICER')) allowed = true;
  if(!allowed) throw new OutOfScopeError(); if(!await this.storage.fileExists(f.storage_key)) throw new NotFoundError('Không tìm thấy file private');
  return { file: f, stream: this.storage.getFileStream(f.storage_key) };
 }
}
export default new AwardService();

