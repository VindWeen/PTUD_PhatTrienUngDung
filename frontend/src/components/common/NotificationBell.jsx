import { useLocation } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import useNotifications from '../../hooks/useNotifications';
import { notificationsApi } from '../../services/notificationsApi';

const labels = { SUBMITTED: 'Đã gửi', VERIFIED: 'Đã xác nhận', RECORDED: 'Đã ghi nhận', NEED_CORRECTION: 'Cần bổ sung', REJECTED: 'Bị từ chối', REVOKED: 'Đã thu hồi', CANCELLED: 'Đã hủy', COUNCIL_PENDING: 'Chờ Hội đồng', UNDER_REVIEW: 'Đang xét duyệt', RECOMMENDED: 'Được đề nghị khen thưởng', NOT_RECOMMENDED: 'Không được đề nghị' };

export default function NotificationBell() {
  const { search: routeSearch } = useLocation();
  const [open, setOpen] = useState(() => new URLSearchParams(routeSearch).get('notifications') === '1');
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [reading, setReading] = useState(null);
  const container = useRef(null);
  const { result,error,busy,reload,unreadCount } = useNotifications(page,8,unread);
  useEffect(() => {
    if (!open) return;
    const outside = e => { if (!container.current?.contains(e.target)) setOpen(false); };
    const escape = e => { if (e.key === 'Escape') { setOpen(false); container.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  async function read(id) {
    setReading(id); setWriteError('');
    try { await notificationsApi.read(id); window.dispatchEvent(new Event('notifications-changed')); }
    catch (e) { setWriteError(e.message); } finally { setReading(null); }
  }
  return <div ref={container} className="relative shrink-0">
    <button type="button" title="Thông báo" aria-label={`Thông báo: ${unreadCount} chưa đọc`} aria-expanded={open} aria-controls="notification-popover" onClick={() => setOpen(!open)} className="soft-btn-secondary relative h-11 w-11 !p-0"><Bell className="w-5 h-5" />{unreadCount>0 && <span className="absolute -top-1 -right-1 rounded-full bg-rose-600 text-white text-[10px] px-1.5">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
    {open && <section id="notification-popover" aria-label="Danh sách thông báo" className="fixed left-4 right-4 top-24 z-50 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-[400px]">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700"><strong>Thông báo ({unreadCount} chưa đọc)</strong><button type="button" aria-label="Đóng thông báo" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
      <div className="flex justify-between p-3 text-xs"><label className="flex gap-2"><input type="checkbox" checked={unread} onChange={e => {setUnread(e.target.checked);setPage(1);}} />Chỉ chưa đọc</label><button type="button" disabled={busy} onClick={reload} className="text-teal-600">Làm mới</button></div>
      <div className="max-h-[min(55vh,460px)] overflow-y-auto overscroll-contain">
        {(error || writeError) && <p role="alert" className="p-4 text-sm text-rose-600">{error || writeError}</p>}
        {busy && <p role="status" className="p-4 text-xs text-slate-500">Đang tải…</p>}
        {!busy && !error && !result?.items?.length && <p className="p-6 text-center text-sm text-slate-500">Chưa có thông báo.</p>}
        {result?.items?.map(n => <div key={n.notificationId} className={`border-t border-slate-100 p-4 dark:border-slate-800 ${!n.readAt ? 'bg-teal-50/60 dark:bg-teal-950/20' : ''}`}><p className="text-sm font-semibold">{n.entityType === 'APPLICATION' ? 'Hồ sơ đề nghị' : n.entityType === 'AWARD' ? 'Khen thưởng' : 'Thành tích'} #{n.entityId}: {labels[n.toStatus] || n.toStatus}</p><div className="mt-2 flex justify-between gap-3 text-xs text-slate-500"><time>{new Date(n.createdAt).toLocaleString('vi-VN')}</time>{!n.readAt && <button type="button" disabled={reading !== null} onClick={() => read(n.notificationId)} className="flex items-center gap-1 text-teal-600"><Check className="h-3 w-3" />Đã đọc</button>}</div></div>)}
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 p-3 text-xs dark:border-slate-700"><button type="button" aria-label="Trang trước" disabled={page<=1 || busy} onClick={() => setPage(p=>p-1)} className="disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span>Trang {page} / {Math.max(1,Math.ceil((result?.total || 0)/8))}</span><button type="button" aria-label="Trang tiếp" disabled={page*8 >= (result?.total || 0) || busy} onClick={() => setPage(p=>p+1)} className="disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div>
    </section>}
  </div>;
}
