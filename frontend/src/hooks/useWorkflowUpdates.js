import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../services/notificationsApi';
import { clearReadCache } from '../services/readCache';
import { USE_FIXTURES } from '../services/apiConfig';

// Share one poll across the layout so notifications and visible workflows agree.
export default function useWorkflowUpdates() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user?.userId || USE_FIXTURES) return;
    let active = true;
    let pending = false;
    let latest = null;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const data = await notificationsApi.list({ page: 1, pageSize: 20 }, true);
        if (!active) return;
        const signature = (data.items || []).map(n => n.notificationId).join(',');
        if (signature !== latest) {
          latest = signature;
          clearReadCache();
          window.dispatchEvent(new CustomEvent('workflow-updated', { detail: data.items || [] }));
          window.dispatchEvent(new Event('notifications-changed'));
        }
      } catch {
        // A temporary connection failure should not interrupt the user's work.
      } finally { pending = false; }
    };
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.userId]);
}
