// All identifiers below are fixed; user data is always parameterized.
export const activeRolesSql = `SELECT r.code FROM app.user_roles ur JOIN app.roles r USING(role_id)
 JOIN app.users u ON u.user_id=ur.user_id WHERE ur.user_id=$1 AND u.status='ACTIVE' AND r.is_active
 AND ur.revoked_at IS NULL AND ur.valid_from<=NOW() AND (ur.valid_to IS NULL OR ur.valid_to>NOW())`;
export async function subject(client, userId, type = "LECTURER", unitId) {
  const roles = (await client.query(activeRolesSql, [userId])).rows.map(
    (r) => r.code,
  );
  if (type === "LECTURER" && roles.includes("LECTURER")) {
    return (
      await client.query(
        `SELECT l.lecturer_id,l.user_id,la.unit_id context_unit_id FROM app.lecturers l
      JOIN app.lecturer_assignments la USING(lecturer_id) JOIN app.organization_units u USING(unit_id)
      WHERE l.user_id=$1 AND l.is_active AND u.is_active AND la.is_primary AND la.valid_from<=NOW()
      AND (la.valid_to IS NULL OR la.valid_to>NOW()) LIMIT 1`,
        [userId],
      )
    ).rows[0];
  }
  if (type === "UNIT" && roles.includes("UNIT_REPRESENTATIVE")) {
    return (
      await client.query(
        `SELECT rep.unit_id,rep.unit_id context_unit_id FROM app.unit_representatives rep
      JOIN app.organization_units u USING(unit_id) WHERE rep.user_id=$1 AND rep.unit_id=$2 AND u.is_active
      AND rep.revoked_at IS NULL AND rep.valid_from<=NOW() AND (rep.valid_to IS NULL OR rep.valid_to>NOW())`,
        [userId, unitId],
      )
    ).rows[0];
  }
  return null;
}
export async function createGoal(client, userId, s, p, source) {
  return (
    await client.query(
      `INSERT INTO app.kpi_goals(lecturer_id,unit_id,context_unit_id,code,title,measure_unit,
    period_start,period_end,target,plan,source,source_note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *,period_start::text,period_end::text`,
      [
        s.lecturer_id || null,
        s.unit_id || null,
        s.context_unit_id,
        p.code,
        p.title,
        p.measureUnit,
        p.periodStart,
        p.periodEnd,
        p.target,
        p.plan,
        source,
        p.sourceNote,
        userId,
      ],
    )
  ).rows[0];
}
export async function findDuplicate(client, s, p) {
  return (
    await client.query(
      `SELECT *,period_start::text,period_end::text FROM app.kpi_goals WHERE lecturer_id IS NOT DISTINCT FROM $1
    AND unit_id IS NOT DISTINCT FROM $2 AND code=$3 AND period_start=$4 AND period_end=$5`,
      [
        s.lecturer_id || null,
        s.unit_id || null,
        p.code,
        p.periodStart,
        p.periodEnd,
      ],
    )
  ).rows[0];
}
export async function createResult(client, userId, goalId, p, source) {
  return (
    await client.query(
      `INSERT INTO app.kpi_results(goal_id,actual,source,source_note,evidence_note,created_by)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [goalId, p.actual, source, p.sourceNote, p.evidenceNote, userId],
    )
  ).rows[0];
}
