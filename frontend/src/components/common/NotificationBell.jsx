import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import useNotifications from '../../hooks/useNotifications';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { result,error,busy,reload } = useNotifications(1,5,true);
  return <div className="relative">
    <button title="Thông báo" aria-label={`Thông báo: ${result?.unreadCount ?? 'chưa tải'} chưa đọc`} aria-expanded={open} onClick={() => {setOpen(!open);if(!open) reload();}} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-soft-sm"><Bell className="w-5 h-5" />{result?.unreadCount>0 && <span className="absolute -top-1 -right-1 rounded-full bg-red-600 text-white text-xs px-1">{result.unreadCount}</span>}</button>
    {open && <div className="absolute right-0 top-14 z-50 w-64 p-4 soft-card text-sm space-y-3"><p role="status">{busy ? 'Đang tải…' : error || `${result?.unreadCount ?? 0} thông báo chưa đọc`}</p><Link to="/notifications" onClick={()=>setOpen(false)} className="underline">Xem tất cả thông báo</Link></div>}
  </div>;
}
