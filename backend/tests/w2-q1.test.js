import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAchievementSchema,
  updateAchievementSchema,
  listAchievementsQuerySchema,
} from '../src/modules/achievements/achievementSchemas.js';
import { createAchievementService } from '../src/modules/achievements/achievementService.js';
import { setPool, closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB();
});

test('1. [W2-Q1 Validation] Kiểm tra Schema XOR chủ thể, ngày tháng, năm và khóa field nhạy cảm', () => {
  // A. Hợp lệ cho cá nhân
  const validLecturer = {
    subjectType: 'LECTURER',
    achievementTypeId: 1,
    title: 'Nghiên cứu ứng dụng AI trong chẩn đoán y tế',
    recognitionYear: 2024,
    startDate: '2023-01-01',
    endDate: '2024-01-01',
  };
  assert.equal(createAchievementSchema.safeParse(validLecturer).success, true);

  // B. Ràng buộc XOR: Tập thể (UNIT) bắt buộc phải có organizationUnitId
  const invalidUnitWithoutId = {
    subjectType: 'UNIT',
    achievementTypeId: 2,
    title: 'Đề tài tập thể cấp cơ sở',
    recognitionYear: 2024,
  };
  const unitCheck = createAchievementSchema.safeParse(invalidUnitWithoutId);
  assert.equal(unitCheck.success, false);
  assert.ok(unitCheck.error.issues.some((i) => i.path.includes('organizationUnitId')));

  // C. Ràng buộc Ngày tháng: Ngày kết thúc < Ngày bắt đầu -> Báo lỗi
  const invalidDates = {
    ...validLecturer,
    startDate: '2024-05-01',
    endDate: '2024-01-01',
  };
  const dateCheck = createAchievementSchema.safeParse(invalidDates);
  assert.equal(dateCheck.success, false);
  assert.ok(dateCheck.error.issues.some((i) => i.path.includes('endDate')));

  // D. Ràng buộc Năm ghi nhận: Năm < 1990 -> Báo lỗi
  const invalidYear = {
    ...validLecturer,
    recognitionYear: 1985,
  };
  const yearCheck = createAchievementSchema.safeParse(invalidYear);
  assert.equal(yearCheck.success, false);
  assert.ok(yearCheck.error.issues.some((i) => i.path.includes('recognitionYear')));

  // E. Khóa field nhạy cảm khỏi PATCH (status, createdBy, contextUnitId, lecturerId)
  assert.equal(updateAchievementSchema.safeParse({ title: 'Tên mới', version: 1 }).success, true);
  assert.equal(updateAchievementSchema.safeParse({ title: 'Tên mới', status: 'VERIFIED', version: 1 }).success, false);
  assert.equal(updateAchievementSchema.safeParse({ title: 'Tên mới', contextUnitId: 99, version: 1 }).success, false);
  assert.equal(updateAchievementSchema.safeParse({ title: 'Tên mới', createdBy: 1, version: 1 }).success, false);
  assert.equal(updateAchievementSchema.safeParse({ title: 'Tên mới', lecturerId: 2, version: 1 }).success, false);
  assert.equal(updateAchievementSchema.safeParse({ title: 'Tên mới' }).success, false); // Thiếu version
});

test('2. [W2-Q1 Nghiệm thu] Chủ hồ sơ cá nhân tạo bản nháp thành tích, ContextUnitId tự động gán từ đơn vị công tác chính', async () => {
  let createdData = null;
  const mockRepo = {
    findLecturerByUserId: async (userId) => ({
      lecturerId: 101,
      userId,
      fullName: 'PGS.TS. Nguyễn Văn An',
      primaryUnitId: 2, // FIT_SE
    }),
    createAchievement: async (data) => {
      createdData = data;
      return { achievementId: 1001, version: 1 };
    },
    findAchievementById: async (id) => ({
      achievementId: id,
      subjectType: 'LECTURER',
      lecturerId: 101,
      contextUnitId: 2,
      status: 'DRAFT',
      title: createdData?.title,
      version: 1,
    }),
  };

  // Mock roles: LECTURER
  setPool({
    end: async () => {},
    query: async (text) => {
      if (text.includes('FROM app.user_roles ur')) {
        return { rows: [{ RoleId: 2, Code: 'LECTURER', Name: 'Giảng viên' }] };
      }
      return { rows: [] };
    },
  });

  const service = createAchievementService(mockRepo);
  const result = await service.createAchievement(
    { userId: 1 },
    {
      subjectType: 'LECTURER',
      achievementTypeId: 1,
      title: 'Công bố bài báo Q1 về Deep Learning',
      recognitionYear: 2024,
    }
  );

  assert.equal(result.achievementId, 1001);
  assert.equal(createdData.lecturerId, 101);
  assert.equal(createdData.organizationUnitId, null);
  assert.equal(createdData.contextUnitId, 2); // ContextUnitId bất biến từ đơn vị chính
  assert.equal(createdData.createdBy, 1);
});

