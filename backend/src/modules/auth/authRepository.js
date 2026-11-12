import { query, withTransaction } from '../../utils/dbHelper.js';
import { UnauthorizedError } from '../../utils/errors.js';

/**
 * Tìm tài khoản theo Username hoặc Email
 */
export async function findUserByUsernameOrEmail(identifier) {
  const result = await query(
    `SELECT TOP (1) user_id AS "UserId", username AS "Username", email AS "Email", 
            password_hash AS "PasswordHash", display_name AS "DisplayName", 
            status AS "Status", must_change_password AS "MustChangePassword", 
            password_changed_at AS "PasswordChangedAt", last_login_at AS "LastLoginAt", 
            version AS "Version"
     FROM app.users
     WHERE username = $1 OR (lower(email) = lower($1) AND
       (SELECT count(*) FROM app.users u2 WHERE lower(u2.email)=lower($1)) = 1)
     ORDER BY CASE WHEN lower(email) = lower($1) THEN 1 ELSE 0 END DESC, CASE WHEN username = $1 THEN 1 ELSE 0 END DESC`,
    [identifier]
  );
  return result.rows[0] || null;
}

/**
 * Tìm tài khoản theo UserId
 */
export async function findUserById(userId) {
  const result = await query(
    `SELECT user_id AS "UserId", username AS "Username", email AS "Email", 
            password_hash AS "PasswordHash", display_name AS "DisplayName", 
            status AS "Status", must_change_password AS "MustChangePassword", 
            password_changed_at AS "PasswordChangedAt", last_login_at AS "LastLoginAt", 
            version AS "Version"
     FROM app.users
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Cập nhật thời điểm đăng nhập gần nhất
 */
export async function updateLastLogin(userId) {
  await query(
    `UPDATE app.users
     SET last_login_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
     WHERE user_id = $1`,
    [userId]
  );
}

/**
 * Cập nhật mật khẩu người dùng và tăng version (Optimistic Lock)
 */
export async function updatePassword(userId, passwordHash, client = null) {
  await query(
    `UPDATE app.users
     SET password_hash = $1,
         must_change_password = 0,
         password_changed_at = SYSUTCDATETIME(),
         updated_at = SYSUTCDATETIME(),
         version = version + 1
     WHERE user_id = $2`,
    [passwordHash, userId], client
  );
}

/**
 * Lấy danh sách Roles đang có hiệu lực của người dùng
 */
export async function getActiveRoles(userId) {
  const result = await query(
    `SELECT r.role_id AS "RoleId", r.code AS "Code", r.name AS "Name", r.description AS "Description"
     FROM app.user_roles ur
     INNER JOIN app.roles r ON ur.role_id = r.role_id
     WHERE ur.user_id = $1
       AND ur.revoked_at IS NULL
       AND r.is_active = 1
       AND ur.valid_from <= SYSUTCDATETIME()
       AND (ur.valid_to IS NULL OR ur.valid_to > SYSUTCDATETIME())`,
    [userId]
  );
  return result.rows;
}

/**
 * Lấy thông tin hồ sơ Giảng viên kèm Đơn vị chính
 */
export async function getLecturerProfile(userId) {
  const result = await query(
    `SELECT l.lecturer_id AS "LecturerId", l.employee_code AS "EmployeeCode", 
            l.full_name AS "FullName", l.email AS "Email", l.phone AS "Phone", 
            l.title AS "Title", l.degree AS "Degree",
            ou.unit_id AS "UnitId", ou.code AS "UnitCode", ou.name AS "UnitName",
            p.name AS "FacultyName"
     FROM app.lecturers l
     LEFT JOIN app.lecturer_assignments la 
       ON l.lecturer_id = la.lecturer_id 
       AND la.is_primary = 1 
       AND la.valid_from <= SYSUTCDATETIME() 
       AND (la.valid_to IS NULL OR la.valid_to >= SYSUTCDATETIME())
     LEFT JOIN app.organization_units ou ON la.unit_id = ou.unit_id
     LEFT JOIN app.organization_units p ON ou.parent_id = p.unit_id
     WHERE l.user_id = $1 AND l.is_active = 1`,
    [userId]
  );

  const row = result.rows[0];
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
    `SELECT s.user_unit_scope_id AS "UserUnitScopeId", r.code AS "RoleCode", 
            s.unit_id AS "UnitId", ou.code AS "UnitCode",
            ou.name AS "UnitName", ou.type AS "UnitType", 
            s.include_descendants AS "IncludeDescendants", 
            s.valid_from AS "ValidFrom", s.valid_to AS "ValidTo"
     FROM app.user_unit_scopes s
     INNER JOIN app.roles r ON s.role_id = r.role_id
     INNER JOIN app.organization_units ou ON s.unit_id = ou.unit_id
     WHERE s.user_id = $1
       AND s.revoked_at IS NULL AND r.is_active = 1 AND ou.is_active = 1
       AND EXISTS (SELECT 1 FROM app.user_roles ur WHERE ur.user_id=s.user_id AND ur.role_id=s.role_id
         AND ur.revoked_at IS NULL AND ur.valid_from <= SYSUTCDATETIME() AND (ur.valid_to IS NULL OR ur.valid_to > SYSUTCDATETIME()))
       AND s.valid_from <= SYSUTCDATETIME()
       AND (s.valid_to IS NULL OR s.valid_to > SYSUTCDATETIME())`,
    [userId]
  );

  return result.rows.map((row) => ({
    userUnitScopeId: row.UserUnitScopeId,
    roleCode: row.RoleCode,
    unitId: row.UnitId,
    unitCode: row.UnitCode,
    unitName: row.UnitName,
    unitType: row.UnitType,
    includeDescendants: Boolean(row.IncludeDescendants),
    validFrom: row.ValidFrom ? (row.ValidFrom instanceof Date ? row.ValidFrom.toISOString() : String(row.ValidFrom)) : null,
    validTo: row.ValidTo ? (row.ValidTo instanceof Date ? row.ValidTo.toISOString() : String(row.ValidTo)) : null,
  }));
}

/**
 * Tạo bản ghi Refresh Token mới
 */
export async function createRefreshToken({ userId, tokenHash, expiresAt, ip = null, userAgent = null }) {
  const result = await query(
    `INSERT INTO app.refresh_tokens (user_id, token_hash, expires_at, created_ip, user_agent)
     OUTPUT INSERTED.refresh_token_id AS "RefreshTokenId", INSERTED.created_at AS "CreatedAt" VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, ip, userAgent]
  );
  return result.rows[0];
}

