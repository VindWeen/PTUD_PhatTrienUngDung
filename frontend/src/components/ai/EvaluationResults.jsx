import React, { useEffect, useId, useRef, useState } from 'react';
import { Cpu, RefreshCw, X } from 'lucide-react';
import { humanizeExplanation, splitExplanation } from './explanationPresentation';

const stateLabels = {
  idle: 'AI chưa chạy', queued: 'AI chờ xử lý', running: 'AI đang giải thích…',
  success: 'AI đã trả lời', mock: 'Mô phỏng · không gọi AI thật',
  rejected: 'AI đã trả lời · trích dẫn chưa hợp lệ', error: 'AI gặp lỗi · có thể thử lại',
  noSource: 'Chưa gọi AI · thiếu nguồn căn cứ',
};
const good = 'text-emerald-800 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50';
const warning = 'text-amber-900 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/50';

function CitationPreview({ citation, index, prefix }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({});
  const trigger = useRef(null);
  const previewId = useId();
  const suppressFocus = useRef(false);
  const dismissPreview = () => { clearTimeout(timer.current); setOpen(false); suppressFocus.current = true; trigger.current?.focus(); suppressFocus.current = false; };
  const timer = useRef(null);
  const show = () => {
    clearTimeout(timer.current);
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) setPosition({ top: Math.min(rect.bottom + 8, window.innerHeight - 220), left: Math.max(12, Math.min(rect.left, window.innerWidth - 320)) });
    setOpen(true);
  };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => {
    if (!open) return;
    const dismiss = event => { if (event.key === 'Escape') { dismissPreview(); } };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const href = /^https?:\/\//i.test(citation.sourceUrl || '') ? citation.sourceUrl : null;
  return <span className="inline"><button ref={trigger} type="button" aria-expanded={open} aria-controls={previewId} aria-label={`Xem nguồn ${index + 1}: ${citation.documentCode || ''}`} onMouseEnter={show} onMouseLeave={hide} onFocus={() => { if (!suppressFocus.current) show(); }} onBlur={hide} onClick={show} className="inline rounded px-0.5 font-semibold text-teal-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 dark:text-teal-300">[{index + 1}]</button>{open && <span id={previewId} role="dialog" aria-label={`Nguồn trích dẫn ${index + 1}`} onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={hide} onFocus={() => clearTimeout(timer.current)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) hide(); }} style={position} className="fixed z-50 block w-[296px] rounded-xl border border-slate-200 bg-white p-4 text-left text-sm font-normal leading-6 text-slate-800 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><span className="flex items-start justify-between gap-2"><strong>{citation.documentCode || 'Tài liệu nguồn'}</strong><button type="button" aria-label="Đóng xem nhanh nguồn" onClick={dismissPreview} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></span><span className="block">{[citation.articleNo, citation.clauseNo, citation.pageNo != null ? `Trang ${citation.pageNo}` : null].filter(Boolean).join(' · ')}</span>{(citation.quote || citation.excerpt) && <span className="mt-2 block max-h-32 overflow-auto">{citation.quote || citation.excerpt}</span>}{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-medium text-teal-700 underline dark:text-teal-300">Mở tài liệu</a> : <span className="mt-2 block text-xs">Chưa có đường dẫn tài liệu gốc.</span>}</span>}</span>;
}

