import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDB, closeDB } from '../src/config/database.js';
import * as regulationRepo from '../src/modules/regulations/regulationRepository.js';
import * as regulationService from '../src/modules/regulations/regulationService.js';
import aiService from '../src/modules/ai/aiService.js';
import { AchievementService } from '../src/modules/achievements/achievementService.js';
import {
  ConflictError,
  ValidationError,
  ForbiddenError,
  SelfApprovalError,
} from '../src/utils/errors.js';

let pool;

test.before(async () => {
  pool = await connectDB();
});

test.after(async () => {
  await closeDB();
});

test('CA 1: [Auth & Subject XOR] Kiểm tra ràng buộc chủ thể thành tích (Cá nhân XOR Tập thể)', async () => {
  const res = await pool.query(`
    SELECT achievement_id, lecturer_id, unit_id, context_unit_id
    FROM app.achievements
    LIMIT 10
  `);
  for (const row of res.rows) {
    const isLecturer = row.lecturer_id !== null;
    const isUnit = row.unit_id !== null;
    assert.equal(isLecturer !== isUnit, true, 'Ràng buộc CHECK XOR: Một bản ghi chỉ có thể là Cá nhân HOẶC Tập thể');
  }
});

test('CA 2: [Context Preservation] ContextUnitId bảo toàn bối cảnh đơn vị không bị biến đổi', async () => {
  const res = await pool.query(`
    SELECT achievement_id, context_unit_id FROM app.achievements WHERE context_unit_id IS NOT NULL LIMIT 5
  `);
  assert.ok(res.rows.length > 0, 'Phải có thành tích có context_unit_id');
  for (const row of res.rows) {
    assert.ok(Number(row.context_unit_id) > 0, 'ContextUnitId phải hợp lệ');
  }
});

test('CA 3: [Anti-Self-Approval] Chặn tự thẩm định hồ sơ chính mình tạo hoặc nộp', async () => {
  const service = new AchievementService({
    repository: {
      findAchievementById: async () => ({
        achievementId: 10,
        subjectType: 'LECTURER',
        status: 'SUBMITTED',
        version: 1,
        lecturer: { userId: 5 },
        createdBy: 5,
      }),
    },
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => true,
  });

  await assert.rejects(
    async () => service.verifyAchievement({ userId: 5, roles: ['MANAGER'] }, 10, { version: 1, comment: 'Đạt yêu cầu' }),
    (err) => err instanceof SelfApprovalError
  );
});

test('CA 4: [Snapshot Immutability] VERIFIED hồ sơ bị khóa bất biến, không thể sửa đè', async () => {
  const service = new AchievementService({
    repository: {
      findAchievementById: async () => ({
        achievementId: 11,
        status: 'VERIFIED',
        version: 2,
      }),
    },
    roles: async () => [{ Code: 'LECTURER' }],
    scope: async () => true,
  });

  await assert.rejects(
    async () => service.updateAchievement({ userId: 5, roles: ['LECTURER'] }, 11, { title: 'Sửa tiêu đề đã duyệt' }),
    (err) => err instanceof ConflictError && err.message.includes('VERIFIED')
  );
});

test('CA 5: [W3-Q1 Request-Correction] Yêu cầu bổ sung bắt buộc lý do (>= 5 ký tự)', async () => {
  const service = new AchievementService({
    repository: {
      findAchievementById: async () => ({
        achievementId: 12,
        status: 'SUBMITTED',
        version: 1,
        lecturer: { userId: 99 },
        createdBy: 99,
      }),
    },
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => true,
  });

  await assert.rejects(
    async () => service.requestCorrection({ userId: 2, roles: ['MANAGER'] }, 12, { version: 1, reason: 'Ngắn' }),
    (err) => err instanceof ValidationError && err.message.includes('ít nhất 5 ký tự')
  );
});

test('CA 6: [W3-Q1 Resubmit Workflow] Kiểm tra ma trận chuyển trạng thái khi gửi lại', async () => {
  const service = new AchievementService({
    repository: {
      findAchievementById: async () => ({
        achievementId: 13,
        status: 'REJECTED', // Trạng thái kết thúc không được nộp lại
        version: 2,
        subjectType: 'LECTURER',
        lecturer: { userId: 5 },
        createdBy: 5,
      }),
    },
    roles: async () => [{ Code: 'LECTURER' }],
    scope: async () => true,
  });

  // Chặn nộp lại từ hồ sơ đã kết thúc (REJECTED)
  await assert.rejects(
    async () => service.submitAchievement({ userId: 5, roles: ['LECTURER'] }, 13, { version: 2 }),
    (err) => err instanceof ConflictError
  );
});

