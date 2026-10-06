import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { kpiApi } from '../services/kpiApi';

const empty = {
  code: '',
  title: '',
  measureUnit: '',
  periodStart: '',
  periodEnd: '',
  target: '',
  plan: '',
  sourceNote: '',
};
const labels = {
  code: 'Mã KPI',
  title: 'Mục tiêu',
  measureUnit: 'Đơn vị đo',
  periodStart: 'Bắt đầu kỳ',
  periodEnd: 'Kết thúc kỳ',
  target: 'Chỉ tiêu',
  plan: 'Kế hoạch',
  sourceNote: 'Nguồn / căn cứ người dùng cung cấp',
};
export default function Kpi() {
  const [items, setItems] = useState([]),
    [form, setForm] = useState(empty),
    [editing, setEditing] = useState(null);
  const [subjectType, setSubject] = useState('LECTURER'),
    [unit, setUnit] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [csv, setCsv] = useState(''),
    [preview, setPreview] = useState(null),
    [resultForm, setResult] = useState(null),
    [draft, setDraft] = useState(null);
  const [catalogs, setCatalogs] = useState({ types: [], units: [] });
  useEffect(() => {
    kpiApi
      .catalogs()
      .then(setCatalogs)
      .catch((e) => setError(e.message));
  }, []);
  const load = useCallback(async () => {
    const out = await kpiApi.list({
      subjectType,
      ...(subjectType === 'UNIT' ? { organizationUnitId: unit } : {}),
    });
    setItems(out.items);
  }, [subjectType, unit]);
  useEffect(() => {
    load().catch((e) => {
      setItems([]);
      setError(e.message);
    });
  }, [load]);
  async function act(fn) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message || 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  }
  const button = (label, fn) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => act(fn)}
      className="rounded border px-3 py-2 disabled:opacity-50"
    >
      {label}
    </button>
  );
  function edit(g) {
    setEditing(g);
    setForm({
      code: g.code,
      title: g.title,
      measureUnit: g.measure_unit,
      periodStart: g.period_start.slice(0, 10),
      periodEnd: g.period_end.slice(0, 10),
      target: g.target,
      plan: g.plan,
      sourceNote: g.source_note,
    });
  }
  return (
    <main className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">Mục tiêu, kế hoạch và kết quả KPI</h1>
      <p>
        KPI nội bộ do người dùng nhập (MANUAL/CSV). Chấp nhận mục tiêu không xác nhận kết quả; KPI
        không tự thành VERIFIED hoặc khen thưởng.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="flex gap-3">
        <label>
          Chủ thể{' '}
          <select
            value={subjectType}
            onChange={(e) => {
              setSubject(e.target.value);
              setEditing(null);
              setPreview(null);
              setResult(null);
              setDraft(null);
              setForm(empty);
            }}
          >
            <option value="LECTURER">Cá nhân tôi</option>
            <option value="UNIT">Đơn vị tôi đại diện</option>
          </select>
        </label>
        {subjectType === 'UNIT' && (
          <label>
            Đơn vị{' '}
            <select
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setEditing(null);
                setResult(null);
                setDraft(null);
                setForm(empty);
              }}
              className="border"
            >
              <option value="">Chọn đơn vị</option>
              {catalogs.units.map((u) => (
                <option key={u.unit_id} value={u.unit_id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {button('Tải lại', load)}
      </div>
      <form
        className="grid md:grid-cols-2 gap-3 border rounded p-4"
        onSubmit={(e) => {
          e.preventDefault();
          act(async () => {
            if (editing)
              await kpiApi.update(editing.goal_id, { ...form, version: editing.version });
            else
              await kpiApi.create({
                ...form,
                subjectType,
                ...(subjectType === 'UNIT' ? { organizationUnitId: unit } : {}),
              });
            setForm(empty);
            setEditing(null);
          });
        }}
      >
        <h2 className="md:col-span-2 font-bold">
          {editing ? 'Sửa mục tiêu nháp' : 'Tạo mục tiêu nháp'}
        </h2>
        {Object.entries(labels).map(([key, label]) => (
          <label key={key} className="flex flex-col">
            {label}
            <input
              className="border rounded p-2"
              required={key !== 'plan'}
              type={key.startsWith('period') ? 'date' : key === 'target' ? 'number' : 'text'}
              min={key === 'target' ? 0 : undefined}
              step={key === 'target' ? 'any' : undefined}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <button disabled={busy} className="bg-blue-700 text-white rounded p-2">
          Lưu mục tiêu
        </button>
        {editing &&
          button('Hủy sửa', async () => {
            setEditing(null);
            setForm(empty);
          })}
      </form>
      <section className="space-y-3">
        <h2 className="font-bold">Mục tiêu đã lưu ({items.length})</h2>
        {items.map((g) => (
          <article key={g.goal_id} className="border rounded p-4 space-y-2">
            <h3 className="font-bold">
              {g.code} — {g.title}
            </h3>
            <p>
              {g.period_start.slice(0, 10)} → {g.period_end.slice(0, 10)} · Mục tiêu {g.target}{' '}
              {g.measure_unit} · {g.status} · {g.source}
            </p>
            <p>
              Kế hoạch: {g.plan || 'Chưa nhập'} · Nguồn: {g.source_note}
            </p>
            {g.status === 'DRAFT' ? (
              <div className="flex gap-2">
                {button('Sửa', async () => edit(g))}
                {button('Xóa nháp', () => kpiApi.remove(g.goal_id, g.version))}
                {button('Tôi chấp nhận mục tiêu này', () => kpiApi.accept(g.goal_id, g.version))}
              </div>
            ) : !g.result ? (
              button('Ghi kết quả', async () =>
                setResult({ goal: g, actual: '', sourceNote: '', evidenceNote: '' })
              )
            ) : null}
            {g.result && (
              <>
                <p>
                  Thực tế {g.result.actual} {g.measure_unit} · {g.result.source} ·{' '}
                  {g.result.source_note}
                </p>
                <p>Minh chứng kê khai, chưa xác nhận: {g.result.evidence_note}</p>
                {g.result.achievement_id ? (
                  <Link to="/achievements">
                    Đã tạo kê khai nháp #{g.result.achievement_id} — mở Thành tích để bổ sung
                    file/nộp duyệt
                  </Link>
                ) : (
                  <div className="flex gap-2">
                    {button('Sửa kết quả', async () =>
                      setResult({
                        goal: g,
                        actual: g.result.actual,
                        sourceNote: g.result.source_note,
                        evidenceNote: g.result.evidence_note,
                      })
                    )}
                    {button('Xóa kết quả', () =>
                      kpiApi.result(g.goal_id, 'DELETE', { version: g.result.version })
                    )}
                    {button('Chuẩn bị kê khai nháp', async () => setDraft({ goal: g, type: '' }))}
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </section>
      {resultForm && (
        <form
          className="border p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const { goal, ...data } = resultForm;
              await kpiApi.result(goal.goal_id, goal.result ? 'PATCH' : 'POST', {
                ...data,
                ...(goal.result ? { version: goal.result.version } : {}),
              });
              setResult(null);
            });
          }}
        >
          <h2>Kết quả: {resultForm.goal.title}</h2>
          {['actual', 'sourceNote', 'evidenceNote'].map((key) => (
            <label className="block" key={key}>
              {key === 'actual'
                ? 'Thực tế'
                : key === 'sourceNote'
                  ? 'Nguồn'
                  : 'Minh chứng / tài liệu tham chiếu (chưa xác nhận)'}
              <input
                required
                className="border w-full p-2"
                type={key === 'actual' ? 'number' : 'text'}
                min={key === 'actual' ? 0 : undefined}
                step="any"
                value={resultForm[key]}
                onChange={(e) => setResult({ ...resultForm, [key]: e.target.value })}
              />
            </label>
          ))}
          <button disabled={busy} className="border p-2">
            Lưu kết quả MANUAL
          </button>
          {button('Đóng', async () => setResult(null))}
        </form>
      )}
      {draft && (
        <form
          className="border p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await kpiApi.draft(draft.goal.goal_id, draft.goal.result.version, draft.type);
              setDraft(null);
              setNotice('Đã tạo DRAFT. Mở Thành tích, thêm file minh chứng và nộp theo workflow.');
            });
          }}
        >
          <h2>Tạo kê khai nháp từ {draft.goal.title}</h2>
          <p>Chỉ sao chép số liệu và nguồn. Không tự nộp duyệt, xác nhận hay trao thưởng.</p>
          <label>
            Loại thành tích{' '}
            <select
              required
              className="border p-2"
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            >
              <option value="">Chọn loại</option>
              {catalogs.types
                .filter((t) =>
                  ['BOTH', draft.goal.lecturer_id ? 'LECTURER' : 'UNIT'].includes(
                    t.applicable_subject_type
                  )
                )
                .map((t) => (
                  <option key={t.achievement_type_id} value={t.achievement_type_id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={busy} className="border p-2">
            Tôi xác nhận tạo kê khai DRAFT
          </button>
          {button('Đóng', async () => setDraft(null))}
        </form>
      )}
      {subjectType === 'LECTURER' && (
        <section className="border rounded p-4 space-y-3">
          <h2 className="font-bold">Import CSV cá nhân</h2>
          <p>
            Import mục tiêu → chấp nhận → import kết quả. Mỗi mục tiêu/kỳ có một kết quả. Dòng trùng
            được bỏ qua; dòng lỗi chặn toàn bộ lượt ghi.
          </p>
          {button('Tải CSV template', async () => {
            const data = await kpiApi.template();
            const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'W3-P2-kpi.csv';
            a.click();
            URL.revokeObjectURL(url);
          })}
          <label className="block">
            Chọn CSV{' '}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                setPreview(null);
                const f = e.target.files[0];
                if (f) {
                  if (f.size > 500000) {
                    setError('CSV tối đa 500 KB');
                    return;
                  }
                  setCsv(await f.text());
                }
              }}
            />
          </label>
          <label className="block">
            Nội dung CSV{' '}
            <textarea
              className="border w-full p-2"
              rows="5"
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          {button('Preview và kiểm tra', async () => setPreview(await kpiApi.preview(csv)))}
          {preview && (
            <>
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>KPI</th>
                    <th>Kết quả kiểm tra</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td>{r.goal?.code}</td>
                      <td>
                        {r.status} {r.message || (r.error ? JSON.stringify(r.error) : '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!preview.rows.some((r) => r.status === 'INVALID') &&
                button('Xác nhận import CSV', async () => {
                  const out = await kpiApi.commit(csv);
                  setPreview(null);
                  setNotice(`Đã import ${out.imported}; bỏ qua ${out.duplicates} dòng trùng.`);
                })}
            </>
          )}
        </section>
      )}
    </main>
  );
}
