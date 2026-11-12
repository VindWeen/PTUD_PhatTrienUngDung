import Select from '../components/common/Select';
import { useSelectionOptions } from '../hooks/useSelections';
import { EntitySelect, lecturerLabel } from '../components/common/EntityPicker';
import UnderlineTabs from '../components/common/UnderlineTabs';
import PageHeader from '../components/common/PageHeader';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import EvaluationResults from '../components/ai/EvaluationResults';
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
} from 'lucide-react';
import { aiEvaluationApi } from '../services/aiEvaluationApi';
import { LoadingState, ErrorState, EmptyState } from '../components/common/AsyncState';
import fixtures from '../../../docs/ai/eval-dev/EvaluationRun.fixtures.json';

const conclusions = {
  SIMULATION_ONLY: 'Chỉ mô phỏng',
  NEEDS_HUMAN_REVIEW: 'Cần người có thẩm quyền rà soát',
  SATISFIED: 'Đủ điều kiện tiêu chuẩn',
  FAILED: 'Chưa đạt tiêu chuẩn',
};
const runStatuses = { COMPLETED: 'Đã hoàn tất', FLAGGED_UNCONFIRMED: 'Cần rà soát thêm', FAILED: 'Đánh giá không thành công' };

export default function AIForecast() {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'history' | 'fixtures'

  // Form State
  const [subjectType, setSubjectType] = useState('LECTURER');
  const [subjectId, setSubjectId] = useState('');
  const choices = useSelectionOptions('AI');
  const subjectName = (type, id) => {
    const list = type === 'LECTURER' ? choices.lecturers : choices.subjectUnits;
    const item = list.find(option => String(option.id) === String(id));
    return item?.name || `${type === 'LECTURER' ? 'Giảng viên' : 'Đơn vị'} (mã ${id ?? 'chưa rõ'})`;
  };
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [provider, setProvider] = useState('auto');
  const [configurationCollapsed, setConfigurationCollapsed] = useState(false);
  const configurationSummary = useRef(null);
  useEffect(() => { if (configurationCollapsed) configurationSummary.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [configurationCollapsed]);
  const [availableCriteria, setAvailableCriteria] = useState([]);
  const [criteriaError, setCriteriaError] = useState(null);
  const [loadingCriteria, setLoadingCriteria] = useState(true);
  const [criteriaRevision, setCriteriaRevision] = useState(0);
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState([]);

  // Live Evaluation State
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(null);
  const [currentRun, setCurrentRun] = useState(null);

  // Stale Check State
  const [checkingStale, setCheckingStale] = useState(false);
  const [staleInfo, setStaleInfo] = useState(null);

  // RAG Explanation State
  const [explanations, setExplanations] = useState({}); // { [criterionId]: explanationData }
  const [aiStates, setAiStates] = useState({});
  const [progress, setProgress] = useState(null);
  const operation = useRef(false);
  const runContext = useRef(null);
  const mounted = useRef(true);
  const currentRunId = useRef(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // History State
  const [historyRuns, setHistoryRuns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyFilterType, setHistoryFilterType] = useState('');

  // Fixtures State (W3-Q4)
  const [selectedFixtureCase, setSelectedFixtureCase] = useState(fixtures.fixtures[0].caseId);

  // Choose from authorized subjects; user IDs and lecturer IDs are different identities.
  useEffect(() => {
    if(choices.loading)return;
    const subjects=subjectType==='LECTURER' ? choices.lecturers : choices.subjectUnits;
    setSubjectId(current=>subjects.some(s=>String(s.id)===String(current)) ? current : String(subjects[0]?.id || ''));
  }, [choices.loading,choices.lecturers,choices.subjectUnits,subjectType]);

  // Load criteria list from backend
  useEffect(() => {
    let isMounted = true;
    setLoadingCriteria(true);
    setCriteriaError(null);
    async function loadCriteria() {
      try {
        const res = await aiEvaluationApi.listCriteria({ confirmedOnly: true }, criteriaRevision > 0);
        const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
        if (isMounted) {
          setAvailableCriteria(items);
          setSelectedCriteriaIds(items.slice(0, 3).map(c => c.criteria_version_id));
        }
      } catch (err) {
        if (isMounted) setCriteriaError(err);
      } finally {
        if (isMounted) setLoadingCriteria(false);
      }
    }
    loadCriteria();
    return () => {
      isMounted = false;
    };
  }, [criteriaRevision]);

  // Fetch History Runs
  const loadHistory = useCallback(async (fresh = true) => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const params = {};
      if (historyFilterType) params.subjectType = historyFilterType;
      const res = await aiEvaluationApi.listEvaluationRuns(params, fresh);
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
      loadHistory(false);
    }
  }, [activeTab, loadHistory]);

  // Toggle criteria selection
  const handleToggleCriterion = (id) => {
    setSelectedCriteriaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Run Evaluation
  const explainBatch = async (run, results, context) => {
    for (let index = 0; index < results.length; index++) {
      if (!mounted.current) return;
      const result = results[index];
      setProgress({ stage: 'ai', done: index, total: results.length });
      setAiStates(previous => ({ ...previous, [result.criterionId]: { status: 'running' } }));
      try {
        const response = await aiEvaluationApi.explainEvaluation({ criterionResult: result, runId: run.runId, asOfDate: context.asOfDate, provider: context.provider });
        if (!mounted.current) return;
        setExplanations(previous => ({ ...previous, [result.criterionId]: response }));
        const status = response.providerError ? 'error' : response.provider === 'none' || response.model === 'none' ? 'noSource' : response.isMock ? 'mock' : !response.isSufficientData ? 'rejected' : 'success';
        setAiStates(previous => ({ ...previous, [result.criterionId]: { status, provider: response.provider } }));
      } catch (error) {
        if (!mounted.current) return;
        setAiStates(previous => ({ ...previous, [result.criterionId]: { status: 'error', message: error.message || 'Dịch vụ AI chưa phản hồi.' } }));
      }
    }
  };

  const handleRunEvaluation = async (e, withAI = true) => {
    e?.preventDefault();
    if (operation.current || loadingCriteria || criteriaError || !selectedCriteriaIds.length) return;
    if (!subjectId) {
      setEvalError(new Error('Vui lòng chọn chủ thể thẩm định'));
      return;
    }
    operation.current = true;
    const context = { asOfDate, provider, subjectType, subjectId, criteriaCount: selectedCriteriaIds.length };
    setConfigurationCollapsed(true);
    runContext.current = context;
    setEvaluating(true);
    setEvalError(null);
    setStaleInfo(null);
    setExplanations({});
    setCurrentRun(null);
    currentRunId.current = null;
    setAiStates({});
    setProgress({ stage: 'data' });
    try {
      const payload = {
        subjectType,
        subjectId: Number(subjectId),
        criteriaVersionIds: selectedCriteriaIds.map(Number),
        asOfDate: context.asOfDate,
        forcedProvider: context.provider,
      };
      const result = await aiEvaluationApi.evaluateStructured(payload);
      if (!mounted.current) return;
      setCurrentRun(result);
      currentRunId.current = result.runId;
      const results = result.criterionResults || [];
      setAiStates(Object.fromEntries(results.map(item => [item.criterionId, { status: withAI ? 'queued' : 'idle' }])));
      if (withAI) await explainBatch(result, results, context);
      if (mounted.current) setProgress({ stage: withAI ? 'complete' : 'dataOnly' });
    } catch (err) {
      if (mounted.current) { setEvalError(err); setProgress(null); setConfigurationCollapsed(false); }
    } finally {
      operation.current = false;
      if (mounted.current) setEvaluating(false);
    }
  };

  // Run Stale Check
  const handleCheckStale = async (runId) => {
    if (!runId || checkingStale) return;
    setCheckingStale(true);
    try {
      const res = await aiEvaluationApi.checkEvaluationStale(runId);
      if (!mounted.current || currentRunId.current !== runId) return;
      setStaleInfo(res);
      setCurrentRun(prev => prev?.runId === runId ? { ...prev, isStale: res.isStale } : prev);
    } catch (err) {
      alert(`Kiểm tra dữ liệu thất bại: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      setCheckingStale(false);
    }
  };

  const handleExplainCriterion = async (onlyResult) => {
    if (operation.current || !currentRun) return;
    const pending = (onlyResult ? [onlyResult] : currentRun.criterionResults || []).filter(result => !['success', 'mock'].includes(aiStates[result.criterionId]?.status));
    if (!pending.length) return;
    operation.current = true; setEvaluating(true);
    const context = runContext.current || { asOfDate: currentRun.inputSnapshot?.asOfDate || currentRun.asOfDate, provider };
    try { await explainBatch(currentRun, pending, context); }
    finally { operation.current = false; if (mounted.current) { setEvaluating(false); setProgress({ stage: 'complete' }); } }
  };

  // Select historical run to view
  const handleSelectHistoryRun = async (runId) => {
    if (operation.current) return;
    operation.current = true;
    try {
      setEvaluating(true);
      const fullRun = await aiEvaluationApi.getEvaluationRun(runId);
      if (!mounted.current) return;
      setExplanations({});
      setStaleInfo(null);
      setCurrentRun(fullRun);
      currentRunId.current = fullRun.runId;
      setAiStates({}); setProgress(null); setConfigurationCollapsed(true);
      runContext.current = { asOfDate: fullRun.inputSnapshot?.asOfDate || fullRun.asOfDate, provider, subjectType: fullRun.targetSubject?.subjectType, subjectId: fullRun.targetSubject?.subjectId, criteriaCount: fullRun.criterionResults?.length || 0 };
      setActiveTab('live');
      // Automatically check stale status
      await handleCheckStale(runId);
    } catch (err) {
      alert(`Không thể tải phiên đánh giá: ${err.message}`);
    } finally {
      operation.current = false;
      if (mounted.current) setEvaluating(false);
    }
  };

  const fixtureItem = fixtures.fixtures.find((f) => f.caseId === selectedFixtureCase);

  return (
    <div className="space-y-6">
      <PageHeader title="Phân tích & Thẩm định AI" description="Thẩm định tiêu chí, kiểm tra hồ sơ và truy xuất trích dẫn từ quy định." icon={Cpu} onRefresh={evaluating || activeTab === 'fixtures' ? undefined : () => activeTab === 'history' ? loadHistory() : setCriteriaRevision(v => v + 1)} refreshing={activeTab === 'history' ? loadingHistory : loadingCriteria} tabs={<UnderlineTabs label="Nội dung phân tích AI" value={activeTab} disabled={evaluating} onChange={setActiveTab} items={[
        {id: 'live', label: 'Thẩm định Trực tiếp', icon: Cpu},
        {id: 'history', label: 'Lịch sử Phiên AI', icon: History},
        {id: 'fixtures', label: 'Hồ sơ mẫu', icon: FileCheck2},
      ]} />} />

      <p className="text-sm text-slate-600 dark:text-slate-300">Chọn hồ sơ → kiểm tra dữ liệu → AI giải thích kết quả và căn cứ. Kết quả hỗ trợ rà soát, không tự công nhận hoặc trao thưởng.</p>

      {/* ================= TAB 1: LIVE EVALUATION ================= */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          {/* Form Filter & Run Action */}
          {configurationCollapsed && <div ref={configurationSummary} data-configuration-summary className="soft-card scroll-mt-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"><p className="min-w-0 break-words text-slate-700 dark:text-slate-200"><strong>{evaluating ? 'Đang phân tích' : 'Đang xem kết quả'}: {subjectName(runContext.current?.subjectType, runContext.current?.subjectId)}</strong><span className="mx-2 text-slate-400">·</span>{runContext.current?.criteriaCount ?? currentRun?.criterionResults?.length ?? 0} tiêu chí đã chọn</p><button type="button" disabled={evaluating} onClick={() => setConfigurationCollapsed(false)} className="soft-btn-secondary shrink-0 text-sm disabled:opacity-50">Thay đổi</button></div>}
          {!configurationCollapsed && <form onSubmit={handleRunEvaluation} className="soft-card p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-500" />
              Chọn hồ sơ và tiêu chí đánh giá
            </h2>

            <fieldset disabled={evaluating} className="grid min-w-0 grid-cols-1 md:grid-cols-3 gap-4">
              {/* Subject Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Đối tượng Thẩm định
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {setSubjectType('LECTURER');setSubjectId('');}}
                    className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all ${
                      subjectType === 'LECTURER'
                        ? 'bg-[#008080] text-white border-[#008080]'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Cá nhân
                  </button>
                  <button
                    type="button"
                    onClick={() => {setSubjectType('UNIT');setSubjectId('');}}
                    className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all ${
                      subjectType === 'UNIT'
                        ? 'bg-[#008080] text-white border-[#008080]'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Tập thể
                  </button>
                </div>
              </div>

              {/* Subject ID */}
              <div>
                <EntitySelect label={subjectType==='LECTURER' ? 'Giảng viên được thẩm định' : 'Đơn vị được thẩm định'} options={subjectType==='LECTURER' ? choices.lecturers : choices.subjectUnits} value={subjectId} onChange={setSubjectId} required disabled={choices.loading || evaluating} placeholder="Chọn chủ thể" getLabel={subjectType==='LECTURER' ? lecturerLabel : o=>o.name}/>
                {choices.error && <p role="alert" className="text-xs text-rose-600">{choices.error}</p>}
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
              <details className="md:col-span-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <summary className="cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300">Tùy chọn kỹ thuật · nguồn giải thích AI</summary>
                <label htmlFor="ai-explanation-provider" className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Dịch vụ tạo giải thích
                </label>
                <Select
                  id="ai-explanation-provider"
                  disabled={evaluating}
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="soft-input w-full text-xs"
                >
                  <option value="auto">Tự động chọn dịch vụ</option>
                  <option value="mock">Mô phỏng bằng câu trả lời mẫu</option>
                  <option value="groq">Groq</option>
                  <option value="openrouter">OpenRouter (Free Tier)</option>
                </Select>
                <p className="mt-2 text-xs text-slate-500">Mặc định ưu tiên Groq, sau đó OpenRouter. Các dịch vụ cần được cấu hình trên máy chủ; mô phỏng không gọi dịch vụ AI.</p>
              </details>
            </fieldset>

            {loadingCriteria && <LoadingState label="Đang tải tiêu chí..." layout="cards" rows={3} />}
            {criteriaError && <ErrorState error={criteriaError} onRetry={() => setCriteriaRevision((value) => value + 1)} />}
            {!loadingCriteria && !criteriaError && !availableCriteria.length && <p role="status">Chưa có tiêu chí đủ điều kiện. Cần duyệt cả tiêu chí và phiên bản văn bản nguồn trong Kho quy định.</p>}
            {/* Criteria Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Chọn tiêu chí đánh giá ({selectedCriteriaIds.length}/{availableCriteria.length} đã chọn):
              </label>
              {availableCriteria.some(c => !c.source_rules) && <p role="note" data-source-warning className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{availableCriteria.filter(c => !c.source_rules).length === availableCriteria.length ? 'Các tiêu chí hiện có đều' : availableCriteria.filter(c => !c.source_rules).length + ' tiêu chí'} chưa cấu hình nguồn dữ liệu. Người quản lý cần chọn loại hồ sơ được tính trước khi hệ thống có thể kết luận.</p>}
              {availableCriteria.some(c => c.lhu_application_status === 'SIMULATION_ONLY' || /^SIM-|^SCN-/i.test(c.criterion_code || '')) && <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">Danh sách có tiêu chí mô phỏng; kết quả của các mục này chỉ dùng tham khảo.</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-1">
                {availableCriteria.map((c) => {
                  const id = c.criteria_version_id;
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
                        disabled={evaluating}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCriterion(id)}
                        className="rounded mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                          {c.criterion_code}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {c.name || c.criterionName}
                        </span>
                        <span title={`Văn bản: ${c.document_title || c.document_code || 'Chưa rõ'} · Phiên bản: ${c.version_number || 'Chưa rõ'}`} className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{c.document_code || 'Chưa rõ văn bản nguồn'}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => handleRunEvaluation(null, false)} disabled={evaluating || loadingCriteria || !!criteriaError || !selectedCriteriaIds.length || !subjectId} className="soft-btn-secondary text-sm">Chỉ kiểm tra dữ liệu</button>
              <button
                type="submit"
                disabled={evaluating || loadingCriteria || !!criteriaError || !selectedCriteriaIds.length || !subjectId}
                className="soft-btn-primary text-xs px-6 py-2.5 font-semibold"
              >
                {evaluating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {progress?.stage === 'ai' ? 'Đang phân tích bằng AI…' : 'Đang kiểm tra dữ liệu…'}
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    Kiểm tra & phân tích bằng AI
                  </>
                )}
              </button>
            </div>
          </form>}

          {/* Error Banner */}
          {evalError && <ErrorState error={evalError} onRetry={handleRunEvaluation} />}
          {progress && <div role="status" aria-live="polite" data-ai-progress className="soft-card px-6 py-4 text-sm text-slate-700 dark:text-slate-200 flex items-center gap-3">
            {evaluating ? <RefreshCw className="h-4 w-4 motion-safe:animate-spin shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />}
            {progress.stage === 'data' ? 'Đang kiểm tra hồ sơ theo tiêu chí…' : progress.stage === 'ai' ? `Đã kiểm tra dữ liệu · AI đang giải thích ${progress.done + 1}/${progress.total} tiêu chí…` : progress.stage === 'dataOnly' ? 'Đã kiểm tra dữ liệu · Chưa gọi AI. Chọn “Tạo giải thích AI” trong kết quả để tiếp tục.' : 'Đã xử lý yêu cầu. Xem trạng thái AI của từng tiêu chí bên dưới.'}
          </div>}
          {currentRun && <EvaluationResults run={currentRun} subjectName={subjectName(currentRun.targetSubject?.subjectType, currentRun.targetSubject?.subjectId)} explanations={explanations} aiStates={aiStates} busy={evaluating} onExplain={handleExplainCriterion} onRetry={() => handleExplainCriterion()} staleInfo={staleInfo} checkingStale={checkingStale} onCheckStale={() => handleCheckStale(currentRun.runId)} />}
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
                  Chọn một phiên để xem lại kết quả và dữ liệu tại thời điểm đánh giá.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <Select
                  value={historyFilterType}
                  onChange={(e) => setHistoryFilterType(e.target.value)}
                  className="soft-input text-xs py-1.5"
                >
                  <option value="">Tất cả chủ thể</option>
                  <option value="LECTURER">Giảng viên (Cá nhân)</option>
                  <option value="UNIT">Đơn vị (Tập thể)</option>
                </Select>

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
                      <th className="p-3">Mã phiên</th>
                      <th className="p-3">Thời gian</th>
                      <th className="p-3">Chủ thể</th>
                      <th className="p-3">Kết luận</th>
                      <th className="p-3">Thay đổi dữ liệu</th>
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
                            {subjectName(r.targetSubject?.subjectType || r.subject_type, r.targetSubject?.subjectId || r.subject_id)}
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
                              ĐÃ THAY ĐỔI
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
              Hồ sơ mẫu để tham khảo
            </h2>
            <p className="text-xs text-slate-500">
              12 tình huống minh họa kết quả và cảnh báo. Đây là dữ liệu mô phỏng, không phải hồ sơ thực tế.
            </p>

            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Chọn tình huống mẫu:
              <Select
                className="soft-input w-full mt-1.5 text-xs"
                value={selectedFixtureCase}
                onChange={(e) => setSelectedFixtureCase(e.target.value)}
              >
                {fixtures.fixtures.map((f) => (
                  <option key={f.caseId} value={f.caseId}>
                    {f.caseId} — {f.title}
                  </option>
                ))}
              </Select>
            </label>

            {fixtureItem && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{fixtureItem.title}</h3>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Trạng thái:</span>{' '}
                      <strong>{runStatuses[fixtureItem.run.overallStatus] || fixtureItem.run.overallStatus}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Kết luận:</span>{' '}
                      <strong>{conclusions[fixtureItem.run.overallConclusion] || fixtureItem.run.overallConclusion}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Chủ thể:</span>{' '}
                      <strong>
                        {fixtureItem.run.targetSubject.subjectType === 'LECTURER' ? 'Giảng viên mẫu' : 'Đơn vị mẫu'} #{fixtureItem.run.targetSubject.subjectId}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Vấn đề dữ liệu:</span>{' '}
                      <span>{fixtureItem.observed.issues.join(', ') || 'Đủ dữ liệu mô phỏng'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Kết quả đối chiếu tiêu chí:
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
