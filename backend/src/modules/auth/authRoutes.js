import express from 'express';
import { z } from 'zod';
import { register } from './registrationService.js';
import { requestPasswordReset, resetPassword } from './passwordResetService.js';
import { ValidationError } from '../../utils/errors.js';
import authController from './authController.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRoles } from '../../middlewares/requireRoles.js';
import { requireScope } from '../../middlewares/requireScope.js';
import { antiSelfApproval } from '../../middlewares/antiSelfApproval.js';

const router = express.Router();

/**
 * Public Auth Routes
 */
// Bound requests per process and IP; production deployments should also limit at the edge.
const attempts = new Map();
function limitReset(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = req.ip;
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (++entry.count > 10) return res.status(429).json({ success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' });
  attempts.set(key, entry); next();
}
router.post('/register', limitReset, async (req, res, next) => {
  try { const result = await register(req.body); res.status(201).json({ success: true, ...result }); }
  catch (error) { next(error); }
});
router.post('/forgot-password', limitReset, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().trim().email().max(254) }).strict().safeParse(req.body);
    if (!input.success) throw new ValidationError('Email không hợp lệ.');
    await requestPasswordReset(input.data.email);
    res.json({ success: true, message: 'Nếu email thuộc tài khoản đang hoạt động, hướng dẫn sẽ được gửi đến email đó.' });
  } catch (error) { next(error); }
});
router.post('/reset-password', limitReset, async (req, res, next) => {
  try {
    const input = z.object({ token: z.string().min(1).max(4096), password: z.string().min(8).refine(v => Buffer.byteLength(v, 'utf8') <= 72) }).strict().safeParse(req.body);
    if (!input.success) throw new ValidationError('Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte.');
    await resetPassword(input.data.token, input.data.password);
    res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
  } catch (error) { next(error); }
});
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
  requireRoles('MANAGER'),
  requireScope((req) => req.params.unitId, { roleCode: 'MANAGER', actionName: 'thẩm định thành tích đơn vị' }),
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
