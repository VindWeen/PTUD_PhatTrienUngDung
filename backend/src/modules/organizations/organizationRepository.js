import { query, withTransaction } from '../../utils/dbHelper.js';

export async function listUnits() {
  const result = await query(
    `SELECT u.unit_id AS "unitId", u.code, u.name, u.type, u.parent_id AS "parentId",
            p.name AS "parentName", u.description, u.is_active AS "isActive", u.version
       FROM app.organization_units u
       LEFT JOIN app.organization_units p ON p.unit_id = u.parent_id
      ORDER BY COALESCE(u.parent_id, u.unit_id), u.name`);
  return result.rows;
}

export async function findUnit(unitId) {
  const result = await query(
    `SELECT u.unit_id AS "unitId", u.code, u.name, u.type, u.parent_id AS "parentId",
            p.code AS "parentCode", p.name AS "parentName", u.description,
            u.is_active AS "isActive", u.version
       FROM app.organization_units u
       LEFT JOIN app.organization_units p ON p.unit_id = u.parent_id
      WHERE u.unit_id = $1`, [unitId]);
  return result.rows[0] || null;
}

export async function getCurrentRepresentative(unitId) {
  const result = await query(
    `SELECT r.unit_representative_id AS "unitRepresentativeId", r.user_id AS "userId",
            u.display_name AS "displayName", u.email, r.valid_from AS "appointedFrom", r.valid_to AS "appointedTo"
       FROM app.unit_representatives r JOIN app.users u ON u.user_id = r.user_id
      WHERE r.unit_id = $1 AND r.revoked_at IS NULL AND u.status='ACTIVE'
        AND r.valid_from <= NOW() AND (r.valid_to IS NULL OR r.valid_to > NOW())
        AND EXISTS (SELECT 1 FROM app.user_roles ur JOIN app.roles role ON role.role_id=ur.role_id
          WHERE ur.user_id=r.user_id AND role.code='UNIT_REPRESENTATIVE' AND role.is_active=TRUE
            AND ur.revoked_at IS NULL AND ur.valid_from <= NOW() AND (ur.valid_to IS NULL OR ur.valid_to > NOW()))
      ORDER BY r.valid_from DESC LIMIT 1`, [unitId]);
  return result.rows[0] || null;
}

export async function getUnitStats(unitId) {
  const result = await query(
    `SELECT (SELECT COUNT(*)::int FROM app.lecturer_assignments a
              WHERE a.unit_id = $1 AND a.is_primary = TRUE AND a.valid_from <= NOW()
                AND (a.valid_to IS NULL OR a.valid_to > NOW())) AS "lecturersCount",
            COUNT(*)::int AS "totalAchievements",
            COUNT(*) FILTER (WHERE status = 'VERIFIED')::int AS "verifiedAchievements",
            COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int AS "pendingAchievements",
            COUNT(*) FILTER (WHERE status = 'NEED_CORRECTION')::int AS "needCorrectionAchievements",
            COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS "rejectedAchievements",
            COUNT(*) FILTER (WHERE status = 'REVOKED')::int AS "revokedAchievements",
            COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS "draftAchievements",
            (SELECT COUNT(*)::int FROM app.award_records r WHERE r.unit_id = $1 AND r.status = 'RECORDED') AS "recordedAwards"
       FROM app.achievements WHERE unit_id = $1`, [unitId]);
  return result.rows[0];
}

export async function createUnit(fields) {
  const result = await query(
    `INSERT INTO app.organization_units (code, name, type, parent_id, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING unit_id AS "unitId", code, name, type, parent_id AS "parentId", description, is_active AS "isActive", version`,
    [fields.code, fields.name, fields.type, fields.parentId ?? null, fields.description ?? null]);
  return result.rows[0];
}

