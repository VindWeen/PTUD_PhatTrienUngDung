import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../services/notificationsApi';
export default function useNotifications(page = 1, pageSize = 20, unreadOnly = false) {
 const { user } = useAuth();
 const [result,setResult] = useState(null);
 const [error,setError] = useState('');
 const [busy,setBusy] = useState(true);
 const [revision,setRevision] = useState(0);
 useEffect(() => {
  let active = true;
  setResult(null); setBusy(true); setError('');
  notificationsApi.list({page,pageSize,unreadOnly:String(unreadOnly)}).then(data => {
   if (active) setResult(data);
  }).catch(e => { if(active) setError(e.message || 'Không tải được thông báo'); })
   .finally(() => { if(active) setBusy(false); });
  return () => { active = false; };
 },[user,page,pageSize,unreadOnly,revision]);
 useEffect(() => {
  const refresh = () => setRevision(r=>r+1);
  window.addEventListener('focus',refresh);
  window.addEventListener('notifications-changed',refresh);
  const timer = setInterval(() => { if(!document.hidden) refresh(); },60000);
  return () => { clearInterval(timer); window.removeEventListener('focus',refresh); window.removeEventListener('notifications-changed',refresh); };
 },[]);
 return { result,error,busy,reload:() => setRevision(r=>r+1) };
}
