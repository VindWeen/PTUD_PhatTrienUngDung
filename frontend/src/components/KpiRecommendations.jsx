import React, { useState } from 'react';
import { kpiApi } from '../services/kpiApi';

export default function KpiRecommendations({ onAccepted }) {
  const [runId, setRunId] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
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
    <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900 space-y-3">
      <h2 className="font-semibold">Gợi ý KPI bằng AI</h2>
      <p className="text-sm">
        Nhập run từ màn hình đánh giá AI. Chỉ tiêu và căn cứ lấy từ tiêu chí đã xác nhận. Chỉ tạo
        KPI sau khi bạn chấp nhận.
      </p>
      <label className="block">
        Run ID
        <input
          className="block w-full border rounded p-2 text-slate-900"
          value={runId}
          onChange={(e) => {
            setRunId(e.target.value);
            setItems([]);
          }}
        />
      </label>
      <button
        disabled={busy}
        onClick={() =>
          act(async () => {
            const out = await kpiApi.recommendations(runId);
            setItems(out.items);
          })
        }
        className="border rounded p-2"
      >
        Xem gợi ý đã lưu
      </button>{' '}
      <button
        disabled={busy}
        onClick={() =>
          act(async () => {
            const out = await kpiApi.generateRecommendations({ runId });
            setItems(out.items);
            setMessage(out.missingData || 'Đã tạo gợi ý; chưa tạo KPI.');
          })
        }
        className="border rounded p-2"
      >
        Gọi AI tạo gợi ý
      </button>
      {message && <p role="status">{message}</p>}
      {items.map((r, index) => (
        <article key={r.recommendation_id} className="border rounded p-4 space-y-2">
          <h3 className="font-semibold">
            {r.payload.title} — {r.status}
          </h3>
          <p>
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
          <label className="block">
            Sửa kế hoạch
            <textarea
              disabled={busy || r.status !== 'PENDING'}
              className="block w-full border p-2 text-slate-900"
              value={r.payload.plan}
              onChange={(e) => edit(index, 'plan', e.target.value)}
            />
          </label>
          {['periodStart', 'periodEnd'].map((key, i) => (
            <label className="inline-block mr-3" key={key}>
              {i === 0 ? 'Bắt đầu' : 'Thời hạn'}
              <input
                disabled={busy || r.status !== 'PENDING'}
                type="date"
                className="block border p-2 text-slate-900"
                value={r.payload[key] || ''}
                onChange={(e) => edit(index, key, e.target.value)}
              />
            </label>
          ))}
          <div>
            <button
              className="border rounded p-2"
              disabled={busy || r.status !== 'PENDING'}
              onClick={() => act(() => decision(r, 'accept'))}
            >
              Chấp nhận và tạo KPI
            </button>{' '}
            <button
              className="border rounded p-2"
              disabled={busy || r.status !== 'PENDING'}
              onClick={() => act(() => decision(r, 'reject'))}
            >
              Từ chối
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
