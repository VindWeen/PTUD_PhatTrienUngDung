import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PassThrough } from 'node:stream';
import PizZip from 'pizzip';
import { createAchievementService } from '../src/modules/achievements/achievementService.js';
import { packageAndStreamDossierZip } from '../src/modules/ai/dossierPackagerService.js';
import { closeDB } from '../src/config/database.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../src/utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================================
// SUITE 1: DELETION & RESTORATION OF ACTIVE ACHIEVEMENTS
// =========================================================================

test('Challenger 1.1: Active achievement soft-delete and restore cycle preserves ACTIVE status and versioning', async () => {
  let dbRecord = {
    achievementId: 101,
    status: 'ACTIVE',
    version: 1,
    deletedAt: null,
    expiresAt: null,
    subjectType: 'LECTURER',
    lecturer: { userId: 1001 },
    lecturerUserId: 1001,
    submissions: [],
    title: 'Thành tích hoạt động NCKH',
  };

  const mockRepo = {
    findAchievementById: async (id, client, includeDeleted = false) => {
      if (!includeDeleted && dbRecord.deletedAt) return null;
      return { ...dbRecord };
    },
    deleteAchievement: async (id, userId, version) => {
      if (dbRecord.achievementId !== id || dbRecord.version !== version) return false;
      if (dbRecord.deletedAt != null) return false; // Already deleted
      if (dbRecord.submissions.length > 0) return false; // Submissions block delete
      if (!['ACTIVE', 'DRAFT'].includes(dbRecord.status)) return false;
      dbRecord.deletedAt = new Date();
      dbRecord.expiresAt = new Date(Date.now() + 30 * 86400000);
      dbRecord.version += 1;
      return true;
    },
    restoreAchievement: async (id, version) => {
      if (dbRecord.achievementId !== id || dbRecord.version !== version) return false;
      if (!dbRecord.deletedAt) return false;
      if (!['ACTIVE', 'DRAFT'].includes(dbRecord.status)) return false;
      dbRecord.deletedAt = null;
      dbRecord.expiresAt = null;
      dbRecord.version += 1;
      return true;
    },
  };

  const service = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
  });

  // 1. Xóa mềm bản ghi ACTIVE bởi chính chủ
  const delRes = await service.deleteAchievement({ userId: 1001 }, 101);
  assert.ok(delRes.message.includes('thùng rác'));
  assert.equal(dbRecord.status, 'ACTIVE', 'Trạng thái bản ghi vẫn là ACTIVE trong thùng rác');
  assert.ok(dbRecord.deletedAt !== null, 'Phải có deletedAt');
  assert.equal(dbRecord.version, 2, 'Version phải tăng lên 2 sau khi xóa');

  // 2. Khôi phục bản ghi ACTIVE từ thùng rác
  const restored = await service.restoreAchievement({ userId: 1001 }, 101);
  assert.equal(restored.status, 'ACTIVE', 'Bản ghi sau khi khôi phục phải giữ nguyên trạng thái ACTIVE');
  assert.equal(restored.deletedAt, null, 'deletedAt phải được reset về null');
  assert.equal(dbRecord.version, 3, 'Version phải tăng lên 3 sau khi khôi phục');
});

test('Challenger 1.2: Double deletion attack on already deleted ACTIVE achievement is blocked', async () => {
  const dbRecord = {
    achievementId: 102,
    status: 'ACTIVE',
    version: 2,
    deletedAt: new Date(Date.now() - 3600000), // đã xóa 1 giờ trước
    subjectType: 'LECTURER',
    lecturer: { userId: 1001 },
    submissions: [],
  };

  const mockRepo = {
    findAchievementById: async (id, client, includeDeleted = false) => {
      if (!includeDeleted && dbRecord.deletedAt) return null;
      return { ...dbRecord };
    },
    deleteAchievement: async () => false,
  };

  const service = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
  });

  // Service level: findAchievementById không includeDeleted -> NotFoundError
  await assert.rejects(
    () => service.deleteAchievement({ userId: 1001 }, 102),
    (err) => err instanceof NotFoundError
  );
});

