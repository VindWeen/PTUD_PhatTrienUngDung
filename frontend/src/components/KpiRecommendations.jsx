import React, { useEffect, useState } from 'react';
import { kpiApi } from '../services/kpiApi';
import { Sparkles, History, Check, X, Target } from 'lucide-react';
import { EntitySelect } from './common/EntityPicker';
import { aiEvaluationApi } from '../services/aiEvaluationApi';

const fieldClass = 'soft-input w-full text-sm disabled:opacity-60';
const statusLabels = { PENDING: 'Chờ bạn rà soát', ACCEPTED: 'Đã chấp nhận', REJECTED: 'Đã từ chối' };

export default function KpiRecommendations({ onAccepted,subjectType,subjectId }) {
  const [runId, setRunId] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [runs,setRuns]=useState([]);
  const [runsLoading,setRunsLoading]=useState(false);
  const [runsError,setRunsError]=useState('');
  const [runRevision,setRunRevision]=useState(0);
  useEffect(()=>{
    let active=true;
    setRuns([]);setRunId('');setItems([]);setRunsError('');
    if(!subjectId){setRunsLoading(false);return;}
    setRunsLoading(true);
    aiEvaluationApi.listEvaluationRuns({subjectType,subjectId,limit:100},true).then(rows=>{if(active)setRuns(rows);})
      .catch(e=>{if(active)setRunsError(e.message);}).finally(()=>{if(active)setRunsLoading(false);});
    return()=>{active=false;};
  },[subjectType,subjectId,runRevision]);
  async function act(fn) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  function edit(index, key, value) {
    setItems((rows) =>
      rows.map((r, i) => (i === index ? { ...r, payload: { ...r.payload, [key]: value } } : r))
    );
  }
  async function decision(r, action) {
    const out = await kpiApi.recommendationDecision(r.recommendation_id, {
      version: Number(r.version),
      action,
      ...(action === 'accept'
        ? {
            edits: {
              plan: r.payload.plan,
              periodStart: r.payload.periodStart || '',
              periodEnd: r.payload.periodEnd || '',
            },
          }
        : {}),
    });
    setItems((rows) =>
      rows.map((x) => (x.recommendation_id === r.recommendation_id ? out.recommendation : x))
    );
    if (action === 'accept') await onAccepted();
  }
  return (
    <section className="soft-card p-6 space-y-5 text-slate-800 dark:text-slate-100">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-teal-50 p-3 text-[#008080] dark:bg-teal-950/40 dark:text-teal-400"><Sparkles className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Gợi ý KPI bằng AI</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Chọn phiên thẩm định đã thực hiện để đề xuất mục tiêu từ tiêu chí đã xác nhận. Bạn rà soát và chấp nhận trước khi tạo KPI.</p></div>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
      <div className="flex-1"><EntitySelect label="Phiên thẩm định AI" options={runs.map(r=>({...r,id:r.runId}))} value={runId} onChange={id=>{setRunId(id);setItems([]);}} placeholder={runsLoading ? 'Đang tải phiên thẩm định…' : 'Chọn phiên thẩm định'} disabled={runsLoading || busy} getLabel={r=>`${new Date(r.executedAt).toLocaleString('vi-VN')} · ${{ELIGIBLE:'Đủ điều kiện',INELIGIBLE:'Chưa đạt',NEEDS_HUMAN_REVIEW:'Cần người rà soát',SIMULATION_ONLY:'Chỉ mô phỏng'}[r.overallConclusion] || r.overallConclusion} · ${r.model}`}/></div>
      <button type="button" className="soft-btn-secondary text-xs" disabled={runsLoading || busy || !subjectId} onClick={()=>setRunRevision(v=>v+1)}>Tải lại phiên thẩm định</button>
      <button
        disabled={busy || !runId}
        onClick={() =>
          act(async () => {
            const out = await kpiApi.recommendations(runId);
            setItems(out.items);
          })
        }
        className="soft-btn-secondary text-xs whitespace-nowrap"
      >
        <History className="h-4 w-4" /> Xem gợi ý đã lưu
      </button>
      <button
        disabled={busy || !runId.trim()}
        onClick={() =>
          act(async () => {
            const out = await kpiApi.generateRecommendations({ runId });
            setItems(out.items);
            setMessage(out.missingData || 'Đã tạo gợi ý; chưa tạo KPI.');
          })
        }
        className="soft-btn-primary text-xs whitespace-nowrap"
      >
        <Sparkles className="h-4 w-4" /> {busy ? 'Đang xử lý…' : 'Tạo gợi ý bằng AI'}
      </button>
      </div>
      {runsError && <p role="alert" className="text-sm text-rose-600">{runsError}</p>}
      {!runsLoading && !runs.length && <p className="text-sm text-slate-500">Chưa có phiên thẩm định cho chủ thể này. Thực hiện đánh giá ở trang AI trước.</p>}
      {message && <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200">{message}</p>}
      {items.map((r, index) => (
        <article key={r.recommendation_id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4 text-sm dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><Target className="h-4 w-4 text-teal-600" />{r.payload.title}</h3>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">{statusLabels[r.status] || r.status}</span></div>
          <p className="text-slate-600 dark:text-slate-300">
            Chỉ tiêu tổng: {r.payload.target} {r.payload.measureUnit}; đã ghi nhận:{' '}
            {r.payload.actualRecorded}. Ưu tiên: {r.payload.priority} (mặc định, bạn cần tự cân
            nhắc).
          </p>
          <p>{r.payload.explanation}</p>
          <p>Căn cứ đã xác nhận: {JSON.stringify(r.payload.legalReferences)}</p>
          <p>Giả định: {r.payload.assumptions.join(' ')}</p>
          <p>
            Provider: {r.provider_evidence.provider} / {r.provider_evidence.model};{' '}
            {r.provider_evidence.cached ? 'cache' : 'lượt gọi provider'}
          </p>
          {r.payload.requiresYearReview && (
            <p role="alert">
              Điều kiện nhiều năm: chọn kỳ từ đầu năm đến cuối năm, phủ ít nhất{' '}
              {Math.ceil(r.payload.target)} năm đầy đủ. Các điều kiện chuỗi năm và căn cứ vẫn giữ
              nguyên; kế hoạch không xác nhận đủ điều kiện.
            </p>
          )}
          <label className="block space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Sửa kế hoạch
            <textarea
              disabled={busy || r.status !== 'PENDING'}
              className={fieldClass}
              rows={3}
              value={r.payload.plan}
              onChange={(e) => edit(index, 'plan', e.target.value)}
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
          {['periodStart', 'periodEnd'].map((key, i) => (
            <label className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300" key={key}>
              {i === 0 ? 'Bắt đầu' : 'Thời hạn'}
              <input
                disabled={busy || r.status !== 'PENDING'}
                type="date"
                className={fieldClass}
                value={r.payload[key] || ''}
                onChange={(e) => edit(index, key, e.target.value)}
              />
            </label>
          ))}
          </div>
          <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              className="soft-btn-primary text-xs"
              disabled={busy || r.status !== 'PENDING'}
              onClick={() => act(() => decision(r, 'accept'))}
            >
              <Check className="h-4 w-4" /> Chấp nhận và tạo KPI
            </button>
            <button
              className="soft-btn-secondary text-xs text-rose-600 dark:text-rose-400"
              disabled={busy || r.status !== 'PENDING'}
              onClick={() => act(() => decision(r, 'reject'))}
            >
              <X className="h-4 w-4" /> Từ chối
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
