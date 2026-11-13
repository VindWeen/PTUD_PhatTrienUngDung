// All identifiers below are fixed; user data is always parameterized.
export const activeRolesSql = `SELECT r.code FROM app.user_roles ur JOIN app.roles r ON r.role_id=ur.role_id
 JOIN app.users u ON u.user_id=ur.user_id WHERE ur.user_id=$1 AND u.status='ACTIVE' AND r.is_active = 1
 AND ur.revoked_at IS NULL AND ur.valid_from<=SYSUTCDATETIME() AND (ur.valid_to IS NULL OR ur.valid_to>SYSUTCDATETIME())`;
export async function subject(client, userId, type = "LECTURER", unitId) {
  const roles = (await client.query(activeRolesSql, [userId])).rows.map(
    (r) => r.code,
  );
  const isPersonalRole =
    roles.length === 0 ||
    roles.some((r) =>
      ["LECTURER", "MEMBER", "DEPARTMENT_HEAD", "FACULTY_LEAD", "ADMIN"].includes(r),
    );
  if (type === "LECTURER" && isPersonalRole) {
    let lecturer = (
      await client.query(
        `SELECT TOP (1) l.lecturer_id, l.user_id, COALESCE(la.unit_id, (SELECT TOP 1 unit_id FROM app.organization_units WHERE code = 'LHU' OR type = 'UNIVERSITY' OR parent_id IS NULL)) context_unit_id FROM app.lecturers l
      LEFT JOIN app.lecturer_assignments la ON la.lecturer_id=l.lecturer_id AND la.is_primary = 1 AND la.valid_from<=SYSUTCDATETIME()
      AND (la.valid_to IS NULL OR la.valid_to>SYSUTCDATETIME())
      WHERE l.user_id=$1 AND l.is_active = 1`,
        [userId],
      )
    ).rows[0];

    if (!lecturer) {
      const userRes = await client.query(
        `SELECT user_id, display_name AS full_name, email FROM app.users WHERE user_id = $1`,
        [userId],
      );
      if (userRes.rows[0]) {
        const u = userRes.rows[0];
        const rootUnit = (
          await client.query(
            `SELECT TOP 1 unit_id FROM app.organization_units WHERE code = 'LHU' OR type = 'UNIVERSITY' OR parent_id IS NULL`,
          )
        ).rows[0];
        const defaultUnitId = rootUnit ? rootUnit.unit_id : 37;
        const code = "USR" + String(userId).padStart(5, "0");
        const ins = await client.query(
          `INSERT INTO app.lecturers (user_id, employee_code, full_name, email, is_active)
           OUTPUT INSERTED.lecturer_id, INSERTED.user_id
           VALUES ($1, $2, $3, $4, 1)`,
          [userId, code, u.full_name || "Thành viên", u.email || `${code}@lhu.edu.vn`],
        );
        if (ins.rows[0]) {
          await client.query(
            `INSERT INTO app.lecturer_assignments (lecturer_id, unit_id, is_primary, valid_from, assigned_by)
             VALUES ($1, $2, 1, SYSUTCDATETIME(), $3)`,
            [ins.rows[0].lecturer_id, defaultUnitId, userId],
          );
          lecturer = {
            lecturer_id: ins.rows[0].lecturer_id,
            user_id: ins.rows[0].user_id,
            context_unit_id: defaultUnitId,
          };
        }
      }
    }
    return lecturer;
  }
  if (
    type === "UNIT" &&
    (roles.includes("UNIT_REPRESENTATIVE") ||
      roles.includes("ADMIN") ||
      roles.includes("FACULTY_LEAD") ||
      roles.includes("DEPARTMENT_HEAD"))
  ) {
    return (
      await client.query(
        `SELECT rep.unit_id,rep.unit_id context_unit_id FROM app.unit_representatives rep
      JOIN app.organization_units u ON u.unit_id=rep.unit_id WHERE rep.user_id=$1 AND rep.unit_id=$2 AND u.is_active = 1
      AND rep.revoked_at IS NULL AND rep.valid_from<=SYSUTCDATETIME() AND (rep.valid_to IS NULL OR rep.valid_to>SYSUTCDATETIME())`,
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
    period_start,period_end,target,[plan],source,source_note,created_by) OUTPUT INSERTED.* VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
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
      `SELECT * FROM app.kpi_goals WHERE (lecturer_id = $1 OR (lecturer_id IS NULL AND $1 IS NULL))
    AND (unit_id = $2 OR (unit_id IS NULL AND $2 IS NULL)) AND code=$3 AND period_start=$4 AND period_end=$5`,
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
    OUTPUT INSERTED.* VALUES($1,$2,$3,$4,$5,$6)`,
      [goalId, p.actual, source, p.sourceNote, p.evidenceNote, userId],
    )
  ).rows[0];
}
