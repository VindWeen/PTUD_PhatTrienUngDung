import { z } from 'zod';
import { query } from '../../utils/dbHelper.js';
import { getActiveRoles } from '../auth/authRepository.js';
import { ForbiddenError, ValidationError } from '../../utils/errors.js';

const id = z.coerce.number().int().positive().safe();
export const reportSchema = z.object({
  kind: z.enum(['ACHIEVEMENT', 'AWARD']).optional(),
  subjectType: z.enum(['LECTURER', 'UNIT']).optional(),
  recognitionYear: z.coerce.number().int().min(1990).max(2100).optional(),
  academicYearId: id.optional(), contextUnitId: id.optional(), typeId: id.optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED', 'RECORDED']).optional(),
  search: z.string().trim().max(200).optional(),
  page: id.default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((v, ctx) => {
  if (v.typeId && !v.kind) ctx.addIssue({ code: 'custom', message: 'typeId cần kind để tránh trùng ID danh mục' });
  if (v.kind === 'AWARD' && v.academicYearId) ctx.addIssue({ code: 'custom', message: 'W2-P2 chưa có năm học trên khen thưởng; không suy diễn từ ngày quyết định' });
});

// Authorization is evaluated in the same SQL statement as the data, from current DB roles.
// UNION (not UNION ALL) also terminates on an accidentally cyclic organization hierarchy.
export function reportQuery(filters, userId) {
  const params = [userId];
  const conditions = [];
  const add = (column, value) => { if (value !== undefined) { params.push(value); conditions.push(`${column}=$${params.length}`); } };
  for (const [field, column] of Object.entries({ kind: 'kind', subjectType: 'subject_type', recognitionYear: 'recognition_year', academicYearId: 'academic_year_id', contextUnitId: 'context_unit_id', typeId: 'type_id', status: 'status' })) add(column, filters[field]);
  if (filters.search) {
    params.push(`%${filters.search.replace(/[\\%_]/g, '\\$&')}%`);
    conditions.push(`(title ILIKE $${params.length} OR subject_name ILIKE $${params.length} OR type_name ILIKE $${params.length} OR decision_number ILIKE $${params.length})`);
  }
  const sql = `WITH RECURSIVE active_roles AS (
    SELECT r.role_id,r.code FROM app.user_roles ur JOIN app.roles r USING(role_id)
    JOIN app.users u ON u.user_id=ur.user_id AND u.status='ACTIVE'
    WHERE ur.user_id=$1 AND r.is_active AND ur.revoked_at IS NULL
      AND ur.valid_from<=NOW() AND (ur.valid_to IS NULL OR ur.valid_to>NOW())
  ), scope_units AS (
    SELECT s.unit_id,s.include_descendants FROM app.user_unit_scopes s
    JOIN active_roles r USING(role_id) JOIN app.organization_units u USING(unit_id)
    WHERE s.user_id=$1 AND r.code IN ('MANAGER','RECORDS_OFFICER') AND u.is_active
      AND s.revoked_at IS NULL AND s.valid_from<=NOW() AND (s.valid_to IS NULL OR s.valid_to>NOW())
    UNION
    SELECT u.unit_id,s.include_descendants FROM app.organization_units u JOIN scope_units s ON u.parent_id=s.unit_id
    WHERE s.include_descendants AND u.is_active
  ), represented_units AS (
    SELECT rep.unit_id FROM app.unit_representatives rep JOIN app.organization_units u USING(unit_id)
    WHERE rep.user_id=$1 AND u.is_active AND rep.revoked_at IS NULL
      AND rep.valid_from<=NOW() AND (rep.valid_to IS NULL OR rep.valid_to>NOW())
      AND EXISTS(SELECT 1 FROM active_roles WHERE code='UNIT_REPRESENTATIVE')
  ), source AS (
    SELECT 'ACHIEVEMENT'::text kind,a.achievement_id id,a.lecturer_id,a.unit_id,a.context_unit_id,
      a.achievement_type_id type_id,t.name type_name,a.title,a.recognition_year,a.academic_year_id,a.status,
      NULL::varchar decision_number FROM app.achievements a LEFT JOIN app.achievement_types t USING(achievement_type_id)
    UNION ALL
    SELECT 'AWARD',a.record_id,a.lecturer_id,a.unit_id,a.context_unit_id,a.award_type_id,t.name,d.title,
      a.recognition_year,NULL::bigint,a.status,d.decision_number
      FROM app.award_records a JOIN app.award_types t USING(award_type_id) JOIN app.award_decisions d USING(decision_id)
  ), visible AS (
    SELECT s.*,CASE WHEN s.lecturer_id IS NULL THEN 'UNIT' ELSE 'LECTURER' END subject_type,
      COALESCE(l.full_name,u.name) subject_name,c.name context_unit_name,ay.code academic_year_code,
      (s.kind='ACHIEVEMENT' AND s.status='VERIFIED' OR s.kind='AWARD' AND s.status='RECORDED') is_valid
    FROM source s LEFT JOIN app.lecturers l USING(lecturer_id)
    LEFT JOIN app.organization_units u ON u.unit_id=s.unit_id
    LEFT JOIN app.organization_units c ON c.unit_id=s.context_unit_id
    LEFT JOIN app.academic_years ay USING(academic_year_id)
    WHERE EXISTS(SELECT 1 FROM active_roles WHERE code='ADMIN')
      OR (l.user_id=$1 AND EXISTS(SELECT 1 FROM active_roles WHERE code='LECTURER'))
      OR s.context_unit_id IN (SELECT unit_id FROM scope_units)
      OR s.unit_id IN (SELECT unit_id FROM represented_units)
  ), filtered AS (SELECT * FROM visible ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''})`;
  return { sql, params };
}

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export const csvColumns = ['kind', 'id', 'subject_type', 'subject_name', 'context_unit_id', 'context_unit_name', 'type_id', 'type_name', 'title', 'recognition_year', 'academic_year_code', 'status', 'is_valid', 'decision_number'];
export function toCsv(rows) { return '\uFEFF' + [csvColumns, ...rows.map(row => csvColumns.map(key => row[key]))].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; }

export async function report(raw, user, exportCsv = false) {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError('Bộ lọc không hợp lệ', parsed.error.flatten());
  const roles = (await getActiveRoles(user.userId)).map(r => r.Code);
  if (!roles.some(r => ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'].includes(r))) throw new ForbiddenError();
  if (exportCsv && !roles.some(r => ['UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'].includes(r))) throw new ForbiddenError('Vai trò hiện tại không có quyền xuất CSV');
  const f = parsed.data;
  const { sql, params } = reportQuery(f, user.userId);
  // Single statement snapshot: page, total and aggregates reconcile even during state changes.
  const result = await query(`${sql}
    SELECT (SELECT COUNT(*)::int FROM filtered) total,
      COALESCE((SELECT jsonb_agg(g) FROM (SELECT kind,subject_type,
        COUNT(*)::int total,COUNT(*) FILTER(WHERE is_valid)::int valid_count,
        COUNT(DISTINCT recognition_year) FILTER(WHERE is_valid)::int distinct_years
        FROM filtered GROUP BY kind,subject_type ORDER BY kind,subject_type) g),'[]'::jsonb) summary,
      COALESCE((SELECT jsonb_agg(p) FROM (SELECT kind,id::text id,lecturer_id::text lecturer_id,unit_id::text unit_id,
        context_unit_id::text context_unit_id,type_id::text type_id,type_name,title,recognition_year,
        academic_year_id::text academic_year_id,status,decision_number,subject_type,subject_name,
        context_unit_name,academic_year_code,is_valid FROM filtered ORDER BY recognition_year DESC NULLS LAST,kind,filtered.id DESC
        ${exportCsv ? '' : `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`}) p),'[]'::jsonb) items`,
    exportCsv ? params : [...params, f.pageSize, (f.page - 1) * f.pageSize]);
  const data = { ...result.rows[0], page: f.page, pageSize: f.pageSize };
  return exportCsv ? toCsv(data.items) : data;
}
