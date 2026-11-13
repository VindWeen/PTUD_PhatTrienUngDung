import { query } from '../../config/database.js';
import { evaluateStructuredCriterion } from './criteriaEvaluator.js';

/**
 * Auto-Discovery Service (Khám Ngược):
 * Tự động quét toàn bộ quy chế / danh hiệu đang mở (is_confirmed = 1),
 * đối chiếu kho thành tích cá nhân (ACTIVE, VERIFIED, RECORDED) với các tiêu chí,
 * tính toán tỷ lệ phần trăm hoàn thành và xếp hạng các danh hiệu tiềm năng từ cao xuống thấp.
 */
export async function discoverEligibleRegulations(user, options = {}, client = null) {
  const db = client ? client.query.bind(client) : query;
  const asOfDate = options.asOfDate || new Date().toISOString().slice(0, 10);

  // 1. Xác định Subject (Chủ thể: Mặc định LECTURER của user hiện tại)
  let subjectType = options.subjectType || 'LECTURER';
  let subjectId = options.subjectId ? Number(options.subjectId) : null;

  if (!subjectId && subjectType === 'LECTURER') {
    const lecRes = await db(
      'SELECT lecturer_id FROM app.lecturers WHERE user_id = $1',
      [user.userId]
    );
    if (lecRes.rows[0]) {
      subjectId = Number(lecRes.rows[0].lecturer_id);
    } else {
      subjectId = Number(user.userId);
    }
  }

  // 2. Tải danh sách thành tích và hồ sơ khen thưởng của chủ thể
  const achSql = `
    SELECT a.achievement_id AS id,
           'ACHIEVEMENT' AS type,
           a.achievement_type_id AS "sourceTypeId",
           a.title,
           a.lecturer_id, a.unit_id,
           COALESCE(a.recognition_year, YEAR(a.achievement_date)) AS year,
           a.status,
           a.replaces_achievement_id AS "replacesRecordId",
           (
             SELECT ef.evidence_file_id AS id, ef.sha256_hash AS sha256, ef.original_file_name AS name, ef.storage_key AS "storageKey"
             FROM app.evidences e
             JOIN app.evidence_files ef ON ef.evidence_id = e.evidence_id
             WHERE e.achievement_id = a.achievement_id AND e.is_removed = 0 FOR JSON PATH, INCLUDE_NULL_VALUES) AS files
    FROM app.achievements a
    WHERE ${subjectType === 'LECTURER' ? 'a.lecturer_id = $1' : 'a.unit_id = $1'}
      AND a.status IN ('ACTIVE', 'VERIFIED', 'RECORDED', 'REVOKED', 'CANCELLED')
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
             SELECT adf.decision_file_id AS id, adf.sha256_hash AS sha256, adf.original_file_name AS name
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
    subjectId: Number(subjectType === 'LECTURER' ? (r.lecturer_id || r.subjectId) : (r.unit_id || r.subjectId)),
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

  // 3. Tải danh sách quy chế mở đã phê chuẩn (is_confirmed = 1)
  const verSql = `
    SELECT v.version_id, v.document_id, v.version_number, v.sha256_hash, v.lhu_application_status,
           CONVERT(varchar(10), v.effective_from, 23) AS effective_from_str,
           CONVERT(varchar(10), v.effective_to, 23) AS effective_to_str,
           d.document_code, d.title AS document_title, d.document_type,
           (SELECT TOP 1 p.name FROM app.award_periods p WHERE p.status = 'OPEN' ORDER BY p.end_date ASC) AS period_name,
           (SELECT TOP 1 CONVERT(varchar(10), p.end_date, 23) FROM app.award_periods p WHERE p.status = 'OPEN' ORDER BY p.end_date ASC) AS period_end_date
    FROM app.regulation_document_versions v
    JOIN app.regulation_documents d ON d.document_id = v.document_id
    WHERE v.is_confirmed = 1
    ORDER BY v.version_id DESC
  `;
  const verRes = await db(verSql);

  // 4. Với mỗi phiên bản quy chế, lấy tiêu chí và chạy đánh giá
  const discoveryResults = [];
  const targetType = subjectType === 'LECTURER' ? 'INDIVIDUAL' : 'COLLECTIVE';

  for (const ver of verRes.rows) {
    const critSql = `
      SELECT c.*
      FROM app.award_criteria_versions c
      WHERE c.version_id = $1 AND c.is_confirmed = 1
        AND (c.target_type = $2 OR c.target_type = 'BOTH')
      ORDER BY c.criterion_code ASC
    `;
    const critRes = await db(critSql, [ver.version_id, targetType]);
    const criteriaList = critRes.rows;

    if (criteriaList.length === 0) continue;

    let satisfiedCount = 0;
    const evaluatedCriteria = [];

    for (const crit of criteriaList) {
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
          versionId: ver.version_id,
          versionNumber: ver.version_number,
          sha256Hash: ver.sha256_hash,
          isConfirmed: true,
          lhuApplicationStatus: ver.lhu_application_status,
          effectiveFrom: ver.effective_from_str,
          effectiveTo: ver.effective_to_str,
          documentCode: ver.document_code,
        },
        records,
        asOfDate,
        rules: typeof crit.source_rules === 'string' ? JSON.parse(crit.source_rules) : crit.source_rules || null,
      });

      const isSatisfied = evalRes.thresholdMetric?.isSatisfied === true || evalRes.isSatisfied === true;
      if (isSatisfied) satisfiedCount++;

      evaluatedCriteria.push({
        criterionId: evalRes.criterionId,
        criterionCode: evalRes.criterionCode,
        name: evalRes.criterionName,
        isSatisfied,
        matchedRecords: evalRes.matchedRecords || [],
        missingCount: evalRes.missingCount || 0,
        thresholdMetric: evalRes.thresholdMetric,
        aiAnalysis: evalRes.aiAnalysis,
      });
    }

    const totalCount = evaluatedCriteria.length;
    const percentage = totalCount > 0 ? Math.round((satisfiedCount / totalCount) * 100) : 0;

    discoveryResults.push({
      regulationId: Number(ver.document_id),
      documentId: Number(ver.document_id),
      documentCode: ver.document_code,
      versionId: Number(ver.version_id),
      versionNumber: ver.version_number,
      name: ver.document_title || ver.document_code,
      documentType: ver.document_type,
      percentage,
      satisfiedCount,
      totalCount,
      isEligible: totalCount > 0 && satisfiedCount === totalCount,
      deadline: ver.period_end_date || ver.effective_to_str || null,
      periodName: ver.period_name || null,
      criteria: evaluatedCriteria,
    });
  }

  // 5. Xếp hạng giảm dần theo tỷ lệ % hoàn thành, sau đó số tiêu chí đạt
  discoveryResults.sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    if (b.satisfiedCount !== a.satisfiedCount) return b.satisfiedCount - a.satisfiedCount;
    return a.name.localeCompare(b.name);
  });

  return {
    success: true,
    data: discoveryResults,
  };
}

export default {
  discoverEligibleRegulations,
};
