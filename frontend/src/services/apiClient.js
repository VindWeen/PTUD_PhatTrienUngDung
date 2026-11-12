import axios from 'axios';
import { API_BASE_URL } from './apiConfig.js';
import { normalizeApiError } from './apiError.js';
import { clearReadCache } from './readCache.js';

let inMemoryAccessToken = null;
let onAuthFailedCallback = null;
let refreshPromise = null;

// Initial session restoration and concurrent 401 responses share one rotation.
export function refreshAccessToken() {
  if (!refreshPromise) {
    const rotate = () => axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true, timeout: 30000 });
    const request = typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('ptud-auth-refresh', rotate)
      : rotate();
    refreshPromise = request
      .then(response => {
        const data = response.data?.data;
        if (!data?.accessToken) throw new Error('Không thể khôi phục phiên đăng nhập.');
        setAccessToken(data.accessToken);
        return data;
      }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export const setAccessToken = (token) => {
  if (token !== inMemoryAccessToken) clearReadCache();
  inMemoryAccessToken = token;
};

export const getAccessToken = () => inMemoryAccessToken;

export const clearAccessToken = () => {
  clearReadCache();
  inMemoryAccessToken = null;
};

export const setOnAuthFailedCallback = (callback) => {
  onAuthFailedCallback = callback;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Gắn Access Token từ bộ nhớ vào Header Bearer
apiClient.interceptors.request.use(
  (config) => {
    if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) clearReadCache();
    if (inMemoryAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Tự động gọi Refresh Token khi gặp lỗi 401
apiClient.interceptors.response.use(
  (response) => {
    if (!['get', 'head', 'options'].includes((response.config.method || 'get').toLowerCase())) clearReadCache();
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.data instanceof Blob && error.response.data.type.includes('json')) {
      try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Keep HTTP status if the error body is malformed. */ }
    }

    const apiError = normalizeApiError(error);

    // Nếu endpoint là refresh hoặc login mà bị 401 thì không thử lại để tránh vòng lặp
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/logout') ||
      originalRequest?.url?.includes('/auth/reset-password') ||
      originalRequest?.url?.includes('/auth/forgot-password');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      try {
        const { accessToken } = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        clearAccessToken();
        if (typeof onAuthFailedCallback === 'function') {
          onAuthFailedCallback();
        }
        return Promise.reject(apiError);
      }
    }

    return Promise.reject(apiError);
  }
);

export default apiClient;