test('3. [W2-Q1 Nghiệm thu] Đại diện đơn vị đúng hạn tạo thành tích tập thể; Người không có phân công đại diện bị chặn 403', async () => {
  let createdData = null;
  const mockRepo = {
    findActiveRepresentative: async (userId, unitId) => {
      if (userId === 4 && unitId === 2) return { unitRepresentativeId: 1, userId: 4, unitId: 2 };
      return null;
    },
    createAchievement: async (data) => {
      createdData = data;
      return { achievementId: 2001, version: 1 };
    },
    findAchievementById: async (id) => ({
      achievementId: id,
      subjectType: 'UNIT',
      organizationUnitId: 2,
      contextUnitId: 2,
      status: 'DRAFT',
      version: 1,
    }),
  };

  const service = createAchievementService(mockRepo);

  // A. Đại diện hợp lệ (UserId: 4, UnitId: 2) -> Thành công
  const successResult = await service.createAchievement(
    { userId: 4 },
    {
      subjectType: 'UNIT',
      organizationUnitId: 2,
      achievementTypeId: 3,
      title: 'Biên soạn giáo trình chuyên ngành Kỹ thuật Phần mềm',
      recognitionYear: 2024,
    }
  );
  assert.equal(successResult.achievementId, 2001);
  assert.equal(createdData.organizationUnitId, 2);
  assert.equal(createdData.lecturerId, null);
  assert.equal(createdData.contextUnitId, 2);

  // B. Giảng viên không có phân công đại diện (UserId: 1, UnitId: 2) -> Bị chặn 403 Forbidden
  await assert.rejects(
    () =>
      service.createAchievement(
        { userId: 1 },
        {
          subjectType: 'UNIT',
          organizationUnitId: 2,
          achievementTypeId: 3,
          title: 'Thành tích tập thể trái phép',
          recognitionYear: 2024,
        }
      ),
    (err) => err.statusCode === 403
  );
});

