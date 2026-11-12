import { getPool } from '../../config/database.js';
import { normalizeFileName } from '../../utils/fileName.js';

function mapEvidenceRow(row) {
  if (!row) return null;
  return {
    evidenceId: Number(row.evidenceId),
    achievementId: Number(row.achievementId),
    title: row.title,
    description: row.description,
    isRemoved: Boolean(row.isRemoved),
    createdBy: Number(row.createdBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.lecturerId ? { lecturerId: Number(row.lecturerId) } : {}),
    ...(row.unitId ? { unitId: Number(row.unitId) } : {}),
    ...(row.contextUnitId ? { contextUnitId: Number(row.contextUnitId) } : {}),
    ...(row.achievementStatus ? { achievementStatus: row.achievementStatus } : {}),
    ...(row.lecturerUserId ? { lecturerUserId: Number(row.lecturerUserId) } : {}),
  };
}

function mapFileRow(row) {
  if (!row) return null;
  return {
    evidenceFileId: Number(row.evidenceFileId),
    evidenceId: Number(row.evidenceId),
    versionNo: Number(row.versionNo),
    originalFileName: normalizeFileName(row.originalFileName),
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    fileExtension: row.fileExtension,
    fileSize: Number(row.fileSize),
    sha256Hash: row.sha256Hash,
    uploadedBy: Number(row.uploadedBy),
    uploadedAt: row.uploadedAt,
  };
}

/**
 * Repository thao tác CSDL cho Phân hệ Minh chứng & Tệp tin bất biến
 */
export class EvidenceRepository {
  /**
   * Tạo bản ghi Danh mục Minh chứng (app.evidences)
   */
  async createEvidenceRecord({ achievementId, title, description, createdBy }, client = null) {
    const db = client || getPool();
    const query = `
      INSERT INTO app.evidences (
        achievement_id,
        title,
        description,
        is_removed,
        created_by,
        created_at,
        updated_at
      )
      OUTPUT INSERTED.evidence_id AS "evidenceId",
        INSERTED.achievement_id AS "achievementId",
        INSERTED.title,
        INSERTED.description,
        INSERTED.is_removed AS "isRemoved",
        INSERTED.created_by AS "createdBy",
        INSERTED.created_at AS "createdAt",
        INSERTED.updated_at AS "updatedAt" VALUES ($1, $2, $3, 0, $4, SYSUTCDATETIME(), SYSUTCDATETIME())`;
    const res = await db.query(query, [achievementId, title, description, createdBy]);
    return mapEvidenceRow(res.rows[0]);
  }

  /**
   * Tạo bản ghi Phiên bản Tệp tin Minh chứng Bất biến (app.evidence_files)
   */
  async createEvidenceFileRecord(
    {
      evidenceId,
      versionNo,
      originalFileName,
      storageKey,
      mimeType,
      fileExtension,
      fileSize,
      sha256Hash,
      uploadedBy,
    },
    client = null
  ) {
    const db = client || getPool();
    const query = `
      INSERT INTO app.evidence_files (
        evidence_id,
        version_no,
        original_file_name,
        storage_key,
        mime_type,
        file_extension,
        file_size,
        sha256_hash,
        uploaded_by,
        uploaded_at
      )
      OUTPUT INSERTED.evidence_file_id AS "evidenceFileId",
        INSERTED.evidence_id AS "evidenceId",
        INSERTED.version_no AS "versionNo",
        INSERTED.original_file_name AS "originalFileName",
        INSERTED.storage_key AS "storageKey",
        INSERTED.mime_type AS "mimeType",
        INSERTED.file_extension AS "fileExtension",
        INSERTED.file_size AS "fileSize",
        INSERTED.sha256_hash AS "sha256Hash",
        INSERTED.uploaded_by AS "uploadedBy",
        INSERTED.uploaded_at AS "uploadedAt" VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, SYSUTCDATETIME())`;
    const params = [
      evidenceId,
      versionNo,
      originalFileName,
      storageKey,
      mimeType,
      fileExtension,
      fileSize,
      sha256Hash,
      uploadedBy,
    ];
    const res = await db.query(query, params);
    return mapFileRow(res.rows[0]);
  }

