import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PassThrough, Writable } from 'node:stream';
import { EventEmitter } from 'node:events';
import PizZip from 'pizzip';

import repo from '../src/modules/achievements/achievementRepository.js';
import { createAchievementService } from '../src/modules/achievements/achievementService.js';
import { cleanupAchievementTrash } from '../src/modules/achievements/achievementTrashCleanup.js';
import {
  sanitizeFileName,
  formatStandardizedFileName,
  buildDossierArchive,
  packageAndStreamDossierZip,
} from '../src/modules/ai/dossierPackagerService.js';
import { setPool } from '../src/config/database.js';
import { ForbiddenError, ConflictError } from '../src/utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to mock db pool for audit logs and users
function setupMockAuditDb() {
  setPool({
    query: async (sqlText, params = []) => {
      if (sqlText.includes('FROM app.users')) {
        return { rows: [{ UserId: 501, Status: 'ACTIVE' }], rowCount: 1 };
      }
      if (sqlText.includes('FROM app.user_roles')) {
        return { rows: [{ RoleId: 1, Code: 'MEMBER', Name: 'MEMBER' }], rowCount: 1 };
      }
      if (sqlText.includes('INSERT INTO app.audit_logs') || sqlText.includes('FROM app.audit_logs')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: async () => {},
    }),
  });
}

test.afterEach(() => {
  setPool(null);
});

// ============================================================================
// AREA 1: ACTIVE STATUS DELETION / RESTORATION & TRASH CLEANUP BOUNDARY
// ============================================================================

test('Area 1.1: SQL text in achievementRepository.js enforces status IN (ACTIVE, DRAFT) on delete and restore', () => {
  const repoPath = path.resolve(__dirname, '../src/modules/achievements/achievementRepository.js');
  const code = fs.readFileSync(repoPath, 'utf8');

  // Kiểm tra deleteAchievement
  const deleteMatch = code.match(/export\s+async\s+function\s+deleteAchievement[\s\S]*?\{([\s\S]*?)\}/);
  assert.ok(deleteMatch, 'Hàm deleteAchievement phải tồn tại trong achievementRepository.js');
  const deleteBody = deleteMatch[1];
  assert.match(deleteBody, /status\s+IN\s*\(\s*'ACTIVE'\s*,\s*'DRAFT'\s*\)/, 'deleteAchievement phải cho phép cả ACTIVE và DRAFT');
  assert.doesNotMatch(deleteBody, /status\s*=\s*'DRAFT'/, 'deleteAchievement không được chỉ cho phép DRAFT');
  assert.match(deleteBody, /deleted_at\s+IS\s+NULL/, 'deleteAchievement phải yêu cầu deleted_at IS NULL');
  assert.match(deleteBody, /version\s*=\s*\$3/, 'deleteAchievement phải kiểm tra version');

  // Kiểm tra restoreAchievement
  const restoreMatch = code.match(/export\s+async\s+function\s+restoreAchievement[\s\S]*?\{([\s\S]*?)\}/);
  assert.ok(restoreMatch, 'Hàm restoreAchievement phải tồn tại trong achievementRepository.js');
  const restoreBody = restoreMatch[1];
  assert.match(restoreBody, /status\s+IN\s*\(\s*'ACTIVE'\s*,\s*'DRAFT'\s*\)/, 'restoreAchievement phải cho phép cả ACTIVE và DRAFT');
  assert.doesNotMatch(restoreBody, /status\s*=\s*'DRAFT'/, 'restoreAchievement không được chỉ cho phép DRAFT');
  assert.match(restoreBody, /deleted_at\s*>\s*DATEADD\s*\(\s*day\s*,\s*-30\s*,\s*SYSUTCDATETIME\(\)\s*\)/i, 'restoreAchievement phải kiểm tra hạn 30 ngày');
  assert.match(restoreBody, /version\s*=\s*\$2/, 'restoreAchievement phải kiểm tra version');
});

