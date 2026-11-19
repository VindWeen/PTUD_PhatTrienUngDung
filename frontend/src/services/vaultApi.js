import { request } from './request';

export const api = (url, method = 'GET', data, options = {}) => request({
  url,
  method,
  data,
  fresh: true,
  ...(data instanceof FormData ? { headers: { 'Content-Type': undefined } } : {}),
  ...options
});

export const array = value => Array.isArray(value) ? value : value?.items || [];

export async function saveBlob(url, filename, method = 'GET', data) {
  const blob = await api(url, method, data, { responseType: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