export async function updateUnit(unitId, version, fields) {
  const result = await query(
    `UPDATE app.organization_units
        SET code = $1, name = $2, type = $3, parent_id = $4, description = $5,
            is_active = $6, version = version + 1, updated_at = NOW()
      WHERE unit_id = $7 AND version = $8
      RETURNING unit_id AS "unitId", code, name, type, parent_id AS "parentId", description, is_active AS "isActive", version`,
    [fields.code, fields.name, fields.type, fields.parentId ?? null, fields.description ?? null,
      fields.isActive, unitId, version]);
  return result.rows[0] || null;
}

export async function hasDescendant(unitId, candidateParentId) {
  const result = await query(
    `WITH RECURSIVE descendants AS (
       SELECT unit_id FROM app.organization_units WHERE parent_id = $1
       UNION ALL SELECT u.unit_id FROM app.organization_units u JOIN descendants d ON u.parent_id = d.unit_id
     ) SELECT 1 AS found FROM descendants WHERE unit_id = $2 LIMIT 1`, [unitId, candidateParentId]);
  return result.rowCount > 0;
}

export async function getDependencyCounts(unitId) {
  const result = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM app.organization_units WHERE parent_id = $1) AS children,
       (SELECT COUNT(*)::int FROM app.lecturer_assignments WHERE unit_id = $1) AS assignments,
       (SELECT COUNT(*)::int FROM app.achievements WHERE unit_id = $1 OR context_unit_id = $1) AS achievements,
       (SELECT COUNT(*)::int FROM app.award_records WHERE unit_id = $1) AS awards,
       (SELECT COUNT(*)::int FROM app.user_unit_scopes WHERE unit_id = $1) AS scopes,
       (SELECT COUNT(*)::int FROM app.unit_representatives WHERE unit_id = $1) AS representatives`, [unitId]);
  return result.rows[0];
}

export async function deleteUnit(unitId) {
  const result = await query('DELETE FROM app.organization_units WHERE unit_id = $1', [unitId]);
  return result.rowCount > 0;
}

export async function appointRepresentative({ unitId, userId, validFrom, assignedBy }) {
  return withTransaction(async ({ query: txQuery }) => {
    await txQuery(
      `UPDATE app.unit_representatives SET valid_to = $1
        WHERE unit_id = $2 AND revoked_at IS NULL AND valid_from < $1 AND (valid_to IS NULL OR valid_to > $1)`,
      [validFrom, unitId]);
    const result = await txQuery(
      `INSERT INTO app.unit_representatives (unit_id, user_id, valid_from, assigned_by)
       VALUES ($1, $2, $3, $4)
       RETURNING unit_representative_id AS "unitRepresentativeId", unit_id AS "unitId",
                 user_id AS "userId", valid_from AS "validFrom", valid_to AS "validTo"`,
      [unitId, userId, validFrom, assignedBy]);
    return result.rows[0];
  });
}

export async function transferLecturer({ lecturerId, unitId, effectiveAt, assignedBy }) {
  return withTransaction(async ({ query: txQuery }) => {
    const locked = await txQuery('SELECT lecturer_id FROM app.lecturers WHERE lecturer_id = $1 FOR UPDATE', [lecturerId]);
    if (!locked.rowCount) return null;
    await txQuery(
      `UPDATE app.lecturer_assignments SET valid_to = $1
        WHERE lecturer_id = $2 AND is_primary = TRUE AND valid_from < $1
          AND (valid_to IS NULL OR valid_to > $1)`, [effectiveAt, lecturerId]);
    const result = await txQuery(
      `INSERT INTO app.lecturer_assignments
         (lecturer_id, unit_id, is_primary, valid_from, assigned_by)
       VALUES ($1, $2, TRUE, $3, $4)
       RETURNING assignment_id AS "assignmentId", lecturer_id AS "lecturerId", unit_id AS "unitId",
                 valid_from AS "validFrom", valid_to AS "validTo"`,
      [lecturerId, unitId, effectiveAt, assignedBy]);
    return result.rows[0];
  });
}

export default { listUnits, findUnit, getCurrentRepresentative, getUnitStats, createUnit, updateUnit,
  hasDescendant, getDependencyCounts, deleteUnit, appointRepresentative, transferLecturer };
