import Select from './common/Select';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, Download, Plus, X } from 'lucide-react';
import { achievementsApi } from '../services/achievementsApi';
import { evidencesApi } from '../services/evidencesApi';
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
  const [evidences, setEvidences] = useState([]);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [upload, setUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState([]);
  const [type, setType] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => { achievementsApi.listAchievementTypes().then(setTypes).catch(e => setError(e.message)); }, []);
  useEffect(() => { setPage(1); setSelected(null); setEvidences([]); setUpload(false); }, [activeTab, status, year, search, type]);
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
  useEffect(() => {
    let active = true;
    setEvidences([]); setUpload(false); setFile(null); setTitle('');
    if (selected) {
      setEvidenceBusy(true);
      evidencesApi.getEvidencesByAchievement(selected.achievementId).then(rows => { if (active) setEvidences(rows || []); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setEvidenceBusy(false); });
    } else setEvidenceBusy(false);
    return () => { active = false; };
  }, [selected]);
  async function save(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await evidencesApi.createEvidence(selected.achievementId, { title, file });
      setEvidences(await evidencesApi.getEvidencesByAchievement(selected.achievementId));
      setUpload(false); setFile(null); setTitle(''); setRevision(v => v + 1);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  const field = 'soft-input w-full';
  const shown = items;
  return <div className="soft-card p-6 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{activeTab === 'teaching' ? 'Thành tích giảng dạy' : activeTab === 'evidences' ? 'Minh chứng theo thành tích' : activeTab === 'awards' ? 'Khen thưởng đã ghi nhận' : 'Danh sách thành tích NCKH'}</h2><div className="flex gap-2"><button type="button" aria-label="Bộ lọc thành tích" aria-expanded={filters} onClick={() => setFilters(v => !v)} className="soft-btn-secondary"><Filter className="h-4 w-4" /></button><Link to="/achievements?create=1" className="soft-btn-primary text-xs"><Plus className="h-4 w-4" />Thêm thành tích</Link></div></div>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {activeTab === 'awards' ? <div className="space-y-3">{profile.titlesAndHonors?.map(a => <div key={a.awardRecordId} className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/30"><strong>{a.awardTypeName} ({a.recognitionYear})</strong><p className="text-xs">Quyết định {a.decisionNumber} · {a.status === 'REVOKED' ? 'Đã thu hồi' : 'Đã ghi nhận'}</p></div>)}{!profile.titlesAndHonors?.length && <p className="text-sm text-slate-500">Chưa có khen thưởng được ghi nhận.</p>}<p className="text-xs text-slate-500">Cán bộ phụ trách ghi nhận danh hiệu tại trang Khen thưởng sau khi có quyết định và tệp quyết định.</p></div> : <>
      {filters && <div className="grid gap-3 sm:grid-cols-2"><input aria-label="Tìm thành tích trong hồ sơ" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên thành tích" className={field} /><input aria-label="Năm ghi nhận" type="number" min="1990" max="2100" value={year} onChange={e => setYear(e.target.value)} placeholder="Năm ghi nhận" className={field} /><Select aria-label="Trạng thái thành tích" value={status} onChange={e => setStatus(e.target.value)} className={field}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</Select><Select aria-label="Loại thành tích" value={type} onChange={e => setType(e.target.value)} className={field}><option value="">Tất cả loại thành tích</option>{types.map(t => <option key={t.achievement_type_id} value={t.achievement_type_id}>{t.name}</option>)}</Select></div>}
      {loading ? <LoadingState label="Đang tải thành tích cá nhân…" rows={2} /> : <div className="grid gap-3 sm:grid-cols-2">{shown.map(a => <button key={a.achievementId} type="button" onClick={() => setSelected(a)} className={`rounded-2xl border p-4 text-left ${selected?.achievementId === a.achievementId ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30' : 'border-slate-200 dark:border-slate-700'}`}><span className="text-xs text-teal-600">{statuses[a.status] || a.status}</span><h3 className="mt-2 font-bold">{a.title}</h3><p className="mt-2 text-xs text-slate-500">{a.achievementTypeName} · {a.recognitionYear} · {a.evidenceCount} minh chứng</p></button>)}{!shown.length && <p className="text-sm text-slate-500">Không có thành tích phù hợp trên trang này.</p>}</div>}
      <div className="flex justify-between text-xs"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(p=>p-1)}>Trang trước</button><span>Trang {page} / {totalPages}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage(p=>p+1)}>Trang tiếp</button></div>
      <section className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-700"><h3 className="font-bold">Minh chứng số{selected ? ` — ${selected.title}` : ''}</h3>{!selected ? <p className="text-sm text-slate-500">Chọn một thành tích để xem hoặc bổ sung minh chứng.</p> : <><p className="text-sm text-slate-500">{selected.description}</p><Link to={`/achievements?id=${selected.achievementId}`} className="text-sm text-teal-600 underline">Xem hồ sơ thành tích và tiến trình duyệt</Link>{evidenceBusy ? <LoadingState label="Đang tải minh chứng…" rows={1} /> : <div className="space-y-2">{evidences.map(ev => <button type="button" key={ev.evidenceId} disabled={!ev.latestFileId || saving} onClick={async () => { try { await evidencesApi.downloadEvidenceFile(ev.latestFileId, ev.latestFileName); } catch(e) {setError(e.message);} }} className="soft-btn-secondary w-full justify-between text-sm"><span>{ev.title} · {ev.latestFileName} · v{ev.latestVersionNo}</span><Download className="h-4 w-4 shrink-0" /></button>)}{!evidences.length && <p className="text-sm text-slate-500">Chưa có minh chứng.</p>}</div>}{['DRAFT','NEED_CORRECTION'].includes(selected.status) && <button type="button" onClick={() => setUpload(v=>!v)} className="soft-btn-primary text-xs"><Plus className="h-4 w-4" />Thêm minh chứng</button>}{upload && <form onSubmit={save} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex justify-between"><strong className="text-sm">Tải minh chứng</strong><button type="button" disabled={saving} aria-label="Đóng tải minh chứng" onClick={()=>setUpload(false)}><X className="h-4 w-4" /></button></div><input aria-label="Tên minh chứng" required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Tên minh chứng" className={field} /><input aria-label="Tệp minh chứng" required type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={e=>setFile(e.target.files[0] || null)} /><p className="text-xs text-slate-500">PDF, JPG, PNG, DOCX · tối đa 10 MB.</p><button disabled={saving || !file} className="soft-btn-primary text-xs">{saving ? 'Đang tải…' : 'Lưu minh chứng'}</button></form>}</>}</section>
    </>}
  </div>;
}