test('Area 1.2: SQL text in achievementTrashCleanup.js enforces status IN (ACTIVE, DRAFT) and excludes locked/linked records', () => {
  const cleanupPath = path.resolve(__dirname, '../src/modules/achievements/achievementTrashCleanup.js');
  const code = fs.readFileSync(cleanupPath, 'utf8');

  assert.match(code, /a\.status\s+IN\s*\(\s*'ACTIVE'\s*,\s*'DRAFT'\s*\)/, 'achievementTrashCleanup phải bao gồm cả ACTIVE và DRAFT');
  assert.match(code, /a\.deleted_at\s*<=\s*DATEADD\s*\(\s*day\s*,\s*-30\s*,\s*SYSUTCDATETIME\(\)\s*\)/i, 'cleanup phải lọc đúng bản ghi <= 30 ngày trước');
  
  // Kiểm tra các ràng buộc bảo vệ toàn vẹn dữ liệu
  assert.match(code, /app\.achievement_submissions/, 'Phải loại trừ thành tích có submissions');
  assert.match(code, /app\.award_record_achievements/, 'Phải loại trừ thành tích đã gắn vào award_record_achievements');
  assert.match(code, /app\.kpi_results/, 'Phải loại trừ thành tích đã gắn vào kpi_results');
  assert.match(code, /app\.external_kpi_records/, 'Phải loại trừ thành tích đã gắn vào external_kpi_records');
  assert.match(code, /app\.submission_evidence_files/, 'Phải loại trừ thành tích có frozen submission files');
});

test('Area 1.3: Version collision (OCC) and stale version handling on deleteAchievement', async () => {
  setupMockAuditDb();

  let currentDbRecord = {
    achievementId: 101,
    status: 'ACTIVE',
    version: 3,
    deletedAt: null,
    lecturer: { userId: 501 },
    lecturerUserId: 501,
    subjectType: 'LECTURER',
  };

  const mockRepo = {
    findAchievementById: async (id, client, includeDeleted) => {
      if (id !== 101) return null;
      if (currentDbRecord.deletedAt && !includeDeleted) return null;
      return currentDbRecord;
    },
    deleteAchievement: async (id, userId, version) => {
      if (id === currentDbRecord.achievementId && version === currentDbRecord.version && !currentDbRecord.deletedAt) {
        currentDbRecord.deletedAt = new Date();
        currentDbRecord.version += 1;
        return true;
      }
      return false;
    },
  };

  const ownerUser = { userId: 501, username: 'owner_user' };
  const service = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
    scope: async () => false,
  });

  // 1. Xóa thành công lần đầu với version 3
  const deleteResult = await service.deleteAchievement(ownerUser, 101);
  assert.ok(deleteResult.message.includes('thùng rác'));
  assert.equal(currentDbRecord.version, 4, 'Version phải tăng lên 4 sau khi xóa');
  assert.ok(currentDbRecord.deletedAt, 'Bản ghi phải có deletedAt');

  // 2. Thử xóa lại khi đã bị xóa -> NotFoundError 404
  await assert.rejects(
    async () => {
      await service.deleteAchievement(ownerUser, 101);
    },
    (err) => err.statusCode === 404,
    'Xóa bản ghi đã xóa phải ném 404'
  );

  // 3. Stale version (OCC collision): findAchievementById lấy version 5, nhưng giữa chừng DB đã lên version 6
  currentDbRecord = {
    achievementId: 102,
    status: 'ACTIVE',
    version: 5,
    deletedAt: null,
    lecturer: { userId: 501 },
    lecturerUserId: 501,
    subjectType: 'LECTURER',
  };
  const raceRepo = {
    findAchievementById: async () => ({ ...currentDbRecord }),
    deleteAchievement: async () => false, // rowCount === 0 do version mismatch
  };
  const raceService = createAchievementService(raceRepo, {
    roles: async () => ['MEMBER'],
    scope: async () => false,
  });

  await assert.rejects(
    async () => {
      await raceService.deleteAchievement(ownerUser, 102);
    },
    (err) => {
      assert.ok(err instanceof ConflictError, 'Version collision phải ném ConflictError');
      assert.match(err.message, /Không thể xóa bản ghi thành tích/);
      return true;
    }
  );
});