test('4. [W2-Q1 Nghiệm thu] Manager xem hồ sơ theo ContextUnitId; chặn truy cập hồ sơ ngoài phạm vi 403', async () => {
  const mockRepo = {
    findAchievementById: async (id) => ({
      achievementId: id,
      subjectType: 'LECTURER',
      lecturerId: 101,
      contextUnitId: 2, // Thuộc FIT_SE
      lecturer: { userId: 1 },
    }),
  };

  // Mock DB scope check: TS. Bích (UserId: 2) có scope duyệt Unit #2 (FIT_SE) nhờ IncludeDescendants từ Khoa FIT #1
  setPool({
    end: async () => {},
    query: async (text, values) => {
      if (text.includes('WITH RECURSIVE ScopeHierarchy')) {
        const targetUnitId = Number(values[2]);
        // Unit #2 nằm trong scope, Unit #4 không nằm trong scope
        return { rows: targetUnitId === 2 ? [{ HasScope: 1 }] : [], rowCount: targetUnitId === 2 ? 1 : 0 };
      }
      if (text.includes('FROM app.user_roles ur')) {
        return { rows: [{ RoleId: 3, Code: 'MANAGER', Name: 'Lãnh đạo Đơn vị' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  });

  const service = createAchievementService(mockRepo);

  // A. Xem hồ sơ có ContextUnitId = 2 trong phạm vi -> Được phép
  const ach = await service.getAchievementById({ userId: 2 }, 1001);
  assert.equal(ach.achievementId, 1001);

  // B. Xem hồ sơ có ContextUnitId = 4 ngoài phạm vi -> Bị chặn 403 Forbidden
  const mockRepoOutOfScope = {
    findAchievementById: async () => ({
      achievementId: 9999,
      subjectType: 'LECTURER',
      lecturerId: 202,
      contextUnitId: 4, // Khoa Dược
      lecturer: { userId: 9 },
    }),
  };
  const serviceOutOfScope = createAchievementService(mockRepoOutOfScope);
  await assert.rejects(
    () => serviceOutOfScope.getAchievementById({ userId: 2 }, 9999),
    (err) => err.statusCode === 403
  );
});

test('5. [W2-Q1 Nghiệm thu] Chỉ nháp (DRAFT) chưa gửi được xóa; Hồ sơ SUBMITTED hoặc VERIFIED không được xóa (409 Conflict)', async () => {
  let deleted = false;
  const mockRepo = {
    findAchievementById: async (id) => {
      if (id === 1) {
        return { achievementId: 1, status: 'DRAFT', subjectType: 'LECTURER', lecturer: { userId: 1 } };
      }
      if (id === 2) {
        return { achievementId: 2, status: 'SUBMITTED', subjectType: 'LECTURER', lecturer: { userId: 1 } };
      }
      if (id === 3) {
        return { achievementId: 3, status: 'VERIFIED', subjectType: 'LECTURER', lecturer: { userId: 1 } };
      }
      return null;
    },
    deleteAchievement: async (id) => {
      if (id === 1) {
        deleted = true;
        return true;
      }
      return false;
    },
  };

  setPool({
    end: async () => {},
    query: async (text) => {
      if (text.includes('FROM app.user_roles ur')) {
        return { rows: [{ RoleId: 2, Code: 'LECTURER' }] };
      }
      if (text.includes('INSERT INTO app.audit_logs')) {
        return { rows: [{ audit_id: 1 }] };
      }
      return { rows: [] };
    },
  });

  const service = createAchievementService(mockRepo);

  // A. Xóa DRAFT -> Thành công
  const res = await service.deleteAchievement({ userId: 1 }, 1);
  assert.equal(deleted, true);
  assert.ok(res.message);

  // B. Xóa SUBMITTED -> 409 Conflict
  await assert.rejects(
    () => service.deleteAchievement({ userId: 1 }, 2),
    (err) => err.statusCode === 409
  );

  // C. Xóa VERIFIED -> 409 Conflict
  await assert.rejects(
    () => service.deleteAchievement({ userId: 1 }, 3),
    (err) => err.statusCode === 409
  );
});

test('6. [W2-Q1 Nghiệm thu] Chỉnh sửa bản nháp kiểm tra Optimistic Locking (version mismatch ném 409 ConcurrencyConflictError)', async () => {
  const mockRepo = {
    findAchievementById: async (id) => ({
      achievementId: id,
      status: 'DRAFT',
      subjectType: 'LECTURER',
      title: 'Tên gốc',
      version: 2,
      lecturer: { userId: 1 },
    }),
    updateAchievement: async (id, version) => {
      // Nếu version không khớp phiên bản hiện tại (version 2) -> trả về null mô phỏng rowCount = 0
      if (version === 2) {
        return { achievementId: id, version: 3 };
      }
      return null;
    },
  };

  setPool({
    end: async () => {},
    query: async (text) => {
      if (text.includes('FROM app.user_roles ur')) {
        return { rows: [{ RoleId: 2, Code: 'LECTURER' }] };
      }
      if (text.includes('INSERT INTO app.audit_logs')) {
        return { rows: [{ audit_id: 1 }] };
      }
      return { rows: [] };
    },
  });

  const service = createAchievementService(mockRepo);

  // A. Phiên bản version khớp (version = 2) -> Cập nhật thành công
  const okResult = await service.updateAchievement({ userId: 1 }, 10, {
    title: 'Tiêu đề đã được cập nhật',
    version: 2,
  });
  assert.ok(okResult);

  // B. Phiên bản version cũ/lệch (version = 1) -> Ném 409 ConcurrencyConflictError
  await assert.rejects(
    () =>
      service.updateAchievement({ userId: 1 }, 10, {
        title: 'Cố ghi đè phiên bản cũ',
        version: 1,
      }),
    (err) => err.statusCode === 409 && err.code === 'CONCURRENCY_CONFLICT'
  );
});
