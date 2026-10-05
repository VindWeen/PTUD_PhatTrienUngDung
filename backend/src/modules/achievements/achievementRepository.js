import { query } from '../../utils/dbHelper.js';

export async function findLecturerByUserId(userId) {
  const result = await query(
    `SELECT l.lecturer_id AS "lecturerId", l.user_id AS "userId", l.employee_code AS "employeeCode",
            l.full_name AS "fullName", l.email AS "email", l.title AS "title", l.degree AS "degree",
            la.unit_id AS "primaryUnitId", ou.code AS "primaryUnitCode", ou.name AS "primaryUnitName"
     FROM app.lecturers l
     LEFT JOIN app.lecturer_assignments la ON l.lecturer_id = la.lecturer_id AND la.is_primary = TRUE AND (la.valid_to IS NULL OR la.valid_to > NOW())
     LEFT JOIN app.organization_units ou ON la.unit_id = ou.unit_id
     WHERE l.user_id = $1 AND l.is_active = TRUE
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function findActiveRepresentative(userId, unitId) {
  const result = await query(
    `SELECT rep.unit_representative_id AS "unitRepresentativeId", rep.user_id AS "userId",
            rep.unit_id AS "unitId", rep.valid_from AS "validFrom", rep.valid_to AS "validTo"
     FROM app.unit_representatives rep
     WHERE rep.user_id = $1 
       AND rep.unit_id = $2
       AND rep.revoked_at IS NULL
       AND rep.valid_from <= NOW()
       AND (rep.valid_to IS NULL OR rep.valid_to > NOW())
     LIMIT 1`,
    [userId, unitId]
  );
  return result.rows[0] || null;
}

export async function listUserRepresentedUnitIds(userId) {
  const result = await query(
    `SELECT rep.unit_id AS "unitId"
     FROM app.unit_representatives rep
     WHERE rep.user_id = $1 
       AND rep.revoked_at IS NULL
       AND rep.valid_from <= NOW()
       AND (rep.valid_to IS NULL OR rep.valid_to > NOW())`,
    [userId]
  );
  return result.rows.map((r) => Number(r.unitId));
}

export async function findAchievementById(id) {
  const result = await query(
    `SELECT a.achievement_id AS "achievementId",
            CASE WHEN a.lecturer_id IS NOT NULL THEN 'LECTURER' ELSE 'UNIT' END AS "subjectType",
            a.lecturer_id AS "lecturerId",
            a.unit_id AS "organizationUnitId",
            a.context_unit_id AS "contextUnitId",
            a.achievement_type_id AS "achievementTypeId",
            a.title AS "title",
            a.description AS "description",
            a.contribution_role AS "contributionRole",
            a.start_date::text AS "startDate",
            a.end_date::text AS "endDate",
            a.recognition_year AS "recognitionYear",
            a.academic_year_id AS "academicYearId",
            a.status AS "status",
            a.created_by AS "createdBy",
            a.submitted_by AS "submittedBy",
            a.replaces_achievement_id AS "replacesAchievementId",
            a.version AS "version",
            a.created_at AS "createdAt",
            a.updated_at AS "updatedAt",
            -- Giảng viên chủ thể
            l.full_name AS "lecturerFullName",
            l.employee_code AS "lecturerEmployeeCode",
            l.email AS "lecturerEmail",
            l.user_id AS "lecturerUserId",
            -- Đơn vị chủ thể (nếu là tập thể)
            u_subj.code AS "subjectUnitCode",
            u_subj.name AS "subjectUnitName",
            -- Đơn vị quản lý (ContextUnit)
            u_ctx.code AS "contextUnitCode",
            u_ctx.name AS "contextUnitName",
            -- Loại thành tích
            at.code AS "achievementTypeCode",
            at.name AS "achievementTypeName",
            -- Năm học
            ay.code AS "academicYearCode",
            ay.name AS "academicYearName"
     FROM app.achievements a
     LEFT JOIN app.lecturers l ON a.lecturer_id = l.lecturer_id
     LEFT JOIN app.organization_units u_subj ON a.unit_id = u_subj.unit_id
     LEFT JOIN app.organization_units u_ctx ON a.context_unit_id = u_ctx.unit_id
     LEFT JOIN app.achievement_types at ON a.achievement_type_id = at.achievement_type_id
     LEFT JOIN app.academic_years ay ON a.academic_year_id = ay.academic_year_id
     WHERE a.achievement_id = $1`,
    [id]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    achievementId: Number(row.achievementId),
    subjectType: row.subjectType,
    lecturerId: row.lecturerId ? Number(row.lecturerId) : null,
    organizationUnitId: row.organizationUnitId ? Number(row.organizationUnitId) : null,
    contextUnitId: Number(row.contextUnitId),
    achievementTypeId: row.achievementTypeId ? Number(row.achievementTypeId) : null,
    title: row.title,
    description: row.description,
    contributionRole: row.contributionRole,
    startDate: row.startDate,
    endDate: row.endDate,
    recognitionYear: row.recognitionYear ? Number(row.recognitionYear) : null,
    academicYearId: row.academicYearId ? Number(row.academicYearId) : null,
    status: row.status,
    createdBy: Number(row.createdBy),
    submittedBy: row.submittedBy ? Number(row.submittedBy) : null,
    replacesAchievementId: row.replacesAchievementId ? Number(row.replacesAchievementId) : null,
    version: Number(row.version),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lecturer: row.lecturerId
      ? {
          lecturerId: Number(row.lecturerId),
          userId: Number(row.lecturerUserId),
          fullName: row.lecturerFullName,
          employeeCode: row.lecturerEmployeeCode,
          email: row.lecturerEmail,
        }
      : null,
    subjectUnit: row.organizationUnitId
      ? {
          unitId: Number(row.organizationUnitId),
          code: row.subjectUnitCode,
          name: row.subjectUnitName,
        }
      : null,
    contextUnit: {
      unitId: Number(row.contextUnitId),
      code: row.contextUnitCode,
      name: row.contextUnitName,
    },
    achievementType: row.achievementTypeId
      ? {
          achievementTypeId: Number(row.achievementTypeId),
          code: row.achievementTypeCode,
          name: row.achievementTypeName,
        }
      : null,
    academicYear: row.academicYearId
      ? {
          academicYearId: Number(row.academicYearId),
          code: row.academicYearCode,
          name: row.academicYearName,
        }
      : null,
  };
}

export async function listAchievements({ filters = {}, limit = 10, offset = 0, sortBy = 'updatedAt', sortOrder = 'desc' }) {
  const whereClauses = [];
  const params = [];
  let paramIdx = 1;

  if (filters.subjectType) {
    if (filters.subjectType === 'LECTURER') {
      whereClauses.push('a.lecturer_id IS NOT NULL');
    } else if (filters.subjectType === 'UNIT') {
      whereClauses.push('a.unit_id IS NOT NULL');
    }
  }

  if (filters.lecturerId) {
    whereClauses.push(`a.lecturer_id = $${paramIdx++}`);
    params.push(filters.lecturerId);
  }

  if (filters.unitId) {
    whereClauses.push(`a.unit_id = $${paramIdx++}`);
    params.push(filters.unitId);
  }

  if (filters.contextUnitId) {
    whereClauses.push(`a.context_unit_id = $${paramIdx++}`);
    params.push(filters.contextUnitId);
  }

  if (filters.contextUnitIds && filters.contextUnitIds.length > 0) {
    whereClauses.push(`a.context_unit_id = ANY($${paramIdx++}::bigint[])`);
    params.push(filters.contextUnitIds);
  }

  if (filters.recognitionYear) {
    whereClauses.push(`a.recognition_year = $${paramIdx++}`);
    params.push(filters.recognitionYear);
  }

  if (filters.academicYearId) {
    whereClauses.push(`a.academic_year_id = $${paramIdx++}`);
    params.push(filters.academicYearId);
  }

  if (filters.achievementTypeId) {
    whereClauses.push(`a.achievement_type_id = $${paramIdx++}`);
    params.push(filters.achievementTypeId);
  }

  if (filters.status) {
    whereClauses.push(`a.status = $${paramIdx++}`);
    params.push(filters.status);
  }

  if (filters.search) {
    whereClauses.push(`(a.title ILIKE $${paramIdx} OR a.description ILIKE $${paramIdx})`);
    params.push(`%${filters.search}%`);
    paramIdx++;
  }

  // Điều kiện phạm vi xem dữ liệu (RBAC / Scope filter)
  if (filters.scopeCondition) {
    whereClauses.push(filters.scopeCondition.clause);
    if (filters.scopeCondition.params) {
      filters.scopeCondition.params.forEach((p) => {
        params.push(p);
      });
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Ánh xạ cột sắp xếp
  const sortMap = {
    createdAt: 'a.created_at',
    updatedAt: 'a.updated_at',
    recognitionYear: 'a.recognition_year',
    title: 'a.title',
  };
  const sortCol = sortMap[sortBy] || 'a.updated_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // 1. Đếm tổng số bản ghi
  const countSql = `SELECT COUNT(*) AS total FROM app.achievements a ${whereSql}`;
  const countRes = await query(countSql, params);
  const total = Number(countRes.rows[0]?.total || 0);

  // 2. Lấy dữ liệu trang
  const listSql = `
    SELECT a.achievement_id AS "achievementId",
           CASE WHEN a.lecturer_id IS NOT NULL THEN 'LECTURER' ELSE 'UNIT' END AS "subjectType",
           a.lecturer_id AS "lecturerId",
           a.unit_id AS "organizationUnitId",
           COALESCE(l.full_name, u_subj.name) AS "subjectName",
           a.context_unit_id AS "contextUnitId",
           u_ctx.name AS "contextUnitName",
           a.achievement_type_id AS "achievementTypeId",
           at.code AS "achievementTypeCode",
           at.name AS "achievementTypeName",
           a.title AS "title",
           a.description AS "description",
           a.contribution_role AS "contributionRole",
           a.start_date::text AS "startDate",
           a.end_date::text AS "endDate",
           a.recognition_year AS "recognitionYear",
           a.academic_year_id AS "academicYearId",
           ay.code AS "academicYearCode",
           a.status AS "status",
           a.version AS "version",
           a.created_at AS "createdAt",
           a.updated_at AS "updatedAt",
           0 AS "evidenceCount",
           1 AS "latestRevisionNo"
    FROM app.achievements a
    LEFT JOIN app.lecturers l ON a.lecturer_id = l.lecturer_id
    LEFT JOIN app.organization_units u_subj ON a.unit_id = u_subj.unit_id
    LEFT JOIN app.organization_units u_ctx ON a.context_unit_id = u_ctx.unit_id
    LEFT JOIN app.achievement_types at ON a.achievement_type_id = at.achievement_type_id
    LEFT JOIN app.academic_years ay ON a.academic_year_id = ay.academic_year_id
    ${whereSql}
    ORDER BY ${sortCol} ${order}
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  const listParams = [...params, limit, offset];
  const listRes = await query(listSql, listParams);

  return {
    items: listRes.rows.map((r) => ({
      achievementId: Number(r.achievementId),
      subjectType: r.subjectType,
      lecturerId: r.lecturerId ? Number(r.lecturerId) : null,
      organizationUnitId: r.organizationUnitId ? Number(r.organizationUnitId) : null,
      subjectName: r.subjectName,
      contextUnitId: Number(r.contextUnitId),
      contextUnitName: r.contextUnitName,
      achievementTypeId: r.achievementTypeId ? Number(r.achievementTypeId) : null,
      achievementTypeCode: r.achievementTypeCode,
      achievementTypeName: r.achievementTypeName,
      title: r.title,
      description: r.description,
      contributionRole: r.contributionRole,
      startDate: r.startDate,
      endDate: r.endDate,
      recognitionYear: r.recognitionYear ? Number(r.recognitionYear) : null,
      academicYearId: r.academicYearId ? Number(r.academicYearId) : null,
      academicYearCode: r.academicYearCode,
      status: r.status,
      evidenceCount: Number(r.evidenceCount),
      latestRevisionNo: Number(r.latestRevisionNo),
      version: Number(r.version),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    total,
  };
}

export async function createAchievement(data) {
  const result = await query(
    `INSERT INTO app.achievements (
        lecturer_id, unit_id, context_unit_id, achievement_type_id,
        title, description, contribution_role, start_date, end_date,
        recognition_year, academic_year_id, status, created_by, version,
        created_at, updated_at
     ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, 'DRAFT', $12, 1,
        NOW(), NOW()
     )
     RETURNING achievement_id AS "achievementId", version, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      data.lecturerId || null,
      data.organizationUnitId || null,
      data.contextUnitId,
      data.achievementTypeId,
      data.title,
      data.description || null,
      data.contributionRole || null,
      data.startDate || null,
      data.endDate || null,
      data.recognitionYear,
      data.academicYearId || null,
      data.createdBy,
    ]
  );
  return result.rows[0];
}

export async function updateAchievement(id, currentVersion, fields) {
  const updates = [];
  const params = [];
  let idx = 1;

  if (fields.title !== undefined) {
    updates.push(`title = $${idx++}`);
    params.push(fields.title);
  }
  if (fields.description !== undefined) {
    updates.push(`description = $${idx++}`);
    params.push(fields.description);
  }
  if (fields.contributionRole !== undefined) {
    updates.push(`contribution_role = $${idx++}`);
    params.push(fields.contributionRole);
  }
  if (fields.startDate !== undefined) {
    updates.push(`start_date = $${idx++}`);
    params.push(fields.startDate);
  }
  if (fields.endDate !== undefined) {
    updates.push(`end_date = $${idx++}`);
    params.push(fields.endDate);
  }
  if (fields.recognitionYear !== undefined) {
    updates.push(`recognition_year = $${idx++}`);
    params.push(fields.recognitionYear);
  }
  if (fields.academicYearId !== undefined) {
    updates.push(`academic_year_id = $${idx++}`);
    params.push(fields.academicYearId);
  }
  if (fields.achievementTypeId !== undefined) {
    updates.push(`achievement_type_id = $${idx++}`);
    params.push(fields.achievementTypeId);
  }

  updates.push('version = version + 1');
  updates.push('updated_at = NOW()');

  const sql = `
    UPDATE app.achievements
    SET ${updates.join(', ')}
    WHERE achievement_id = $${idx++} AND version = $${idx++}
    RETURNING achievement_id AS "achievementId", version, updated_at AS "updatedAt"
  `;
  params.push(id, currentVersion);

  const result = await query(sql, params);
  return result.rows[0] || null;
}

export async function deleteAchievement(id) {
  const result = await query(
    `DELETE FROM app.achievements
     WHERE achievement_id = $1 AND status = 'DRAFT'
     RETURNING achievement_id AS "achievementId"`,
    [id]
  );
  return result.rowCount > 0;
}

export default {
  findLecturerByUserId,
  findActiveRepresentative,
  listUserRepresentedUnitIds,
  findAchievementById,
  listAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement,
};
