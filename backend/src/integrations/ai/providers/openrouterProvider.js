import { AiProvider, validateFreeModel } from '../aiProviderInterface.js';
import {
  AiRateLimitError,
  AiTimeoutError,
  AiProviderUnavailableError,
} from '../aiErrors.js';
import config from '../../../config/env.js';

export class OpenRouterProvider extends AiProvider {
  constructor(apiKey = config.OPENROUTER_API_KEY, defaultModel = config.OPENROUTER_MODEL) {
    super('openrouter');
    this.apiKey = apiKey;
    this.defaultModel = defaultModel || 'meta-llama/llama-3.2-3b-instruct:free';
  }

  async complete({
    prompt,
    systemPrompt = 'Bạn là trợ lý AI chuyên đối chiếu hồ sơ thành tích và tiêu chuẩn thi đua khen thưởng của Trường Đại học Lạc Hồng.',
    model,
    temperature = 0.2,
    maxTokens = 1024,
    signal,
  }) {
    if (!this.apiKey) {
      throw new AiProviderUnavailableError(
        'openrouter',
        'OPENROUTER_API_KEY chưa được cấu hình trong biến môi trường server-only'
      );
    }

    const selectedModel = model || this.defaultModel;
    validateFreeModel('openrouter', selectedModel);

    const startTime = Date.now();
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = {
      model: selectedModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://lhu.edu.vn',
          'X-Title': 'LHU PTUD Achievement & Awards System',
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        throw new AiTimeoutError(config.AI_TIMEOUT_MS);
      }
      throw new AiProviderUnavailableError('openrouter', `Lỗi kết nối mạng: ${err.message}`);
    }

    const latencyMs = Date.now() - startTime;

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch {
        // ignore
      }
      throw new AiRateLimitError(retryAfterSeconds, [errorBody?.error?.message || 'Rate limit']);
    }

    if (!response.ok) {
      let errorText = '';
      try {
        const errJson = await response.json();
        errorText = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        errorText = await response.text();
      }
      throw new AiProviderUnavailableError('openrouter', `HTTP ${response.status}: ${errorText}`);
    }

    let data;
    try { data = await response.json(); }
    catch { throw new AiProviderUnavailableError('openrouter', 'JSON phản hồi không hợp lệ'); }
    if (typeof data?.choices?.[0]?.message?.content !== 'string' || !data.choices[0].message.content.trim())
      throw new AiProviderUnavailableError('openrouter', 'Thiếu nội dung phản hồi');
    const actualModel = data.model || selectedModel;
    validateFreeModel('openrouter', actualModel);
    const choice = data.choices?.[0];
    const content = choice?.message?.content || '';
    const usage = {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    };

    if (config.NODE_ENV !== 'test') {
      console.log(
        `🤖 [AI Log - OpenRouter] Model: ${actualModel} | Tokens: ${usage.totalTokens} | Latency: ${latencyMs}ms | Time: ${new Date().toISOString()}`
      );
    }

    return {
      content,
      model: actualModel,
      requestedModel: selectedModel,
      modelReportedByProvider: Boolean(data.model),
      provider: 'openrouter',
      usage,
      timestamp: new Date().toISOString(),
      latencyMs,
    };
  }
}
