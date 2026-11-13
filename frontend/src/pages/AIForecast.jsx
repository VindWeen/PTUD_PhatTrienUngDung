import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  History,
  FileCheck2,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronRight,
  User,
  Building2,
  Sparkles,
  Download,
  AlertCircle,
  Calendar,
  ArrowRight,
  FileText,
  Clock,
  Layers,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import Select from '../components/common/Select';
import UnderlineTabs from '../components/common/UnderlineTabs';
import PageHeader from '../components/common/PageHeader';
import { EntitySelect, lecturerLabel } from '../components/common/EntityPicker';
import { useSelectionOptions } from '../hooks/useSelections';
import { aiEvaluationApi } from '../services/aiEvaluationApi';
import { regulationsApi } from '../services/regulationsApi';
import { kpiApi } from '../services/kpiApi';
import { calendarApi } from '../services/calendarApi';
import { LoadingState, ErrorState, EmptyState } from '../components/common/AsyncState';
import EvaluationResults from '../components/ai/EvaluationResults';
import fixtures from '../../../docs/ai/eval-dev/EvaluationRun.fixtures.json';

const conclusions = {
  SIMULATION_ONLY: 'Chỉ mô phỏng',
  NEEDS_HUMAN_REVIEW: 'Cần người có thẩm quyền rà soát',
  SATISFIED: 'Đủ điều kiện tiêu chuẩn',
  FAILED: 'Chưa đạt tiêu chuẩn',
};
const runStatuses = { COMPLETED: 'Đã hoàn tất', FLAGGED_UNCONFIRMED: 'Cần rà soát thêm', FAILED: 'Đánh giá không thành công' };

