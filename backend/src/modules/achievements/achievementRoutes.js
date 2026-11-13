import express from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRoles } from '../../middlewares/requireRoles.js';
import controller from './achievementController.js';

const router = express.Router();

// Cấu hình Multer upload vào memory buffer để chuyển cho AI Vision
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

router.use(authenticate);

const standardRoles = ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN', 'LECTURER', 'UNIT_REPRESENTATIVE'];

// Read active catalog metadata
router.get('/achievements/catalogs', controller.catalogs);

// 1. Tra cứu danh sách phân trang và lọc thành tích
router.get('/achievements', controller.list);

// 2. AI Vision Auto-fill: Trích xuất thông tin bằng khen/chứng chỉ từ file tải lên
router.post(
  '/achievements/ai-extract',
  requireRoles(...standardRoles),
  upload.single('file'),
  controller.aiExtract
);

// 3. Chi tiết hồ sơ thành tích
router.get('/achievements/:id', controller.getById);

// 4. Tạo thành tích mới trong Kho (nhận trạng thái ACTIVE ngay lập tức)
router.post(
  '/achievements',
  requireRoles(...standardRoles),
  controller.create
);

// 5. Cập nhật thành tích trong kho cá nhân
router.patch(
  '/achievements/:id',
  requireRoles(...standardRoles),
  controller.update
);
router.put(
  '/achievements/:id',
  requireRoles(...standardRoles),
  controller.update
);

// 6. Xóa thành tích khỏi kho cá nhân
router.delete(
  '/achievements/:id',
  requireRoles(...standardRoles),
  controller.remove
);

router.post('/achievements/:id/restore', requireRoles(...standardRoles), controller.restore);

// 7. Xem lịch sử chuyển trạng thái
router.get('/achievements/:id/history', controller.getHistory);

// 8. Xem danh sách các lần nộp hồ sơ (nếu có dữ liệu lịch sử cũ)
router.get('/achievements/:id/submissions', controller.getSubmissions);

// --- BÃI BỎ / DECOMMISSION CÁC TUYẾN PHÊ DUYỆT HÀNH CHÍNH CŨ ---
const decommissioned = (actionName) => (req, res) => {
  res.status(410).json({
    success: false,
    decommissioned: true,
    message: `Quy trình [${actionName}] đã được bãi bỏ. Hệ thống sử dụng Kho lưu trữ thành tích cá nhân có hiệu lực trực tiếp (ACTIVE).`,
  });
};

router.post('/achievements/:id/submit', decommissioned('submit'));
router.post('/achievements/:id/verify', decommissioned('verify'));
router.post('/achievements/:id/request-correction', decommissioned('request-correction'));
router.post('/achievements/:id/reject', decommissioned('reject'));
router.post('/achievements/:id/cancel', decommissioned('cancel'));
router.post('/achievements/:id/revoke', decommissioned('revoke'));
router.post('/achievements/:id/resubmit', decommissioned('resubmit'));
router.post('/achievements/:id/replace', decommissioned('replace'));

export default router;
