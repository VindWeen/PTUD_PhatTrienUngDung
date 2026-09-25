import express from 'express';
import authController from './authController.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRoles } from '../../middlewares/requireRoles.js';
import { requireScope } from '../../middlewares/requireScope.js';
import { antiSelfApproval } from '../../middlewares/antiSelfApproval.js';

const router = express.Router();

/**
 * Public Auth Routes
 */
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

/**
 * Authenticated Auth Routes
 */
router.post('/change-password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.me);

/**
 * Scope & Verification Test Routes (Phục vụ kiểm thử nghiệm thu W1-Q3)
 * Endpoint xác minh phân công quản lý đơn vị theo CTE và quy tắc Admin không tự có quyền thẩm định
 */
router.get(
  '/verify-scope/:unitId',
  authenticate,
  requireRoles('MANAGER', 'UNIT_REP'),
  requireScope((req) => req.params.unitId, { actionName: 'thẩm định thành tích đơn vị' }),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Đơn vị nằm trong phạm vi thẩm định hợp lệ',
      data: req.verifiedUnitScope,
    });
  }
);

/**
 * Endpoint kiểm thử quy tắc Chống tự phê duyệt (Anti-Self Approval)
 */
router.post(
  '/test-anti-self-approval',
  authenticate,
  antiSelfApproval((req) => req.body.lecturerUserId),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Hợp lệ: Thẩm định viên không phải là chủ thể hồ sơ',
      data: { verifiedBy: req.user.userId, subjectUserId: req.body.lecturerUserId },
    });
  }
);

export default router;
