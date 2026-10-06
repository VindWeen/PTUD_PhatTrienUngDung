import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../services/reportsApi.js';
import { USE_FIXTURES } from '../services/apiConfig.js';
import { ErrorState, LoadingState } from '../components/common/AsyncState';

const initial = { kind: '', subjectType: '', recognitionYear: '', academicYearId: '', contextUnitId: '', typeId: '', status: '', search: '' };
const labels = { ACHIEVEMENT: 'Thành tích', AWARD: 'Khen thưởng', LECTURER: 'Cá nhân', UNIT: 'Tập thể' };
const clean = value => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== ''));

export default function Reports({ dashboard = false }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);
  const roles = (user?.roles || []).map(r => typeof r === 'string' ? r : r.code);
  const canExport = roles.some(r => ['ADMIN', 'MANAGER', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE'].includes(r));
  useEffect(() => {
    let current = true;
    if (USE_FIXTURES) return undefined;
    setLoading(true); setError(null);
    reportsApi.list({ ...clean(filters), page, pageSize: 20 }, dashboard)
      .then(result => { if (current) setData(result); })
      .catch(err => { if (current) { setError(err); setData(null); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filters, page, dashboard, reload]);
  async function download() {
    setExporting(true); setError(null);
    try {
      const blob = await reportsApi.exportCsv(clean(filters));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'W3-P1-reports.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err); }
    finally { setExporting(false); }
  }
  const control = 'rounded-lg border border-slate-300 bg-white p-2 text-slate-800 dark:bg-slate-800 dark:text-white';
  return <section className="space-y-5 text-slate-800 dark:text-slate-100">
    <h1 className="text-2xl font-bold">{dashboard ? `Tổng quan · ${user?.displayName || 'Hồ sơ'}` : 'Báo cáo và tìm kiếm'}</h1>
    <p>Thành tích VERIFIED và khen thưởng RECORDED được thống kê riêng. Đơn vị là đơn vị lịch sử trên hồ sơ; REVOKED không tính hợp lệ. Số năm đếm năm ghi nhận phân biệt, không phải tiêu chí xét thưởng.</p>
    {USE_FIXTURES ? <p role="status" className="rounded-xl bg-amber-100 p-4 text-amber-900">W3-P1 cần đăng nhập API thật. Đặt VITE_DATA_SOURCE=api rồi khởi động lại Vite; số liệu demo không dùng để nghiệm thu.</p> : <>
      <form className="grid gap-3 rounded-xl bg-white p-4 dark:bg-slate-900 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); setPage(1); setFilters({ ...draft }); }}>
        {[['kind', 'Nguồn', ['', 'ACHIEVEMENT', 'AWARD']], ['subjectType', 'Chủ thể', ['', 'LECTURER', 'UNIT']], ['status', 'Trạng thái', ['', 'DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'RECORDED', 'REVOKED', 'REJECTED', 'CANCELLED']]].map(([key, label, values]) => <label key={key} className="grid gap-1">{label}<select className={control} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value, ...(key === 'kind' ? { typeId: '', academicYearId: '' } : {}) })}>{values.map(v => <option key={v} value={v}>{labels[v] || v || 'Tất cả'}</option>)}</select></label>)}
        {[['recognitionYear', 'Năm ghi nhận'], ['academicYearId', 'ID năm học (thành tích)'], ['contextUnitId', 'ID đơn vị lịch sử'], ['typeId', 'ID loại (chọn nguồn trước)']].map(([key, label]) => <label key={key} className="grid gap-1">{label}<input type="number" min="1" disabled={key === 'typeId' && !draft.kind || key === 'academicYearId' && draft.kind === 'AWARD'} className={control} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
        <label className="grid gap-1">Tìm tiêu đề/chủ thể/loại/số quyết định<input className={control} value={draft.search} onChange={e => setDraft({ ...draft, search: e.target.value })} maxLength={200} /></label>
        <div className="flex items-end gap-3"><button className={control} type="submit">Áp dụng</button><button className={control} type="button" onClick={() => { setDraft(initial); setFilters(initial); setPage(1); }}>Đặt lại</button></div>
      </form>
      <p className="text-sm">Năm học lọc riêng thành tích; W2-P2 chưa lưu năm học cho khen thưởng. CSV xuất toàn bộ kết quả theo bộ lọc đã áp dụng.</p>
      {error && <ErrorState error={error} onRetry={() => setReload(v => v + 1)} />}
      {loading ? <LoadingState label="Đang đối soát thống kê..." /> : data && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{['ACHIEVEMENT', 'AWARD'].flatMap(kind => ['LECTURER', 'UNIT'].map(subject => {
          const s = data.summary.find(v => v.kind === kind && v.subject_type === subject);
          return <article key={kind + subject} className="rounded-xl bg-white p-4 dark:bg-slate-900"><h2>{labels[kind]} · {labels[subject]}</h2><p className="text-3xl font-bold">{s?.valid_count || 0}</p><p>Hợp lệ · {s?.distinct_years || 0} năm</p><small>Tất cả trạng thái: {s?.total || 0}</small></article>;
        }))}</div>
        <div className="flex items-center justify-between"><p>{data.total} bản ghi</p>{canExport && <button className={control} disabled={exporting} onClick={download}>{exporting ? 'Đang xuất...' : 'Xuất CSV'}</button>}</div>
        <div className="overflow-x-auto rounded-xl bg-white dark:bg-slate-900"><table className="w-full text-left text-sm"><thead><tr>{['Nguồn / ID', 'Chủ thể', 'Tiêu đề / loại', 'Đơn vị lịch sử', 'Năm / năm học', 'Trạng thái'].map(v => <th key={v} className="p-3">{v}</th>)}</tr></thead><tbody>{data.items.map(row => <tr key={row.kind + row.id} className="border-t border-slate-200 dark:border-slate-700"><td className="p-3">{labels[row.kind]} #{row.id}</td><td className="p-3">{labels[row.subject_type]} · {row.subject_name}</td><td className="p-3">{row.title}<br /><small>{row.type_name}{row.decision_number && ` · ${row.decision_number}`}</small></td><td className="p-3">{row.context_unit_name} (#{row.context_unit_id})</td><td className="p-3">{row.recognition_year}<br />{row.academic_year_code || '—'}</td><td className="p-3">{row.status}<br />{row.is_valid ? 'Hợp lệ' : 'Không tính hợp lệ'}</td></tr>)}</tbody></table>{!data.items.length && <p className="p-4">Không có bản ghi trong bộ lọc và phạm vi hiện tại.</p>}</div>
        <div className="flex items-center gap-3"><button className={control} disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(data.total / 20))}</span><button className={control} disabled={page * 20 >= data.total} onClick={() => setPage(v => v + 1)}>Sau</button></div>
      </>}
    </>}
  </section>;
}
