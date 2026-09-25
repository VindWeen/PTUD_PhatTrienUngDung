import React from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';

/**
 * Cầu nối chuyển đổi từ useDemoAuth sang Auth thật (W1-Q3).
 * Giữ nguyên giao diện API để không làm hỏng các component khác của dự án.
 */
export const DemoAuthProvider = AuthProvider;
export const useDemoAuth = useAuth;
export { useAuth, AuthProvider };
export default useAuth;
