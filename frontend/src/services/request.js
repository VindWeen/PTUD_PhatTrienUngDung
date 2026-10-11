import apiClient from './apiClient.js';
import { cachedRead, invalidateReadCache } from './readCache.js';
import { readCacheKey } from './readCachePolicy.js';

export async function request(config) {
  const { fresh, ...httpConfig } = config;
  const read = async () => {
    const envelope = await apiClient.request(httpConfig);
    if (envelope?.success === false) throw envelope.error;
    return envelope?.data ?? envelope;
  };
  const key = readCacheKey(config);
  if (!key) return read();
  if (fresh) invalidateReadCache(key);
  return cachedRead(key, read);
}

