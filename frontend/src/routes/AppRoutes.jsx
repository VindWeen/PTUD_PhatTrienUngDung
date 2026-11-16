import React from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../layouts/MainLayout';
import AuthPage from '../pages/AuthPage';
import ResetPassword from '../pages/ResetPassword';
import NotFound from '../pages/NotFound';
import Dashboard from '../pages/Dashboard';
import { Profile, Achievements, Discovery, Goals, Regulations, Organizations, PublicCv, Reports, Admin } from '../pages/V2';

function RequireAuth() {
  const { signedIn, loading } = useAuth();
  if (loading) return <main className="p-8">Đang khôi phục phiên đăng nhập…</main>;
  return signedIn ? <Outlet /> : <Navigate to="/login" replace />;
}
export default function AppRoutes() {
  const { signedIn, loading } = useAuth();
  return <Routes>
    <Route path="/login" element={loading ? <main className="p-8">Đang kiểm tra phiên đăng nhập…</main> : signedIn ? <Navigate to="/me/dashboard" replace /> : <AuthPage />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/cv/:slug" element={<PublicCv />} />
    <Route element={<RequireAuth />}><Route element={<MainLayout />}>
      <Route index element={<Navigate to="/me/dashboard" replace />} />
      <Route path="me/dashboard" element={<Dashboard />} />
      <Route path="me/profile" element={<Profile />} />
      <Route path="me/cv" element={<Navigate to="/me/profile?tab=cv" replace />} />
      <Route path="achievements" element={<Achievements />} />
      <Route path="kpi" element={<Goals />} />
      <Route path="me/ai-forecast" element={<Discovery />} />
      <Route path="me/calendar" element={<Navigate to="/me/dashboard" replace />} />
      <Route path="calendar" element={<Navigate to="/me/dashboard" replace />} />
      <Route path="reports" element={<Reports />} />
      <Route path="notifications" element={<Navigate to="/me/dashboard" replace />} />
      <Route path="regulations" element={<Regulations />} />
      <Route path="organizations" element={<Organizations />} />
      <Route path="admin" element={<Admin />} />
    </Route></Route>
    <Route path="*" element={<NotFound />} />
  </Routes>;
}
