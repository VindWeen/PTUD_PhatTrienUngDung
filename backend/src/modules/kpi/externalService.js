import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { withTransaction } from '../../utils/dbHelper.js';
import { ForbiddenError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { recordAuditLog } from '../audit/auditService.js';
import { activeRolesSql, subject } from './kpiRepository.js';
import { parse, id } from './kpiSchemas.js';
import { pullSource } from './externalConnector.js';

async function access(client,user,admin = false) {
 const roles = (await client.query(activeRolesSql,[user.userId])).rows.map(r=>r.code);
 if (roles.includes('ADMIN')) return { admin: true };
 if (!admin) { const s = await subject(client,user.userId); if (s) return s; }
 throw new ForbiddenError('Cần ADMIN đang hoạt động hoặc giảng viên chính chủ');
}
async function audit(client,user,action,newValues) {
 await recordAuditLog({client,throwOnError:true,userId:user.userId,action:`EXTERNAL_KPI_${action}`,
   entityName:'external_kpi_records',entityId:null,newValues});
}
export async function mapping(user,raw) {
 const p = parse(z.object({employeeId:z.string().trim().min(1).max(80),lecturerId:id}).strict(),raw);
 return withTransaction(async ({client}) => {
   await access(client,user,true);
   const existing = (await client.query('SELECT 1 FROM app.lecturers WHERE lecturer_id=$1 AND is_active',[p.lecturerId])).rows[0];
   if (!existing) throw new NotFoundError('Giảng viên không hoạt động');
   // Immutable identity mapping: do not silently reassign imported records to another person.
   const out = (await client.query(`INSERT INTO app.external_kpi_mappings(employee_id,lecturer_id,created_by)
     VALUES($1,$2,$3) ON CONFLICT(employee_id) DO NOTHING RETURNING *`,[p.employeeId,p.lecturerId,user.userId])).rows[0];
   if (!out) throw new ConflictError('Mã ngoài đã ánh xạ; không được tự gán lại');
   await audit(client,user,'MAP',out); return out;
 });
}
export async function list(user) {
 return withTransaction(async ({client}) => {
   const s = await access(client,user);
   const records = (await client.query(`SELECT * FROM app.external_kpi_records
     WHERE ($1::boolean OR lecturer_id=$2) ORDER BY record_id DESC LIMIT 200`,[!!s.admin,s.lecturer_id || null])).rows;
   const runs = s.admin ? (await client.query('SELECT * FROM app.external_kpi_runs ORDER BY created_at DESC LIMIT 50')).rows : [];
   const mappings = s.admin ? (await client.query('SELECT * FROM app.external_kpi_mappings ORDER BY employee_id LIMIT 500')).rows : [];
   const items = s.admin ? (await client.query(`SELECT i.* FROM app.external_kpi_run_items i
     JOIN (SELECT run_id FROM app.external_kpi_runs ORDER BY created_at DESC LIMIT 50) r USING(run_id)
     ORDER BY run_id,item_index LIMIT 25000`)).rows : [];
   return {records,runs,mappings,items,isAdmin:!!s.admin,isSimulation:true};
 });
}
export async function sync(user,raw = {}) {
 const p = parse(z.object({retryOf:z.string().uuid().optional()}).strict(),raw);
 const runId = randomUUID();
 await withTransaction(async ({client}) => {
   await access(client,user,true);
   if (p.retryOf) {
     const previous = (await client.query('SELECT status FROM app.external_kpi_runs WHERE run_id=$1',[p.retryOf])).rows[0];
     if (!previous) throw new NotFoundError('Không có run');
     if (!['FAILED','COMPLETED'].includes(previous.status)) throw new ConflictError('Run đang chạy');
   }
   await client.query(`INSERT INTO app.external_kpi_runs(run_id,retry_of,created_by,status) VALUES($1,$2,$3,'RUNNING')`,[runId,p.retryOf || null,user.userId]);
 });
 try {
   const source = await pullSource({onAttempt: attempts => withTransaction(async ({client}) => {
     await client.query('UPDATE app.external_kpi_runs SET attempts=$2 WHERE run_id=$1',[runId,attempts]);
   })});
   return await withTransaction(async ({client}) => {
     await access(client,user,true); // Permission can change during the HTTP call.
     await client.query("SELECT pg_advisory_xact_lock(740402)");
     const summary = {imported:0,duplicates:0,quarantined:0,conflicts:0};
     for (const [index,row] of source.items.entries()) {
       const hash = createHash('sha256').update(JSON.stringify(row)).digest('hex');
       let record = (await client.query('SELECT * FROM app.external_kpi_records WHERE external_id=$1 AND source_version=$2 FOR UPDATE',[row.externalId,row.version])).rows[0];
       let outcome;
       if (record && record.payload_hash !== hash) { outcome = 'VERSION_CONFLICT'; summary.conflicts++; }
       else if (record && record.status !== 'QUARANTINED') { outcome = 'DUPLICATE'; summary.duplicates++; }
       else {
         const m = (await client.query(`SELECT m.lecturer_id FROM app.external_kpi_mappings m JOIN app.lecturers l USING(lecturer_id)
           WHERE employee_id=$1 AND l.is_active`,[row.employeeId])).rows[0];
         const ready = m && row.status === 'FINAL';
         const reason = !m ? 'UNMAPPED_EMPLOYEE_ID' : row.status !== 'FINAL' ? 'SOURCE_NOT_FINAL' : null;
         outcome = ready ? 'READY' : 'QUARANTINED';
         if (!record) record = (await client.query(`INSERT INTO app.external_kpi_records(external_id,source_version,payload,payload_hash,lecturer_id,status,reason)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[row.externalId,row.version,row,hash,m?.lecturer_id || null,outcome,reason])).rows[0];
         else record = (await client.query(`UPDATE app.external_kpi_records SET lecturer_id=$2,status=$3,reason=$4,version=version+1
           WHERE record_id=$1 RETURNING *`,[record.record_id,m?.lecturer_id || null,outcome,reason])).rows[0];
         if (ready) summary.imported++; else summary.quarantined++;
       }
       await client.query('INSERT INTO app.external_kpi_run_items(run_id,item_index,record_id,outcome) VALUES($1,$2,$3,$4)',[runId,index,record.record_id,outcome]);
     }
     await client.query("UPDATE app.external_kpi_runs SET status='COMPLETED',summary=$2,finished_at=NOW() WHERE run_id=$1",[runId,summary]);
     await audit(client,user,'SYNC',{runId,summary});
     return {runId,status:'COMPLETED',summary,isSimulation:true};
   });
 } catch (error) {
   // No upstream body, URL, token or SQL error text in persistent logs.
   const code = /^SOURCE_[A-Z0-9_]+$/.test(error.message) ? error.message : 'IMPORT_FAILED';
   await withTransaction(async ({client}) => {
     await client.query("UPDATE app.external_kpi_runs SET status='FAILED',summary=$2,finished_at=NOW() WHERE run_id=$1",[runId,{error:code}]);
   });
   return {runId,status:'FAILED',error:code,isSimulation:true};
 }
}
export async function draft(user,rawId,raw) {
 const recordId = parse(id,rawId);
 const p = parse(z.object({version:id,achievementTypeId:id}).strict(),raw);
 return withTransaction(async ({client}) => {
   const r = (await client.query('SELECT * FROM app.external_kpi_records WHERE record_id=$1 FOR UPDATE',[recordId])).rows[0];
   if (!r) throw new NotFoundError();
   const s = await subject(client,user.userId);
   if (!s || String(s.lecturer_id) !== String(r.lecturer_id)) throw new ForbiddenError('Chỉ giảng viên chính chủ tạo nháp');
   if (r.status !== 'READY' || String(r.version) !== String(p.version)) throw new ConflictError('Nguồn chưa sẵn sàng/đã tạo nháp/version cũ');
   const type = (await client.query("SELECT 1 FROM app.achievement_types WHERE achievement_type_id=$1 AND is_active AND applicable_subject_type IN ('LECTURER','BOTH')",[p.achievementTypeId])).rows[0];
   if (!type) throw new ConflictError('Loại thành tích không hợp lệ');
   const row = r.payload;
   const a = (await client.query(`INSERT INTO app.achievements(lecturer_id,context_unit_id,achievement_type_id,title,description,start_date,end_date,recognition_year,status,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT',$9) RETURNING achievement_id,status,version`,
     [s.lecturer_id,s.context_unit_id,p.achievementTypeId,row.title,
       `MÔ PHỎNG; chưa tích hợp hệ thống bên ngoài thật. Nguồn ${row.externalId}, revision ${row.version}. KPI ${row.code}: ${row.actual}/${row.target} ${row.measureUnit}. ${row.sourceNote}`,
       row.periodStart,row.periodEnd,Number(row.periodEnd.slice(0,4)),user.userId])).rows[0];
   await client.query("UPDATE app.external_kpi_records SET status='DRAFTED',achievement_id=$2,version=version+1 WHERE record_id=$1",[recordId,a.achievement_id]);
   await audit(client,user,'DRAFT',{recordId,achievementId:a.achievement_id,sourceVersion:row.version});
   return a;
 });
}
