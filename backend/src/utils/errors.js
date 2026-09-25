/**
 * Lớp lỗi ứng dụng cơ sở (Base Application Error)
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = [], fieldErrors = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.fieldErrors = fieldErrors;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 - Dữ liệu yêu cầu không hợp lệ
 */
export class ValidationError extends AppError {
  constructor(message = 'Dữ liệu yêu cầu không hợp lệ', fieldErrors = {}, details = []) {
    super(message, 400, 'VALIDATION_ERROR', details, fieldErrors);
  }
}

/**
 * 401 - Chưa xác thực danh tính
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn', details = []) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

/**
 * 403 - Thiếu quyền truy cập
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Bạn không có quyền thực hiện hành động này', code = 'FORBIDDEN', details = []) {
    super(message, 403, code, details);
  }
}

/**
 * 403 - Vi phạm quy tắc CẤM TỰ DUYỆT
 */
export class SelfApprovalError extends ForbiddenError {
  constructor(message = 'Quy tắc liêm chính: Cán bộ thẩm định không được phép tự duyệt hồ sơ do chính mình tạo, nộp hoặc là chủ thể', details = []) {
    super(message, 'SELF_APPROVAL_PROHIBITED', details);
  }
}

/**
 * 403 - Vi phạm phân công phạm vi (Ngoài Scope đơn vị)
 */
export class OutOfScopeError extends ForbiddenError {
  constructor(message = 'Hồ sơ nằm ngoài phạm vi đơn vị được phân công quản lý của bạn', details = []) {
    super(message, 'OUT_OF_SCOPE', details);
  }
}

/**
 * 404 - Không tìm thấy tài nguyên
 */
export class NotFoundError extends AppError {
  constructor(message = 'Không tìm thấy tài nguyên yêu cầu', details = []) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

/**
 * 409 - Xung đột phiên bản RowVersion (Optimistic Concurrency Control)
 */
export class ConcurrencyConflictError extends AppError {
  constructor(message = 'Dữ liệu đã được cập nhật bởi một phiên thao tác khác. Vui lòng làm mới dữ liệu mới nhất.', details = []) {
    super(message, 409, 'CONCURRENCY_CONFLICT', details);
  }
}

/**
 * 409 - Chuyển trạng thái workflow không hợp lệ
 */
export class InvalidStateTransitionError extends AppError {
  constructor(message = 'Hành động không hợp lệ đối với trạng thái hiện tại của hồ sơ', details = []) {
    super(message, 409, 'INVALID_STATE_TRANSITION', details);
  }
}
