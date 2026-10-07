import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { connectDB, closeDB } from '../src/config/database.js';
import * as evaluationRepo from '../src/modules/ai/evaluationRepository.js';
import aiService from '../src/modules/ai/aiService.js';
import { evaluationRunSchema } from '../src/modules/ai/evaluationSchemas.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

let pool;
let server;
let baseUrl;
let adminUser;
let lecturerUser;
let otherLecturerUser;
let adminToken;
let lecturerToken;
let otherLecturerToken;

test.before(async () => {
  pool = await connectDB();

  // Tìm admin user
  const adminRes = await pool.query(`
    SELECT u.user_id, u.email, ARRAY_AGG(r.code) as roles
    FROM app.users u
    JOIN app.user_roles ur ON ur.user_id = u.user_id
    JOIN app.roles r ON r.role_id = ur.role_id
    WHERE r.code IN ('SYSTEM_ADMIN', 'ADMIN') AND ur.revoked_at IS NULL
    GROUP BY u.user_id, u.email
    LIMIT 1
  `);
  if (adminRes.rows.length > 0) {
    adminUser = {
      userId: Number(adminRes.rows[0].user_id),
      email: adminRes.rows[0].email,
      roles: adminRes.rows[0].roles,
    };
  } else {
    adminUser = { userId: 1, email: 'admin@lhu.edu.vn', roles: ['ADMIN'] };
  }

  // Tìm 2 giảng viên khác nhau để kiểm tra Scope
  const lecRes = await pool.query(`
    SELECT l.lecturer_id, l.user_id, u.email
    FROM app.lecturers l
    JOIN app.users u ON u.user_id = l.user_id
    WHERE l.is_active = TRUE AND u.status = 'ACTIVE'
    ORDER BY l.lecturer_id ASC
    LIMIT 2
  `);

  if (lecRes.rows.length >= 2) {
    lecturerUser = {
      userId: Number(lecRes.rows[0].user_id),
      lecturerId: Number(lecRes.rows[0].lecturer_id),
      email: lecRes.rows[0].email,
      roles: ['LECTURER'],
    };
    otherLecturerUser = {
      userId: Number(lecRes.rows[1].user_id),
      lecturerId: Number(lecRes.rows[1].lecturer_id),
      email: lecRes.rows[1].email,
      roles: ['LECTURER'],
    };
  } else if (lecRes.rows.length === 1) {
    lecturerUser = {
      userId: Number(lecRes.rows[0].user_id),
      lecturerId: Number(lecRes.rows[0].lecturer_id),
      email: lecRes.rows[0].email,
      roles: ['LECTURER'],
    };
    otherLecturerUser = {
      userId: 9999,
      lecturerId: 9999,
      email: 'other@lhu.edu.vn',
      roles: ['LECTURER'],
    };
  } else {
    lecturerUser = { userId: 2, lecturerId: 1, email: 'an.nv@lhu.edu.vn', roles: ['LECTURER'] };
    otherLecturerUser = { userId: 3, lecturerId: 2, email: 'bich.tt@lhu.edu.vn', roles: ['LECTURER'] };
  }

  adminToken = generateAccessToken(adminUser);
  lecturerToken = generateAccessToken(lecturerUser);
  otherLecturerToken = generateAccessToken(otherLecturerUser);

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
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDB();
});

