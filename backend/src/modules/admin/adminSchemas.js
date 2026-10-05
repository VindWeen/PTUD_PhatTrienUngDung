import { z } from 'zod';
const id = z.coerce.number().int().positive().safe();
const text = (max) => z.string().trim().min(1).max(max);
const code = text(50).regex(/^[\p{L}\p{N}_-]+$/u).transform(v => v.toUpperCase());
const period = { validFrom: z.string().datetime({ offset: true }), validTo: z.string().datetime({ offset: true }).nullable() };
const validPeriod = v => !v.validTo || Date.parse(v.validTo) > Date.parse(v.validFrom);
export const assignmentSchema = z.object({ userId: id, roleId: id, unitId: id.optional(), includeDescendants: z.boolean().default(false), ...period }).strict().refine(validPeriod, { message: 'Thời hạn kết thúc phải sau bắt đầu', path: ['validTo'] });
export const representativeSchema = z.object({ userId: id, unitId: id, ...period, validTo: z.string().datetime({ offset: true }) }).strict().refine(validPeriod, { message: 'Thời hạn kết thúc phải sau bắt đầu', path: ['validTo'] });
export const userSchema = z.object({ username: text(50).regex(/^[A-Za-z0-9_.-]+$/), email: z.string().email().max(255), displayName: text(100), password: z.string().min(10).max(72) }).strict();
export const userUpdateSchema = z.object({ email: z.string().email().max(255), displayName: text(100), status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']), version: id }).strict();
const common = { code, name: text(150), isActive: z.boolean().default(true) };
const subject = z.enum(['LECTURER', 'UNIT', 'BOTH']).default('BOTH');
export const catalogDefinitions = {
  'academic-years': { table: 'academic_years', id: 'academic_year_id', columns: ['code', 'name', 'start_date', 'end_date', 'is_current', 'is_active'], schema: z.object({ ...common, code: code.pipe(z.string().max(20)), name: text(100), startDate: z.string().date(), endDate: z.string().date(), isCurrent: z.boolean().default(false) }).strict().refine(v => v.endDate > v.startDate && (!v.isCurrent || v.isActive), { message: 'Ngày kết thúc phải sau bắt đầu; năm hiện tại phải hoạt động' }) },
  'achievement-types': { table: 'achievement_types', id: 'achievement_type_id', columns: ['code', 'name', 'description', 'applicable_subject_type', 'is_active'], schema: z.object({ ...common, description: z.string().max(500).nullable().default(null), applicableSubjectType: subject }).strict() },
  'award-types': { table: 'award_types', id: 'award_type_id', columns: ['code', 'name', 'description', 'category', 'level', 'applicable_subject_type', 'is_active'], schema: z.object({ ...common, description: z.string().max(500).nullable().default(null), category: z.enum(['TITLE', 'REWARD_FORM']), level: z.enum(['FACULTY', 'UNIVERSITY', 'MINISTRY', 'STATE']), applicableSubjectType: subject }).strict() },
};
export const parseId = value => id.parse(value);
