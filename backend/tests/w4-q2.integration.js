import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { connectDB, closeDB } from '../src/config/database.js';
import * as ragRetrievalService from '../src/modules/ai/rag/ragRetrievalService.js';
import * as ragExplanationService from '../src/modules/ai/rag/ragExplanationService.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

let pool;
let server;
let baseUrl;
let adminUser;
let adminToken;

test.before(async () => {
  pool = await connectDB();

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

  adminToken = generateAccessToken(adminUser);

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

test('1. [W4-Q2 DB Integration] Lập chỉ mục các trích đoạn đã duyệt vào bảng app.regulation_chunk_embeddings', async () => {
  const result = await ragRetrievalService.indexConfirmedChunks(pool);
  assert.equal(result.success, true);
  assert.ok(result.indexedCount > 0, 'Phải lập chỉ mục ít nhất 1 chunk đã duyệt');

  const check = await pool.query(`SELECT COUNT(*)::int as count FROM app.regulation_chunk_embeddings`);
  assert.ok(check.rows[0].count >= result.indexedCount);
});

test('2. [W4-Q2 Retrieval] Tìm kiếm vector có bộ lọc hiệu lực (asOfDate) và trích đoạn khớp', async () => {
  // 1. Tìm kiếm với ngày hiệu lực hiện tại
  const retRes = await ragRetrievalService.retrieveRelevantChunks(
    {
      queryText: 'Nguyên tắc khen thưởng chính xác công khai minh bạch',
      asOfDate: '2026-10-07',
      topK: 2,
    },
    pool
  );

  assert.equal(retRes.isSufficient, true, 'Phải tìm thấy trích đoạn phù hợp');
  assert.ok(retRes.chunks.length > 0);
  assert.equal(retRes.chunks[0].documentCode, 'VN-LAW-002');
  assert.equal(retRes.chunks[0].articleNo, 'Điều 3');

  // 2. Thử nghiệm bộ lọc hiệu lực: nếu asOfDate trước ngày ban hành (2020-01-01) -> Không có nguồn
  const pastRes = await ragRetrievalService.retrieveRelevantChunks(
    {
      queryText: 'Nguyên tắc khen thưởng',
      asOfDate: '2019-01-01',
    },
    pool
  );
  assert.equal(pastRes.isSufficient, false, 'Ngoài thời gian hiệu lực phải trả isSufficient = false');
});

test('3. [W4-Q2 Explanation] LLM giải thích kết quả kèm citation truy ngược Điều/Khoản/Trang', async () => {
  const criterionResult = {
    criterionId: 1,
    criterionCode: 'VN-LAW-002-C01',
    criterionName: 'Thực hiện đúng nguyên tắc khen thưởng công khai minh bạch',
    isConfirmedByLhu: true,
    isSimulation: false,
    thresholdMetric: { targetMin: 1, actualRecorded: 1, unitMetric: 'lần', isSatisfied: true },
    aiAnalysis: 'Hồ sơ đạt tiêu chuẩn theo báo cáo',
    humanReviewRequired: false,
  };

  const expl = await ragExplanationService.explainEvaluationResult(
    {
      criterionResult,
      asOfDate: '2026-10-07',
      forcedProvider: 'mock',
    },
    pool
  );

  assert.equal(expl.isSufficientData, true);
  assert.ok(expl.citations.length > 0, 'Phải có ít nhất 1 citation');
  assert.equal(expl.citations[0].documentCode, 'VN-LAW-002');
  assert.equal(expl.citations[0].articleNo, 'Điều 3');
  assert.equal(expl.citations[0].clauseNo, 'Khoản 1');
  assert.equal(expl.citations[0].pageNo, 14);
  assert.equal(expl.promptVersion, 'rag-explain-v1');
  assert.equal(expl.retrievalVersion, 'rag-retrieval-v1');
});

test('4. [W4-Q2 REST API] POST /api/v1/ai/rag/retrieve và POST /api/v1/ai/rag/explain thành công', async () => {
  // Test retrieve endpoint
  const retResponse = await fetch(`${baseUrl}/ai/rag/retrieve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      queryText: 'Căn cứ xét tặng danh hiệu thi đua',
      asOfDate: '2026-10-07',
      topK: 2,
    }),
  });

  assert.equal(retResponse.status, 200);
  const retData = await retResponse.json();
  assert.equal(retData.success, true);
  assert.ok(retData.data.chunks.length > 0);

  // Test explain endpoint
  const explResponse = await fetch(`${baseUrl}/ai/rag/explain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      criterionResult: {
        criterionId: 1,
        criterionCode: 'VN-LAW-002-C01',
        criterionName: 'Căn cứ xét tặng danh hiệu thi đua',
        isConfirmedByLhu: true,
        isSimulation: false,
        thresholdMetric: { targetMin: 1, actualRecorded: 1, isSatisfied: true },
        aiAnalysis: 'Thẩm định đạt yêu cầu',
        humanReviewRequired: false,
      },
      asOfDate: '2026-10-07',
      provider: 'mock',
    }),
  });

  assert.equal(explResponse.status, 200);
  const explData = await explResponse.json();
  assert.equal(explData.success, true);
  assert.equal(explData.data.isSufficientData, true);
  assert.ok(explData.data.citations.length > 0);
});
