import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../services/apiConfig';
import CvDocument from '../components/CvDocument';

export default function PublicCv() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex, nofollow'; document.head.appendChild(meta);
    setState({ loading: true });
    fetch(`${API_BASE_URL}/cv/${encodeURIComponent(id)}`, { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
      .then(async response => { if (!response.ok) throw new Error('CV không tồn tại hoặc đã ngừng chia sẻ.'); return response.json(); })
      .then(body => setState({ cv: body.data })).catch(error => { if (error.name !== 'AbortError') setState({ error: error.message }); });
    return () => { controller.abort(); meta.remove(); };
  }, [id]);
  return <main className="min-h-screen bg-slate-100 px-4 py-10">{state.loading ? <p className="text-center">Đang tải CV...</p> : state.error ? <p role="alert" className="text-center text-slate-600">{state.error}</p> : <CvDocument cv={state.cv} />}</main>;
}