  /**
   * Lấy số phiên bản cao nhất hiện tại của một minh chứng
   */
  async getLatestVersionNo(evidenceId, client = null) {
    const db = client || getPool();
    const query = `
      SELECT COALESCE(MAX(version_no), 0) AS max_version
      FROM app.evidence_files
      WHERE evidence_id = $1;
    `;
    const res = await db.query(query, [evidenceId]);
    return parseInt(res.rows[0]?.max_version || 0, 10);
  }

  /**
   * Tìm minh chứng theo ID
   */
  async findEvidenceById(evidenceId, client = null) {
    const db = client || getPool();
    const query = `
      SELECT
        e.evidence_id AS "evidenceId",
        e.achievement_id AS "achievementId",
        e.title,
        e.description,
        e.is_removed AS "isRemoved",
        e.created_by AS "createdBy",
        e.created_at AS "createdAt",
        e.updated_at AS "updatedAt",
        a.lecturer_id AS "lecturerId",
        a.unit_id AS "unitId",
        a.context_unit_id AS "contextUnitId",
        a.status AS "achievementStatus",
        l.user_id AS "lecturerUserId"
      FROM app.evidences e
      JOIN app.achievements a ON a.achievement_id = e.achievement_id
      LEFT JOIN app.lecturers l ON l.lecturer_id = a.lecturer_id
      WHERE e.evidence_id = $1;
    `;
    const res = await db.query(query, [evidenceId]);
    return mapEvidenceRow(res.rows[0]);
  }

  /**
   * Lấy danh sách các phiên bản tệp tin của một minh chứng
   */
  async getEvidenceFiles(evidenceId, client = null) {
    const db = client || getPool();
    const query = `
      SELECT
        evidence_file_id AS "evidenceFileId",
        evidence_id AS "evidenceId",
        version_no AS "versionNo",
        original_file_name AS "originalFileName",
        storage_key AS "storageKey",
        mime_type AS "mimeType",
        file_extension AS "fileExtension",
        file_size AS "fileSize",
        sha256_hash AS "sha256Hash",
        uploaded_by AS "uploadedBy",
        uploaded_at AS "uploadedAt"
      FROM app.evidence_files
      WHERE evidence_id = $1
      ORDER BY version_no DESC;
    `;
    const res = await db.query(query, [evidenceId]);
    return res.rows.map(mapFileRow);
  }

  /**
   * Lấy toàn bộ danh sách minh chứng kèm thông tin phiên bản mới nhất của một thành tích
   */
  async getEvidencesByAchievementId(achievementId, includeRemoved = false) {
    const db = getPool();
    const filterRemoved = includeRemoved ? '' : 'AND e.is_removed = 0';
    const query = `
      SELECT
        e.evidence_id AS "evidenceId",
        e.achievement_id AS "achievementId",
        e.title,
        e.description,
        e.is_removed AS "isRemoved",
        e.created_by AS "createdBy",
        e.created_at AS "createdAt",
        e.updated_at AS "updatedAt",
        ef.evidence_file_id AS "latestFileId",
        ef.version_no AS "latestVersionNo",
        ef.original_file_name AS "latestFileName",
        ef.file_size AS "latestFileSize",
        ef.mime_type AS "latestMimeType",
        ef.sha256_hash AS "latestSha256Hash",
        ef.uploaded_at AS "latestUploadedAt",
        (SELECT COUNT(*) FROM app.evidence_files WHERE evidence_id = e.evidence_id) AS "totalVersions"
      FROM app.evidences e
      OUTER APPLY (
        SELECT TOP (1) *
        FROM app.evidence_files
        WHERE evidence_id = e.evidence_id
        ORDER BY version_no DESC

      ) ef
      WHERE e.achievement_id = $1 ${filterRemoved}
      ORDER BY e.created_at ASC;
    `;
    const res = await db.query(query, [achievementId]);
    return res.rows.map((row) => ({
      evidenceId: Number(row.evidenceId),
      achievementId: Number(row.achievementId),
      title: row.title,
      description: row.description,
      isRemoved: Boolean(row.isRemoved),
      createdBy: Number(row.createdBy),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      latestFileId: row.latestFileId ? Number(row.latestFileId) : null,
      latestVersionNo: row.latestVersionNo ? Number(row.latestVersionNo) : null,
      latestFileName: normalizeFileName(row.latestFileName) || null,
      latestFileSize: row.latestFileSize ? Number(row.latestFileSize) : null,
      latestMimeType: row.latestMimeType || null,
      latestSha256Hash: row.latestSha256Hash || null,
      latestUploadedAt: row.latestUploadedAt || null,
      totalVersions: Number(row.totalVersions || 0),
    }));
  }

