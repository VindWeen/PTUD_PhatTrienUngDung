import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Target,
  User,
  Building2,
  Calendar,
  Plus,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Download,
  UploadCloud,
  FileSpreadsheet,
  X,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Check,
} from 'lucide-react';
import { kpiApi } from '../services/kpiApi';
import KpiRecommendations from '../components/KpiRecommendations';
import ExternalKpi from '../components/ExternalKpi';

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
  title: 'Tên mục tiêu',
  measureUnit: 'Đơn vị đo',
  periodStart: 'Bắt đầu kỳ',
  periodEnd: 'Kết thúc kỳ',
  target: 'Chỉ tiêu số lượng',
  plan: 'Kế hoạch thực hiện',
  sourceNote: 'Căn cứ / Nguồn cung cấp',
};

export default function Kpi() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [subjectType, setSubject] = useState('LECTURER');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState(null);
  const [resultForm, setResult] = useState(null);
  const [draft, setDraft] = useState(null);
  const [catalogs, setCatalogs] = useState({ types: [], units: [] });
  const [showCreateForm, setShowCreateForm] = useState(false);

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

  function edit(g) {
    setEditing(g);
    setShowCreateForm(true);
    setForm({
      code: g.code,
      title: g.title,
      measureUnit: g.measure_unit,
      periodStart: g.period_start.slice(0, 10),
      periodEnd: g.period_end.slice(0, 10),
      target: g.target,
      plan: g.plan || '',
      sourceNote: g.source_note || '',
    });
  }

  const inputClass =
    'w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800 dark:text-white placeholder-slate-400 transition';

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-teal-50 text-[#008080] dark:bg-teal-950/50 dark:text-teal-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Mục tiêu & Kế hoạch KPI Nội bộ
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Quản lý mục tiêu cá nhân và đơn vị đại diện (MANUAL / CSV) · Độc lập với quy trình xét duyệt chính thức
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm(empty);
            setShowCreateForm((v) => !v);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#008080] hover:bg-[#006666] text-white font-medium text-sm transition shadow-soft-sm active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{showCreateForm && !editing ? 'Đóng biểu mẫu' : 'Thiết lập KPI mới'}</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      <KpiRecommendations onAccepted={load} />
      <ExternalKpi types={catalogs.types} />
      {/* 2. Tab Navigation (Subject Switcher) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSubject('LECTURER');
              setEditing(null);
              setPreview(null);
              setResult(null);
              setDraft(null);
              setForm(empty);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
              subjectType === 'LECTURER'
                ? 'bg-teal-50 text-[#008080] dark:bg-teal-950/40 dark:text-teal-300 font-semibold shadow-soft-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Cá nhân tôi</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSubject('UNIT');
              setEditing(null);
              setPreview(null);
              setResult(null);
              setDraft(null);
              setForm(empty);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
              subjectType === 'UNIT'
                ? 'bg-teal-50 text-[#008080] dark:bg-teal-950/40 dark:text-teal-300 font-semibold shadow-soft-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Đơn vị tôi đại diện</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subjectType === 'UNIT' && (
            <select
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setEditing(null);
                setResult(null);
                setDraft(null);
                setForm(empty);
              }}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">-- Chọn đơn vị đại diện --</option>
              {catalogs.units.map((u) => (
                <option key={u.unit_id} value={u.unit_id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => act(load)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition border border-slate-200 dark:border-slate-700"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${busy ? 'animate-spin text-[#008080]' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 3. Goal Creation / Edit Form Card */}
      {showCreateForm && (
        <div className="bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-teal-50 text-[#008080] dark:bg-teal-950/50 dark:text-teal-400">
                {editing ? <Edit3 className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editing ? 'Chỉnh sửa mục tiêu KPI nháp' : 'Thiết lập mục tiêu KPI mới'}
                </h2>
                <p className="text-xs text-slate-400">
                  {editing
                    ? `Cập nhật thông tin chỉ tiêu #${editing.code}`
                    : 'Khai báo chỉ tiêu để theo dõi và chuyển thành kê khai khi hoàn thành'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setEditing(null);
                setForm(empty);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            className="grid md:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                if (editing) {
                  await kpiApi.update(editing.goal_id, { ...form, version: editing.version });
                } else {
                  await kpiApi.create({
                    ...form,
                    subjectType,
                    ...(subjectType === 'UNIT' ? { organizationUnitId: unit } : {}),
                  });
                }
                setForm(empty);
                setEditing(null);
                setShowCreateForm(false);
              });
            }}
          >
            {Object.entries(labels).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  {label}
                  {key !== 'plan' && <span className="text-rose-500">*</span>}
                </span>
                <input
                  className={inputClass}
                  required={key !== 'plan'}
                  type={key.startsWith('period') ? 'date' : key === 'target' ? 'number' : 'text'}
                  min={key === 'target' ? 0 : undefined}
                  step={key === 'target' ? 'any' : undefined}
                  placeholder={`Nhập ${label.toLowerCase()}...`}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}

            <div className="md:col-span-2 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditing(null);
                  setForm(empty);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white text-xs font-semibold transition shadow-soft-sm active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{editing ? 'Lưu thay đổi' : 'Tạo mục tiêu'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. KPI Goals List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Danh sách mục tiêu đã lưu
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-[#008080] dark:bg-teal-950/40 dark:text-teal-300">
              {items.length} mục tiêu
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {subjectType === 'LECTURER' ? 'Hồ sơ cá nhân' : 'Hồ sơ đơn vị'}
          </span>
        </div>

        {items.length === 0 && !busy && (
          <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center shadow-soft-sm">
            <Target className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white mt-3">
              Chưa có mục tiêu KPI nào
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Bạn chưa thiết lập mục tiêu nào trong danh mục này. Nhấn nút &quot;Thiết lập KPI mới&quot; để bắt đầu.
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {items.map((g) => {
            const hasResult = !!g.result;
            const targetNum = Number(g.target) || 0;
            const actualNum = hasResult ? Number(g.result.actual) || 0 : 0;
            const percent = targetNum > 0 ? Math.round((actualNum / targetNum) * 100) : 0;

            return (
              <article
                key={g.goal_id}
                className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm hover:shadow-soft-md transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-teal-50 text-[#008080] dark:bg-teal-950/50 dark:text-teal-300">
                        {g.code}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {g.title}
                      </h3>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                          g.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {g.status === 'DRAFT' ? 'Bản nháp' : 'Đã chấp nhận'}
                      </span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded">
                        Nguồn: {g.source}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {g.period_start.slice(0, 10)} → {g.period_end.slice(0, 10)}
                      </span>
                      <span>
                        Chỉ tiêu: <strong className="text-slate-800 dark:text-white">{g.target} {g.measure_unit}</strong>
                      </span>
                      {hasResult && (
                        <span>
                          Thực tế: <strong className="text-[#008080] dark:text-teal-400">{g.result.actual} {g.measure_unit}</strong>
                        </span>
                      )}
                    </div>

                    {hasResult && (
                      <div className="pt-1 max-w-sm space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-slate-500">Mức độ hoàn thành</span>
                          <span className={percent >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#008080] dark:text-teal-400'}>
                            {percent}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent >= 100 ? 'bg-emerald-500' : 'bg-[#008080]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, percent))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-1 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                      <p>
                        <span className="text-slate-400 font-medium">Kế hoạch:</span> {g.plan || 'Chưa nhập'}
                      </p>
                      <p>
                        <span className="text-slate-400 font-medium">Căn cứ:</span> {g.source_note}
                      </p>
                    </div>

                    {hasResult && (
                      <div className="mt-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl text-xs space-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>Kết quả thực tế: {g.result.actual} {g.measure_unit} ({g.result.source})</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">
                          Minh chứng kê khai (chưa xác nhận): {g.result.evidence_note || '—'}
                        </p>
                        {g.result.achievement_id && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#008080] font-semibold">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <Link to="/achievements" className="hover:underline">
                              Đã tạo hồ sơ nháp #{g.result.achievement_id} — Chuyển sang Thành tích để nộp duyệt
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                    {g.status === 'DRAFT' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => edit(g)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => act(() => kpiApi.remove(g.goal_id, g.version))}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition border border-rose-200 dark:border-rose-900/40 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa nháp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => act(() => kpiApi.accept(g.goal_id, g.version))}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white text-xs font-semibold transition shadow-soft-sm active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Chấp nhận</span>
                        </button>
                      </>
                    ) : !hasResult ? (
                      <button
                        type="button"
                        onClick={() => setResult({ goal: g, actual: '', sourceNote: '', evidenceNote: '' })}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white text-xs font-semibold transition shadow-soft-sm active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Ghi kết quả</span>
                      </button>
                    ) : (
                      !g.result.achievement_id && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setResult({
                                goal: g,
                                actual: g.result.actual,
                                sourceNote: g.result.source_note,
                                evidenceNote: g.result.evidence_note,
                              })
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => act(() => kpiApi.result(g.goal_id, 'DELETE', { version: g.result.version }))}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition border border-rose-200 dark:border-rose-900/40 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraft({ goal: g, type: '' })}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition shadow-soft-sm active:scale-95"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Kê khai nháp</span>
                          </button>
                        </>
                      )
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Result Form Modal */}
      {resultForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-soft-lg border border-slate-200/80 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#008080]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ghi nhận kết quả: {resultForm.goal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              className="space-y-3"
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
              {['actual', 'sourceNote', 'evidenceNote'].map((key) => (
                <label className="block space-y-1" key={key}>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {key === 'actual'
                      ? `Số lượng thực tế (${resultForm.goal.measure_unit})`
                      : key === 'sourceNote'
                        ? 'Nguồn ghi nhận'
                        : 'Minh chứng / tài liệu tham chiếu (chưa xác nhận)'}
                  </span>
                  <input
                    required
                    className={inputClass}
                    type={key === 'actual' ? 'number' : 'text'}
                    min={key === 'actual' ? 0 : undefined}
                    step="any"
                    value={resultForm[key]}
                    onChange={(e) => setResult({ ...resultForm, [key]: e.target.value })}
                  />
                </label>
              ))}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white text-xs font-semibold transition shadow-soft-sm active:scale-95 disabled:opacity-50"
                >
                  <span>Lưu kết quả MANUAL</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Draft Declaration Modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-soft-lg border border-slate-200/80 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#008080]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Tạo kê khai nháp từ KPI
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sao chép số liệu và nguồn từ mục tiêu <strong>&quot;{draft.goal.title}&quot;</strong> sang hồ sơ
              thành tích DRAFT. Hệ thống không tự động nộp duyệt, xác nhận hay trao thưởng.
            </p>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  await kpiApi.draft(draft.goal.goal_id, draft.goal.result.version, draft.type);
                  setDraft(null);
                  setNotice(
                    'Đã tạo DRAFT thành công. Mở màn hình Thành tích để đính kèm file minh chứng và nộp duyệt.'
                  );
                });
              }}
            >
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chọn loại danh mục thành tích
                </span>
                <select
                  required
                  className={inputClass}
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                >
                  <option value="">-- Chọn loại danh mục --</option>
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

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy || !draft.type}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white text-xs font-semibold transition shadow-soft-sm active:scale-95 disabled:opacity-50"
                >
                  <span>Xác nhận tạo kê khai DRAFT</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. CSV Import Section */}
      {subjectType === 'LECTURER' && (
        <section className="bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#008080]" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Nhập mục tiêu bằng file CSV
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Import mục tiêu → Chấp nhận mục tiêu → Import kết quả. Các dòng trùng lặp sẽ tự động bỏ qua.
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                const data = await kpiApi.template();
                const url = URL.createObjectURL(
                  new Blob([data], { type: 'text/csv;charset=utf-8' })
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = 'W3-P2-kpi.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-soft-sm self-start sm:self-auto"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Tải file mẫu CSV</span>
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chọn file CSV từ máy tính
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#008080] file:text-white hover:file:bg-[#006666] cursor-pointer"
                onChange={async (e) => {
                  setPreview(null);
                  const f = e.target.files[0];
                  if (f) {
                    if (f.size > 500000) {
                      setError('File CSV tối đa 500 KB');
                      return;
                    }
                    setCsv(await f.text());
                  }
                }}
              />
            </label>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nội dung CSV
              </span>
              <textarea
                className={`${inputClass} font-mono`}
                rows={4}
                placeholder="Dữ liệu CSV hiển thị tại đây..."
                value={csv}
                onChange={(e) => {
                  setCsv(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy || !csv.trim()}
              onClick={() => act(async () => setPreview(await kpiApi.preview(csv)))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 transition shadow-soft-sm"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Kiểm tra dữ liệu trước</span>
            </button>
          </div>

          {preview && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white">
                Kết quả kiểm tra ({preview.rows?.length || 0} dòng)
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400">
                      <th className="p-3">Dòng</th>
                      <th className="p-3">Mã KPI</th>
                      <th className="p-3">Kết quả đối soát</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {preview.rows.map((r) => (
                      <tr key={r.row} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono">{r.row}</td>
                        <td className="p-3 font-mono font-bold text-[#008080]">
                          {r.goal?.code || '—'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              r.status === 'VALID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {r.status}
                          </span>{' '}
                          <span className="text-slate-500">
                            {r.message || (r.error ? JSON.stringify(r.error) : '')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!preview.rows.some((r) => r.status === 'INVALID') && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const out = await kpiApi.commit(csv);
                        setPreview(null);
                        setNotice(
                          `Đã import thành công ${out.imported} mục tiêu; bỏ qua ${out.duplicates} dòng trùng lặp.`
                        );
                      })
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white text-xs font-semibold transition shadow-soft-sm active:scale-95 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Xác nhận import vào hệ thống</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
