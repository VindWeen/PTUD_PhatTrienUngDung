import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import PizZip from 'pizzip';
import { slugSchema, updateCvProfileSchema, RESERVED_SLUGS, VALID_TEMPLATES } from '../src/modules/cv/cvSchemas.js';
import cvService, { createCvService } from '../src/modules/cv/cvService.js';
import cvRepository from '../src/modules/cv/cvRepository.js';
import cvRoutes from '../src/modules/cv/cvRoutes.js';
import errorHandler from '../src/middlewares/errorHandler.js';
import { closeDB } from '../src/config/database.js';

test.after(async () => {
  await closeDB().catch(() => {});
});

// =========================================================================
// SUITE 1: SLUG VALIDATION & RESERVED SLUGS ADVERSARIAL STRESS TESTING
// =========================================================================
test('Slug Validation: All reserved keywords must be rejected with 400', () => {
  const reservedList = ['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root'];
  for (const reserved of reservedList) {
    const result = slugSchema.safeParse(reserved);
    assert.equal(result.success, false, `Reserved slug '${reserved}' should have failed validation`);
  }
});

test('Slug Validation: Length boundaries (< 3 and > 100) must be rejected with 400', () => {
  // Length < 3
  assert.equal(slugSchema.safeParse('a').success, false, 'Length 1 should fail');
  assert.equal(slugSchema.safeParse('ab').success, false, 'Length 2 should fail');
  assert.equal(slugSchema.safeParse('').success, false, 'Empty string should fail');

  // Exact boundary 3 (valid)
  assert.equal(slugSchema.safeParse('abc').success, true, 'Length 3 should pass');

  // Exact boundary 100 (valid)
  const exact100 = 'a' + '-b'.repeat(49) + 'c'; // 1 + 98 + 1 = 100
  assert.equal(exact100.length, 100);
  assert.equal(slugSchema.safeParse(exact100).success, true, 'Length 100 should pass');

  // Length 101 (> 100)
  const len101 = 'a' + '-b'.repeat(50); // 1 + 100 = 101
  assert.equal(len101.length, 101);
  assert.equal(slugSchema.safeParse(len101).success, false, 'Length 101 should fail');
});

test('Slug Validation: Invalid characters, uppercase, and formatting must be rejected with 400', () => {
  const invalidSlugs = [
    'my slug',              // spaces
    'my  slug',             // double space
    'Nguyen-Van-An',        // uppercase
    'nguyen_van_an',        // underscores
    'nguyen.an',            // dots
    'nguyen@an',            // @ symbol
    'nguyen!an',            // ! symbol
    'nguyen#an',            // # symbol
    'nguyen--an',           // consecutive hyphens
    '-my-slug',             // leading hyphen
    'my-slug-',             // trailing hyphen
    'nguyễn-văn-an',        // unicode Vietnamese accents
  ];

  for (const slug of invalidSlugs) {
    const result = slugSchema.safeParse(slug);
    assert.equal(result.success, false, `Invalid slug '${slug}' must be rejected`);
  }
});

test('Slug Validation: Duplicate slug collision across different users throws ConflictError (409)', async () => {
  const mockRepo = {
    findProfileBySlug: async (slug) => {
      if (slug === 'prof-john-doe') {
        return { profile_id: 'p-1', user_id: 100, slug: 'prof-john-doe' };
      }
      return null;
    },
    upsertProfile: async () => {},
  };

  const service = createCvService(mockRepo);

  // User 200 tries to claim User 100's slug
  await assert.rejects(
    async () => {
      await service.updateCv(200, { slug: 'prof-john-doe' });
    },
    (err) => {
      assert.equal(err.name, 'ConflictError');
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /đã có người sử dụng/);
      return true;
    }
  );

  // User 100 updates their own profile with their own slug (must succeed)
  let upsertCalled = false;
  mockRepo.upsertProfile = async (userId, data) => {
    upsertCalled = true;
    return { profile_id: 'p-1', user_id: userId, ...data };
  };
  await service.updateCv(100, { slug: 'prof-john-doe', templateId: 'Modern' });
  assert.equal(upsertCalled, true, 'Same user update should not trigger 409');
});

