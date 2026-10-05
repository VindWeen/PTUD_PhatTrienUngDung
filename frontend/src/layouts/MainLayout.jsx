import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import { DATA_SOURCE } from '../services/apiConfig';

export default function MainLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="min-h-screen bg-soft-bg dark:bg-soft-darkBg text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar (Desktop Floating Capsule + Mobile Bottom Nav) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="lg:pl-[108px] pb-24 lg:pb-8 transition-all duration-200">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto">
          {DATA_SOURCE === 'fixture' && <p className="mb-5 text-xs font-semibold text-amber-700 dark:text-amber-300">Nguồn dữ liệu: FIXTURE theo OpenAPI — không phải dữ liệu thật.</p>}
          <Outlet />
        </div>
      </div>
    </div>
  );
}

