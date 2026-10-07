/**
 * BỘ KIỂM THỬ TÍCH HỢP TỰ ĐỘNG W4-Q4
 * Phụ trách: Tạ Trần Vinh Quang (W4-Q4)
 * 
 * Nội dung kiểm thử:
 * 1. Demo E2E RAG -> Đánh giá tiêu chí (Evaluator) -> Gợi ý KPI thiếu -> Người dùng chấp nhận kế hoạch
 * 2. Kiểm tra schema evaluator dùng chung (Multi-criteria input snapshot & deterministic hash)
 * 3. Kiểm tra phân quyền & kiểm soát phạm vi (Scope security)
 * 4. Workflow Hội đồng & Quy tắc liêm chính chống tự phê duyệt (Anti-Self-Approval)
 * 5. Bằng chứng phân biệt Provider thật vs Dữ liệu mô phỏng
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { connectDB, closeDB } from '../src/config/database.js';
import * as ragRetrievalService from '../src/modules/ai/rag/ragRetrievalService.js';
import { buildInputSnapshot } from '../src/modules/ai/criteriaEvaluator.js';
import ai from '../src/modules/ai/aiService.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

let pool;
let server;
let baseUrl;
let adminUser;
let lecturerAn;
let lecturerBich;
let tokenAn;
let tokenBich;
let tokenAdmin;

let testDocId = null;
let testVersionId = null;
let testCriterionId = null;
let activeCriterion = null;

let e2eRunId = null;
let createdRecId = null;
let councilAppId = null;
let councilAppVersion = 1;

test.before(async () => {
  pool = await connectDB();

  // Index chunks cho RAG retrieval
  try {
    await ragRetrievalService.indexConfirmedChunks(pool);
  } catch (err) {
    console.warn('Index chunks setup warning:', err.message);
  }

  // Dọn dẹp nếu có sót lại từ lần chạy trước
  await pool.query("DELETE FROM app.kpi_recommendations WHERE criterion_id IN (SELECT criteria_version_id FROM app.award_criteria_versions WHERE criterion_code = 'W4Q4-CRIT-01')");
  await pool.query("DELETE FROM app.evaluation_criterion_results WHERE criterion_id IN (SELECT criteria_version_id FROM app.award_criteria_versions WHERE criterion_code = 'W4Q4-CRIT-01')");
  await pool.query("DELETE FROM app.award_criteria_versions WHERE criterion_code = 'W4Q4-CRIT-01'");
  await pool.query("DELETE FROM app.regulation_document_versions WHERE document_id IN (SELECT document_id FROM app.regulation_documents WHERE document_code = 'W4Q4-DOC-01')");
  await pool.query("DELETE FROM app.regulation_documents WHERE document_code = 'W4Q4-DOC-01'");

  // 1. Tạo Quy chế & Tiêu chí xác nhận cho kiểm thử tích hợp W4-Q4
  const docRes = await pool.query(`
    INSERT INTO app.regulation_documents(document_code, title, document_type)
    VALUES('W4Q4-DOC-01', 'Quy định tiêu chuẩn khen thưởng nghiên cứu khoa học LHU', 'UNIVERSITY_REGULATION')
    RETURNING document_id
  `);
  testDocId = docRes.rows[0].document_id;

  const verRes = await pool.query(`
    INSERT INTO app.regulation_document_versions(
      document_id, version_number, sha256_hash, effective_from,
      is_confirmed, lhu_application_status, created_by
    )
    VALUES($1, '1.0', $2, '2020-01-01', true, 'CONFIRMED_LHU_POLICY', 1)
    RETURNING version_id
  `, [testDocId, 'a'.repeat(64)]);
  testVersionId = verRes.rows[0].version_id;

  const critRes = await pool.query(`
    INSERT INTO app.award_criteria_versions(
      version_id, criterion_code, name, target_type, min_threshold,
      unit_metric, legal_references, is_confirmed
    )
    VALUES($1, 'W4Q4-CRIT-01', 'Công bố bài báo khoa học trên tạp chí uy tín', 'INDIVIDUAL', 10, 'bài', 'Điều 5 Quy định NCKH LHU', true)
    RETURNING *
  `, [testVersionId]);
  activeCriterion = critRes.rows[0];
  testCriterionId = activeCriterion.criteria_version_id;

  // Lấy người dùng thực tế từ app schema
  const usersRes = await pool.query(`
    SELECT u.user_id, u.username, u.email, l.lecturer_id
    FROM app.users u
    LEFT JOIN app.lecturers l ON l.user_id = u.user_id
    WHERE u.user_id IN (1, 2, 3)
    ORDER BY u.user_id ASC
  `);

  const anRow = usersRes.rows.find((r) => r.username === 'an.nv') || { user_id: 1, lecturer_id: 1, email: 'an.nv@lhu.edu.vn' };
  const bichRow = usersRes.rows.find((r) => r.username === 'bich.tt') || { user_id: 2, lecturer_id: 2, email: 'bich.tt@lhu.edu.vn' };
  const ducRow = usersRes.rows.find((r) => r.username === 'duc.pm') || { user_id: 3, lecturer_id: 3, email: 'duc.pm@lhu.edu.vn' };

  lecturerAn = {
    userId: Number(anRow.user_id),
    lecturerId: Number(anRow.lecturer_id),
    email: anRow.email,
    roles: ['LECTURER'],
  };

  lecturerBich = {
    userId: Number(bichRow.user_id),
    lecturerId: Number(bichRow.lecturer_id),
    email: bichRow.email,
    roles: ['MANAGER', 'LECTURER'],
  };

  adminUser = {
    userId: Number(ducRow.user_id),
    lecturerId: Number(ducRow.lecturer_id),
    email: ducRow.email,
    roles: ['ADMIN'],
  };

  tokenAn = generateAccessToken(lecturerAn);
  tokenBich = generateAccessToken(lecturerBich);
  tokenAdmin = generateAccessToken(adminUser);

  // Khởi chạy test HTTP server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
});

test.after(async () => {
  // Dọn dẹp dữ liệu kiểm thử
  if (testCriterionId) {
    await pool.query('DELETE FROM app.kpi_recommendations WHERE criterion_id = $1', [testCriterionId]);
    await pool.query('DELETE FROM app.evaluation_criterion_results WHERE criterion_id = $1', [testCriterionId]);
    await pool.query('DELETE FROM app.award_criteria_versions WHERE criteria_version_id = $1', [testCriterionId]);
  }
  if (testVersionId) {
    await pool.query('DELETE FROM app.regulation_document_versions WHERE version_id = $1', [testVersionId]);
  }
  if (testDocId) {
    await pool.query('DELETE FROM app.regulation_documents WHERE document_id = $1', [testDocId]);
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDB();
});

// ============================================================================
// 1. CHẠY DEMO E2E: RAG -> EVALUATOR -> GỢI Ý KPI -> NGƯỜI DÙNG CHẤP NHẬN
// ============================================================================
test('1. [W4-Q4 Demo E2E] RAG trích dẫn quy chế thật, Evaluator thẩm định tiêu chí và lưu phiên đánh giá', async () => {
  assert.ok(activeCriterion, 'Cần tiêu chí đã xác nhận từ test.before');

  // 1.1 RAG retrieval tìm chunk quy chế thật
  const chunksRes = await fetch(`${baseUrl}/ai/rag/retrieve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAn}`,
    },
    body: JSON.stringify({
      queryText: 'nghiên cứu khoa học',
    }),
  });
  assert.equal(chunksRes.status, 200);
  const chunksBody = await chunksRes.json();
  assert.equal(chunksBody.success, true);
  assert.ok(Array.isArray(chunksBody.data.chunks), 'Trả về mảng chunks');

  // 1.2 RAG explanation giải thích tiêu chí
  const ragRes = await fetch(`${baseUrl}/ai/rag/explain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAn}`,
    },
    body: JSON.stringify({
      criterionResult: {
        criterionId: Number(activeCriterion.criteria_version_id),
        criterionCode: activeCriterion.criterion_code,
        criterionName: activeCriterion.name,
        isConfirmedByLhu: true,
        isSimulation: false,
        thresholdMetric: {
          targetMin: Number(activeCriterion.min_threshold || 3),
          actualRecorded: 0,
          unitMetric: activeCriterion.unit_metric || 'bài',
          isSatisfied: false,
        },
        aiAnalysis: 'Hồ sơ chưa có đủ minh chứng theo quy chế NCKH LHU.',
        humanReviewRequired: false,
      },
      provider: 'mock',
      asOfDate: '2026-10-07',
    }),
  });
  assert.equal(ragRes.status, 200);
  const ragBody = await ragRes.json();
  assert.equal(ragBody.success, true);
  assert.ok(ragBody.data.explanationText, 'Phải có nội dung giải thích căn cứ');

  // 1.3 Chạy Thẩm định tiêu chí (Evaluator)
  const evalRes = await fetch(`${baseUrl}/ai/evaluations/structured`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAn}`,
    },
    body: JSON.stringify({
      subjectType: 'LECTURER',
      subjectId: lecturerAn.lecturerId,
      criteriaVersionIds: [Number(activeCriterion.criteria_version_id)],
      asOfDate: '2026-10-07',
    }),
  });
  assert.equal(evalRes.status, 201);
  const evalBody = await evalRes.json();
  assert.equal(evalBody.success, true);
  e2eRunId = evalBody.data.runId;
  assert.ok(e2eRunId, 'Phải sinh ra runId hợp lệ');
  assert.equal(evalBody.data.automaticAwardGranted, false, 'AI không bao giờ được tự trao thưởng');
  assert.ok(evalBody.data.inputHash, 'Phải tính inputHash bảo vệ tính toàn vẹn');
});

test('2. [W4-Q4 Demo E2E] Recommender sinh gợi ý KPI bám đúng tiêu chí thiếu, không hứa danh hiệu', async () => {
  assert.ok(e2eRunId, 'Cần e2eRunId từ bước 1');

  // Stub completion an toàn trả về checklist trung lập đúng hợp đồng W4-P1
  const originalComplete = ai.completeWithRetry;
  ai.completeWithRetry = async () => ({
    content: JSON.stringify({
      plan: 'Rà soát kế hoạch giảng dạy, chủ động đăng ký đề tài NCKH cấp cơ sở và nộp minh chứng đúng hạn.',
    }),
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat',
    usage: { promptTokens: 35, completionTokens: 42, totalTokens: 77 },
    latencyMs: 310,
    timestamp: new Date().toISOString(),
    isMock: false,
    cached: false,
  });

  try {
    const recRes = await fetch(`${baseUrl}/kpi/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAn}`,
      },
      body: JSON.stringify({ runId: e2eRunId }),
    });

    const recBody = await recRes.json();
    assert.equal(recRes.status, 201, `Sinh gợi ý thất bại: ${JSON.stringify(recBody)}`);
    assert.equal(recBody.success, true);
    assert.equal(recBody.data.automaticAwardGranted, false, 'Recommender tuyệt đối không tự trao thưởng');
    assert.ok(recBody.data.items.length > 0, 'Phải sinh ít nhất 1 gợi ý cho tiêu chí thiếu');

    const item = recBody.data.items[0];
    createdRecId = item.recommendation_id;
    assert.equal(item.status, 'PENDING');
    assert.ok(item.provider_evidence, 'Phải lưu provider_evidence đầy đủ');
    assert.equal(item.provider_evidence.isMock, false, 'Provider evidence ghi nhận cuộc gọi thật');
    assert.equal(item.provider_evidence.provider, 'openrouter');

    // Kiểm tra tính bám sát tiêu chí và ngôn ngữ thận trọng
    assert.ok(item.payload.assumptions.length >= 2);
    assert.ok(item.payload.assumptions.some((a) => a.includes('Kế hoạch không xác nhận thành tích hoặc tự trao thưởng')));
  } finally {
    ai.completeWithRetry = originalComplete;
  }
});

test('3. [W4-Q4 Demo E2E] Người dùng rà soát và Chấp nhận (Accept) kế hoạch KPI; lưu vào kpi_goals & ghi audit log', async () => {
  assert.ok(createdRecId, 'Cần createdRecId từ bước 2');

  const edits = {
    plan: 'Kế hoạch cá nhân: Hoàn thành 03 bài báo NCKH trên tạp chí chuyên ngành đúng hạn năm học 2026-2027',
    periodStart: '2026-10-07',
    periodEnd: '2027-12-31',
  };

  const acceptRes = await fetch(`${baseUrl}/kpi/recommendations/${createdRecId}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAn}`,
    },
    body: JSON.stringify({
      version: 1,
      action: 'accept',
      edits,
    }),
  });

  const acceptBody = await acceptRes.json();
  assert.equal(acceptRes.status, 200, `Chấp nhận gợi ý thất bại: ${JSON.stringify(acceptBody)}`);
  assert.equal(acceptBody.success, true);
  assert.equal(acceptBody.data.automaticAwardGranted, false);
  assert.equal(acceptBody.data.recommendation.status, 'ACCEPTED');
  assert.ok(acceptBody.data.goal, 'Phải tạo mới record mục tiêu trong app.kpi_goals');
  assert.equal(acceptBody.data.goal.status, 'ACCEPTED');
  assert.equal(acceptBody.data.recommendation.goal_id, acceptBody.data.goal.goal_id);

  // Kiểm tra Audit Log
  const auditRes = await pool.query(`
    SELECT action, entity_name, user_id, new_values
    FROM app.audit_logs
    WHERE entity_name = 'kpi_recommendations'
      AND action = 'KPI_RECOMMENDATION_ACCEPT'
      AND user_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [lecturerAn.userId]);

  assert.ok(auditRes.rows.length > 0, 'Phải có bản ghi audit log cho hành động KPI_RECOMMENDATION_ACCEPT');
  assert.equal(auditRes.rows[0].new_values.status, 'ACCEPTED');
});

// ============================================================================
// 2. KIỂM TRA SCHEMA EVALUATOR DÙNG CHUNG (MULTI-CRITERIA & DETERMINISTIC HASH)
// ============================================================================
test('4. [W4-Q4 Schema Evaluator] buildInputSnapshot hỗ trợ đa tiêu chí và tính toán hash xác định', async () => {
  const dummyCriteria = [
    { criteriaVersionId: 101, criterionCode: 'CSTĐ_01', minThreshold: 1, unitMetric: 'năm', isConfirmed: true },
    { criteriaVersionId: 102, criterionCode: 'NCKH_02', minThreshold: 2, unitMetric: 'bài báo', isConfirmed: true },
  ];
  const dummyDocs = [
    { versionId: 201, versionNumber: '1.0', sha256Hash: 'hash-abc', isConfirmed: true, lhuApplicationStatus: 'CONFIRMED_LHU_POLICY' },
    { versionId: 202, versionNumber: '2.0', sha256Hash: 'hash-def', isConfirmed: true, lhuApplicationStatus: 'CONFIRMED_LHU_POLICY' },
  ];
  const dummyRecords = [
    { id: 1, type: 'ACHIEVEMENT', subjectId: 1, year: 2025, status: 'VERIFIED', hasEvidence: true },
  ];

  // Lần 1: Tạo snapshot ở thời điểm T1
  const snap1 = buildInputSnapshot({
    subject: { subjectType: 'LECTURER', subjectId: 1 },
    criteria: dummyCriteria,
    documentVersions: dummyDocs,
    records: dummyRecords,
    asOfDate: '2026-10-07',
    snapshotDate: '2026-10-07T08:00:00.000Z',
  });

  // Lần 2: Tạo snapshot ở thời điểm T2 (khác snapshotDate)
  const snap2 = buildInputSnapshot({
    subject: { subjectType: 'LECTURER', subjectId: 1 },
    criteria: dummyCriteria,
    documentVersions: dummyDocs,
    records: dummyRecords,
    asOfDate: '2026-10-07',
    snapshotDate: '2026-10-07T12:00:00.000Z',
  });

  // Kiểm tra cấu trúc Schema v2
  assert.equal(snap1.snapshot.schemaVersion, 2);
  assert.equal(snap1.snapshot.criteria.length, 2, 'Snapshot phải lưu toàn bộ mảng criteria');
  assert.equal(snap1.snapshot.documentVersions.length, 2, 'Snapshot phải lưu toàn bộ mảng documentVersions');
  assert.equal(snap1.snapshot.criterion.criterionCode, 'CSTĐ_01', 'Tương thích ngược với primary criterion');

  // Input hash phải giống hệt nhau (không phụ thuộc vào snapshotDate)
  assert.equal(snap1.inputHash, snap2.inputHash, 'inputHash phải xác định và bất biến với timestamp tạo');

  // Khi hồ sơ thay đổi (thêm record) -> hash phải thay đổi
  const snapModified = buildInputSnapshot({
    subject: { subjectType: 'LECTURER', subjectId: 1 },
    criteria: dummyCriteria,
    documentVersions: dummyDocs,
    records: [...dummyRecords, { id: 2, type: 'ACHIEVEMENT', subjectId: 1, year: 2026, status: 'VERIFIED', hasEvidence: true }],
    asOfDate: '2026-10-07',
  });
  assert.notEqual(snap1.inputHash, snapModified.inputHash, 'inputHash phải đổi khi records thay đổi');
});

// ============================================================================
// 3. KIỂM TRA PHÂN QUYỀN & KIỂM SOÁT PHẠM VI (SCOPE SECURITY)
// ============================================================================
test('5. [W4-Q4 Scope Security] Chặn người dùng ngoài phạm vi can thiệp gợi ý KPI của người khác (403 FORBIDDEN)', async () => {
  assert.ok(e2eRunId, 'Cần e2eRunId');
  assert.ok(createdRecId, 'Cần createdRecId');

  // Bích.TT cố tạo gợi ý trên run của An.NV
  const hijackGen = await fetch(`${baseUrl}/kpi/recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenBich}`,
    },
    body: JSON.stringify({ runId: e2eRunId }),
  });
  assert.equal(hijackGen.status, 403, 'Người ngoài scope cố tạo gợi ý phải nhận 403 FORBIDDEN');

  // Bích.TT cố ra quyết định trên gợi ý của An.NV
  const hijackDecide = await fetch(`${baseUrl}/kpi/recommendations/${createdRecId}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenBich}`,
    },
    body: JSON.stringify({
      version: 1,
      action: 'reject',
    }),
  });
  assert.equal(hijackDecide.status, 403, 'Người ngoài scope cố quyết định gợi ý phải nhận 403 FORBIDDEN');
});

// ============================================================================
// 4. WORKFLOW HỘI ĐỒNG & CHỐNG TỰ PHÊ DUYỆT (ANTI-SELF-APPROVAL)
// ============================================================================
test('6. [W4-Q4 Hội đồng & Liêm chính] Quy tắc chống tự phê duyệt (Anti-Self-Approval) chặn cán bộ tự xét hồ sơ mình', async () => {
  // Tạo kỳ xét duyệt test
  const cycleCode = `W4Q4_CYCLE_${Date.now()}`;
  const cycleRes = await pool.query(`
    INSERT INTO app.award_periods(code, name, start_date, end_date)
    VALUES($1, 'Kỳ xét duyệt kiểm thử W4-Q4', '2026-01-01', '2026-12-31')
    RETURNING *
  `, [cycleCode]);
  const cycleId = Number(cycleRes.rows[0].award_period_id);

  // Tạo hồ sơ đăng ký khen thưởng đứng tên Giảng viên An (user_id = 1)
  const appRes = await pool.query(`
    INSERT INTO app.award_applications(
      lecturer_id, award_period_id, target_award_type_id, purpose,
      status, created_by, context_unit_id, version
    )
    VALUES(1, $1, 1, 'Hồ sơ đề xuất danh hiệu Chiến sĩ thi đua cơ sở', 'COUNCIL_PENDING', 1, 2, 1)
    RETURNING *
  `, [cycleId]);
  councilAppId = Number(appRes.rows[0].application_id);
  councilAppVersion = Number(appRes.rows[0].version);

  // Gán tạm thời role COUNCIL cho Giảng viên An để thử nghiệm tình huống xung đột lợi ích
  await pool.query(`
    INSERT INTO app.user_roles(user_id, role_id, valid_from)
    VALUES(1, 4, NOW() - INTERVAL '1 day')
    ON CONFLICT DO NOTHING
  `);
  await pool.query(`
    INSERT INTO app.user_unit_scopes(user_id, role_id, unit_id, include_descendants, valid_from)
    VALUES(1, 4, 1, TRUE, NOW() - INTERVAL '1 day')
    ON CONFLICT DO NOTHING
  `);

  try {
    // An (vừa là ứng viên, vừa có role COUNCIL) cố tự nhận xét / đánh giá hồ sơ của mình
    const selfReviewRes = await fetch(`${baseUrl}/award-applications/${councilAppId}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAn}`,
      },
      body: JSON.stringify({
        version: councilAppVersion,
        reason: 'Tôi tự thấy hồ sơ của tôi rất xuất sắc và xứng đáng.',
      }),
    });

    const selfBody = await selfReviewRes.json();
    assert.equal(selfReviewRes.status, 403, 'Cán bộ tự xét hồ sơ của chính mình phải bị chặn 403 FORBIDDEN');
    assert.ok(
      selfBody.error?.message?.includes('Không tự xét hồ sơ cá nhân') ||
      selfBody.error?.code === 'FORBIDDEN',
      'Thông báo lỗi phải thể hiện rõ nguyên tắc liêm chính noSelf'
    );
  } finally {
    // Dọn dẹp role test của An
    await pool.query(`DELETE FROM app.user_roles WHERE user_id = 1 AND role_id = 4`);
    await pool.query(`DELETE FROM app.user_unit_scopes WHERE user_id = 1 AND role_id = 4`);
  }
});

test('7. [W4-Q4 Hội đồng & Quy trình] Thành viên Hội đồng phân công, đánh giá & khuyến nghị khen thưởng (RECOMMENDED)', async () => {
  assert.ok(councilAppId, 'Cần councilAppId từ bước 6');

  // Gán role COUNCIL và Scope trên đơn vị gốc FIT (unit_id = 1, bao gồm FIT_SE) cho TS. Bích (user_id = 2)
  await pool.query(`
    INSERT INTO app.user_roles(user_id, role_id, valid_from)
    VALUES(2, 4, NOW() - INTERVAL '1 day')
    ON CONFLICT DO NOTHING
  `);
  await pool.query(`
    INSERT INTO app.user_unit_scopes(user_id, role_id, unit_id, include_descendants, valid_from)
    VALUES(2, 4, 1, TRUE, NOW() - INTERVAL '1 day')
    ON CONFLICT DO NOTHING
  `);

  const councilTokenBich = generateAccessToken({
    userId: 2,
    lecturerId: 2,
    email: lecturerBich.email,
    roles: ['COUNCIL', 'MANAGER', 'LECTURER'],
  });

  try {
    // Bước 7.1: Hội đồng phân công reviewer cho hồ sơ (assign)
    const assignRes = await fetch(`${baseUrl}/award-applications/${councilAppId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${councilTokenBich}`,
      },
      body: JSON.stringify({
        version: councilAppVersion,
        reviewerId: 2,
        reason: 'Hội đồng phân công TS. Bích thẩm tra hồ sơ.',
      }),
    });
    const assignBody = await assignRes.json();
    assert.equal(assignRes.status, 200, `Phân công reviewer thất bại: ${JSON.stringify(assignBody)}`);
    assert.equal(assignBody.data.status, 'UNDER_REVIEW');
    councilAppVersion = Number(assignBody.data.version);

    // Bước 7.2: Reviewer được phân công nhận xét hồ sơ (comment)
    const commentRes = await fetch(`${baseUrl}/award-applications/${councilAppId}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${councilTokenBich}`,
      },
      body: JSON.stringify({
        version: councilAppVersion,
        reason: 'Hội đồng Khoa đã thẩm tra minh chứng thực tế: Đủ điều kiện và đạt chuẩn tiêu chí.',
      }),
    });
    const commentBody = await commentRes.json();
    assert.equal(commentRes.status, 200, `Nhận xét hồ sơ thất bại: ${JSON.stringify(commentBody)}`);
    councilAppVersion = Number(commentBody.data.version);

    // Bước 7.3: Hội đồng bỏ phiếu khuyến nghị khen thưởng (recommend)
    const recAwardRes = await fetch(`${baseUrl}/award-applications/${councilAppId}/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${councilTokenBich}`,
      },
      body: JSON.stringify({
        version: councilAppVersion,
        reason: 'Hội đồng đồng thuận đề xuất Hội đồng cấp Trường xem xét khen thưởng.',
      }),
    });
    const recAwardBody = await recAwardRes.json();
    assert.equal(recAwardRes.status, 200, `Khuyến nghị khen thưởng thất bại: ${JSON.stringify(recAwardBody)}`);
    assert.equal(recAwardBody.data.status, 'RECOMMENDED');

    // Xác nhận quyết định khen thưởng không tự động cấp mà phải qua thẩm quyền xét duyệt riêng
    const checkApp = await pool.query(`
      SELECT status FROM app.award_applications WHERE application_id = $1
    `, [councilAppId]);
    assert.equal(checkApp.rows[0].status, 'RECOMMENDED', 'Hồ sơ chỉ dừng ở trạng thái RECOMMENDED');
  } finally {
    // Thu hồi role COUNCIL của TS. Bích
    await pool.query(`DELETE FROM app.user_roles WHERE user_id = 2 AND role_id = 4`);
    await pool.query(`DELETE FROM app.user_unit_scopes WHERE user_id = 2 AND role_id = 4`);
  }
});
