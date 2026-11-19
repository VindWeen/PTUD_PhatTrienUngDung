import { useCallback, useEffect, useRef, useState } from 'react';
import { api, array } from '../services/vaultApi';

export function useCollection(url) {
  const [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!url) { setData(null); setError(null); setLoading(false); return; }
    if (!url) { setData(null); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const rows = [];
      let page = 1;
      while (true) {
        const result = await api(`${url}${url.includes('?') ? '&' : '?'}pageSize=100&page=${page}`);
        if (current !== generation.current) return;
        const batch = array(result);
        rows.push(...batch);
        if (batch.length < 100 || (result.total != null && rows.length >= result.total)) break;
        page++;
      }
      setData({ items: rows, total: rows.length });
    } catch (e) {
      if (current === generation.current) setError(e);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    const counter = generation;
    reload();
    return () => { counter.current++; };
  }, [reload]);

  return { data, error, loading, reload };
}
