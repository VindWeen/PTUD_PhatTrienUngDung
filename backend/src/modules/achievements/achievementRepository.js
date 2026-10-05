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

export async function findAchievementById(id, client = null) {
  const runQuery = client ? client.query.bind(client) : query;
  const result = await runQuery(
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
            a.verified_by AS "verifiedBy",
            a.verified_at AS "verifiedAt",
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

  const submissionsRes = await runQuery(
    `SELECT s.submission_id AS "submissionId", s.revision_no AS "revisionNo",
            s.submitted_at AS "submittedAt", s.submitted_by AS "submittedByUserId",
            u.display_name AS "submittedByFullName",
            (SELECT COUNT(*)::int FROM app.submission_evidence_files sef WHERE sef.submission_id = s.submission_id) AS "frozenFilesCount"
     FROM app.achievement_submissions s
     LEFT JOIN app.users u ON s.submitted_by = u.user_id
     WHERE s.achievement_id = $1
     ORDER BY s.revision_no ASC`,
    [id]
  );
  const submissions = submissionsRes.rows.map((s) => ({
    submissionId: Number(s.submissionId),
    revisionNo: Number(s.revisionNo),
    submittedBy: {
      userId: Number(s.submittedByUserId),
      displayName: s.submittedByFullName || `User #${s.submittedByUserId}`,
    },
    submittedAt: s.submittedAt,
    frozenFilesCount: Number(s.frozenFilesCount),
  }));

  const correctionRes = await runQuery(
    `SELECT h.reason
     FROM app.achievement_status_histories h
     WHERE h.achievement_id = $1 AND h.to_status = 'NEED_CORRECTION'
     ORDER BY h.created_at DESC, h.history_id DESC LIMIT 1`,
    [id]
  );
  const latestCorrectionReason = correctionRes.rows[0]?.reason || null;

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
    verifiedBy: row.verifiedBy ? Number(row.verifiedBy) : null,
    verifiedAt: row.verifiedAt || null,
    replacesAchievementId: row.replacesAchievementId ? Number(row.replacesAchievementId) : null,
    version: Number(row.version),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    latestCorrectionReason,
    submissions,
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
           (SELECT COUNT(*)::int FROM app.evidences e WHERE e.achievement_id = a.achievement_id AND e.is_removed = FALSE) AS "evidenceCount",
           (SELECT COALESCE(MAX(s.revision_no), 0)::int FROM app.achievement_submissions s WHERE s.achievement_id = a.achievement_id) AS "latestRevisionNo"
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

/**
 * W2-Q3: Khóa dòng thành tích với SELECT ... FOR UPDATE trên pg client của transaction
 */
export async function findAchievementForUpdate(client, id) {
  const result = await client.query(
    `SELECT a.*,
            CASE WHEN a.lecturer_id IS NOT NULL THEN 'LECTURER' ELSE 'UNIT' END AS "subjectType",
            l.user_id AS "lecturerUserId"
     FROM app.achievements a
     LEFT JOIN app.lecturers l ON a.lecturer_id = l.lecturer_id
     WHERE a.achievement_id = $1
     FOR UPDATE OF a`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * W2-Q3: Lấy các minh chứng còn hiệu lực kèm phiên bản tệp mới nhất để tạo snapshot và đóng băng
 */
export async function getActiveEvidencesWithFiles(achievementId, client = null) {
  const sql = `
    SELECT e.evidence_id AS "evidenceId", e.title AS "title", e.description AS "description",
           ef.evidence_file_id AS "evidenceFileId", ef.version_no AS "versionNo",
           ef.original_file_name AS "originalFileName", ef.storage_key AS "storageKey",
           ef.mime_type AS "mimeType", ef.file_size AS "fileSize", ef.sha256_hash AS "sha256Hash",
           ef.uploaded_at AS "uploadedAt"
    FROM app.evidences e
    JOIN app.evidence_files ef ON e.evidence_id = ef.evidence_id
    JOIN (
      SELECT evidence_id, MAX(version_no) as max_v
      FROM app.evidence_files
      GROUP BY evidence_id
    ) latest ON ef.evidence_id = latest.evidence_id AND ef.version_no = latest.max_v
    WHERE e.achievement_id = $1 AND e.is_removed = FALSE
    ORDER BY e.evidence_id ASC
  `;
  if (client) {
    const res = await client.query(sql, [achievementId]);
    return res.rows;
  }
  const res = await query(sql, [achievementId]);
  return res.rows;
}

/**
 * W2-Q3: Tạo bản ghi snapshot lần nộp (AchievementSubmissions)
 */
export async function createSubmission(client, { achievementId, revisionNo, snapshotData, submittedBy }) {
  const result = await client.query(
    `INSERT INTO app.achievement_submissions (
        achievement_id, revision_no, snapshot_data, submitted_by, submitted_at, created_at
     ) VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING submission_id AS "submissionId", revision_no AS "revisionNo", submitted_at AS "submittedAt"`,
    [achievementId, revisionNo, JSON.stringify(snapshotData), submittedBy]
  );
  return result.rows[0];
}

/**
 * W2-Q3: Đóng băng các phiên bản tệp tin gắn với lần nộp (SubmissionEvidenceFiles)
 */
export async function linkSubmissionEvidenceFiles(client, submissionId, evidenceFileIds) {
  if (!evidenceFileIds || evidenceFileIds.length === 0) return [];
  const rows = [];
  for (const fileId of evidenceFileIds) {
    const res = await client.query(
      `INSERT INTO app.submission_evidence_files (submission_id, evidence_file_id, attached_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (submission_id, evidence_file_id) DO NOTHING
       RETURNING submission_id AS "submissionId", evidence_file_id AS "evidenceFileId"`,
      [submissionId, fileId]
    );
    if (res.rows[0]) rows.push(res.rows[0]);
  }
  return rows;
}

/**
 * W2-Q3: Ghi nhận lịch sử thẩm định và chuyển trạng thái (AchievementStatusHistories)
 */
export async function recordStatusHistory(client, { achievementId, submissionId = null, fromStatus, toStatus, actorId, reason = null }) {
  const result = await client.query(
    `INSERT INTO app.achievement_status_histories (
        achievement_id, submission_id, from_status, to_status, actor_id, reason, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING history_id AS "historyId", achievement_id AS "achievementId", from_status AS "fromStatus", to_status AS "toStatus", created_at AS "createdAt"`,
    [achievementId, submissionId, fromStatus, toStatus, actorId, reason]
  );
  return result.rows[0];
}

/**
 * W2-Q3: Cập nhật trạng thái thành tích có kiểm tra version + id + status chống xung đột đồng thời (OCC)
 */
export async function updateAchievementStatus(client, id, currentVersion, currentStatus, targetStatus, extraFields = {}) {
  const setClauses = [
    'status = $1',
    'version = version + 1',
    'updated_at = NOW()',
  ];
  const params = [targetStatus];
  let idx = 2;

  if (extraFields.submittedBy !== undefined) {
    setClauses.push(`submitted_by = $${idx++}`);
    params.push(extraFields.submittedBy);
  }
  if (extraFields.submittedAt !== undefined) {
    setClauses.push(`submitted_at = $${idx++}`);
    params.push(extraFields.submittedAt);
  }
  if (extraFields.verifiedBy !== undefined) {
    setClauses.push(`verified_by = $${idx++}`);
    params.push(extraFields.verifiedBy);
  }
  if (extraFields.verifiedAt !== undefined) {
    setClauses.push(`verified_at = $${idx++}`);
    params.push(extraFields.verifiedAt);
  }

  const sql = `
    UPDATE app.achievements
    SET ${setClauses.join(', ')}
    WHERE achievement_id = $${idx++} AND version = $${idx++} AND status = $${idx++}
    RETURNING *
  `;
  params.push(id, currentVersion, currentStatus);

  const result = await client.query(sql, params);
  return result.rows[0] || null;
}

/**
 * W2-Q3: Lấy danh sách lịch sử chuyển trạng thái kèm thông tin người thực hiện
 */
export async function listHistories(achievementId) {
  const result = await query(
    `SELECT h.history_id AS "historyId", h.achievement_id AS "achievementId",
            h.submission_id AS "submissionId", h.from_status AS "fromStatus",
            h.to_status AS "toStatus", h.actor_id AS "actorId",
            h.reason AS "reason", h.created_at AS "createdAt",
            u.display_name AS "actorFullName",
            r.code AS "actorRoleCode",
            l.full_name AS "lecturerFullName"
     FROM app.achievement_status_histories h
     LEFT JOIN app.users u ON h.actor_id = u.user_id
     LEFT JOIN app.lecturers l ON u.user_id = l.user_id
     LEFT JOIN LATERAL (
       SELECT ro.code FROM app.user_roles ur
       JOIN app.roles ro ON ur.role_id = ro.role_id
       WHERE ur.user_id = h.actor_id AND ur.revoked_at IS NULL
       LIMIT 1
     ) r ON true
     WHERE h.achievement_id = $1
     ORDER BY h.created_at ASC, h.history_id ASC`,
    [achievementId]
  );

  return result.rows.map((row) => ({
    historyId: Number(row.historyId),
    achievementId: Number(row.achievementId),
    submissionId: row.submissionId ? Number(row.submissionId) : null,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actor: {
      userId: Number(row.actorId),
      displayName: row.lecturerFullName || row.actorFullName || `User #${row.actorId}`,
      role: row.actorRoleCode || 'USER',
    },
    reason: row.reason,
    createdAt: row.createdAt,
  }));
}

/**
 * W2-Q3: Lấy danh sách các lần nộp hồ sơ
 */
export async function listSubmissions(achievementId) {
  const result = await query(
    `SELECT s.submission_id AS "submissionId", s.revision_no AS "revisionNo",
            s.snapshot_data AS "snapshotData", s.submitted_by AS "submittedByUserId",
            s.submitted_at AS "submittedAt", s.created_at AS "createdAt",
            u.display_name AS "submittedByFullName",
            (SELECT COUNT(*)::int FROM app.submission_evidence_files sef WHERE sef.submission_id = s.submission_id) AS "frozenFilesCount"
     FROM app.achievement_submissions s
     LEFT JOIN app.users u ON s.submitted_by = u.user_id
     WHERE s.achievement_id = $1
     ORDER BY s.revision_no ASC`,
    [achievementId]
  );

  return result.rows.map((row) => ({
    submissionId: Number(row.submissionId),
    revisionNo: Number(row.revisionNo),
    snapshotData: row.snapshotData,
    submittedBy: {
      userId: Number(row.submittedByUserId),
      displayName: row.submittedByFullName || `User #${row.submittedByUserId}`,
    },
    submittedAt: row.submittedAt,
    frozenFilesCount: Number(row.frozenFilesCount),
  }));
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
  findAchievementForUpdate,
  getActiveEvidencesWithFiles,
  createSubmission,
  linkSubmissionEvidenceFiles,
  recordStatusHistory,
  updateAchievementStatus,
  listHistories,
  listSubmissions,
};