test('Challenger 1.3: Submissions block deletion of ACTIVE achievement at both Service and Repository levels', async () => {
  const submittedRecord = {
    achievementId: 103,
    status: 'ACTIVE',
    version: 1,
    deletedAt: null,
    subjectType: 'LECTURER',
    lecturer: { userId: 1001 },
    submissions: [{ submissionId: 5, revisionNo: 1 }],
  };

  const mockRepo = {
    findAchievementById: async () => ({ ...submittedRecord }),
    deleteAchievement: async (id, userId, version) => {
      // Mô phỏng mệnh đề SQL: AND NOT EXISTS (SELECT 1 FROM app.achievement_submissions s WHERE s.achievement_id = ...)
      if (submittedRecord.submissions.length > 0) {
        return false; // DB rowCount = 0
      }
      return true;
    },
  };

  const service = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
  });

  // Gọi deleteAchievement trên bản ghi có submissions -> repo trả về false -> service ném ConflictError
  await assert.rejects(
    () => service.deleteAchievement({ userId: 1001 }, 103),
    (err) => err instanceof ConflictError && err.message.includes('Không thể xóa')
  );
});

test('Challenger 1.4: Unauthorized deletion barrier: non-owner MEMBER, DEPARTMENT_HEAD, and FACULTY_LEAD cannot delete member ACTIVE achievement; ADMIN can', async () => {
  const targetRecord = {
    achievementId: 104,
    status: 'ACTIVE',
    version: 1,
    deletedAt: null,
    subjectType: 'LECTURER',
    lecturer: { userId: 2001 }, // Chủ sở hữu là user 2001
    submissions: [],
  };

  const mockRepo = {
    findAchievementById: async () => ({ ...targetRecord }),
    deleteAchievement: async () => true,
  };

  // Ca A: User khác mang vai trò MEMBER (user 3001)
  const memberService = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
  });
  await assert.rejects(
    () => memberService.deleteAchievement({ userId: 3001 }, 104),
    (err) => err instanceof ForbiddenError
  );

  // Ca B: Trưởng bộ môn DEPARTMENT_HEAD (user 4001) cố xóa thành tích cá nhân của giảng viên
  const headService = createAchievementService(mockRepo, {
    roles: async () => ['DEPARTMENT_HEAD'],
  });
  await assert.rejects(
    () => headService.deleteAchievement({ userId: 4001 }, 104),
    (err) => err instanceof ForbiddenError
  );

  // Ca C: Ban chủ nhiệm khoa FACULTY_LEAD (user 5001) cố xóa thành tích cá nhân của giảng viên
  const leadService = createAchievementService(mockRepo, {
    roles: async () => ['FACULTY_LEAD'],
  });
  await assert.rejects(
    () => leadService.deleteAchievement({ userId: 5001 }, 104),
    (err) => err instanceof ForbiddenError
  );

  // Ca D: Quản trị viên ADMIN (user 3 có role ADMIN trong hệ thống DB) xóa thành tích cá nhân của giảng viên
  const adminService = createAchievementService(mockRepo, {
    roles: async () => ['ADMIN'],
  });
  const adminDelRes = await adminService.deleteAchievement({ userId: 3 }, 104);
  assert.ok(adminDelRes.message.includes('thùng rác'));
});

test('Challenger 1.5: Expired trash restoration rejection (> 30 days) is strictly enforced', async () => {
  const expiredRecord = {
    achievementId: 105,
    status: 'ACTIVE',
    version: 2,
    deletedAt: new Date(Date.now() - 32 * 86400000), // đã xóa 32 ngày trước
    expiresAt: new Date(Date.now() - 2 * 86400000),  // hết hạn 2 ngày trước
    subjectType: 'LECTURER',
    lecturer: { userId: 1001 },
    submissions: [],
  };

  const mockRepo = {
    findAchievementById: async (id, client, includeDeleted) => {
      if (includeDeleted) return { ...expiredRecord };
      return null;
    },
    restoreAchievement: async () => false,
  };

  const service = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
  });

  await assert.rejects(
    () => service.restoreAchievement({ userId: 1001 }, 105),
    (err) => err instanceof ConflictError && err.message.includes('hết thời hạn khôi phục')
  );
});

