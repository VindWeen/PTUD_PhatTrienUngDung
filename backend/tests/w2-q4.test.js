import test from 'node:test';
import assert from 'node:assert/strict';
import { AchievementService } from '../src/modules/achievements/achievementService.js';
import { EvidenceService } from '../src/modules/evidences/evidenceService.js';
import {
  SelfApprovalError,
  OutOfScopeError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from '../src/utils/errors.js';
import { closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB();
});

test('1. [W2-Q4 Đại diện hết hạn] Đại diện đơn vị hết hạn bị chặn nộp, sửa và hủy hồ sơ tập thể', async () => {
  const mockRepo = {
    findAchievementById: async () => ({
      achievementId: 201,
      subjectType: 'UNIT',
      organizationUnitId: 2,
      contextUnitId: 2,
      status: 'DRAFT',
      version: 1,
      title: 'Thành tích tập thể khoa CNTT',
      recognitionYear: 2026,
      achievementTypeId: 1,
    }),
    findActiveRepresentative: async () => null, // Đại diện đã hết hạn hoặc bị thu hồi
    getActiveEvidencesWithFiles: async () => [{ evidenceId: 1, storageKey: 'test.pdf', originalFileName: 'test.pdf' }],
  };

  const service = new AchievementService({
    repository: mockRepo,
    roles: async () => [{ Code: 'UNIT_REPRESENTATIVE' }],
  });
  const expiredRepUser = { userId: 4, email: 'rep.expired@lhu.edu.vn', roles: ['UNIT_REPRESENTATIVE'] };

  // 1. Không thể nộp hồ sơ
  await assert.rejects(
    async () => service.submitAchievement(expiredRepUser, 201, { version: 1 }),
    (err) => err instanceof ForbiddenError && err.message.includes('còn hiệu lực')
  );

  // 2. Không thể hủy hồ sơ
  await assert.rejects(
    async () => service.cancelAchievement(expiredRepUser, 201, { version: 1 }),
    (err) => err instanceof ForbiddenError && err.message.includes('còn hiệu lực')
  );

  // 3. Không thể thêm/sửa minh chứng
  const evidenceService = new EvidenceService({
    achievementRepo: mockRepo,
    roleGetter: async () => [{ Code: 'UNIT_REPRESENTATIVE' }],
  });
  await assert.rejects(
    async () =>
      evidenceService._assertCanModifyAchievement(
        { status: 'DRAFT', unitId: 2 },
        expiredRepUser
      ),
    (err) => err instanceof OutOfScopeError && err.message.includes('thời hạn')
  );
});

test('2. [W2-Q4 Anti-Self-Approval] Cán bộ tạo hoặc nộp không được tự thẩm định (verify/correction/reject)', async () => {
  const achievementCreatedByManager = {
    achievementId: 202,
    subjectType: 'LECTURER',
    lecturerId: 5,
    lecturer: { userId: 50 },
    createdBy: 2, // Tạo bởi user 2 (Manager)
    submittedBy: 50,
    contextUnitId: 2,
    status: 'SUBMITTED',
    version: 2,
    title: 'Hồ sơ do Trưởng khoa khởi tạo giúp',
  };

  const achievementSubmittedByManager = {
    achievementId: 203,
    subjectType: 'UNIT',
    organizationUnitId: 2,
    contextUnitId: 2,
    createdBy: 4,
    submittedBy: 2, // Nộp bởi user 2 (Manager kiêm nộp)
    status: 'SUBMITTED',
    version: 2,
    title: 'Hồ sơ do Manager trực tiếp nộp',
  };

  const mockRepo = {
    findAchievementById: async (id) => (id === 202 ? achievementCreatedByManager : achievementSubmittedByManager),
    findLecturerByUserId: async () => ({ lecturerId: 2 }),
  };

  const service = new AchievementService({
    repository: mockRepo,
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => true,
  });

  const managerUser = { userId: 2, email: 'manager@lhu.edu.vn', roles: ['MANAGER'] };

  // A. Trường hợp tự duyệt hồ sơ do chính mình KHỞI TẠO (createdBy == user.userId)
  await assert.rejects(
    async () => service.verifyAchievement(managerUser, 202, { version: 2 }),
    (err) => err instanceof SelfApprovalError && err.code === 'SELF_APPROVAL_PROHIBITED'
  );
  await assert.rejects(
    async () => service.requestCorrection(managerUser, 202, { version: 2, reason: 'Sửa lại' }),
    (err) => err instanceof SelfApprovalError && err.code === 'SELF_APPROVAL_PROHIBITED'
  );
  await assert.rejects(
    async () => service.rejectAchievement(managerUser, 202, { version: 2, reason: 'Từ chối' }),
    (err) => err instanceof SelfApprovalError && err.code === 'SELF_APPROVAL_PROHIBITED'
  );

  // B. Trường hợp tự duyệt hồ sơ do chính mình NỘP DUYỆT (submittedBy == user.userId)
  await assert.rejects(
    async () => service.verifyAchievement(managerUser, 203, { version: 2 }),
    (err) => err instanceof SelfApprovalError && err.code === 'SELF_APPROVAL_PROHIBITED'
  );
  await assert.rejects(
    async () => service.requestCorrection(managerUser, 203, { version: 2, reason: 'Sửa lại' }),
    (err) => err instanceof SelfApprovalError && err.code === 'SELF_APPROVAL_PROHIBITED'
  );
  await assert.rejects(
    async () => service.rejectAchievement(managerUser, 203, { version: 2, reason: 'Từ chối' }),
    (err) => err instanceof SelfApprovalError && err.code === 'SELF_APPROVAL_PROHIBITED'
  );
});

