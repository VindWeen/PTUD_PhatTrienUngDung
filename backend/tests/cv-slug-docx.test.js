import test from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { slugSchema, updateCvProfileSchema } from '../src/modules/cv/cvSchemas.js';
import { createCvService } from '../src/modules/cv/cvService.js';

test('CV Slug Validation: enforces 3-100 chars, regex, and blocks reserved keywords', () => {
  // Too short (< 3)
  assert.equal(slugSchema.safeParse('an').success, false);
  // Too long (> 100)
  assert.equal(slugSchema.safeParse('a'.repeat(101)).success, false);
  // Contains uppercase or invalid symbols
  assert.equal(slugSchema.safeParse('Nguyen-Van-An').success, false);
  assert.equal(slugSchema.safeParse('nguyen_van_an').success, false);
  assert.equal(slugSchema.safeParse('nguyen.an').success, false);
  assert.equal(slugSchema.safeParse('nguyen@an').success, false);
  // Reserved keywords
  for (const reserved of ['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root']) {
    assert.equal(slugSchema.safeParse(reserved).success, false, `Should reject reserved word: ${reserved}`);
  }
  // Valid slugs
  assert.equal(slugSchema.safeParse('nguyen-van-an').success, true);
  assert.equal(slugSchema.safeParse('tran-thi-bich-2026').success, true);
  assert.equal(slugSchema.safeParse('gv-cntt-01').success, true);
});

test('CV Template Validation: accepts standard templates and rejects arbitrary values', () => {
  assert.equal(updateCvProfileSchema.safeParse({ templateId: 'Modern' }).success, true);
  assert.equal(updateCvProfileSchema.safeParse({ templateId: 'Academic' }).success, true);
  assert.equal(updateCvProfileSchema.safeParse({ templateId: 'Minimalist' }).success, true);
  assert.equal(updateCvProfileSchema.safeParse({ templateId: 'Creative' }).success, true);
  assert.equal(updateCvProfileSchema.safeParse({ templateId: 'standard' }).success, true);
  assert.equal(updateCvProfileSchema.safeParse({ templateId: 'InvalidTemplate' }).success, false);
});

test('Public CV Route: returns privacy screen when isPublic is false, preventing data leakage', async () => {
  const mockRepo = {
    findProfileBySlugOrId: async (slug) => {
      if (slug === 'private-prof') {
        return {
          profile_id: 'prof-1',
          user_id: 1,
          slug: 'private-prof',
          is_public: 0, // private
          headline: 'Giảng viên CNTT',
          bio: 'Bí mật cá nhân',
        };
      }
      return null;
    },
    getUserContact: async () => ({ full_name: 'Người Bí Mật', email: 'secret@lhu.edu.vn', phone: '0909999999' }),
    getUserActiveAchievements: async () => [{ achievement_id: 1, title: 'Thành tích bí mật' }],
  };

  const service = createCvService(mockRepo);
  const res = await service.getPublicCv('private-prof');

  assert.equal(res.isPublic, false);
  assert.equal(res.message, 'Hồ sơ đang ở chế độ riêng tư');
  assert.equal(res.achievements, undefined);
  assert.equal(res.contact, undefined);
  assert.equal(res.bio, undefined);
});

test('Public CV Route: exposes full public data and achievements when isPublic is true', async () => {
  const mockRepo = {
    findProfileBySlugOrId: async (slug) => {
      if (slug === 'nguyen-van-an') {
        return {
          profile_id: 'prof-2',
          user_id: 10,
          slug: 'nguyen-van-an',
          is_public: 1,
          template_id: 'Modern',
          headline: 'PGS.TS. Giảng viên cao cấp CNTT',
          bio: 'Chuyên gia Trí tuệ nhân tạo & Xử lý ảnh y tế',
          selected_achievement_ids: '[101, 102]',
        };
      }
      return null;
    },
    getUserContact: async (userId) => ({
      full_name: 'Nguyễn Văn An',
      email: 'an.nv@lhu.edu.vn',
      phone: '0901234567',
      title: 'Phó Giáo sư',
      degree: 'Tiến sĩ',
      unit_name: 'Khoa Công nghệ thông tin',
    }),
    getUserActiveAchievements: async (userId, selectedIds) => [
      {
        achievement_id: 101,
        title: 'Công trình khoa học ISI Q1',
        recognition_year: 2025,
        type: 'Bài báo khoa học',
      },
      {
        achievement_id: 102,
        title: 'Bằng khen Thủ tướng Chính phủ',
        recognition_year: 2024,
        type: 'Khen thưởng cấp Nhà nước',
      },
    ],
  };

  const service = createCvService(mockRepo);
  const res = await service.getPublicCv('nguyen-van-an');

  assert.equal(res.isPublic, true);
  assert.equal(res.slug, 'nguyen-van-an');
  assert.equal(res.templateId, 'Modern');
  assert.equal(res.headline, 'PGS.TS. Giảng viên cao cấp CNTT');
  assert.equal(res.contact.fullName, 'Nguyễn Văn An');
  assert.equal(res.contact.email, 'an.nv@lhu.edu.vn');
  assert.equal(res.achievements.length, 2);
  assert.equal(res.achievements[0].title, 'Công trình khoa học ISI Q1');
});

