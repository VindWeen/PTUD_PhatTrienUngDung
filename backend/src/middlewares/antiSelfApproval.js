import { SelfApprovalError, UnauthorizedError } from '../utils/errors.js';

/**
 * Middleware chống tự phê duyệt (Anti-Self Approval Guard)
 * Đảm bảo quy tắc liêm chính học thuật: Cán bộ không được phép tự duyệt/xác nhận thành tích
 * của chính bản thân mình hoặc do mình tạo/nộp.
 *
 * @param {(req: import('express').Request) => number | string | Promise<number | string>} getSubjectUserIdFn - Hàm lấy UserId của chủ thể thành tích
 */
export function antiSelfApproval(getSubjectUserIdFn) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        throw new UnauthorizedError('Yêu cầu xác thực tài khoản trước khi kiểm tra quy tắc tự duyệt');
      }

      const subjectUserId = typeof getSubjectUserIdFn === 'function' ? await getSubjectUserIdFn(req) : req.body.subjectUserId || req.body.lecturerUserId;

      if (subjectUserId && Number(subjectUserId) === Number(req.user.userId)) {
        throw new SelfApprovalError(
          'Quy tắc liêm chính: Bạn không được phép tự phê duyệt hoặc thẩm định hồ sơ thành tích của chính mình'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default antiSelfApproval;
