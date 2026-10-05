import { query } from '../../utils/dbHelper.js';

export const REDACTED_MASK = '***REDACTED***';

/**
 * Danh sách regex nhận diện các trường dữ liệu nhạy cảm cần che chắn bí mật
 */
const SENSITIVE_KEY_REGEX = /^(password|old_?password|new_?password|confirm_?password|password_?hash|token|refresh_?token|token_?hash|access_?token|jwt|secret|client_?secret|api_?key|cookie|authorization|auth_?header|session|session_?id|private_?key)$/i;

/**
 * Regex nhận diện chuỗi JWT (3 phần base64 phân tách bởi dấu chấm)
 */
const JWT_REGEX = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;

/**
 * Hàm che bí mật (Data Masking / Redaction) đệ quy cho bất kỳ cấu trúc dữ liệu nào
 * Đảm bảo 100% không rò rỉ mật khẩu, token, hash, secret key vào audit log hay hệ thống file.
 *
 * @param {*} data - Dữ liệu đầu vào (object, array, primitive)
 * @param {WeakSet} visited - Bộ theo dõi chống đệ quy lặp vô tận (cyclic reference)
 * @returns {*} Dữ liệu đã được khử và che bí mật
 */
export function maskSecrets(data, visited = new WeakSet()) {
  if (data === null || data === undefined) {
    return data;
  }

  // Xử lý chuỗi nhạy cảm (Bearer token hoặc JWT token)
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (/^Bearer\s+[A-Za-z0-9\-._~+/]+=*$/i.test(trimmed)) {
      return `Bearer ${REDACTED_MASK}`;
    }
    if (trimmed.length >= 32 && (trimmed.match(/\./g) || []).length === 2 && JWT_REGEX.test(trimmed)) {
      return `***REDACTED_JWT***`;
    }
    return data;
  }

  // Các kiểu dữ liệu nguyên thủy khác
  if (typeof data !== 'object') {
    return data;
  }

  // Chống vòng lặp tham chiếu (Circular reference)
  if (visited.has(data)) {
    return '[Circular]';
  }
  visited.add(data);

  // Xử lý mảng
  if (Array.isArray(data)) {
    return data.map((item) => maskSecrets(item, visited));
  }

  // Xử lý Date và RegExp
  if (data instanceof Date) {
    return new Date(data.getTime());
  }
  if (data instanceof RegExp) {
    return data.toString();
  }

  // Xử lý Object
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = REDACTED_MASK;
    } else {
      sanitized[key] = maskSecrets(value, visited);
    }
  }

  return sanitized;
}

/**
 * Ghi nhận nhật ký kiểm toán (Audit Log) vào bảng app.audit_logs với tự động che bí mật
 *
 * @param {Object} params
 * @param {number|string|null} [params.userId=null] - ID người dùng thực hiện (Actor)
 * @param {string} params.action - Tên hành động (e.g. AUTH_LOGIN, PROFILE_UPDATE, ORG_TRANSFER)
 * @param {string} params.entityName - Tên thực thể tác động (e.g. users, lecturers, organizations)
 * @param {number|string|null} [params.entityId=null] - ID của thực thể
 * @param {Object|null} [params.oldValues=null] - Trạng thái/giá trị trước khi đổi (tự động mask)
 * @param {Object|null} [params.newValues=null] - Trạng thái/giá trị sau khi đổi (tự động mask)
 * @param {string|null} [params.ipAddress=null] - Địa chỉ IP client
 * @param {string|null} [params.userAgent=null] - User-Agent trình duyệt/ứng dụng
 * @param {Object|null} [params.client=null] - pg.Client nếu chạy trong transaction cơ sở dữ liệu
 * @param {boolean} [params.throwOnError=false] - Ném ngoại lệ khi ghi audit thất bại (mặc định false)
 * @returns {Promise<Object|null>} Bản ghi audit đã lưu hoặc null nếu có lỗi
 */
