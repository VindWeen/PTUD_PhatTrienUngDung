import { query, withTransaction } from '../../utils/dbHelper.js';

/**
 * Tìm tài khoản theo Username hoặc Email
 */
export async function findUserByUsernameOrEmail(identifier) {
  const result = await query(
    `SELECT UserId, Username, Email, PasswordHash, DisplayName, Status, MustChangePassword, PasswordChangedAt, LastLoginAt, RowVersion
     FROM dbo.Users
     WHERE (Username = @identifier OR Email = @identifier)`,
    { identifier }
  );
  return result.recordset[0] || null;
}

/**
 * Tìm tài khoản theo UserId
 */
export async function findUserById(userId) {
  const result = await query(
    `SELECT UserId, Username, Email, PasswordHash, DisplayName, Status, MustChangePassword, PasswordChangedAt, LastLoginAt, RowVersion
     FROM dbo.Users
     WHERE UserId = @userId`,
    { userId }
  );
  return result.recordset[0] || null;
}

/**
 * Cập nhật thời điểm đăng nhập gần nhất
 */
export async function updateLastLogin(userId) {
  await query(
    `UPDATE dbo.Users
     SET LastLoginAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
     WHERE UserId = @userId`,
    { userId }
  );
}

/**
 * Cập nhật mật khẩu người dùng
 */
export async function updatePassword(userId, passwordHash) {
  await query(
    `UPDATE dbo.Users
     SET PasswordHash = @passwordHash,
         MustChangePassword = 0,
         PasswordChangedAt = SYSUTCDATETIME(),
         UpdatedAt = SYSUTCDATETIME()
     WHERE UserId = @userId`,
    { userId, passwordHash }
  );
}

/**
 * Lấy danh sách Roles đang có hiệu lực của người dùng
 */
export async function getActiveRoles(userId) {
  const result = await query(
    `SELECT r.RoleId, r.Code, r.Name, r.Description
     FROM dbo.UserRoles ur
     INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId
     WHERE ur.UserId = @userId
       AND r.IsActive = 1
       AND ur.ValidFrom <= SYSUTCDATETIME()
       AND (ur.ValidTo IS NULL OR ur.ValidTo >= SYSUTCDATETIME())`,
    { userId }
  );
  return result.recordset;
}

/**
 * Lấy thông tin hồ sơ Giảng viên kèm Đơn vị chính
 */
export async function getLecturerProfile(userId) {
  const result = await query(
    `SELECT l.LecturerId, l.EmployeeCode, l.FullName, l.Email, l.Phone, l.Title, l.Degree,
            ou.UnitId, ou.Code AS UnitCode, ou.Name AS UnitName,
            p.Name AS FacultyName
     FROM dbo.Lecturers l
     LEFT JOIN dbo.LecturerAssignments la ON l.LecturerId = la.LecturerId AND la.IsPrimary = 1 AND la.ValidFrom <= SYSUTCDATETIME() AND (la.ValidTo IS NULL OR la.ValidTo >= SYSUTCDATETIME())
     LEFT JOIN dbo.OrganizationUnits ou ON la.UnitId = ou.UnitId
     LEFT JOIN dbo.OrganizationUnits p ON ou.ParentId = p.UnitId
     WHERE l.UserId = @userId AND l.IsActive = 1`,
    { userId }
  );

  const row = result.recordset[0];
  if (!row) return null;

  return {
    lecturerId: row.LecturerId,
    employeeCode: row.EmployeeCode,
    fullName: row.FullName,
    title: row.Title,
    degree: row.Degree,
    primaryUnit: row.UnitId
      ? {
          unitId: row.UnitId,
          code: row.UnitCode,
          name: row.UnitName,
          facultyName: row.FacultyName || row.UnitName,
        }
      : null,
  };
}

/**
 * Lấy danh sách Phạm vi Quản lý (Scopes) đang có hiệu lực của người dùng
 */
export async function getActiveScopes(userId) {
  const result = await query(
    `SELECT s.UserUnitScopeId, r.Code AS RoleCode, s.UnitId, ou.Code AS UnitCode,
            ou.Name AS UnitName, ou.Type AS UnitType, s.IncludeDescendants, s.ValidFrom, s.ValidTo
     FROM dbo.UserUnitScopes s
     INNER JOIN dbo.Roles r ON s.RoleId = r.RoleId
     INNER JOIN dbo.OrganizationUnits ou ON s.UnitId = ou.UnitId
     WHERE s.UserId = @userId
       AND s.ValidFrom <= SYSUTCDATETIME()
       AND (s.ValidTo IS NULL OR s.ValidTo >= SYSUTCDATETIME())`,
    { userId }
  );

  return result.recordset.map((row) => ({
    userUnitScopeId: row.UserUnitScopeId,
    roleCode: row.RoleCode,
    unitId: row.UnitId,
    unitCode: row.UnitCode,
    unitName: row.UnitName,
    unitType: row.UnitType,
    includeDescendants: Boolean(row.IncludeDescendants),
    validFrom: row.ValidFrom ? row.ValidFrom.toISOString() : null,
    validTo: row.ValidTo ? row.ValidTo.toISOString() : null,
  }));
}