test('Public CV Route: throws NotFoundError when profile slug or UUID does not exist', async () => {
  const mockRepo = {
    findProfileBySlugOrId: async () => null,
  };
  const service = createCvService(mockRepo);

  await assert.rejects(
    async () => {
      await service.getPublicCv('non-existent-slug');
    },
    { name: 'NotFoundError', message: 'CV không tồn tại hoặc đã ngừng chia sẻ' }
  );
});

test('CV Profile Update: detects and rejects duplicate slug across different users', async () => {
  const mockRepo = {
    findProfileBySlug: async (slug) => {
      if (slug === 'taken-slug') {
        return { profile_id: 'p-99', user_id: 99, slug: 'taken-slug' };
      }
      return null;
    },
    upsertProfile: async () => {},
  };
  const service = createCvService(mockRepo);

  await assert.rejects(
    async () => {
      // User 1 attempts to take user 99's slug
      await service.updateCv(1, { slug: 'taken-slug' });
    },
    { name: 'ConflictError', message: 'Slug này đã có người sử dụng. Vui lòng chọn slug khác.' }
  );
});

test('DOCX Binary Export: compiles valid Word package with PK signature, Unicode and scientific symbols', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'prof-export',
      headline: 'Chuyên gia AI & Deep Learning (Σ, α, β)',
      bio: 'Nghiên cứu ứng dụng công nghệ trí tuệ nhân tạo trong y tế thông minh (Đại học Lạc Hồng).',
      selected_achievement_ids: '[201]',
    }),
    getUserContact: async () => ({
      full_name: 'PGS.TS. Trần Thị Bích',
      email: 'bich.tt@lhu.edu.vn',
      phone: '0912345678',
      title: 'Phó Giáo sư',
      degree: 'Tiến sĩ',
      unit_name: 'Khoa Công nghệ thông tin',
    }),
    getUserActiveAchievements: async () => [
      {
        achievement_id: 201,
        title: 'Bằng sáng chế Giải pháp hữu ích về AI Y tế',
        recognition_year: 2025,
        achievement_type_name: 'Sáng chế & Giải pháp',
      },
    ],
  };

  const service = createCvService(mockRepo);
  const { buffer, filename } = await service.exportCvDocx(1);

  assert.equal(filename, 'CV_Export.docx');
  assert.ok(Buffer.isBuffer(buffer), 'Export must return a Node Buffer');
  assert.ok(buffer.length > 500, 'DOCX buffer length must be greater than 500 bytes');

  // Verify PK zip signature (0x04034b50)
  assert.equal(buffer[0], 0x50, 'Byte 0 must be 0x50 (P)');
  assert.equal(buffer[1], 0x4b, 'Byte 1 must be 0x4b (K)');
  assert.equal(buffer[2], 0x03, 'Byte 2 must be 0x03');
  assert.equal(buffer[3], 0x04, 'Byte 3 must be 0x04');
  assert.equal(buffer.readUInt32LE(0), 0x04034b50, 'Magic bytes UInt32LE must match 0x04034b50');

  // Deep inspection of word/document.xml content
  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  // 1. Verify profile fields rendered
  assert.ok(docXml.includes('PGS.TS. Trần Thị Bích'), 'Full name must be rendered');
  assert.ok(docXml.includes('Phó Giáo sư'), 'Title must be rendered');
  assert.ok(docXml.includes('Tiến sĩ'), 'Degree must be rendered');
  assert.ok(docXml.includes('Khoa Công nghệ thông tin'), 'Unit name must be rendered');
  assert.ok(docXml.includes('bich.tt@lhu.edu.vn'), 'Email must be rendered');
  assert.ok(docXml.includes('0912345678'), 'Phone must be rendered');

  // 2. Verify scientific symbols rendered
  for (const sym of ['Σ', 'α', 'β']) {
    assert.ok(docXml.includes(sym), `Scientific symbol ${sym} must be present`);
  }

  // 3. Verify achievements expanded genuinely
  assert.ok(docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (1)'), 'Count must be 1');
  assert.ok(docXml.includes('Bằng sáng chế Giải pháp hữu ích về AI Y tế'), 'Achievement title must be rendered');
  assert.ok(docXml.includes('2025'), 'Recognition year must be rendered');
  assert.ok(docXml.includes('- 1.'), 'Index 1 must be rendered');

  // 4. Verify absence of unrendered tags or undefined values
  assert.equal(docXml.includes('{#achievements}'), false, 'Raw opening loop tag must not exist');
  assert.equal(docXml.includes('{/achievements}'), false, 'Raw closing loop tag must not exist');
  assert.equal(docXml.includes('{^achievements}'), false, 'Raw inverted loop tag must not exist');
  assert.equal(docXml.includes('undefined'), false, 'Output must not contain literal "undefined"');
  assert.equal(docXml.includes('Chưa có thành tích nào được chọn hiển thị.'), false, 'Empty notice must not show when achievements exist');
});