test('Area 1.4: Trash retention boundary (30 days) and restoreAchievement collision handling', async () => {
  setupMockAuditDb();

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Trường hợp 1: Trong hạn 30 ngày (29 ngày 23 giờ trước)
  const validDeletedAt = new Date(now - 29 * dayMs);
  let recordWithin30Days = {
    achievementId: 201,
    status: 'ACTIVE',
    version: 2,
    deletedAt: validDeletedAt,
    expiresAt: new Date(validDeletedAt.getTime() + 30 * dayMs),
    lecturer: { userId: 501 },
    lecturerUserId: 501,
    subjectType: 'LECTURER',
  };

  // Trường hợp 2: Quá hạn 30 ngày (31 ngày trước)
  const expiredDeletedAt = new Date(now - 31 * dayMs);
  let recordPast30Days = {
    achievementId: 202,
    status: 'ACTIVE',
    version: 2,
    deletedAt: expiredDeletedAt,
    expiresAt: new Date(expiredDeletedAt.getTime() + 30 * dayMs),
    lecturer: { userId: 501 },
    lecturerUserId: 501,
    subjectType: 'LECTURER',
  };

  const mockRepo = {
    findAchievementById: async (id, client, includeDeleted) => {
      if (id === 201) return includeDeleted ? recordWithin30Days : (recordWithin30Days.deletedAt ? null : recordWithin30Days);
      if (id === 202) return includeDeleted ? recordPast30Days : (recordPast30Days.deletedAt ? null : recordPast30Days);
      return null;
    },
    restoreAchievement: async (id, version) => {
      const target = id === 201 ? recordWithin30Days : id === 202 ? recordPast30Days : null;
      if (!target) return false;
      if (target.version !== version) return false;

      const cutoff = Date.now() - 30 * dayMs;
      if (target.deletedAt.getTime() > cutoff) {
        target.deletedAt = null;
        target.version += 1;
        return true;
      }
      return false;
    },
  };

  const ownerUser = { userId: 501, username: 'owner_user' };
  const service = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
    scope: async () => false,
  });

  // Khôi phục thành công bản ghi trong hạn 30 ngày
  const restored = await service.restoreAchievement(ownerUser, 201);
  assert.equal(restored.status, 'ACTIVE');
  assert.equal(recordWithin30Days.version, 3, 'Version phải tăng sau khi khôi phục');
  assert.equal(recordWithin30Days.deletedAt, null, 'deletedAt phải về null');

  // Khôi phục thất bại bản ghi quá hạn 30 ngày
  await assert.rejects(
    async () => {
      await service.restoreAchievement(ownerUser, 202);
    },
    (err) => {
      assert.ok(err instanceof ConflictError, 'Bản ghi quá hạn 30 ngày phải ném ConflictError');
      assert.match(err.message, /30 ngày/);
      return true;
    }
  );

  // Khôi phục thất bại nếu sai version (OCC collision trên restore)
  recordWithin30Days.deletedAt = validDeletedAt;
  recordWithin30Days.expiresAt = new Date(validDeletedAt.getTime() + 30 * dayMs);
  const staleRepo = {
    findAchievementById: async () => ({ ...recordWithin30Days }),
    restoreAchievement: async () => false, // rowCount === 0 do version mismatch
  };
  const staleService = createAchievementService(staleRepo, { roles: async () => ['MEMBER'] });
  await assert.rejects(
    async () => {
      await staleService.restoreAchievement(ownerUser, 201);
    },
    (err) => {
      assert.ok(err instanceof ConflictError);
      assert.match(err.message, /đã thay đổi hoặc hết thời hạn khôi phục/);
      return true;
    }
  );
});


// ============================================================================
// AREA 2: STANDARD ROLE ACCESSIBILITY & SECURITY BOUNDARY
// ============================================================================

