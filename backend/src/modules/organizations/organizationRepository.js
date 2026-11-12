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
    `SELECT TOP (1) r.unit_representative_id AS "unitRepresentativeId", r.user_id AS "userId",
            u.display_name AS "displayName", u.email, r.valid_from AS "appointedFrom", r.valid_to AS "appointedTo"
       FROM app.unit_representatives r JOIN app.users u ON u.user_id = r.user_id
      WHERE r.unit_id = $1 AND r.revoked_at IS NULL AND u.status='ACTIVE'
        AND r.valid_from <= SYSUTCDATETIME() AND (r.valid_to IS NULL OR r.valid_to > SYSUTCDATETIME())
        AND EXISTS (SELECT 1 FROM app.user_roles ur JOIN app.roles role ON role.role_id=ur.role_id
          WHERE ur.user_id=r.user_id AND role.code='UNIT_REPRESENTATIVE' AND role.is_active=1
            AND ur.revoked_at IS NULL AND ur.valid_from <= SYSUTCDATETIME() AND (ur.valid_to IS NULL OR ur.valid_to > SYSUTCDATETIME()))
      ORDER BY r.valid_from DESC`, [unitId]);
  return result.rows[0] || null;
}

export async function getUnitStats(unitId) {
  const result = await query(
    `SELECT (SELECT COUNT(*) FROM app.lecturer_assignments a
              WHERE a.unit_id = $1 AND a.is_primary = 1 AND a.valid_from <= SYSUTCDATETIME()
                AND (a.valid_to IS NULL OR a.valid_to > SYSUTCDATETIME())) AS "lecturersCount",
            COUNT(*) AS "totalAchievements",
            COUNT(CASE WHEN status = 'VERIFIED' THEN 1 END) AS "verifiedAchievements",
            COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) AS "pendingAchievements",
            COUNT(CASE WHEN status = 'NEED_CORRECTION' THEN 1 END) AS "needCorrectionAchievements",
            COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) AS "rejectedAchievements",
            COUNT(CASE WHEN status = 'REVOKED' THEN 1 END) AS "revokedAchievements",
            COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) AS "draftAchievements",
            (SELECT COUNT(*) FROM app.award_records r WHERE r.unit_id = $1 AND r.status = 'RECORDED') AS "recordedAwards"
       FROM app.achievements WHERE unit_id = $1`, [unitId]);
  return result.rows[0];
}

export async function createUnit(fields) {
  const result = await query(
    `DECLARE @changed TABLE (id bigint); INSERT INTO app.organization_units (code, name, type, parent_id, description)
     OUTPUT INSERTED.unit_id INTO @changed VALUES ($1, $2, $3, $4, $5); SELECT resultRow.unit_id AS "unitId", resultRow.code, resultRow.name, resultRow.type, resultRow.parent_id AS "parentId", resultRow.description, resultRow.is_active AS "isActive", resultRow.version FROM app.organization_units resultRow JOIN @changed changed ON changed.id=resultRow.unit_id`,
    [fields.code, fields.name, fields.type, fields.parentId ?? null, fields.description ?? null]);
  return result.rows[0];
}

export async function updateUnit(unitId, version, fields) {
  const result = await query(
    `DECLARE @changed TABLE (id bigint); UPDATE app.organization_units
        SET code = $1, name = $2, type = $3, parent_id = $4, description = $5,
            is_active = $6, version = version + 1, updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.unit_id INTO @changed WHERE unit_id = $7 AND version = $8; SELECT resultRow.unit_id AS "unitId", resultRow.code, resultRow.name, resultRow.type, resultRow.parent_id AS "parentId", resultRow.description, resultRow.is_active AS "isActive", resultRow.version FROM app.organization_units resultRow JOIN @changed changed ON changed.id=resultRow.unit_id`,
    [fields.code, fields.name, fields.type, fields.parentId ?? null, fields.description ?? null,
      fields.isActive, unitId, version]);
  return result.rows[0] || null;
}

export async function hasDescendant(unitId, candidateParentId) {
  const result = await query(
    `WITH descendants AS (
       SELECT unit_id FROM app.organization_units WHERE parent_id = $1
       UNION ALL SELECT u.unit_id FROM app.organization_units u JOIN descendants d ON u.parent_id = d.unit_id
     ) SELECT TOP (1) 1 AS found FROM descendants WHERE unit_id = $2`, [unitId, candidateParentId]);
  return result.rowCount > 0;
}

export async function getDependencyCounts(unitId) {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM app.organization_units WHERE parent_id = $1) AS children,
       (SELECT COUNT(*) FROM app.lecturer_assignments WHERE unit_id = $1) AS assignments,
       (SELECT COUNT(*) FROM app.achievements WHERE unit_id = $1 OR context_unit_id = $1) AS achievements,
       (SELECT COUNT(*) FROM app.award_records WHERE unit_id = $1) AS awards,
       (SELECT COUNT(*) FROM app.user_unit_scopes WHERE unit_id = $1) AS scopes,
       (SELECT COUNT(*) FROM app.unit_representatives WHERE unit_id = $1) AS representatives`, [unitId]);
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
      `DECLARE @changed TABLE (id bigint); INSERT INTO app.unit_representatives (unit_id, user_id, valid_from, assigned_by)
       OUTPUT INSERTED.unit_representative_id INTO @changed VALUES ($1, $2, $3, $4); SELECT resultRow.unit_representative_id AS "unitRepresentativeId", resultRow.unit_id AS "unitId",
                 resultRow.user_id AS "userId", resultRow.valid_from AS "validFrom", resultRow.valid_to AS "validTo" FROM app.unit_representatives resultRow JOIN @changed changed ON changed.id=resultRow.unit_representative_id`,
      [unitId, userId, validFrom, assignedBy]);
    return result.rows[0];
  });
}

export async function transferLecturer({ lecturerId, unitId, effectiveAt, assignedBy }) {
  return withTransaction(async ({ query: txQuery }) => {
    const locked = await txQuery('SELECT lecturer_id FROM app.lecturers WITH (UPDLOCK, HOLDLOCK) WHERE lecturer_id = $1', [lecturerId]);
    if (!locked.rowCount) return null;
    await txQuery(
      `UPDATE app.lecturer_assignments SET valid_to = $1
        WHERE lecturer_id = $2 AND is_primary = 1 AND valid_from < $1
          AND (valid_to IS NULL OR valid_to > $1)`, [effectiveAt, lecturerId]);
    const result = await txQuery(
      `DECLARE @changed TABLE (id bigint); INSERT INTO app.lecturer_assignments
         (lecturer_id, unit_id, is_primary, valid_from, assigned_by)
       OUTPUT INSERTED.assignment_id INTO @changed VALUES ($1, $2, 1, $3, $4); SELECT resultRow.assignment_id AS "assignmentId", resultRow.lecturer_id AS "lecturerId", resultRow.unit_id AS "unitId",
                 resultRow.valid_from AS "validFrom", resultRow.valid_to AS "validTo" FROM app.lecturer_assignments resultRow JOIN @changed changed ON changed.id=resultRow.assignment_id`,
      [lecturerId, unitId, effectiveAt, assignedBy]);
    return result.rows[0];
  });
}

export default { listUnits, findUnit, getCurrentRepresentative, getUnitStats, createUnit, updateUnit,
  hasDescendant, getDependencyCounts, deleteUnit, appointRepresentative, transferLecturer };
