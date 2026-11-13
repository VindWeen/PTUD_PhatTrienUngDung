import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import cvRepository from './cvRepository.js';
import { updateCvProfileSchema } from './cvSchemas.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>HỒ SƠ NĂNG LỰC CÁ NHÂN</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>{fullName}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chức danh / Học vị: {title} {degree}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Đơn vị: {unitName}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Email: {email} | Điện thoại: {phone}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tiêu đề: {headline}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tiểu sử: {bio}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>DANH SÁCH THÀNH TÍCH TIÊU BIỂU ({achievementsCount})</w:t></w:r></w:p>
    <w:p><w:r><w:t>{#achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:t>- {index}. {title} ({recognitionYear}) - {type}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{^achievements}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Chưa có thành tích nào được chọn hiển thị.</w:t></w:r></w:p>
    <w:p><w:r><w:t>{/achievements}</w:t></w:r></w:p>
  </w:body>
</w:document>`;

export function createCvService(repo = cvRepository) {
  return {
    async getPublicCv(slugOrId) {
      if (!slugOrId) {
        throw new NotFoundError('CV không tồn tại hoặc đã ngừng chia sẻ');
      }

      const profile = await repo.findProfileBySlugOrId(slugOrId);
      if (!profile) {
        throw new NotFoundError('CV không tồn tại hoặc đã ngừng chia sẻ');
      }

      if (!profile.is_public) {
        return {
          isPublic: false,
          message: 'Hồ sơ đang ở chế độ riêng tư',
        };
      }

      const contact = await repo.getUserContact(profile.user_id);
      let selectedIds = null;
      if (profile.selected_achievement_ids) {
        try {
          selectedIds = typeof profile.selected_achievement_ids === 'string'
            ? JSON.parse(profile.selected_achievement_ids)
            : profile.selected_achievement_ids;
        } catch (_) {
          selectedIds = null;
        }
      }

      const achievements = await repo.getUserActiveAchievements(profile.user_id, selectedIds);

      return {
        isPublic: true,
        profileId: profile.profile_id,
        slug: profile.slug,
        templateId: profile.template_id || 'Modern',
        headline: profile.headline || '',
        bio: profile.bio || '',
        contact: {
          fullName: contact.full_name || '',
          email: contact.email || '',
          phone: contact.phone || '',
          title: contact.title || '',
          degree: contact.degree || '',
          unitName: contact.unit_name || '',
        },
        achievements: achievements.map((a, idx) => ({
          achievementId: a.achievement_id,
          title: a.title,
          recognitionYear: a.recognition_year,
          achievementDate: a.achievement_date,
          decisionNumber: a.decision_number,
          issuingAuthority: a.issuing_authority,
          type: a.achievement_type_name || a.type || 'Thành tích',
        })),
      };
    },

    async getOwnCv(userId) {
      const [profile, contact, achievements] = await Promise.all([
        repo.findProfileByUserId(userId),
        repo.getUserContact(userId),
        repo.getUserActiveAchievements(userId),
      ]);

      let selectedIds = [];
      if (profile?.selected_achievement_ids) {
        try {
          selectedIds = typeof profile.selected_achievement_ids === 'string'
            ? JSON.parse(profile.selected_achievement_ids)
            : profile.selected_achievement_ids;
        } catch (_) {
          selectedIds = [];
        }
      }

      return {
        profileId: profile?.profile_id || null,
        slug: profile?.slug || null,
        templateId: profile?.template_id || 'Modern',
        isPublic: Boolean(profile?.is_public),
        headline: profile?.headline || '',
        bio: profile?.bio || '',
        version: profile?.version || 1,
        selectedAchievementIds: selectedIds,
        contact,
        achievements,
      };
    },

    async updateCv(userId, raw) {
      const data = updateCvProfileSchema.parse(raw);

      if (data.slug) {
        const existing = await repo.findProfileBySlug(data.slug);
        if (existing && String(existing.user_id) !== String(userId)) {
          throw new ConflictError('Slug này đã có người sử dụng. Vui lòng chọn slug khác.');
        }
      }

      const saved = await repo.upsertProfile(userId, data);
      return {
        version: saved.version,
        slug: saved.slug,
        isPublic: Boolean(saved.is_public),
        templateId: saved.template_id,
        headline: saved.headline,
        bio: saved.bio,
      };
    },

    async exportCvDocx(userId) {
      const [profile, contact, allAchievements] = await Promise.all([
        repo.findProfileByUserId(userId),
        repo.getUserContact(userId),
        repo.getUserActiveAchievements(userId),
      ]);

      let selectedIds = null;
      if (profile?.selected_achievement_ids) {
        try {
          selectedIds = typeof profile.selected_achievement_ids === 'string'
            ? JSON.parse(profile.selected_achievement_ids)
            : profile.selected_achievement_ids;
        } catch (_) {
          selectedIds = null;
        }
      }

      const achievements = (Array.isArray(selectedIds) && selectedIds.length > 0)
        ? allAchievements.filter(a => selectedIds.includes(Number(a.achievement_id)))
        : allAchievements;

      const templatePath = path.join(__dirname, 'templates', 'default_cv.docx');
      let zip;

      if (fs.existsSync(templatePath)) {
        const content = fs.readFileSync(templatePath, 'binary');
        zip = new PizZip(content);
      } else {
        zip = new PizZip();
        zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
        zip.file('_rels/.rels', RELS_XML);
        zip.file('word/document.xml', DOCUMENT_XML);
      }

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render({
        fullName: contact.full_name || 'Họ và Tên',
        title: contact.title || '',
        degree: contact.degree || '',
        unitName: contact.unit_name || 'Trường Đại học Lạc Hồng',
        email: contact.email || '',
        phone: contact.phone || '',
        headline: profile?.headline || '',
        bio: profile?.bio || '',
        achievementsCount: achievements.length,
        achievements: achievements.map((a, idx) => ({
          index: idx + 1,
          title: a.title,
          recognitionYear: a.recognition_year || 'N/A',
          type: a.achievement_type_name || 'Khen thưởng',
        })),
      });

      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      return {
        buffer,
        filename: 'CV_Export.docx',
      };
    },
  };
}

export default createCvService();
