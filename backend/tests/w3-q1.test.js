import test from 'node:test';
import assert from 'node:assert/strict';
import { AchievementService } from '../src/modules/achievements/achievementService.js';
import {
  SelfApprovalError,
  OutOfScopeError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../src/utils/errors.js';
import { closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB();
});

test('1. [W3-Q1 Request-Correction] Yêu cầu bổ sung bắt buộc lý do (>= 5 ký tự) và chỉ nhận hồ sơ SUBMITTED', async () => {
  const mockRepo = {
    findAchievementById: async () => ({
      achievementId: 101,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'DRAFT', // Không phải SUBMITTED
      version: 1,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };

  const service = new AchievementService({
    repository: mockRepo,
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => true,
  });
  const managerUser = { userId: 2, email: 'manager@lhu.edu.vn', roles: ['MANAGER'] };

  // 1. Chặn nếu trạng thái không phải SUBMITTED
  await assert.rejects(
    async () => service.requestCorrection(managerUser, 101, { version: 1, reason: 'Cần bổ sung quyết định hội thảo' }),
    (err) => err instanceof ConflictError && err.message.includes('Chỉ hồ sơ [SUBMITTED]')
  );

  // 2. Chặn nếu thiếu lý do hoặc lý do quá ngắn (< 5 ký tự)
  const submittedMockRepo = {
    findAchievementById: async () => ({
      achievementId: 102,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'SUBMITTED',
      version: 1,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };
  const serviceWithSubmitted = new AchievementService({
    repository: submittedMockRepo,
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => true,
  });

  await assert.rejects(
    async () => serviceWithSubmitted.requestCorrection(managerUser, 102, { version: 1, reason: '' }),
    (err) => err instanceof ValidationError && err.message.includes('Lý do yêu cầu bổ sung là bắt buộc')
  );

  await assert.rejects(
    async () => serviceWithSubmitted.requestCorrection(managerUser, 102, { version: 1, reason: 'abc' }),
    (err) => err instanceof ValidationError && err.message.includes('ít nhất 5 ký tự')
  );
});

test('2. [W3-Q1 Reject] Từ chối bắt buộc lý do (>= 5 ký tự) và chỉ nhận hồ sơ SUBMITTED', async () => {
  const mockRepo = {
    findAchievementById: async () => ({
      achievementId: 103,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'SUBMITTED',
      version: 2,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };

  const service = new AchievementService({
    repository: mockRepo,
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => true,
  });
  const managerUser = { userId: 2, email: 'manager@lhu.edu.vn', roles: ['MANAGER'] };

  // Chặn nếu thiếu lý do hoặc lý do quá ngắn
  await assert.rejects(
    async () => service.rejectAchievement(managerUser, 103, { version: 2, reason: '   ' }),
    (err) => err instanceof ValidationError && err.message.includes('Lý do từ chối là bắt buộc')
  );
});

test('3. [W3-Q1 Cancel] Hủy hồ sơ: DRAFT lý do tùy chọn, SUBMITTED / NEED_CORRECTION bắt buộc lý do', async () => {
  const lecturerUser = { userId: 10, email: 'lecturer@lhu.edu.vn', roles: ['LECTURER'] };

  // 1. Hồ sơ SUBMITTED mà thiếu lý do hủy -> Bị chặn ValidationError
  const submittedMockRepo = {
    findAchievementById: async () => ({
      achievementId: 104,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'SUBMITTED',
      version: 2,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };
  const service = new AchievementService({ repository: submittedMockRepo });

  await assert.rejects(
    async () => service.cancelAchievement(lecturerUser, 104, { version: 2, reason: '' }),
    (err) => err instanceof ValidationError && err.message.includes('Lý do hủy là bắt buộc')
  );

  // 2. Hồ sơ NEED_CORRECTION thiếu lý do hủy -> Bị chặn ValidationError
  const needCorrectionMockRepo = {
    findAchievementById: async () => ({
      achievementId: 105,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'NEED_CORRECTION',
      version: 3,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };
  const service2 = new AchievementService({ repository: needCorrectionMockRepo });

  await assert.rejects(
    async () => service2.cancelAchievement(lecturerUser, 105, { version: 3, reason: '  ' }),
    (err) => err instanceof ValidationError && err.message.includes('Lý do hủy là bắt buộc')
  );

  // 3. Hồ sơ VERIFIED -> Cấm hủy (phải qua revoke), trả ConflictError
  const verifiedMockRepo = {
    findAchievementById: async () => ({
      achievementId: 106,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'VERIFIED',
      version: 3,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };
  const service3 = new AchievementService({ repository: verifiedMockRepo });

  await assert.rejects(
    async () => service3.cancelAchievement(lecturerUser, 106, { version: 3, reason: 'Muốn hủy hồ sơ này' }),
    (err) => err instanceof ConflictError && err.message.includes('Chỉ hồ sơ DRAFT, SUBMITTED hoặc NEED_CORRECTION')
  );
});

test('4. [W3-Q1 Revoke] Thu hồi xác nhận: chỉ áp dụng cho VERIFIED và bắt buộc lý do', async () => {
  const managerUser = { userId: 2, email: 'manager@lhu.edu.vn', roles: ['MANAGER'] };

  // 1. Hồ sơ chưa VERIFIED (ví dụ SUBMITTED) -> Bị chặn ConflictError
  const submittedMockRepo = {
    findAchievementById: async () => ({
      achievementId: 107,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'SUBMITTED',
      version: 2,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };
  const service = new AchievementService({
    repository: submittedMockRepo,
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => true,
  });

  await assert.rejects(
    async () => service.revokeAchievement(managerUser, 107, { version: 2, reason: 'Phát hiện sai sót' }),
    (err) => err instanceof ConflictError && err.message.includes('Chỉ hồ sơ [VERIFIED] mới có thể thu hồi')
  );

  // 2. Hồ sơ VERIFIED nhưng thiếu lý do -> Bị chặn ValidationError
  const verifiedMockRepo = {
    findAchievementById: async () => ({
      achievementId: 108,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'VERIFIED',
      version: 3,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };
  const service2 = new AchievementService({
    repository: verifiedMockRepo,
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => true,
  });

  await assert.rejects(
    async () => service2.revokeAchievement(managerUser, 108, { version: 3, reason: '' }),
    (err) => err instanceof ValidationError && err.message.includes('Lý do thu hồi là bắt buộc')
  );
});

test('5. [W3-Q1 Resubmit] Gửi lại hồ sơ từ NEED_CORRECTION được chấp nhận, trạng thái kết thúc bị chặn', async () => {
  const lecturerUser = { userId: 10, email: 'lecturer@lhu.edu.vn', roles: ['LECTURER'] };

  // 1. Hồ sơ REJECTED không được nộp lại trực tiếp
  const rejectedMockRepo = {
    findAchievementById: async () => ({
      achievementId: 109,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'REJECTED',
      version: 3,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };
  const service = new AchievementService({ repository: rejectedMockRepo });

  await assert.rejects(
    async () => service.submitAchievement(lecturerUser, 109, { version: 3 }),
    (err) => err instanceof ConflictError && err.message.includes('Chỉ hồ sơ [DRAFT] hoặc [NEED_CORRECTION]')
  );

  // 2. Hồ sơ CANCELLED không được nộp lại trực tiếp
  const cancelledMockRepo = {
    findAchievementById: async () => ({
      achievementId: 110,
      subjectType: 'LECTURER',
      contextUnitId: 2,
      status: 'CANCELLED',
      version: 3,
      lecturer: { userId: 10 },
      createdBy: 10,
    }),
  };
  const service2 = new AchievementService({ repository: cancelledMockRepo });

  await assert.rejects(
    async () => service2.submitAchievement(lecturerUser, 110, { version: 3 }),
    (err) => err instanceof ConflictError && err.message.includes('Chỉ hồ sơ [DRAFT] hoặc [NEED_CORRECTION]')
  );
});

test('6. [W3-Q1 Replace] Tạo bản thay thế có liên kết: chỉ cho hồ sơ kết thúc (REJECTED/CANCELLED/REVOKED)', async () => {
  const lecturerUser = { userId: 10, email: 'lecturer@lhu.edu.vn', roles: ['LECTURER'] };
  let createdData = null;

  const mockRepo = {
    findAchievementById: async (id) => {
      if (id === 111) {
        return {
          achievementId: 111,
          subjectType: 'LECTURER',
          lecturerId: 5,
          contextUnitId: 2,
          achievementTypeId: 1,
          title: 'Bài báo bị thu hồi do sai quy cách',
          description: 'Mô tả ban đầu',
          contributionRole: 'Tác giả chính',
          recognitionYear: 2026,
          status: 'REVOKED', // Hồ sơ đã thu hồi kết thúc
          version: 4,
          lecturer: { userId: 10 },
          createdBy: 10,
        };
      }
      if (id === 112) {
        return {
          achievementId: 112,
          subjectType: 'LECTURER',
          status: 'SUBMITTED', // Đang chờ duyệt, chưa kết thúc
          version: 2,
          lecturer: { userId: 10 },
        };
      }
      if (id === 200) {
        return { ...createdData, achievementId: 200, status: 'DRAFT', version: 1 };
      }
      return null;
    },
    createAchievement: async (data) => {
      createdData = data;
      return { achievementId: 200, version: 1, replacesAchievementId: data.replacesAchievementId };
    },
  };

  const service = new AchievementService({ repository: mockRepo });

  // 1. Chặn tạo bản thay thế cho hồ sơ chưa kết thúc (SUBMITTED)
  await assert.rejects(
    async () => service.replaceAchievement(lecturerUser, 112, { title: 'Bản thay thế' }),
    (err) => err instanceof ConflictError && err.message.includes('Chỉ có thể tạo bản thay thế cho hồ sơ đã kết thúc')
  );

  // 2. Chặn người dùng khác tạo bản thay thế trên hồ sơ cá nhân của người khác
  const outsiderUser = { userId: 99, email: 'outsider@lhu.edu.vn', roles: ['LECTURER'] };
  await assert.rejects(
    async () => service.replaceAchievement(outsiderUser, 111, { title: 'Bản thay thế lậu' }),
    (err) => err instanceof ForbiddenError && err.message.includes('Chỉ giảng viên chủ sở hữu')
  );

  // 3. Cho phép chủ sở hữu tạo bản thay thế cho hồ sơ REVOKED thành công
  const replaced = await service.replaceAchievement(lecturerUser, 111, {
    title: 'Bài báo đã hiệu chỉnh lại theo chuẩn mới',
  });

  assert.equal(replaced.achievementId, 200);
  assert.equal(replaced.status, 'DRAFT');
  assert.equal(createdData.replacesAchievementId, 111);
  assert.equal(createdData.title, 'Bài báo đã hiệu chỉnh lại theo chuẩn mới');
  assert.equal(createdData.contributionRole, 'Tác giả chính');
});
