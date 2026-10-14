import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { GraduationCap, Home, User, Cpu, LogOut, Building2, Award, BookOpen, BarChart3, Target, ClipboardList } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function NotificationCountBadge({ count }) {
  if (count <= 0) return null;
  return <span aria-hidden="true" data-notification-badge className="pointer-events-none absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-[#274b64]">{count > 99 ? '99+' : count}</span>;
}

const navItems = [
  { to: '/me/dashboard', icon: Home, label: 'Trang chủ', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
  { to: '/me/profile', icon: User, label: 'Hồ sơ năng lực', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER'] },
  { to: '/achievements', icon: Award, label: 'Thành tích', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
  { to: '/kpi', icon: Target, label: 'Mục tiêu / KPI', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'] },
  { to: '/award-applications', icon: ClipboardList, label: 'Hồ sơ đề nghị', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'COUNCIL'] },
  { to: '/awards', icon: Award, label: 'Khen thưởng', roles: ['RECORDS_OFFICER'] },
  { to: '/regulations', icon: BookOpen, label: 'Kho quy định', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
  { to: '/me/ai-forecast', icon: Cpu, label: 'Phân tích & Thẩm định AI', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
  { to: '/reports', icon: BarChart3, label: 'Báo cáo / CSV', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
  { to: '/organizations', icon: Building2, label: 'Tổ chức', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
  { to: '/admin', icon: User, label: 'Quản trị', roles: ['ADMIN'] },
];

export default function Sidebar() {
  const { signOut, user } = useAuth();
  const accessibleLabel = (_to, label) => label;
  const roles = (user?.roles || []).map((role) => typeof role === 'string' ? role : role.code);
  const visibleItems = navItems.filter((item) => item.roles.some((role) => roles.includes(role)));
  const desktopRowInsetClass = 'px-0 group-hover/sidebar:px-3 group-has-[:focus-visible]/sidebar:px-3 transition-[padding,background-color,color] duration-300 motion-reduce:transition-none';
  const desktopLabelClass = 'min-w-0 flex-1 whitespace-nowrap text-left text-[15px] font-semibold leading-5 opacity-0 translate-x-2 transition-[opacity,transform] duration-200 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-has-[:focus-visible]/sidebar:opacity-100 group-has-[:focus-visible]/sidebar:translate-x-0 motion-reduce:transition-none';
  const navLink = ({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to} title={label} aria-label={accessibleLabel(to, label)}
      className={({isActive}) => `w-11 h-11 rounded-2xl flex flex-col items-center justify-center transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-slate-200 hover:text-white hover:bg-white/10'}`}>
      <span className="relative"><Icon className="w-5 h-5" /></span>
      <span className="text-[9px] mt-1">{label}</span>
    </NavLink>
  );
  return <>
    <aside aria-label="Điều hướng desktop" className="group/sidebar hidden lg:flex fixed left-5 top-1/2 -translate-y-1/2 max-h-[calc(100dvh-40px)] w-[76px] hover:w-[272px] has-[:focus-visible]:w-[272px] overflow-hidden bg-gradient-to-b from-[#182b3d] via-[#274b64] to-[#365f79] dark:from-[#111c2a] dark:to-[#223e52] rounded-[32px] flex-col items-start px-3.5 py-4 z-30 shadow-soft-lg text-white transition-[width] duration-300 ease-out motion-reduce:transition-none">
      <Link to="/me/dashboard" aria-label="Trang chủ LHU" className={`flex h-12 w-full shrink-0 items-center gap-3 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-300 ${desktopRowInsetClass}`}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><GraduationCap /></span>
        <span className={desktopLabelClass}><span className="block font-bold text-white">LHU</span><span className="block text-xs text-slate-300">Quản lý thành tích</span></span>
      </Link>
      <div className="my-4 min-h-0 w-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav aria-label="Menu chính" className="flex flex-col gap-2">
          {visibleItems.map(({to, icon: Icon, label}) => <NavLink key={to} to={to} aria-label={accessibleLabel(to, label)}
            className={({isActive}) => `flex h-12 w-full shrink-0 items-center gap-3 rounded-2xl ${desktopRowInsetClass} focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-300 ${isActive ? 'bg-white/20 text-white' : 'text-slate-200 hover:text-white hover:bg-white/10'}`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center"><span className="relative"><Icon className="h-5 w-5" /></span></span>
            <span className={desktopLabelClass}>{to === '/me/ai-forecast' ? <><span className="block">Phân tích &</span><span className="block">Thẩm định AI</span></> : label}</span>
          </NavLink>)}
        </nav>
      </div>
      <button type="button" onClick={signOut} aria-label="Đăng xuất" className={`flex h-12 w-full shrink-0 items-center gap-3 rounded-2xl bg-red-500 text-white hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-300 ${desktopRowInsetClass}`}>
        <span className="flex h-11 w-12 shrink-0 items-center justify-center"><LogOut className="h-5 w-5" /></span>
        <span className={desktopLabelClass}>Đăng xuất</span>
      </button>
    </aside>
    <nav aria-label="Menu di động" className="lg:hidden fixed bottom-3 left-3 right-3 min-h-16 bg-soft-sidebar/95 dark:bg-soft-sidebarDark/95 backdrop-blur-md rounded-full flex items-center justify-around px-2 py-2 z-40 shadow-soft-lg">
      {visibleItems.map(navLink)}
      <button onClick={signOut} aria-label="Đăng xuất" className="flex flex-col items-center gap-1 rounded-xl bg-red-500 px-2 py-2 text-white transition-colors hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"><LogOut className="w-5 h-5" /><span className="text-[9px]">Đăng xuất</span></button>
    </nav>
  </>;
}
