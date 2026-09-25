import { getActiveRoles } from '../modules/auth/authRepository.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * Middleware kiểm tra Role của người dùng.
 * Đọc trực tiếp từ DB để đảm bảo quy tắc "Thu hồi phân công có hiệu lực ngay".
 */
export function requireRoles(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        throw new UnauthorizedError('Yêu cầu xác thực tài khoản trước khi kiểm tra quyền');
      }

      // Đọc quyền hiện tại từ DB để đảm bảo khi quyền bị thu hồi sẽ có hiệu lực tức thì
      const dbRoles = await getActiveRoles(req.user.userId);
      const activeRoleCodes = dbRoles.map((r) => r.Code);
      req.user.activeRoles = activeRoleCodes;

      const hasRequiredRole = allowedRoles.some((role) => activeRoleCodes.includes(role));

      if (!hasRequiredRole) {
        throw new ForbiddenError(
          `Bạn không có quyền thực hiện hành động này. Yêu cầu một trong các vai trò: [${allowedRoles.join(', ')}]`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default requireRoles;
