import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import express from 'express';
import { slugSchema, updateCvProfileSchema, RESERVED_SLUGS } from '../src/modules/cv/cvSchemas.js';
import cvService, { createCvService } from '../src/modules/cv/cvService.js';
import cvRoutes from '../src/modules/cv/cvRoutes.js';
import errorHandler from '../src/middlewares/errorHandler.js';
import { closeDB } from '../src/config/database.js';

const require = createRequire(import.meta.url);
const PizZip = require('pizzip');

test.after(async () => {
  await closeDB().catch(() => {});
});

// =========================================================================
// 1. DEEP DOCX VERIFICATION & STRESS TESTING
// =========================================================================
test('Deep DOCX: Output with multiple achievements has 0 raw loop tags, 0 undefined, and genuine achievement paragraphs', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'p-multi',
      headline: 'Chuyên gia Mạng & An ninh mạng',
      bio: null, // null bio
      selected_achievement_ids: null,
    }),
    getUserContact: async () => ({
      full_name: 'TS. Nguyễn Văn Toàn',
      email: 'toan.nv@lhu.edu.vn',
      phone: null, // null phone
      title: 'Giảng viên chính',
      degree: 'Tiến sĩ',
      unit_name: 'Khoa Công nghệ thông tin',
    }),
    getUserActiveAchievements: async () => [
      { achievement_id: 10, title: 'Bài báo IEEE & ACM <Scopus Q1>', recognition_year: 2024, achievement_type_name: 'Bài báo Quốc tế' },
      { achievement_id: 20, title: 'Bằng Sáng chế "Thiết bị IoT"', recognition_year: 2025, achievement_type_name: 'Sáng chế' },
      { achievement_id: 30, title: 'Giải nhất Sáng tạo Kỹ thuật', recognition_year: null, achievement_type_name: null },
    ],
  };

  const service = createCvService(mockRepo);
  const { buffer, filename } = await service.exportCvDocx(1);

  assert.equal(filename, 'CV_Export.docx');
  assert.ok(Buffer.isBuffer(buffer));

  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  // 1. Check for raw unparsed loop tags: {#achievements}, {/achievements}, {^achievements}
  const rawLoopTags = ['{#achievements}', '{/achievements}', '{^achievements}'];
  for (const tag of rawLoopTags) {
    assert.equal(docXml.includes(tag), false, `Document XML must not contain unparsed loop tag: ${tag}`);
  }

  // Regex check for any leftover curly bracket tags: {anyTag}
  const leftoverTags = docXml.match(/\{[#^/]?achievements[a-zA-Z0-9_]*\}/g);
  assert.equal(leftoverTags, null, `Should have no unparsed achievements tags, found: ${leftoverTags}`);

  // 2. Check for literal "undefined" or "null"
  assert.equal(docXml.includes('undefined'), false, 'Document XML must not contain literal undefined');
  assert.equal(docXml.includes('null'), false, 'Document XML must not contain literal null');

  // 3. Genuine presence of achievement paragraphs
  assert.ok(docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (3)'), 'Header count must be 3');
  assert.ok(docXml.includes('- 1.'), 'Index 1 must be present');
  assert.ok(docXml.includes('Bài báo IEEE &amp; ACM &lt;Scopus Q1&gt;') || docXml.includes('Bài báo IEEE'), 'Escaped XML text for achievement 1');
  assert.ok(docXml.includes('- 2.'), 'Index 2 must be present');
  assert.ok(docXml.includes('Bằng Sáng chế'), 'Achievement 2 title present');
  assert.ok(docXml.includes('- 3.'), 'Index 3 must be present');
  assert.ok(docXml.includes('Giải nhất Sáng tạo Kỹ thuật'), 'Achievement 3 title present');
  assert.ok(docXml.includes('(N/A)'), 'Null recognitionYear should fall back to N/A');
  assert.ok(docXml.includes('- Khen thưởng'), 'Null achievement_type_name should fall back to Khen thưởng');

  // 4. Inverted loop fallback message must NOT appear when achievements exist
  assert.equal(docXml.includes('Chưa có thành tích nào được chọn hiển thị.'), false);
});

test('Deep DOCX: Output with 0 achievements renders clean fallback message, 0 raw tags, 0 undefined', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'p-empty',
      headline: null,
      bio: null,
      selected_achievement_ids: '[]',
    }),
    getUserContact: async () => ({
      full_name: 'Trần Thị Thuỷ',
      email: 'thuy.tt@lhu.edu.vn',
      phone: '',
      title: 'Trợ giảng',
      degree: 'Cử nhân',
      unit_name: 'Khoa Ngoại ngữ',
    }),
    getUserActiveAchievements: async () => [],
  };

  const service = createCvService(mockRepo);
  const { buffer } = await service.exportCvDocx(2);

  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  // Zero raw tags
  assert.equal(docXml.includes('{#achievements}'), false);
  assert.equal(docXml.includes('{/achievements}'), false);
  assert.equal(docXml.includes('{^achievements}'), false);

  // Zero undefined / null
  assert.equal(docXml.includes('undefined'), false);
  assert.equal(docXml.includes('null'), false);

  // Count 0 and fallback message
  assert.ok(docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (0)'));
  assert.ok(docXml.includes('Chưa có thành tích nào được chọn hiển thị.'), 'Fallback message must be rendered');
});

