import crypto from 'crypto';

/**
 * Middleware gắn mã vết yêu cầu (Correlation ID) cho mỗi HTTP request
 */
export function correlationId(req, res, next) {
  const headerId = req.headers['x-correlation-id'];
  const traceId = headerId || `req-${crypto.randomBytes(8).toString('hex')}`;
  
  req.correlationId = traceId;
  res.setHeader('X-Correlation-Id', traceId);
  next();
}

export default correlationId;
