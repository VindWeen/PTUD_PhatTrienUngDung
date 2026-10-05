import crypto from 'crypto';
import path from 'path';
import { z } from 'zod';
import { ValidationError } from '../../utils/errors.js';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB = 10,485,760 bytes

export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];

export const MIME_TYPE_MAP = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/octet-stream',
  ],
};

/**
 * Kiểm tra chữ ký ma thuật (Magic Bytes / File Signature) từ buffer nhị phân thực tế
 * @param {Buffer} buffer
 * @param {string} ext
 * @returns {boolean}
 */
export function verifyMagicBytes(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;

  const normalizedExt = ext.toLowerCase();

  switch (normalizedExt) {
    case '.pdf': {
      // PDF bắt đầu bằng %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
      if (buffer.length < 5) return false;
      return (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46 &&
        buffer[4] === 0x2d
      );
    }
    case '.png': {
      // PNG bắt đầu bằng 8 bytes: 89 50 4E 47 0D 0A 1A 0A
      if (buffer.length < 8) return false;
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    }
    case '.jpg':
    case '.jpeg': {
      // JPEG bắt đầu bằng FF D8 FF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    case '.docx': {
      // DOCX là tệp nén ZIP, bắt đầu bằng PK (0x50, 0x4B)
      return (
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
          (buffer[2] === 0x05 && buffer[3] === 0x06) ||
          (buffer[2] === 0x07 && buffer[3] === 0x08))
      );
    }
    default:
      return false;
  }
}

/**
 * Kiểm tra và chuẩn hóa tệp tin tải lên (Kích thước, MIME, Đuôi, Magic Bytes và Path Traversal)
 * @param {Express.Multer.File} file Đối tượng file nhận từ Multer
 * @returns {{ originalFileName: string, fileExtension: string, mimeType: string, fileSize: number, sha256Hash: string }}
 */
export function validateUploadedFile(file) {
  if (!file) {
    throw new ValidationError('Vui lòng chọn tệp tin minh chứng cần tải lên', {
      file: ['Tệp tin đính kèm là bắt buộc'],
    });
  }

  // 1. Kiểm tra kích thước tệp
  const fileSize = file.size || (file.buffer ? file.buffer.length : 0);
  if (fileSize <= 0) {
    throw new ValidationError('Tệp tin rỗng (0 bytes)', {
      fileSize: ['Dung lượng tệp tin phải lớn hơn 0 bytes'],
    });
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(`Dung lượng tệp vượt quá giới hạn cho phép (tối đa 10 MB)`, {
      fileSize: [`Dung lượng tệp (${fileSize} bytes) vượt quá 10,485,760 bytes`],
    });
  }

  // 2. Chống Path Traversal trong tên tệp gốc
  const rawFileName = file.originalname || 'unnamed_file';
  if (rawFileName.includes('\0') || rawFileName.includes('..') || rawFileName.includes('/') || rawFileName.includes('\\')) {
    // Làm sạch và lấy basename an toàn
    const cleanedBase = path.basename(rawFileName).replace(/[^a-zA-Z0-9._\- \u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    if (!cleanedBase || cleanedBase.length === 0) {
      throw new ValidationError('Tên tệp tin chứa ký tự không an toàn (Path Traversal)');
    }
  }

  const sanitizedFileName = path.basename(rawFileName).trim();
  const fileExtension = path.extname(sanitizedFileName).toLowerCase();

  // 3. Kiểm tra phần mở rộng tệp
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    throw new ValidationError(
      `Định dạng tệp ${fileExtension} không được hỗ trợ. Chỉ chấp nhận các định dạng: PDF, JPG, PNG, DOCX`,
      { fileExtension: [`Phần mở rộng ${fileExtension} không hợp lệ`] }
    );
  }

  // 4. Kiểm tra MIME Type
  const declaredMime = (file.mimetype || '').toLowerCase();
  const validMimes = MIME_TYPE_MAP[fileExtension] || [];
  if (declaredMime && !validMimes.includes(declaredMime)) {
    throw new ValidationError(
      `MIME type "${declaredMime}" không khớp với định dạng tệp ${fileExtension}`,
      { mimeType: [`MIME type không hợp lệ với đuôi tệp ${fileExtension}`] }
    );
  }

  // 5. Kiểm tra chữ ký ma thuật (Magic Bytes)
  if (!file.buffer) {
    throw new ValidationError('Dữ liệu nhị phân của tệp tin không tồn tại');
  }

  const isMagicValid = verifyMagicBytes(file.buffer, fileExtension);
  if (!isMagicValid) {
    throw new ValidationError(
      `Nội dung tệp tin không khớp với định dạng ${fileExtension.toUpperCase()} được khai báo (Chữ ký tệp giả mạo)`,
      { magicBytes: ['Nội dung tệp không hợp lệ hoặc bị hỏng'] }
    );
  }

  // 6. Tính toán mã băm SHA-256 xác thực tính toàn vẹn
  const sha256Hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

  // Chuẩn hóa MIME Type lưu trữ
  const standardMime = validMimes[0] || declaredMime || 'application/octet-stream';

  return {
    originalFileName: sanitizedFileName,
    fileExtension,
    mimeType: standardMime,
    fileSize,
    sha256Hash,
  };
}

/**
 * Zod Schema tạo danh mục minh chứng
 */
export const createEvidenceSchema = z.object({
  title: z
    .string({ required_error: 'Tiêu đề minh chứng là bắt buộc' })
    .trim()
    .min(3, 'Tiêu đề minh chứng phải có ít nhất 3 ký tự')
    .max(255, 'Tiêu đề minh chứng không được vượt quá 255 ký tự'),
  description: z
    .string()
    .trim()
    .max(500, 'Mô tả minh chứng không được vượt quá 500 ký tự')
    .optional()
    .nullable()
    .transform((val) => val || null),
});
