import { z } from 'zod';

const text = (max, min = 1) => z.string().trim().min(min).max(max);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateString = z.string().regex(dateRegex, 'Định dạng ngày phải là YYYY-MM-DD');

const sha256Regex = /^[a-fA-F0-9]{64}$/;

export const documentTypeEnum = z.enum([
  'LAW',
  'CIRCULAR',
  'UNIVERSITY_REGULATION',
  'DECISION',
  'GUIDELINE',
]);

export const lhuApplicationStatusEnum = z.enum([
  'CONFIRMED_LHU_POLICY',
  'INTERNAL_CRITERIA_UNCONFIRMED',
  'SIMULATION_ONLY',
  'REJECTED',
]);

export const targetTypeEnum = z.enum(['INDIVIDUAL', 'COLLECTIVE', 'BOTH']);

// 1. Tạo Văn bản gốc
export const createDocumentSchema = z.object({
  documentCode: text(100).transform((v) => v.toUpperCase()),
  title: text(255, 3),
  issuingAuthority: text(255).optional().nullable(),
  documentType: documentTypeEnum,
  description: z.string().trim().max(2000).optional().nullable(),
}).strict();

// 2. Tạo Phiên bản Văn bản
export const createVersionSchema = z.object({
  versionNumber: text(100),
  sha256Hash: z.string().regex(sha256Regex, 'SHA-256 hash phải có đúng 64 ký tự hex').optional(),
  sourceUrl: z.string().url().max(1000).optional().nullable(),
  signedDate: dateString.optional().nullable(),
  effectiveFrom: dateString,
  effectiveTo: dateString.optional().nullable(),
  supersedesVersionId: z.coerce.number().int().positive().optional().nullable(),
  isOfficial: z.boolean().default(true),
  lhuApplicationStatus: lhuApplicationStatusEnum.default('INTERNAL_CRITERIA_UNCONFIRMED'),
  contentForHash: z.string().optional(), // nếu không truyền sha256Hash, có thể truyền content để backend tự băm
}).strict().refine((data) => {
  if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
    return false;
  }
  return true;
}, {
  message: 'Ngày hết hiệu lực (effectiveTo) phải sau hoặc bằng ngày bắt đầu hiệu lực (effectiveFrom)',
  path: ['effectiveTo'],
}).refine((data) => {
  // Fail-closed rule: Khi tạo mới chưa có người duyệt, không được tự ý gán nhãn chính sách chính thức của LHU
  if (data.lhuApplicationStatus === 'CONFIRMED_LHU_POLICY') {
    return false;
  }
  return true;
}, {
  message: 'Phiên bản mới khởi tạo không được tự ý gắn nhãn CONFIRMED_LHU_POLICY mà phải qua bước phê duyệt chính thức',
  path: ['lhuApplicationStatus'],
});

// 3. Tạo Đoạn trích dẫn (Chunk)
export const createChunkSchema = z.object({
  articleNo: text(50).optional().nullable(),
  clauseNo: text(50).optional().nullable(),
  pageNo: z.coerce.number().int().positive().optional().nullable(),
  content: text(10000, 5),
  chunkHash: z.string().regex(sha256Regex).optional(),
}).strict();

export const batchCreateChunksSchema = z.object({
  chunks: z.array(createChunkSchema).min(1, 'Cần ít nhất 1 chunk'),
}).strict();

// 4. Tạo Tiêu chí Khen thưởng
export const createCriteriaVersionSchema = z.object({
  criterionCode: text(50).transform((v) => v.toUpperCase()),
  name: text(255, 3),
  targetType: targetTypeEnum,
  academicYearId: z.coerce.number().int().positive().optional().nullable(),
  minThreshold: z.coerce.number().min(0).optional().nullable(),
  unitMetric: text(50).optional().nullable(),
  legalReferences: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).strict();

// 5. Xác nhận Phiên bản Văn bản
export const confirmVersionSchema = z.object({
  isConfirmed: z.boolean(),
  lhuApplicationStatus: lhuApplicationStatusEnum,
  confirmationNotes: z.string().trim().max(2000).optional().nullable(),
}).strict().refine((data) => {
  if (!data.isConfirmed && data.lhuApplicationStatus === 'CONFIRMED_LHU_POLICY') {
    return false;
  }
  return true;
}, {
  message: 'Không thể gắn nhãn CONFIRMED_LHU_POLICY khi isConfirmed là false',
  path: ['lhuApplicationStatus'],
});

// 6. Xác nhận Tiêu chí Khen thưởng
export const confirmCriteriaSchema = z.object({
  isConfirmed: z.boolean(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).strict();

// 7. Query params
export const queryRegulationsSchema = z.object({
  asOfDate: dateString.optional(),
  documentType: documentTypeEnum.optional(),
  confirmedOnly: z.coerce.boolean().optional().default(false),
  status: lhuApplicationStatusEnum.optional(),
}).strict();

export const queryCriteriaSchema = z.object({
  asOfDate: dateString.optional(),
  versionId: z.coerce.number().int().positive().optional(),
  targetType: targetTypeEnum.optional(),
  confirmedOnly: z.coerce.boolean().optional().default(true), // Mặc định chỉ trả về tiêu chí đã duyệt
}).strict();
