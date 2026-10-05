import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { GraduationCap, Home, User, Cpu, LogOut, Building2, Award, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/notifications', icon: Bell, label: 'Thông báo', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
  { to: '/awards', icon: Award, label: 'Khen thưởng', roles: ['RECORDS_OFFICER'] },
  { to: '/admin', icon: User, label: 'Quản trị', roles: ['ADMIN'] },
  { to: '/me/dashboard', icon: Home, label: 'Trang chủ', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
  { to: '/achievements', icon: Award, label: 'Thành tích', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
  { to: '/me/profile', icon: User, label: 'Hồ sơ năng lực', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER'] },
  { to: '/me/ai-forecast', icon: Cpu, label: 'Phân tích & Dự báo AI', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER'] },
  { to: '/organizations', icon: Building2, label: 'Tổ chức', roles: ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'] },
];

export default function Sidebar() {
  const { signOut, user } = useAuth();
  const roles = (user?.roles || []).map((role) => typeof role === 'string' ? role : role.code);
  const visibleItems = navItems.filter((item) => item.roles.some((role) => roles.includes(role)));
  const navLink = ({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to} title={label} aria-label={label}
      className={({isActive}) => `w-11 h-11 rounded-2xl flex flex-col items-center justify-center group relative transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
      <Icon className="w-5 h-5" />
      <span className="hidden lg:block absolute left-16 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span>
      <span className="lg:hidden text-[9px] mt-1">{label}</span>
    </NavLink>
  );
  return <>
    <aside className="hidden lg:flex fixed left-5 top-5 bottom-5 w-[76px] bg-gradient-to-b from-[#182b3d] via-[#274b64] to-[#365f79] dark:from-[#111c2a] dark:to-[#223e52] rounded-[32px] flex-col items-center py-6 z-30 shadow-soft-lg text-white">
      <Link to="/me/dashboard" aria-label="Trang chủ LHU" className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><GraduationCap /></Link>
      <nav aria-label="Menu chính" className="flex flex-col items-center gap-5 my-auto">{visibleItems.map(navLink)}</nav>
      <button onClick={signOut} title="Đăng xuất" aria-label="Đăng xuất" className="p-3 text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
    </aside>
    <nav aria-label="Menu di động" className="lg:hidden fixed bottom-3 left-3 right-3 min-h-16 bg-soft-sidebar/95 dark:bg-soft-sidebarDark/95 backdrop-blur-md rounded-full flex items-center justify-around px-2 py-2 z-40 shadow-soft-lg">
      {visibleItems.map(navLink)}
      <button onClick={signOut} aria-label="Đăng xuất" className="flex flex-col items-center gap-1 px-2 py-2 text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /><span className="text-[9px]">Đăng xuất</span></button>
    </nav>
  </>;
}
