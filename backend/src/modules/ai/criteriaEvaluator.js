import crypto from 'node:crypto';

/**
 * SHA-256 helper
 */
export function hashSha256(content) {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Chuẩn hóa input snapshot và tạo hash định danh
 */
export function buildInputSnapshot({
  subject,
  criterion,
  documentVersion,
  records = [],
  asOfDate,
  rules = null,
}) {
  const snapshot = {
    schemaVersion: 1,
    snapshotDate: new Date().toISOString(),
    asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
    subject: {
      subjectType: subject.subjectType,
      subjectId: Number(subject.subjectId),
    },
    criterion: {
      criterionId: Number(criterion.criteriaVersionId || criterion.criterionId),
      criterionCode: criterion.criterionCode,
      criterionName: criterion.name || criterion.criterionName,
      targetType: criterion.targetType || criterion.target_type,
      minThreshold: criterion.minThreshold !== undefined ? Number(criterion.minThreshold) : null,
      unitMetric: criterion.unitMetric || criterion.unit_metric || null,
      isConfirmed: Boolean(criterion.isConfirmed ?? criterion.is_confirmed),
      versionId: Number(criterion.versionId || criterion.version_id),
      rules: rules || null,
    },
    documentVersion: {
      versionId: Number(documentVersion.versionId || documentVersion.version_id),
      versionNumber: documentVersion.versionNumber || documentVersion.version_number,
      sha256Hash: documentVersion.sha256Hash || documentVersion.sha256_hash,
      isConfirmed: Boolean(documentVersion.isConfirmed ?? documentVersion.is_confirmed),
      lhuApplicationStatus: documentVersion.lhuApplicationStatus || documentVersion.lhu_application_status,
      effectiveFrom: documentVersion.effectiveFrom || documentVersion.effective_from,
      effectiveTo: documentVersion.effectiveTo || documentVersion.effective_to || null,
    },
    records: records.map((r) => ({
      id: Number(r.id || r.achievementId || r.recordId),
      type: r.type || (r.recordId ? 'AWARD_RECORD' : 'ACHIEVEMENT'),
      subjectId: Number(r.subjectId || r.lecturerId || r.unitId),
      year: Number(r.year || r.recognitionYear || (r.achievementDate ? new Date(r.achievementDate).getFullYear() : null)),
      status: r.status,
      replacesRecordId: r.replacesRecordId || r.replacesAchievementId || r.replacesAwardRecordId || null,
      file: r.file
        ? {
            id: r.file.id || r.file.evidenceFileId,
            sha256: r.file.sha256 || r.file.sha256Hash,
            originalFileName: r.file.originalFileName || r.file.name,
          }
        : null,
      hasEvidence: Boolean(r.file || (r.evidenceFiles && r.evidenceFiles.length > 0) || r.hasEvidence),
    })),
  };

  const inputHash = hashSha256(JSON.stringify(snapshot));
  return { snapshot, inputHash };
}

/**
 * Deterministic Criteria Evaluator
 * Xử lý hoàn toàn bằng code xác định, không dùng LLM để tự đếm năm hay tính ngưỡng.
 * 
 * Nghiệm thu W4-Q1:
 * - Không dùng LLM để tự đếm năm
 * - Loại hồ sơ thu hồi (REVOKED / CANCELLED)
 * - Thiếu chứng cứ không mặc định không đạt (NEEDS_HUMAN_REVIEW)
 * - Không có đường tự ghi nhận khen thưởng (automaticAwardGranted: false)
 */
export function evaluateStructuredCriterion({
  subject,
  criterion,
  documentVersion,
  records = [],
  asOfDate = new Date().toISOString().slice(0, 10),
  rules = null,
}) {
  const issues = new Set();
  const subjectId = Number(subject.subjectId);
  const activeRecords = [];

  // 1. Phân loại và sàng lọc từng bản ghi hồ sơ
  for (const record of records) {
    const recSubId = Number(record.subjectId || record.lecturerId || record.unitId);
    if (recSubId !== subjectId) {
      issues.add('WRONG_SUBJECT');
      continue;
    }

    // Loại trừ tuyệt đối hồ sơ thu hồi / bị hủy
    if (record.status === 'REVOKED' || record.status === 'CANCELLED') {
      issues.add('REVOKED_SOURCE');
      continue;
    }

    // Chỉ chấp nhận hồ sơ ở trạng thái VERIFIED (đã thẩm định đạt) hoặc RECORDED (đã ghi nhận khen thưởng)
    if (!['VERIFIED', 'RECORDED'].includes(record.status)) {
      issues.add('MISSING_DATA');
      continue;
    }

    // Kiểm tra tính hợp lệ của năm
    const year = Number(record.year || record.recognitionYear || (record.achievementDate ? new Date(record.achievementDate).getFullYear() : null));
    if (!Number.isInteger(year) || year < 1990 || year > 2100) {
      issues.add('MISSING_DATA');
      continue;
    }

    // Kiểm tra chứng cứ đính kèm
    const hasValidEvidence = Boolean(
      (record.file && record.file.sha256 && /^[a-f0-9]{64}$/i.test(record.file.sha256)) ||
      (record.evidenceFiles && record.evidenceFiles.length > 0) ||
      record.hasEvidence
    );

    if (!hasValidEvidence) {
      issues.add('MISSING_DATA');
      continue;
    }

    activeRecords.push({
      ...record,
      normalizedYear: year,
    });
  }

  // 2. Tính toán Năm phân biệt (Distinct Years)
  const distinctYears = [...new Set(activeRecords.map((r) => r.normalizedYear))].sort((a, b) => a - b);
  if (distinctYears.length < activeRecords.length) {
    issues.add('DUPLICATE_YEAR');
  }

  // 3. Tính toán Chuỗi năm liên tục (Consecutive Years)
  const isConsecutive = distinctYears.length > 0 && distinctYears.every((y, i) => i === 0 || y === distinctYears[i - 1] + 1);
  const requireConsecutive = Boolean(rules?.requireConsecutive);
  if (requireConsecutive && distinctYears.length > 1 && !isConsecutive) {
    issues.add('YEAR_GAP');
  }

  // 4. Kiểm tra cửa sổ hiệu lực của Văn bản quy định
  const docEffectiveFrom = documentVersion.effectiveFrom || documentVersion.effective_from;
  const docEffectiveTo = documentVersion.effectiveTo || documentVersion.effective_to;
  if (
    (docEffectiveFrom && asOfDate < String(docEffectiveFrom).slice(0, 10)) ||
    (docEffectiveTo && asOfDate > String(docEffectiveTo).slice(0, 10))
  ) {
    issues.add('OUT_OF_EFFECTIVE_WINDOW');
  }

  // 5. Kiểm tra tính xác thực / phê duyệt của Văn bản & Tiêu chí LHU
  const isDocConfirmed = Boolean(documentVersion.isConfirmed ?? documentVersion.is_confirmed);
  const isDocLhuPolicy = (documentVersion.lhuApplicationStatus || documentVersion.lhu_application_status) === 'CONFIRMED_LHU_POLICY';
  const isCriterionConfirmed = Boolean(criterion.isConfirmed ?? criterion.is_confirmed);
  const isSimulation =
    (documentVersion.lhuApplicationStatus || documentVersion.lhu_application_status) === 'SIMULATION_ONLY' ||
    String(criterion.criterionCode || '').startsWith('SIM-') ||
    Boolean(rules?.isSimulation);

  if (!isDocConfirmed || !isDocLhuPolicy) {
    issues.add('UNAPPROVED_DOCUMENT');
  }
  if (!isCriterionConfirmed) {
    issues.add('UNAPPROVED_CRITERION');
  }
  if (isSimulation) {
    issues.add('SIMULATED_KPI');
  }

  // 6. Xác định ngưỡng tối thiểu và chỉ số thực tế
  // Nếu tiêu chí là năm phân biệt (qua rules hoặc unit_metric)
  const isYearBased = Boolean(rules?.minimumDistinctYears) || String(criterion.unitMetric || criterion.unit_metric || '').toLowerCase().includes('năm');
  const targetMin = isYearBased
    ? (rules?.minimumDistinctYears || Number(criterion.minThreshold || criterion.min_threshold || 1))
    : Number(criterion.minThreshold || criterion.min_threshold || 1);
  
  const actualRecorded = isYearBased ? distinctYears.length : activeRecords.length;

  // 7. So sánh ngưỡng theo nguyên tắc: THIẾU CHỨNG CỨ KHÔNG MẶC ĐỊNH KHÔNG ĐẠT
  const hasDataIntegrityIssue = ['MISSING_DATA', 'REVOKED_SOURCE', 'WRONG_SUBJECT'].some((issue) => issues.has(issue));
  if (actualRecorded < targetMin && !hasDataIntegrityIssue) {
    issues.add('BELOW_THRESHOLD');
  }

  // 8. Đánh giá kết quả tiêu chí (Criterion Result)
  let isSatisfied;
  let overallConclusion;
  let humanReviewRequired = true;
  let warningNotice = null;

  const isConfirmedByLhu = isDocConfirmed && isDocLhuPolicy && isCriterionConfirmed && !isSimulation;

  if (!isConfirmedByLhu) {
    // Trường hợp chưa duyệt hoặc mô phỏng: TUYỆT ĐỐI không kết luận ELIGIBLE / INELIGIBLE
    isSatisfied = 'UNCONFIRMED';
    humanReviewRequired = true;
    overallConclusion = isSimulation ? 'SIMULATION_ONLY' : 'NEEDS_HUMAN_REVIEW';
    warningNotice = 'CẢNH BÁO: Tiêu chuẩn này chưa được Hội đồng LHU phê duyệt chính thức (UNCONFIRMED / SIMULATION). Kết quả chỉ mang tính tham khảo mô phỏng.';
  } else {
    // Trường hợp chính sách LHU đã duyệt chính thức
    if (hasDataIntegrityIssue || issues.has('YEAR_GAP') || issues.has('OUT_OF_EFFECTIVE_WINDOW')) {
      // Có vấn đề dữ liệu hoặc thiếu minh chứng -> Chuyển người rà soát, không tự tiện đánh rớt
      isSatisfied = 'UNCONFIRMED';
      humanReviewRequired = true;
      overallConclusion = 'NEEDS_HUMAN_REVIEW';
      warningNotice = `Hồ sơ có dấu hiệu cần rà soát bổ sung (${[...issues].join(', ')}). Cần chuyên viên thẩm định lại.`;
    } else if (issues.has('BELOW_THRESHOLD')) {
      // Dữ liệu đầy đủ nhưng không đạt ngưỡng số lượng/năm
      isSatisfied = false;
      humanReviewRequired = false;
      overallConclusion = 'INELIGIBLE';
    } else {
      // Đầy đủ và đạt ngưỡng
      isSatisfied = true;
      humanReviewRequired = false;
      overallConclusion = 'ELIGIBLE';
    }
  }

  // 9. Diễn giải logic AI / Rule Analysis (Deterministic summary)
  const analysisParts = [];
  analysisParts.push(`Đánh giá tiêu chí [${criterion.criterionCode}]: Ghi nhận ${actualRecorded}/${targetMin} (${criterion.unitMetric || 'bản ghi/năm'}).`);
  if (distinctYears.length > 0) {
    analysisParts.push(`Các năm ghi nhận hợp lệ: [${distinctYears.join(', ')}] (${isConsecutive ? 'liên tiếp' : 'không liên tiếp'}).`);
  }
  if (issues.size > 0) {
    analysisParts.push(`Vấn đề ghi nhận: ${[...issues].sort().join(', ')}.`);
  }
  if (hasDataIntegrityIssue) {
    analysisParts.push('LƯU Ý NGHIỆP VỤ: Hồ sơ thiếu minh chứng hoặc có nguồn thu hồi, hệ thống chuyển trạng thái chờ người rà soát theo nguyên tắc không tự ý đánh rớt.');
  }

  const legalReferences = [];
  if (documentVersion.documentCode || documentVersion.document_code) {
    legalReferences.push({
      documentCode: documentVersion.documentCode || documentVersion.document_code,
      versionNumber: documentVersion.versionNumber || documentVersion.version_number,
      clauseReference: criterion.legalReferences || criterion.legal_references || 'Văn bản quy định',
      chunkHash: documentVersion.sha256Hash || documentVersion.sha256_hash,
    });
  }

  return {
    criterionId: Number(criterion.criteriaVersionId || criterion.criterionId),
    criterionCode: criterion.criterionCode,
    criterionName: criterion.name || criterion.criterionName,
    isConfirmedByLhu,
    isSimulation,
    thresholdMetric: {
      targetMin,
      actualRecorded,
      unitMetric: criterion.unitMetric || criterion.unit_metric || null,
      isSatisfied,
    },
    distinctYears: distinctYears.length,
    consecutiveYears: isConsecutive,
    legalReferences,
    aiAnalysis: analysisParts.join(' '),
    humanReviewRequired,
    warningNotice,
    overallConclusion,
    issues: [...issues].sort(),
  };
}

/**
 * Tạo một đối tượng EvaluationRun hoàn chỉnh tuân thủ Hợp đồng W3-Q4 và evaluationRunSchema
 */
export function buildEvaluationRunObject({
  runId = crypto.randomUUID(),
  evaluationType = 'CRITERION_ASSESSMENT',
  subject,
  providerInfo = { provider: 'mock', model: 'deterministic-criteria-evaluator-v1', isMock: true },
  criterionResults = [],
  usageMetrics = { promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: 0, cached: false },
  executedAt = new Date().toISOString(),
}) {
  // Tổng hợp overallConclusion từ danh sách criterionResults
  let overallConclusion = 'ELIGIBLE';
  let hasSimulation = false;
  let hasNeedsReview = false;
  let hasIneligible = false;

  for (const r of criterionResults) {
    if (r.isSimulation || !r.isConfirmedByLhu) {
      hasSimulation = true;
    }
    if (r.thresholdMetric.isSatisfied === 'UNCONFIRMED' || r.humanReviewRequired) {
      hasNeedsReview = true;
    } else if (r.thresholdMetric.isSatisfied === false) {
      hasIneligible = true;
    }
  }

  if (providerInfo.isMock || hasSimulation) {
    overallConclusion = hasNeedsReview ? 'NEEDS_HUMAN_REVIEW' : 'SIMULATION_ONLY';
  } else if (hasNeedsReview) {
    overallConclusion = 'NEEDS_HUMAN_REVIEW';
  } else if (hasIneligible) {
    overallConclusion = 'INELIGIBLE';
  } else {
    overallConclusion = 'ELIGIBLE';
  }

  const overallStatus = (hasSimulation || hasNeedsReview) ? 'FLAGGED_UNCONFIRMED' : 'COMPLETED';

  return {
    runId,
    evaluationType,
    targetSubject: {
      subjectType: subject.subjectType,
      subjectId: Number(subject.subjectId),
      ...(subject.achievementId ? { achievementId: Number(subject.achievementId) } : {}),
      ...(subject.kpiGoalId ? { kpiGoalId: Number(subject.kpiGoalId) } : {}),
    },
    providerInfo: {
      provider: providerInfo.provider,
      model: providerInfo.model,
      isMock: Boolean(providerInfo.isMock),
    },
    overallStatus,
    overallConclusion,
    automaticAwardGranted: false, // BẮT BUỘC LUÔN LUÔN LÀ FALSE
    usageMetrics: {
      promptTokens: usageMetrics.promptTokens || 0,
      completionTokens: usageMetrics.completionTokens || 0,
      totalTokens: (usageMetrics.promptTokens || 0) + (usageMetrics.completionTokens || 0),
      latencyMs: usageMetrics.latencyMs || 0,
      cached: Boolean(usageMetrics.cached),
    },
    executedAt,
    criterionResults: criterionResults.map((c) => ({
      criterionId: c.criterionId,
      criterionCode: c.criterionCode,
      criterionName: c.criterionName,
      isConfirmedByLhu: c.isConfirmedByLhu,
      isSimulation: c.isSimulation,
      thresholdMetric: {
        targetMin: c.thresholdMetric.targetMin,
        actualRecorded: c.thresholdMetric.actualRecorded,
        unitMetric: c.thresholdMetric.unitMetric,
        isSatisfied: c.thresholdMetric.isSatisfied,
      },
      legalReferences: c.legalReferences || [],
      aiAnalysis: c.aiAnalysis,
      humanReviewRequired: c.humanReviewRequired,
      warningNotice: c.warningNotice || null,
    })),
  };
}