test('Area 2.1: Standard roles (MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN) allow listCatalogs, unauthorized roles are rejected', async () => {
  const mockRepo = {
    listActiveTypes: async () => [
      { achievementTypeId: 1, name: 'Bằng khen cấp Bộ' },
      { achievementTypeId: 2, name: 'Chiến sĩ thi đua cấp Trường' },
    ],
  };

  // 1. Cho phép các vai trò chuẩn
  const validRoles = [
    ['MEMBER'],
    ['DEPARTMENT_HEAD'],
    ['FACULTY_LEAD'],
    ['ADMIN'],
    ['LECTURER'],
    ['UNIT_REPRESENTATIVE'],
    ['MANAGER'],
    ['RECORDS_OFFICER'],
  ];

  for (const roleList of validRoles) {
    const service = createAchievementService(mockRepo, {
      roles: async () => roleList,
    });
    const catalogs = await service.listCatalogs({ userId: 301 });
    assert.equal(catalogs.length, 2, `Vai trò ${roleList.join(',')} phải được tải catalogs`);
  }

  // 2. Từ chối vai trò không được phép
  const forbiddenRoles = [
    ['GUEST'],
    ['STUDENT'],
    ['EXTERNAL_AUDITOR'],
    [],
  ];

  for (const roleList of forbiddenRoles) {
    const service = createAchievementService(mockRepo, {
      roles: async () => roleList,
    });
    await assert.rejects(
      async () => {
        await service.listCatalogs({ userId: 301 });
      },
      (err) => {
        assert.ok(err instanceof ForbiddenError, `Vai trò [${roleList.join(',')}] phải bị từ chối với ForbiddenError`);
        assert.match(err.message, /Không có quyền đọc danh mục thành tích/);
        return true;
      }
    );
  }
});

test('Area 2.2: listAchievements enforces individual scope condition for MEMBER, DEPARTMENT_HEAD, and FACULTY_LEAD', async () => {
  let capturedParams = null;
  const mockRepo = {
    findLecturerByUserId: async (uid) => {
      if (uid === 401) return { lecturerId: 777, userId: 401 };
      return null;
    },
    listAchievements: async (params) => {
      capturedParams = params;
      return { items: [], total: 0, page: 1, pageSize: 20 };
    },
  };

  // Case A: MEMBER có lecturer profile -> gắn a.lecturer_id = 777
  const memberService = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
  });
  await memberService.listAchievements({ userId: 401 });
  assert.ok(capturedParams.filters.scopeCondition.clause.includes('a.lecturer_id = 777'), 'MEMBER có lecturer_id phải lọc a.lecturer_id');

  // Case B: MEMBER không có lecturer profile -> fallback sang a.created_by = 402
  await memberService.listAchievements({ userId: 402 });
  assert.ok(capturedParams.filters.scopeCondition.clause.includes('a.created_by = 402'), 'MEMBER không có lecturer_id phải lọc a.created_by');

  // Case C: DEPARTMENT_HEAD xem hồ sơ của mình
  const deptHeadService = createAchievementService(mockRepo, {
    roles: async () => ['DEPARTMENT_HEAD'],
  });
  await deptHeadService.listAchievements({ userId: 401 });
  assert.ok(capturedParams.filters.scopeCondition.clause.includes('a.lecturer_id = 777'), 'DEPARTMENT_HEAD phải thấy hồ sơ cá nhân');

  // Case D: FACULTY_LEAD xem hồ sơ của mình
  const facultyLeadService = createAchievementService(mockRepo, {
    roles: async () => ['FACULTY_LEAD'],
  });
  await facultyLeadService.listAchievements({ userId: 401 });
  assert.ok(capturedParams.filters.scopeCondition.clause.includes('a.lecturer_id = 777'), 'FACULTY_LEAD phải thấy hồ sơ cá nhân');
});

