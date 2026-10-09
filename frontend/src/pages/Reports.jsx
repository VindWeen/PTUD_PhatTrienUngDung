import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Filter,
  Search,
  RotateCcw,
  Award,
  User,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../services/reportsApi.js';
import { USE_FIXTURES } from '../services/apiConfig.js';
import { ErrorState, LoadingState } from '../components/common/AsyncState';

const initial = {
  kind: '',
  subjectType: '',
  recognitionYear: '',
  academicYearId: '',
  contextUnitId: '',
  typeId: '',
  status: '',
  search: '',
};

const labels = {
  ACHIEVEMENT: 'Thành tích',
  AWARD: 'Khen thưởng',
  LECTURER: 'Cá nhân',
  UNIT: 'Tập thể',
};

const STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Chờ duyệt',
  NEED_CORRECTION: 'Cần bổ sung',
  VERIFIED: 'Đã xác nhận',
  RECORDED: 'Đã ghi nhận',
  REVOKED: 'Đã thu hồi',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const STATUS_PILLS = {
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
  RECORDED: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/40',
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
  NEED_CORRECTION: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
  REVOKED: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

const clean = (value) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== ''));

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

  const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));
  const canExport = roles.some((r) =>
    ['ADMIN', 'MANAGER', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE'].includes(r)
  );

  useEffect(() => {
    let current = true;
    if (USE_FIXTURES) return undefined;
    setLoading(true);
    setError(null);
    reportsApi
      .list({ ...clean(filters), page, pageSize: 20 }, dashboard)
      .then((result) => {
        if (current) setData(result);
      })
      .catch((err) => {
        if (current) {
          setError(err);
          setData(null);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [filters, page, dashboard, reload]);

  async function download() {
    setExporting(true);
    setError(null);
    try {
      const blob = await reportsApi.exportCsv(clean(filters));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'W3-P1-reports.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err);
    } finally {
      setExporting(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800 dark:text-white placeholder-slate-400 transition disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-teal-50 text-[#008080] dark:bg-teal-950/50 dark:text-teal-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {dashboard
                ? `Tổng quan báo cáo · ${user?.displayName || 'Hồ sơ'}`
                : 'Báo cáo & Thống kê Khoa học'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Dữ liệu phân quyền trực tiếp từ PostgreSQL Supabase · Đối soát thành tích VERIFIED và khen thưởng RECORDED
            </p>
          </div>
        </div>

        {canExport && (
          <button
            type="button"
            disabled={exporting || loading}
            onClick={download}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#008080] hover:bg-[#006666] text-white font-medium text-sm transition shadow-soft-sm active:scale-95 disabled:opacity-50 self-start sm:self-auto"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            <span>{exporting ? 'Đang xuất CSV...' : 'Xuất Báo Cáo CSV'}</span>
          </button>
        )}
      </div>

      {USE_FIXTURES ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Info className="w-4 h-4 text-amber-600" />
            Đang chạy chế độ dữ liệu mẫu (Fixtures)
          </div>
          <p className="mt-1">
            Tính năng Báo cáo W3-P1 yêu cầu API thật để đối soát cơ sở dữ liệu. Hãy đảm bảo{' '}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">VITE_DATA_SOURCE=api</code>{' '}
            trong frontend để trải nghiệm đầy đủ.
          </p>
        </div>
      ) : (
        <>
          {/* 2. Metric Cards (Matching Dashboard soft pastel cards) */}
          {data && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  kind: 'ACHIEVEMENT',
                  subject: 'LECTURER',
                  title: 'Thành tích Cá nhân',
                  icon: Award,
                  iconBox: 'bg-[#e7f0fc] text-[#7da8e7]',
                  pillBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
                },
                {
                  kind: 'ACHIEVEMENT',
                  subject: 'UNIT',
                  title: 'Thành tích Tập thể',
                  icon: Building2,
                  iconBox: 'bg-[#dff5f3] text-[#69c9c4]',
                  pillBg: 'bg-teal-50 text-[#008080] dark:bg-teal-950/40 dark:text-teal-300',
                },
                {
                  kind: 'AWARD',
                  subject: 'LECTURER',
                  title: 'Khen thưởng Cá nhân',
                  icon: Award,
                  iconBox: 'bg-[#fff6da] text-[#ffc83d]',
                  pillBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                },
                {
                  kind: 'AWARD',
                  subject: 'UNIT',
                  title: 'Khen thưởng Tập thể',
                  icon: Building2,
                  iconBox: 'bg-[#fbe8ea] text-[#e28b8c]',
                  pillBg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                },
              ].map(({ kind, subject, title, icon: Icon, iconBox, pillBg }) => {
                const s = data.summary?.find(
                  (v) => v.kind === kind && v.subject_type === subject
                );
                return (
                  <div
                    key={kind + subject}
                    className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm hover:shadow-soft-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {title}
                      </span>
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBox}`}>
                        <Icon className="w-5 h-5" />
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {s?.valid_count || 0}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Hợp lệ
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${pillBg}`}>
                        {s?.distinct_years || 0} năm ghi nhận
                      </span>
                      <span>Tổng: {s?.total || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. Filter Box Card */}
          <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#008080]" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">
                  Bộ lọc dữ liệu & Tiêu chí tra cứu
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Lọc dữ liệu chính xác theo phân quyền
              </span>
            </div>

            <form
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setFilters({ ...draft });
              }}
            >
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nguồn hồ sơ
                </span>
                <select
                  className={inputClass}
                  value={draft.kind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      kind: e.target.value,
                      ...(e.target.value === 'kind' ? { typeId: '', academicYearId: '' } : {}),
                    })
                  }
                >
                  <option value="">Tất cả nguồn</option>
                  <option value="ACHIEVEMENT">Thành tích</option>
                  <option value="AWARD">Khen thưởng</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chủ thể
                </span>
                <select
                  className={inputClass}
                  value={draft.subjectType}
                  onChange={(e) => setDraft({ ...draft, subjectType: e.target.value })}
                >
                  <option value="">Tất cả chủ thể</option>
                  <option value="LECTURER">Cá nhân (Giảng viên)</option>
                  <option value="UNIT">Tập thể (Đơn vị)</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Trạng thái
                </span>
                <select
                  className={inputClass}
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                >
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label} ({k})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Năm ghi nhận
                </span>
                <input
                  type="number"
                  min="1990"
                  max="2100"
                  placeholder="Ví dụ: 2026"
                  className={inputClass}
                  value={draft.recognitionYear}
                  onChange={(e) => setDraft({ ...draft, recognitionYear: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ID năm học (Thành tích)
                </span>
                <input
                  type="number"
                  min="1"
                  placeholder="ID năm học"
                  disabled={draft.kind === 'AWARD'}
                  className={inputClass}
                  value={draft.academicYearId}
                  onChange={(e) => setDraft({ ...draft, academicYearId: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ID đơn vị lịch sử
                </span>
                <input
                  type="number"
                  min="1"
                  placeholder="ID đơn vị"
                  className={inputClass}
                  value={draft.contextUnitId}
                  onChange={(e) => setDraft({ ...draft, contextUnitId: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ID loại (Chọn nguồn trước)
                </span>
                <input
                  type="number"
                  min="1"
                  placeholder="ID loại"
                  disabled={!draft.kind}
                  className={inputClass}
                  value={draft.typeId}
                  onChange={(e) => setDraft({ ...draft, typeId: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tìm kiếm từ khóa
                </span>
                <div className="relative">
                  <input
                    maxLength={200}
                    placeholder="Tiêu đề, chủ thể, số QĐ..."
                    className={inputClass}
                    value={draft.search}
                    onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                  />
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                </div>
              </label>

              <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(initial);
                    setFilters(initial);
                    setPage(1);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại</span>
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white text-xs font-semibold transition shadow-soft-sm active:scale-95"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Áp dụng bộ lọc</span>
                </button>
              </div>
            </form>
          </div>

          {error && <ErrorState error={error} onRetry={() => setReload((v) => v + 1)} />}

          {loading ? (
            <LoadingState label="Đang đối soát thống kê dữ liệu..." />
          ) : (
            data && (
              <div className="space-y-3">
                {/* 4. Table Toolbar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Tổng số: <strong className="text-[#008080]">{data.total}</strong> bản ghi
                    </span>
                    <span className="text-xs text-slate-400">
                      · Trang {page} / {Math.max(1, Math.ceil(data.total / 20))}
                    </span>
                  </div>
                </div>

                {/* 5. Data Table */}
                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400">
                          <th className="p-3.5">Nguồn / ID</th>
                          <th className="p-3.5">Chủ thể</th>
                          <th className="p-3.5">Tiêu đề & Danh mục</th>
                          <th className="p-3.5">Đơn vị lịch sử</th>
                          <th className="p-3.5">Năm / Năm học</th>
                          <th className="p-3.5">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.items.map((row) => {
                          const statusPill =
                            STATUS_PILLS[row.status] ||
                            'bg-slate-100 text-slate-600 border-slate-200';
                          return (
                            <tr
                              key={row.kind + row.id}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                            >
                              <td className="p-3.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold text-[11px] ${
                                    row.kind === 'ACHIEVEMENT'
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                  }`}
                                >
                                  {labels[row.kind]} #{row.id}
                                </span>
                              </td>

                              <td className="p-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                                    {row.subject_type === 'LECTURER' ? (
                                      <User className="w-3.5 h-3.5" />
                                    ) : (
                                      <Building2 className="w-3.5 h-3.5" />
                                    )}
                                  </span>
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                      {row.subject_name}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {labels[row.subject_type]}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5 max-w-[280px]">
                                <div className="font-semibold text-slate-800 line-clamp-2 dark:text-white">
                                  {row.title}
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                                  <span>{row.type_name}</span>
                                  {row.decision_number && (
                                    <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-[10px] dark:bg-slate-700">
                                      Số QĐ: {row.decision_number}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-3.5">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {row.context_unit_name}
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  ID: #{row.context_unit_id}
                                </div>
                              </td>

                              <td className="p-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{row.recognition_year}</span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {row.academic_year_code || '—'}
                                </div>
                              </td>

                              <td className="p-3.5 whitespace-nowrap">
                                <div className="space-y-1">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${statusPill}`}
                                  >
                                    {STATUS_LABELS[row.status] || row.status}
                                  </span>
                                  <div>
                                    {row.is_valid ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3 h-3" /> Hợp lệ
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                        <XCircle className="w-3 h-3 text-slate-400" /> Không tính hợp lệ
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {!data.items.length && (
                      <div className="p-12 text-center text-slate-400">
                        <FileSpreadsheet className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                        <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
                          Không có bản ghi nào
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Không tìm thấy kết quả phù hợp với bộ lọc và phạm vi phân quyền hiện tại.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Pagination */}
                <div className="flex items-center justify-between bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Trang <strong className="text-slate-800 dark:text-white">{page}</strong> /{' '}
                    {Math.max(1, Math.ceil(data.total / 20))}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((v) => Math.max(1, v - 1))}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Trước</span>
                    </button>
                    <button
                      type="button"
                      disabled={page * 20 >= data.total}
                      onClick={() => setPage((v) => v + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
                    >
                      <span>Sau</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
