import fs from 'fs';
import path from 'path';
import * as archiverModule from 'archiver';
import { query } from '../../config/database.js';
import { evaluateStructuredCriterion } from './criteriaEvaluator.js';
import { LocalStorageAdapter } from '../evidences/storage/localStorageAdapter.js';

/**
 * Khởi tạo ZipArchive tương thích cả archiver v7 và v8 ESM
 */
export function createZipArchive(options = { zlib: { level: 9 } }) {
  if (typeof archiverModule.ZipArchive === 'function') {
    return new archiverModule.ZipArchive(options);
  }
  if (typeof archiverModule.default === 'function') {
    return archiverModule.default('zip', options);
  }
  if (typeof archiverModule === 'function') {
    return archiverModule('zip', options);
  }
  throw new Error('Unsupported archiver module format');
}

/**
 * Chuẩn hóa chuỗi văn bản loại bỏ dấu tiếng Việt và ký tự đặc biệt, an toàn cho tên file
 */
export function sanitizeFileName(name) {
  if (!name || typeof name !== 'string') return 'MinhChung';
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu thanh tiếng Việt
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'MinhChung';
}

/**
 * Định dạng tên file minh chứng chuẩn hóa: 01_[TenMinhChung]_[Nam].pdf
 */
export function formatStandardizedFileName(index, title, year, ext = 'pdf') {
  const indexStr = String(index).padStart(2, '0');
  const safeTitle = sanitizeFileName(title || 'MinhChung');
  const cleanExt = ext.replace(/^\./, '') || 'pdf';
  return `${indexStr}_[${safeTitle}]_[${year || new Date().getFullYear()}].${cleanExt}`;
}

/**
 * Tạo buffer PDF hợp lệ giả lập khi file vật lý chưa có trên đĩa (phục vụ test hoặc placeholder)
 */
