import apiClient from './apiClient.js';

export async function request(config) {
  const envelope = await apiClient.request(config);
  if (envelope?.success === false) throw envelope.error;
  return envelope?.data ?? envelope;
}

