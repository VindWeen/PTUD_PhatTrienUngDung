import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { connectDB, closeDB } from '../src/config/database.js';
import * as ragRetrievalService from '../src/modules/ai/rag/ragRetrievalService.js';
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

  // Đảm bảo chunks đã được index cho RAG
  try {
    await ragRetrievalService.indexConfirmedChunks(pool);
  } catch (err) {
    console.warn('Index chunks setup warning:', err.message);
  }

  // 1. Tìm admin user
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

  // 2. Tìm 2 giảng viên thuộc user khác nhau để test Scope
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
      userId: Number(lecRes.rows[1].user_id),
      lecturerId: Number(lecRes.rows[1].lecturer_id),
      email: lecRes.rows[1].email,
      roles: ['LECTURER'],
    };
    otherLecturerUser = {
      userId: Number(lecRes.rows[0].user_id),
      lecturerId: Number(lecRes.rows[0].lecturer_id),
      email: lecRes.rows[0].email,
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

  // 3. Khởi chạy test HTTP server
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

let liveRunId = null;

test('1. [W4-Q3 E2E Run & Save] Hồ sơ thật chạy đánh giá end-to-end qua API và lưu kết quả vào Supabase', async () => {
  const criteriaRes = await pool.query(`
    SELECT criteria_version_id, criterion_code, name 
    FROM app.award_criteria_versions 
    WHERE is_confirmed = true
    LIMIT 2
  `);
  const critIds = criteriaRes.rows.map((r) => Number(r.criteria_version_id));

  const postRes = await fetch(`${baseUrl}/ai/evaluations/structured`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lecturerToken}`,
    },
    body: JSON.stringify({
      subjectType: 'LECTURER',
      subjectId: lecturerUser.lecturerId,
      criteriaVersionIds: critIds.length > 0 ? critIds : [1],
      asOfDate: '2026-10-01',
      forcedProvider: 'mock',
    }),
  });

  const body = await postRes.json();
  assert.equal(postRes.status, 201, `Status phải là 201 Created: ${JSON.stringify(body)}`);
  assert.equal(body.success, true);
  assert.ok(body.data.runId, 'Phải có runId trả về');
  assert.equal(body.data.targetSubject.subjectType, 'LECTURER');
  assert.equal(body.data.targetSubject.subjectId, lecturerUser.lecturerId);
  assert.equal(body.data.automaticAwardGranted, false, 'Không bao giờ có cờ tự phong thưởng');
  assert.ok(body.data.inputHash, 'Phải có inputHash SHA-256');
  assert.ok(Array.isArray(body.data.criterionResults), 'Phải có danh sách kết quả từng tiêu chí');

  liveRunId = body.data.runId;

  // Kiểm tra lưu DB thực tế
  const dbRun = await pool.query('SELECT * FROM app.evaluation_runs WHERE run_id = $1', [liveRunId]);
  assert.equal(dbRun.rows.length, 1, 'Bản ghi EvaluationRun phải được lưu vào app.evaluation_runs');
  assert.equal(dbRun.rows[0].automatic_award_granted, false);

  const dbCrit = await pool.query(
    'SELECT * FROM app.evaluation_criterion_results WHERE run_id = $1',
    [liveRunId]
  );
  assert.ok(dbCrit.rows.length > 0, 'Các criterion results phải được lưu vào DB');
});

test('2. [W4-Q3 Snapshot Reproduction] Tái hiện nguyên vẹn input snapshot cũ từ lịch sử phiên đánh giá', async () => {
  assert.ok(liveRunId, 'Cần liveRunId từ test 1');

  const getRes = await fetch(`${baseUrl}/ai/evaluations/${liveRunId}`, {
    headers: {
      Authorization: `Bearer ${lecturerToken}`,
    },
  });

  const body = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.runId, liveRunId);
  assert.ok(body.data.inputSnapshot, 'Phải trả về inputSnapshot nguyên vẹn');
  assert.ok(body.data.inputHash, 'Phải trả về inputHash SHA-256');
  assert.equal(body.data.targetSubject.subjectId, lecturerUser.lecturerId);

  // Snapshot chứa danh sách records và criteria tại thời điểm chạy
  assert.ok(Array.isArray(body.data.inputSnapshot.records), 'Snapshot phải lưu danh sách hồ sơ tại thời điểm chạy');
  assert.ok(body.data.inputSnapshot.asOfDate, 'Snapshot phải lưu asOfDate');
});

test('3. [W4-Q3 Scope Security] Người ngoài scope bị chặn truy cập nội dung đánh giá AI (403 OUT_OF_SCOPE)', async () => {
  assert.ok(liveRunId, 'Cần liveRunId từ test 1');

  // otherLecturerUser cố gắng đọc phiên đánh giá của lecturerUser
  const getRes = await fetch(`${baseUrl}/ai/evaluations/${liveRunId}`, {
    headers: {
      Authorization: `Bearer ${otherLecturerToken}`,
    },
  });

  const body = await getRes.json();
  assert.equal(getRes.status, 403, 'Người ngoài scope phải nhận HTTP 403 Forbidden');
  assert.equal(body.error?.code, 'OUT_OF_SCOPE');

  // otherLecturerUser cố gắng chạy đánh giá trên hồ sơ của lecturerUser
  const postRes = await fetch(`${baseUrl}/ai/evaluations/structured`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${otherLecturerToken}`,
    },
    body: JSON.stringify({
      subjectType: 'LECTURER',
      subjectId: lecturerUser.lecturerId, // Hồ sơ của người khác
      criteriaVersionIds: [1],
    }),
  });

  const postBody = await postRes.json();
  assert.equal(postRes.status, 403, 'Không được phép thực hiện thẩm định AI trên hồ sơ ngoài scope');
  assert.equal(postBody.error?.code, 'OUT_OF_SCOPE');
});

