import test from 'node:test';
import assert from 'node:assert/strict';
import {
  submitAchievementSchema,
  verifyAchievementSchema,
  requestCorrectionSchema,
  rejectAchievementSchema,
  cancelAchievementSchema,
  revokeAchievementSchema,
} from '../src/modules/achievements/achievementSchemas.js';
import {
  ValidationError,
  ConcurrencyConflictError,
  SelfApprovalError,
  ConflictError,
  ForbiddenError,
} from '../src/utils/errors.js';
import { AchievementService } from '../src/modules/achievements/achievementService.js';
import { closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB();
});

test('1. [W2-Q3 Schemas] Kiểm tra Zod Schemas cho các hành động thẩm định', () => {
  // Submit schema: version >= 1, submitNote/note hợp lệ
  const validSubmit = submitAchievementSchema.parse({ version: 1, submitNote: 'Nộp thẩm định đợt 1' });
  assert.equal(validSubmit.version, 1);
  assert.equal(validSubmit.submitNote, 'Nộp thẩm định đợt 1');

  // Submit schema: thiếu version -> lỗi
  assert.throws(() => submitAchievementSchema.parse({ submitNote: 'test' }));

  // Verify schema: version hợp lệ, note tùy chọn
  const validVerify = verifyAchievementSchema.parse({ version: 2, note: 'Hồ sơ đầy đủ, phê duyệt' });
  assert.equal(validVerify.version, 2);
  assert.equal(validVerify.note, 'Hồ sơ đầy đủ, phê duyệt');

  // Request Correction schema: bắt buộc reason
  assert.throws(() => requestCorrectionSchema.parse({ version: 1 }));
  assert.throws(() => requestCorrectionSchema.parse({ version: 1, reason: '' }));
  const validCorrection = requestCorrectionSchema.parse({ version: 1, reason: 'Thiếu quyết định công nhận' });
  assert.equal(validCorrection.reason, 'Thiếu quyết định công nhận');

  // Reject schema: bắt buộc reason
  assert.throws(() => rejectAchievementSchema.parse({ version: 1, reason: '' }));
  const validReject = rejectAchievementSchema.parse({ version: 1, reason: 'Không thuộc phạm vi chuyên môn' });
  assert.equal(validReject.reason, 'Không thuộc phạm vi chuyên môn');

  // Cancel schema: thiếu version -> lỗi, reason tùy chọn
  assert.throws(() => cancelAchievementSchema.parse({ reason: 'Hủy hồ sơ' }));
  const validCancel = cancelAchievementSchema.parse({ version: 2, reason: 'Rút hồ sơ cập nhật thêm tài liệu' });
  assert.equal(validCancel.version, 2);
  assert.equal(validCancel.reason, 'Rút hồ sơ cập nhật thêm tài liệu');

  // Revoke schema: bắt buộc reason
  assert.throws(() => revokeAchievementSchema.parse({ version: 3, reason: '' }));
  const validRevoke = revokeAchievementSchema.parse({ version: 3, reason: 'Phát hiện trùng lặp đề tài cấp trên' });
  assert.equal(validRevoke.reason, 'Phát hiện trùng lặp đề tài cấp trên');
});

test('2. [W2-Q3 Business Rule] Nộp hồ sơ bắt buộc phải có ít nhất 1 tệp minh chứng', async () => {
  // Mock repository trả về hồ sơ DRAFT nhưng 0 minh chứng
  const mockRepo = {
    findAchievementById: async () => ({
      achievementId: 100,
      subjectType: 'LECTURER',
      lecturerId: 1,
      lecturer: { userId: 10 },
      createdBy: 10,
      contextUnitId: 2,
      status: 'DRAFT',
      version: 1,
      title: 'Bài báo không có minh chứng',
      recognitionYear: 2026,
      achievementTypeId: 1,
    }),
    getActiveEvidencesWithFiles: async () => [], // Không có minh chứng nào
  };

  const service = new AchievementService({ repository: mockRepo });
  const user = { userId: 10, email: 'user10@lhu.edu.vn', roles: ['LECTURER'] };

  await assert.rejects(
    async () => service.submitAchievement(user, 100, { version: 1 }),
    (err) => err instanceof ValidationError && err.message.includes('ít nhất một minh chứng')
  );
});