function inline(text, citations, prefix, depth = 0) {
  if (depth > 5) return text;
  return text.split(/(\[CHUNK_ID:\s*\d+\]|\[\d+\]|\*\*[^*]+\*\*|`[^`]+`)/gi).map((part, index) => {
    const match = part.match(/^\[CHUNK_ID:\s*(\d+)\]$/i);
    if (match) {
      const citation = citations.findIndex(item => Number(item.chunkId) === Number(match[1]));
      return citation >= 0 ? <CitationPreview key={index} citation={citations[citation]} index={citation} prefix={prefix} /> : '[nguồn chưa được đối chiếu]';
    }
    const numbered = part.match(/^\[(\d+)\]$/);
    if (numbered && citations[Number(numbered[1]) - 1]) return <CitationPreview key={index} citation={citations[Number(numbered[1]) - 1]} index={Number(numbered[1]) - 1} prefix={prefix} />;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{inline(part.slice(2, -2), citations, prefix, depth + 1)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="break-words">{part.slice(1, -1)}</code>;
    return part;
  });
}

// React escapes all text; raw HTML and model-provided links are never executed.
export function ExplanationText({ text = '', citations = [], prefix }) {
  return <div className="max-w-[75ch] space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-200 break-words">
    {humanizeExplanation(text).split(/\n\s*\n/).filter(Boolean).map((block, index) => {
      const lines = block.split('\n');
      if (lines.every(line => /^\s*[-*]\s/.test(line))) return <ul key={index} className="list-disc space-y-1 pl-5">{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*]\s/, ''), citations, prefix)}</li>)}</ul>;
      if (lines.every(line => /^\s*\d+\.\s/.test(line))) return <ol key={index} className="list-decimal space-y-1 pl-5">{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*\d+\.\s/, ''), citations, prefix)}</li>)}</ol>;
      if (block.startsWith('>')) return <blockquote key={index} className="border-l border-slate-300 pl-4 dark:border-slate-600">{inline(block.replace(/^>\s?/gm, ''), citations, prefix)}</blockquote>;
      return <p key={index} className="whitespace-pre-line">{inline(block.replace(/^#{1,6}\s/gm, ''), citations, prefix)}</p>;
    })}
  </div>;
}

function outcome(result) {
  if (result.humanReviewRequired || result.issues?.includes('CRITERION_SOURCE_UNMAPPED')) return 'Chưa thể kết luận';
  return result.thresholdMetric?.isSatisfied === true ? 'Đạt' : result.thresholdMetric?.isSatisfied === false ? 'Chưa đạt' : 'Chưa thể kết luận';
}

function reason(result) {
  if (result.issues?.includes('CRITERION_SOURCE_UNMAPPED')) return 'Chưa cấu hình nguồn dữ liệu để tính tiêu chí. Cần người quản lý chọn loại hồ sơ được tính trong Kho quy định, rồi kiểm tra lại.';
  if (result.issues?.includes('MISSING_DATA')) return 'Hồ sơ còn thiếu dữ liệu hoặc minh chứng. Bổ sung hồ sơ rồi kiểm tra lại.';
  if (result.humanReviewRequired) return 'Kết quả cần người có thẩm quyền rà soát trước khi kết luận.';
  if (result.thresholdMetric?.isSatisfied === false) return 'Dữ liệu ghi nhận chưa đáp ứng ngưỡng yêu cầu của tiêu chí.';
  return result.thresholdMetric?.isSatisfied === true ? 'Dữ liệu ghi nhận đáp ứng ngưỡng kiểm tra của tiêu chí.' : 'Chưa đủ thông tin để xác định kết quả. Xem dữ liệu và căn cứ để rà soát.';
}

function nextAction(result) {
  if (result.issues?.includes('CRITERION_SOURCE_UNMAPPED')) return 'Nhờ người quản lý cấu hình nguồn dữ liệu cho tiêu chí trong Kho quy định, sau đó chạy kiểm tra lại. Đây là phần cấu hình hệ thống, chưa thể suy ra người dùng thiếu minh chứng.';
  if (result.issues?.includes('MISSING_DATA')) return 'Bổ sung dữ liệu hoặc minh chứng còn thiếu trong hồ sơ rồi chạy kiểm tra lại.';
  if (result.humanReviewRequired) return 'Chuyển kết quả và căn cứ cho người có thẩm quyền rà soát.';
  return result.thresholdMetric?.isSatisfied === true ? 'Đối chiếu minh chứng và căn cứ trước khi sử dụng kết quả cho quy trình xét duyệt.' : 'Rà soát dữ liệu được tính và ngưỡng yêu cầu; cập nhật hồ sơ khi cần rồi kiểm tra lại.';
}

function StructuredExplanation({ text, citations, prefix }) {
  const parsed = splitExplanation(text);
  return <div className="space-y-4">
    {parsed.summary && <div data-ai-summary className="rounded-xl bg-sky-50 p-4 dark:bg-sky-950/40"><h5 className="mb-2 text-sm font-semibold text-sky-900 dark:text-sky-200">Tóm tắt do AI tạo</h5><ExplanationText text={parsed.summary} citations={citations} prefix={prefix} /></div>}
    {parsed.intro && <ExplanationText text={parsed.intro} citations={citations} prefix={prefix} />}
    {parsed.sections.map((section, index) => <details data-explanation-section key={`${prefix}-${index}`} open={section.number === 4 || section.number === 5} className="border-b border-slate-200 pb-3 dark:border-slate-700"><summary className="cursor-pointer py-2 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 dark:text-slate-100">{section.title}</summary><div className="pt-2"><ExplanationText text={section.text} citations={citations} prefix={prefix} /></div></details>)}
  </div>;
}

export default function EvaluationResults({ run, subjectName, explanations, aiStates, busy, onExplain, onRetry, staleInfo, checkingStale, onCheckStale }) {
  const results = run.criterionResults || [];
  const [selection, setSelection] = useState({ runId: run.runId, criterionId: results[0]?.criterionId });
  const selectedId = selection.runId === run.runId && results.some(item => String(item.criterionId) === String(selection.criterionId)) ? selection.criterionId : results[0]?.criterionId;
  const values = results.map(result => aiStates[result.criterionId]?.status);
  const complete = values.filter(status => ['success', 'mock'].includes(status)).length;
  const realComplete = values.filter(status => status === 'success').length;
  const mockComplete = values.filter(status => status === 'mock').length;
  const unresolved = results.filter(result => result.humanReviewRequired || typeof result.thresholdMetric?.isSatisfied !== 'boolean').length;
  const failed = values.filter(status => ['error', 'rejected', 'noSource'].includes(status)).length;
  const notCalled = values.filter(status => status === 'idle').length;
  return <article data-evaluation-results className="soft-card p-5 sm:p-6 space-y-6">
    <div data-evaluation-summary className="space-y-2">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Kết quả: {subjectName}</h2>
      <p className="font-semibold text-slate-800 dark:text-slate-100">{unresolved ? `Chưa thể kết luận · ${unresolved}/${results.length} tiêu chí cần rà soát` : 'Đã kiểm tra hồ sơ theo tiêu chí'}</p>
      <p className="max-w-[75ch] text-sm text-slate-600 dark:text-slate-300">{results.some(result => result.issues?.includes('CRITERION_SOURCE_UNMAPPED')) ? 'Có tiêu chí chưa cấu hình nguồn dữ liệu. Cần người quản lý hoàn thiện cấu hình rồi chạy lại; AI chỉ giải thích căn cứ hiện có.' : 'Mở từng tiêu chí để xem dữ liệu, lý do và căn cứ. Kết quả hỗ trợ người có thẩm quyền rà soát.'}</p>
      <div className="flex flex-wrap items-center gap-3 pt-2 text-sm text-slate-700 dark:text-slate-200">
        <Cpu className="h-4 w-4" />
        <span>AI thật: {realComplete}/{results.length} giải thích hoàn tất{mockComplete ? ` · ${mockComplete} mục mô phỏng` : ''}{failed ? ` · ${failed} mục cần thử lại hoặc bổ sung nguồn` : ''}{notCalled ? ` · ${notCalled} mục chưa gọi AI` : ''}{!values.some(Boolean) ? ' · Chưa tải giải thích trong lần xem này' : ''}</span>
        {!busy && complete < results.length && <button type="button" onClick={onRetry} className="soft-btn-secondary text-sm">{failed ? 'Thử lại phần AI' : 'Tạo giải thích AI'}</button>}
      </div>
      {run.isStale && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">Dữ liệu đã thay đổi. Chạy kiểm tra mới để cập nhật kết quả.</p>}
    </div>

    <div className="grid min-w-0 gap-6 border-t border-slate-200 pt-5 lg:grid-cols-[minmax(0,0.32fr)_minmax(0,0.68fr)] dark:border-slate-700">
      <nav aria-label="Chọn tiêu chí để xem kết quả" className="min-w-0 lg:border-r lg:border-slate-200 lg:pr-5 dark:lg:border-slate-700">
        <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Tiêu chí đã kiểm tra ({results.length})</p>
        <div className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-6 lg:max-h-[75vh] lg:flex-col lg:overflow-y-auto">
          {results.map(result => <button data-criterion-selector key={result.criterionId} type="button" aria-pressed={String(result.criterionId) === String(selectedId)} aria-controls="active-criterion-detail" onClick={() => setSelection({ runId: run.runId, criterionId: result.criterionId })} className={`min-w-[220px] flex-1 rounded-xl border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 lg:min-w-0 lg:flex-none ${String(result.criterionId) === String(selectedId) ? 'border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}><span className="block text-xs text-slate-500 dark:text-slate-400">{result.criterionCode}</span><span className="mt-1 block text-sm font-semibold text-slate-900 dark:text-white">{result.criterionName}</span><span className={`mt-3 inline-block rounded px-2 py-1 text-xs font-medium ${outcome(result) === 'Đạt' ? good : warning}`}>{outcome(result)}</span><span className="mt-2 block text-xs text-slate-600 dark:text-slate-300">{stateLabels[aiStates[result.criterionId]?.status] || 'Chưa tải giải thích AI'}</span></button>)}
        </div>
      </nav>
      <div className="min-w-0">
      {results.filter(result => String(result.criterionId) === String(selectedId)).map(result => {
        const state = aiStates[result.criterionId];
        const explanation = explanations[result.criterionId];
        const prefix = `run-${run.runId}-criterion-${result.criterionId}`;
        const metric = result.thresholdMetric || {};
        const snapshotCriterion = run.inputSnapshot?.criteria?.find(item => Number(item.criterionId) === Number(result.criterionId));
        const approval = snapshotCriterion?.isConfirmed;
        return <section id="active-criterion-detail" key={prefix} data-criterion-result data-criterion-detail aria-label={result.criterionName}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1"><span className="block text-xs text-slate-500 dark:text-slate-400">{result.criterionCode}</span><h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{result.criterionName}</h3></div>
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-md px-2 py-1 font-medium ${outcome(result) === 'Đạt' ? good : warning}`}>{outcome(result)}</span></div>
          </div>
          <div className="space-y-5 pt-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div><dt className="text-slate-500 dark:text-slate-400">Dữ liệu ghi nhận</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{metric.actualRecorded == null ? 'Chưa tính được' : `${metric.actualRecorded} ${metric.unitMetric || ''}`}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Ngưỡng yêu cầu</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{metric.targetMin ?? 'Chưa có'} {metric.unitMetric}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Tình trạng tiêu chí</dt><dd className="mt-1 text-slate-900 dark:text-white">{approval === true ? 'Tiêu chí đã duyệt' : approval === false ? 'Tiêu chí chưa duyệt' : 'Xem trạng thái duyệt trong Kho quy định'}{result.isSimulation && <span className="block text-amber-800 dark:text-amber-300">Dữ liệu mô phỏng</span>}{result.isConfirmedByLhu === true && <span className="block">Đã xác nhận áp dụng tại LHU</span>}</dd></div>
            </dl>
            <div data-evaluation-conclusion className={`space-y-3 rounded-xl p-4 text-sm ${outcome(result) === 'Đạt' ? good : warning}`}><h4 className="font-bold">{outcome(result)}</h4><p><strong>Vì sao: </strong>{reason(result)}</p><p><strong>Cần làm gì tiếp: </strong>{nextAction(result)}</p><p className="text-xs">Kết luận từ kiểm tra dữ liệu; giải thích AI bên dưới không thay đổi kết quả này.</p></div>
            <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Giải thích AI và căn cứ</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">{stateLabels[state?.status] || 'Giải thích của phiên cũ chưa được tải trong lần xem này.'}</p>
              {state?.message && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{humanizeExplanation(state.message)}</p>}
              {state?.status === 'rejected' && <p role="alert" className="text-sm text-amber-900 dark:text-amber-200">AI đã trả lời nhưng mã trích dẫn không hợp lệ. Nội dung chưa được hiển thị; thử lại hoặc yêu cầu người quản lý kiểm tra nguồn.</p>}
              {state?.status === 'noSource' && <p className="text-sm text-amber-900 dark:text-amber-200">Chưa tìm thấy nguồn đủ điều kiện để gửi cho AI. Cần bổ sung căn cứ trong Kho quy định.</p>}
              {state?.status === 'error' && explanation?.providerError && <p className="text-sm text-amber-900 dark:text-amber-200">Dịch vụ AI không khả dụng. Phản hồi dự phòng không được coi là giải thích AI thành công.</p>}
              {explanation && ['success','mock'].includes(state?.status) && <>
                <p className="max-w-[75ch] text-xs text-slate-500 dark:text-slate-400">{explanation.isMock ? 'Đây là câu trả lời mô phỏng.' : `Đã nhận phản hồi từ ${explanation.provider || 'dịch vụ AI'}. Mã trích dẫn đã được đối chiếu; nội dung diễn giải vẫn cần người đọc rà soát.`}</p>
                <StructuredExplanation text={explanation.explanationText} citations={explanation.citations} prefix={prefix} />
                <details className="text-sm"><summary className="cursor-pointer py-2 font-semibold text-slate-800 dark:text-slate-100">Tài liệu tham chiếu ({(explanation.citations || []).length})</summary><ol className="space-y-3 pt-3">{(explanation.citations || []).map((citation,index) => <li id={`${prefix}-citation-${index}`} key={index} className="scroll-mt-6 text-slate-700 dark:text-slate-200"><strong>[{index + 1}] {citation.documentCode}</strong> — {citation.articleNo} {citation.clauseNo}{citation.pageNo != null ? ` · Trang ${citation.pageNo}` : ''}{/^https?:\/\//i.test(citation.sourceUrl || '') ? <a href={citation.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-teal-700 underline dark:text-teal-300">Mở tài liệu nguồn</a> : <span className="block text-xs text-slate-500 dark:text-slate-400">Chưa có đường dẫn tài liệu gốc.</span>}</li>)}</ol></details>
              </>}
              {!['success','mock'].includes(state?.status) && <button type="button" disabled={busy} onClick={() => onExplain(result)} className="soft-btn-secondary text-sm disabled:opacity-50">{['error','rejected','noSource'].includes(state?.status) ? 'Thử lại giải thích AI' : 'Tạo giải thích AI'}</button>}
            </section>
            <details className="text-xs text-slate-600 dark:text-slate-300"><summary className="cursor-pointer">Thông tin kỹ thuật của tiêu chí</summary><p className="mt-3 max-w-[75ch]">{result.aiAnalysis}</p><p className="mt-2 break-words">{result.warningNotice}</p>{state?.message && <p className="mt-2 break-words">{state.message}</p>}<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify({ issues: result.issues, thresholdMetric: metric, humanReviewRequired: result.humanReviewRequired }, null, 2)}</pre>{explanation && <><p className="mt-2">Dịch vụ: {explanation.provider} · Mô hình: {explanation.model} · Hướng dẫn: {explanation.promptVersion}</p><details className="mt-3"><summary className="cursor-pointer">Phản hồi AI gốc</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">{explanation.explanationText}</pre></details></>}</details>
          </div>
        </section>;
      })}
      </div>
    </div>
    <details className="text-xs text-slate-600 dark:text-slate-300">
      <summary className="cursor-pointer font-medium">Thông tin phiên và kiểm tra dữ liệu thay đổi</summary>
      <div className="mt-3 space-y-3"><p>Mã phiên: {run.runId} · Ngày đánh giá: {run.inputSnapshot?.asOfDate || run.asOfDate || 'Xem dữ liệu lưu trữ'}</p><p>{staleInfo ? (staleInfo.isStale ? staleInfo.reason || 'Dữ liệu đã thay đổi' : 'Dữ liệu hiện tại đồng nhất với phiên đã lưu.') : 'Chưa kiểm tra dữ liệu thay đổi trong lần xem này.'}</p><button type="button" disabled={busy || checkingStale} onClick={onCheckStale} className="soft-btn-secondary text-sm"><RefreshCw className="h-4 w-4" />Kiểm tra dữ liệu hiện tại</button><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 dark:bg-slate-800">{JSON.stringify(run.inputSnapshot || run, null, 2)}</pre></div>
    </details>
  </article>;
}