test('Deep DOCX: Selected achievements filter respects selected_achievement_ids subset', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'p-subset',
      selected_achievement_ids: [2, 3], // Only pick IDs 2 and 3 out of 1, 2, 3
    }),
    getUserContact: async () => ({ full_name: 'Lê Văn Lọc' }),
    getUserActiveAchievements: async () => [
      { achievement_id: 1, title: 'Thành tích bị bỏ qua', recognition_year: 2020 },
      { achievement_id: 2, title: 'Thành tích được chọn A', recognition_year: 2024 },
      { achievement_id: 3, title: 'Thành tích được chọn B', recognition_year: 2025 },
    ],
  };

  const service = createCvService(mockRepo);
  const { buffer } = await service.exportCvDocx(3);

  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  assert.ok(docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (2)'), 'Count must be 2');
  assert.equal(docXml.includes('Thành tích bị bỏ qua'), false, 'Unselected achievement must not be exported');
  assert.ok(docXml.includes('Thành tích được chọn A'));
  assert.ok(docXml.includes('Thành tích được chọn B'));
  assert.equal(docXml.includes('undefined'), false);
});

// =========================================================================
// 2. CUSTOM SLUGS & RESERVED SLUGS ADVERSARIAL STRESS TESTING
// =========================================================================
test('Custom Slugs: Enforces strict blocking of all reserved keywords', () => {
  const mandatoryReserved = [
    'me', 'export-docx', 'public', 'admin', 'api', 'auth', 'system',
    'login', 'settings', 'help', 'root', 'download', 'cv', 'profile', 'default'
  ];

  for (const slug of mandatoryReserved) {
    const res = slugSchema.safeParse(slug);
    assert.equal(res.success, false, `Reserved slug '${slug}' MUST be rejected`);
  }
});

test('Custom Slugs: Collision handling - blocks stealing another user slug but allows owner retention', async () => {
  const existingProfiles = new Map([
    ['prof-owner', { profile_id: 'uuid-1', user_id: 10, slug: 'prof-owner' }],
  ]);

  const mockRepo = {
    findProfileBySlug: async (slug) => existingProfiles.get(slug) || null,
    findProfileByUserId: async (uid) => {
      for (const p of existingProfiles.values()) {
        if (p.user_id === uid) return p;
      }
      return null;
    },
    upsertProfile: async (userId, data) => ({
      profile_id: 'uuid-upsert',
      user_id: userId,
      slug: data.slug,
      version: 2,
    }),
  };

  const service = createCvService(mockRepo);

  // User 99 tries to claim User 10's slug 'prof-owner' -> ConflictError (409)
  await assert.rejects(
    async () => {
      await service.updateCv(99, { slug: 'prof-owner' });
    },
    (err) => {
      assert.equal(err.name, 'ConflictError');
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /đã có người sử dụng/);
      return true;
    }
  );

  // User 10 updates profile keeping their own slug 'prof-owner' -> MUST succeed
  const ownUpdate = await service.updateCv(10, { slug: 'prof-owner', headline: 'Updated Headline' });
  assert.equal(ownUpdate.slug, 'prof-owner');
});

test('Custom Slugs: UUID fallback when slug is empty or null', async () => {
  const targetUuid = 'e8b23c91-4e78-4389-8d2a-314159265358';
  const mockRepo = {
    findProfileBySlugOrId: async (slugOrId) => {
      if (slugOrId === targetUuid) {
        return {
          profile_id: targetUuid,
          user_id: 77,
          slug: null, // Empty slug
          is_public: 1,
          headline: 'Giảng viên không đặt slug',
          bio: 'Dùng UUID fallback',
        };
      }
      return null;
    },
    getUserContact: async () => ({ full_name: 'Vô Danh Slug', email: 'vodanh@lhu.edu.vn' }),
    getUserActiveAchievements: async () => [],
  };

  const service = createCvService(mockRepo);
  const result = await service.getPublicCv(targetUuid);

  assert.equal(result.isPublic, true);
  assert.equal(result.profileId, targetUuid);
  assert.equal(result.slug, null);
  assert.equal(result.contact.fullName, 'Vô Danh Slug');
});

