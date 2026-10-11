import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../services/notificationsApi';
export default function useNotifications(page = 1, pageSize = 20, unreadOnly = false) {
 const { user } = useAuth();
 const [result,setResult] = useState(null);
 const [error,setError] = useState('');
 const [busy,setBusy] = useState(true);
 const [revision,setRevision] = useState(0);
 const [unreadSummary,setUnreadSummary] = useState(null);
 const freshNext = useRef(false);
 useEffect(() => {
  let active = true;
  setResult(null); setBusy(true); setError('');
  const fresh = freshNext.current;
  freshNext.current = false;
  notificationsApi.list({page,pageSize,unreadOnly:String(unreadOnly)}, fresh).then(data => {
   if (active) {
    setResult(data);
    setUnreadSummary({ userId: user?.userId, count: data?.unreadCount ?? 0 });
   }
  }).catch(e => { if(active) setError(e.message || 'Không tải được thông báo'); })
   .finally(() => { if(active) setBusy(false); });
  return () => { active = false; };
 },[user,page,pageSize,unreadOnly,revision]);
 useEffect(() => {
  const refresh = () => { freshNext.current = true; setRevision(r=>r+1); };
  window.addEventListener('focus',refresh);
  window.addEventListener('notifications-changed',refresh);
  const timer = setInterval(() => { if(!document.hidden) refresh(); },60000);
  return () => { clearInterval(timer); window.removeEventListener('focus',refresh); window.removeEventListener('notifications-changed',refresh); };
 },[]);
 const unreadCount = unreadSummary?.userId === user?.userId ? (unreadSummary?.count ?? 0) : 0;
 return { result,error,busy,unreadCount,reload:() => { freshNext.current = true; setRevision(r=>r+1); } };
}
