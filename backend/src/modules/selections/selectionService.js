import { getPool } from '../../config/database.js';
import { getActiveRoles, getActiveScopes } from '../auth/authRepository.js';
import { ForbiddenError, ValidationError } from '../../utils/errors.js';
import applications from '../awards/applicationService.js';

const allowedRoles = {
  APPLICATION: ['LECTURER','UNIT_REPRESENTATIVE','MANAGER','COUNCIL','RECORDS_OFFICER'],
  AWARD: ['RECORDS_OFFICER'], REPORT: ['LECTURER','UNIT_REPRESENTATIVE','MANAGER','RECORDS_OFFICER','ADMIN'],
  AI: ['LECTURER','UNIT_REPRESENTATIVE','MANAGER','RECORDS_OFFICER','ADMIN'],
  KPI_MAPPING: ['ADMIN'], ORGANIZATION: ['ADMIN'],
};
const workflowRoles = { APPLICATION: ['MANAGER','COUNCIL','RECORDS_OFFICER'], AWARD: ['RECORDS_OFFICER'], REPORT: ['MANAGER','RECORDS_OFFICER'], AI: ['MANAGER'] };
const numberId = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0) throw new ValidationError('Lựa chọn không hợp lệ'); return n; };

// Metadata only; never expose private account fields or widen a mutation's authorization.
export async function options(user, purpose = 'APPLICATION') {
  if (typeof purpose !== 'string' || !Object.hasOwn(allowedRoles,purpose)) throw new ValidationError('Nhóm lựa chọn không hợp lệ');
  const roles = (await getActiveRoles(user.userId)).map(r => typeof r === 'string' ? r : r.Code || r.code);
  if (!roles.some(r => allowedRoles[purpose].includes(r))) throw new ForbiddenError('Không có quyền sử dụng nhóm lựa chọn này');
  const db = getPool();
  const [unitRows, lecturerRows, scopes, reps] = await Promise.all([
    db.query('SELECT unit_id,code,name,parent_id,is_active FROM app.organization_units ORDER BY name,unit_id'),
    db.query(`SELECT l.lecturer_id,l.user_id,l.full_name,l.employee_code,l.is_active,
      la.unit_id,u.name unit_name FROM app.lecturers l JOIN app.users account USING(user_id)
      LEFT JOIN app.lecturer_assignments la ON la.lecturer_id=l.lecturer_id AND la.is_primary AND la.valid_from<=NOW() AND (la.valid_to IS NULL OR la.valid_to>NOW())
      LEFT JOIN app.organization_units u ON u.unit_id=la.unit_id AND u.is_active
      WHERE account.status='ACTIVE' ORDER BY l.full_name,l.lecturer_id`),
    getActiveScopes(user.userId),
    roles.includes('UNIT_REPRESENTATIVE') ? db.query(`SELECT rep.unit_id FROM app.unit_representatives rep JOIN app.organization_units u USING(unit_id)
      WHERE rep.user_id=$1 AND u.is_active AND rep.revoked_at IS NULL AND rep.valid_from<=NOW() AND (rep.valid_to IS NULL OR rep.valid_to>NOW())`, [user.userId]) : { rows: [] },
  ]);
  const units = unitRows.rows.map(u => ({ id: Number(u.unit_id), code: u.code, name: u.name, parentId: u.parent_id ? Number(u.parent_id) : null, active: u.is_active }));
  const represented = new Set(reps.rows.map(r => Number(r.unit_id)));
  const scoped = new Set();
  for (const s of scopes.filter(s => (workflowRoles[purpose] || []).includes(s.roleCode) && roles.includes(s.roleCode))) {
    scoped.add(Number(s.unitId));
    if (s.includeDescendants) {
      const queue = [Number(s.unitId)];
      const visited = new Set(queue);
      while (queue.length) {
        const parent = queue.shift();
        for (const u of units.filter(u => u.active && u.parentId === parent)) {
          if (!visited.has(u.id)) { visited.add(u.id); scoped.add(u.id); queue.push(u.id); }
        }
      }
    }
  }
  const fullAccess = roles.includes('ADMIN') && ['REPORT','AI','KPI_MAPPING','ORGANIZATION'].includes(purpose);
  const permittedUnits = new Set(fullAccess ? units.filter(u => u.active || purpose === 'REPORT').map(u => u.id) : [...scoped, ...represented]);
  if (purpose === 'REPORT') {
    const historical = await db.query(`SELECT context_unit_id FROM app.achievements WHERE lecturer_id IN (SELECT lecturer_id FROM app.lecturers WHERE user_id=$1)
      UNION SELECT context_unit_id FROM app.award_records WHERE lecturer_id IN (SELECT lecturer_id FROM app.lecturers WHERE user_id=$1)`, [user.userId]);
    if (roles.includes('LECTURER')) for (const u of historical.rows) permittedUnits.add(Number(u.context_unit_id));
  }
  const visibleLecturers = lecturerRows.rows.filter(l => l.is_active && (
    fullAccess || (purpose === 'APPLICATION' ? roles.includes('LECTURER') && Number(l.user_id) === Number(user.userId)
      : (purpose !== 'AWARD' && Number(l.user_id) === Number(user.userId)) || (l.unit_id && scoped.has(Number(l.unit_id))))));
  const lecturers = [...new Map(visibleLecturers.map(l => [Number(l.lecturer_id), {
    id: Number(l.lecturer_id), name: l.full_name, employeeCode: l.employee_code,
    unitId: l.unit_id ? Number(l.unit_id) : null, unitName: l.unit_name,
  }])).values()];
  if (purpose === 'REPORT') for (const l of lecturers) if (l.unitId) permittedUnits.add(l.unitId);
  const subjectUnits = units.filter(u => u.active && (purpose === 'APPLICATION' ? represented.has(u.id) : fullAccess || permittedUnits.has(u.id)));
  const [awardTypes, achievementTypes, academicYears, decisions, users] = await Promise.all([
    db.query(`SELECT award_type_id AS id,name,code,applicable_subject_type AS "subjectType",is_active AS active FROM app.award_types ${purpose === 'REPORT' ? '' : 'WHERE is_active'} ORDER BY name`),
    db.query(`SELECT achievement_type_id AS id,name,code,applicable_subject_type AS "subjectType",is_active AS active FROM app.achievement_types ${purpose === 'REPORT' ? '' : 'WHERE is_active'} ORDER BY name`),
    db.query('SELECT academic_year_id AS id,name,code,is_current AS current FROM app.academic_years ORDER BY start_date DESC'),
    purpose === 'AWARD' ? db.query(`SELECT DISTINCT d.decision_id AS id,d.decision_number AS "decisionNumber",d.title,d.decision_date::text AS date
      FROM app.award_decisions d LEFT JOIN app.award_records r USING(decision_id)
      WHERE d.created_by=$1 OR r.context_unit_id=ANY($2::bigint[]) ORDER BY date DESC,id DESC`, [user.userId,[...scoped]]) : { rows: [] },
    purpose === 'ORGANIZATION' ? db.query(`SELECT u.user_id AS id,u.display_name AS name,u.username FROM app.users u WHERE u.status='ACTIVE'
      AND EXISTS(SELECT 1 FROM app.user_roles ur JOIN app.roles r USING(role_id) WHERE ur.user_id=u.user_id AND r.code='UNIT_REPRESENTATIVE' AND r.is_active AND ur.revoked_at IS NULL AND ur.valid_from<=NOW() AND (ur.valid_to IS NULL OR ur.valid_to>NOW())) ORDER BY u.display_name`) : { rows: [] },
  ]);
  const numericRows = rows => rows.map(r => ({ ...r, id: Number(r.id) }));
  return { lecturers, subjectUnits, units: units.filter(u => permittedUnits.has(u.id) && (u.active || purpose === 'REPORT')),
    workflowUnits: units.filter(u => u.active && scoped.has(u.id)),
    awardTypes: numericRows(awardTypes.rows), achievementTypes: numericRows(achievementTypes.rows), academicYears: numericRows(academicYears.rows),
    decisions: numericRows(decisions.rows), users: numericRows(users.rows) };
}

