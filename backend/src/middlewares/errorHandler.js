import { AppError } from '../utils/errors.js';
import { ZodError } from 'zod';

/**
 * Middleware xử lý lỗi tập trung tuân thủ hợp đồng dữ liệu chuẩn hóa W1-Q1
 */
export function errorHandler(err, req, res, next) {
  const correlationId = req.correlationId || 'unknown';
  const timestamp = new Date().toISOString();

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'Đã xảy ra lỗi nội bộ máy chủ. Vui lòng thử lại sau.';
  let fieldErrors = null;
  let details = [];

  // 1. Lỗi do ứng dụng định nghĩa (AppError)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    fieldErrors = err.fieldErrors;
    details = err.details || [];
  } 
  // 2. Lỗi Schema Validation của Zod
  else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Dữ liệu yêu cầu không hợp lệ. Vui lòng kiểm tra lại các trường thông tin.';
    fieldErrors = {};
    err.errors.forEach((e) => {
      const field = e.path.join('.');
      fieldErrors[field] = e.message;
    });
  } 
  // 3. Lỗi từ Microsoft SQL Server Driver
  else if (err && err.number) {
    // 2601 / 2627: Unique constraint hoặc Filtered unique index violation
    if (err.number === 2601 || err.number === 2627) {
      statusCode = 409;
      code = 'DUPLICATE_RECORD';
      message = 'Bản ghi bị trùng lặp dữ liệu với một bản ghi đã tồn tại trong hệ thống.';
      details = [{ sqlErrorNumber: err.number, message: err.message }];
    } 
    // 547: Check constraint hoặc Foreign Key violation
    else if (err.number === 547) {
      statusCode = 400;
      code = 'CONSTRAINT_VIOLATION';
      message = 'Thao tác vi phạm ràng buộc toàn vẹn dữ liệu (Chủ thể XOR, ngày tháng hoặc liên kết không hợp lệ).';
      details = [{ sqlErrorNumber: err.number, message: err.message }];
    }
  }

  // Ghi log lỗi máy chủ phục vụ debug
  if (statusCode >= 500) {
    console.error(`[${correlationId}] ❌ Server Error:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
      details,
      timestamp,
      correlationId,
    },
  });
}

export default errorHandler;
