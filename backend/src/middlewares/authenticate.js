import { verifyAccessToken } from '../utils/crypto.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Middleware xác thực Access Token từ Header Authorization Bearer
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Yêu cầu xác thực tài khoản: Thiếu Access Token');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedError('Access Token không hợp lệ');
    }

    try {
      const decoded = verifyAccessToken(token);
      req.user = {
        userId: Number(decoded.userId || decoded.sub),
        username: decoded.username,
        email: decoded.email,
        roles: decoded.roles || [],
      };
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access Token đã hết hạn');
      }
      throw new UnauthorizedError('Access Token không hợp lệ hoặc đã bị chỉnh sửa');
    }
  } catch (error) {
    next(error);
  }
}

export default authenticate;
