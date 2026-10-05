export class ApiError extends Error {
  constructor({ message, code = 'UNKNOWN_ERROR', status = 0, fieldErrors = null, details = null, correlationId = null } = {}) {
    super(message || 'Không thể xử lý yêu cầu.');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.details = details;
    this.correlationId = correlationId;
  }
}

export function normalizeApiError(error) {
  if (error instanceof ApiError) return error;
  const body = error?.response?.data;
  const payload = body?.error || body || error || {};
  return new ApiError({
    message: payload.message || (error?.request ? 'Không thể kết nối máy chủ.' : 'Đã xảy ra lỗi không xác định.'),
    code: payload.code || (error?.request ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR'),
    status: error?.response?.status || payload.status || 0,
    fieldErrors: payload.fieldErrors || null,
    details: payload.details || null,
    correlationId: payload.correlationId || null,
  });
}

