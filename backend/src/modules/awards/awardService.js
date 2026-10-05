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
export class AwardService {
 constructor({ pool = getPool, adapter = storage, scope = isUnitInUserScope, audit = recordAuditLog, roles = getActiveRoles, notify = notifyStatusChanged } = {}) { Object.assign(this, { pool, storage: adapter, scope, audit, roles, notify }); }
 async authorize(user, unit) {
  if (!user?.userId || !(await this.roles(user.userId)).some(r => (typeof r === 'string' ? r : r.Code || r.code) === 'RECORDS_OFFICER')) throw new ForbiddenError('Cần vai trò RecordsOfficer hiệu lực');
  if (unit && !await this.scope(user.userId, unit, 'RECORDS_OFFICER')) throw new OutOfScopeError();
 }
 async transaction(user, action, fn) {
  const c = await this.pool().connect();
  try { await c.query('BEGIN'); const result = await fn(c); await this.audit({ userId: user.userId, action, entityName: 'awards', entityId: result.record_id || result.decision_id, newValues: result, client: c, throwOnError: true }); await c.query('COMMIT'); return result; }
  catch (e) { await c.query('ROLLBACK'); if (e.code === '23505') throw new ConflictError('Trùng chủ thể–loại–quyết định hoặc số quyết định'); if (e.code === '23503') throw new ValidationError('Tham chiếu không tồn tại'); throw e; } finally { c.release(); }
 }
 async createDecision(body, user) {
  await this.authorize(user); const b = decisionSchema.parse(body);
  return this.transaction(user, 'CREATE_AWARD_DECISION', async c => (await c.query('INSERT INTO app.award_decisions(decision_number,decision_date,issuer,title,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *', [b.decisionNumber,b.decisionDate,b.issuer,b.title,user.userId])).rows[0]);
 }
 async createRecord(body, user) {
  const b = recordSchema.parse(body); await this.authorize(user);
  return this.transaction(user, 'CREATE_AWARD_RECORD', async c => {
   let unit = b.organizationUnitId;
   if (b.lecturerId) { const a = (await c.query(`SELECT la.unit_id FROM app.lecturer_assignments la JOIN app.lecturers l USING(lecturer_id) WHERE la.lecturer_id=$1 AND l.is_active=TRUE AND la.is_primary=TRUE AND la.valid_from<=NOW() AND (la.valid_to IS NULL OR la.valid_to>NOW())`, [b.lecturerId])).rows; if (a.length !== 1) throw new ValidationError('Cá nhân cần đúng một đơn vị công tác chính hiệu lực'); unit = a[0].unit_id; }
   await this.authorize(user,unit);
   const type = (await c.query('SELECT * FROM app.award_types WHERE award_type_id=$1 AND is_active=TRUE',[b.awardTypeId])).rows[0];
   if (!type || !['BOTH',b.lecturerId ? 'LECTURER' : 'UNIT'].includes(type.applicable_subject_type)) throw new ValidationError('Loại khen thưởng không áp dụng cho chủ thể');
   if (b.replacesAwardRecordId) { const old = (await c.query('SELECT * FROM app.award_records WHERE record_id=$1 FOR UPDATE',[b.replacesAwardRecordId])).rows[0]; if (!old || old.status !== 'REVOKED' || String(old.lecturer_id || '') !== String(b.lecturerId || '') || String(old.unit_id || '') !== String(b.organizationUnitId || '')) throw new ValidationError('Bản thay thế phải cùng chủ thể với bản đã thu hồi'); await this.authorize(user,old.context_unit_id); }
   const r = (await c.query(`INSERT INTO app.award_records(lecturer_id,unit_id,context_unit_id,award_type_id,decision_id,recognition_year,created_by,replaces_award_record_id,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT') RETURNING *`, [b.lecturerId || null,b.organizationUnitId || null,unit,b.awardTypeId,b.decisionId,b.recognitionYear,user.userId,b.replacesAwardRecordId || null])).rows[0];
   for (const aid of new Set(b.achievementIds)) { const a = (await c.query('SELECT * FROM app.achievements WHERE achievement_id=$1',[aid])).rows[0]; if (!a || String(a.lecturer_id || '') !== String(b.lecturerId || '') || String(a.unit_id || '') !== String(b.organizationUnitId || '')) throw new ValidationError('Thành tích phải cùng chủ thể'); await this.authorize(user,a.context_unit_id); await c.query('INSERT INTO app.award_record_achievements VALUES($1,$2,$3)',[r.record_id,aid,user.userId]); }
   await c.query("INSERT INTO app.award_record_histories(record_id,to_status,actor_id) VALUES($1,'DRAFT',$2)",[r.record_id,user.userId]); return r;
  });
 }
 async getRecord(rawId,user,c = this.pool(),lock = false) {
  await this.authorize(user); const r = (await c.query(`SELECT * FROM app.award_records WHERE record_id=$1 AND decision_id IS NOT NULL ${lock ? 'FOR UPDATE' : ''}`, [id.parse(rawId)])).rows[0];
  if (!r) throw new NotFoundError(); await this.authorize(user,r.context_unit_id); return r;
 }
 async transition(rawId,body,user,target) {
  const b = transitionSchema.parse(body); await this.authorize(user);
  return this.transaction(user, 'AWARD_'+target, async c => {
   const r = await this.getRecord(rawId,user,c,true);
   if (String(r.version) !== String(b.version) || r.status !== (target === 'RECORDED' ? 'DRAFT' : 'RECORDED')) throw new ConflictError('Sai trạng thái hoặc phiên bản');
   if (target === 'REVOKED' && !b.reason) throw new ValidationError('Thu hồi cần lý do');
   await c.query('SELECT decision_id FROM app.award_decisions WHERE decision_id=$1 FOR UPDATE',[r.decision_id]);
   if (target === 'RECORDED') { const f = (await c.query('SELECT storage_key FROM app.award_decision_files WHERE decision_id=$1 ORDER BY version_no DESC LIMIT 1',[r.decision_id])).rows[0]; if (!f || !await this.storage.fileExists(f.storage_key)) throw new ValidationError('Cần file quyết định tồn tại trong kho private'); }
   const updated = (await c.query(`UPDATE app.award_records SET status=$2::varchar,version=version+1,updated_at=NOW(),recorded_by=CASE WHEN $2::varchar='RECORDED' THEN $3 ELSE recorded_by END,recorded_at=CASE WHEN $2::varchar='RECORDED' THEN NOW() ELSE recorded_at END WHERE record_id=$1 RETURNING *`,[r.record_id,target,user.userId])).rows[0];
   await c.query('INSERT INTO app.award_record_histories(record_id,from_status,to_status,actor_id,reason) VALUES($1,$2,$3,$4,$5)',[r.record_id,r.status,target,user.userId,b.reason || null]);
   await this.notify(c,{entityType:'AWARD',entityId:r.record_id,version:updated.version,fromStatus:r.status,toStatus:target});
   return updated;
  });
 }
 async upload(rawId,file,user) {
  await this.authorize(user); const decisionId = id.parse(rawId); const meta = validateUploadedFile(file); const key = `awards/${decisionId}/${crypto.randomUUID()}${meta.fileExtension}`;
  let saved = false;
  try { return await this.transaction(user,'UPLOAD_AWARD_DECISION_FILE',async c => {
   if (!(await c.query('SELECT * FROM app.award_decisions WHERE decision_id=$1 FOR UPDATE',[decisionId])).rows[0]) throw new NotFoundError();
   const records = (await c.query('SELECT * FROM app.award_records WHERE decision_id=$1',[decisionId])).rows;
   if (!records.length) throw new ValidationError('Tạo bản nháp trong phạm vi trước khi tải file');
   for (const r of records) { await this.authorize(user,r.context_unit_id); if (r.status !== 'DRAFT') throw new ConflictError('Quyết định đã sử dụng bị khóa'); }
   await this.storage.saveFile(key,file.buffer); saved = true;
   return (await c.query(`INSERT INTO app.award_decision_files(decision_id,version_no,original_file_name,storage_key,mime_type,file_extension,file_size,sha256_hash,uploaded_by) SELECT $1,COALESCE(MAX(version_no),0)+1,$2,$3,$4,$5,$6,$7,$8 FROM app.award_decision_files WHERE decision_id=$1 RETURNING decision_file_id,decision_id,version_no,original_file_name,mime_type,file_size`,[decisionId,meta.originalFileName,key,meta.mimeType,meta.fileExtension,meta.fileSize,meta.sha256Hash,user.userId])).rows[0];
  }); } catch(e) { if(saved) await this.storage.deleteFile(key); throw e; }
 }
 async detail(rawId,user) {
  const r = await this.getRecord(rawId,user); const c = this.pool();
  r.decision = (await c.query('SELECT * FROM app.award_decisions WHERE decision_id=$1',[r.decision_id])).rows[0];
  r.files = (await c.query('SELECT decision_file_id,version_no,original_file_name,mime_type,file_size FROM app.award_decision_files WHERE decision_id=$1 ORDER BY version_no',[r.decision_id])).rows;
  r.histories = (await c.query('SELECT * FROM app.award_record_histories WHERE record_id=$1 ORDER BY history_id',[r.record_id])).rows;
  r.achievementIds = (await c.query('SELECT achievement_id FROM app.award_record_achievements WHERE record_id=$1',[r.record_id])).rows.map(a=>a.achievement_id); return r;
 }
 async list(query,user) {
  const unit = id.parse(query.contextUnitId); await this.authorize(user,unit);
  const page = id.parse(query.page || 1), pageSize = z.coerce.number().int().min(1).max(100).parse(query.pageSize || 20);
  return { items: (await this.pool().query('SELECT * FROM app.award_records WHERE context_unit_id=$1 AND decision_id IS NOT NULL ORDER BY record_id DESC LIMIT $2 OFFSET $3',[unit,pageSize,(page-1)*pageSize])).rows, page, pageSize };
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

