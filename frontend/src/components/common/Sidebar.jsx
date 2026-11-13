import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { 
  GraduationCap, Home, User, Cpu, LogOut, Building2, 
  Award, BookOpen, BarChart3, Target, CalendarDays, Shield, Menu, X 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ALL_ROLES = ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN', 'LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER'];
const UNIT_LEADERS = ['DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN', 'UNIT_REPRESENTATIVE', 'MANAGER'];
const ADMIN_ONLY = ['ADMIN'];

const navItems = [
  { to: '/me/dashboard', icon: Home, label: 'Trang chủ', roles: ALL_ROLES },
  { to: '/me/profile', icon: User, label: 'Hồ sơ năng lực', roles: ALL_ROLES },
  { to: '/achievements', icon: Award, label: 'Kho thành tích', roles: ALL_ROLES },
  { to: '/kpi', icon: Target, label: 'Mục tiêu / KPI', roles: ALL_ROLES },
  { to: '/me/ai-forecast', icon: Cpu, label: 'Trợ lý AI & Quy chế', roles: ALL_ROLES },
  { to: '/calendar', icon: CalendarDays, label: 'Lịch & Nhắc nhở', roles: ALL_ROLES },
  { to: '/reports', icon: BarChart3, label: 'Báo cáo & Quét AI', roles: ALL_ROLES },
  { to: '/regulations', icon: BookOpen, label: 'Kho quy định', roles: ALL_ROLES },
  { to: '/organizations', icon: Building2, label: 'Cây tổ chức', roles: UNIT_LEADERS },
  { to: '/admin', icon: Shield, label: 'Quản trị hệ thống', roles: ADMIN_ONLY },
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
  const normalizedRoles = rawRoles.map(r => {
    if (r === 'LECTURER') return 'MEMBER';
    if (r === 'UNIT_REPRESENTATIVE') return 'DEPARTMENT_HEAD';
    if (r === 'MANAGER') return 'FACULTY_LEAD';
    if (r === 'RECORDS_OFFICER' || r === 'COUNCIL') return 'MEMBER';
    return r;
  });
  const allUserRoles = [...new Set([...rawRoles, ...normalizedRoles])];

  const visibleItems = navItems.filter((item) => item.roles.some((role) => allUserRoles.includes(role)));
  const primaryItems = visibleItems.filter(item => ['/me/dashboard', '/achievements', '/kpi', '/me/ai-forecast', '/calendar'].includes(item.to)).slice(0, 4);
  
  const desktopRowInsetClass = 'px-0 group-hover/sidebar:px-3 group-has-[:focus-visible]/sidebar:px-3 transition-[padding,background-color,color] duration-300 motion-reduce:transition-none';
  const desktopLabelClass = 'min-w-0 flex-1 whitespace-nowrap text-left text-[15px] font-semibold leading-5 opacity-0 translate-x-2 transition-[opacity,transform] duration-200 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-has-[:focus-visible]/sidebar:opacity-100 group-has-[:focus-visible]/sidebar:translate-x-0 motion-reduce:transition-none';
  
  const navLink = ({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to} title={label} aria-label={accessibleLabel(to, label)}
      className={({isActive}) => `min-w-0 min-h-14 flex-1 rounded-2xl flex flex-col items-center justify-center transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-slate-200 hover:text-white hover:bg-white/10'}`}>
      <span className="relative"><Icon className="w-5 h-5" /></span>
      <span className="max-w-full truncate px-1 text-[11px] mt-1 font-medium">{to === '/calendar' ? 'Lịch' : to === '/kpi' ? 'KPI' : label}</span>
    </NavLink>
  );

  return <>
    <aside aria-label="Điều hướng desktop" className="group/sidebar hidden lg:flex fixed left-5 top-1/2 -translate-y-1/2 max-h-[calc(100dvh-40px)] w-[76px] hover:w-[272px] has-[:focus-visible]:w-[272px] overflow-hidden bg-gradient-to-b from-[#182b3d] via-[#274b64] to-[#365f79] dark:from-[#111c2a] dark:to-[#223e52] rounded-[32px] flex-col items-start px-3.5 py-4 z-30 shadow-soft-lg text-white transition-[width] duration-300 ease-out motion-reduce:transition-none">
      <Link to="/" aria-label="Trang chủ LHU" className={`flex h-12 w-full shrink-0 items-center gap-3 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-300 ${desktopRowInsetClass}`}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><GraduationCap /></span>
        <span className={desktopLabelClass}><span className="block font-bold text-white">LHU</span><span className="block text-xs text-slate-300">Quản lý thành tích</span></span>
      </Link>
      <div className="my-4 min-h-0 w-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav aria-label="Menu chính" className="flex flex-col gap-2">
          {visibleItems.map(({to, icon: Icon, label}) => <NavLink key={to} to={to} aria-label={accessibleLabel(to, label)}
            className={({isActive}) => `flex h-12 w-full shrink-0 items-center gap-3 rounded-2xl ${desktopRowInsetClass} focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-300 ${isActive ? 'bg-white/20 text-white' : 'text-slate-200 hover:text-white hover:bg-white/10'}`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center"><span className="relative"><Icon className="h-5 w-5" /></span></span>
            <span className={desktopLabelClass}>{label}</span>
          </NavLink>)}
        </nav>
      </div>
      <button type="button" onClick={signOut} aria-label="Đăng xuất" className={`flex h-12 w-full shrink-0 items-center gap-3 rounded-2xl bg-red-500 text-white hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-300 ${desktopRowInsetClass}`}>
        <span className="flex h-11 w-12 shrink-0 items-center justify-center"><LogOut className="h-5 w-5" /></span>
        <span className={desktopLabelClass}>Đăng xuất</span>
      </button>
    </aside>
    <nav aria-label="Menu di động" className="lg:hidden fixed bottom-0 left-0 right-0 bg-soft-sidebar/95 dark:bg-soft-sidebarDark/95 backdrop-blur-md border-t border-white/10 flex items-center gap-1 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-40 shadow-soft-lg">
      {primaryItems.map(navLink)}
      <button ref={moreButton} type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} aria-controls="mobile-navigation" aria-haspopup="dialog" className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal-300"><Menu className="h-5 w-5" /><span className="text-[11px] font-medium">Thêm</span></button>
    </nav>
    <dialog ref={moreDialog} id="mobile-navigation" aria-labelledby="mobile-navigation-title" onCancel={closeMore} onClose={() => setMoreOpen(false)} onClick={event => { if (event.target === event.currentTarget) closeMore(); }} className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 id="mobile-navigation-title" className="text-lg font-bold">Điều hướng</h2><button type="button" autoFocus onClick={closeMore} aria-label="Đóng menu" className="rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
      <nav aria-label="Tất cả chức năng" className="grid gap-2">{visibleItems.map(({ to, icon: Icon, label }) => <NavLink key={to} to={to} onClick={closeMore} className={({isActive}) => `flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${isActive ? 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon className="h-5 w-5 shrink-0" />{label}</NavLink>)}</nav>
      <button type="button" onClick={() => { closeMore(); signOut(); }} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700"><LogOut className="h-5 w-5" />Đăng xuất</button>
    </dialog>
  </>;
}
