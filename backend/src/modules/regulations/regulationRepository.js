import { query } from '../../utils/dbHelper.js';

export async function findDocumentById(client, documentId) {
  const result = await query(
    `SELECT * FROM app.regulation_documents WHERE document_id = $1`,
    [documentId],
    client
  );
  return result.rows[0] || null;
}

export async function findDocumentByCode(client, documentCode) {
  const result = await query(
    `SELECT * FROM app.regulation_documents WHERE document_code = $1`,
    [documentCode],
    client
  );
  return result.rows[0] || null;
}

export async function listDocuments(client, { documentType, asOfDate, confirmedOnly = false, status } = {}) {
  const params = [];
  let sql = `
    SELECT d.*,
      (SELECT COUNT(*)::int FROM app.regulation_document_versions v WHERE v.document_id = d.document_id) as versions_count,
      (SELECT json_agg(json_build_object(
        'versionId', v.version_id,
        'versionNumber', v.version_number,
        'sha256Hash', v.sha256_hash,
        'effectiveFrom', v.effective_from::text,
        'effectiveTo', v.effective_to::text,
        'supersedesVersionId', v.supersedes_version_id,
        'isConfirmed', v.is_confirmed,
        'lhuApplicationStatus', v.lhu_application_status
      ) ORDER BY v.effective_from DESC)
      FROM app.regulation_document_versions v
      WHERE v.document_id = d.document_id
      ${asOfDate ? `AND v.effective_from <= $${params.length + 1} AND (v.effective_to IS NULL OR v.effective_to >= $${params.length + 1})` : ''}
      ${confirmedOnly ? 'AND v.is_confirmed = true' : ''}
      ${status ? `AND v.lhu_application_status = $${params.length + (asOfDate ? 2 : 1)}` : ''}
      ) as active_versions
    FROM app.regulation_documents d
    WHERE d.is_active = true
  `;

  if (asOfDate) params.push(asOfDate);
  if (status) params.push(status);

  if (documentType) {
    params.push(documentType);
    sql += ` AND d.document_type = $${params.length}`;
  }

  sql += ` ORDER BY d.created_at DESC`;

  const result = await query(sql, params, client);
  return result.rows;
}