  /**
   * Tìm chi tiết tệp tin minh chứng theo evidence_file_id (dùng khi download và kiểm tra quyền)
   */
  async findEvidenceFileDetail(evidenceFileId) {
    const db = getPool();
    const query = `
      SELECT
        ef.evidence_file_id AS "evidenceFileId",
        ef.evidence_id AS "evidenceId",
        ef.version_no AS "versionNo",
        ef.original_file_name AS "originalFileName",
        ef.storage_key AS "storageKey",
        ef.mime_type AS "mimeType",
        ef.file_extension AS "fileExtension",
        ef.file_size AS "fileSize",
        ef.sha256_hash AS "sha256Hash",
        ef.uploaded_by AS "uploadedBy",
        ef.uploaded_at AS "uploadedAt",
        e.title AS "evidenceTitle",
        e.is_removed AS "isRemoved",
        a.achievement_id AS "achievementId",
        a.lecturer_id AS "lecturerId",
        a.unit_id AS "unitId",
        a.context_unit_id AS "contextUnitId",
        a.status AS "achievementStatus",
        l.user_id AS "lecturerUserId"
      FROM app.evidence_files ef
      JOIN app.evidences e ON e.evidence_id = ef.evidence_id
      JOIN app.achievements a ON a.achievement_id = e.achievement_id
      LEFT JOIN app.lecturers l ON l.lecturer_id = a.lecturer_id
      WHERE ef.evidence_file_id = $1;
    `;
    const res = await db.query(query, [evidenceFileId]);
    const row = res.rows[0];
    if (!row) return null;

    return {
      evidenceFileId: Number(row.evidenceFileId),
      evidenceId: Number(row.evidenceId),
      versionNo: Number(row.versionNo),
      originalFileName: row.originalFileName,
      storageKey: row.storageKey,
      mimeType: row.mimeType,
      fileExtension: row.fileExtension,
      fileSize: Number(row.fileSize),
      sha256Hash: row.sha256Hash,
      uploadedBy: Number(row.uploadedBy),
      uploadedAt: row.uploadedAt,
      evidenceTitle: row.evidenceTitle,
      isRemoved: Boolean(row.isRemoved),
      achievementId: Number(row.achievementId),
      lecturerId: row.lecturerId ? Number(row.lecturerId) : null,
      unitId: row.unitId ? Number(row.unitId) : null,
      contextUnitId: row.contextUnitId ? Number(row.contextUnitId) : null,
      achievementStatus: row.achievementStatus,
      lecturerUserId: row.lecturerUserId ? Number(row.lecturerUserId) : null,
    };
  }

  /**
   * Đánh dấu xóa mềm danh mục minh chứng (is_removed = 1)
   */
  async softDeleteEvidence(evidenceId, client = null) {
    const db = client || getPool();
    const query = `
      UPDATE app.evidences
      SET is_removed = 1, updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.evidence_id AS "evidenceId",
        INSERTED.achievement_id AS "achievementId",
        INSERTED.is_removed AS "isRemoved",
        INSERTED.updated_at AS "updatedAt" WHERE evidence_id = $1`;
    const res = await db.query(query, [evidenceId]);
    const row = res.rows[0];
    if (!row) return null;
    return {
      evidenceId: Number(row.evidenceId),
      achievementId: Number(row.achievementId),
      isRemoved: Boolean(row.isRemoved),
      updatedAt: row.updatedAt,
    };
  }
}

export const evidenceRepository = new EvidenceRepository();
export default evidenceRepository;
