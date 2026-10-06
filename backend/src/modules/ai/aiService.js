import config from '../../config/env.js';
import { GroqProvider } from './providers/groqProvider.js';
import { OpenRouterProvider } from './providers/openrouterProvider.js';
import { MockAiProvider } from './providers/mockProvider.js';
import { validateFreeModel } from './aiProviderInterface.js';
import aiCache from './aiCache.js';
import { AiRateLimitError, AiTimeoutError } from './aiErrors.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import * as regulationRepo from '../regulations/regulationRepository.js';
import * as achievementRepo from '../achievements/achievementRepository.js';

export class AiService {
  constructor(options = {}) {
    this.providerName = options.providerName || config.AI_PROVIDER;
    this.groqProvider = new GroqProvider(options.groqApiKey || config.GROQ_API_KEY, options.groqModel || config.GROQ_MODEL);
    this.openrouterProvider = new OpenRouterProvider(options.openrouterApiKey || config.OPENROUTER_API_KEY, options.openrouterModel || config.OPENROUTER_MODEL);
    this.mockProvider = new MockAiProvider(options.mockModel || 'mock-lhu-ai');
  }

  getProvider(forcedProvider) {
    const target = forcedProvider || this.providerName;
    if (target === 'groq') {
      if (this.groqProvider.apiKey) return this.groqProvider;
      console.warn('⚠️ GROQ_API_KEY chưa cấu hình, fallback sang MockAiProvider cho môi trường kiểm thử');
      return this.mockProvider;
    }
    if (target === 'openrouter') {
      if (this.openrouterProvider.apiKey) return this.openrouterProvider;
      console.warn('⚠️ OPENROUTER_API_KEY chưa cấu hình, fallback sang MockAiProvider cho môi trường kiểm thử');
      return this.mockProvider;
    }
    return this.mockProvider;
  }

  async completeWithRetry({ prompt, systemPrompt, model, forcedProvider, chunkHash = '', version = '1.0' }) {
    const targetProvider = forcedProvider || this.providerName;
    if (model) {
      validateFreeModel(targetProvider, model);
    }
    const provider = this.getProvider(forcedProvider);
    const cacheKey = aiCache.generateKey({
      model: model || provider.defaultModel,
      prompt,
      systemPrompt,
      chunkHash,
      version,
    });

    // 1. Kiểm tra Cache
    const cached = aiCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Gọi Provider có giới hạn số lần retry
    let lastError = null;
    const maxRetries = config.AI_MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.AI_TIMEOUT_MS);

        try {
          const result = await provider.complete({
            prompt,
            systemPrompt,
            model,
            signal: controller.signal,
          });

          // Lưu cache nếu thành công
          aiCache.set(cacheKey, result);
          return { ...result, cached: false };
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        lastError = err;
        // Nếu là Rate Limit (429) hoặc Timeout, không spam retry vô ích
        if (err.name === 'AiRateLimitError') {
          throw err;
        }
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Không thể hoàn thành yêu cầu gọi AI');
  }

  /**
   * Smoke test: Gọi model AI trả lời câu hỏi dựa trên đoạn trích dẫn (Chunk) quy định thực tế
   */
  async executeSmokeTest({ chunkId, question, provider: forcedProvider, model }) {
    if (!chunkId) {
      throw new ValidationError('Mã trích đoạn (chunkId) là bắt buộc cho smoke test');
    }

    const chunk = await regulationRepo.findChunkById(null, chunkId);
    if (!chunk) {
      throw new NotFoundError(`Không tìm thấy trích đoạn quy định với ID #${chunkId}`);
    }

    const systemPrompt = `Bạn là trợ lý AI chuyên môn của Hội đồng Thi đua - Khen thưởng Trường Đại học Lạc Hồng.
Nhiệm vụ của bạn là trả lời các câu hỏi dựa CHÍNH XÁC trên đoạn trích dẫn quy phạm pháp luật / quy chế sau đây.
Không được bịa đặt hoặc suy diễn vượt quá nội dung trích đoạn.`;

    const prompt = `[TRÍCH ĐOẠN QUY ĐỊNH]
Điều/Khoản: ${chunk.article_no || ''} ${chunk.clause_no || ''} (Trang ${chunk.page_no || 'N/A'})
Nội dung: """${chunk.content}"""
Mã băm toàn vẹn: ${chunk.chunk_hash}

[CÂU HỎI KIỂM THỬ]
${question || 'Tóm tắt các điểm then chốt trong trích đoạn trên và đối tượng áp dụng là ai?'}`;

    const completion = await this.completeWithRetry({
      prompt,
      systemPrompt,
      model,
      forcedProvider,
      chunkHash: chunk.chunk_hash,
      version: 'smoke-test-v1',
    });

    return {
      success: true,
      chunkId,
      articleNo: chunk.article_no,
      clauseNo: chunk.clause_no,
      chunkHash: chunk.chunk_hash,
      question: question || 'Tóm tắt các điểm then chốt trong trích đoạn trên',
      aiResponse: completion.content,
      model: completion.model,
      provider: completion.provider,
      isMock: Boolean(completion.isMock),
      usage: completion.usage,
      latencyMs: completion.latencyMs,
      timestamp: completion.timestamp,
      cached: Boolean(completion.cached),
    };
  }