export default function AIForecast() {
  const [activeTab, setActiveTab] = useState('regulation'); // 'regulation' | 'discovery' | 'history' | 'fixtures'

  // Common Selection Options
  const choices = useSelectionOptions('AI');
  const [subjectType, setSubjectType] = useState('LECTURER');
  const [subjectId, setSubjectId] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [provider, setProvider] = useState('auto');

  // Choose from authorized subjects
  useEffect(() => {
    if (choices.loading) return;
    const subjects = subjectType === 'LECTURER' ? choices.lecturers : choices.subjectUnits;
    setSubjectId(current => subjects.some(s => String(s.id) === String(current)) ? current : String(subjects[0]?.id || ''));
  }, [choices.loading, choices.lecturers, choices.subjectUnits, subjectType]);

  // ================= TAB 1: KHÁM THEO QUY CHẾ =================
  const [regulations, setRegulations] = useState([]);
  const [selectedRegulationId, setSelectedRegulationId] = useState('');
  const [loadingRegulations, setLoadingRegulations] = useState(true);
  const [regulationCriteria, setRegulationCriteria] = useState([]);
  const [loadingRegCriteria, setLoadingRegCriteria] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(null);
  const [currentRun, setCurrentRun] = useState(null);
  const [explanations, setExplanations] = useState({});
  const [aiStates, setAiStates] = useState({});
  const [progress, setProgress] = useState(null);
  const [exportingZip, setExportingZip] = useState(false);
  const mounted = useRef(true);
  const operation = useRef(false);
  const currentRunId = useRef(null);

  // Load regulations list
  useEffect(() => {
    let active = true;
    setLoadingRegulations(true);
    regulationsApi.listDocuments()
      .then(res => {
        if (!active) return;
        const docs = Array.isArray(res) ? res : res?.items || res?.data || [];
        setRegulations(docs);
        if (docs.length) {
          setSelectedRegulationId(curr => curr || String(docs[0].document_id || docs[0].id));
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setLoadingRegulations(false); });
    return () => { active = false; };
  }, []);

  // When selected regulation changes, load its criteria
  useEffect(() => {
    if (!selectedRegulationId) return;
    let active = true;
    setLoadingRegCriteria(true);
    regulationsApi.listCriteria({ documentId: selectedRegulationId })
      .then(res => {
        if (!active) return;
        const crits = Array.isArray(res) ? res : res?.items || res?.data || [];
        setRegulationCriteria(crits);
      })
      .catch(() => {
        if (active) setRegulationCriteria([]);
      })
      .finally(() => { if (active) setLoadingRegCriteria(false); });
    return () => { active = false; };
  }, [selectedRegulationId]);

  // Execute structured evaluation for selected regulation
  const handleRunRegulationEvaluation = async (e) => {
    if (e) e.preventDefault();
    if (evaluating || !selectedRegulationId) return;
    setEvaluating(true);
    setEvalError(null);
    setCurrentRun(null);
    setExplanations({});
    setAiStates({});
    setProgress({ stage: 'data' });

    try {
      const criteriaIds = regulationCriteria.map(c => c.criteria_version_id || c.criterionId || c.criteriaId).filter(Boolean);
      const payload = {
        subjectType,
        subjectId: Number(subjectId) || undefined,
        criteriaVersionIds: criteriaIds.length ? criteriaIds.map(Number) : undefined,
        regulationId: Number(selectedRegulationId),
        asOfDate,
        forcedProvider: provider,
      };

      const result = await aiEvaluationApi.evaluateStructured(payload);
      if (!mounted.current) return;
      setCurrentRun(result);
      currentRunId.current = result.runId;
      const results = result.criterionResults || [];
      setAiStates(Object.fromEntries(results.map(item => [item.criterionId, { status: 'idle' }])));
      setProgress({ stage: 'complete' });
    } catch (err) {
      if (mounted.current) setEvalError(err);
    } finally {
      if (mounted.current) setEvaluating(false);
    }
  };

  // Export Dossier ZIP Handler
  const handleExportZip = async (regId, regTitle) => {
    const idToUse = regId || selectedRegulationId;
    if (!idToUse) return;
    setExportingZip(true);
    try {
      const blob = await aiEvaluationApi.exportDossierZip({ regulationId: Number(idToUse) });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sanitizedTitle = (regTitle || 'Quy_Che').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      a.download = `Goi_Minh_Chung_${sanitizedTitle}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Không thể tải gói hồ sơ ZIP: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setExportingZip(false);
    }
  };

  // ================= TAB 2: KHÁM NGƯỢC TIỀM NĂNG / AUTO-DISCOVERY =================
  const [discoveryList, setDiscoveryList] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState(null);

  const runAutoDiscovery = useCallback(async () => {
    setDiscovering(true);
    setDiscoveryError(null);
    try {
      const res = await aiEvaluationApi.autoDiscovery({
        subjectType,
        subjectId: Number(subjectId) || undefined,
        asOfDate,
      });
      const items = res?.data || (Array.isArray(res) ? res : []);
      setDiscoveryList(items);
    } catch (err) {
      setDiscoveryError(err.message || 'Lỗi khi quét tiềm năng danh hiệu');
    } finally {
      setDiscovering(false);
    }
  }, [subjectType, subjectId, asOfDate]);

  useEffect(() => {
    if (activeTab === 'discovery' && discoveryList.length === 0 && !discovering) {
      runAutoDiscovery();
    }
  }, [activeTab, discoveryList.length, discovering, runAutoDiscovery]);

  // ================= GAP TO KPI MODAL STATE =================
  const [gapModalOpen, setGapModalOpen] = useState(false);
  const [gapRegulation, setGapRegulation] = useState(null);
  const [gapMissingCriteria, setGapMissingCriteria] = useState([]);
  const [gapAddReminder, setGapAddReminder] = useState(true);
  const [gapDeadlineDate, setGapDeadlineDate] = useState('');
  const [gapTransferring, setGapTransferring] = useState(false);
  const [gapSuccessNotice, setGapSuccessNotice] = useState(null);

  const openGapToKpiModal = (regulation, missingCriteria) => {
    setGapRegulation(regulation);
    setGapMissingCriteria(missingCriteria || []);
    setGapAddReminder(true);
    // Pre-fill deadline date from regulation deadline or 30 days ahead
    if (regulation?.deadline) {
      setGapDeadlineDate(regulation.deadline.slice(0, 10));
    } else {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      setGapDeadlineDate(future.toISOString().slice(0, 10));
    }
    setGapSuccessNotice(null);
    setGapModalOpen(true);
  };

  const handleConfirmGapTransfer = async () => {
    if (!gapRegulation || !gapMissingCriteria || gapMissingCriteria.length === 0) {
      alert('Không có tiêu chí thiếu để chuyển thành KPI.');
      return;
    }
    setGapTransferring(true);
    try {
      const regId = Number(gapRegulation.regulationId || gapRegulation.documentId || gapRegulation.id || selectedRegulationId);
      if (!regId || Number.isNaN(regId) || regId <= 0) {
        alert('Không tìm thấy mã quy chế hợp lệ.');
        return;
      }

      const cleanMissingCriteria = gapMissingCriteria.map((g, i) => {
        const rawCode = String(g.code || g.criterionCode || `GAP_${i + 1}`).trim();
        const rawName = String(g.name || g.criterionName || `Tiêu chí ${rawCode}`).trim();
        const countVal = Math.max(1, parseInt(g.missingCount, 10) || 1);
        const unitVal = String(g.unit || g.measureUnit || g.thresholdMetric?.unit || 'tiêu chí').trim();
        return {
          code: rawCode.slice(0, 80).toUpperCase(),
          name: rawName.slice(0, 255),
          missingCount: countVal,
          unit: unitVal.slice(0, 32),
        };
      });

      if (cleanMissingCriteria.length === 0) {
        alert('Không có tiêu chí thiếu để chuyển thành KPI.');
        return;
      }

      const payload = {
        regulationId: regId,
        missingCriteria: cleanMissingCriteria,
      };

      await kpiApi.createFromAiGap(payload);

      // Optionally create calendar reminder
      if (gapAddReminder && gapDeadlineDate) {
        await calendarApi.createReminder({
          title: `Hạn nộp hồ sơ: ${gapRegulation.name || gapRegulation.title || 'Quy chế khen thưởng'}`,
          deadlineDate: gapDeadlineDate,
          regulationId: regId,
          description: `Lộ trình hoàn thiện ${cleanMissingCriteria.length} tiêu chí còn thiếu để đạt danh hiệu.`,
        });
      }

      setGapSuccessNotice({
        message: `Đã chuyển thành công ${cleanMissingCriteria.length} tiêu chí còn thiếu thành Mục tiêu KPI${gapAddReminder ? ' và thêm sự kiện vào Lịch cá nhân' : ''}!`,
      });
    } catch (err) {
      alert('Không thể chuyển thành KPI: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setGapTransferring(false);
    }
  };

  // ================= TAB 3: LỊCH SỬ PHIÊN AI =================
  const [historyRuns, setHistoryRuns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const loadHistory = useCallback(async (fresh = true) => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await aiEvaluationApi.listEvaluationRuns({}, fresh);
      const runs = res?.items || res?.data || (Array.isArray(res) ? res : []);
      setHistoryRuns(runs);
    } catch (err) {
      setHistoryError(err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory(false);
  }, [activeTab, loadHistory]);

  // Tab 4: Fixtures
  const [selectedFixtureCase, setSelectedFixtureCase] = useState(fixtures.fixtures[0]?.caseId);
  const fixtureItem = fixtures.fixtures.find(f => f.caseId === selectedFixtureCase);

  // Compute criteria breakdown from currentRun
  const currentResults = currentRun?.criterionResults || [];
  const satisfiedResults = currentResults.filter(r => r.isSatisfied || r.thresholdMetric?.isSatisfied);
  const missingResults = currentResults.filter(r => !r.isSatisfied && !r.thresholdMetric?.isSatisfied);
  const currentTotal = currentResults.length;
  const currentPercentage = currentTotal > 0 ? Math.round((satisfiedResults.length / currentTotal) * 100) : 0;
  const currentSelectedReg = regulations.find(r => String(r.document_id || r.id) === String(selectedRegulationId));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trợ lý AI & Khám quy chế"
        description="Khám đối chiếu quy chế khen thưởng, tự động xếp hạng tiềm năng danh hiệu và chuyển tiêu chí thiếu thành lộ trình KPI."
        icon={Cpu}
        onRefresh={() => {
          if (activeTab === 'regulation') handleRunRegulationEvaluation();
          else if (activeTab === 'discovery') runAutoDiscovery();
          else if (activeTab === 'history') loadHistory(true);
        }}
        refreshing={evaluating || discovering || loadingHistory}
        tabs={
          <UnderlineTabs
            label="Phương thức phân tích AI"
            value={activeTab}
            disabled={evaluating || discovering}
            onChange={setActiveTab}
            items={[
              { id: 'regulation', label: 'Khám theo quy chế', icon: Cpu },
              { id: 'discovery', label: 'Khám ngược tiềm năng / Auto-Discovery', icon: Sparkles },
              { id: 'history', label: 'Lịch sử Phiên AI', icon: History },
              { id: 'fixtures', label: 'Hồ sơ mẫu', icon: FileCheck2 },
            ]}
          />
        }
      />

      {/* ================= TAB 1: KHÁM THEO QUY CHẾ ================= */}
      {activeTab === 'regulation' && (
        <div className="space-y-6">
          {/* Regulation & Subject Selector Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-teal-600" />
              <span>Chọn Quy chế / Danh hiệu cần khám</span>
            </h2>

            <form onSubmit={handleRunRegulationEvaluation} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Regulation Selector */}
              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Quy chế / Danh hiệu mục tiêu <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={selectedRegulationId}
                  onChange={(e) => setSelectedRegulationId(e.target.value)}
                  disabled={loadingRegulations || evaluating}
                  className="w-full text-xs"
                >
                  {regulations.map((reg) => (
                    <option key={reg.document_id || reg.id} value={reg.document_id || reg.id}>
                      {reg.document_code ? `[${reg.document_code}] ` : ''}{reg.title || reg.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Subject Select */}
              <div className="md:col-span-4 space-y-1.5">
                <EntitySelect
                  label="Chủ thể thẩm định"
                  options={subjectType === 'LECTURER' ? choices.lecturers : choices.subjectUnits}
                  value={subjectId}
                  onChange={setSubjectId}
                  required
                  disabled={choices.loading || evaluating}
                  placeholder="Chọn chủ thể"
                  getLabel={subjectType === 'LECTURER' ? lecturerLabel : o => o.name}
                />
              </div>

              {/* As Of Date & Action */}
              <div className="md:col-span-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={evaluating || !selectedRegulationId || loadingRegCriteria}
                  className="w-full h-11 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft-sm"
                >
                  {evaluating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang khám...</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4" />
                      <span>Kiểm tra theo quy chế</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {loadingRegCriteria && (
              <p className="text-xs text-slate-500 animate-pulse">Đang tải danh sách tiêu chí của quy chế...</p>
            )}
          </div>

          {evalError && (
            <div role="alert" className="p-4 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{evalError.message || 'Lỗi khi kiểm tra quy chế.'}</span>
            </div>
          )}

          {/* Results Display */}
          {currentRun && (
            <div className="space-y-6 animate-fade-in">
              {/* Score & Prediction Summary Card */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                      Dự báo kết quả thẩm định
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {currentSelectedReg?.title || 'Quy chế khen thưởng'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Đạt {satisfiedResults.length} / {currentTotal} tiêu chí theo chuẩn quy chế
                    </p>
                  </div>

                  {/* Feasibility Badge */}
                  <div>
                    {currentPercentage === 100 ? (
                      <span className="px-4 py-2 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs inline-flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800 shadow-soft-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Đủ điều kiện xét thưởng (100%)
                      </span>
                    ) : (
                      <span className="px-4 py-2 rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-xs inline-flex items-center gap-1.5 border border-amber-300 dark:border-amber-800 shadow-soft-sm">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        Chưa đủ điều kiện (Còn thiếu {missingResults.length} tiêu chí)
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Tỷ lệ hoàn thành</span>
                    <span className="text-teal-600 dark:text-teal-400 text-base">{currentPercentage}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        currentPercentage === 100 ? 'bg-emerald-500' : currentPercentage >= 50 ? 'bg-teal-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${currentPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Action Bar: Export Dossier ZIP & Transfer to KPI */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Xuất gói minh chứng (.ZIP) */}
                    <button
                      type="button"
                      disabled={exportingZip}
                      onClick={() => handleExportZip(selectedRegulationId, currentSelectedReg?.title)}
                      className="px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition flex items-center gap-2 shadow-soft-sm disabled:opacity-50"
                    >
                      {exportingZip ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang đóng gói ZIP...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 text-teal-400" />
                          <span>Xuất gói minh chứng (.ZIP)</span>
                        </>
                      )}
                    </button>

                    {/* Chuyển thành mục tiêu KPI */}
                    {missingResults.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openGapToKpiModal(currentSelectedReg, missingResults)}
                        className="px-4 py-2.5 rounded-xl font-semibold text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 transition flex items-center gap-2 shadow-soft-sm"
                      >
                        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Chuyển thành mục tiêu KPI ({missingResults.length} tiêu chí)</span>
                      </button>
                    )}
                  </div>

                  <span className="text-xs text-slate-400">
                    Mã phiên: #{currentRun.runId}
                  </span>
                </div>
              </div>

              {/* Criteria Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Passed Criteria */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-emerald-200/80 dark:border-emerald-900/60 shadow-soft-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-emerald-100 dark:border-emerald-900/40">
                    <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Tiêu chí đã đạt ({satisfiedResults.length})</span>
                    </h4>
                  </div>

                  {satisfiedResults.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">Chưa có tiêu chí nào đạt chuẩn.</p>
                  ) : (
                    <div className="space-y-3">
                      {satisfiedResults.map((crit, idx) => (
                        <div key={idx} className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {crit.criterionCode ? `[${crit.criterionCode}] ` : ''}{crit.criterionName || crit.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 font-semibold text-[10px] shrink-0">
                              Đạt chuẩn
                            </span>
                          </div>

                          {crit.matchedRecords?.length > 0 && (
                            <div className="pt-1 space-y-1">
                              <span className="text-[10px] text-slate-500 font-semibold uppercase">Minh chứng đối khớp:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {crit.matchedRecords.map((m, mIdx) => (
                                  <span key={mIdx} className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] truncate max-w-xs">
                                    ✓ {m.title || `Thành tích #${m.id}`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Missing Criteria (Gaps) */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-amber-200/80 dark:border-amber-900/60 shadow-soft-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-amber-100 dark:border-amber-900/40">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Tiêu chí còn thiếu / Khoảng trống ({missingResults.length})</span>
                    </h4>
                  </div>

                  {missingResults.length === 0 ? (
                    <p className="text-xs text-emerald-600 italic py-4 text-center">Xin chúc mừng! Không có tiêu chí nào còn thiếu.</p>
                  ) : (
                    <div className="space-y-3">
                      {missingResults.map((crit, idx) => (
                        <div key={idx} className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {crit.criterionCode ? `[${crit.criterionCode}] ` : ''}{crit.criterionName || crit.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 font-semibold text-[10px] shrink-0">
                              Còn thiếu {crit.missingCount || 1} {crit.thresholdMetric?.unit || 'tiêu chí'}
                            </span>
                          </div>

                          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                            Yêu cầu: tối thiểu {crit.thresholdMetric?.target || 1} {crit.thresholdMetric?.unit || 'tiêu chí'}. Thực tế đã ghi nhận: {crit.thresholdMetric?.actual || 0}.
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RAG Explanations View */}
              {currentResults.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span>Giải thích chi tiết từ Trợ lý AI (Citations Điều/Khoản)</span>
                  </h4>
                  <EvaluationResults
                    run={currentRun}
                    explanations={explanations}
                    aiStates={aiStates}
                    onExplain={async (result) => {
                      try {
                        const res = await aiEvaluationApi.explainEvaluation({
                          criterionResult: result,
                          runId: currentRun.runId,
                          asOfDate,
                          provider,
                        });
                        setExplanations(prev => ({ ...prev, [result.criterionId]: res }));
                        setAiStates(prev => ({ ...prev, [result.criterionId]: { status: 'success' } }));
                      } catch (err) {
                        setAiStates(prev => ({ ...prev, [result.criterionId]: { status: 'error', message: err.message } }));
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: KHÁM NGƯỢC TIỀM NĂNG / AUTO-DISCOVERY ================= */}
      {activeTab === 'discovery' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-teal-500/10 via-purple-500/10 to-transparent rounded-3xl p-6 border border-teal-200/80 dark:border-teal-800/80 shadow-soft-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Khám ngược tiềm năng (Auto-Discovery)
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Xếp hạng danh hiệu thi đua khả thi nhất
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                AI tự động đối soát toàn bộ kho quy chế đang mở với thành tích của bạn và xếp hạng theo tỷ lệ hoàn thành từ cao xuống thấp.
              </p>
            </div>

            <button
              type="button"
              disabled={discovering}
              onClick={runAutoDiscovery}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center gap-2 shadow-soft-sm shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${discovering ? 'animate-spin' : ''}`} />
              <span>{discovering ? 'Đang quét toàn trường...' : 'Quét lại toàn bộ'}</span>
            </button>
          </div>

          {discoveryError && (
            <div role="alert" className="p-4 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs">
              {discoveryError}
            </div>
          )}

          {discovering && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                AI đang quét toàn bộ kho quy chế và đối chiếu thành tích của bạn...
              </p>
              <p className="text-xs text-slate-400">Quá trình này mất khoảng vài giây.</p>
            </div>
          )}

          {!discovering && discoveryList.length === 0 && !discoveryError && (
            <div className="py-12 text-center space-y-2 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
              <Cpu className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm text-slate-500">Chưa tìm thấy quy chế nào khả thi.</p>
            </div>
          )}

          {!discovering && discoveryList.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {discoveryList.map((item, idx) => {
                const missingCriteria = (item.criteria || []).filter(c => !c.isSatisfied);
                const isTop100 = item.percentage === 100;
                const isHighPotential = item.percentage >= 50 && item.percentage < 100;

                return (
                  <article
                    key={item.regulationId || idx}
                    className={`bg-white dark:bg-slate-800 rounded-3xl p-6 border transition shadow-soft-sm space-y-4 ${
                      isTop100
                        ? 'border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                        : isHighPotential
                        ? 'border-teal-200 dark:border-teal-800'
                        : 'border-slate-200/80 dark:border-slate-700/80'
                    }`}
                  >
                    {/* Header: Title and Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <span className="text-[10px] font-mono text-slate-400 block truncate">
                          {item.documentCode || `Quy chế #${item.regulationId}`}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                          {item.name || 'Danh hiệu khen thưởng'}
                        </h3>
                      </div>

                      {/* Percentage Badge */}
                      <div className="text-right shrink-0">
                        <span className={`text-xl font-extrabold ${
                          isTop100 ? 'text-emerald-600' : isHighPotential ? 'text-teal-600' : 'text-amber-600'
                        }`}>
                          {item.percentage}%
                        </span>
                        <span className="block text-[10px] text-slate-400 font-medium">phù hợp</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full ${isTop100 ? 'bg-emerald-500' : isHighPotential ? 'bg-teal-500' : 'bg-amber-500'}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>

                    {/* Stats & Feasibility Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">
                        Đạt <strong>{item.satisfiedCount}</strong> / {item.totalCount} tiêu chí
                      </span>

                      {isTop100 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                          ✓ Đủ điều kiện nộp ngay
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium text-[10px]">
                          Còn thiếu {missingCriteria.length} tiêu chí
                        </span>
                      )}
                    </div>

                    {item.deadline && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Hạn nộp: {item.deadline.slice(0, 10)}</span>
                      </p>
                    )}

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Xuất ZIP */}
                        <button
                          type="button"
                          onClick={() => handleExportZip(item.regulationId, item.name)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Xuất ZIP</span>
                        </button>

                        {/* Chuyển thành KPI nếu còn thiếu */}
                        {missingCriteria.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openGapToKpiModal(item, missingCriteria)}
                            className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 text-xs font-semibold flex items-center gap-1.5 border border-purple-200 dark:border-purple-800 transition"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Chuyển thành KPI</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRegulationId(String(item.regulationId));
                          setActiveTab('regulation');
                        }}
                        className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline flex items-center gap-1"
                      >
                        <span>Khám chi tiết</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: LỊCH SỬ PHIÊN AI ================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Các phiên thẩm định AI đã thực hiện
            </h3>

            {loadingHistory ? (
              <p className="text-xs text-slate-500 animate-pulse">Đang tải lịch sử phiên...</p>
            ) : historyRuns.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">Chưa có phiên đánh giá nào được lưu.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {historyRuns.map(run => (
                  <div key={run.runId} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-white block">
                        Phiên #{run.runId} · {run.targetSubject?.subjectType || 'LECTURER'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {run.completedAt || run.createdAt} · {run.criterionResults?.length || 0} tiêu chí
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[10px]">
                      {runStatuses[run.status] || run.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 4: HỒ SƠ MẪU (FIXTURES) ================= */}
      {activeTab === 'fixtures' && fixtureItem && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hồ sơ mô phỏng kiểm thử</h3>
          <p className="text-xs text-slate-500">{fixtureItem.description}</p>
          <pre className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs overflow-auto font-mono text-slate-700 dark:text-slate-300 max-h-96">
            {JSON.stringify(fixtureItem, null, 2)}
          </pre>
        </div>
      )}

      {/* ================= GAP-TO-KPI ROADMAP TRANSFER MODAL ================= */}
      {gapModalOpen && gapRegulation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-soft-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>Chuyển thành mục tiêu KPI</span>
              </h3>
              <button
                onClick={() => setGapModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {gapSuccessNotice ? (
              <div className="space-y-4 py-3">
                <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Thiết lập lộ trình thành công!</span>
                  </div>
                  <p>{gapSuccessNotice.message}</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Link
                    to="/kpi"
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition"
                  >
                    Xem Mục tiêu KPI →
                  </Link>
                  <Link
                    to="/calendar"
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs transition"
                  >
                    Xem Lịch cá nhân →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Quy chế mục tiêu:</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-white">
                    {gapRegulation.name || gapRegulation.title}
                  </span>
                </div>

                {/* Missing Criteria List */}
                <div className="space-y-2">
                  {gapMissingCriteria.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs text-center">
                      <p className="font-semibold">Tất cả tiêu chí đã hoàn thành!</p>
                      <p className="text-[11px] mt-0.5 text-emerald-600 dark:text-emerald-400">Không có tiêu chí thiếu để chuyển thành KPI.</p>
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Danh sách {gapMissingCriteria.length} tiêu chí còn thiếu sẽ chuyển thành KPI:
                      </span>
                      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                        {gapMissingCriteria.map((c, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 flex items-center justify-between gap-2"
                          >
                            <span className="font-medium text-slate-800 dark:text-white truncate">
                              {c.criterionCode || c.code ? `[${c.criterionCode || c.code}] ` : ''}{c.criterionName || c.name}
                            </span>
                            <span className="text-purple-700 dark:text-purple-300 font-bold text-[11px] shrink-0">
                              + {c.missingCount || 1} {c.thresholdMetric?.unit || c.unit || 'tiêu chí'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Reminder Checkbox Prompt */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gapAddReminder}
                      onChange={(e) => setGapAddReminder(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="font-bold text-slate-800 dark:text-white">
                      Bạn có muốn thêm vào lịch nhắc nhở không?
                    </span>
                  </label>

                  {gapAddReminder && (
                    <div className="pl-6 space-y-1">
                      <label className="block text-[11px] text-slate-500">
                        Hạn chót hoàn thành hồ sơ (Deadline):
                      </label>
                      <input
                        type="date"
                        value={gapDeadlineDate}
                        onChange={(e) => setGapDeadlineDate(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs w-full"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={gapTransferring}
                    onClick={() => setGapModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={gapTransferring || !gapMissingCriteria || gapMissingCriteria.length === 0}
                    onClick={handleConfirmGapTransfer}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-soft-sm"
                  >
                    {gapTransferring ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang thiết lập...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Xác nhận chuyển thành KPI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
