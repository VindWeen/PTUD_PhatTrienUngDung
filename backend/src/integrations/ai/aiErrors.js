import { AppError } from '../../utils/errors.js';

export class AiError extends AppError {
  constructor(message, statusCode = 500, code = 'AI_ERROR', details = []) {
    super(message, statusCode, code, details);
    this.name = 'AiError';
  }
}

export class AiTimeoutError extends AiError {
  constructor(timeoutMs) {
    super(
      `Yêu cầu AI vượt quá thời gian chờ quy định (${timeoutMs}ms)`,
      504,
      'AI_REQUEST_TIMEOUT'
    );
    this.name = 'AiTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class AiRateLimitError extends AiError {
  constructor(retryAfterSeconds = 60, details = []) {
    super(
      `Hạn ngạch gọi AI API bị vượt ngưỡng (429 Rate Limit). Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
      429,
      'AI_RATE_LIMIT_EXCEEDED',
      details
    );
    this.name = 'AiRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AiProviderUnavailableError extends AiError {
  constructor(providerName, message = 'Dịch vụ AI hiện không khả dụng') {
    super(
      `Nhà cung cấp AI [${providerName}]: ${message}`,
      503,
      'AI_PROVIDER_UNAVAILABLE'
    );
    this.name = 'AiProviderUnavailableError';
    this.providerName = providerName;
  }
}

export class AiInvalidModelError extends AiError {
  constructor(modelName) {
    super(
      `Mô hình [${modelName}] không nằm trong danh mục Free Tier được tài khoản hỗ trợ. Nghiêm cấm chuyển sang model trả phí.`,
      400,
      'AI_INVALID_FREE_MODEL'
    );
    this.name = 'AiInvalidModelError';
    this.modelName = modelName;
  }
}
