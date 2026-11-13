import React, { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../layouts/MainLayout';
import AuthPage from '../pages/AuthPage';
import ResetPassword from '../pages/ResetPassword';
import NotFound from '../pages/NotFound';
import { LoadingState } from '../components/common/AsyncState';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const Kpi = lazy(() => import('../pages/Kpi'));
const AIForecast = lazy(() => import('../pages/AIForecast'));
const Calendar = lazy(() => import('../pages/Calendar'));
const Reports = lazy(() => import('../pages/Reports'));
const ProfilePortfolio = lazy(() => import('../pages/ProfilePortfolio'));
const CvEditor = lazy(() => import('../pages/CvEditor'));
const PublicCv = lazy(() => import('../pages/PublicCv'));
const CvPreview = lazy(() => import('../pages/CvPreview'));
const Organizations = lazy(() => import('../pages/Organizations'));
const AdminManagement = lazy(() => import('../pages/AdminManagement'));
const Achievements = lazy(() => import('../pages/Achievements'));
const Regulations = lazy(() => import('../pages/Regulations'));

export const normalizeRole = (role) => {
  const r = typeof role === 'string' ? role : role?.code;
  if (!r) return 'MEMBER';
  if (r === 'LECTURER') return 'MEMBER';
  if (r === 'UNIT_REPRESENTATIVE') return 'DEPARTMENT_HEAD';
  if (r === 'MANAGER') return 'FACULTY_LEAD';
  if (r === 'RECORDS_OFFICER' || r === 'COUNCIL') return 'MEMBER';
  return r;
};

export const STANDARD_ROLES = ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'];
export const UNIT_LEAD_ROLES = ['DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN'];
export const ADMIN_ONLY = ['ADMIN'];

function RequireAuth() {
  const { signedIn, loading } = useAuth();
  if (loading) return <main className="min-h-screen p-8"><LoadingState label="Đang khôi phục phiên đăng nhập..." /></main>;
  return signedIn ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const rawRoles = (user?.roles || []).map((role) => typeof role === 'string' ? role : role.code);
  const normalized = rawRoles.map(normalizeRole);
  const allUserRoles = [...new Set([...rawRoles, ...normalized])];
  return roles.some((role) => allUserRoles.includes(role)) ? children : <Navigate to="/404" replace />;
}

export default function AppRoutes() {
  const { signedIn, loading } = useAuth();
  const landing = '/me/dashboard';

  return (
    <Suspense fallback={<LoadingState label="Đang mở trang…" />}>
      <Routes>
        <Route path="/login" element={loading ? <LoadingState label="Đang kiểm tra phiên đăng nhập..." /> : signedIn ? <Navigate to={landing} replace /> : <AuthPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Unauthenticated Public CV routes (both :slug and :id supported) */}
        <Route path="/cv/:slug" element={<PublicCv />} />
        <Route path="/cv/:id" element={<PublicCv />} />

        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route index element={<Navigate to={landing} replace />} />
            <Route path="notifications" element={<Navigate to={`${landing}?notifications=1`} replace />} />
            
            {/* Core Educator & Career Assistant Routes */}
            <Route path="me/dashboard" element={<RequireRole roles={STANDARD_ROLES}><Dashboard /></RequireRole>} />
            <Route path="me/profile" element={<RequireRole roles={STANDARD_ROLES}><ProfilePortfolio /></RequireRole>} />
            <Route path="me/cv" element={<RequireRole roles={STANDARD_ROLES}><CvEditor /></RequireRole>} />
            <Route path="me/cv/preview" element={<RequireRole roles={STANDARD_ROLES}><CvPreview /></RequireRole>} />
            
            <Route path="achievements" element={<RequireRole roles={STANDARD_ROLES}><Achievements /></RequireRole>} />
            <Route path="kpi" element={<RequireRole roles={STANDARD_ROLES}><Kpi /></RequireRole>} />
            <Route path="me/ai-forecast" element={<RequireRole roles={STANDARD_ROLES}><AIForecast /></RequireRole>} />
            
            {/* Calendar & Deadlines */}
            <Route path="me/calendar" element={<RequireRole roles={STANDARD_ROLES}><Calendar /></RequireRole>} />
            <Route path="calendar" element={<Navigate to="/me/calendar" replace />} />
            
            {/* Reports & Unit AI Scan */}
            <Route path="reports" element={<RequireRole roles={STANDARD_ROLES}><Reports /></RequireRole>} />
            <Route path="regulations" element={<RequireRole roles={STANDARD_ROLES}><Regulations /></RequireRole>} />
            <Route path="organizations" element={<RequireRole roles={UNIT_LEAD_ROLES}><Organizations /></RequireRole>} />
            <Route path="admin" element={<RequireRole roles={ADMIN_ONLY}><AdminManagement /></RequireRole>} />

            {/* Legacy route redirects */}
            <Route path="awards" element={<Navigate to="/achievements" replace />} />
            <Route path="award-applications" element={<Navigate to="/achievements" replace />} />
            <Route path="me/achievements" element={<Navigate to="/achievements" replace />} />
            <Route path="dashboard" element={<Navigate to={landing} replace />} />
            <Route path="profile" element={<Navigate to="/me/profile" replace />} />
            <Route path="ai-forecast" element={<Navigate to="/me/ai-forecast" replace />} />
          </Route>
        </Route>

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