/**
 * Tìm Refresh Token theo mã băm SHA-256
 */
export async function findRefreshTokenByHash(tokenHash) {
  const result = await query(
    `SELECT refresh_token_id AS "RefreshTokenId", user_id AS "UserId", 
            token_hash AS "TokenHash", expires_at AS "ExpiresAt", 
            revoked_at AS "RevokedAt", replaced_by_token_id AS "ReplacedByTokenId", 
            created_at AS "CreatedAt"
     FROM app.refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

/**
 * Xoay vòng Refresh Token (Token Rotation) trong Transaction dùng SQL Server BEGIN/COMMIT/ROLLBACK
 * Cấp token mới và thu hồi token cũ, liên kết replaced_by_token_id
 */
export async function rotateRefreshToken(oldTokenId, { userId, newTokenHash, newExpiresAt, ip = null, userAgent = null }) {
  return withTransaction(async ({ query: txQuery }) => {
    const consumed = await txQuery(`UPDATE app.refresh_tokens SET revoked_at=SYSUTCDATETIME()
      OUTPUT INSERTED.refresh_token_id WHERE refresh_token_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>SYSUTCDATETIME()`, [oldTokenId, userId]);
    if (!consumed.rowCount) throw new UnauthorizedError('Phiên đăng nhập đã được sử dụng hoặc hết hạn');
    // 1. Tạo Refresh Token mới
    const insertRes = await txQuery(
      `INSERT INTO app.refresh_tokens (user_id, token_hash, expires_at, created_ip, user_agent)
       OUTPUT INSERTED.refresh_token_id AS "RefreshTokenId", INSERTED.created_at AS "CreatedAt" VALUES ($1, $2, $3, $4, $5)`,
      [userId, newTokenHash, newExpiresAt, ip, userAgent]
    );
    const newTokenId = insertRes.rows[0].RefreshTokenId;

    // 2. Thu hồi token cũ và liên kết
    await txQuery(
      `UPDATE app.refresh_tokens
       SET revoked_at = SYSUTCDATETIME(), replaced_by_token_id = $1
       WHERE refresh_token_id = $2 AND user_id = $3`,
      [newTokenId, oldTokenId, userId]
    );

    return { newTokenId };
  });
}

/**
 * Thu hồi Refresh Token theo TokenHash
 */
export async function revokeRefreshTokenByHash(tokenHash) {
  const result = await query(
    `UPDATE app.refresh_tokens
     SET revoked_at = SYSUTCDATETIME()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
  return result.rowCount > 0;
}

/**
 * Thu hồi tất cả Refresh Token đang hoạt động của người dùng (khi đổi mật khẩu / phát hiện xâm phạm)
 */
export async function revokeAllUserTokens(userId, client = null) {
  const result = await query(
    `UPDATE app.refresh_tokens
     SET revoked_at = SYSUTCDATETIME()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId], client
  );
  return result.rowCount;
}

/**
 * Kiểm tra xem targetUnitId có nằm trong phạm vi được phân công của User hay không.
 * Nếu phạm vi có include_descendants = 1, sử dụng WITH ScopeHierarchy kiểm tra toàn bộ đơn vị con.
 * Lưu ý: Role ADMIN không tự động có quyền bypass phạm vi (ADMIN != MANAGER).
 */
export async function isUnitInUserScope(userId, targetUnitId, roleCode = null) {
  if (roleCode === 'UNIT_REPRESENTATIVE') {
    const result = await query(`SELECT 1 FROM app.unit_representatives rep
      JOIN app.users u ON u.user_id=rep.user_id AND u.status='ACTIVE'
      JOIN app.organization_units ou ON ou.unit_id=rep.unit_id AND ou.is_active=1
      WHERE rep.user_id=$1 AND rep.unit_id=$2 AND rep.revoked_at IS NULL
        AND rep.valid_from <= SYSUTCDATETIME() AND (rep.valid_to IS NULL OR rep.valid_to > SYSUTCDATETIME())
        AND EXISTS (SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.role_id=ur.role_id
          WHERE ur.user_id=rep.user_id AND r.code='UNIT_REPRESENTATIVE' AND r.is_active=1
            AND ur.revoked_at IS NULL AND ur.valid_from <= SYSUTCDATETIME() AND (ur.valid_to IS NULL OR ur.valid_to > SYSUTCDATETIME()))`, [userId,targetUnitId]);
    return result.rowCount > 0;
  }
  const result = await query(
    `WITH ScopeHierarchy AS (
         -- Điểm neo: Các đơn vị được gán scope trực tiếp
         SELECT s.unit_id, s.include_descendants
         FROM app.user_unit_scopes s
         INNER JOIN app.roles r ON s.role_id = r.role_id
         INNER JOIN app.users u ON u.user_id = s.user_id AND u.status = 'ACTIVE'
         INNER JOIN app.organization_units root ON root.unit_id = s.unit_id AND root.is_active = 1
         WHERE s.user_id = $1
           AND s.revoked_at IS NULL
           AND r.is_active = 1
           AND EXISTS (SELECT 1 FROM app.user_roles ur WHERE ur.user_id = s.user_id AND ur.role_id = s.role_id
             AND ur.revoked_at IS NULL AND ur.valid_from <= SYSUTCDATETIME() AND (ur.valid_to IS NULL OR ur.valid_to > SYSUTCDATETIME()))
           AND (CAST($2 AS nvarchar(100)) IS NULL OR r.code = $2)
           AND s.valid_from <= SYSUTCDATETIME()
           AND (s.valid_to IS NULL OR s.valid_to > SYSUTCDATETIME())

         UNION ALL

         -- Đệ quy: Mở rộng xuống các đơn vị con nếu include_descendants = 1
         SELECT ou.unit_id, h.include_descendants
         FROM app.organization_units ou
         INNER JOIN ScopeHierarchy h ON ou.parent_id = h.unit_id
         WHERE h.include_descendants = 1 AND ou.is_active = 1
     )
     SELECT TOP (1) 1 AS "HasScope"
     FROM ScopeHierarchy
     WHERE unit_id = $3
`,
    [userId, roleCode, targetUnitId]
  );

  return result.rows.length > 0 && result.rows[0].HasScope === 1;
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
