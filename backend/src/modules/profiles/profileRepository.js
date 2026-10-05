import { query } from '../../utils/dbHelper.js';

const iso = (value) => value instanceof Date ? value.toISOString() : value;

export async function findLecturerById(lecturerId) {
  const result = await query(
    `SELECT lecturer_id AS "lecturerId", user_id AS "userId", employee_code AS "employeeCode",
            full_name AS "fullName", email, phone, title, degree, is_active AS "isActive",
            updated_at AS "updatedAt", version
       FROM app.lecturers WHERE lecturer_id = $1`, [lecturerId]);
  return result.rows[0] || null;
}

export async function findLecturerByUserId(userId) {
  const result = await query(
    `SELECT lecturer_id AS "lecturerId" FROM app.lecturers WHERE user_id = $1 AND is_active = TRUE`, [userId]);
  return result.rows[0] || null;
}

export async function getWorkHistory(lecturerId) {
  const result = await query(
    `SELECT a.assignment_id AS "assignmentId", a.unit_id AS "unitId", u.code AS "unitCode",
            u.name AS "unitName", p.name AS "parentUnitName", a.is_primary AS "isPrimary",
            a.valid_from AS "validFrom", a.valid_to AS "validTo"
       FROM app.lecturer_assignments a
       JOIN app.organization_units u ON u.unit_id = a.unit_id
       LEFT JOIN app.organization_units p ON p.unit_id = u.parent_id
      WHERE a.lecturer_id = $1 ORDER BY a.valid_from DESC`, [lecturerId]);
  return result.rows.map((row) => ({ ...row, validFrom: iso(row.validFrom), validTo: iso(row.validTo) }));
}

export async function getTitlesAndHonors(lecturerId) {
  const result = await query(
    `SELECT r.record_id AS "awardRecordId", COALESCE(t.name, p.name) AS "awardTypeName",
            COALESCE(r.recognition_year, EXTRACT(YEAR FROM r.decision_date)::int) AS "recognitionYear",
            COALESCE(t.level, 'UNIVERSITY') AS level, COALESCE(d.decision_number,r.decision_number) AS "decisionNumber",
            COALESCE(d.decision_date,r.decision_date) AS "decisionDate", r.status
       FROM app.award_records r
       LEFT JOIN app.award_periods p ON p.award_period_id = r.award_period_id
       LEFT JOIN app.award_decisions d ON d.decision_id = r.decision_id
       LEFT JOIN app.award_types t ON t.award_type_id = r.award_type_id
      WHERE r.lecturer_id = $1 AND r.status IN ('RECORDED','REVOKED') ORDER BY COALESCE(d.decision_date,r.decision_date) DESC`, [lecturerId]);
  return result.rows;
}

export async function getProfileStats(lecturerId) {
  const result = await query(
    `SELECT COUNT(*)::int AS "totalAchievements",
            COUNT(*) FILTER (WHERE status = 'VERIFIED')::int AS "verifiedAchievements",
            COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'UNDER_REVIEW'))::int AS "pendingAchievements",
            COUNT(*) FILTER (WHERE status = 'NEED_CORRECTION')::int AS "needCorrectionAchievements",
            COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS "rejectedAchievements",
            COUNT(*) FILTER (WHERE status = 'REVOKED')::int AS "revokedAchievements",
            COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS "draftAchievements",
            (SELECT COUNT(*)::int FROM app.award_records r WHERE r.lecturer_id = $1 AND r.status = 'RECORDED') AS "recordedAwards"
       FROM app.achievements WHERE lecturer_id = $1`, [lecturerId]);
  return result.rows[0];
}

export async function updateLecturer(lecturerId, version, fields) {
  const result = await query(
    `UPDATE app.lecturers SET phone = $1, title = $2, degree = $3,
            updated_at = NOW(), version = version + 1
      WHERE lecturer_id = $4 AND version = $5
      RETURNING lecturer_id AS "lecturerId", user_id AS "userId", employee_code AS "employeeCode",
                full_name AS "fullName", email, phone, title, degree, is_active AS "isActive",
                updated_at AS "updatedAt", version`,
    [fields.phone ?? null, fields.title ?? null, fields.degree ?? null, lecturerId, version]);
  return result.rows[0] || null;
}

export default { findLecturerById, findLecturerByUserId, getWorkHistory, getTitlesAndHonors, getProfileStats, updateLecturer };
