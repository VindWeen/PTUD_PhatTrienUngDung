import axios from 'axios';

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
  inMemoryAccessToken = token;
};

export const getAccessToken = () => inMemoryAccessToken;

export const clearAccessToken = () => {
  inMemoryAccessToken = null;
};

export const setOnAuthFailedCallback = (callback) => {
  onAuthFailedCallback = callback;
};

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Gắn Access Token từ bộ nhớ vào Header Bearer
apiClient.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Tự động gọi Refresh Token khi gặp lỗi 401
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Chuẩn hóa format lỗi trả về từ API
    const errorResponse = error.response?.data?.error || {
      message: error.response?.data?.message || error.message || 'Lỗi kết nối máy chủ',
      code: error.response?.data?.code || 'NETWORK_ERROR',
      fieldErrors: error.response?.data?.fieldErrors || null,
    };

    // Nếu endpoint là refresh hoặc login mà bị 401 thì không thử lại để tránh vòng lặp
    const isAuthRoute =
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
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
        const res = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
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
        return Promise.reject(errorResponse);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(errorResponse);
  }
);

export default apiClient;
