import Select from './common/Select';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter, Plus } from 'lucide-react';
import { achievementsApi } from '../services/achievementsApi';
import PortfolioAchievementDialog from './PortfolioAchievementDialog';
import { LoadingState } from './common/AsyncState';

const statuses = { DRAFT: 'Bản nháp', SUBMITTED: 'Chờ duyệt', NEED_CORRECTION: 'Cần bổ sung', VERIFIED: 'Đã xác nhận', REJECTED: 'Bị từ chối', CANCELLED: 'Đã hủy', REVOKED: 'Đã thu hồi' };
export default function PortfolioAchievements({ profile, activeTab }) {
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [types, setTypes] = useState([]);
  const [type, setType] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => { achievementsApi.listAchievementTypes().then(setTypes).catch(e => setError(e.message)); }, []);
  useEffect(() => { setPage(1); setSelected(null); }, [activeTab, status, year, search, type]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const out = await achievementsApi.list({ subjectType: 'LECTURER', lecturerId: profile.lecturerId, category: activeTab === 'nckh' ? 'RESEARCH' : activeTab === 'teaching' ? 'TEACHING' : undefined, page, pageSize: 12, status: status || undefined, recognitionYear: year || undefined, search: search || undefined, achievementTypeId: type || undefined });
        if (active) { setItems(out.items || []); setTotalPages(out.pagination?.totalPages || 1); }
      } catch (e) { if (active) { setError(e.message); setItems([]); } }
      finally { if (active) setLoading(false); }
    }, search ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [profile.lecturerId, page, status, year, search, type, revision, activeTab]);
  const field = 'soft-input w-full';
  const shown = items;
  const visiblePages = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : [...new Set([1, ...Array.from({ length: 3 }, (_, i) => Math.max(2, Math.min(page - 1, totalPages - 3)) + i), totalPages])];
  const pageButtons = visiblePages.flatMap((number, i) => {
    const gap = number - visiblePages[i - 1];
    return gap === 2 ? [number - 1, number] : gap > 2 ? [`gap-${number}`, number] : [number];
  });
  const pageButtonClass = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed';
  const inactivePageClass = 'border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-teal-600 dark:hover:bg-teal-950/50 dark:hover:text-teal-300';
  return <div className="soft-card p-6 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{activeTab === 'teaching' ? 'Thành tích giảng dạy' : activeTab === 'evidences' ? 'Minh chứng theo thành tích' : activeTab === 'awards' ? 'Khen thưởng đã ghi nhận' : 'Danh sách thành tích NCKH'}</h2><div className="flex gap-2"><button type="button" aria-label="Bộ lọc thành tích" aria-expanded={filters} onClick={() => setFilters(v => !v)} className="soft-btn-secondary"><Filter className="h-4 w-4" /></button><Link to="/achievements?create=1" className="soft-btn-primary text-xs"><Plus className="h-4 w-4" />Thêm thành tích</Link></div></div>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {activeTab === 'awards' ? <div className="space-y-3">{profile.titlesAndHonors?.map(a => <div key={a.awardRecordId} className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/30"><strong>{a.awardTypeName} ({a.recognitionYear})</strong><p className="text-xs">Quyết định {a.decisionNumber} · {a.status === 'REVOKED' ? 'Đã thu hồi' : 'Đã ghi nhận'}</p></div>)}{!profile.titlesAndHonors?.length && <p className="text-sm text-slate-500">Chưa có khen thưởng được ghi nhận.</p>}<p className="text-xs text-slate-500">Cán bộ phụ trách ghi nhận danh hiệu tại trang Khen thưởng sau khi có quyết định và tệp quyết định.</p></div> : <>
      {filters && <div className="grid gap-3 sm:grid-cols-2"><input aria-label="Tìm thành tích trong hồ sơ" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên thành tích" className={field} /><input aria-label="Năm ghi nhận" type="number" min="1990" max="2100" value={year} onChange={e => setYear(e.target.value)} placeholder="Năm ghi nhận" className={field} /><Select aria-label="Trạng thái thành tích" value={status} onChange={e => setStatus(e.target.value)} className={field}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</Select><Select aria-label="Loại thành tích" value={type} onChange={e => setType(e.target.value)} className={field}><option value="">Tất cả loại thành tích</option>{types.map(t => <option key={t.achievement_type_id} value={t.achievement_type_id}>{t.name}</option>)}</Select></div>}
      {loading ? <LoadingState label="Đang tải thành tích cá nhân…" rows={2} /> : <div className="grid gap-3 sm:grid-cols-2">{shown.map(a => <button key={a.achievementId} type="button" aria-haspopup="dialog" onClick={() => setSelected(a)} className={`group rounded-2xl border p-4 text-left transition hover:border-teal-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${selected?.achievementId === a.achievementId ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30' : 'border-slate-200 dark:border-slate-700'}`}><span className="text-xs text-teal-600">{statuses[a.status] || a.status}</span><h3 className="mt-2 font-bold">{a.title}</h3><p className="mt-2 text-xs text-slate-500">{a.achievementTypeName} · {a.recognitionYear} · {a.evidenceCount} minh chứng</p><span className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400">Xem chi tiết<ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span></button>)}{!shown.length && <p className="text-sm text-slate-500">Không có thành tích phù hợp trên trang này.</p>}</div>}
      <nav aria-label="Phân trang thành tích" className="flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button type="button" aria-label="Trang trước" title="Trang trước" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className={`${pageButtonClass} ${inactivePageClass}`}><ChevronLeft className="h-4 w-4" /></button>
        {pageButtons.map(number => typeof number === 'number' ? <button
          key={number}
          type="button"
          aria-label={`Trang ${number}`}
          aria-current={page === number ? 'page' : undefined}
          disabled={loading}
          onClick={() => setPage(number)}
          className={`${pageButtonClass} ${page === number ? 'border-teal-500 bg-teal-500 text-white shadow-md shadow-teal-500/20 dark:border-teal-400 dark:bg-teal-400 dark:text-slate-950' : inactivePageClass}`}
        >{number}</button> : <span key={number} aria-hidden="true" className="flex h-9 w-5 items-center justify-center text-slate-400">…</span>)}
        <button type="button" aria-label="Trang tiếp" title="Trang tiếp" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} className={`${pageButtonClass} ${inactivePageClass}`}><ChevronRight className="h-4 w-4" /></button>
        <span className="sr-only" aria-live="polite">Trang {page} trên {totalPages}</span>
      </nav>
    </>}
    {selected && <PortfolioAchievementDialog key={selected.achievementId} achievement={selected} statusLabel={statuses[selected.status] || selected.status} onClose={() => setSelected(null)} onEvidenceSaved={() => setRevision(value => value + 1)} />}
  </div>;
}
