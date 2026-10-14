import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import { DATA_SOURCE } from '../services/apiConfig';
import { LoadingState } from '../components/common/AsyncState';
import { useAuth } from '../context/AuthContext';
import useWorkflowUpdates from '../hooks/useWorkflowUpdates';
import { UserRound } from 'lucide-react';

const roleLabels = { LECTURER: 'Giảng viên', UNIT_REPRESENTATIVE: 'Đại diện đơn vị', MANAGER: 'Quản lý / Thẩm định', RECORDS_OFFICER: 'Cán bộ thi đua khen thưởng', COUNCIL: 'Hội đồng', ADMIN: 'Quản trị viên' };

export default function MainLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  useWorkflowUpdates();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="min-h-screen bg-soft-bg dark:bg-soft-darkBg text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar (Desktop Floating Capsule + Mobile Bottom Nav) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="lg:pl-[108px] pb-24 lg:pb-8 transition-all duration-200">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto">
          {user && <div aria-label="Tài khoản đang đăng nhập" className="mb-5 flex flex-wrap items-center justify-end gap-3 text-sm">
            <UserRound className="h-5 w-5 shrink-0 text-teal-600" />
            <div className="min-w-0"><p className="break-words font-semibold">{user.displayName || user.username}<span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">@{user.username}</span></p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{(user.roles || []).map(r => { const code = typeof r === 'string' ? r : r.code; return roleLabels[code] || r.name || code; }).join(' · ')}</p>
            </div>
          </div>}
          {DATA_SOURCE === 'fixture' && <p className="mb-5 text-xs font-semibold text-amber-700 dark:text-amber-300">Nguồn dữ liệu: FIXTURE theo OpenAPI — không phải dữ liệu thật.</p>}
          <Suspense fallback={<LoadingState label="Đang mở trang…" />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