test('DOCX Binary Export: handles 0 achievements gracefully without throwing', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'prof-empty',
      headline: 'Tân giảng viên',
      bio: 'Mới gia nhập bộ môn',
      selected_achievement_ids: '[]',
    }),
    getUserContact: async () => ({
      full_name: 'ThS. Nguyễn Văn Mới',
      email: 'moi.nv@lhu.edu.vn',
      phone: '0988776655',
      title: 'Giảng viên',
      degree: 'Thạc sĩ',
      unit_name: 'Khoa Dược',
    }),
    getUserActiveAchievements: async () => [],
  };

  const service = createCvService(mockRepo);
  const { buffer, filename } = await service.exportCvDocx(2);

  assert.equal(filename, 'CV_Export.docx');
  assert.equal(buffer.readUInt32LE(0), 0x04034b50);

  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  assert.ok(docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (0)'), 'Count must be 0');
  assert.ok(docXml.includes('Chưa có thành tích nào được chọn hiển thị.'), 'Empty notice must be rendered');
  assert.equal(docXml.includes('{#achievements}'), false);
  assert.equal(docXml.includes('{/achievements}'), false);
  assert.equal(docXml.includes('{^achievements}'), false);
  assert.equal(docXml.includes('undefined'), false);
});

test('DOCX Binary Export: renders multiple achievements (N > 1) with independent numbering and correct paragraph structure', async () => {
  const mockRepo = {
    findProfileByUserId: async () => ({
      profile_id: 'prof-multi',
      headline: 'Trưởng nhóm Nghiên cứu',
      bio: 'Lĩnh vực AI',
      selected_achievement_ids: null, // all
    }),
    getUserContact: async () => ({
      full_name: 'GS.TS. Lê Văn Tám',
      email: 'tam.lv@lhu.edu.vn',
      phone: '0909112233',
      title: 'Giáo sư',
      degree: 'Tiến sĩ',
      unit_name: 'Khoa Công nghệ thông tin',
    }),
    getUserActiveAchievements: async () => [
      { achievement_id: 1, title: 'Bài báo IEEE Q1', recognition_year: 2024, achievement_type_name: 'Bài báo' },
      { achievement_id: 2, title: 'Bằng sáng chế USPTO', recognition_year: 2025, achievement_type_name: 'Sáng chế' },
      { achievement_id: 3, title: 'Giải thưởng Sáng tạo Quốc gia', recognition_year: 2026, achievement_type_name: 'Giải thưởng' },
    ],
  };

  const service = createCvService(mockRepo);
  const { buffer } = await service.exportCvDocx(5);

  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  assert.ok(docXml.includes('DANH SÁCH THÀNH TÍCH TIÊU BIỂU (3)'));
  assert.ok(docXml.includes('- 1. Bài báo IEEE Q1 (2024) - Bài báo'));
  assert.ok(docXml.includes('- 2. Bằng sáng chế USPTO (2025) - Sáng chế'));
  assert.ok(docXml.includes('- 3. Giải thưởng Sáng tạo Quốc gia (2026) - Giải thưởng'));
  assert.equal(docXml.includes('undefined'), false);
  assert.equal(docXml.includes('{#achievements}'), false);
  assert.equal(docXml.includes('{/achievements}'), false);
});
