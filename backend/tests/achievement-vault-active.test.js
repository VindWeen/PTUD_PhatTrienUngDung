import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPermissionResolver } from '../src/modules/achievements/achievementPermissions.js';
import { extractCertificateInfo } from '../src/modules/achievements/achievementAiIngestService.js';
import { createAchievementService } from '../src/modules/achievements/achievementService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Achievement Vault: Trạng thái ACTIVE cho phép chính chủ sửa, xóa và quản lý minh chứng', async () => {
  const user = { userId: 1001, username: 'an.nv' };
  const roles = ['MEMBER', 'LECTURER'];

  const resolver = createPermissionResolver(user, roles, {
    representative: async () => false,
    scope: async () => false,
  });

  const activeAchievement = {
    achievementId: 10,
    subjectType: 'LECTURER',
    lecturer: { userId: 1001 },
    lecturerUserId: 1001,
    status: 'ACTIVE',
    createdBy: 1001,
    submissions: [],
  };

  const decorated = await resolver(activeAchievement);

  assert.equal(decorated.actions.isSelf, true);
  assert.equal(decorated.actions.edit, true, 'Chính chủ phải có quyền chỉnh sửa thành tích ACTIVE trong kho cá nhân');
  assert.equal(decorated.actions.manageEvidence, true, 'Chính chủ phải có quyền tải lên/quản lý minh chứng khi ACTIVE');
  assert.equal(decorated.actions.remove, true, 'Chính chủ phải có quyền xóa thành tích ACTIVE chưa nộp xét duyệt');
  assert.equal(decorated.actions.review, false, 'Không còn quyền review của lãnh đạo trên thành tích cá nhân ACTIVE');
});

test('Achievement Vault: Người dùng khác không có quyền ADMIN không được sửa/xóa thành tích ACTIVE', async () => {
  const otherUser = { userId: 9999, username: 'other' };
  const roles = ['MEMBER'];

  const resolver = createPermissionResolver(otherUser, roles, {
    representative: async () => false,
    scope: async () => false,
  });

  const activeAchievement = {
    achievementId: 10,
    subjectType: 'LECTURER',
    lecturer: { userId: 1001 },
    lecturerUserId: 1001,
    status: 'ACTIVE',
    createdBy: 1001,
    submissions: [],
  };

  const decorated = await resolver(activeAchievement);

  assert.equal(decorated.actions.isSelf, false);
  assert.equal(decorated.actions.edit, false, 'Người ngoài không được quyền sửa thành tích');
  assert.equal(decorated.actions.remove, false, 'Người ngoài không được quyền xóa thành tích');
});

test('Achievement Vault: Quyền ADMIN được phép chỉnh sửa và dọn dẹp thành tích ACTIVE', async () => {
  const adminUser = { userId: 1, username: 'admin' };
  const roles = ['ADMIN'];

  const resolver = createPermissionResolver(adminUser, roles, {
    representative: async () => false,
    scope: async () => false,
  });

  const activeAchievement = {
    achievementId: 10,
    subjectType: 'LECTURER',
    lecturer: { userId: 1001 },
    status: 'ACTIVE',
    createdBy: 1001,
    submissions: [],
  };

  const decorated = await resolver(activeAchievement);

  assert.equal(decorated.actions.edit, true, 'ADMIN có quyền sửa thành tích');
  assert.equal(decorated.actions.remove, true, 'ADMIN có quyền xóa thành tích');
});

test('Achievement Repository: SQL Query tạo mới gán trạng thái ACTIVE ngay lập tức', () => {
  const repoPath = path.resolve(__dirname, '../src/modules/achievements/achievementRepository.js');
  const code = fs.readFileSync(repoPath, 'utf8');

  assert.match(
    code,
    /\$10,\s*\$11,\s*'ACTIVE',\s*\$12,\s*1/,
    'Hàm createAchievement phải trực tiếp gán status là ACTIVE'
  );
  assert.doesNotMatch(
    code,
    /\$10,\s*\$11,\s*'DRAFT',\s*\$12,\s*1/,
    'Không được còn gán cứng DRAFT khi tạo thành tích mới'
  );
});

test('AI Vision Ingest: Fallback nhẹ nhàng khi buffer rỗng hoặc không có API key', async () => {
  // 1. Buffer rỗng
  const emptyRes = await extractCertificateInfo({ buffer: null });
  assert.equal(emptyRes.success, true);
  assert.equal(emptyRes.fallback, true);
  assert.equal(emptyRes.data, null);
  assert.ok(emptyRes.message.length > 0);

  // 2. Buffer 0 byte
  const zeroRes = await extractCertificateInfo({ buffer: Buffer.from('') });
  assert.equal(zeroRes.success, true);
  assert.equal(zeroRes.fallback, true);
  assert.equal(zeroRes.data, null);

  // 3. File buffer giả lập không có API key
  const dummyBuffer = Buffer.from('FAKE_IMAGE_DATA_BYTES');
  const result = await extractCertificateInfo({
    buffer: dummyBuffer,
    mimetype: 'image/png',
    originalname: 'bang_khen.png',
  });

  assert.equal(result.success, true, 'Dù không có API Key hệ thống vẫn phải trả về success: true');
  assert.equal(result.fallback, true, 'Phải kích hoạt fallback: true để giao diện chuyển sang nhập tay');
  assert.ok(result.message.includes('nhập thông tin'), 'Thông điệp phải hướng dẫn người dùng tự nhập');
});