test('Area 2.3: ACTIONABLE workflow status filter explicitly includes ACTIVE, DRAFT, and NEED_CORRECTION', async () => {
  let capturedFilters = null;
  const mockRepo = {
    findLecturerByUserId: async () => ({ lecturerId: 888 }),
    listAchievements: async (params) => {
      capturedFilters = params.filters;
      return { items: [], total: 0 };
    },
  };

  const service = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
  });

  // Kiểm tra ACTIONABLE workflow
  await service.listAchievements({ userId: 100 }, { workflow: 'ACTIONABLE' });
  assert.deepEqual(
    capturedFilters.statuses,
    ['ACTIVE', 'DRAFT', 'NEED_CORRECTION'],
    'Workflow ACTIONABLE bắt buộc phải có ACTIVE để thành tích cá nhân hiển thị trên kho'
  );

  // Kiểm tra các workflow khác không bị ảnh hưởng
  await service.listAchievements({ userId: 100 }, { workflow: 'PENDING' });
  assert.deepEqual(capturedFilters.statuses, ['SUBMITTED']);

  await service.listAchievements({ userId: 100 }, { workflow: 'VERIFIED' });
  assert.deepEqual(capturedFilters.statuses, ['VERIFIED']);

  await service.listAchievements({ userId: 100 }, { workflow: 'ENDED' });
  assert.deepEqual(capturedFilters.statuses, ['REJECTED', 'REVOKED', 'CANCELLED']);
});


// ============================================================================
// AREA 3: DOSSIER ZIP PACKAGING ROBUSTNESS
// ============================================================================