  /**
   * Đánh giá tiêu chí khen thưởng dựa trên hồ sơ thành tích và quy chế
   */
  async evaluateCriterion({ criterionId, achievementId, forcedProvider, model }) {
    const criterion = await regulationRepo.findCriteriaVersionById(null, criterionId);
    if (!criterion) {
      throw new NotFoundError(`Không tìm thấy tiêu chí khen thưởng với ID #${criterionId}`);
    }

    let achievement = null;
    if (achievementId) {
      achievement = await achievementRepo.findAchievementById(null, achievementId);
    }

    // Fail-Closed Gatekeeper Check
    const isUnconfirmed = !criterion.is_confirmed;
    const warningNotice = isUnconfirmed
      ? 'CẢNH BÁO: Tiêu chuẩn này chưa được Hội đồng LHU phê duyệt chính thức (UNCONFIRMED / SIMULATION). Kết quả chỉ mang tính tham khảo mô phỏng.'
      : null;

    const systemPrompt = `Bạn là chuyên gia thẩm định hồ sơ thi đua khen thưởng độc lập.
Đối chiếu thành tích với tiêu chuẩn được giao và trích xuất kết quả dưới dạng nhận định khách quan.`;

    const prompt = `[TIÊU CHUẨN THẨM ĐỊNH]
Mã tiêu chí: ${criterion.criterion_code}
Tên tiêu chí: ${criterion.name}
Đối tượng: ${criterion.target_type}
Ngưỡng tối thiểu: ${criterion.min_threshold ?? 'Không quy định'} ${criterion.unit_metric || ''}
Căn cứ pháp lý: ${criterion.legal_references || 'Không có'}
Trạng thái duyệt LHU: ${criterion.is_confirmed ? 'ĐÃ PHÊ DUYỆT CHÍNH THỨC' : 'CHƯA DUYỆT / MÔ PHỎNG'}

[HỒ SƠ THÀNH TÍCH ĐỐI CHIẾU]
${achievement ? `Mã: ${achievement.achievement_code}, Tiêu đề: ${achievement.title}, Loại: ${achievement.category_code}, Trạng thái: ${achievement.status}` : 'Không có hồ sơ thực tế gắn kèm, thực hiện đánh giá nguyên lý tiêu chuẩn.'}

Hãy phân tích tính phù hợp và đưa ra kết luận.`;

    const completion = await this.completeWithRetry({
      prompt,
      systemPrompt,
      model,
      forcedProvider,
      chunkHash: criterion.criterion_code,
      version: 'eval-v1',
    });

    return {
      criterionId,
      criterionCode: criterion.criterion_code,
      criterionName: criterion.name,
      isConfirmed: criterion.is_confirmed,
      automaticAward: false, // TUYỆT ĐỐI không tự động trao thưởng
      warning: warningNotice,
      analysis: completion.content,
      model: completion.model,
      provider: completion.provider,
      isMock: Boolean(completion.isMock),
      timestamp: completion.timestamp,
      latencyMs: completion.latencyMs,
    };
  }
}

export const aiService = new AiService();
export default aiService;
