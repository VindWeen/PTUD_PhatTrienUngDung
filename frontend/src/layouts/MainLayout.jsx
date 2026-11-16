import React, { Suspense, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Moon, Sun, UserRound } from 'lucide-react';
import NotificationDropdown from '../components/common/NotificationDropdown';
import { useTheme } from '../hooks/useTheme';
import GlobalSearch from '../components/common/GlobalSearch';

const roleLabels = { MEMBER: 'Thành viên', SYSTEM_ADMIN: 'Quản trị hệ thống', REGULATION_MANAGER: 'Quản lý quy chế' };

export default function MainLayout() {
  return <MainLayoutContent />;
}

function MainLayoutContent() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="vault-shell min-h-screen bg-soft-bg dark:bg-soft-darkBg text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar (Desktop Floating Capsule + Mobile Bottom Nav) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="lg:pl-[248px] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8 transition-all duration-200">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto">
          {user && <div aria-label="Tài khoản đang đăng nhập" className="workspace-topbar">
            <GlobalSearch />
            <div className="workspace-topbar-actions"><NotificationDropdown /><button type="button" className="workspace-icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><Link to="/me/profile" className="workspace-user"><span className="workspace-avatar"><UserRound size={18} /></span><span><strong>{user.fullName || user.email}</strong><small>{(user.roles || []).map(r => { const code = typeof r === 'string' ? r : r.code; return roleLabels[code] || r.name || code; }).join(' · ')}</small></span></Link></div>
          </div>}
          <Suspense fallback={<p>Đang mở trang…</p>}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

