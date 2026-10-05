import React, { useState } from 'react';
import useNotifications from '../hooks/useNotifications';
import { notificationsApi } from '../services/notificationsApi';
export function notificationText(n) {
 const label = {SUBMITTED:'đã gửi',NEED_CORRECTION:'cần bổ sung',VERIFIED:'đã xác nhận',REJECTED:'bị từ chối',CANCELLED:'đã hủy',REVOKED:'đã thu hồi',RECORDED:'đã ghi nhận quyết định'};
 return `${n.entityType === 'AWARD' ? 'Bản ghi khen thưởng' : 'Thành tích'} #${n.entityId}: ${label[n.toStatus] || n.toStatus}`;
}
export default function Notifications() {
 const [page,setPage] = useState(1);
 const [unread,setUnread] = useState(false);
 const [reading,setReading] = useState(null);
 const [writeError,setWriteError] = useState('');
 const {result,error,busy,reload} = useNotifications(page,20,unread);
 async function read(id) {
  setReading(id); setWriteError('');
  try { await notificationsApi.read(id); window.dispatchEvent(new Event('notifications-changed')); }
  catch(e) { setWriteError(e.message || 'Không đánh dấu được thông báo'); }
  finally { setReading(null); }
 }
 return <section className="soft-card p-6 space-y-4">
  <h1 className="text-2xl font-bold">Thông báo</h1>
  <p>{result?.unreadCount ?? '—'} thông báo chưa đọc</p>
  <label className="flex gap-2"><input type="checkbox" checked={unread} onChange={e=>{setUnread(e.target.checked);setPage(1);}} />Chỉ chưa đọc</label>
  <button onClick={reload} className="underline">Làm mới</button>
  {(error || writeError) && <p role="alert">{error || writeError}</p>}
  {busy && <p role="status">Đang tải thông báo…</p>}
  {!busy && !error && result?.items.length === 0 && <p>Không có thông báo trong phạm vi hiện tại.</p>}
  <ul className="space-y-3">{result?.items.map(n=><li key={n.notificationId} className="border rounded-xl p-4 flex flex-wrap gap-3 justify-between">
   <div><p className={n.readAt ? '' : 'font-semibold'}>{notificationText(n)}</p><time className="text-sm text-slate-500">{new Date(n.createdAt).toLocaleString('vi-VN')}</time></div>
   {n.readAt ? <span>Đã đọc</span> : <button disabled={reading !== null} onClick={()=>read(n.notificationId)} className="underline">{String(reading) === String(n.notificationId) ? 'Đang lưu…' : 'Đánh dấu đã đọc'}</button>}
  </li>)}</ul>
  <div className="flex gap-4 items-center"><button disabled={page===1 || busy} onClick={()=>setPage(p=>p-1)}>Trước</button><span>Trang {page}</span><button disabled={busy || !result || page*20>=result.total} onClick={()=>setPage(p=>p+1)}>Sau</button></div>
 </section>;
}
