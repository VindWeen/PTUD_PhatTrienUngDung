import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createAchievementSchema = z
  .object({
    subjectType: z.enum(['LECTURER', 'UNIT']).default('LECTURER'),
    organizationUnitId: z.coerce.number().int().positive().nullable().optional(),
    achievementTypeId: z.coerce.number().int().positive({ message: 'Vui lòng chọn loại thành tích hợp lệ' }),
    title: z.string().trim().min(5, 'Tiêu đề thành tích phải có ít nhất 5 ký tự').max(255, 'Tiêu đề không được vượt quá 255 ký tự'),
    description: z.string().trim().max(4000, 'Mô tả không được vượt quá 4000 ký tự').nullable().optional(),
    contributionRole: z.string().trim().max(100, 'Vai trò đóng góp tối đa 100 ký tự').nullable().optional(),
    startDate: z.string().regex(dateRegex, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD').nullable().optional(),
    endDate: z.string().regex(dateRegex, 'Ngày kết thúc phải theo định dạng YYYY-MM-DD').nullable().optional(),
    recognitionYear: z.coerce
      .number()
      .int()
      .min(1990, 'Năm ghi nhận thành tích phải từ 1990 trở lại')
      .max(2100, 'Năm ghi nhận không hợp lệ'),
    academicYearId: z.coerce.number().int().positive().nullable().optional(),
    replacesAchievementId: z.coerce.number().int().positive().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Ràng buộc XOR chủ thể: Nếu là Tập thể (UNIT) thì bắt buộc có organizationUnitId
    if (data.subjectType === 'UNIT' && (!data.organizationUnitId || data.organizationUnitId <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Thành tích tập thể bắt buộc phải chọn đơn vị trực thuộc (organizationUnitId)',
        path: ['organizationUnitId'],
      });
    }

    // 2. Ràng buộc ngày tháng: Ngày kết thúc phải >= Ngày bắt đầu
    if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ngày kết thúc (endDate) phải lớn hơn hoặc bằng ngày bắt đầu (startDate)',
        path: ['endDate'],
      });
    }
  });

export const updateAchievementSchema = z
  .object({
    title: z.string().trim().min(5, 'Tiêu đề thành tích phải có ít nhất 5 ký tự').max(255, 'Tiêu đề không được vượt quá 255 ký tự').optional(),
    description: z.string().trim().max(4000, 'Mô tả không được vượt quá 4000 ký tự').nullable().optional(),
    contributionRole: z.string().trim().max(100, 'Vai trò đóng góp tối đa 100 ký tự').nullable().optional(),
    startDate: z.string().regex(dateRegex, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD').nullable().optional(),
    endDate: z.string().regex(dateRegex, 'Ngày kết thúc phải theo định dạng YYYY-MM-DD').nullable().optional(),
    recognitionYear: z.coerce
      .number()
      .int()
      .min(1990, 'Năm ghi nhận thành tích phải từ 1990 trở lại')
      .max(2100, 'Năm ghi nhận không hợp lệ')
      .optional(),
    academicYearId: z.coerce.number().int().positive().nullable().optional(),
    achievementTypeId: z.coerce.number().int().positive().optional(),
    version: z.coerce.number().int().positive({ message: 'Số hiệu phiên bản version là bắt buộc để kiểm soát cập nhật đồng thời' }),
  })
  .strict({ message: 'Không được phép cập nhật các trường bị khóa (status, createdBy, contextUnitId, lecturerId, unitId)' })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ngày kết thúc (endDate) phải lớn hơn hoặc bằng ngày bắt đầu (startDate)',
        path: ['endDate'],
      });
    }
  });

export const listAchievementsQuerySchema = z.object({
  subjectType: z.enum(['LECTURER', 'UNIT']).optional(),
  lecturerId: z.coerce.number().int().positive().optional(),
  unitId: z.coerce.number().int().positive().optional(),
  contextUnitId: z.coerce.number().int().positive().optional(),
  recognitionYear: z.coerce.number().int().min(1990).optional(),
  academicYearId: z.coerce.number().int().positive().optional(),
  achievementTypeId: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'updatedAt', 'recognitionYear', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const submitAchievementSchema = z.object({
  version: z.coerce.number().int().positive({ message: 'Số hiệu phiên bản version là bắt buộc để kiểm soát cập nhật đồng thời' }),
  note: z.string().trim().max(1000).optional(),
  submitNote: z.string().trim().max(1000).optional(),
});

export const verifyAchievementSchema = z.object({
  version: z.coerce.number().int().positive({ message: 'Số hiệu phiên bản version là bắt buộc để kiểm soát cập nhật đồng thời' }),
  note: z.string().trim().max(1000).optional(),
});

export const requestCorrectionSchema = z.object({
  version: z.coerce.number().int().positive({ message: 'Số hiệu phiên bản version là bắt buộc để kiểm soát cập nhật đồng thời' }),
  reason: z.string().trim().min(5, 'Lý do yêu cầu bổ sung phải có ít nhất 5 ký tự').max(1000),
});

export const rejectAchievementSchema = z.object({
  version: z.coerce.number().int().positive({ message: 'Số hiệu phiên bản version là bắt buộc để kiểm soát cập nhật đồng thời' }),
  reason: z.string().trim().min(5, 'Lý do từ chối phải có ít nhất 5 ký tự').max(1000),
});

export const cancelAchievementSchema = z.object({
  version: z.coerce.number().int().positive({ message: 'Số hiệu phiên bản version là bắt buộc để kiểm soát cập nhật đồng thời' }),
  reason: z.string().trim().max(1000).optional(),
});

export const revokeAchievementSchema = z.object({
  version: z.coerce.number().int().positive({ message: 'Số hiệu phiên bản version là bắt buộc để kiểm soát cập nhật đồng thời' }),
  reason: z.string().trim().min(5, 'Lý do thu hồi phải có ít nhất 5 ký tự').max(1000),
});

export const replaceAchievementSchema = z.object({
  version: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(5, 'Tiêu đề thành tích phải có ít nhất 5 ký tự').max(255).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  contributionRole: z.string().trim().max(100).nullable().optional(),
  startDate: z.string().regex(dateRegex, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD').nullable().optional(),
  endDate: z.string().regex(dateRegex, 'Ngày kết thúc phải theo định dạng YYYY-MM-DD').nullable().optional(),
  recognitionYear: z.coerce.number().int().min(1990).max(2100).optional(),
  academicYearId: z.coerce.number().int().positive().nullable().optional(),
  achievementTypeId: z.coerce.number().int().positive().optional(),
  reason: z.string().trim().max(1000).optional(),
});

export default {
  createAchievementSchema,
  updateAchievementSchema,
  listAchievementsQuerySchema,
  submitAchievementSchema,
  verifyAchievementSchema,
  requestCorrectionSchema,
  rejectAchievementSchema,
  cancelAchievementSchema,
  revokeAchievementSchema,
  replaceAchievementSchema,
};
