import { query } from '../../utils/dbHelper.js';

/**
 * Lưu trữ phiên đánh giá và chi tiết tiêu chí vào CSDL (Supabase/PostgreSQL)
 */
export async function saveEvaluationRun(client, runData, criterionResults = []) {
  const runSql = `
    INSERT INTO app.evaluation_runs (
      run_id, evaluation_type, subject_type, subject_id,
      achievement_id, application_id, kpi_goal_id,
      provider, model, is_mock, overall_status, overall_conclusion,
      automatic_award_granted, input_snapshot, input_hash,
      prompt_tokens, completion_tokens, total_tokens, latency_ms,
      is_stale, executed_by, executed_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, $15,
      $16, $17, $18, $19,
      $20, $21, $22
    )
    RETURNING *;
  `;

  const runValues = [
    runData.runId,
    runData.evaluationType,
    runData.targetSubject.subjectType,
    runData.targetSubject.subjectId,
    runData.targetSubject.achievementId || null,
    runData.applicationId || null,
    runData.targetSubject.kpiGoalId || null,
    runData.providerInfo.provider,
    runData.providerInfo.model,
    runData.providerInfo.isMock,
    runData.overallStatus,
    runData.overallConclusion,
    false, // automatic_award_granted luôn luôn là false
    JSON.stringify(runData.inputSnapshot || {}),
    runData.inputHash || '',
    runData.usageMetrics.promptTokens || 0,
    runData.usageMetrics.completionTokens || 0,
    runData.usageMetrics.totalTokens || 0,
    runData.usageMetrics.latencyMs || 0,
    Boolean(runData.isStale),
    runData.executedBy,
    runData.executedAt || new Date().toISOString(),
  ];

  const runRes = await query(runSql, runValues, client);
  const savedRun = runRes.rows[0];

  const savedResults = [];
  for (const c of criterionResults) {
    const critSql = `
      INSERT INTO app.evaluation_criterion_results (
        run_id, criterion_id, criterion_code, criterion_name,
        is_confirmed_by_lhu, is_simulation,
        target_min, actual_recorded, unit_metric, is_satisfied,
        distinct_years, consecutive_years, legal_references,
        ai_analysis, human_review_required, warning_notice
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16
      )
      RETURNING *;
    `;

    const critValues = [
      savedRun.run_id,
      c.criterionId,
      c.criterionCode,
      c.criterionName,
      Boolean(c.isConfirmedByLhu),
      Boolean(c.isSimulation),
      c.thresholdMetric.targetMin,
      c.thresholdMetric.actualRecorded,
      c.thresholdMetric.unitMetric,
      String(c.thresholdMetric.isSatisfied),
      c.distinctYears ?? null,
      c.consecutiveYears ?? null,
      JSON.stringify(c.legalReferences || []),
      c.aiAnalysis,
      Boolean(c.humanReviewRequired),
      c.warningNotice || null,
    ];

    const critRes = await query(critSql, critValues, client);
    savedResults.push(critRes.rows[0]);
  }

  return { run: savedRun, criterionResults: savedResults };
}

/**
 * Lấy chi tiết phiên đánh giá theo UUID runId
 */
export async function getEvaluationRunById(client, runId) {
  const runSql = `SELECT * FROM app.evaluation_runs WHERE run_id = $1`;
  const runRes = await query(runSql, [runId], client);
  const run = runRes.rows[0];
  if (!run) return null;

  const critSql = `
    SELECT * FROM app.evaluation_criterion_results
    WHERE run_id = $1
    ORDER BY result_id ASC
  `;
  const critRes = await query(critSql, [runId], client);

  return {
    runId: run.run_id,
    evaluationType: run.evaluation_type,
    targetSubject: {
      subjectType: run.subject_type,
      subjectId: Number(run.subject_id),
      ...(run.achievement_id ? { achievementId: Number(run.achievement_id) } : {}),
      ...(run.kpi_goal_id ? { kpiGoalId: Number(run.kpi_goal_id) } : {}),
    },
    applicationId: run.application_id ? Number(run.application_id) : null,
    providerInfo: {
      provider: run.provider,
      model: run.model,
      isMock: Boolean(run.is_mock),
    },
    overallStatus: run.overall_status,
    overallConclusion: run.overall_conclusion,
    automaticAwardGranted: false,
    inputSnapshot: run.input_snapshot,
    inputHash: run.input_hash,
    isStale: Boolean(run.is_stale),
    usageMetrics: {
      promptTokens: Number(run.prompt_tokens),
      completionTokens: Number(run.completion_tokens),
      totalTokens: Number(run.total_tokens),
      latencyMs: Number(run.latency_ms),
      cached: false,
    },
    executedBy: Number(run.executed_by),
    executedAt: run.executed_at.toISOString ? run.executed_at.toISOString() : run.executed_at,
    criterionResults: critRes.rows.map((r) => ({
      resultId: Number(r.result_id),
      criterionId: Number(r.criterion_id),
      criterionCode: r.criterion_code,
      criterionName: r.criterion_name,
      isConfirmedByLhu: Boolean(r.is_confirmed_by_lhu),
      isSimulation: Boolean(r.is_simulation),
      thresholdMetric: {
        targetMin: r.target_min !== null ? Number(r.target_min) : null,
        actualRecorded: r.actual_recorded !== null ? Number(r.actual_recorded) : null,
        unitMetric: r.unit_metric,
        isSatisfied: r.is_satisfied === 'true' ? true : r.is_satisfied === 'false' ? false : 'UNCONFIRMED',
      },
      distinctYears: r.distinct_years !== null ? Number(r.distinct_years) : null,
      consecutiveYears: r.consecutive_years !== null ? Boolean(r.consecutive_years) : null,
      legalReferences: typeof r.legal_references === 'string' ? JSON.parse(r.legal_references) : (r.legal_references || []),
      aiAnalysis: r.ai_analysis,
      humanReviewRequired: Boolean(r.human_review_required),
      warningNotice: r.warning_notice,
    })),
  };
}

/**
 * Danh sách lịch sử các phiên đánh giá
 */
export async function listEvaluationRuns(client, { subjectType, subjectId, applicationId, limit = 20, offset = 0 } = {}) {
  const params = [];
  let sql = `SELECT * FROM app.evaluation_runs WHERE 1=1`;

  if (subjectType) {
    params.push(subjectType);
    sql += ` AND subject_type = $${params.length}`;
  }
  if (subjectId) {
    params.push(subjectId);
    sql += ` AND subject_id = $${params.length}`;
  }
  if (applicationId) {
    params.push(applicationId);
    sql += ` AND application_id = $${params.length}`;
  }

  sql += ` ORDER BY executed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const res = await query(sql, params, client);
  return res.rows.map((run) => ({
    runId: run.run_id,
    evaluationType: run.evaluation_type,
    subjectType: run.subject_type,
    subjectId: Number(run.subject_id),
    applicationId: run.application_id ? Number(run.application_id) : null,
    provider: run.provider,
    model: run.model,
    isMock: Boolean(run.is_mock),
    overallStatus: run.overall_status,
    overallConclusion: run.overall_conclusion,
    isStale: Boolean(run.is_stale),
    executedAt: run.executed_at.toISOString ? run.executed_at.toISOString() : run.executed_at,
  }));
}

/**
 * Cập nhật trạng thái stale khi input data bị thay đổi
 */
export async function markRunStale(client, runId, isStale = true) {
  const sql = `UPDATE app.evaluation_runs SET is_stale = $1 WHERE run_id = $2 RETURNING *`;
  const res = await query(sql, [isStale, runId], client);
  return res.rows[0] || null;
}
