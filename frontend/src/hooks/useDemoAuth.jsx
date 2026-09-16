import React, { createContext, useContext, useState } from 'react';

const KEY = 'ptud-demo-session';
const DemoAuthContext = createContext(null);
// Chỉ lưu cờ trải nghiệm; không lưu email, mật khẩu hoặc token xác thực.
function hasDemoSession() {
  try { return localStorage.getItem(KEY) === 'true' || sessionStorage.getItem(KEY) === 'true'; }
  catch { return false; }
}
export function DemoAuthProvider({ children }) {
  const [signedIn, setSignedIn] = useState(hasDemoSession);
  const signIn = remember => {
    try {
      localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);
      (remember ? localStorage : sessionStorage).setItem(KEY, 'true');
    } catch { /* Phiên vẫn dùng được trong bộ nhớ nếu trình duyệt chặn storage. */ }
    setSignedIn(true);
  };
  const signOut = () => {
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* noop */ }
    setSignedIn(false);
  };
  return <DemoAuthContext.Provider value={{ signedIn, signIn, signOut }}>{children}</DemoAuthContext.Provider>;
}
export const useDemoAuth = () => useContext(DemoAuthContext);
