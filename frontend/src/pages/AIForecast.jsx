import React, { useState } from 'react';
import fixtures from '../../../docs/ai/eval-dev/EvaluationRun.fixtures.json';
const conclusions = {
  SIMULATION_ONLY: 'Chỉ mô phỏng',
  NEEDS_HUMAN_REVIEW: 'Cần người có thẩm quyền rà soát',
};
export default function AIForecast() {
  const [selected, setSelected] = useState(fixtures.fixtures[0].caseId);
  const item = fixtures.fixtures.find((f) => f.caseId === selected),
    run = item.run;
  return (
    <section className="space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Review AI — bộ phát triển PTUD</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          12 hồ sơ tổng hợp để thử trạng thái, phiên bản và cảnh báo dữ liệu. Trang này hiển thị
          fixture, không gọi mô hình AI.
        </p>
      </header>
      <p
        role="status"
        className="rounded-2xl bg-amber-100 dark:bg-amber-950/50 p-4 text-amber-900 dark:text-amber-200"
      >
        MÔ PHỎNG — Nhãn chưa được chuyên môn xác nhận. Không phải tiêu chí hoặc chính sách LHU;
        không kết luận đủ điều kiện và không tự trao thưởng. KPI mô phỏng luôn giữ nhãn nguồn.
      </p>
      <label className="block font-semibold">
        Chọn hồ sơ mẫu
        <select
          className="block w-full mt-2 rounded-xl border p-3 bg-white dark:bg-slate-900"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {fixtures.fixtures.map((f) => (
            <option key={f.caseId} value={f.caseId}>
              {f.caseId} — {f.title}
            </option>
          ))}
        </select>
      </label>
      <article className="soft-card p-6 space-y-4">
        <h2 className="text-xl font-bold">{item.title}</h2>
        <dl className="grid sm:grid-cols-2 gap-3">
          <div>
            <dt>Trạng thái run</dt>
            <dd className="font-semibold">{run.overallStatus}</dd>
          </div>
          <div>
            <dt>Kết luận</dt>
            <dd className="font-semibold">{conclusions[run.overallConclusion]}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>mock — fixture kỹ thuật, không phải output LLM</dd>
          </div>
          <div>
            <dt>Chủ thể tổng hợp</dt>
            <dd>
              {run.targetSubject.subjectType} #{run.targetSubject.subjectId}
            </dd>
          </div>
        </dl>
        <p>
          Vấn đề dữ liệu:{' '}
          {item.observed.issues.length
            ? item.observed.issues.join(', ')
            : 'Đủ input theo đặc tả mô phỏng; chưa có kết luận chuyên môn'}
        </p>
        {run.criterionResults.map((result) => (
          <div
            key={result.criterionCode}
            className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2"
          >
            <h3 className="font-bold">{result.criterionCode}</h3>
            <p>{result.criterionName}</p>
            <p>
              Năm khác nhau có nguồn hợp lệ theo fixture: {result.thresholdMetric.actualRecorded}.
              Ngưỡng {result.thresholdMetric.targetMin} chỉ là đặc tả mô phỏng.
            </p>
            <p>
              Đánh giá tiêu chí: <strong>{result.thresholdMetric.isSatisfied}</strong> — cần người
              có thẩm quyền rà soát.
            </p>
            <p>{result.aiAnalysis}</p>
          </div>
        ))}
      </article>
      <article className="soft-card p-6 space-y-3">
        <h2 className="font-bold text-lg">Căn cứ kỹ thuật và phiên bản input</h2>
        <p>
          Không có căn cứ pháp lý đã xác nhận cho ngưỡng fixture này. Các tài liệu dưới đây là hợp
          đồng phần mềm hoặc đặc tả kiểm thử.
        </p>
        <ul className="space-y-2">
          {item.basis.map((b) => (
            <li key={b.sourceId}>
              <strong>{b.sourceId}</strong> — {b.path}
              <code className="block text-xs break-all">SHA-256: {b.sha256}</code>
            </li>
          ))}
        </ul>
        <details>
          <summary className="cursor-pointer">Input tổng hợp và bản thay thế</summary>
          <pre className="mt-3 overflow-auto text-xs whitespace-pre-wrap">
            {JSON.stringify(item.input, null, 2)}
          </pre>
        </details>
        <details>
          <summary className="cursor-pointer">EvaluationRun fixture theo hợp đồng W3-Q4</summary>
          <pre className="mt-3 overflow-auto text-xs whitespace-pre-wrap">
            {JSON.stringify(run, null, 2)}
          </pre>
        </details>
      </article>
    </section>
  );
}