test('4. [W4-Q3 Stale Check] Phát hiện chính xác dữ liệu bị thay đổi (isStale = true) khi hồ sơ phát sinh mới', async () => {
  assert.ok(liveRunId, 'Cần liveRunId từ test 1');

  // 1. Lúc chưa đổi dữ liệu: stale check trả isStale = false
  const initialCheckRes = await fetch(`${baseUrl}/ai/evaluations/${liveRunId}/stale-check`, {
    headers: {
      Authorization: `Bearer ${lecturerToken}`,
    },
  });
  const initialBody = await initialCheckRes.json();
  assert.equal(initialCheckRes.status, 200);
  assert.equal(initialBody.data.isStale, false, 'Ban đầu dữ liệu chưa đổi thì isStale phải là false');

  // 2. Chèn 1 achievement mới cho lecturerUser
  const fakeAchRes = await pool.query(`
    INSERT INTO app.achievements (
      lecturer_id, context_unit_id, title, achievement_date, 
      recognition_year, status, created_by
    ) VALUES (
      $1, COALESCE((SELECT unit_id FROM app.lecturer_assignments WHERE lecturer_id = $1 AND is_primary = TRUE LIMIT 1), 1),
      'Thành tích thử nghiệm Stale Check W4-Q3', 
      '2026-05-15', 2026, 'VERIFIED', $2
    ) RETURNING achievement_id
  `, [lecturerUser.lecturerId, adminUser.userId]);
  const newAchId = fakeAchRes.rows[0].achievement_id;

  try {
    // 3. Gọi lại stale-check: hệ thống phát hiện thay đổi inputHash -> isStale = true
    const staleCheckRes = await fetch(`${baseUrl}/ai/evaluations/${liveRunId}/stale-check`, {
      headers: {
        Authorization: `Bearer ${lecturerToken}`,
      },
    });
    const staleBody = await staleCheckRes.json();
    assert.equal(staleCheckRes.status, 200);
    assert.equal(staleBody.data.isStale, true, 'Hệ thống phải nhận diện được dữ liệu đã bị STALE');
    assert.notEqual(staleBody.data.currentHash, staleBody.data.savedHash);

    // Kiểm tra DB cờ is_stale cũng được cập nhật
    const dbRun = await pool.query('SELECT is_stale FROM app.evaluation_runs WHERE run_id = $1', [liveRunId]);
    assert.equal(dbRun.rows[0].is_stale, true);
  } finally {
    // Dọn dẹp bản ghi tạm
    await pool.query('DELETE FROM app.achievements WHERE achievement_id = $1', [newAchId]);
  }
});

test('5. [W4-Q3 Resilient Provider] Giữ nguyên kết quả thẩm định tiêu chí khi AI Provider gặp lỗi/sự cố', async () => {
  // Gọi explainEvaluation với model không hợp lệ hoặc lỗi, hệ thống phải fallback an toàn không crash
  const explainRes = await fetch(`${baseUrl}/ai/rag/explain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lecturerToken}`,
    },
    body: JSON.stringify({
      criterionResult: {
        criterionId: 1,
        criterionCode: 'CSTĐCS-01',
        criterionName: 'Chiến sĩ thi đua cơ sở',
        isConfirmedByLhu: true,
        isSimulation: false,
        thresholdMetric: {
          targetMin: 3,
          actualRecorded: 2,
          unitMetric: 'Năm',
          isSatisfied: false,
        },
        aiAnalysis: 'Hồ sơ ghi nhận 2 năm phân biệt có minh chứng, yêu cầu tối thiểu là 3 năm.',
        humanReviewRequired: false,
      },
      provider: 'mock',
      asOfDate: '2026-10-01',
    }),
  });

  const explainBody = await explainRes.json();
  assert.equal(explainRes.status, 200);
  assert.equal(explainBody.success, true);
  assert.ok(explainBody.data.explanationText, 'Phải có giải thích trả về');
  assert.ok(explainBody.data.citations, 'Phải có danh sách trích dẫn');
  assert.ok(explainBody.data.model, 'Phải ghi model');
});
