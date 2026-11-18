import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, RefreshCw, X } from 'lucide-react';
import { request } from '../../services/request';
import './notification-dropdown.css';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true), [error, setError] = useState(null), [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const container = useRef(null), trigger = useRef(null), sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true); setError(null);
    try {
      const result = await request({ url: '/notifications?page=1&pageSize=10', fresh: true });
      if (current === sequence.current) { setData(result); setPage(1); }
    } catch (err) { if (current === sequence.current) setError(err); }
    finally { if (current === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => { const generation = sequence; load(); return () => { generation.current++; }; }, [load]);
  useEffect(() => {
    if (!open) return;
    load();
    const outside = event => { if (!container.current?.contains(event.target)) setOpen(false); };
    const escape = event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, load]);
  async function markRead(notification = null) {
    setBusy(true); setError(null);
    try {
      await request({ url: notification ? `/notifications/${notification.id}/read` : '/notifications/read-all', method: notification ? 'PATCH' : 'POST' });
      await load();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  async function loadMore() {
    setBusy(true); setError(null);
    try {
      const result = await request({ url: `/notifications?page=${page + 1}&pageSize=10`, fresh: true });
      setData(previous => ({ ...result, items: [...previous.items, ...result.items.filter(item => !previous.items.some(old => old.id === item.id))] }));
      setPage(previous => previous + 1);
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return <div className="notification-dropdown" ref={container} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="workspace-icon-button notification-trigger" aria-label={data.unreadCount ? `Thông báo, ${data.unreadCount} chưa đọc` : "Thông báo"} aria-expanded={open} aria-controls="topbar-notifications" onClick={() => setOpen(value => !value)}>
      <Bell size={19} aria-hidden="true" />
      {data.unreadCount > 0 && <span className="notification-count" aria-hidden="true">{data.unreadCount > 99 ? '99+' : data.unreadCount}</span>}
    </button>
    {open && <section id="topbar-notifications" className="notification-panel" aria-label="Thông báo của bạn" aria-busy={loading}>
      <header><div><h2>Thông báo</h2><p>{data.unreadCount || 0} thông báo chưa đọc</p></div><button type="button" className="notification-close" aria-label="Đóng thông báo" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18} /></button></header>
      <div className="notification-toolbar"><button type="button" disabled={busy || loading || !data.unreadCount} onClick={() => markRead()}><CheckCheck size={16} aria-hidden="true" />Đánh dấu tất cả đã đọc</button><button type="button" disabled={loading || busy} onClick={load} aria-label="Làm mới thông báo"><RefreshCw size={16} /></button></div>
      {error && <p className="notification-error" role="alert">Không tải hoặc cập nhật được thông báo. {error.message}</p>}
      {loading && !data.items.length ? <p className="notification-empty" role="status">Đang tải thông báo…</p> : !error && !data.items.length ? <div className="notification-empty"><Bell size={26} aria-hidden="true" /><strong>Bạn đã xem hết rồi</strong><p>Thông báo mới từ tổ chức sẽ xuất hiện tại đây.</p></div> : <div className="notification-list">{data.items.map(item => <article key={item.id} className={item.isRead ? '' : 'is-unread'}><h3>{!item.isRead && <span className="notification-unread-dot" aria-label="Chưa đọc" />} {item.title}</h3><p>{item.message || item.body}</p><footer><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>{!item.isRead && <button type="button" disabled={busy} aria-label={`Đánh dấu đã đọc: ${item.title}`} onClick={() => markRead(item)}>Đã đọc</button>}</footer></article>)}</div>}
      {data.total > data.items.length && <div className="notification-footnote"><button type="button" disabled={busy || loading} onClick={loadMore}>Xem thêm thông báo</button><p>Đang hiển thị {data.items.length} trong tổng số {data.total}.</p></div>}
    </section>}
  </div>;
}