test('Challenger 1.6: Repository SQL queries enforce atomic ACTIVE/DRAFT state machine constraints', () => {
  const repoPath = path.resolve(__dirname, '../src/modules/achievements/achievementRepository.js');
  const code = fs.readFileSync(repoPath, 'utf8');

  // Kiểm tra deleteAchievement SQL
  assert.match(
    code,
    /status\s+IN\s*\(\s*'ACTIVE'\s*,\s*'DRAFT'\s*\)\s+AND\s+deleted_at\s+IS\s+NULL/,
    'deleteAchievement SQL phải kiểm tra status IN (ACTIVE, DRAFT) VÀ deleted_at IS NULL'
  );
  assert.match(
    code,
    /AND\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+app\.achievement_submissions/,
    'deleteAchievement SQL phải chặn tuyệt đối các bản ghi đã có submissions'
  );

  // Kiểm tra restoreAchievement SQL
  assert.match(
    code,
    /status\s+IN\s*\(\s*'ACTIVE'\s*,\s*'DRAFT'\s*\)\s+AND\s+deleted_at\s*>\s*DATEADD\(\s*day\s*,\s*-30/,
    'restoreAchievement SQL phải kiểm tra status IN (ACTIVE, DRAFT) VÀ deleted_at trong vòng 30 ngày'
  );
});

// =========================================================================
// SUITE 2: STANDARD ROLES (MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD)
// =========================================================================

test('Challenger 2.1: Standard roles can read catalogs; unauthorized roles and empty roles fail with ForbiddenError', async () => {
  const mockRepo = {
    listActiveTypes: async () => [{ achievementTypeId: 1, name: 'Bằng khen' }],
  };

  // 1. Vai trò chuẩn hợp lệ
  for (const role of ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD']) {
    const service = createAchievementService(mockRepo, {
      roles: async () => [role],
    });
    const res = await service.listCatalogs({ userId: 10 });
    assert.equal(res.length, 1);
  }

  // 2. Vai trò không hợp lệ / không được cấp phép
  for (const unauthorized of [['GUEST'], ['STUDENT'], []]) {
    const service = createAchievementService(mockRepo, {
      roles: async () => unauthorized,
    });
    await assert.rejects(
      () => service.listCatalogs({ userId: 10 }),
      (err) => err instanceof ForbiddenError
    );
  }
});

test('Challenger 2.2: Scoped listing strictly confines MEMBER, DEPARTMENT_HEAD, and FACULTY_LEAD to their own lecturer_id', async () => {
  let capturedFilters = null;
  const mockRepo = {
    findLecturerByUserId: async (uid) => {
      const map = { 101: 501, 102: 601, 103: 701 };
      return map[uid] ? { lecturerId: map[uid], userId: uid } : null;
    },
    listAchievements: async ({ filters }) => {
      capturedFilters = filters;
      return { items: [], total: 0 };
    },
  };

  // Test MEMBER (user 101 -> lecturer 501)
  const memberSvc = createAchievementService(mockRepo, { roles: async () => ['MEMBER'] });
  await memberSvc.listAchievements({ userId: 101 });
  assert.equal(capturedFilters.scopeCondition.clause, '(a.lecturer_id = 501)');

  // Test DEPARTMENT_HEAD (user 102 -> lecturer 601)
  const headSvc = createAchievementService(mockRepo, { roles: async () => ['DEPARTMENT_HEAD'] });
  await headSvc.listAchievements({ userId: 102 });
  assert.equal(capturedFilters.scopeCondition.clause, '(a.lecturer_id = 601)');

  // Test FACULTY_LEAD (user 103 -> lecturer 701)
  const leadSvc = createAchievementService(mockRepo, { roles: async () => ['FACULTY_LEAD'] });
  await leadSvc.listAchievements({ userId: 103 });
  assert.equal(capturedFilters.scopeCondition.clause, '(a.lecturer_id = 701)');
});

test('Challenger 2.3: Cross-tenant query injection: passing malicious lecturerId in query parameters is negated by AND scopeCondition', () => {
  // Kiểm tra repo SQL construction: whereClauses được nối bằng AND
  const repoPath = path.resolve(__dirname, '../src/modules/achievements/achievementRepository.js');
  const code = fs.readFileSync(repoPath, 'utf8');

  assert.match(
    code,
    /whereClauses\.length\s*>\s*0\s*\?\s*`WHERE\s+\$\{whereClauses\.join\(' AND '\)\}`/,
    'Tất cả các điều kiện lọc bao gồm scopeCondition phải được kết nối bằng AND'
  );
});

test('Challenger 2.4: Cross-access barrier in getAchievementById: MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD cannot view another lecturer achievement', async () => {
  const foreignAchievement = {
    achievementId: 999,
    subjectType: 'LECTURER',
    lecturer: { userId: 888 }, // Chủ sở hữu là user 888
    contextUnitId: 10,
    status: 'ACTIVE',
  };

  const mockRepo = {
    findAchievementById: async () => ({ ...foreignAchievement }),
    findActiveRepresentative: async () => false,
  };

  // 1. MEMBER user 101 cố xem của user 888
  const memberSvc = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
    scope: async () => false,
  });
  await assert.rejects(
    () => memberSvc.getAchievementById({ userId: 101 }, 999),
    (err) => err instanceof ForbiddenError
  );

  // 2. DEPARTMENT_HEAD user 102 (chưa có MANAGER role) cố xem của user 888
  const headSvc = createAchievementService(mockRepo, {
    roles: async () => ['DEPARTMENT_HEAD'],
    scope: async () => false,
  });
  await assert.rejects(
    () => headSvc.getAchievementById({ userId: 102 }, 999),
    (err) => err instanceof ForbiddenError
  );

  // 3. FACULTY_LEAD user 103 cố xem của user 888
  const leadSvc = createAchievementService(mockRepo, {
    roles: async () => ['FACULTY_LEAD'],
    scope: async () => false,
  });
  await assert.rejects(
    () => leadSvc.getAchievementById({ userId: 103 }, 999),
    (err) => err instanceof ForbiddenError
  );

  // 4. Chính chủ user 888 xem -> THÀNH CÔNG
  const ownerSvc = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
    scope: async () => false,
  });
  const ownRes = await ownerSvc.getAchievementById({ userId: 888 }, 999);
  assert.equal(ownRes.achievementId, 999);
});

