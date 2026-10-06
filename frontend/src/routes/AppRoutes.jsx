import React from 'react';
import Kpi from '../pages/Kpi';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../layouts/MainLayout';
import AIForecast from '../pages/AIForecast';
import AuthPage from '../pages/AuthPage';
import Dashboard from '../pages/Dashboard';
import Reports from '../pages/Reports';
import NotFound from '../pages/NotFound';
import ProfilePortfolio from '../pages/ProfilePortfolio';
import Organizations from '../pages/Organizations';
import AdminManagement from '../pages/AdminManagement';
import Achievements from '../pages/Achievements';
import Awards from '../pages/Awards';
import AwardApplications from '../pages/AwardApplications';
import Notifications from '../pages/Notifications';
import Regulations from '../pages/Regulations';
import { LoadingState } from '../components/common/AsyncState';

const APP_ROLES = ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'];
const PROFILE_ROLES = ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER'];

function RequireAuth() {
  const { signedIn, loading } = useAuth();
  if (loading) return <main className="min-h-screen p-8"><LoadingState label="Đang khôi phục phiên đăng nhập..." /></main>;
  return signedIn ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const userRoles = (user?.roles || []).map((role) => typeof role === 'string' ? role : role.code);
  return roles.some((role) => userRoles.includes(role)) ? children : <Navigate to="/404" replace />;
}

export default function AppRoutes() {
  const { signedIn, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? <LoadingState label="Đang kiểm tra phiên đăng nhập..." /> : signedIn ? <Navigate to="/me/dashboard" replace /> : <AuthPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/me/dashboard" replace />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="kpi" element={<RequireRole roles={['LECTURER', 'UNIT_REPRESENTATIVE']}><Kpi /></RequireRole>} />
          <Route path="reports" element={<RequireRole roles={APP_ROLES}><Reports /></RequireRole>} />
          <Route path="me/dashboard" element={<RequireRole roles={APP_ROLES}><Dashboard /></RequireRole>} />
          <Route path="me/profile" element={<RequireRole roles={PROFILE_ROLES}><ProfilePortfolio /></RequireRole>} />
          <Route path="me/ai-forecast" element={<RequireRole roles={PROFILE_ROLES}><AIForecast /></RequireRole>} />
          <Route path="organizations" element={<RequireRole roles={APP_ROLES}><Organizations /></RequireRole>} />
          <Route path="achievements" element={<RequireRole roles={APP_ROLES}><Achievements /></RequireRole>} />
          <Route path="regulations" element={<RequireRole roles={APP_ROLES}><Regulations /></RequireRole>} />
          <Route path="awards" element={<RequireRole roles={['RECORDS_OFFICER']}><Awards /></RequireRole>} />
          <Route path="award-applications" element={<RequireRole roles={['LECTURER','UNIT_REPRESENTATIVE','MANAGER','RECORDS_OFFICER']}><AwardApplications /></RequireRole>} />
          <Route path="me/achievements" element={<Navigate to="/achievements" replace />} />
          <Route path="admin" element={<RequireRole roles={['ADMIN']}><AdminManagement /></RequireRole>} />
          <Route path="dashboard" element={<Navigate to="/me/dashboard" replace />} />
          <Route path="profile" element={<Navigate to="/me/profile" replace />} />
          <Route path="ai-forecast" element={<Navigate to="/me/ai-forecast" replace />} />
        </Route>
      </Route>
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