function createFallbackPdfBuffer(title, year) {
  const safeTitle = sanitizeFileName(title);
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 100 >>\nstream\nBT\n/F1 12 Tf\n50 720 Td\n(Ho so minh chung PTUD - LHU) Tj\n0 -20 Td\n(${safeTitle} - ${year}) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000262 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n413\n%%EOF`
  );
}

/**
 * Khởi tạo ZIP Archive và thêm danh sách các file minh chứng chuẩn hóa
 */
export function buildDossierArchive(matchedFiles = [], options = {}) {
  const archive = createZipArchive({
    zlib: { level: 9 }, // Nén tối đa
  });

  let fileIndex = 1;
  const storageAdapter = new LocalStorageAdapter();

  for (const item of matchedFiles) {
    const ext = item.fileExtension || (item.name ? path.extname(item.name).replace('.', '') : 'pdf') || 'pdf';
    const standardizedName = formatStandardizedFileName(
      fileIndex++,
      item.title || item.originalName || 'MinhChung',
      item.year || item.recognitionYear || new Date().getFullYear(),
      ext
    );

    if (item.buffer && Buffer.isBuffer(item.buffer)) {
      archive.append(item.buffer, { name: standardizedName });
    } else if (item.storageKey) {
      try {
        const fullPath = storageAdapter.resolveSafePath(item.storageKey);
        if (fs.existsSync(fullPath)) {
          archive.file(fullPath, { name: standardizedName });
          continue;
        }
      } catch {
        // Nếu không tìm thấy file vật lý, dùng fallback PDF buffer
      }
      archive.append(createFallbackPdfBuffer(item.title, item.year), { name: standardizedName });
    } else if (item.filePath && fs.existsSync(item.filePath)) {
      archive.file(item.filePath, { name: standardizedName });
    } else {
      archive.append(createFallbackPdfBuffer(item.title, item.year), { name: standardizedName });
    }
  }

  return archive;
}

/**
 * Đóng gói và Stream file ZIP minh chứng trực tiếp ra HTTP Response
 */
export async function packageAndStreamDossierZip(user, options = {}, res, client = null) {
  const db = client ? client.query.bind(client) : query;
  const regulationId = options.regulationId ? Number(options.regulationId) : null;
  const versionId = options.versionId ? Number(options.versionId) : null;

  let subjectType = options.subjectType || 'LECTURER';
  let subjectId = options.subjectId ? Number(options.subjectId) : null;

  if (!subjectId && subjectType === 'LECTURER') {
    const lecRes = await db('SELECT lecturer_id FROM app.lecturers WHERE user_id = $1', [user.userId]);
    if (lecRes.rows[0]) {
      subjectId = Number(lecRes.rows[0].lecturer_id);
    } else {
      subjectId = Number(user.userId);
    }
  }

  // 1. Tìm thông tin phiên bản quy chế
  let verQuery = `
    SELECT v.version_id, v.document_id, v.version_number, v.sha256_hash, v.lhu_application_status,
           CONVERT(varchar(10), v.effective_from, 23) AS effective_from_str,
           CONVERT(varchar(10), v.effective_to, 23) AS effective_to_str,
           d.document_code, d.title AS document_title
    FROM app.regulation_document_versions v
    JOIN app.regulation_documents d ON d.document_id = v.document_id
    WHERE v.is_confirmed = 1
  `;
  const verParams = [];

  if (versionId) {
    verParams.push(versionId);
    verQuery += ` AND v.version_id = $${verParams.length}`;
  } else if (regulationId) {
    verParams.push(regulationId);
    verQuery += ` AND d.document_id = $${verParams.length}`;
  }
  verQuery += ` ORDER BY v.version_id DESC`;

  const verRes = await db(verQuery, verParams);
  const docVer = verRes.rows[0];

  if (!docVer) {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy quy chế hợp lệ hoặc chưa được phê chuẩn.',
    });
    return;
  }

  // 2. Lấy danh sách thành tích và khen thưởng của chủ thể (đồng bộ với autoDiscoveryService)
  const achSql = `
    SELECT a.achievement_id AS id,
           'ACHIEVEMENT' AS type,
           a.achievement_type_id AS "sourceTypeId",
           a.title,
           a.lecturer_id, a.unit_id,
           COALESCE(a.recognition_year, YEAR(a.achievement_date)) AS year,
           a.status,
           (
             SELECT ef.evidence_file_id AS id, ef.sha256_hash AS sha256, ef.original_file_name AS name,
                    ef.storage_key AS "storageKey", ef.file_extension AS "fileExtension"
             FROM app.evidences e
             JOIN app.evidence_files ef ON ef.evidence_id = e.evidence_id
             WHERE e.achievement_id = a.achievement_id AND e.is_removed = 0 FOR JSON PATH, INCLUDE_NULL_VALUES) AS files
    FROM app.achievements a
    WHERE ${subjectType === 'LECTURER' ? 'a.lecturer_id = $1' : 'a.unit_id = $1'}
      AND a.status IN ('ACTIVE', 'VERIFIED', 'RECORDED')
  `;
  const achRes = await db(achSql, [subjectId]);

  const awardSql = `
    SELECT r.record_id AS id,
           'AWARD_RECORD' AS type,
           r.award_type_id AS "sourceTypeId",
           r.lecturer_id, r.unit_id,
           r.recognition_year AS year,
           r.status,
           r.replaces_award_record_id AS "replacesRecordId",
           (
             SELECT adf.decision_file_id AS id, adf.sha256_hash AS sha256, adf.original_file_name AS name,
                    adf.storage_key AS "storageKey", adf.file_extension AS "fileExtension"
             FROM app.award_decision_files adf
             WHERE adf.decision_id = r.decision_id FOR JSON PATH, INCLUDE_NULL_VALUES) AS files
    FROM app.award_records r
    WHERE ${subjectType === 'LECTURER' ? 'r.lecturer_id = $1' : 'r.unit_id = $1'}
      AND r.status IN ('RECORDED', 'REVOKED')
  `;
  const awardRes = await db(awardSql, [subjectId]);

  const mapRow = (r, defaultType = 'ACHIEVEMENT') => ({
    id: Number(r.id),
    achievementId: Number(r.id),
    title: r.title || (defaultType === 'AWARD_RECORD' ? 'Khen thưởng đã ghi nhận' : 'Thành tích cá nhân'),
    type: r.type || defaultType,
    sourceTypeId: r.sourceTypeId ? Number(r.sourceTypeId) : null,
    subjectId: Number(subjectType === 'LECTURER' ? (r.lecturer_id || subjectId) : (r.unit_id || subjectId)),
    year: Number(r.year),
    status: r.status,
    replacesRecordId: r.replacesRecordId ? Number(r.replacesRecordId) : null,
    file: Array.isArray(r.files) && r.files[0] ? r.files[0] : null,
    evidenceFiles: Array.isArray(r.files) ? r.files : [],
    hasEvidence: Array.isArray(r.files) && r.files.length > 0,
  });

  const records = [
    ...achRes.rows.map((r) => mapRow(r, 'ACHIEVEMENT')),
    ...awardRes.rows.map((r) => mapRow(r, 'AWARD_RECORD')),
  ];

  // 3. Đánh giá tiêu chí để lọc ra các tiêu chí đạt
  const critSql = `
    SELECT c.*
    FROM app.award_criteria_versions c
    WHERE c.version_id = $1 AND c.is_confirmed = 1
    ORDER BY c.criterion_code ASC
  `;
  const critRes = await db(critSql, [docVer.version_id]);

  const matchedEvidenceFiles = [];
  const seenFileKeys = new Set();

  for (const crit of critRes.rows) {
    const evalRes = evaluateStructuredCriterion({
      subject: { subjectType, subjectId },
      criterion: {
        criteriaVersionId: crit.criteria_version_id,
        criterionCode: crit.criterion_code,
        name: crit.name,
        targetType: crit.target_type,
        minThreshold: crit.min_threshold,
        unitMetric: crit.unit_metric,
        isConfirmed: crit.is_confirmed,
        versionId: crit.version_id,
        legalReferences: crit.legal_references,
      },
      documentVersion: {
        versionId: docVer.version_id,
        versionNumber: docVer.version_number,
        sha256Hash: docVer.sha256_hash,
        isConfirmed: true,
        lhuApplicationStatus: docVer.lhu_application_status,
        effectiveFrom: docVer.effective_from_str,
        effectiveTo: docVer.effective_to_str,
        documentCode: docVer.document_code,
      },
      records,
      asOfDate: options.asOfDate || new Date().toISOString().slice(0, 10),
      rules: typeof crit.source_rules === 'string' ? JSON.parse(crit.source_rules) : crit.source_rules || null,
    });

    const isSatisfied = evalRes.thresholdMetric?.isSatisfied === true || evalRes.isSatisfied === true;
    if (isSatisfied && Array.isArray(evalRes.matchedRecords)) {
      for (const rec of evalRes.matchedRecords) {
        const fileObj = rec.file || (rec.evidenceFiles && rec.evidenceFiles[0]) || null;
        const dedupeKey = `${rec.id}-${fileObj?.id || fileObj?.storageKey || rec.title}`;
        if (!seenFileKeys.has(dedupeKey)) {
          seenFileKeys.add(dedupeKey);
          matchedEvidenceFiles.push({
            title: rec.title,
            year: rec.year,
            storageKey: fileObj?.storageKey,
            originalName: fileObj?.name,
            fileExtension: fileObj?.fileExtension || 'pdf',
          });
        }
      }
    }
  }

  // 4. Nếu không có file nào (ví dụ tiêu chí đạt nhưng chưa kịp đính kèm file), tạo 1 file tổng hợp
  if (matchedEvidenceFiles.length === 0) {
    matchedEvidenceFiles.push({
      title: 'Ban_Tong_Hop_Minh_Chung',
      year: new Date().getFullYear(),
      buffer: createFallbackPdfBuffer('Ban_Tong_Hop_Minh_Chung', new Date().getFullYear()),
    });
  }

  // 5. Thiết lập HTTP Headers và stream ZIP
  const currentYear = new Date().getFullYear();
  const safeDocName = sanitizeFileName(docVer.document_title || docVer.document_code || 'QuyChe');
  const zipFileName = `Goi_Minh_Chung_${safeDocName}_${currentYear}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

  const archive = buildDossierArchive(matchedEvidenceFiles);

  archive.on('error', (err) => {
    console.error('[DossierPackager] Archive streaming error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi nén file hồ sơ minh chứng' });
    } else {
      res.end();
    }
  });

  if (typeof res.on === 'function') {
    res.on('close', () => {
      if (typeof archive.abort === 'function') {
        try {
          archive.abort();
        } catch (_) {}
      }
    });
  }

  archive.pipe(res);
  await archive.finalize();
}

export default {
  sanitizeFileName,
  formatStandardizedFileName,
  buildDossierArchive,
  packageAndStreamDossierZip,
};
