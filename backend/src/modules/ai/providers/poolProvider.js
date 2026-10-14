import crypto from 'node:crypto';
import config from '../../../config/env.js';
import { AiProvider, validateFreeModel } from '../aiProviderInterface.js';
import { AiRateLimitError, AiTimeoutError, AiProviderUnavailableError } from '../aiErrors.js';
import { ValidationError } from '../../../utils/errors.js';

export class PoolProvider extends AiProvider {
  constructor(url, token, mode = 'auto') {
    super(`pool-${mode}`);
    this.url = url.replace(/\/+$/, '');
    this.token = token;
    this.mode = mode;
    this.defaultModel = `worker-config:${mode}`;
    this.isPool = true;
    // Scope cached results to this gateway and credential without logging either secret.
    this.cacheNamespace = crypto.createHash('sha256').update(`${this.url}:${token}`).digest('hex');
  }

  async complete({ prompt, systemPrompt, model, temperature = 0.2, maxTokens = 1024, signal }) {
    if (!this.url || !this.token) throw new AiProviderUnavailableError(this.name, 'Thiếu AI_POOL_URL hoặc AI_POOL_TOKEN');
    if (model) throw new ValidationError('Model của pool được cấu hình trên Cloudflare; bỏ trường model khỏi request');
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const started = Date.now();
    try {
      const response = await fetch(`${this.url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ pool: this.mode, messages, temperature, max_tokens: maxTokens }),
        signal,
        redirect: 'error',
      });
      if (response.status === 429) {
        await response.body?.cancel();
        const seconds = Number(response.headers.get('retry-after'));
        throw new AiRateLimitError(Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60);
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new AiProviderUnavailableError(this.name, `Worker trả HTTP ${response.status}; kiểm tra token, pool và model trên Cloudflare`);
      }
      let data;
      try { data = await response.json(); }
      catch { throw new AiProviderUnavailableError(this.name, 'JSON phản hồi không hợp lệ'); }
      const actualProvider = response.headers.get('X-AI-Provider');
      if (!['groq', 'openrouter'].includes(actualProvider) || (this.mode !== 'auto' && actualProvider !== this.mode)) {
        throw new AiProviderUnavailableError(this.name, 'Thiếu hoặc sai header X-AI-Provider');
      }
      const content = data?.choices?.[0]?.message?.content;
      if (data?.error || typeof content !== 'string' || !content.trim() || typeof data.model !== 'string' || !data.model) {
        throw new AiProviderUnavailableError(this.name, 'Thiếu nội dung hoặc model thực tế trong phản hồi');
      }
      validateFreeModel(actualProvider, data.model);
      if (actualProvider === 'openrouter' && Number(data.usage?.cost || 0) > 0) {
        throw new AiProviderUnavailableError(this.name, 'Phản hồi OpenRouter báo chi phí ngoài chính sách free');
      }
      return {
        content,
        model: data.model,
        requestedModel: this.defaultModel,
        modelReportedByProvider: true,
        provider: actualProvider,
        poolMode: this.mode,
        isMock: false,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError' || err.name === 'TimeoutError') throw new AiTimeoutError(Math.max(35000, config.AI_TIMEOUT_MS));
      if (err.code) throw err;
      // Network/JSON errors must not expose request URLs, headers, prompts or credentials.
      throw new AiProviderUnavailableError(this.name, 'Không kết nối được Worker pool');
    }
  }
}