test('3. [W2-Q3 Anti-Self-Approval] Cấm người kê khai/chủ sở hữu tự thẩm định hồ sơ của mình', async () => {
  // Hồ sơ SUBMITTED có lecturer.userId = 10, createdBy = 10
  const mockRepo = {
    findAchievementById: async () => ({
      achievementId: 101,
      subjectType: 'LECTURER',
      lecturerId: 1,
      lecturer: { userId: 10 },
      createdBy: 10,
      submittedBy: 10,
      contextUnitId: 2,
      status: 'SUBMITTED',
      version: 2,
      title: 'Đề tài của Trưởng khoa',
    }),
    findLecturerByUserId: async () => ({ lecturerId: 1 }),
  };

  const service = new AchievementService({ repository: mockRepo });
  // Giả sử user 10 cố tình thẩm định hồ sơ của chính mình
  const managerSelf = { userId: 10, email: 'dean@lhu.edu.vn', roles: ['MANAGER'] };

  await assert.rejects(
    async () => service.verifyAchievement(managerSelf, 101, { version: 2 }),
    (err) => {
      assert.ok(err instanceof SelfApprovalError, 'Phải ném lỗi SelfApprovalError');
      assert.equal(err.code, 'SELF_APPROVAL_PROHIBITED');
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /không được phép/);
      return true;
    }
  );

  // Cũng cấm tự yêu cầu bổ sung hồ sơ của chính mình
  await assert.rejects(
    async () => service.requestCorrection(managerSelf, 101, { version: 2, reason: 'Tự chỉnh sửa hồ sơ' }),
    (err) => err instanceof SelfApprovalError && err.code === 'SELF_APPROVAL_PROHIBITED'
  );
});

test('4. [W2-Q3 Status Transitions] Kiểm tra các ràng buộc trạng thái hồ sơ', async () => {
  // 1. Không thể nộp (submit) khi hồ sơ đang là VERIFIED
  const mockRepoVerified = {
    findAchievementById: async () => ({
      achievementId: 103,
      subjectType: 'LECTURER',
      lecturer: { userId: 10 },
      status: 'VERIFIED',
      version: 3,
    }),
  };
  const serviceVerified = new AchievementService({ repository: mockRepoVerified });
  await assert.rejects(
    async () => serviceVerified.submitAchievement({ userId: 10, roles: ['LECTURER'] }, 103, { version: 3 }),
    (err) => err instanceof ConflictError && err.message.includes('Không thể nộp hồ sơ đang ở trạng thái [VERIFIED]')
  );

  // 2. Không thể xác nhận (verify) khi hồ sơ chưa nộp (đang DRAFT)
  const mockRepoDraft = {
    findAchievementById: async () => ({
      achievementId: 104,
      subjectType: 'LECTURER',
      lecturer: { userId: 10 },
      createdBy: 10,
      contextUnitId: 2,
      status: 'DRAFT',
      version: 1,
    }),
    findLecturerByUserId: async () => null,
  };
  const serviceDraft = new AchievementService({ repository: mockRepoDraft });
  await assert.rejects(
    async () => serviceDraft.verifyAchievement({ userId: 99, roles: ['MANAGER'] }, 104, { version: 1 }),
    (err) => err instanceof ConflictError && err.message.includes('Chỉ hồ sơ [SUBMITTED]')
  );

  // 3. Người ngoài không có quyền nộp hồ sơ của người khác
  const mockRepoOther = {
    findAchievementById: async () => ({
      achievementId: 105,
      subjectType: 'LECTURER',
      lecturer: { userId: 10 },
      createdBy: 10,
      contextUnitId: 2,
      status: 'DRAFT',
      version: 1,
      title: 'Đề tài của người khác',
      recognitionYear: 2026,
      achievementTypeId: 1,
    }),
    getActiveEvidencesWithFiles: async () => [{ evidenceId: 1, files: [{ fileId: 1 }] }],
  };
  const serviceOther = new AchievementService({ repository: mockRepoOther });
  await assert.rejects(
    async () => serviceOther.submitAchievement({ userId: 99, roles: ['LECTURER'] }, 105, { version: 1 }),
    (err) => err instanceof ForbiddenError
  );
});