/**
 * Tạo bản ghi Refresh Token mới
 */
export async function createRefreshToken({ userId, tokenHash, expiresAt, ip = null, userAgent = null }) {
  const result = await query(
    `INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt, CreatedIp, UserAgent)
     OUTPUT INSERTED.RefreshTokenId, INSERTED.CreatedAt
     VALUES (@userId, @tokenHash, @expiresAt, @ip, @userAgent)`,
    { userId, tokenHash, expiresAt, ip, userAgent }
  );
  return result.recordset[0];
}

/**
 * Tìm Refresh Token theo mã băm SHA-256
 */
export async function findRefreshTokenByHash(tokenHash) {
  const result = await query(
    `SELECT RefreshTokenId, UserId, TokenHash, ExpiresAt, RevokedAt, ReplacedByTokenId, CreatedAt
     FROM dbo.RefreshTokens
     WHERE TokenHash = @tokenHash`,
    { tokenHash }
  );
  return result.recordset[0] || null;
}

/**
 * Xoay vòng Refresh Token (Token Rotation) trong Transaction:
 * Cấp token mới và thu hồi token cũ, liên kết ReplacedByTokenId
 */
export async function rotateRefreshToken(oldTokenId, { userId, newTokenHash, newExpiresAt, ip = null, userAgent = null }) {
  return withTransaction(async ({ request, query: txQuery }) => {
    // 1. Tạo Refresh Token mới
    const insertRes = await txQuery(
      `INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt, CreatedIp, UserAgent)
       OUTPUT INSERTED.RefreshTokenId, INSERTED.CreatedAt
       VALUES (@userId, @newTokenHash, @newExpiresAt, @ip, @userAgent)`,
      { userId, newTokenHash, newExpiresAt, ip, userAgent }
    );
    const newTokenId = insertRes.recordset[0].RefreshTokenId;

    // 2. Thu hồi token cũ và liên kết
    await txQuery(
      `UPDATE dbo.RefreshTokens
       SET RevokedAt = SYSUTCDATETIME(), ReplacedByTokenId = @newTokenId
       WHERE RefreshTokenId = @oldTokenId`,
      { newTokenId, oldTokenId }
    );

    return { newTokenId };
  });
}

/**
 * Thu hồi Refresh Token theo TokenHash
 */
export async function revokeRefreshTokenByHash(tokenHash) {
  const result = await query(
    `UPDATE dbo.RefreshTokens
     SET RevokedAt = SYSUTCDATETIME()
     WHERE TokenHash = @tokenHash AND RevokedAt IS NULL`,
    { tokenHash }
  );
  return result.rowsAffected[0] > 0;
}

/**
 * Thu hồi tất cả Refresh Token đang hoạt động của người dùng (khi đổi mật khẩu / phát hiện xâm phạm)
 */
export async function revokeAllUserTokens(userId) {
  const result = await query(
    `UPDATE dbo.RefreshTokens
     SET RevokedAt = SYSUTCDATETIME()
     WHERE UserId = @userId AND RevokedAt IS NULL`,
    { userId }
  );
  return result.rowsAffected[0];
}

/**
 * Kiểm tra xem targetUnitId có nằm trong phạm vi được phân công của User hay không.
 * Nếu phạm vi có IncludeDescendants = 1, sử dụng CTE đệ quy kiểm tra toàn bộ đơn vị con.
 * Lưu ý: Role ADMIN không tự động có quyền bypass phạm vi (ADMIN != MANAGER).
 */
export async function isUnitInUserScope(userId, targetUnitId, roleCode = null) {
  const result = await query(
    `WITH ScopeHierarchy AS (
         -- Điểm neo: Các đơn vị được gán scope trực tiếp
         SELECT s.UnitId, s.IncludeDescendants
         FROM dbo.UserUnitScopes s
         INNER JOIN dbo.Roles r ON s.RoleId = r.RoleId
         WHERE s.UserId = @userId
           AND (@roleCode IS NULL OR r.Code = @roleCode)
           AND s.ValidFrom <= SYSUTCDATETIME()
           AND (s.ValidTo IS NULL OR s.ValidTo >= SYSUTCDATETIME())

         UNION ALL

         -- Đệ quy: Mở rộng xuống các đơn vị con nếu IncludeDescendants = 1
         SELECT ou.UnitId, h.IncludeDescendants
         FROM dbo.OrganizationUnits ou
         INNER JOIN ScopeHierarchy h ON ou.ParentId = h.UnitId
         WHERE h.IncludeDescendants = 1 AND ou.IsActive = 1
     )
     SELECT TOP 1 1 AS HasScope
     FROM ScopeHierarchy
     WHERE UnitId = @targetUnitId`,
    { userId, targetUnitId, roleCode }
  );

  return result.recordset.length > 0 && result.recordset[0].HasScope === 1;
}

export default {
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
  isUnitInUserScope,
};
