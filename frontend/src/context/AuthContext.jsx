import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authApi from '../services/authApi.js';
import { setOnAuthFailedCallback, clearAccessToken } from '../services/apiClient.js';

const AuthContext = createContext(null);

const DEMO_FALLBACK_USER = {
  userId: 1,
  username: 'an.nv',
  email: 'an.nv@lhu.edu.vn',
  displayName: 'PGS.TS. Nguyễn Văn An',
  status: 'ACTIVE',
  roles: [{ roleId: 2, code: 'LECTURER', name: 'Giảng viên' }],
  lecturerProfile: {
    fullName: 'Nguyễn Văn An',
    employeeCode: 'GV00234',
    title: 'Phó Giáo sư',
    degree: 'Tiến sĩ',
    primaryUnit: { unitId: 2, name: 'Bộ môn Kỹ thuật Phần mềm' },
  },
  scopes: [],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      clearAccessToken();
    } finally {
      setUser(null);
      setError(null);
      localStorage.removeItem('ptud-session-active');
      sessionStorage.removeItem('ptud-session-active');
    }
  }, []);

  // Đăng ký callback khi refresh token thất bại
  useEffect(() => {
    setOnAuthFailedCallback(() => {
      setUser(null);
      localStorage.removeItem('ptud-session-active');
      sessionStorage.removeItem('ptud-session-active');
    });
  }, []);

  // Khôi phục phiên làm việc khi tải lại trang (Silent Re-authentication)
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      try {
        const refreshData = await authApi.refresh();
        if (refreshData?.accessToken && isMounted) {
          const profile = await authApi.getMe();
          if (isMounted && profile) {
            setUser(profile);
            localStorage.setItem('ptud-session-active', 'true');
          }
        }
      } catch {
        // Nếu không có cookie hoặc hết hạn phiên
        if (isMounted) {
          const hadSession =
            localStorage.getItem('ptud-session-active') === 'true' ||
            sessionStorage.getItem('ptud-session-active') === 'true';
          if (hadSession) {
            // Nếu người dùng đã từng đăng nhập demo trước đó
            setUser(DEMO_FALLBACK_USER);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Đăng nhập thật kết nối API /api/v1/auth/login
   */
  const signIn = async (credentials, remember = false) => {
    setError(null);
    try {
      // Nếu credentials là object { username, password }
      const payload =
        typeof credentials === 'object' && credentials !== null
          ? {
              username: credentials.username || credentials.email,
              password: credentials.password,
              rememberMe: remember || Boolean(credentials.rememberMe),
            }
          : {
              username: credentials,
              password: 'demo1234',
              rememberMe: remember,
            };

      const loginRes = await authApi.login(payload);
      if (loginRes?.user) {
        setUser(loginRes.user);
        (payload.rememberMe ? localStorage : sessionStorage).setItem('ptud-session-active', 'true');
        return loginRes.user;
      }
      throw new Error('Dữ liệu đăng nhập phản hồi không hợp lệ');
    } catch (err) {
      const msg = err.message || err.error?.message || 'Đăng nhập không thành công';
      setError(msg);
      throw err;
    }
  };

  /**
   * Đổi mật khẩu tài khoản
   */
  const changePassword = async ({ oldPassword, newPassword }) => {
    try {
      const res = await authApi.changePassword({ oldPassword, newPassword });
      setUser(null);
      localStorage.removeItem('ptud-session-active');
      sessionStorage.removeItem('ptud-session-active');
      return res;
    } catch (err) {
      throw err;
    }
  };

  /**
   * Kiểm tra vai trò
   */
  const hasRole = (roleCode) => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => (typeof r === 'string' ? r === roleCode : r.code === roleCode));
  };

  /**
   * Kiểm tra thẩm quyền đơn vị
   */
  const hasScope = (unitId) => {
    if (!user || !user.scopes) return false;
    return user.scopes.some((s) => Number(s.unitId) === Number(unitId));
  };

  const value = {
    user,
    signedIn: Boolean(user),
    loading,
    error,
    signIn,
    signOut,
    changePassword,
    hasRole,
    hasScope,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
