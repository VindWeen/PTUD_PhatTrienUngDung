import crypto from 'crypto';
import config from '../../config/env.js';

class AiCache {
  constructor(ttlMs = 3600000) { // 1 giờ
    this.cache = new Map();
    this.ttlMs = ttlMs;
    this.hits = 0;
    this.misses = 0;
  }

  generateKey({ model, prompt, systemPrompt = '', chunkHash = '', version = '1.0' }) {
    const raw = `${version}:${model}:${systemPrompt}:${chunkHash}:${prompt}`;
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  get(key) {
    if (!config.AI_CACHE_ENABLED) return null;

    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Kiểm tra hết hạn TTL
    if (Date.now() - entry.storedAt > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return {
      ...entry.data,
      cached: true,
      cachedAt: new Date(entry.storedAt).toISOString(),
    };
  }

  set(key, data) {
    if (!config.AI_CACHE_ENABLED) return;

    this.cache.set(key, {
      storedAt: Date.now(),
      data,
    });

    // Giới hạn tối đa 500 mục cache để tiết kiệm RAM
    if (this.cache.size > 500) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export const aiCache = new AiCache();
export default aiCache;