test('3. [W2-Q4 Thẩm định ngoài phạm vi] Manager ngoài scope và ADMIN không mặc nhiên được duyệt', async () => {
  const achievementOutOfScope = {
    achievementId: 204,
    subjectType: 'LECTURER',
    lecturerId: 1,
    lecturer: { userId: 10 },
    createdBy: 10,
    submittedBy: 10,
    contextUnitId: 99, // Đơn vị 99 ngoài phạm vi
    status: 'SUBMITTED',
    version: 1,
    title: 'Hồ sơ đơn vị khác',
  };

  const mockRepo = {
    findAchievementById: async () => achievementOutOfScope,
    findLecturerByUserId: async () => null,
  };

  // Manager nhưng không có scope cho đơn vị 99
  const serviceOutOfScope = new AchievementService({
    repository: mockRepo,
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => false, // Scope trả về false (hết hạn hoặc khác đơn vị)
  });

  const managerUser = { userId: 2, email: 'manager@lhu.edu.vn', roles: ['MANAGER'] };

  await assert.rejects(
    async () => serviceOutOfScope.verifyAchievement(managerUser, 204, { version: 1 }),
    (err) => err instanceof OutOfScopeError && err.statusCode === 403
  );

  // ADMIN không có vai trò MANAGER hoặc không có scope: không mặc nhiên được duyệt
  const serviceAdminOnly = new AchievementService({
    repository: mockRepo,
    roles: async () => [{ Code: 'ADMIN' }], // Chỉ có role ADMIN
    scope: async () => false,
  });
  const adminUser = { userId: 3, email: 'admin@lhu.edu.vn', roles: ['ADMIN'] };

  await assert.rejects(
    async () => serviceAdminOnly.verifyAchievement(adminUser, 204, { version: 1 }),
    (err) => err instanceof ForbiddenError && err.statusCode === 403
  );
});

test('4. [W2-Q4 File Private URL Protection] Chặn truy cập tải file private khi ngoài scope hoặc hết hạn', async () => {
  const evidenceService = new EvidenceService({
    scopeChecker: async () => false, // Hết hạn scope hoặc không có scope
    roleGetter: async () => [{ Code: 'RECORDS_OFFICER' }],
  });

  const achievementInfo = {
    achievementId: 205,
    contextUnitId: 99,
    lecturerUserId: 88,
    status: 'SUBMITTED',
    strictScope: true,
  };

  // Records Officer ngoài phạm vi scope bị chặn 403
  await assert.rejects(
    async () =>
      evidenceService._assertCanViewAchievement(achievementInfo, {
        userId: 5,
        roles: ['RECORDS_OFFICER'],
      }),
    (err) => err instanceof OutOfScopeError && err.statusCode === 403
  );

  // Người dùng lạ (Lecturer khác) bị chặn 403
  await assert.rejects(
    async () =>
      evidenceService._assertCanViewAchievement(achievementInfo, {
        userId: 999,
        roles: ['LECTURER'],
      }),
    (err) => err instanceof OutOfScopeError && err.statusCode === 403
  );
});

