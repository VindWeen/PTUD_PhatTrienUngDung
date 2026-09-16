import React, { useState } from 'react';
import { Bell } from 'lucide-react';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <button title="Thông báo" aria-expanded={open} onClick={() => setOpen(!open)} className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-soft-sm"><Bell className="w-5 h-5" /></button>
    {open && <div role="status" className="absolute right-0 top-14 z-50 w-60 p-4 soft-card text-sm">Chưa có thông báo mới trong bản giao diện mẫu.</div>}
  </div>;
}
