import { NotFoundError } from '../utils/errors.js';

/**
 * Middleware bắt các đường dẫn không tồn tại (404)
 */
export function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Đường dẫn API '${req.method} ${req.originalUrl}' không tồn tại trên hệ thống.`));
}

export default notFoundHandler;