test('Custom Slugs: Numeric user_id fallback allows accessing CV via user ID', async () => {
  const mockRepo = {
    findProfileBySlugOrId: async (slugOrId) => {
      if (String(slugOrId) === '88') {
        return {
          profile_id: 'uuid-user-88',
          user_id: 88,
          slug: 'lecturer-88',
          is_public: 1,
          headline: 'Hồ sơ tìm theo User ID',
        };
      }
      return null;
    },
    getUserContact: async () => ({ full_name: 'User Tám Mươi Tám', email: 'u88@lhu.edu.vn' }),
    getUserActiveAchievements: async () => [],
  };

  const service = createCvService(mockRepo);
  const result = await service.getPublicCv('88');

  assert.equal(result.isPublic, true);
  assert.equal(result.profileId, 'uuid-user-88');
  assert.equal(result.contact.fullName, 'User Tám Mươi Tám');
});

// =========================================================================
// 3. IS_PUBLIC TOGGLE & ACCESS CONTROL STRESS TESTING
// =========================================================================
test('is_public toggle: Private profile (is_public = 0) returns privacy screen to public, 0 data leaked', async () => {
  const mockRepo = {
    findProfileBySlugOrId: async (slugOrId) => ({
      profile_id: 'uuid-private',
      user_id: 55,
      slug: 'private-user',
      is_public: 0, // PRIVATE
      headline: 'Chuyên gia bảo mật tuyệt mật',
      bio: 'Lý lịch không được phép xem',
      selected_achievement_ids: '[1]',
    }),
    getUserContact: async () => ({
      full_name: 'Điệp Viên 007',
      email: 'classified@lhu.edu.vn',
      phone: '0900000007',
    }),
    getUserActiveAchievements: async () => [
      { achievement_id: 1, title: 'Nhiệm vụ tuyệt mật số 1' },
    ],
  };

  const service = createCvService(mockRepo);
  const publicRes = await service.getPublicCv('private-user');

  // Verify privacy screen
  assert.equal(publicRes.isPublic, false);
  assert.equal(publicRes.message, 'Hồ sơ đang ở chế độ riêng tư');

  // Verify strict lack of data
  assert.equal(publicRes.contact, undefined);
  assert.equal(publicRes.achievements, undefined);
  assert.equal(publicRes.headline, undefined);
  assert.equal(publicRes.bio, undefined);

  const serialized = JSON.stringify(publicRes);
  assert.equal(serialized.includes('Điệp Viên 007'), false);
  assert.equal(serialized.includes('0900000007'), false);
  assert.equal(serialized.includes('Nhiệm vụ tuyệt mật'), false);
});

test('is_public toggle: Owner can view own profile via getOwnCv even when is_public = 0', async () => {
  const mockRepo = {
    findProfileByUserId: async (userId) => ({
      profile_id: 'uuid-private-owner',
      user_id: userId,
      slug: 'private-user',
      is_public: 0, // PRIVATE
      headline: 'Chuyên gia bảo mật tuyệt mật',
      bio: 'Lý lịch của chính tôi',
    }),
    getUserContact: async (userId) => ({
      full_name: 'Điệp Viên 007',
      email: 'classified@lhu.edu.vn',
      phone: '0900000007',
    }),
    getUserActiveAchievements: async (userId) => [
      { achievement_id: 1, title: 'Nhiệm vụ tuyệt mật số 1' },
    ],
  };

  const service = createCvService(mockRepo);
  const ownRes = await service.getOwnCv(55);

  // Owner MUST have full access to their own data even when isPublic is false
  assert.equal(ownRes.isPublic, false);
  assert.equal(ownRes.profileId, 'uuid-private-owner');
  assert.equal(ownRes.headline, 'Chuyên gia bảo mật tuyệt mật');
  assert.equal(ownRes.bio, 'Lý lịch của chính tôi');
  assert.ok(ownRes.contact);
  assert.equal(ownRes.contact.full_name, 'Điệp Viên 007');
  assert.ok(Array.isArray(ownRes.achievements));
  assert.equal(ownRes.achievements.length, 1);
  assert.equal(ownRes.achievements[0].title, 'Nhiệm vụ tuyệt mật số 1');
});

test('is_public toggle: HTTP endpoints verify unauthenticated privacy view vs 401 on private owner endpoint', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', cvRoutes);
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // 1. GET /api/v1/public/cv/invalid-slug -> returns 404
    const res404 = await fetch(`${baseUrl}/public/cv/invalid-slug-xyz-9999`);
    assert.equal(res404.status, 404);
    assert.ok(res404.headers.get('x-robots-tag').includes('noindex'));

    // 2. GET /api/v1/me/cv without auth -> returns 401 Unauthorized
    const resAuthMe = await fetch(`${baseUrl}/me/cv`);
    assert.equal(resAuthMe.status, 401);

    // 3. GET /api/v1/me/cv/profile without auth -> returns 401 Unauthorized
    const resAuthProfile = await fetch(`${baseUrl}/me/cv/profile`);
    assert.equal(resAuthProfile.status, 401);

    // 4. GET /api/v1/me/cv/export-docx without auth -> returns 401 Unauthorized
    const resAuthDocx = await fetch(`${baseUrl}/me/cv/export-docx`);
    assert.equal(resAuthDocx.status, 401);
  } finally {
    if (server.closeAllConnections) {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
});
