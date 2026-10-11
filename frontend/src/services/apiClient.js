import axios from 'axios';
import { API_BASE_URL } from './apiConfig.js';
import { normalizeApiError } from './apiError.js';
import { clearReadCache } from './readCache.js';

let inMemoryAccessToken = null;
let onAuthFailedCallback = null;
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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
      originalRequest?.url?.includes('/auth/logout');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Gọi refresh token bằng HttpOnly cookie
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        const newAccessToken = res.data?.data?.accessToken;

        if (newAccessToken) {
          setAccessToken(newAccessToken);
          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAccessToken();
        if (typeof onAuthFailedCallback === 'function') {
          onAuthFailedCallback();
        }
        return Promise.reject(apiError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(apiError);
  }
);

export default apiClient;
