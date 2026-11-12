import { verifyAccessToken } from '../utils/crypto.js';
import { UnauthorizedError } from '../utils/errors.js';
import { findUserById } from '../modules/auth/authRepository.js';

/**
 * Middleware xác thực Access Token từ Header Authorization Bearer
 */
export async function authenticate(req, res, next) {
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
        passwordChangedAt: decoded.passwordChangedAt ?? null,
      };
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access Token đã hết hạn');
      }
      throw new UnauthorizedError('Access Token không hợp lệ hoặc đã bị chỉnh sửa');
    }
    const user = await findUserById(req.user.userId);
    if (!user || user.Status !== 'ACTIVE') throw new UnauthorizedError('Tài khoản không còn hoạt động');
    const currentPasswordChange = user.PasswordChangedAt ? new Date(user.PasswordChangedAt).toISOString() : null;
    if (req.user.passwordChangedAt !== currentPasswordChange) throw new UnauthorizedError('Mật khẩu đã thay đổi. Vui lòng đăng nhập lại');
    next();
  } catch (error) {
    next(error);
  }
}

export default authenticate;