test('Template ID Validation: Standard templates allowed, arbitrary strings rejected with 400', () => {
  const validTemplates = ['Modern', 'Academic', 'Minimalist', 'Creative', 'modern', 'academic', 'standard', 'classic'];
  for (const t of validTemplates) {
    const res = updateCvProfileSchema.safeParse({ templateId: t });
    assert.equal(res.success, true, `Valid template '${t}' should be accepted`);
  }

  const invalidTemplates = [
    'HackerTemplate',
    'CustomEvil',
    '<script>alert(1)</script>',
    'SELECT * FROM users',
    'ArbitraryString',
    '',
  ];
  for (const t of invalidTemplates) {
    const res = updateCvProfileSchema.safeParse({ templateId: t });
    assert.equal(res.success, false, `Invalid template '${t}' should be rejected`);
  }
});

// =========================================================================
// SUITE 2: PRIVACY SCREEN & STRICT ZERO DATA LEAKAGE (is_public = false)
// =========================================================================
test('Privacy Screen: Private profile strictly hides contact and achievements without leaking in payload', async () => {
  const secretPhone = '0909998877';
  const secretEmail = 'classified@lhu.edu.vn';
  const secretBio = 'Top secret personal background';
  const secretAchievementTitle = 'Dự án nghiên cứu tuyệt mật';

  const mockRepo = {
    findProfileBySlugOrId: async (slug) => {
      if (slug === 'secret-agent') {
        return {
          profile_id: 'uuid-secret',
          user_id: 99,
          slug: 'secret-agent',
          is_public: 0, // private
          headline: 'Giảng viên',
          bio: secretBio,
        };
      }
      return null;
    },
    getUserContact: async () => ({
      full_name: 'Người Bí Mật',
      email: secretEmail,
      phone: secretPhone,
    }),
    getUserActiveAchievements: async () => [
      { achievement_id: 999, title: secretAchievementTitle },
    ],
  };

  const service = createCvService(mockRepo);
  const result = await service.getPublicCv('secret-agent');

  assert.equal(result.isPublic, false);
  assert.equal(result.message, 'Hồ sơ đang ở chế độ riêng tư');

  // Assert absolute zero data leakage
  assert.equal(result.contact, undefined, 'contact must not be exposed');
  assert.equal(result.achievements, undefined, 'achievements must not be exposed');
  assert.equal(result.bio, undefined, 'bio must not be exposed');
  assert.equal(result.headline, undefined, 'headline must not be exposed');

  const jsonDump = JSON.stringify(result);
  assert.equal(jsonDump.includes(secretPhone), false, 'secretPhone leaked into response');
  assert.equal(jsonDump.includes(secretEmail), false, 'secretEmail leaked into response');
  assert.equal(jsonDump.includes(secretBio), false, 'secretBio leaked into response');
  assert.equal(jsonDump.includes(secretAchievementTitle), false, 'secretAchievement leaked into response');
});

test('Public CV: Non-existent slug and non-existent UUID fallback throw NotFoundError (404)', async () => {
  const mockRepo = {
    findProfileBySlugOrId: async () => null,
  };
  const service = createCvService(mockRepo);

  // Missing slug
  await assert.rejects(
    async () => {
      await service.getPublicCv('this-slug-does-not-exist');
    },
    { name: 'NotFoundError', statusCode: 404 }
  );

  // Missing UUID fallback
  await assert.rejects(
    async () => {
      await service.getPublicCv('00000000-0000-0000-0000-000000000000');
    },
    { name: 'NotFoundError', statusCode: 404 }
  );
});

test('Public CV: Valid public profile exposes full data and active achievements with template ID', async () => {
  const mockRepo = {
    findProfileBySlugOrId: async (slug) => ({
      profile_id: 'uuid-pub-1',
      user_id: 10,
      slug: 'gs-nguyen-van-a',
      is_public: 1,
      template_id: 'Academic',
      headline: 'Giáo sư Tiến sĩ Khoa học Máy tính',
      bio: 'Chuyên gia Trí tuệ nhân tạo & Khoa học dữ liệu',
    }),
    getUserContact: async () => ({
      full_name: 'Nguyễn Văn A',
      email: 'a.nv@lhu.edu.vn',
      phone: '0901234567',
      title: 'Giáo sư',
      degree: 'Tiến sĩ',
      unit_name: 'Khoa Công nghệ thông tin',
    }),
    getUserActiveAchievements: async () => [
      {
        achievement_id: 1,
        title: 'Công trình khoa học Quốc tế IEEE',
        recognition_year: 2025,
        achievement_date: '2025-06-15',
        type: 'Bài báo Quốc tế',
      },
    ],
  };

  const service = createCvService(mockRepo);
  const result = await service.getPublicCv('gs-nguyen-van-a');

  assert.equal(result.isPublic, true);
  assert.equal(result.templateId, 'Academic');
  assert.equal(result.headline, 'Giáo sư Tiến sĩ Khoa học Máy tính');
  assert.equal(result.contact.fullName, 'Nguyễn Văn A');
  assert.equal(result.contact.unitName, 'Khoa Công nghệ thông tin');
  assert.equal(result.achievements.length, 1);
  assert.equal(result.achievements[0].title, 'Công trình khoa học Quốc tế IEEE');
});

