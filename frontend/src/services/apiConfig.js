const configuredSource = String(import.meta.env.VITE_DATA_SOURCE || 'api').toLowerCase();

if (!['api', 'fixture'].includes(configuredSource)) {
  throw new Error('VITE_DATA_SOURCE chỉ nhận "api" hoặc "fixture".');
}

export const DATA_SOURCE = configuredSource;
export const USE_FIXTURES = DATA_SOURCE === 'fixture';
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

