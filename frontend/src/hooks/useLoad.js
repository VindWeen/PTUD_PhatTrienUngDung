import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/vaultApi';

export function useLoad(url) {
  const [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const value = await api(url);
      if (current === generation.current) setData(value);
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
