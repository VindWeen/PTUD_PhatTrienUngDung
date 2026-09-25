import {
  findUserByUsernameOrEmail,
  findUserById,
  updateLastLogin,
  updatePassword,
  getActiveRoles,
  getLecturerProfile,
  getActiveScopes,
  createRefreshToken,
  findRefreshTokenByHash,
  rotateRefreshToken,
  revokeRefreshTokenByHash,
  revokeAllUserTokens,
} from './authRepository.js';
import {
  hashPassword,
  comparePassword,
  generateRefreshTokenString,
  hashToken,
  generateAccessToken,
} from '../../utils/crypto.js';
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '../../utils/errors.js';

/**
 * Đăng nhập người dùng bằng Username/Email và Password
 */
export async function login({ username, password, rememberMe = false, ip = null, userAgent = null }) {
  if (!username || !password) {
    throw new ValidationError('Tên đăng nhập và mật khẩu không được để trống');
  }

  const user = await findUserByUsernameOrEmail(username.trim());
  if (!user) {
    throw new UnauthorizedError('Tài khoản hoặc mật khẩu không chính xác');
  }

  if (user.Status !== 'ACTIVE') {
    if (user.Status === 'LOCKED') {
      throw new UnauthorizedError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên');
    }
    throw new UnauthorizedError('Tài khoản chưa được kích hoạt hoặc đã ngưng hoạt động');
  }

  const isPasswordValid = await comparePassword(password, user.PasswordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Tài khoản hoặc mật khẩu không chính xác');
  }

  // Cập nhật LastLoginAt không đồng bộ để tối ưu hiệu năng
  updateLastLogin(user.UserId).catch((err) => {
    console.error(`Không thể cập nhật LastLoginAt cho user ${user.UserId}:`, err.message);
  });

  // Lấy Roles, LecturerProfile và Scopes có hiệu lực
  const [roles, lecturerProfile, scopes] = await Promise.all([
    getActiveRoles(user.UserId),
    getLecturerProfile(user.UserId),
    getActiveScopes(user.UserId),
  ]);

  // Tạo Refresh Token (64-byte random hex) và lưu mã băm SHA-256 vào DB
  const rawRefreshToken = generateRefreshTokenString();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresDays = rememberMe ? 30 : 7;
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  await createRefreshToken({
    userId: user.UserId,
    tokenHash,
    expiresAt,
    ip,
    userAgent,
  });

  // Tạo Access Token JWT (chứa userId, username, email và role codes)
  const roleCodes = roles.map((r) => r.Code);
  const accessToken = generateAccessToken({
    sub: String(user.UserId),
    userId: user.UserId,
    username: user.Username,
    email: user.Email,
    roles: roleCodes,
  });

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 7200,
    rawRefreshToken,
    rememberMe,
    user: {
      userId: user.UserId,
      username: user.Username,
      email: user.Email,
      displayName: user.DisplayName,
      status: user.Status,
      mustChangePassword: Boolean(user.MustChangePassword),
      roles: roles.map((r) => ({
        roleId: r.RoleId,
        code: r.Code,
        name: r.Name,
      })),
      lecturerProfile,
      scopes,
    },
  };
}

/**
 * Làm mới Access Token thông qua Refresh Token (Token Rotation)
 */