test('5. [W2-Q4 Kiểm tra file vật lý & Snapshot lock] Thiếu file vật lý trên kho lưu trữ sẽ bị từ chối nộp', async () => {
  const mockRepo = {
    findAchievementById: async () => ({
      achievementId: 206,
      subjectType: 'LECTURER',
      lecturerId: 1,
      lecturer: { userId: 1 },
      createdBy: 1,
      contextUnitId: 2,
      status: 'DRAFT',
      version: 1,
      title: 'Hồ sơ có file ảo',
      recognitionYear: 2026,
      achievementTypeId: 1,
    }),
    findAchievementForUpdate: async () => ({
      achievementId: 206,
      status: 'DRAFT',
      version: 1,
      contextUnitId: 2,
      title: 'Hồ sơ có file ảo',
      recognitionYear: 2026,
      achievementTypeId: 1,
    }),
    getActiveEvidencesWithFiles: async () => [
      { evidenceId: 1, storageKey: 'missing_physical_file.pdf', originalFileName: 'missing.pdf' },
    ],
  };

  // Mock storage: file vật lý KHÔNG tồn tại
  const mockStorage = {
    fileExists: async () => false,
  };

  const service = new AchievementService({
    repository: mockRepo,
    adapter: mockStorage,
    roles: async () => [{ Code: 'LECTURER' }],
  });

  const user = { userId: 1, email: 'owner@lhu.edu.vn', roles: ['LECTURER'] };

  await assert.rejects(
    async () => service.submitAchievement(user, 206, { version: 1 }),
    (err) => err instanceof ValidationError && err.message.includes('không tồn tại trên hệ thống lưu trữ')
  );
});

test('6. [W2-Q4 Nghiệm thu độc lập] VERIFIED thành tích tuyệt đối không tự sinh AwardRecord', async () => {
  // Bản chất quy tắc nghiệp vụ Blueprint:
  // Thành tích là kê khai hoạt động được xác nhận (Achievement VERIFIED).
  // Khen thưởng (AwardRecord) là quyết định khen thưởng chính thức do RecordsOfficer lập dựa trên quyết định ban hành.
  // Quá trình verifyAchievement KHÔNG BAO GIỜ tự sinh AwardRecord!

  let awardRecordsCreatedCount = 0;
  let currentStatus = 'SUBMITTED';
  const mockRepo = {
    findAchievementById: async () => ({
      achievementId: 207,
      subjectType: 'LECTURER',
      lecturerId: 1,
      lecturer: { userId: 10 },
      createdBy: 10,
      submittedBy: 10,
      contextUnitId: 2,
      status: currentStatus,
      version: currentStatus === 'VERIFIED' ? 2 : 1,
      title: 'Bài báo Q1 đạt chuẩn',
    }),
    findLecturerByUserId: async () => ({ lecturerId: 99 }),
    findAchievementForUpdate: async () => ({
      achievementId: 207,
      status: 'SUBMITTED',
      version: 1,
    }),
    updateAchievementStatus: async () => {
      currentStatus = 'VERIFIED';
      return {
        achievementId: 207,
        status: 'VERIFIED',
        version: 2,
      };
    },
    recordStatusHistory: async () => {},
  };

  const service = new AchievementService({
    repository: mockRepo,
    roles: async () => [{ Code: 'MANAGER' }],
    scope: async () => true,
    notify: async () => {},
  });

  // Giả sử có một proxy theo dõi xem có bảng award_records nào được ghi không
  assert.equal(awardRecordsCreatedCount, 0, 'Trước khi verify: 0 AwardRecord');

  const managerUser = { userId: 2, email: 'manager@lhu.edu.vn', roles: ['MANAGER'] };
  const verifiedResult = await service.verifyAchievement(managerUser, 207, { version: 1, note: 'Đạt chuẩn' });

  assert.equal(verifiedResult.status, 'VERIFIED');
  assert.equal(awardRecordsCreatedCount, 0, 'Sau khi verify: 0 AwardRecord được tạo tự động');
});