test('Achievement Routes: Các tuyến phê duyệt cũ bị bãi bỏ (HTTP 410 Decommissioned)', async () => {
  const routesPath = path.resolve(__dirname, '../src/modules/achievements/achievementRoutes.js');
  const code = fs.readFileSync(routesPath, 'utf8');

  assert.match(code, /'\/achievements\/ai-extract'/, 'Phải có endpoint /achievements/ai-extract');
  assert.ok(code.includes('decommissioned('), 'Phải có logic bãi bỏ các tuyến phê duyệt');
  assert.ok(code.includes("decommissioned('submit')"), 'Tuyến submit phải bị decommissioned');
  assert.ok(code.includes("decommissioned('verify')"), 'Tuyến verify phải bị decommissioned');
  assert.ok(code.includes("decommissioned('reject')"), 'Tuyến reject phải bị decommissioned');
});

test('Achievement Repository: SQL deleteAchievement & restoreAchievement cho phép xóa và khôi phục bản ghi ACTIVE', () => {
  const repoPath = path.resolve(__dirname, '../src/modules/achievements/achievementRepository.js');
  const repoCode = fs.readFileSync(repoPath, 'utf8');

  // Kiểm tra deleteAchievement: status IN ('ACTIVE', 'DRAFT')
  assert.match(
    repoCode,
    /deleteAchievement[\s\S]*?status\s+IN\s*\(\s*'ACTIVE'\s*,\s*'DRAFT'\s*\)/,
    'Hàm deleteAchievement phải cho phép xóa thành tích ACTIVE hoặc DRAFT'
  );
  assert.doesNotMatch(
    repoCode,
    /deleteAchievement[\s\S]*?status\s*=\s*'DRAFT'/,
    'Hàm deleteAchievement không được giới hạn chỉ xóa DRAFT'
  );

  // Kiểm tra restoreAchievement: status IN ('ACTIVE', 'DRAFT')
  assert.match(
    repoCode,
    /restoreAchievement[\s\S]*?status\s+IN\s*\(\s*'ACTIVE'\s*,\s*'DRAFT'\s*\)/,
    'Hàm restoreAchievement phải cho phép khôi phục thành tích ACTIVE hoặc DRAFT'
  );
  assert.doesNotMatch(
    repoCode,
    /restoreAchievement[\s\S]*?status\s*=\s*'DRAFT'/,
    'Hàm restoreAchievement không được giới hạn chỉ khôi phục DRAFT'
  );

  // Kiểm tra achievementTrashCleanup: status IN ('ACTIVE', 'DRAFT')
  const cleanupPath = path.resolve(__dirname, '../src/modules/achievements/achievementTrashCleanup.js');
  const cleanupCode = fs.readFileSync(cleanupPath, 'utf8');
  assert.match(
    cleanupCode,
    /a\.status\s+IN\s*\(\s*'ACTIVE'\s*,\s*'DRAFT'\s*\)/,
    'Quy trình dọn dẹp thùng rác phải dọn dẹp cả thành tích ACTIVE và DRAFT quá hạn'
  );
});

test('Achievement Service: Hỗ trợ vai trò chuẩn MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD trong listCatalogs và listAchievements', async () => {
  let capturedFilters = null;
  const mockRepo = {
    findLecturerByUserId: async (uid) => ({ lecturerId: 888, userId: uid }),
    listActiveTypes: async () => [{ achievementTypeId: 1, name: 'Sáng kiến cấp Trường' }],
    listAchievements: async (params) => {
      capturedFilters = params.filters;
      return {
        items: [{ achievementId: 99, title: 'Bằng khen cá nhân', status: 'ACTIVE', lecturer: { userId: 200 } }],
        total: 1,
      };
    },
    countAchievements: async () => 1,
  };

  // 1. Kiểm tra từng vai trò chuẩn có thể đọc catalogs
  for (const roleCode of ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD']) {
    const service = createAchievementService(mockRepo, {
      roles: async () => [roleCode],
    });
    const catalogs = await service.listCatalogs({ userId: 200 });
    assert.equal(catalogs.length, 1);
    assert.equal(catalogs[0].name, 'Sáng kiến cấp Trường');
  }

  // 2. Kiểm tra vai trò MEMBER xem danh sách thành tích của chính mình
  const memberService = createAchievementService(mockRepo, {
    roles: async () => ['MEMBER'],
  });
  const listResult = await memberService.listAchievements({ userId: 200 }, { page: 1, pageSize: 10 });
  assert.equal(listResult.items.length, 1);
  assert.equal(listResult.items[0].achievementId, 99);
  assert.ok(
    capturedFilters.scopeCondition.clause.includes('a.lecturer_id = 888'),
    'MEMBER phải nạp điều kiện lecturer_id của bản thân vào scopeCondition'
  );

  // 3. Kiểm tra workflow ACTIONABLE bao gồm cả ACTIVE
  await memberService.listAchievements({ userId: 200 }, { workflow: 'ACTIONABLE' });
  assert.deepEqual(capturedFilters.statuses, ['ACTIVE', 'DRAFT', 'NEED_CORRECTION']);
});

test('Dossier Packager: Đồng bộ hóa nguồn bản ghi app.achievements và app.award_records', () => {
  const packagerPath = path.resolve(__dirname, '../src/modules/ai/dossierPackagerService.js');
  const code = fs.readFileSync(packagerPath, 'utf8');

  // Đảm bảo truy vấn cả 2 bảng
  assert.ok(code.includes('FROM app.achievements a'), 'DossierPackager phải truy vấn app.achievements');
  assert.ok(code.includes('FROM app.award_records r'), 'DossierPackager phải truy vấn app.award_records');
  assert.ok(code.includes('FROM app.award_decision_files adf'), 'DossierPackager phải nạp file quyết định khen thưởng');

  // Đảm bảo xử lý lỗi stream khi headersSent
  assert.ok(
    code.includes('res.end()'),
    'DossierPackager phải gọi res.end() khi xảy ra lỗi sau khi headersSent'
  );
});
