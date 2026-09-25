import { z } from 'zod';
import authService from './authService.js';
import config from '../../config/env.js';
import { ValidationError, UnauthorizedError } from '../../utils/errors.js';

// Schemas xác thực dữ liệu đầu vào bằng Zod
const loginSchema = z.object({
  username: z.string({ required_error: 'Tên đăng nhập hoặc email không được để trống' }).min(1),
  password: z.string({ required_error: 'Mật khẩu không được để trống' }).min(1),
  rememberMe: z.boolean().optional().default(false),
});

const changePasswordSchema = z.object({
  oldPassword: z.string({ required_error: 'Mật khẩu hiện tại không được để trống' }).min(1),
  newPassword: z.string({ required_error: 'Mật khẩu mới không được để trống' }).min(8, 'Mật khẩu mới phải có tối thiểu 8 ký tự'),
});

/**
 * Cấu hình Cookie chuẩn HttpOnly
 */
function setRefreshCookie(res, token, rememberMe = false) {
  const maxAge = (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000;
  res.cookie('ptud_refresh_token', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('ptud_refresh_token', {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * POST /api/v1/auth/login
 */
export async function login(req, res, next) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const fieldErrors = {};
      parseResult.error.errors.forEach((err) => {
        fieldErrors[err.path.join('.')] = err.message;
      });
      throw new ValidationError('Dữ liệu đăng nhập không hợp lệ', fieldErrors);
    }

    const { username, password, rememberMe } = parseResult.data;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || null;

    const result = await authService.login({
      username,
      password,
      rememberMe,
      ip,
      userAgent,
    });

    // Thiết lập HttpOnly Cookie cho Refresh Token
    setRefreshCookie(res, result.rawRefreshToken, rememberMe);

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/refresh
 */
export async function refresh(req, res, next) {
  try {
    // Ưu tiên đọc từ HttpOnly Cookie, cho phép đọc từ body nếu client gửi
    const rawRefreshToken = req.cookies?.ptud_refresh_token || req.body?.refreshToken;

    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh Token không tồn tại trong phiên yêu cầu');
    }

    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || null;

    const result = await authService.refreshToken(rawRefreshToken, { ip, userAgent });

    // Cập nhật lại HttpOnly Cookie mới sau khi Token Rotation
    setRefreshCookie(res, result.newRawRefreshToken, false);

    res.status(200).json({
      success: true,
      message: 'Làm mới phiên làm việc thành công',
      data: {
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
}

/**
 * POST /api/v1/auth/logout
 */
export async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.cookies?.ptud_refresh_token || req.body?.refreshToken;

    if (rawRefreshToken) {
      await authService.logout(rawRefreshToken);
    }

    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công',
    });
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
}

/**
 * POST /api/v1/auth/change-password
 */
export async function changePassword(req, res, next) {
  try {
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      const fieldErrors = {};
      parseResult.error.errors.forEach((err) => {
        fieldErrors[err.path.join('.')] = err.message;
      });
      throw new ValidationError('Dữ liệu đổi mật khẩu không hợp lệ', fieldErrors);
    }

    const { oldPassword, newPassword } = parseResult.data;
    const result = await authService.changePassword(req.user.userId, oldPassword, newPassword);

    // Xóa cookie để buộc người dùng đăng nhập lại với mật khẩu mới
    clearRefreshCookie(res);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/auth/me
 */
export async function me(req, res, next) {
  try {
    const userProfile = await authService.getMe(req.user.userId);
    res.status(200).json({
      success: true,
      data: userProfile,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  login,
  refresh,
  logout,
  changePassword,
  me,
};