// =========================================================================
// SUITE 3: DOSSIER PACKAGER & ZIP STREAMING
// =========================================================================

test('Challenger 3.1: Dossier Packager combines app.achievements AND app.award_records in evaluation and output ZIP', async () => {
  const user = { userId: 1001, username: 'test.user' };
  const headers = {};
  const chunks = [];

  const mockRes = new PassThrough();
  mockRes.headersSent = false;
  mockRes.setHeader = (key, value) => {
    headers[key.toLowerCase()] = value;
  };
  mockRes.status = (code) => {
    mockRes.statusCode = code;
    return mockRes;
  };
  mockRes.json = (payload) => {
    mockRes.payload = payload;
    return mockRes;
  };
  mockRes.on('data', (c) => {
    mockRes.headersSent = true;
    chunks.push(c);
  });

  const mockClient = {
    query: async (sql) => {
      const text = sql.trim();
      if (text.includes('SELECT lecturer_id FROM app.lecturers')) {
        return { rows: [{ lecturer_id: 3001 }] };
      }
      if (text.includes('FROM app.regulation_document_versions v')) {
        return {
          rows: [
            {
              version_id: 20,
              document_id: 1,
              version_number: 'QD-2026',
              sha256_hash: 'c'.repeat(64),
              document_code: 'LHU-QD-2026',
              document_title: 'Danh Hieu Thi Dua Toan Dien',
              lhu_application_status: 'CONFIRMED_LHU_POLICY',
              effective_from_str: '2020-01-01',
              effective_to_str: '2030-12-31',
            },
          ],
        };
      }
      // 1. Nguồn app.achievements: Bài báo khoa học
      if (text.includes('FROM app.achievements a')) {
        return {
          rows: [
            {
              id: 201,
              title: 'Bai_Bao_Scopus_Q1',
              sourceTypeId: 1,
              year: 2025,
              status: 'ACTIVE',
              files: [{ id: 11, original_file_name: 'paper_q1.pdf', sha256_hash: 'd'.repeat(64) }],
            },
          ],
        };
      }
      // 2. Nguồn app.award_records: Khen thưởng đã ghi nhận
      if (text.includes('FROM app.award_records r')) {
        return {
          rows: [
            {
              id: 301,
              title: 'Chien_Si_Thi_Dua_Co_So',
              sourceTypeId: 2,
              year: 2024,
              status: 'RECORDED',
              files: [{ id: 22, original_file_name: 'quyet_dinh_cstd.pdf', sha256_hash: 'e'.repeat(64) }],
            },
          ],
        };
      }
      // 3. Tiêu chí đòi hỏi cả 2 loại
      if (text.includes('FROM app.award_criteria_versions c')) {
        return {
          rows: [
            {
              criteria_version_id: 1,
              criterion_code: 'TC-01',
              name: 'Có bài báo khoa học',
              target_type: 'INDIVIDUAL',
              min_threshold: 1,
              is_confirmed: true,
              source_rules: JSON.stringify({ minimumDistinctYears: 1, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] }),
            },
            {
              criteria_version_id: 2,
              criterion_code: 'TC-02',
              name: 'Đã đạt CSTĐ năm trước',
              target_type: 'INDIVIDUAL',
              min_threshold: 1,
              is_confirmed: true,
              source_rules: JSON.stringify({ minimumDistinctYears: 1, sourceType: 'AWARD_RECORD', awardTypeIds: [2] }),
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  await packageAndStreamDossierZip(user, { regulationId: 1 }, mockRes, mockClient);
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Kiểm tra ZIP output
  const zipBuffer = Buffer.concat(chunks);
  assert.ok(zipBuffer.length > 0, 'Phải có dữ liệu zip');
  const zip = new PizZip(zipBuffer);
  const files = Object.keys(zip.files);

  // Phải có cả 2 minh chứng từ 2 nguồn khác nhau trong cùng 1 gói ZIP
  assert.equal(files.length, 2, 'Gói ZIP phải chứa 2 file minh chứng từ cả app.achievements và app.award_records');
  assert.ok(files.some((f) => f.includes('Bai_Bao_Scopus_Q1')), 'Phải chứa minh chứng từ app.achievements');
  assert.ok(files.some((f) => f.includes('Chien_Si_Thi_Dua_Co_So')), 'Phải chứa quyết định từ app.award_records');
});

test('Challenger 3.2: ZIP streaming error handling invokes res.end() when res.headersSent is true', async () => {
  const packagerPath = path.resolve(__dirname, '../src/modules/ai/dossierPackagerService.js');
  const code = fs.readFileSync(packagerPath, 'utf8');

  // Kiểm tra mã nguồn xử lý archive.on('error')
  assert.match(
    code,
    /archive\.on\(\s*'error'[\s\S]*?if\s*\(!res\.headersSent\)[\s\S]*?res\.status\(500\)[\s\S]*?else\s*\{\s*res\.end\(\);\s*\}/,
    'archive.on(error) phải gọi res.end() khi res.headersSent là true để ngắt stream an toàn'
  );

  // Kiểm tra giả lập runtime event
  let endCalled = false;
  let statusCalled = false;
  const mockRes = {
    headersSent: true,
    status: () => { statusCalled = true; return mockRes; },
    json: () => {},
    end: () => { endCalled = true; },
  };

  // Giả lập logic handler
  const errorHandler = (err, res) => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi' });
    } else {
      res.end();
    }
  };

  errorHandler(new Error('Simulated socket error'), mockRes);
  assert.equal(endCalled, true, 'res.end() phải được gọi');
  assert.equal(statusCalled, false, 'res.status() KHÔNG được gọi khi headers đã gửi');
});

test('Challenger 3.3: Client socket close during streaming safely triggers archive.abort()', () => {
  const packagerPath = path.resolve(__dirname, '../src/modules/ai/dossierPackagerService.js');
  const code = fs.readFileSync(packagerPath, 'utf8');

  assert.match(
    code,
    /res\.on\(\s*'close'[\s\S]*?archive\.abort\(\)/,
    'Sự kiện res.on(close) phải bắt abort archive để chống rò rỉ tài nguyên stream'
  );
});

test.after(async () => {
  await closeDB();
});

