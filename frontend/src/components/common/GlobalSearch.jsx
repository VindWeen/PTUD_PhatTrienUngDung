import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, LoaderCircle, Search, X } from 'lucide-react';
import { request } from '../../services/request';
import { useAuth } from '../../context/AuthContext';

const rows = data => Array.isArray(data) ? data : data?.items || [];
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi').trim();
const pages = [
  ['Trang chủ', '/me/dashboard'], ['Hồ sơ & CV', '/me/profile'],
  ['Thiết kế & Xuất CV', '/me/profile?tab=cv'], ['Kho thành tích', '/achievements'],
  ['Mục tiêu / KPI', '/kpi'], ['Khám hồ sơ', '/me/ai-forecast'],
  ['Kho quy chế', '/regulations'], ['Tổ chức', '/organizations'],
  ['Thống kê & Báo cáo', '/reports'],
];
const sources = [
  { name: 'Thành tích', url: '/achievements', field: 'title', to: item => `/achievements?search=${encodeURIComponent(item.title)}`, serverSearch: true },
  { name: 'Mục tiêu / KPI', url: '/kpi/goals', field: 'title', to: () => '/kpi', limited: true },
  { name: 'Quy chế', url: '/regulations/documents', field: 'name', to: () => '/regulations', limited: true },
  { name: 'Tổ chức', url: '/organizations', field: 'name', to: () => '/organizations' },
];

export default function GlobalSearch() {
  const { user } = useAuth();
  const location = useLocation();
  const id = useId();
  const root = useRef(null), input = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ query: '', results: [], failures: [], limited: [], loading: false });
  const term = query.trim();
  const matchingPages = pages.filter(([title]) => normalize(title).includes(normalize(term)));
  const isAdmin = (user?.roles || []).some(role => (typeof role === 'string' ? role : role.code) === 'SYSTEM_ADMIN');
  if (isAdmin && normalize('Quản trị hệ thống').includes(normalize(term))) matchingPages.push(['Quản trị hệ thống', '/admin']);

  useEffect(() => { setOpen(false); }, [location.key]);
  useEffect(() => {
    const dismiss = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  useEffect(() => {
    if (!open || term.length < 2) return;
    const controller = new AbortController();
    let active = true;
    setState({ query: term, results: [], failures: [], limited: [], loading: true });
    const timer = window.setTimeout(async () => {
      const responses = await Promise.allSettled(sources.map(source => {
        const params = new URLSearchParams({ page: '1', pageSize: '100' });
        if (source.serverSearch) params.set('search', term);
        // Query-string URLs keep these cancellable reads out of the shared read cache.
        return request({ url: `${source.url}?${params}`, method: 'GET', signal: controller.signal });
      }));
      if (!active || controller.signal.aborted) return;
      const results = [], failures = [], limited = [];
      responses.forEach((response, index) => {
        const source = sources[index];
        if (response.status === 'rejected') { failures.push(source.name); return; }
        const items = rows(response.value);
        if (source.limited && items.length >= 100) limited.push(source.name);
        const matches = items.filter(item => source.serverSearch || normalize([item[source.field], item.code, item.description, item.issuer].filter(Boolean).join(' ')).includes(normalize(term)));
        matches.slice(0, 5).forEach(item => results.push({
          key: `${source.url}:${item.id}`, title: item[source.field], to: source.to(item),
          type: source.name, description: source.serverSearch ? 'Xem thành tích phù hợp' : `Mở danh sách ${source.name.toLocaleLowerCase('vi')}`,
        }));
      });
      setState({ query: term, results, failures, limited, loading: false });
    }, 350);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [term, open, retry]);

  const loading = term.length >= 2 && (state.query !== term || state.loading);
  const results = state.query === term ? state.results : [];
  const failures = state.query === term ? state.failures : [];
  const limited = state.query === term ? state.limited : [];
  const focusClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:focus-visible:outline-teal-300';

  return <div ref={root} className="global-search relative min-w-0 w-full max-w-lg" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); input.current?.focus(); setOpen(false); } }}>
    <label htmlFor={`${id}-input`} className="sr-only">Tìm kiếm toàn hệ thống</label>
    <div className="global-search-field flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-600 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      <Search size={18} aria-hidden="true" className="shrink-0" />
      <input ref={input} id={`${id}-input`} type="search" autoComplete="off" maxLength={100} value={query} placeholder="Tìm thành tích, mục tiêu, quy chế…" aria-expanded={open} aria-controls={open ? `${id}-results` : undefined} aria-describedby={`${id}-hint`} className="min-w-0 w-full bg-transparent py-3 text-sm text-slate-800 placeholder:text-slate-600 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden" onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} />
      {query && <button type="button" aria-label="Xóa từ khóa tìm kiếm" className={`-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 ${focusClass}`} onClick={() => { setQuery(''); input.current?.focus(); }}><X size={17} aria-hidden="true" /></button>}
    </div>
    <span id={`${id}-hint`} className="sr-only">Nhập từ hai ký tự, tối đa 100 ký tự. Dùng phím Tab để chọn kết quả, Escape để đóng.</span>
    {open && <section id={`${id}-results`} aria-label="Kết quả tìm kiếm" aria-busy={loading} className="global-search-results absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(65dvh,32rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      {term.length < 2 ? <p className="px-3 py-4 text-sm text-slate-600 dark:text-slate-300">Nhập ít nhất 2 ký tự để tìm trong dữ liệu và các trang.</p> : <>
        {matchingPages.length > 0 && <div className="global-search-pages"><h2 className="px-3 pb-1 pt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Đi đến trang</h2>{matchingPages.map(([title, to]) => <Link key={to} to={to} onClick={() => setOpen(false)} className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-teal-50 dark:hover:bg-slate-800 ${focusClass}`}><span>{title}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div>}
        <div role="status" aria-live="polite" className="global-search-status px-3 py-2 text-sm text-slate-600 dark:text-slate-300">{loading ? <span className="flex items-center gap-2"><LoaderCircle size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />Đang tìm dữ liệu…</span> : `${results.length} kết quả dữ liệu${results.length ? ' · tối đa 5 mục mỗi loại' : ''}.`}</div>
        {!loading && results.map(result => <Link key={result.key} to={result.to} onClick={() => setOpen(false)} className={`global-search-result block min-h-11 rounded-lg px-3 py-3 hover:bg-teal-50 dark:hover:bg-slate-800 ${focusClass}`}><span className="block break-words text-sm font-semibold">{result.title}</span><span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{result.type} · {result.description}</span></Link>)}
        {!loading && !results.length && !matchingPages.length && !failures.length && <p className="px-3 pb-3 text-sm text-slate-600 dark:text-slate-300">Không có kết quả phù hợp. Thử tên hoặc từ khóa khác.</p>}
        {!loading && failures.length > 0 && <div className="global-search-error px-3 py-2 text-sm text-rose-800 dark:text-rose-200"><p role="alert">Chưa tìm được trong: {failures.join(', ')}. Hãy thử tải lại.</p><button type="button" className={`mt-1 min-h-11 rounded-lg px-2 font-semibold underline underline-offset-4 ${focusClass}`} onClick={() => setRetry(value => value + 1)}>Thử lại tìm kiếm</button></div>}
        {!loading && limited.length > 0 && <p className="global-search-limit px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{limited.join(', ')}: tìm trong 100 mục đầu tiên. Mở trang tương ứng để xem thêm.</p>}
      </>}
    </section>}
  </div>;
}
