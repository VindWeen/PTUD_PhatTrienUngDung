import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/authenticate.js';
import { ValidationError } from '../../utils/errors.js';
import evidenceController from './evidenceController.js';
import { MAX_FILE_SIZE_BYTES } from './evidenceValidators.js';

// Cấu hình Multer lưu vào memory để kiểm tra Magic Bytes và tính SHA-256 trước khi lưu đĩa
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 10 MB
  },
});

// Middleware bọc để bắt lỗi Multer (như LIMIT_FILE_SIZE) và ném ValidationError chuẩn của hệ thống
function handleMulterUpload(fieldName) {
  const multerSingle = upload.single(fieldName);
  return (req, res, next) => {
    multerSingle(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new ValidationError('Dung lượng tệp tin vượt quá giới hạn cho phép (tối đa 10 MB)', {
              fileSize: ['Dung lượng tệp vượt quá 10,485,760 bytes'],
            })
          );
        }
        return next(new ValidationError(`Lỗi tải tệp tin: ${err.message}`));
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
}

const router = Router();

// Toàn bộ các endpoints minh chứng đều yêu cầu xác thực JWT / Cookie
router.use(authenticate);

// 1. Thêm minh chứng mới kèm tệp tin ban đầu
router.post('/achievements/:id/evidences', handleMulterUpload('file'), (req, res, next) =>
  evidenceController.createEvidence(req, res, next)
);

// 2. Lấy danh sách minh chứng của một hồ sơ thành tích
router.get('/achievements/:id/evidences', (req, res, next) =>
  evidenceController.getEvidencesByAchievement(req, res, next)
);

// 3. Tải lên phiên bản tệp tin mới (thay file -> tăng version_no)
router.post('/evidences/:id/versions', handleMulterUpload('file'), (req, res, next) =>
  evidenceController.uploadFileVersion(req, res, next)
);

// 4. Xóa mềm minh chứng
router.delete('/evidences/:id', (req, res, next) =>
  evidenceController.deleteEvidence(req, res, next)
);

// 5. Tải về tệp tin minh chứng (Private stream)
router.get('/evidence-files/:id/download', (req, res, next) =>
  evidenceController.downloadEvidenceFile(req, res, next)
);

export default router;