test('1. [W4-Q1 DB] Bảng app.evaluation_runs và app.evaluation_criterion_results tồn tại và hoạt động', async () => {
  const tableCheck = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'app' AND table_name IN ('evaluation_runs', 'evaluation_criterion_results')
  `);
  assert.equal(tableCheck.rows.length, 2, 'Cả 2 bảng evaluation_runs và evaluation_criterion_results phải tồn tại');
});

test('2. [W4-Q1 DB] Lưu và truy vấn EvaluationRun kèm input_snapshot và criterionResults vào Supabase', async () => {
  const runId = '00000000-0000-4000-8000-000000040001';
  // Xóa nếu có từ trước
  await pool.query('DELETE FROM app.evaluation_runs WHERE run_id = $1', [runId]);

  const mockRun = {
    runId,
    evaluationType: 'CRITERION_ASSESSMENT',
    targetSubject: { subjectType: 'LECTURER', subjectId: lecturerUser.lecturerId },
    providerInfo: { provider: 'mock', model: 'deterministic-criteria-evaluator-v1', isMock: true },
    overallStatus: 'FLAGGED_UNCONFIRMED',
    overallConclusion: 'SIMULATION_ONLY',
    automaticAwardGranted: false,
    inputSnapshot: { test: true, version: '1.0' },
    inputHash: 'e'.repeat(64),
    usageMetrics: { promptTokens: 10, completionTokens: 20, totalTokens: 30, latencyMs: 5 },
    isStale: false,
    executedBy: adminUser.userId,
    executedAt: new Date().toISOString(),
  };

  const mockCritResults = [
    {
      criterionId: 1, // SIM-KPI-01
      criterionCode: 'SIM-KPI-01',
      criterionName: 'Chuẩn bị 02 bản ghi giáo trình có minh chứng trước hạn demo',
      isConfirmedByLhu: false,
      isSimulation: true,
      thresholdMetric: { targetMin: 2, actualRecorded: 2, unitMetric: 'giáo trình', isSatisfied: 'UNCONFIRMED' },
      distinctYears: 1,
      consecutiveYears: true,
      legalReferences: [],
      aiAnalysis: 'Nghiệm thu mô phỏng',
      humanReviewRequired: true,
      warningNotice: 'Tiêu chuẩn mô phỏng chưa duyệt LHU',
    },
  ];

  await evaluationRepo.saveEvaluationRun(pool, mockRun, mockCritResults);

  const retrieved = await evaluationRepo.getEvaluationRunById(pool, runId);
  assert.ok(retrieved, 'Phải tìm thấy run đã lưu');
  assert.equal(retrieved.runId, runId);
  assert.equal(retrieved.overallConclusion, 'SIMULATION_ONLY');
  assert.equal(retrieved.automaticAwardGranted, false);
  assert.equal(retrieved.inputHash, 'e'.repeat(64));
  assert.equal(retrieved.criterionResults.length, 1);
  assert.equal(retrieved.criterionResults[0].criterionCode, 'SIM-KPI-01');
  assert.equal(retrieved.criterionResults[0].thresholdMetric.isSatisfied, 'UNCONFIRMED');

  // Dọn dẹp
  await pool.query('DELETE FROM app.evaluation_runs WHERE run_id = $1', [runId]);
});

test('3. [W4-Q1 Service] aiService.evaluateStructured chạy end-to-end với dữ liệu thật và ghi nhận CSDL', async () => {
  const result = await aiService.evaluateStructured(
    {
      subjectType: 'LECTURER',
      subjectId: lecturerUser.lecturerId,
      criteriaVersionIds: [1], // SIM-KPI-01
      mockRecords: [
        {
          id: 501,
          subjectId: lecturerUser.lecturerId,
          year: 2024,
          status: 'VERIFIED',
          file: { id: 1, sha256: 'f'.repeat(64), originalFileName: 'gt1.pdf' },
        },
        {
          id: 502,
          subjectId: lecturerUser.lecturerId,
          year: 2025,
          status: 'VERIFIED',
          file: { id: 2, sha256: 'a'.repeat(64), originalFileName: 'gt2.pdf' },
        },
      ],
    },
    adminUser,
    pool
  );

  assert.ok(result.runId, 'Phải tạo ra UUID runId');
  assert.ok(evaluationRunSchema.safeParse(result).success, 'Kết quả phải hợp lệ theo contract');
  assert.equal(result.automaticAwardGranted, false, 'TUYỆT ĐỐI không tự trao thưởng');

  // Kiểm tra run đã lưu trong CSDL
  const saved = await evaluationRepo.getEvaluationRunById(pool, result.runId);
  assert.ok(saved, 'Phiên đánh giá phải được lưu vào app.evaluation_runs');
  assert.equal(saved.runId, result.runId);

  // Dọn dẹp
  await pool.query('DELETE FROM app.evaluation_runs WHERE run_id = $1', [result.runId]);
});

test('4. [W4-Q1 REST API] POST /api/v1/ai/evaluations/structured tạo phiên đánh giá thành công', async () => {
  const payload = {
    subjectType: 'LECTURER',
    subjectId: lecturerUser.lecturerId,
    criteriaVersionIds: [1],
  };

  const res = await fetch(`${baseUrl}/ai/evaluations/structured`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201, 'POST /ai/evaluations/structured phải trả về 201 Created');
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.runId);
  assert.equal(data.data.automaticAwardGranted, false);

  // Đọc lại qua GET /ai/evaluations/:runId
  const getRes = await fetch(`${baseUrl}/ai/evaluations/${data.data.runId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.data.runId, data.data.runId);

  // Dọn dẹp
  await pool.query('DELETE FROM app.evaluation_runs WHERE run_id = $1', [data.data.runId]);
});

test('5. [W4-Q1 Security] Người ngoài scope bị từ chối 403 khi truy cập phiên đánh giá AI', async () => {
  // Tạo 1 run của otherLecturerUser bởi admin
  const createdRun = await aiService.evaluateStructured(
    {
      subjectType: 'LECTURER',
      subjectId: otherLecturerUser.lecturerId,
      criteriaVersionIds: [1],
      mockRecords: [],
    },
    adminUser,
    pool
  );

  // Giảng viên không có thẩm quyền (lecturerUser) cố tình truy cập vào run của otherLecturerUser
  const forbiddenRes = await fetch(`${baseUrl}/ai/evaluations/${createdRun.runId}`, {
    headers: { Authorization: `Bearer ${lecturerToken}` },
  });

  assert.equal(
    forbiddenRes.status,
    403,
    'Người ngoài scope truy cập dữ liệu AI phải bị chặn 403 OUT_OF_SCOPE'
  );

  // Dọn dẹp
  await pool.query('DELETE FROM app.evaluation_runs WHERE run_id = $1', [createdRun.runId]);
});
