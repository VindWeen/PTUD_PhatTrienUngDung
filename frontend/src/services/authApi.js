import apiClient, { setAccessToken, clearAccessToken } from './apiClient.js';

export const authApi = {
  /**
   * Đăng nhập người dùng bằng Username/Email và Password
   */
  async login({ username, password, rememberMe = false }) {
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
    const res = await apiClient.post('/auth/refresh');
    if (res.data?.accessToken) {
      setAccessToken(res.data.accessToken);
    }
    return res.data;
  },

  /**
   * Đăng xuất hệ thống
   */
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearAccessToken();
    }
  },

  /**
   * Đổi mật khẩu người dùng
   */
  async changePassword({ oldPassword, newPassword }) {
    const res = await apiClient.post('/auth/change-password', { oldPassword, newPassword });
    clearAccessToken();
    return res;
  },

  /**
   * Lấy thông tin tài khoản hiện tại
   */
  async getMe() {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
};

export default authApi;
