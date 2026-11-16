import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { 
  GraduationCap, Home, User, Cpu, LogOut, Building2, 
  Award, BookOpen, Target, Shield, Menu, X 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ALL_ROLES = ['MEMBER', 'SYSTEM_ADMIN', 'REGULATION_MANAGER'];

const navItems = [
  { to: '/me/dashboard', icon: Home, label: 'Trang chủ', roles: ALL_ROLES },
  { to: '/me/profile', icon: User, label: 'Hồ sơ & CV', roles: ALL_ROLES },
  { to: '/achievements', icon: Award, label: 'Kho thành tích', roles: ALL_ROLES },
  { to: '/me/ai-forecast', icon: Cpu, label: 'Khám hồ sơ', roles: ALL_ROLES },
  { to: '/kpi', icon: Target, label: 'Mục tiêu / KPI', roles: ALL_ROLES },
  { to: '/regulations', icon: BookOpen, label: 'Kho quy chế', roles: ALL_ROLES },
  { to: '/organizations', icon: Building2, label: 'Tổ chức', roles: ALL_ROLES },
  { to: '/admin', icon: Shield, label: 'Quản trị hệ thống', roles: ['SYSTEM_ADMIN'] },
];

export default function Sidebar() {
  const { signOut, user } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreDialog = useRef(null);
  const moreButton = useRef(null);

  useEffect(() => { setMoreOpen(false); }, [pathname]);
  useEffect(() => {
    const dialog = moreDialog.current;
    if (moreOpen && !dialog.open) dialog.showModal();
    if (!moreOpen && dialog.open) dialog.close();
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [moreOpen]);

  const closeMore = () => { setMoreOpen(false); moreButton.current?.focus(); };
  const accessibleLabel = (_to, label) => label;
  
  const rawRoles = (user?.roles || []).map((role) => typeof role === 'string' ? role : role.code);
  const allUserRoles = [...new Set(['MEMBER', ...rawRoles])];

  const visibleItems = navItems.filter((item) => item.roles.some((role) => allUserRoles.includes(role)));
  const primaryItems = visibleItems.filter(item => ['/me/dashboard', '/achievements', '/kpi', '/me/ai-forecast'].includes(item.to)).slice(0, 4);
  
  const desktopRowInsetClass = 'px-3 transition-all duration-200';
  const desktopLabelClass = 'min-w-0 flex-1 whitespace-nowrap text-left text-[0.84rem] font-semibold tracking-tight';
  
  const navLinkMobile = ({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to} title={label} aria-label={accessibleLabel(to, label)}
      className={({isActive}) => `min-w-0 min-h-14 flex-1 rounded-2xl flex flex-col items-center justify-center transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-slate-200 hover:text-white hover:bg-white/10'}`}>
      <span className="relative"><Icon className="w-5 h-5" /></span>
      <span className="max-w-full truncate px-1 text-[11px] mt-1 font-medium">{to === '/kpi' ? 'KPI' : label}</span>
    </NavLink>
  );

  return <>
    {/* Desktop Floating Capsule Dock Sidebar */}
    <aside 
      aria-label="Điều hướng desktop" 
      className="hidden lg:flex fixed top-4 bottom-4 left-4 w-[242px] overflow-hidden bg-[#182838] dark:bg-[#0f172a] rounded-[28px] shadow-[0_16px_40px_rgba(15,23,42,0.18)] flex-col items-start p-3.5 z-30 text-white border border-white/5"
    >
      {/* Brand Header */}
      <Link to="/" aria-label="Trang chủ LHU" className={`flex h-12 w-full shrink-0 items-center gap-3 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300 ${desktopRowInsetClass} mb-2`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600/30 text-teal-300 border border-teal-500/30">
          <GraduationCap size={22} />
        </span>
        <span className={desktopLabelClass}>
          <span className="block font-bold text-white text-[0.95rem]">LHU</span>
          <span className="block text-[0.7rem] text-slate-300 font-normal">Quản lý thành tích</span>
        </span>
      </Link>

      {/* Nav List */}
      <div className="my-2 min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav aria-label="Menu chính" className="flex flex-col gap-1.5">
          {visibleItems.map(({to, icon: Icon, label}) => (
            <NavLink 
              key={to} 
              to={to} 
              aria-label={accessibleLabel(to, label)}
              className={({isActive}) => `flex h-11 w-full shrink-0 items-center gap-3 rounded-xl ${desktopRowInsetClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300 ${isActive ? 'bg-teal-600/30 text-teal-200 font-bold border border-teal-500/20 shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className={desktopLabelClass}>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Logout */}
      <div className="w-full pt-2 border-t border-white/10">
        <button 
          type="button" 
          onClick={signOut} 
          aria-label="Đăng xuất" 
          className={`flex h-11 w-full shrink-0 items-center gap-3 rounded-xl text-slate-300 hover:bg-rose-500/20 hover:text-rose-200 transition-all ${desktopRowInsetClass}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <LogOut className="h-[18px] w-[18px]" />
          </span>
          <span className={desktopLabelClass}>Đăng xuất</span>
        </button>
      </div>
    </aside>

    {/* Mobile Bottom Navigation */}
    <nav aria-label="Menu di động" className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#182838]/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-t border-white/10 flex items-center gap-1 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-40 shadow-2xl text-white">
      {primaryItems.map(navLinkMobile)}
      <button 
        ref={moreButton} 
        type="button" 
        onClick={() => setMoreOpen(true)} 
        aria-expanded={moreOpen} 
        aria-controls="mobile-navigation" 
        aria-haspopup="dialog" 
        className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-white hover:bg-white/10"
      >
        <Menu className="h-5 w-5" />
        <span className="text-[11px] font-medium">Thêm</span>
      </button>
    </nav>

    {/* Mobile Dialog */}
    <dialog 
      ref={moreDialog} 
      id="mobile-navigation" 
      aria-labelledby="mobile-navigation-title" 
      onCancel={closeMore} 
      onClose={() => setMoreOpen(false)} 
      onClick={event => { if (event.target === event.currentTarget) closeMore(); }} 
      className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="mobile-navigation-title" className="text-lg font-bold">Điều hướng</h2>
        <button type="button" autoFocus onClick={closeMore} aria-label="Đóng menu" className="rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav aria-label="Tất cả chức năng" className="grid gap-2">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={closeMore} className={({isActive}) => `flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${isActive ? 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <button type="button" onClick={() => { closeMore(); signOut(); }} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700">
        <LogOut className="h-5 w-5" />
        Đăng xuất
      </button>
    </dialog>
  </>;
}
