import Select from '../components/common/Select';
import PageHeader from '../components/common/PageHeader';
import UnderlineTabs from '../components/common/UnderlineTabs';
import React, { useEffect, useState } from 'react';
import {
  BarChart3,
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
  Sparkles,
  RefreshCw,
  Users,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../services/reportsApi.js';
import { organizationsApi } from '../services/organizationsApi.js';
import { regulationsApi } from '../services/regulationsApi.js';
import { USE_FIXTURES } from '../services/apiConfig.js';
import { ErrorState, LoadingState, Skeleton } from '../components/common/AsyncState';
import { useSelectionOptions } from '../hooks/useSelections';
import { EntitySelect } from '../components/common/EntityPicker';

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
  const choices = useSelectionOptions('REPORT');
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!USE_FIXTURES);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);
  const handledReload = React.useRef(0);

  const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));
  const canExport = roles.some((r) =>
    ['ADMIN', 'MANAGER', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE', 'DEPARTMENT_HEAD', 'FACULTY_LEAD'].includes(r)
  );
  const canScanUnit = roles.some((r) =>
    ['ADMIN', 'MANAGER', 'UNIT_REPRESENTATIVE', 'DEPARTMENT_HEAD', 'FACULTY_LEAD'].includes(r)
  );

  // Unit AI Scan Tab States
  const [activeReportTab, setActiveReportTab] = useState('statistics'); // 'statistics' | 'ai_scan'
  const [scanUnitId, setScanUnitId] = useState('');
  const [scanRegulationId, setScanRegulationId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanFilter, setScanFilter] = useState('all'); // 'all' | 'eligible' | 'not_eligible'
  const [regulationsList, setRegulationsList] = useState([]);
  const [allUnits, setAllUnits] = useState([]);

  useEffect(() => {
    if (!canScanUnit) return;
    regulationsApi.listDocuments()
      .then(res => {
        const docs = Array.isArray(res) ? res : res?.items || res?.data || [];
        setRegulationsList(docs);
        if (docs.length) {
          setScanRegulationId(curr => curr || String(docs[0].document_id || docs[0].id));
        }
      })
      .catch(() => {});

    organizationsApi.list()
      .then(res => {
        const orgs = Array.isArray(res) ? res : res?.items || res?.data || [];
        setAllUnits(orgs);
        if (orgs.length) {
          setScanUnitId(curr => curr || String(orgs[0].unit_id || orgs[0].organization_unit_id || orgs[0].id));
        }
      })
      .catch(() => {});
  }, [canScanUnit]);

  const runUnitAiScan = async () => {
    if (!scanUnitId || !scanRegulationId) return;
    setScanning(true);
    setScanError(null);
    setScanProgress(20);

    const progressTimer = setInterval(() => {
      setScanProgress(p => (p < 85 ? p + 15 : p));
    }, 250);

    try {
      const res = await organizationsApi.aiScanUnit(scanUnitId, {
        regulationId: Number(scanRegulationId),
      });
      clearInterval(progressTimer);
      setScanProgress(100);
      setScanResult(res?.data || res);
    } catch (err) {
      clearInterval(progressTimer);
      setScanError(err.message || 'Lỗi khi quét AI đơn vị.');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    let current = true;
    if (USE_FIXTURES) return undefined;
    setLoading(true);
    setError(null);
    const fresh = reload !== handledReload.current;
    handledReload.current = reload;
    reportsApi
      .list({ ...clean(filters), page, pageSize: 20 }, dashboard, fresh)
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
      a.download = `bao-cao${filters.kind === 'ACHIEVEMENT' ? '-thanh-tich' : filters.kind === 'AWARD' ? '-khen-thuong' : ''}${filters.recognitionYear ? '-' + filters.recognitionYear : ''}-${new Date().toLocaleDateString('sv-SE')}.csv`;
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
      <PageHeader
        title={dashboard ? `Tổng quan báo cáo · ${user?.displayName || 'Hồ sơ'}` : 'Báo cáo & Quét AI'}
        description="Thống kê thành tích, khen thưởng và hỗ trợ lãnh đạo đơn vị quét đối chiếu tiêu chí nhân sự."
        icon={BarChart3}
        onRefresh={() => setReload(value => value + 1)}
        refreshing={loading}
        exportAction={
          activeReportTab === 'statistics' && canExport
            ? { label: exporting ? 'Đang xuất CSV...' : 'Xuất Báo Cáo CSV', onClick: download, disabled: exporting || loading }
            : null
        }
        tabs={
          canScanUnit ? (
            <UnderlineTabs
              label="Chế độ báo cáo"
              value={activeReportTab}
              onChange={setActiveReportTab}
              items={[
                { id: 'statistics', label: 'Thống kê & Xuất CSV', icon: BarChart3 },
                { id: 'ai_scan', label: 'Quét AI Đơn vị (Unit AI Scan)', icon: Sparkles },
              ]}
            />
          ) : null
        }
      />

      {activeReportTab === 'statistics' && (
        USE_FIXTURES ? (
          <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Info className="w-4 h-4 text-amber-600" />
              Đang chạy chế độ dữ liệu mẫu
            </div>
            <p className="mt-1">
              Để xem báo cáo thực tế, quản trị viên cần kết nối nguồn dữ liệu. Cấu hình{' '}
              <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">VITE_DATA_SOURCE=api</code>{' '}
              trong frontend để trải nghiệm đầy đủ.
            </p>
          </div>
        ) : (
        <>
          {/* 2. Metric Cards (Matching Dashboard soft pastel cards) */}
          {(
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
                const s = data?.summary?.find(
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
                        {loading ? <Skeleton className="h-9 w-16" /> : data ? s?.valid_count || 0 : '—'}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Hợp lệ
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${pillBg}`}>
                        {loading ? <Skeleton className="h-4 w-24" /> : data ? `${s?.distinct_years || 0} năm ghi nhận` : '—'}
                      </span>
                      <span>{loading ? <Skeleton className="h-4 w-16" /> : data ? `Tổng: ${s?.total || 0}` : 'Tổng: —'}</span>
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
                <Select
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
                </Select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chủ thể
                </span>
                <Select
                  className={inputClass}
                  value={draft.subjectType}
                  onChange={(e) => setDraft({ ...draft, subjectType: e.target.value })}
                >
                  <option value="">Tất cả chủ thể</option>
                  <option value="LECTURER">Cá nhân (Giảng viên)</option>
                  <option value="UNIT">Tập thể (Đơn vị)</option>
                </Select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Trạng thái
                </span>
                <Select
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
                </Select>
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

              <EntitySelect label="Năm học (thành tích)" options={choices.academicYears} value={draft.academicYearId} onChange={academicYearId=>setDraft({...draft,academicYearId})} placeholder="Tất cả năm học" disabled={draft.kind==='AWARD' || choices.loading} className={inputClass}/>
              <EntitySelect label="Đơn vị ghi nhận hồ sơ" options={choices.units} value={draft.contextUnitId} onChange={contextUnitId=>setDraft({...draft,contextUnitId})} placeholder="Tất cả đơn vị được phép xem" disabled={choices.loading} className={inputClass}/>
              <EntitySelect label="Loại thành tích / khen thưởng" options={draft.kind==='AWARD' ? choices.awardTypes : draft.kind==='ACHIEVEMENT' ? choices.achievementTypes : []} value={draft.typeId} onChange={typeId=>setDraft({...draft,typeId})} placeholder={draft.kind ? 'Tất cả loại' : 'Chọn nguồn hồ sơ trước'} disabled={!draft.kind || choices.loading} className={inputClass}/>
              {choices.error && <p role="alert" className="text-sm text-rose-600">{choices.error}</p>}

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
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400">
                          <th className="p-3.5">Loại bản ghi</th>
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
                              <td className="p-3.5" title={`Mã bản ghi: ${row.id}`}>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold text-[11px] ${
                                    row.kind === 'ACHIEVEMENT'
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                  }`}
                                >
                                  {labels[row.kind]}
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
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {labels[row.subject_type]}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5 max-w-[280px]">
                                <div className="font-semibold text-slate-800 line-clamp-2 dark:text-white">
                                  {row.title}
                                </div>
                                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
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
                                
                              </td>

                              <td className="p-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{row.recognition_year}</span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {row.academic_year_code || '—'}
                                </div>
                              </td>

                              <td className="p-3.5 whitespace-nowrap">
                                <div className="space-y-1">
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPill}`}
                                  >
                                    {STATUS_LABELS[row.status] || row.status}
                                  </span>
                                  <div>
                                    {row.is_valid ? (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3 h-3" /> Được tính vào thống kê
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        <XCircle className="w-3 h-3 text-slate-400" /> Chưa tính vào thống kê
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
        )
      )}

      {/* ================= TAB 2: QUÉT AI ĐƠN VỊ (UNIT AI SCAN) ================= */}
      {activeReportTab === 'ai_scan' && (
        <div className="space-y-6">
          {/* Scan Controls */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Quét AI Đơn vị (Unit Personnel Evaluation)
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Kiểm tra & Rà soát tiêu chí thành viên theo quy chế
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dành cho Trưởng bộ môn, Ban chủ nhiệm Khoa và Ban giám hiệu. Tự động đối chiếu kho thành tích của tất cả nhân sự thuộc đơn vị với quy định thi đua khen thưởng đã chọn.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2">
              {/* Unit Selector */}
              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chọn Đơn vị / Khoa / Bộ môn <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={scanUnitId}
                  onChange={(e) => setScanUnitId(e.target.value)}
                  disabled={scanning}
                  className="w-full text-xs"
                >
                  {allUnits.map((u) => (
                    <option key={u.unit_id || u.organization_unit_id || u.id} value={u.unit_id || u.organization_unit_id || u.id}>
                      {u.unit_name || u.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Regulation Selector */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Quy chế khen thưởng mục tiêu <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={scanRegulationId}
                  onChange={(e) => setScanRegulationId(e.target.value)}
                  disabled={scanning}
                  className="w-full text-xs"
                >
                  {regulationsList.map((r) => (
                    <option key={r.document_id || r.id} value={r.document_id || r.id}>
                      {r.document_code ? `[${r.document_code}] ` : ''}{r.title || r.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Scan Button */}
              <div className="md:col-span-3">
                <button
                  type="button"
                  disabled={scanning || !scanUnitId || !scanRegulationId}
                  onClick={runUnitAiScan}
                  className="w-full h-11 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft-sm"
                >
                  {scanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang quét AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Bắt đầu Quét AI Đơn vị</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Animated Progress Bar */}
            {scanning && (
              <div className="pt-3 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-teal-700 dark:text-teal-300">
                  <span>Đang quét và đối soát tiêu chí hồ sơ thành tích của các thành viên trong đơn vị...</span>
                  <span>{scanProgress}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}

            {scanError && (
              <div role="alert" className="p-3.5 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{scanError}</span>
              </div>
            )}
          </div>

          {/* Scan Results View */}
          {scanResult && (
            <div className="space-y-6 animate-fade-in">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-xs font-semibold">Tổng nhân sự quét</span>
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {scanResult.totalMembers ?? (scanResult.results?.length || 0)}
                  </div>
                  <p className="text-[11px] text-slate-400">thành viên trong đơn vị</p>
                </div>

                <div className="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-emerald-200/80 dark:border-emerald-900/60 shadow-soft-sm space-y-1">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                    <span className="text-xs font-semibold">Số lượng đủ điều kiện</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {scanResult.eligibleCount ?? (scanResult.results?.filter(r => r.isEligible)?.length || 0)}
                  </div>
                  <p className="text-[11px] text-emerald-600/70">đạt 100% tiêu chí quy chế</p>
                </div>

                <div className="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-teal-200/80 dark:border-teal-900/60 shadow-soft-sm space-y-1">
                  <div className="flex items-center justify-between text-teal-700 dark:text-teal-400">
                    <span className="text-xs font-semibold">Tỷ lệ đủ điều kiện</span>
                    <Sparkles className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">
                    {Math.round(((scanResult.eligibleCount || 0) / (scanResult.totalMembers || scanResult.results?.length || 1)) * 100)}%
                  </div>
                  <p className="text-[11px] text-teal-600/70">trên tổng số nhân sự</p>
                </div>
              </div>

              {/* Member Breakdown Table Card */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm overflow-hidden">
                {/* Table Header Controls */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Bảng đối soát chi tiết từng thành viên
                    </h3>
                    <p className="text-xs text-slate-500">
                      Hiển thị kết quả đối khớp tiêu chí và các khoảng trống cần hoàn thiện
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setScanFilter('all')}
                      className={`px-3 py-1 rounded-lg transition ${
                        scanFilter === 'all'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-soft-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      Tất cả ({scanResult.results?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanFilter('eligible')}
                      className={`px-3 py-1 rounded-lg transition ${
                        scanFilter === 'eligible'
                          ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-soft-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600'
                      }`}
                    >
                      Đủ chuẩn ({scanResult.results?.filter(r => r.isEligible)?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanFilter('not_eligible')}
                      className={`px-3 py-1 rounded-lg transition ${
                        scanFilter === 'not_eligible'
                          ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-soft-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-amber-600'
                      }`}
                    >
                      Chưa đạt ({scanResult.results?.filter(r => !r.isEligible)?.length || 0})
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-700/60">
                      <tr>
                        <th className="py-3.5 px-5">Thành viên</th>
                        <th className="py-3.5 px-4">Tỷ lệ đạt</th>
                        <th className="py-3.5 px-4">Trạng thái</th>
                        <th className="py-3.5 px-5">Tiêu chí đã thỏa</th>
                        <th className="py-3.5 px-5">Tiêu chí còn thiếu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {(scanResult.results || [])
                        .filter(m => {
                          if (scanFilter === 'eligible') return m.isEligible;
                          if (scanFilter === 'not_eligible') return !m.isEligible;
                          return true;
                        })
                        .map((m, idx) => (
                          <tr key={m.userId || m.lecturerId || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition">
                            <td className="py-3.5 px-5 min-w-[180px]">
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {m.fullName || m.name || `Giảng viên #${m.userId}`}
                              </span>
                              <span className="text-[11px] text-slate-400 block truncate">
                                {m.email || m.unitName || '—'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 w-32">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span>{m.percentage || 0}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      m.isEligible ? 'bg-emerald-500' : (m.percentage || 0) >= 50 ? 'bg-teal-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${m.percentage || 0}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              {m.isEligible ? (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px] inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Đủ chuẩn
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium text-[10px] inline-flex items-center gap-1">
                                  Chưa đạt
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-5 max-w-xs">
                              {(!m.matched || m.matched.length === 0) ? (
                                <span className="text-slate-400 italic text-[11px]">Chưa đạt tiêu chí nào</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {m.matched.map((mat, mIdx) => (
                                    <span
                                      key={mIdx}
                                      className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] truncate max-w-[200px]"
                                      title={mat.name}
                                    >
                                      ✓ {mat.code || mat.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-5 max-w-xs">
                              {(!m.missing || m.missing.length === 0) ? (
                                <span className="text-emerald-600 font-semibold text-[11px]">Đã thỏa mãn tất cả</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {m.missing.map((mis, misIdx) => (
                                    <span
                                      key={misIdx}
                                      className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[10px] truncate max-w-[200px]"
                                      title={mis.name}
                                    >
                                      ! {mis.code || mis.name} {mis.missingCount ? `(thiếu ${mis.missingCount} ${mis.unit || ''})` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