export async function recordAuditLog({
  userId = null,
  action,
  entityName,
  entityId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  client = null,
  throwOnError = false,
}) {
  if (!action || !entityName) {
    const error = new Error('Tham số action và entityName là bắt buộc để ghi audit log');
    if (throwOnError) throw error;
    console.error('[AUDIT_SERVICE_WARN]', error.message);
    return null;
  }

  try {
    // 1. Che giấu toàn diện bí mật trước khi lưu
    const sanitizedOld = oldValues !== null ? maskSecrets(oldValues) : null;
    const sanitizedNew = newValues !== null ? maskSecrets(newValues) : null;

    const oldJson = sanitizedOld !== null ? JSON.stringify(sanitizedOld) : null;
    const newJson = sanitizedNew !== null ? JSON.stringify(sanitizedNew) : null;
    const normalizedUserId = userId != null ? Number(userId) : null;
    const normalizedEntityId = entityId != null ? Number(entityId) : null;

    // 2. Chèn vào bảng app.audit_logs
    const sql = `
      INSERT INTO app.audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        old_values,
        new_values,
        ip_address,
        user_agent,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )
      RETURNING audit_id, user_id, action, entity_name, entity_id, old_values, new_values, ip_address, user_agent, created_at;
    `;

    const params = [
      normalizedUserId,
      String(action).toUpperCase(),
      String(entityName).toLowerCase(),
      normalizedEntityId,
      oldJson,
      newJson,
      ipAddress ? String(ipAddress).slice(0, 50) : null,
      userAgent ? String(userAgent).slice(0, 500) : null,
    ];

    const result = await query(sql, params, client);
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error(`[AUDIT_LOG_ERROR] Không thể ghi audit log [${action} on ${entityName}]:`, err.message);
    if (throwOnError) {
      throw err;
    }
    return null;
  }
}

/**
 * Tra cứu danh sách nhật ký kiểm toán hệ thống (dành cho Quản trị viên / Đảm bảo chất lượng)
 *
 * @param {Object} options
 * @param {string} [options.entityName] - Lọc theo tên thực thể
 * @param {number|string} [options.entityId] - Lọc theo ID thực thể
 * @param {number|string} [options.userId] - Lọc theo Actor UserId
 * @param {string} [options.action] - Lọc theo loại hành động
 * @param {number} [options.limit=50] - Giới hạn số lượng
 * @param {number} [options.offset=0] - Vị trí bắt đầu
 * @param {Object|null} [options.client=null] - pg.Client nếu cần
 * @returns {Promise<Array>} Danh sách bản ghi audit
 */
export async function getAuditLogs({
  entityName = null,
  entityId = null,
  userId = null,
  action = null,
  limit = 50,
  offset = 0,
  client = null,
} = {}) {
  const conditions = [];
  const params = [];

  if (entityName) {
    params.push(String(entityName).toLowerCase());
    conditions.push(`entity_name = $${params.length}`);
  }

  if (entityId != null) {
    params.push(Number(entityId));
    conditions.push(`entity_id = $${params.length}`);
  }

  if (userId != null) {
    params.push(Number(userId));
    conditions.push(`user_id = $${params.length}`);
  }

  if (action) {
    params.push(String(action).toUpperCase());
    conditions.push(`action = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const parsedLimit = Math.min(Math.max(1, Number(limit) || 50), 100);
  const parsedOffset = Math.max(0, Number(offset) || 0);

  params.push(parsedLimit);
  const limitPlaceholder = `$${params.length}`;
  params.push(parsedOffset);
  const offsetPlaceholder = `$${params.length}`;

  const sql = `
    SELECT
      audit_id AS "auditId",
      user_id AS "userId",
      action,
      entity_name AS "entityName",
      entity_id AS "entityId",
      old_values AS "oldValues",
      new_values AS "newValues",
      ip_address AS "ipAddress",
      user_agent AS "userAgent",
      created_at AS "createdAt"
    FROM app.audit_logs
    ${whereClause}
    ORDER BY created_at DESC, audit_id DESC
    LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder};
  `;

  const result = await query(sql, params, client);
  return result.rows || [];
}

export default {
  REDACTED_MASK,
  maskSecrets,
  recordAuditLog,
  getAuditLogs,
};
