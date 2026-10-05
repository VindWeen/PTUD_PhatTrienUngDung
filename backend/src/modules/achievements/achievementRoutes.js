import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRoles } from '../../middlewares/requireRoles.js';
import controller from './achievementController.js';

const router = express.Router();

router.use(authenticate);

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

// 5. Xóa bản nháp thành tích (chỉ xóa DRAFT chưa từng nộp)
router.delete(
  '/achievements/:id',
  requireRoles('LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'),
  controller.remove
);

export default router;
