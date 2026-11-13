import { z } from 'zod';
const text = max => z.string().trim().max(max);
const experience = z.object({ organization: text(150).min(1), position: text(150).min(1), period: text(80), description: text(1000) }).strict();
const education = z.object({ institution: text(150).min(1), qualification: text(150).min(1), period: text(80) }).strict();
export const cvSchema = z.object({
  version: z.number().int().nonnegative(), template: z.enum(['classic', 'modern']),
  headline: text(150), summary: text(2000), showEmail: z.boolean(), showPhone: z.boolean(),
  workHistoryIds: z.array(z.number().int().positive().safe()).max(100),
  achievementIds: z.array(z.number().int().positive().safe()).max(100),
  experiences: z.array(experience).max(30),
  education: z.array(education).max(30).default([]), specialties: text(500).default(''),
  skills: text(500).default(''), certificates: text(2000).default(''), projects: text(3000).default(''), researchLinks: text(2000).default(''),
}).strict();
export const emptyDraft = { version: 0, template: 'classic', headline: '', summary: '', showEmail: false, showPhone: false, workHistoryIds: [], achievementIds: [], experiences: [], education: [], specialties: '', skills: '', certificates: '', projects: '', researchLinks: '' };
export function buildPublicCv(draft, profile, achievements) {
  const historyIds = new Set(draft.workHistoryIds.map(String));
  const achievementIds = new Set(draft.achievementIds.map(String));
  return {
    template: draft.template, fullName: profile.fullName, headline: draft.headline, summary: draft.summary,
    email: draft.showEmail ? profile.email : null, phone: draft.showPhone ? profile.phone : null,
    workHistory: profile.workHistory.filter(item => historyIds.has(String(item.assignmentId))).map(({ period, unitName, parentUnitName }) => ({ period, unitName, parentUnitName })),
    achievements: achievements.filter(item => achievementIds.has(String(item.achievementId))).map(({ achievementId, title, recognitionYear }) => ({ achievementId: Number(achievementId), title, recognitionYear })),
    experiences: draft.experiences, education: draft.education || [], specialties: draft.specialties || '', skills: draft.skills || '', certificates: draft.certificates || '', projects: draft.projects || '', researchLinks: draft.researchLinks || '',
  };
}
export function filterPublishedAchievements(snapshot, validAchievements) {
  const allowed = new Set(validAchievements.map(item => String(item.achievementId)));
  return { ...snapshot, achievements: (snapshot.achievements || []).filter(item => item.achievementId && allowed.has(String(item.achievementId))).map(({ title, recognitionYear }) => ({ title, recognitionYear })) };
}


export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = ['admin', 'api', 'auth', 'system', 'login', 'settings', 'help', 'root', 'me', 'public', 'export-docx', 'download', 'cv', 'profile', 'default'];
export const VALID_TEMPLATES = ['Modern', 'Academic', 'Minimalist', 'Creative', 'standard', 'classic', 'modern'];

export const slugSchema = z.string().trim()
  .min(3, 'Độ dài slug phải từ 3 đến 100 ký tự')
  .max(100, 'Độ dài slug phải từ 3 đến 100 ký tự')
  .regex(SLUG_REGEX, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang')
  .refine(s => !RESERVED_SLUGS.includes(s.toLowerCase()), 'Slug không được sử dụng các từ khóa hệ thống đã được bảo lưu');

export const updateCvProfileSchema = z.object({
  slug: slugSchema.optional().nullable(),
  templateId: z.string().trim().refine(t => VALID_TEMPLATES.some(v => v.toLowerCase() === t.toLowerCase()), {
    message: 'Mẫu giao diện CV không hợp lệ',
  }).optional(),
  isPublic: z.boolean().optional(),
  headline: z.string().trim().max(255).optional().nullable(),
  bio: z.string().trim().max(5000).optional().nullable(),
  contact: z.object({
    fullName: z.string().trim().max(255).optional().nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
    email: z.string().trim().email().optional().nullable(),
    address: z.string().trim().max(255).optional().nullable(),
    title: z.string().trim().max(100).optional().nullable(),
    degree: z.string().trim().max(100).optional().nullable(),
  }).optional().nullable(),
  selectedAchievementIds: z.array(z.coerce.number().int().positive()).optional().nullable(),
  version: z.coerce.number().int().nonnegative().optional(),
}).strict();