// =========================================================================
// SUITE 3: HTTP ROUTE LEVEL VERIFICATION & SECURITY HEADERS
// =========================================================================
test('HTTP Public CV: Unauthenticated access permitted, X-Robots-Tag: noindex, nofollow enforced', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', cvRoutes);
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // 1. Non-existent slug via /api/v1/public/cv/:slug without Auth header
    const res1 = await fetch(`${baseUrl}/public/cv/non-existent-challenger-slug-9999`);
    assert.equal(res1.status, 404, 'Must return 404 without authentication');
    const robots1 = res1.headers.get('x-robots-tag');
    assert.ok(robots1 && robots1.includes('noindex'), 'x-robots-tag must contain noindex on 404');
    assert.ok(robots1 && robots1.includes('nofollow'), 'x-robots-tag must contain nofollow on 404');
    const body1 = await res1.json();
    assert.equal(body1.success, false);

    // 2. Non-existent slug via /api/v1/cv/:slug
    const res2 = await fetch(`${baseUrl}/cv/non-existent-challenger-slug-9999`);
    assert.equal(res2.status, 404);
    const robots2 = res2.headers.get('x-robots-tag');
    assert.ok(robots2 && robots2.includes('noindex'));

    // 3. Non-existent UUID fallback
    const res3 = await fetch(`${baseUrl}/public/cv/00000000-0000-0000-0000-000000000000`);
    assert.equal(res3.status, 404);
    assert.ok(res3.headers.get('x-robots-tag').includes('noindex'));

    // 4. PUT /api/v1/me/cv without auth -> must be rejected with 401 Unauthorized
    const res4 = await fetch(`${baseUrl}/me/cv`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'valid-slug' }),
    });
    assert.equal(res4.status, 401, 'Unauthenticated PUT must return 401');

  } finally {
    if (server.closeAllConnections) {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

// =========================================================================
// SUITE 4: DOCX BINARY EXPORT, UNICODE & ZERO-ACHIEVEMENT EDGE CASE
// =========================================================================
test('DOCX Export: Valid OpenXML binary stream, PK zip signature 0x04034b50', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'p-docx-1',
      headline: 'Chuyên gia Mạng máy tính & An toàn thông tin',
      bio: 'Khoa Công nghệ thông tin LHU',
    }),
    getUserContact: async () => ({
      full_name: 'ThS. Lê Hoàng Cường',
      email: 'cuong.lh@lhu.edu.vn',
      phone: '0903334455',
      title: 'Giảng viên',
      degree: 'Thạc sĩ',
      unit_name: 'Khoa Công nghệ thông tin',
    }),
    getUserActiveAchievements: async () => [
      {
        achievement_id: 1,
        title: 'Chứng chỉ Chuyên gia Bảo mật CISSP',
        recognition_year: 2024,
        achievement_type_name: 'Chứng chỉ Quốc tế',
      },
    ],
  };

  const service = createCvService(mockRepo);
  const { buffer, filename } = await service.exportCvDocx(4);

  assert.equal(filename, 'CV_Export.docx');
  assert.ok(Buffer.isBuffer(buffer), 'Export output must be a Node.js Buffer');
  assert.ok(buffer.length > 500, 'Buffer length should exceed 500 bytes');

  // Verify PK zip magic bytes: 0x50 0x4B 0x03 0x04
  assert.equal(buffer[0], 0x50, 'Byte 0 must be 0x50 (P)');
  assert.equal(buffer[1], 0x4b, 'Byte 1 must be 0x4b (K)');
  assert.equal(buffer[2], 0x03, 'Byte 2 must be 0x03');
  assert.equal(buffer[3], 0x04, 'Byte 3 must be 0x04');
  assert.equal(buffer.readUInt32LE(0), 0x04034b50, 'Little-endian UInt32 must match 0x04034b50');
});

