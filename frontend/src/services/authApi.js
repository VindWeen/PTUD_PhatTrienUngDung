import apiClient, { setAccessToken, clearAccessToken, refreshAccessToken } from './apiClient.js';
import { USE_FIXTURES } from './apiConfig.js';
import { fixtureClient } from './fixtureClient.js';

export const authApi = {
  /**
   * Đăng nhập người dùng bằng Username/Email và Password
   */
  async register({ fullName, email, password }) {
    if (USE_FIXTURES) throw new Error('Đăng ký không khả dụng trong chế độ fixture.');
    return apiClient.post('/auth/register', { fullName, email, password });
  },
  async requestPasswordReset(email) {
    if (USE_FIXTURES) throw new Error('Khôi phục mật khẩu không khả dụng trong chế độ fixture.');
    return apiClient.post('/auth/forgot-password', { email });
  },
  async resetPassword(token, password) {
    if (USE_FIXTURES) throw new Error('Khôi phục mật khẩu không khả dụng trong chế độ fixture.');
    return apiClient.post('/auth/reset-password', { token, password });
  },
  async login({ username, password, rememberMe = false }) {
    if (USE_FIXTURES) {
      const data = await fixtureClient.login({ username, password, rememberMe });
      setAccessToken(data.accessToken);
      return data;
    }
    const res = await apiClient.post('/auth/login', { username, password, rememberMe });
    if (res.data?.accessToken) {
      setAccessToken(res.data.accessToken);
    }
    return res.data;
  },

  /**
   * Làm mới Access Token thông qua HttpOnly Cookie
   */
  async refresh() {
    if (USE_FIXTURES) return fixtureClient.refresh();
    return refreshAccessToken();
  },

  /**
   * Đăng xuất hệ thống
   */
  async logout() {
    try {
      if (USE_FIXTURES) await fixtureClient.logout();
      else await apiClient.post('/auth/logout');
    } finally {
      clearAccessToken();
    }
  },

  /**
   * Đổi mật khẩu người dùng
   */
  async changePassword({ oldPassword, newPassword }) {
    if (USE_FIXTURES) throw new Error('Đổi mật khẩu không khả dụng trong chế độ fixture.');
    const res = await apiClient.post('/auth/change-password', { oldPassword, newPassword });
    clearAccessToken();
    return res;
  },

  /**
   * Lấy thông tin tài khoản hiện tại
   */
  async getMe() {
    if (USE_FIXTURES) return fixtureClient.getMe();
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
};

export default authApi;