export async function sources(user, { purpose = 'APPLICATION', subjectType, subjectId }) {
  if (!['APPLICATION','AWARD'].includes(purpose) || !['LECTURER','UNIT'].includes(subjectType)) throw new ValidationError('Chủ thể không hợp lệ');
  const id = numberId(subjectId);
  const available = await options(user, purpose);
  const subjects = subjectType === 'LECTURER' ? available.lecturers : available.subjectUnits;
  if (!subjects.some(s => s.id === id)) throw new ForbiddenError('Chủ thể ngoài quyền lựa chọn');
  const column = subjectType === 'LECTURER' ? 'lecturer_id' : 'unit_id';
  const db = getPool();
  const [achievements, records] = await Promise.all([
    db.query(`SELECT achievement_id AS id,title,recognition_year AS year,status FROM app.achievements
      WHERE ${column}=$1 ${purpose === 'APPLICATION' ? "AND status='VERIFIED'" : ''} ORDER BY recognition_year DESC,achievement_id DESC`, [id]),
    db.query(`SELECT r.record_id AS id,r.status,r.recognition_year AS year,d.title,d.decision_number AS "decisionNumber"
      FROM app.award_records r JOIN app.award_decisions d USING(decision_id)
      WHERE r.${column}=$1 AND r.status=${purpose === 'APPLICATION' ? "'RECORDED'" : "'REVOKED'"} ORDER BY r.recognition_year DESC,r.record_id DESC`, [id]),
  ]);
  // Award sources must also be within the officer's historical scope, not only the current assignment.
  const scoped = new Set(available.workflowUnits.map(u => u.id));
  if (purpose === 'AWARD') {
    const historical = await db.query(`SELECT achievement_id,context_unit_id FROM app.achievements WHERE ${column}=$1`, [id]);
    const visible = new Set(historical.rows.filter(r => scoped.has(Number(r.context_unit_id))).map(r => Number(r.achievement_id)));
    achievements.rows = achievements.rows.filter(r => visible.has(Number(r.id)));
    const oldRecords = await db.query(`SELECT record_id,context_unit_id FROM app.award_records WHERE ${column}=$1`, [id]);
    const visibleRecords = new Set(oldRecords.rows.filter(r => scoped.has(Number(r.context_unit_id))).map(r => Number(r.record_id)));
    records.rows = records.rows.filter(r => visibleRecords.has(Number(r.id)));
  }
  return { achievements: achievements.rows.map(r => ({ ...r,id:Number(r.id) })), awardRecords: records.rows.map(r => ({ ...r,id:Number(r.id) })) };
}

export async function reviewers(user, applicationId) {
  const db = getPool();
  const r = await applications.get(numberId(applicationId), user, db);
  await applications.council(user, r, db);
  const candidates = (await db.query(`SELECT u.user_id,u.display_name,u.username,
    EXISTS(SELECT 1 FROM app.application_reviews WHERE application_id=$1 AND reviewer_id=u.user_id) AS assigned
    FROM app.users u WHERE u.status='ACTIVE' AND EXISTS(SELECT 1 FROM app.user_roles ur JOIN app.roles role USING(role_id)
      WHERE ur.user_id=u.user_id AND role.code='COUNCIL' AND role.is_active AND ur.revoked_at IS NULL AND ur.valid_from<=NOW() AND (ur.valid_to IS NULL OR ur.valid_to>NOW())) ORDER BY u.display_name`, [r.application_id])).rows;
  const visible = [];
  for (const u of candidates) {
    try { await applications.council({userId:Number(u.user_id)}, r, db); }
    catch (e) { if (e instanceof ForbiddenError) continue; throw e; }
    visible.push({ id:Number(u.user_id),name:u.display_name,username:u.username,assigned:u.assigned });
  }
  return visible;
}
