import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  History,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Search,
  BookOpen,
  ShieldCheck,
  ChevronRight,
  Database,
  Calendar,
  User,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { aiEvaluationApi } from '../services/aiEvaluationApi';
import { LoadingState, ErrorState, EmptyState } from '../components/common/AsyncState';
import fixtures from '../../../docs/ai/eval-dev/EvaluationRun.fixtures.json';

const conclusions = {
  SIMULATION_ONLY: 'Chỉ mô phỏng',
  NEEDS_HUMAN_REVIEW: 'Cần người có thẩm quyền rà soát',
  SATISFIED: 'Đủ điều kiện tiêu chuẩn',
  FAILED: 'Chưa đạt tiêu chuẩn',
};

export default function AIForecast() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'history' | 'fixtures'

  // Form State
  const [subjectType, setSubjectType] = useState('LECTURER');
  const [subjectId, setSubjectId] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [provider, setProvider] = useState('mock');
  const [availableCriteria, setAvailableCriteria] = useState([]);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState([]);

  // Live Evaluation State
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(null);
  const [currentRun, setCurrentRun] = useState(null);

  // Stale Check State
  const [checkingStale, setCheckingStale] = useState(false);
  const [staleInfo, setStaleInfo] = useState(null);

  // RAG Explanation State
  const [explainingCriterionId, setExplainingCriterionId] = useState(null);
  const [explanations, setExplanations] = useState({}); // { [criterionId]: explanationData }
  const [ragError, setRagError] = useState(null);

  // History State
  const [historyRuns, setHistoryRuns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyFilterType, setHistoryFilterType] = useState('');

  // Fixtures State (W3-Q4)
  const [selectedFixtureCase, setSelectedFixtureCase] = useState(fixtures.fixtures[0].caseId);

  // Set default subject ID from logged-in user profile
  useEffect(() => {
    if (user?.lecturerProfile?.LecturerId) {
      setSubjectId(String(user.lecturerProfile.LecturerId));
      setSubjectType('LECTURER');
    } else if (user?.lecturerProfile?.UnitId) {
      setSubjectId(String(user.lecturerProfile.UnitId));
      setSubjectType('UNIT');
    } else if (user?.userId) {
      setSubjectId(String(user.userId));
    }
  }, [user]);

  // Load criteria list from backend
  useEffect(() => {
    let isMounted = true;
    async function loadCriteria() {
      try {
        const res = await aiEvaluationApi.listCriteria({ limit: 50 });
        const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
        if (isMounted) {
          if (items.length > 0) {
            setAvailableCriteria(items);
            // Select first 2-3 criteria by default
            setSelectedCriteriaIds(items.slice(0, 3).map((c) => c.criteria_id || c.criterionId || c.id));
          } else {
            // Fallback default criteria
            const fallback = [
              { criteria_id: 1, code: 'CSTĐCS-01', name: 'Chiến sĩ thi đua cơ sở (Đạt danh hiệu liên tục)' },
              { criteria_id: 2, code: 'NCKH-01', name: 'Đề tài nghiên cứu khoa học cấp Trường/Tỉnh' },
            ];
            setAvailableCriteria(fallback);
            setSelectedCriteriaIds([1]);
          }
        }
      } catch {
        if (isMounted) {
          const fallback = [
            { criteria_id: 1, code: 'CSTĐCS-01', name: 'Chiến sĩ thi đua cơ sở (Đạt danh hiệu liên tục)' },
            { criteria_id: 2, code: 'NCKH-01', name: 'Đề tài nghiên cứu khoa học cấp Trường/Tỉnh' },
          ];
          setAvailableCriteria(fallback);
          setSelectedCriteriaIds([1]);
        }
      }
    }
    loadCriteria();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch History Runs
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const params = {};
      if (historyFilterType) params.subjectType = historyFilterType;
      const res = await aiEvaluationApi.listEvaluationRuns(params);
      const runs = res?.items || res?.data || (Array.isArray(res) ? res : []);
      setHistoryRuns(runs);
    } catch (err) {
      setHistoryError(err);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilterType]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Toggle criteria selection
  const handleToggleCriterion = (id) => {
    setSelectedCriteriaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Run Evaluation
  const handleRunEvaluation = async (e) => {
    e?.preventDefault();
    if (!subjectId) {
      setEvalError(new Error('Vui lòng nhập mã chủ thể thẩm định'));
      return;
    }
    setEvaluating(true);
    setEvalError(null);
    setStaleInfo(null);
    setExplanations({});
    try {
      const payload = {
        subjectType,
        subjectId: Number(subjectId),
        criteriaVersionIds: selectedCriteriaIds.map(Number),
        asOfDate,
        forcedProvider: provider,
      };
      const result = await aiEvaluationApi.evaluateStructured(payload);
      setCurrentRun(result);
    } catch (err) {
      setEvalError(err);
    } finally {
      setEvaluating(false);
    }
  };

  // Run Stale Check
  const handleCheckStale = async (runId) => {
    if (!runId) return;
    setCheckingStale(true);
    try {
      const res = await aiEvaluationApi.checkEvaluationStale(runId);
      setStaleInfo(res);
      if (currentRun && currentRun.runId === runId) {
        setCurrentRun((prev) => ({ ...prev, isStale: res.isStale }));
      }
    } catch (err) {
      alert(`Kiểm tra dữ liệu thất bại: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      setCheckingStale(false);
    }
  };

  // Trigger RAG explanation for a criterion
  const handleExplainCriterion = async (criterionResult) => {
    const criterionId = criterionResult.criterionId;
    setExplainingCriterionId(criterionId);
    setRagError(null);
    try {
      const payload = {
        criterionResult,
        asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
        provider,
        runId: currentRun?.runId,
      };
      const res = await aiEvaluationApi.explainEvaluation(payload);
      setExplanations((prev) => ({
        ...prev,
        [criterionId]: res,
      }));
    } catch (err) {
      setRagError({ criterionId, error: err });
    } finally {
      setExplainingCriterionId(null);
    }
  };

  // Select historical run to view
  const handleSelectHistoryRun = async (runId) => {
    try {
      setEvaluating(true);
      const fullRun = await aiEvaluationApi.getEvaluationRun(runId);
      setCurrentRun(fullRun);
      setActiveTab('live');
      // Automatically check stale status
      handleCheckStale(runId);
    } catch (err) {
      alert(`Không thể tải phiên đánh giá: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const fixtureItem = fixtures.fixtures.find((f) => f.caseId === selectedFixtureCase);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5 text-slate-900 dark:text-white">
            <Cpu className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Phân tích & Thẩm định Tiêu chí AI (W4-Q3)
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hệ thống thẩm định tiêu chí có cấu trúc, kiểm tra tính toàn vẹn hồ sơ, truy xuất trích dẫn RAG và quản lý lịch sử phiên đánh giá.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'live' ? 'soft-tab-active' : 'soft-tab-inactive'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Thẩm định Trực tiếp
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'history' ? 'soft-tab-active' : 'soft-tab-inactive'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Lịch sử Phiên AI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fixtures')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'fixtures' ? 'soft-tab-active' : 'soft-tab-inactive'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            12 Hồ sơ Thử nghiệm (W3-Q4)
          </button>
        </div>
      </header>

      {/* Mandatory Disclaimer Banner */}
      <div
        role="status"
        className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-soft-sm"
      >
        <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
            Cơ chế Hỗ trợ Thẩm định — Quyền quyết định thuộc Hội đồng LHU
          </p>
          <p>
            Mọi kết quả do AI Evaluator tính toán chỉ mang tính chất tham khảo, hỗ trợ Hội đồng Thi đua - Khen thưởng đối chiếu với quy chế hiện hành. Tuyệt đối không có cơ chế tự động công nhận hay trao danh hiệu khen thưởng. Hồ sơ bị thu hồi hoặc thiếu minh chứng sẽ được chuyển cho người có thẩm quyền rà soát theo quy định.
          </p>
        </div>
      </div>

      {/* ================= TAB 1: LIVE EVALUATION ================= */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          {/* Form Filter & Run Action */}
          <form onSubmit={handleRunEvaluation} className="soft-card p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-500" />
              Thiết lập Tham số Thẩm định Hồ sơ
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Subject Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Đối tượng Thẩm định
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSubjectType('LECTURER')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      subjectType === 'LECTURER'
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Cá nhân (Giảng viên)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubjectType('UNIT')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      subjectType === 'UNIT'
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Tập thể (Đơn vị)
                  </button>
                </div>
              </div>

              {/* Subject ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Mã Chủ thể ({subjectType === 'LECTURER' ? 'Lecturer ID' : 'Unit ID'})
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  placeholder="VD: 1, 2, 3..."
                  className="soft-input w-full text-xs"
                />
              </div>

              {/* As Of Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Ngày Hiệu lực Thẩm định
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="soft-input w-full text-xs"
                  />
                </div>
              </div>

              {/* AI Provider */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Mô hình / Provider Thẩm định
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="soft-input w-full text-xs"
                >
                  <option value="mock">Engine Xác định (Deterministic Safe)</option>
                  <option value="groq">Groq (Llama 3.3 70B Versatile)</option>
                  <option value="openrouter">OpenRouter (Free Tier)</option>
                </select>
              </div>
            </div>

            {/* Criteria Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Chọn Tiêu chí Thẩm định Quy chế ({selectedCriteriaIds.length}/{availableCriteria.length} đã chọn):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                {availableCriteria.map((c) => {
                  const id = c.criteria_id || c.criterionId || c.id;
                  const isChecked = selectedCriteriaIds.includes(id);
                  return (
                    <label
                      key={id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-indigo-500/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCriterion(id)}
                        className="rounded mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                          {c.code || c.criterionCode}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {c.name || c.criterionName}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={evaluating}
                className="soft-btn-primary text-xs px-6 py-2.5 font-semibold"
              >
                {evaluating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang Thẩm định Dữ liệu...
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    Thực hiện Thẩm định AI
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Error Banner */}
          {evalError && <ErrorState error={evalError} onRetry={handleRunEvaluation} />}

          {/* Evaluation Run Result Display */}
          {currentRun && (
            <article className="soft-card p-6 space-y-6">
              {/* Header result info */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                      RUN ID: {currentRun.runId}
                    </span>
                    {currentRun.isStale ? (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        DỮ LIỆU ĐÃ ĐỔI (STALE)
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        DỮ LIỆU ĐỒNG NHẤT
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold mt-1 text-slate-900 dark:text-white">
                    Kết quả Thẩm định Đối tượng {currentRun.targetSubject?.subjectType} #{currentRun.targetSubject?.subjectId}
                  </h3>
                </div>

                {/* Stale Check Action */}
                <button
                  type="button"
                  onClick={() => handleCheckStale(currentRun.runId)}
                  disabled={checkingStale}
                  className="soft-btn-secondary text-xs px-3 py-1.5 self-start md:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingStale ? 'animate-spin' : ''}`} />
                  Kiểm tra Dữ liệu Đổi (Stale Check)
                </button>
              </div>

              {/* Stale Alert Detail if changed */}
              {staleInfo && staleInfo.isStale && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{staleInfo.reason}</p>
                    <p className="text-[11px] mt-0.5 opacity-90">
                      Số bản ghi lúc đánh giá: {staleInfo.totalSavedRecords} | Số bản ghi hiện tại: {staleInfo.totalCurrentRecords}
                    </p>
                  </div>
                </div>
              )}

              {/* Overall Summary Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Trạng thái Phiên</span>
                  <strong className="text-slate-800 dark:text-slate-100">{currentRun.overallStatus}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Kết luận Tổng quan</span>
                  <strong className="text-slate-800 dark:text-slate-100">
                    {conclusions[currentRun.overallConclusion] || currentRun.overallConclusion}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Mã băm Input (SHA-256)</span>
                  <code className="text-[10px] text-slate-600 dark:text-slate-300 truncate block" title={currentRun.inputHash}>
                    {currentRun.inputHash ? currentRun.inputHash.slice(0, 16) + '...' : 'N/A'}
                  </code>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Tự động Trao thưởng</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">KHÔNG (Bị vô hiệu)</span>
                </div>
              </div>

              {/* Criterion Results List */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Chi tiết Kết quả Từng Tiêu chí ({currentRun.criterionResults?.length || 0}):
                </h4>

                {currentRun.criterionResults?.map((res) => {
                  const isExplaining = explainingCriterionId === res.criterionId;
                  const explanation = explanations[res.criterionId];
                  const hasExplainError = ragError && ragError.criterionId === res.criterionId;

                  return (
                    <div
                      key={res.criterionCode || res.criterionId}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900/40 shadow-soft-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mr-2">
                            {res.criterionCode}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {res.criterionName}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {res.thresholdMetric?.isSatisfied === true ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Đạt
                            </span>
                          ) : res.thresholdMetric?.isSatisfied === false ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Chưa đạt
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
                              <HelpCircle className="w-3.5 h-3.5" /> Chưa xác định
                            </span>
                          )}

                          {res.humanReviewRequired && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                              Cần rà soát
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Threshold metric stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl">
                        <div>
                          <span className="text-slate-400">Chỉ số thực tế ghi nhận:</span>{' '}
                          <strong className="text-slate-800 dark:text-slate-100">
                            {res.thresholdMetric?.actualRecorded ?? 'N/A'}{' '}
                            {res.thresholdMetric?.unitMetric || ''}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Yêu cầu tối thiểu:</span>{' '}
                          <strong className="text-slate-800 dark:text-slate-100">
                            {res.thresholdMetric?.targetMin ?? 'N/A'}{' '}
                            {res.thresholdMetric?.unitMetric || ''}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Xác nhận LHU:</span>{' '}
                          <span className={res.isConfirmedByLhu ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                            {res.isConfirmedByLhu ? 'Đã duyệt' : 'Mô phỏng/Chưa duyệt'}
                          </span>
                        </div>
                      </div>

                      {/* AI Deterministic Analysis Logic */}
                      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <strong className="text-slate-700 dark:text-slate-200 block mb-1">
                          Phân tích Logic Tiêu chuẩn:
                        </strong>
                        {res.aiAnalysis}
                      </div>

                      {/* Action: RAG Explanation with Citations */}
                      <div className="pt-1">
                        {!explanation ? (
                          <button
                            type="button"
                            onClick={() => handleExplainCriterion(res)}
                            disabled={isExplaining}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1.5 transition-colors"
                          >
                            {isExplaining ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Đang truy xuất trích dẫn RAG & giải thích pháp lý...
                              </>
                            ) : (
                              <>
                                <BookOpen className="w-3.5 h-3.5" />
                                Giải thích kết quả với Trích dẫn Điều/Khoản quy chế (RAG)
                              </>
                            )}
                          </button>
                        ) : (
                          /* RAG Explanation Display */
                          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                Giải thích có Trích dẫn Pháp lý (RAG Service)
                              </h5>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Model: {explanation.model} | Prompt v{explanation.promptVersion}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {explanation.explanationText}
                            </p>

                            {/* Citations List */}
                            {explanation.citations && explanation.citations.length > 0 && (
                              <div className="space-y-1.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/60">
                                <strong className="text-[11px] text-indigo-900 dark:text-indigo-300 block">
                                  Trích dẫn Căn cứ Quy chế ({explanation.citations.length}):
                                </strong>
                                <ul className="space-y-1">
                                  {explanation.citations.map((c, i) => (
                                    <li
                                      key={i}
                                      className="text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-start gap-2"
                                    >
                                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                        [CHUNK_ID: {c.chunkId}]
                                      </span>
                                      <div className="flex-1">
                                        <span>
                                          {c.documentCode} — {c.articleNo || ''} {c.clauseNo || ''} (Trang {c.pageNo ?? 'N/A'})
                                        </span>
                                        {c.chunkHash && (
                                          <code className="block text-[9px] text-slate-400 mt-0.5 truncate">
                                            SHA-256: {c.chunkHash}
                                          </code>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {hasExplainError && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                            Lỗi khi gọi RAG: {ragError.error?.message || 'Không thể tạo giải thích'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input Snapshot View (Reproducibility) */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <details className="text-xs group">
                  <summary className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    Xem Phiên bản Input Snapshot Lưu trữ (Tái hiện Nguyên trạng & Tamper-Evident)
                  </summary>
                  <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="text-[11px] text-slate-500">
                      Input Hash: <code className="text-slate-700 dark:text-slate-300">{currentRun.inputHash}</code>
                    </div>
                    <pre className="overflow-auto text-[11px] font-mono p-3 bg-white dark:bg-slate-950 rounded-lg max-h-64">
                      {JSON.stringify(currentRun.inputSnapshot || currentRun, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            </article>
          )}
        </div>
      )}

      {/* ================= TAB 2: HISTORY ================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="soft-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Lịch sử Các Phiên Thẩm định AI
                </h2>
                <p className="text-xs text-slate-500">
                  Danh sách các phiên đánh giá đã lưu trong cơ sở dữ liệu. Bấm vào phiên để tái hiện nguyên trạng snapshot.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={historyFilterType}
                  onChange={(e) => setHistoryFilterType(e.target.value)}
                  className="soft-input text-xs py-1.5"
                >
                  <option value="">Tất cả chủ thể</option>
                  <option value="LECTURER">Giảng viên (Cá nhân)</option>
                  <option value="UNIT">Đơn vị (Tập thể)</option>
                </select>
                <button
                  type="button"
                  onClick={loadHistory}
                  disabled={loadingHistory}
                  className="soft-btn-secondary text-xs px-3 py-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                  Tải lại
                </button>
              </div>
            </div>

            {/* History Table */}
            {loadingHistory ? (
              <LoadingState label="Đang tải lịch sử phiên đánh giá..." />
            ) : historyError ? (
              <ErrorState error={historyError} onRetry={loadHistory} />
            ) : historyRuns.length === 0 ? (
              <EmptyState message="Chưa có phiên đánh giá nào được lưu." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Mã Phiên (Run ID)</th>
                      <th className="p-3">Thời gian</th>
                      <th className="p-3">Chủ thể</th>
                      <th className="p-3">Kết luận</th>
                      <th className="p-3">Trạng thái Stale</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {historyRuns.map((r) => (
                      <tr key={r.runId || r.run_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {(r.runId || r.run_id).slice(0, 13)}...
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {r.evaluatedAt ? new Date(r.evaluatedAt).toLocaleString('vi-VN') : 'N/A'}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {r.targetSubject?.subjectType || r.subject_type} #{r.targetSubject?.subjectId || r.subject_id}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {conclusions[r.overallConclusion || r.overall_conclusion] || r.overallConclusion || r.overall_conclusion}
                          </span>
                        </td>
                        <td className="p-3">
                          {r.isStale || r.is_stale ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              STALE (ĐÃ ĐỔI)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              ĐỒNG NHẤT
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectHistoryRun(r.runId || r.run_id)}
                            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                          >
                            Xem lại hồ sơ
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: FIXTURES (W3-Q4) ================= */}
      {activeTab === 'fixtures' && (
        <div className="space-y-6">
          <div className="soft-card p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Bộ 12 Hồ sơ Thử nghiệm Kỹ thuật (W3-Q4 Fixtures)
            </h2>
            <p className="text-xs text-slate-500">
              12 ca thử nghiệm trạng thái, phiên bản và cảnh báo dữ liệu phục vụ đối chiếu và kiểm thử tự động.
            </p>

            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Chọn hồ sơ mẫu fixture:
              <select
                className="soft-input w-full mt-1.5 text-xs"
                value={selectedFixtureCase}
                onChange={(e) => setSelectedFixtureCase(e.target.value)}
              >
                {fixtures.fixtures.map((f) => (
                  <option key={f.caseId} value={f.caseId}>
                    {f.caseId} — {f.title}
                  </option>
                ))}
              </select>
            </label>

            {fixtureItem && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{fixtureItem.title}</h3>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Trạng thái:</span>{' '}
                      <strong>{fixtureItem.run.overallStatus}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Kết luận:</span>{' '}
                      <strong>{conclusions[fixtureItem.run.overallConclusion] || fixtureItem.run.overallConclusion}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Chủ thể:</span>{' '}
                      <strong>
                        {fixtureItem.run.targetSubject.subjectType} #{fixtureItem.run.targetSubject.subjectId}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Vấn đề dữ liệu:</span>{' '}
                      <span>{fixtureItem.observed.issues.join(', ') || 'Đủ input mô phỏng'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Kết quả Tiêu chí Fixture:
                  </h4>
                  {fixtureItem.run.criterionResults.map((result) => (
                    <div
                      key={result.criterionCode}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 bg-white dark:bg-slate-900/40 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 dark:text-slate-100">
                          {result.criterionCode} — {result.criterionName}
                        </strong>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                          {result.thresholdMetric.isSatisfied}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">{result.aiAnalysis}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <details className="text-xs">
                    <summary className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      Xem Căn cứ Kỹ thuật & JSON Fixture
                    </summary>
                    <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl overflow-auto text-[11px] max-h-64 font-mono">
                      {JSON.stringify(fixtureItem, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