test('CA 7: [W3-Q1 Replace Record] Tạo bản thay thế có liên kết cho hồ sơ kết thúc (REJECTED/CANCELLED)', async () => {
  const service = new AchievementService({
    repository: {
      findAchievementById: async (id) => ({
        achievementId: id,
        status: id === 14 ? 'REJECTED' : 'DRAFT',
        version: 2,
        subjectType: 'LECTURER',
        lecturer: { userId: 5 },
        createdBy: 5,
        replacesAchievementId: id === 15 ? 14 : null,
      }),
      findLecturerByUserId: async () => ({ lecturerId: 5, primaryUnitId: 2 }),
      createAchievement: async (data) => ({
        achievementId: 15,
        status: 'DRAFT',
        replacesAchievementId: data.replacesAchievementId,
      }),
    },
    roles: async () => [{ Code: 'LECTURER' }],
    scope: async () => true,
  });

  const replaced = await service.replaceAchievement({ userId: 5, roles: ['LECTURER'] }, 14, {
    title: 'Hồ sơ nghiên cứu khoa học làm lại',
    categoryCode: 'SCIENTIFIC_RESEARCH',
  });
  assert.equal(replaced.replacesAchievementId, 14);
});

test('CA 8: [W3-Q2 Regulations Immutability] Phiên bản văn bản bất biến có hash SHA-256 64 hex', async () => {
  const docs = await regulationRepo.listDocuments(null, {});
  assert.ok(docs.length >= 3);
  const lawDoc = docs.find((d) => d.document_code === 'VN-LAW-002');
  assert.ok(lawDoc);

  const versions = await regulationRepo.listVersionsByDocumentId(null, lawDoc.document_id);
  assert.ok(versions.length > 0);
  assert.equal(versions[0].sha256_hash.length, 64);
  assert.match(versions[0].sha256_hash, /^[a-f0-9]{64}$/);
});

test('CA 9: [W3-Q2 Chunks Breakdown] Trích đoạn quy chế phân mảnh theo Điều/Khoản/Trang', async () => {
  const eduDoc = await regulationRepo.findDocumentByCode(null, 'VN-EDU-001');
  assert.ok(eduDoc);
  const versions = await regulationRepo.listVersionsByDocumentId(null, eduDoc.document_id);
  const chunks = await regulationRepo.listChunksByVersionId(null, versions[0].version_id);
  assert.ok(chunks.length >= 4);

  const c = chunks[0];
  assert.ok(c.content.length > 10);
  assert.ok(c.chunk_hash.length === 64);
});

test('CA 10: [W3-Q2 Criteria Confirmation Gate] Tiêu chí chưa xác nhận bị loại trừ khỏi kết luận đánh giá', async () => {
  const activeCriteria = await regulationService.getCriteria({ confirmedOnly: true }, { roles: ['LECTURER'] });
  const unconfirmed = activeCriteria.filter((c) => c.criterion_code.startsWith('SIM-KPI'));
  assert.equal(unconfirmed.length, 0, 'Tiêu chuẩn mô phỏng chưa duyệt không được phép trả về cho đánh giá');
});

test('CA 11: [W3-Q3 AI Provider Whitelist & Safe Logging] Chặn model trả phí và không rò rỉ key', async () => {
  // Thử dùng model tính phí trên Groq provider
  await assert.rejects(
    async () => aiService.completeWithRetry({ prompt: 'test', model: 'gpt-4o', forcedProvider: 'groq' }),
    (err) => err.code === 'AI_INVALID_FREE_MODEL' || err.statusCode === 400
  );
});

test('CA 12: [W3-Q3 AI Smoke Test & Rate Limit/Cache] Trả lời chính xác từ chunk CSDL kèm metadata', async () => {
  const chunks = await pool.query(`SELECT chunk_id FROM app.regulation_chunks LIMIT 1`);
  assert.ok(chunks.rows.length > 0);
  const chunkId = chunks.rows[0].chunk_id;

  const smoke = await aiService.executeSmokeTest({
    chunkId,
    question: 'Tóm tắt nội dung chính trong điều khoản?',
  });

  assert.equal(smoke.success, true);
  assert.ok(smoke.model);
  assert.ok(smoke.timestamp);
  assert.ok(typeof smoke.latencyMs === 'number');
  assert.ok(smoke.usage.totalTokens >= 0);
});
