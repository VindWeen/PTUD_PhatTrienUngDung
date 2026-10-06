import { AiInvalidModelError } from './aiErrors.js';

// Danh sách mô hình Free Tier được kiểm duyệt và hỗ trợ
export const ALLOWED_FREE_MODELS = {
  groq: [
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
  ],
  openrouter: [
    'meta-llama/llama-3.2-3b-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'google/gemini-flash-1.5-exp:free',
    'mistralai/mistral-7b-instruct:free',
  ],
};

/**
 * Kiểm tra mô hình có thuộc Free Tier được phê duyệt hay không.
 * Nghiêm cấm tự ý sử dụng hoặc chuyển sang model trả phí.
 */
export function validateFreeModel(provider, model) {
  if (provider === 'mock') return true;

  if (provider === 'groq') {
    const isAllowed = ALLOWED_FREE_MODELS.groq.includes(model);
    if (!isAllowed) {
      throw new AiInvalidModelError(model);
    }
    return true;
  }

  if (provider === 'openrouter') {
    const isExplicitlyAllowed = ALLOWED_FREE_MODELS.openrouter.includes(model);
    const hasFreeSuffix = typeof model === 'string' && model.endsWith(':free');
    if (!isExplicitlyAllowed && !hasFreeSuffix) {
      throw new AiInvalidModelError(model);
    }
    return true;
  }

  return true;
}

/**
 * Lớp trừu tượng định nghĩa Interface chuẩn cho mọi AI Provider
 */
export class AiProvider {
  constructor(name) {
    if (this.constructor === AiProvider) {
      throw new Error('AiProvider là lớp trừu tượng và không thể khởi tạo trực tiếp.');
    }
    this.name = name;
  }

  /**
   * Gọi hoàn thành văn bản (completion)
   * @param {Object} options
   * @param {string} options.prompt - Nội dung truy vấn
   * @param {string} [options.systemPrompt] - Chỉ thị ngữ cảnh hệ thống
   * @param {string} [options.model] - Tên mô hình free
   * @param {number} [options.temperature]
   * @param {number} [options.maxTokens]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ content: string, model: string, provider: string, usage: object, timestamp: string, latencyMs: number }>}
   */
  async complete(options) {
    throw new Error('Phương thức complete() bắt buộc phải được triển khai.');
  }
}