export async function refreshToken(rawRefreshToken, { ip = null, userAgent = null } = {}) {
  if (!rawRefreshToken) {
    throw new UnauthorizedError('Refresh Token không tồn tại hoặc đã bị thu hồi');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const existingToken = await findRefreshTokenByHash(tokenHash);

  if (!existingToken) {
    throw new UnauthorizedError('Phiên đăng nhập không hợp lệ hoặc đã bị thu hồi');
  }

  // Phát hiện tái sử dụng Token bị thu hồi (Token Reuse Detection) -> Thu hồi toàn bộ để bảo mật
  if (existingToken.RevokedAt) {
    await revokeAllUserTokens(existingToken.UserId);
    throw new UnauthorizedError('Phát hiện phiên đăng nhập đã bị thu hồi hoặc nghi vấn xâm phạm. Vui lòng đăng nhập lại');
  }

  // Kiểm tra thời hạn hết hạn
  if (new Date(existingToken.ExpiresAt) < new Date()) {
    throw new UnauthorizedError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
  }

  // Kiểm tra trạng thái tài khoản
  const user = await findUserById(existingToken.UserId);
  if (!user || user.Status !== 'ACTIVE') {
    throw new UnauthorizedError('Tài khoản không hợp lệ hoặc đã bị khóa');
  }

  // Xoay vòng Refresh Token (Token Rotation)
  const newRawRefreshToken = generateRefreshTokenString();
  const newTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await rotateRefreshToken(existingToken.RefreshTokenId, {
    userId: user.UserId,
    newTokenHash,
    newExpiresAt,
    ip,
    userAgent,
  });

  // Lấy roles mới nhất từ DB
  const roles = await getActiveRoles(user.UserId);
  const roleCodes = roles.map((r) => r.Code);

  const accessToken = generateAccessToken({
    sub: String(user.UserId),
    userId: user.UserId,
    username: user.Username,
    email: user.Email,
    roles: roleCodes,
  });

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 7200,
    newRawRefreshToken,
  };
}

/**
 * Đăng xuất: Thu hồi phiên Refresh Token hiện tại
 */
export async function logout(rawRefreshToken) {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await revokeRefreshTokenByHash(tokenHash);
  }
  return { success: true, message: 'Đăng xuất thành công' };
}

/**
 * Đổi mật khẩu người dùng và thu hồi tất cả các Refresh Token đang hoạt động
 */
export async function changePassword(userId, oldPassword, newPassword) {
  if (!oldPassword || !newPassword) {
    throw new ValidationError('Mật khẩu hiện tại và mật khẩu mới không được để trống');
  }

  if (newPassword.length < 8) {
    throw new ValidationError('Mật khẩu mới phải có tối thiểu 8 ký tự', {
      newPassword: 'Mật khẩu mới phải có tối thiểu 8 ký tự',
    });
  }

  if (oldPassword === newPassword) {
    throw new ValidationError('Mật khẩu mới không được trùng với mật khẩu cũ', {
      newPassword: 'Mật khẩu mới không được trùng với mật khẩu cũ',
    });
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError('Không tìm thấy tài khoản người dùng');
  }

  const isOldMatch = await comparePassword(oldPassword, user.PasswordHash);
  if (!isOldMatch) {
    throw new UnauthorizedError('Mật khẩu hiện tại không chính xác');
  }

  // Băm mật khẩu mới và cập nhật
  const newHash = await hashPassword(newPassword);
  await updatePassword(userId, newHash);

  // Thu hồi tất cả Refresh Token của người dùng này để buộc đăng nhập lại trên mọi thiết bị
  await revokeAllUserTokens(userId);

  return {
    success: true,
    message: 'Đổi mật khẩu thành công. Các phiên làm việc trước đã được thu hồi, vui lòng đăng nhập lại.',
  };
}

/**
 * Lấy thông tin tài khoản hiện tại (GET /auth/me)
 */
export async function getMe(userId) {
  const user = await findUserById(userId);
  if (!user || user.Status !== 'ACTIVE') {
    throw new UnauthorizedError('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa');
  }

  const [roles, lecturerProfile, scopes] = await Promise.all([
    getActiveRoles(user.UserId),
    getLecturerProfile(user.UserId),
    getActiveScopes(user.UserId),
  ]);

  return {
    userId: user.UserId,
    username: user.Username,
    email: user.Email,
    displayName: user.DisplayName,
    status: user.Status,
    mustChangePassword: Boolean(user.MustChangePassword),
    roles: roles.map((r) => ({
      roleId: r.RoleId,
      code: r.Code,
      name: r.Name,
    })),
    lecturerProfile,
    scopes,
  };
}

export default {
  login,
  refreshToken,
  logout,
  changePassword,
  getMe,
};
