import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRoles } from '../../middlewares/requireRoles.js';
import controller from './achievementController.js';

const router = express.Router();

router.use(authenticate);

// Read active catalog metadata without granting access to Admin catalog mutations.
router.get('/achievements/catalogs', controller.catalogs);

// 1. Tra cứu danh sách phân trang và lọc thành tích
router.get('/achievements', controller.list);

// 2. Chi tiết hồ sơ thành tích
router.get('/achievements/:id', controller.getById);

// 3. Tạo bản nháp thành tích mới (DRAFT)
router.post(
  '/achievements',
  requireRoles('LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'),
  controller.create
);

// 4. Cập nhật bản nháp thành tích (DRAFT hoặc NEED_CORRECTION)
router.patch(
  '/achievements/:id',
  requireRoles('LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'),
  controller.update
);
router.put(
  '/achievements/:id',
  requireRoles('LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'),
  controller.update
);

// 5. Xóa bản nháp thành tích (chỉ xóa DRAFT chưa từng nộp)
router.delete(
  '/achievements/:id',
  requireRoles('LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'),
  controller.remove
);

// 6. Xem lịch sử chuyển trạng thái
router.get('/achievements/:id/history', controller.getHistory);

// 7. Xem danh sách các lần nộp hồ sơ (Submissions & Snapshots)
router.get('/achievements/:id/submissions', controller.getSubmissions);

// 8. Gửi duyệt hồ sơ thành tích (DRAFT hoặc NEED_CORRECTION -> SUBMITTED)
router.post(
  '/achievements/:id/submit',
  requireRoles('LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'),
  controller.submit
);

// 9. Xác nhận hồ sơ thành tích (SUBMITTED -> VERIFIED)
router.post(
  '/achievements/:id/verify',
  requireRoles('MANAGER', 'ADMIN'),
  controller.verify
);

// 10. Yêu cầu bổ sung hồ sơ (SUBMITTED -> NEED_CORRECTION)
router.post(
  '/achievements/:id/request-correction',
  requireRoles('MANAGER', 'ADMIN'),
  controller.requestCorrection
);

// 11. Từ chối hồ sơ (SUBMITTED -> REJECTED)
router.post(
  '/achievements/:id/reject',
  requireRoles('MANAGER', 'ADMIN'),
  controller.reject
);

// 12. Hủy hồ sơ (DRAFT, SUBMITTED hoặc NEED_CORRECTION -> CANCELLED)
router.post(
  '/achievements/:id/cancel',
  requireRoles('LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'),
  controller.cancel
);

// 13. Thu hồi hồ sơ đã xác nhận (VERIFIED -> REVOKED)
router.post(
  '/achievements/:id/revoke',
  requireRoles('MANAGER', 'ADMIN'),
  controller.revoke
);

// 14. Gửi lại hồ sơ thành tích (alias cho submit khi ở NEED_CORRECTION)
router.post(
  '/achievements/:id/resubmit',
  requireRoles('LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'),
  controller.submit
);

// 15. Tạo bản thay thế cho hồ sơ đã kết thúc (REJECTED, CANCELLED, REVOKED)
router.post(
  '/achievements/:id/replace',
  requireRoles('LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'),
  controller.replace
);

export default router;