export async function createDocument(client, { documentCode, title, issuingAuthority, documentType, description }) {
  const result = await query(
    `INSERT INTO app.regulation_documents (document_code, title, issuing_authority, document_type, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [documentCode, title, issuingAuthority || null, documentType, description || null],
    client
  );
  return result.rows[0];
}

export async function findVersionById(client, versionId) {
  const result = await query(
    `SELECT v.*,
            v.effective_from::text as effective_from_str,
            v.effective_to::text as effective_to_str,
            v.signed_date::text as signed_date_str,
            d.document_code, d.title as document_title, d.document_type,
            u.display_name as created_by_name,
            c.display_name as confirmed_by_name,
            sv.version_number as supersedes_version_number
     FROM app.regulation_document_versions v
     JOIN app.regulation_documents d ON d.document_id = v.document_id
     JOIN app.users u ON u.user_id = v.created_by
     LEFT JOIN app.users c ON c.user_id = v.confirmed_by
     LEFT JOIN app.regulation_document_versions sv ON sv.version_id = v.supersedes_version_id
     WHERE v.version_id = $1`,
    [versionId],
    client
  );
  return result.rows[0] || null;
}

export async function findVersionByDocAndNumber(client, documentId, versionNumber) {
  const result = await query(
    `SELECT * FROM app.regulation_document_versions WHERE document_id = $1 AND version_number = $2`,
    [documentId, versionNumber],
    client
  );
  return result.rows[0] || null;
}

export async function listVersionsByDocumentId(client, documentId, { asOfDate, confirmedOnly = false } = {}) {
  const params = [documentId];
  let sql = `
    SELECT v.*,
           v.effective_from::text as effective_from_str,
           v.effective_to::text as effective_to_str,
           v.signed_date::text as signed_date_str,
           sv.version_number as supersedes_version_number,
           c.display_name as confirmed_by_name,
           (SELECT COUNT(*)::int FROM app.regulation_chunks ch WHERE ch.version_id = v.version_id) as chunks_count,
           (SELECT COUNT(*)::int FROM app.award_criteria_versions cr WHERE cr.version_id = v.version_id) as criteria_count
    FROM app.regulation_document_versions v
    LEFT JOIN app.regulation_document_versions sv ON sv.version_id = v.supersedes_version_id
    LEFT JOIN app.users c ON c.user_id = v.confirmed_by
    WHERE v.document_id = $1
  `;

  if (asOfDate) {
    params.push(asOfDate);
    sql += ` AND v.effective_from <= $${params.length} AND (v.effective_to IS NULL OR v.effective_to >= $${params.length})`;
  }

  if (confirmedOnly) {
    sql += ` AND v.is_confirmed = true`;
  }

  sql += ` ORDER BY v.effective_from DESC, v.created_at DESC`;

  const result = await query(sql, params, client);
  return result.rows;
}

export async function createVersion(client, data, createdBy) {
  const {
    documentId,
    versionNumber,
    sha256Hash,
    sourceUrl,
    signedDate,
    effectiveFrom,
    effectiveTo,
    supersedesVersionId,
    isOfficial = true,
    lhuApplicationStatus = 'INTERNAL_CRITERIA_UNCONFIRMED',
  } = data;

  const result = await query(
    `INSERT INTO app.regulation_document_versions (
       document_id, version_number, sha256_hash, source_url,
       signed_date, effective_from, effective_to, supersedes_version_id,
       is_official, is_confirmed, lhu_application_status, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11)
     RETURNING *, effective_from::text as effective_from_str, effective_to::text as effective_to_str`,
    [
      documentId,
      versionNumber,
      sha256Hash,
      sourceUrl || null,
      signedDate || null,
      effectiveFrom,
      effectiveTo || null,
      supersedesVersionId || null,
      isOfficial,
      lhuApplicationStatus,
      createdBy,
    ],
    client
  );
  return result.rows[0];
}

export async function confirmVersion(client, versionId, { isConfirmed, lhuApplicationStatus, confirmationNotes, confirmedBy }) {
  const result = await query(
    `UPDATE app.regulation_document_versions
     SET is_confirmed = $1,
         lhu_application_status = $2,
         confirmation_notes = $3,
         confirmed_by = $4,
         confirmed_at = NOW()
     WHERE version_id = $5
     RETURNING *, effective_from::text as effective_from_str, effective_to::text as effective_to_str`,
    [isConfirmed, lhuApplicationStatus, confirmationNotes || null, confirmedBy, versionId],
    client
  );
  return result.rows[0] || null;
}

// Chunks
export async function listChunksByVersionId(client, versionId) {
  const result = await query(
    `SELECT * FROM app.regulation_chunks WHERE version_id = $1 ORDER BY page_no ASC NULLS LAST, chunk_id ASC`,
    [versionId],
    client
  );
  return result.rows;
}

export async function createChunk(client, { versionId, articleNo, clauseNo, pageNo, content, chunkHash }) {
  const result = await query(
    `INSERT INTO app.regulation_chunks (version_id, article_no, clause_no, page_no, content, chunk_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [versionId, articleNo || null, clauseNo || null, pageNo || null, content, chunkHash],
    client
  );
  return result.rows[0];
}

export async function batchCreateChunks(client, versionId, chunks) {
  const inserted = [];
  for (const chunk of chunks) {
    const item = await createChunk(client, { ...chunk, versionId });
    inserted.push(item);
  }
  return inserted;
}

// Award Criteria Versions
export async function findCriteriaVersionById(client, criteriaVersionId) {
  const result = await query(
    `SELECT c.*,
            v.version_number, v.sha256_hash, v.lhu_application_status, v.is_confirmed as is_version_confirmed,
            d.document_code, d.title as document_title,
            u.display_name as confirmed_by_name
     FROM app.award_criteria_versions c
     JOIN app.regulation_document_versions v ON v.version_id = c.version_id
     JOIN app.regulation_documents d ON d.document_id = v.document_id
     LEFT JOIN app.users u ON u.user_id = c.confirmed_by
     WHERE c.criteria_version_id = $1`,
    [criteriaVersionId],
    client
  );
  return result.rows[0] || null;
}

export async function listCriteriaVersions(client, { versionId, asOfDate, confirmedOnly = true, targetType } = {}) {
  const params = [];
  let sql = `
    SELECT c.*,
           v.version_number, v.sha256_hash, v.lhu_application_status,
           v.effective_from::text as effective_from_str,
           v.effective_to::text as effective_to_str,
           d.document_code, d.title as document_title,
           u.display_name as confirmed_by_name
    FROM app.award_criteria_versions c
    JOIN app.regulation_document_versions v ON v.version_id = c.version_id
    JOIN app.regulation_documents d ON d.document_id = v.document_id
    LEFT JOIN app.users u ON u.user_id = c.confirmed_by
    WHERE 1=1
  `;

  if (versionId) {
    params.push(versionId);
    sql += ` AND c.version_id = $${params.length}`;
  }

  if (asOfDate) {
    params.push(asOfDate);
    sql += ` AND v.effective_from <= $${params.length} AND (v.effective_to IS NULL OR v.effective_to >= $${params.length})`;
  }

  if (confirmedOnly) {
    sql += ` AND c.is_confirmed = true AND v.is_confirmed = true`;
  }

  if (targetType) {
    params.push(targetType);
    sql += ` AND (c.target_type = $${params.length} OR c.target_type = 'BOTH')`;
  }

  sql += ` ORDER BY c.criterion_code ASC`;

  const result = await query(sql, params, client);
  return result.rows;
}

export async function createCriteriaVersion(client, data) {
  const {
    versionId,
    criterionCode,
    name,
    targetType,
    academicYearId,
    minThreshold,
    unitMetric,
    legalReferences,
    notes,
  } = data;

  const result = await query(
    `INSERT INTO app.award_criteria_versions (
       version_id, criterion_code, name, target_type, academic_year_id,
       min_threshold, unit_metric, legal_references, is_confirmed, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9)
     RETURNING *`,
    [
      versionId,
      criterionCode,
      name,
      targetType,
      academicYearId || null,
      minThreshold !== undefined ? minThreshold : null,
      unitMetric || null,
      legalReferences || null,
      notes || null,
    ],
    client
  );
  return result.rows[0];
}

export async function confirmCriteriaVersion(client, criteriaVersionId, { isConfirmed, notes, confirmedBy }) {
  const result = await query(
    `UPDATE app.award_criteria_versions
     SET is_confirmed = $1,
         notes = COALESCE($2, notes),
         confirmed_by = $3,
         confirmed_at = NOW()
     WHERE criteria_version_id = $4
     RETURNING *`,
    [isConfirmed, notes || null, confirmedBy, criteriaVersionId],
    client
  );
  return result.rows[0] || null;
}