test('DOCX Export: Edge case of 0 achievements produces valid document without crashing', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'p-docx-zero',
      headline: 'Tân Cử nhân CNTT',
      bio: 'Chưa có thành tích ghi nhận',
    }),
    getUserContact: async () => ({
      full_name: 'Nguyễn Văn Mới',
      email: 'moi.nv@lhu.edu.vn',
      phone: '0911223344',
      title: 'Trợ giảng',
      degree: 'Cử nhân',
      unit_name: 'Khoa Cơ điện - Điện tử',
    }),
    getUserActiveAchievements: async () => [], // ZERO achievements
  };

  const service = createCvService(mockRepo);
  const { buffer, filename } = await service.exportCvDocx(999);

  assert.equal(filename, 'CV_Export.docx');
  assert.equal(buffer.readUInt32LE(0), 0x04034b50);

  // Unzip and inspect document.xml
  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();
  assert.ok(docXml.includes('Nguyễn Văn Mới'), 'Document XML should contain user name');
  assert.ok(
    docXml.includes('Chưa có thành tích nào được chọn hiển thị') || docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (0)'),
    'Document XML should indicate 0 achievements gracefully'
  );
});

test('DOCX Export: Profile unicode and scientific symbols (Σ, α, β) rendered in document.xml', async () => {
  const vietnameseHeadline = 'PGS.TS. Giảng viên cao cấp - ĐH Lạc Hồng (Việt Nam)';
  const scientificBio = 'Nghiên cứu Toán ứng dụng & AI: Các tham số tối ưu gồm Σ, α, β, λ, π, Δ, ∫, ≈, ≤, ≥, ±, Ω.';

  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'p-docx-unicode',
      headline: vietnameseHeadline,
      bio: scientificBio,
    }),
    getUserContact: async () => ({
      full_name: 'PGS.TS. Nguyễn Văn Đức',
      email: 'duc.pm@lhu.edu.vn',
      phone: '0977889900',
      title: 'Phó Giáo sư',
      degree: 'Tiến sĩ',
      unit_name: 'Khoa Công nghệ thông tin',
    }),
    getUserActiveAchievements: async () => [],
  };

  const service = createCvService(mockRepo);
  const { buffer } = await service.exportCvDocx(3);

  // Unzip OpenXML archive and inspect internal document.xml
  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  // Check Vietnamese diacritics
  assert.ok(docXml.includes('PGS.TS. Nguyễn Văn Đức'), 'Vietnamese full name missing from docx XML');
  assert.ok(docXml.includes('ĐH Lạc Hồng'), 'Vietnamese organization missing from docx XML');

  // Check scientific symbols
  const requiredSymbols = ['Σ', 'α', 'β', 'λ', 'π', 'Δ', '∫', '≈', '≤', '≥', '±', 'Ω'];
  for (const sym of requiredSymbols) {
    assert.ok(docXml.includes(sym), `Scientific symbol '${sym}' missing from docx XML`);
  }
});

// =========================================================================
// SUITE 5: LIVE REPOSITORY DATABASE QUERIES & DOCX TEMPLATE EXPANSION
// =========================================================================
test('Live DB: cvRepository.getUserContact executes successfully with valid columns', async () => {
  const contact = await cvRepository.getUserContact(1);
  assert.ok(contact);
  assert.ok(contact.full_name);
  assert.equal(typeof contact.full_name, 'string');
});

test('Live DB: cvRepository.getUserActiveAchievements executes successfully with valid columns', async () => {
  const achievements = await cvRepository.getUserActiveAchievements(1);
  assert.ok(Array.isArray(achievements));
});

test('DOCX Template: properly expands achievements loop in docxtemplater with no raw tags or undefined', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({ profile_id: 'p-fixed', headline: '', bio: '' }),
    getUserContact: async () => ({ full_name: 'Test Lecturer', title: 'Phó Giáo sư', degree: 'TS' }),
    getUserActiveAchievements: async () => [
      { achievement_id: 1, title: 'Bài báo Quốc tế Scopus Q1', recognition_year: 2026, achievement_type_name: 'Bài báo' },
    ],
  };

  const service = createCvService(mockRepo);
  const { buffer } = await service.exportCvDocx(1);
  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  // 1. Literal {#achievements} tag must NOT remain
  assert.equal(docXml.includes('{#achievements}'), false, 'Opening loop tag must be parsed and removed');
  assert.equal(docXml.includes('{/achievements}'), false, 'Closing loop tag must be parsed and removed');
  // 2. The achievement title 'Bài báo Quốc tế Scopus Q1' MUST be rendered
  assert.ok(docXml.includes('Bài báo Quốc tế Scopus Q1'), 'Achievement title must be rendered');
  // 3. Literal undefined must NOT exist
  assert.equal(docXml.includes('undefined'), false, 'Output must not contain literal undefined');
});