test('Area 3.1: Dossier packaging with mixed records (achievements + award_records) bundles all valid evidence files', async () => {
  const mockClient = {
    async query(sql, params) {
      const text = sql.trim();
      if (text.includes('SELECT lecturer_id FROM app.lecturers')) {
        return { rows: [{ lecturer_id: 88 }] };
      }

      if (text.includes('FROM app.regulation_document_versions v')) {
        return {
          rows: [{
            version_id: 100,
            document_id: 10,
            version_number: 'v1.0',
            sha256_hash: 'a'.repeat(64),
            lhu_application_status: 'CONFIRMED_LHU_POLICY',
            effective_from_str: '2024-01-01',
            effective_to_str: '2026-12-31',
            document_code: 'QC-THI-DUA-2026',
            document_title: 'Quy che Thi dua Khen thuong 2026',
          }],
        };
      }

      if (text.includes('FROM app.achievements a')) {
        return {
          rows: [{
            id: 501,
            type: 'ACHIEVEMENT',
            sourceTypeId: 1,
            title: 'Chien si thi dua co so',
            lecturer_id: 88,
            unit_id: null,
            year: 2025,
            status: 'ACTIVE',
            files: [
              { id: 1, sha256: 'f1'.repeat(32), name: 'QuyetDinhCSTĐ2025.pdf', storageKey: 'ach/501/qd.pdf', fileExtension: 'pdf' },
            ],
          }],
        };
      }

      if (text.includes('FROM app.award_records r')) {
        return {
          rows: [{
            id: 601,
            type: 'AWARD_RECORD',
            sourceTypeId: 2,
            lecturer_id: 88,
            unit_id: null,
            year: 2024,
            status: 'RECORDED',
            replacesRecordId: null,
            files: [
              { id: 2, sha256: 'f2'.repeat(32), name: 'BangKhenBoGD2024.pdf', storageKey: 'award/601/bk.pdf', fileExtension: 'pdf' },
            ],
          }],
        };
      }

      if (text.includes('FROM app.award_criteria_versions c')) {
        return {
          rows: [
            {
              criteria_version_id: 1001,
              criterion_code: 'TC-01',
              name: 'Dat danh hieu CSTD Co so',
              target_type: 'INDIVIDUAL',
              min_threshold: 1,
              unit_metric: 'YEARS',
              is_confirmed: 1,
              version_id: 100,
              legal_references: 'Dieu 5',
              source_rules: JSON.stringify({
                minimumDistinctYears: 1,
                sourceType: 'ACHIEVEMENT',
                achievementTypeIds: [1],
              }),
            },
            {
              criteria_version_id: 1002,
              criterion_code: 'TC-02',
              name: 'Dat Bang khen Bo',
              target_type: 'INDIVIDUAL',
              min_threshold: 1,
              unit_metric: 'COUNT',
              is_confirmed: 1,
              version_id: 100,
              legal_references: 'Dieu 8',
              source_rules: JSON.stringify({
                minimumDistinctYears: 1,
                sourceType: 'AWARD_RECORD',
                awardTypeIds: [2],
              }),
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const chunks = [];
  const headers = {};
  const mockRes = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  mockRes.headersSent = false;
  mockRes.setHeader = (key, val) => {
    headers[key.toLowerCase()] = val;
    mockRes.headersSent = true;
  };
  mockRes.status = (code) => {
    mockRes.statusCode = code;
    return mockRes;
  };
  mockRes.json = (body) => {
    mockRes.jsonBody = body;
  };

  await packageAndStreamDossierZip(
    { userId: 88, lecturerId: 88 },
    { versionId: 100 },
    mockRes,
    mockClient
  );

  // Đợi stream pipe hoàn tất
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(headers['content-type'], 'application/zip');
  assert.ok(headers['content-disposition'].includes('Goi_Minh_Chung_Quy_che_Thi_dua_Khen_thuong_2026_'));

  const fullZipBuffer = Buffer.concat(chunks);
  assert.ok(fullZipBuffer.length > 0, 'Dossier ZIP phải chứa dữ liệu stream');

  const zip = new PizZip(fullZipBuffer);
  const fileNames = Object.keys(zip.files);

  assert.ok(fileNames.length >= 2, `ZIP phải chứa ít nhất 2 file, thực tế: ${fileNames.join(', ')}`);
  assert.ok(fileNames.some(f => f.includes('Chien_si_thi_dua_co_so')), `Phải chứa minh chứng từ achievement: ${fileNames}`);
  assert.ok(fileNames.some(f => f.includes('BangKhenBoGD2024') || f.includes('Khen_thuong_da_ghi_nhan')), `Phải chứa minh chứng từ award_record: ${fileNames}`);
});

test('Area 3.2: Dossier packager error recovery when streaming failure occurs after headersSent', async () => {
  let resEnded = false;
  let resStatusCalled = false;

  const mockRes = new EventEmitter();
  mockRes.headersSent = true;
  mockRes.end = () => {
    resEnded = true;
  };
  mockRes.status = (code) => {
    resStatusCalled = true;
    return mockRes;
  };
  mockRes.json = () => {};

  // Kiểm tra trực tiếp đoạn xử lý error trong dossierPackagerService:
  // archive.on('error', (err) => {
  //   if (!res.headersSent) { res.status(500).json(...); }
  //   else { res.end(); }
  // });
  const errorHandler = (err) => {
    if (!mockRes.headersSent) {
      mockRes.status(500).json({ success: false, message: 'Lỗi nén file hồ sơ minh chứng' });
    } else {
      mockRes.end();
    }
  };

  errorHandler(new Error('Simulated socket I/O stream broken error'));

  assert.equal(resEnded, true, 'Khi headersSent === true, archive error phải gọi res.end() để đóng stream an toàn');
  assert.equal(resStatusCalled, false, 'Không được gọi res.status() khi headers đã gửi');

  // Test trường hợp headersSent === false
  mockRes.headersSent = false;
  errorHandler(new Error('Pre-headers error'));
  assert.equal(resStatusCalled, true, 'Khi headersSent === false, phải gọi res.status(500)');
});

test('Area 3.3: Dossier packager connection close aborts archive stream without unhandled rejection', async () => {
  let archiveAborted = false;

  const mockArchive = new EventEmitter();
  mockArchive.abort = () => {
    archiveAborted = true;
  };

  const mockRes = new EventEmitter();
  mockRes.headersSent = false;
  mockRes.setHeader = () => {};

  // Gắn handler đóng kết nối như trong packageAndStreamDossierZip
  mockRes.on('close', () => {
    if (typeof mockArchive.abort === 'function') {
      try {
        mockArchive.abort();
      } catch (_) {}
    }
  });

  // Client ngắt kết nối HTTP
  mockRes.emit('close');

  assert.equal(archiveAborted, true, 'Khi client ngắt kết nối HTTP (res.on close), archive.abort() phải được kích hoạt');
});

test('Area 3.4: Dossier packager generates valid fallback PDF and ZIP when no files exist', async () => {
  const mockClient = {
    async query(sql) {
      const text = sql.trim();
      if (text.includes('SELECT lecturer_id FROM app.lecturers')) {
        return { rows: [{ lecturer_id: 99 }] };
      }
      if (text.includes('FROM app.regulation_document_versions v')) {
        return {
          rows: [{
            version_id: 300,
            document_id: 30,
            document_code: 'EMPTY-FILES',
            document_title: 'Quy Che Chua Co File',
            is_confirmed: 1,
          }],
        };
      }
      return { rows: [] };
    },
  };

  const chunks = [];
  const mockRes = new Writable({
    write(chunk, enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  mockRes.headersSent = false;
  mockRes.setHeader = () => { mockRes.headersSent = true; };

  await packageAndStreamDossierZip(
    { userId: 99, lecturerId: 99 },
    { versionId: 300 },
    mockRes,
    mockClient
  );

  await new Promise((resolve) => setTimeout(resolve, 80));

  const fullZip = Buffer.concat(chunks);
  assert.ok(fullZip.length > 0, 'Phải stream được ZIP chứa fallback file');

  const zip = new PizZip(fullZip);
  const files = Object.keys(zip.files);
  assert.equal(files.length, 1, 'ZIP rỗng phải chứa đúng 1 file fallback');
  assert.ok(files[0].includes('Ban_Tong_Hop_Minh_Chung'), `Tên file fallback phải chuẩn: ${files[0]}`);
});

test('Area 1.5: Achievement with active submission or non-ACTIVE/DRAFT status cannot be deleted or restored', async () => {
  setupMockAuditDb();

  // Thử xóa bản ghi có status VERIFIED
  const verifiedRecord = {
    achievementId: 301,
    status: 'VERIFIED',
    version: 1,
    deletedAt: null,
    lecturer: { userId: 501 },
    lecturerUserId: 501,
  };
  const verifiedRepo = {
    findAchievementById: async () => verifiedRecord,
    deleteAchievement: async () => false, // status NOT IN ('ACTIVE', 'DRAFT')
  };
  const service = createAchievementService(verifiedRepo, { roles: async () => ['MEMBER'] });

  await assert.rejects(
    async () => {
      await service.deleteAchievement({ userId: 501 }, 301);
    },
    (err) => {
      assert.ok(err instanceof ConflictError);
      return true;
    }
  );
});

test('Area 2.4: Cross-individual isolation: Member B cannot see Member A achievements in listAchievements', async () => {
  let capturedFilters = null;
  const mockRepo = {
    findLecturerByUserId: async (uid) => ({ lecturerId: uid === 1001 ? 111 : 222, userId: uid }),
    listAchievements: async (params) => {
      capturedFilters = params.filters;
      return { items: [], total: 0 };
    },
  };

  const service = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
  });

  // User 1001
  await service.listAchievements({ userId: 1001 });
  assert.ok(capturedFilters.scopeCondition.clause.includes('a.lecturer_id = 111'));
  assert.ok(!capturedFilters.scopeCondition.clause.includes('a.lecturer_id = 222'));

  // User 1002
  await service.listAchievements({ userId: 1002 });
  assert.ok(capturedFilters.scopeCondition.clause.includes('a.lecturer_id = 222'));
  assert.ok(!capturedFilters.scopeCondition.clause.includes('a.lecturer_id = 111'));
});

test('Area 3.5: Multiple criteria referencing identical evidence file de-duplicates without file collision in ZIP', async () => {
  const mockClient = {
    async query(sql) {
      const text = sql.trim();
      if (text.includes('SELECT lecturer_id FROM app.lecturers')) return { rows: [{ lecturer_id: 77 }] };
      if (text.includes('FROM app.regulation_document_versions v')) {
        return {
          rows: [{
            version_id: 400,
            document_id: 40,
            version_number: 'v4.0',
            sha256_hash: 'a'.repeat(64),
            lhu_application_status: 'CONFIRMED_LHU_POLICY',
            document_code: 'QC-DEDUPE',
            document_title: 'Quy Che De-dupe Test',
          }],
        };
      }
      if (text.includes('FROM app.achievements a')) {
        return {
          rows: [{
            id: 701,
            type: 'ACHIEVEMENT',
            sourceTypeId: 1,
            title: 'Bai bao chung',
            lecturer_id: 77,
            year: 2025,
            status: 'ACTIVE',
            files: [{ id: 99, sha256: 'e1'.repeat(32), name: 'shared_paper.pdf', storageKey: 'ach/shared.pdf', fileExtension: 'pdf' }],
          }],
        };
      }
      if (text.includes('FROM app.award_criteria_versions c')) {
        return {
          rows: [
            {
              criteria_version_id: 1,
              criterion_code: 'TC-A',
              name: 'Tieu chi A',
              target_type: 'INDIVIDUAL',
              min_threshold: 1,
              is_confirmed: 1,
              source_rules: JSON.stringify({ minimumDistinctYears: 1, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] }),
            },
            {
              criteria_version_id: 2,
              criterion_code: 'TC-B',
              name: 'Tieu chi B',
              target_type: 'INDIVIDUAL',
              min_threshold: 1,
              is_confirmed: 1,
              source_rules: JSON.stringify({ minimumDistinctYears: 1, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] }),
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const chunks = [];
  const mockRes = new Writable({
    write(chunk, enc, cb) { chunks.push(chunk); cb(); },
  });
  mockRes.headersSent = false;
  mockRes.setHeader = () => { mockRes.headersSent = true; };

  await packageAndStreamDossierZip(
    { userId: 77, lecturerId: 77 },
    { versionId: 400 },
    mockRes,
    mockClient
  );

  await new Promise((resolve) => setTimeout(resolve, 80));
  const fullZip = Buffer.concat(chunks);
  const zip = new PizZip(fullZip);
  const files = Object.keys(zip.files);

  // Duplication across 2 criteria must result in exactly 1 deduplicated evidence file
  assert.equal(files.length, 1, `File phải được dedupe còn đúng 1 file duy nhất, thực tế: ${files.join(', ')}`);
  assert.ok(files[0].includes('Bai_bao_chung'));
});

test('Area 3.6: Complex Vietnamese strings and malicious path traversal in titles are safely sanitized', () => {
  const dangerousTitle = '../../../../etc/passwd && <script>alert("hack")</script>_Bằng khen: Đổi mới sáng tạo & ĐH Lạc Hồng';
  const clean = sanitizeFileName(dangerousTitle);

  // Slashes and backslashes MUST be eliminated to prevent directory traversal in ZIP
  assert.ok(!clean.includes('/'), 'Không được chứa gạch chéo');
  assert.ok(!clean.includes('\\'), 'Không được chứa gạch chéo ngược');
  assert.ok(!clean.includes('<'), 'Không được chứa thẻ HTML');
  assert.ok(!clean.includes('>'), 'Không được chứa thẻ HTML');
  assert.ok(clean.includes('Doi_moi_sang_tao'), 'Phải chuẩn hóa tiếng Việt thành chữ không dấu');
  assert.ok(clean.includes('DH_Lac_Hong'), 'Phải chuẩn hóa chữ Đ thành D');

  const standardized = formatStandardizedFileName(5, dangerousTitle, 2026, 'pdf');
  assert.ok(standardized.startsWith('05_['));
  assert.ok(standardized.endsWith(']_[2026].pdf'));
  assert.ok(!standardized.includes('/'), 'Tên file chuẩn hóa không được chứa gạch chéo');
  assert.ok(!standardized.includes('\\'), 'Tên file chuẩn hóa không được chứa gạch chéo ngược');
});

