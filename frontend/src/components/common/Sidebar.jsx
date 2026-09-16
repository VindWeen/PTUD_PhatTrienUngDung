import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { GraduationCap, Home, User, Cpu, LogOut } from 'lucide-react';
import { useDemoAuth } from '../../hooks/useDemoAuth';

const navItems = [
  { to: '/', icon: Home, label: 'Trang chủ' },
  { to: '/profile', icon: User, label: 'Hồ sơ năng lực' },
  { to: '/ai-forecast', icon: Cpu, label: 'Phân tích & Dự báo AI' },
];

export default function Sidebar() {
  const { signOut } = useDemoAuth();
  return <>
    <aside className="hidden lg:flex fixed left-5 top-5 bottom-5 w-[76px] bg-soft-sidebar dark:bg-soft-sidebarDark rounded-[32px] flex-col items-center py-6 z-30 shadow-soft-lg text-white">
      <Link to="/" aria-label="Trang chủ LHU" className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><GraduationCap /></Link>
      <nav aria-label="Menu chính" className="flex flex-col items-center gap-5 my-auto">
        {navItems.map(({to, icon: Icon, label}) => <NavLink key={to} to={to} end={to === '/'} title={label} aria-label={label}
          className={({isActive}) => `w-11 h-11 rounded-2xl flex items-center justify-center group relative transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
          <Icon className="w-5 h-5" />
          <span className="absolute left-16 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span>
        </NavLink>)}
      </nav>
      <button onClick={signOut} title="Đăng xuất demo" aria-label="Đăng xuất demo" className="p-3 text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
    </aside>
    <nav aria-label="Menu di động" className="lg:hidden fixed bottom-3 left-3 right-3 min-h-16 bg-soft-sidebar/95 dark:bg-soft-sidebarDark/95 backdrop-blur-md rounded-full flex items-center justify-around px-2 py-2 z-40 shadow-soft-lg">
      {navItems.map(({to, icon: Icon, label}) => <NavLink key={to} to={to} end={to === '/'} aria-label={label}
        className={({isActive}) => `flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-colors ${isActive ? 'text-white bg-white/15' : 'text-slate-400 hover:text-white'}`}>
        <Icon className="w-5 h-5" /><span className="text-[9px] font-semibold">{label}</span>
      </NavLink>)}
      <button onClick={signOut} aria-label="Đăng xuất demo" className="flex flex-col items-center gap-1 px-2 py-2 text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /><span className="text-[9px]">Đăng xuất</span></button>
    </nav>
  </>;
}
