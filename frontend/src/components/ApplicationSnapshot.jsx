import React from 'react';
import { FileText } from 'lucide-react';

const labels = { OPEN: 'Đang mở', CLOSED: 'Đã đóng', DRAFT: 'Bản nháp', VERIFIED: 'Đã xác nhận', RECORDED: 'Đã ghi nhận', SUBMITTED: 'Đã nộp', NEED_CORRECTION: 'Cần bổ sung', REVOKED: 'Đã thu hồi', TITLE: 'Danh hiệu', REWARD_FORM: 'Hình thức khen thưởng', FACULTY: 'Cấp khoa', UNIVERSITY: 'Cấp trường', MINISTRY: 'Cấp bộ', STATE: 'Cấp Nhà nước' };
const date = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString('vi-VN') : '—';
const text = value => value == null || value === '' ? '—' : String(value);
function Fields({ rows }) {
  return <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([label,value]) => <div key={label}><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{text(value)}</dd></div>)}</dl>;
}
function Files({ files = [] }) {
  files = Array.isArray(files) ? files : [];
  return <div className="mt-3 space-y-2"><p className="text-xs font-semibold text-slate-500">Tệp trong bản nộp</p>{files.length ? <ul className="space-y-2">{files.map((f,i) => <li key={f.evidence_file_id || f.decision_file_id || i} className="flex items-start gap-2 rounded-lg bg-white p-2 text-sm dark:bg-slate-800"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal-600"/><div className="min-w-0"><p className="break-all">{f.original_file_name || 'Tệp đính kèm'}</p><p className="text-xs text-slate-500">Phiên bản {f.version_no || 1}{f.file_size ? ` · ${(Number(f.file_size)/1024).toFixed(1)} KB` : ''}</p></div></li>)}</ul> : <p className="text-sm text-slate-500">Không có tệp đính kèm.</p>}</div>;
}

export default function ApplicationSnapshot({ snapshot }) {
  let data = snapshot;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
  if (!data || typeof data !== 'object') return <p className="mt-3 text-sm text-slate-500">Chưa có dữ liệu bản nộp để hiển thị.</p>;
  const cycle = data.cycle || {}, target = data.target || {};
  const achievements = Array.isArray(data.achievements) ? data.achievements : [];
  const awards = Array.isArray(data.awards) ? data.awards : [];
  return <div className="mt-4 space-y-4">
    <p className="text-xs leading-relaxed text-slate-500">Bản lưu tại thời điểm nộp, bao gồm phiên bản tệp đã dùng để xét hồ sơ.</p>
    <Fields rows={[
      ['Kỳ xét thưởng',cycle.name],['Mã kỳ',cycle.code],['Thời gian kỳ xét',`${date(cycle.start_date)} – ${date(cycle.end_date)}`],
      ['Trạng thái kỳ khi nộp',labels[cycle.status] || cycle.status],['Loại thưởng đề nghị',target.name],['Mã loại thưởng',target.code],
      ['Nhóm khen thưởng',labels[target.category] || target.category],['Cấp khen thưởng',labels[target.level] || target.level],
      ['Mục đích đề nghị',data.purpose],['Ngày lưu bản nộp',date(data.capturedAt)],
    ]}/>
    <section className="space-y-3"><h4 className="text-sm font-bold">Thành tích đã nộp ({achievements.length})</h4>{achievements.map((a,i) => {
      const r = a.record || {}, s = a.submission || {};
      return <article key={r.achievement_id || i} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60"><h5 className="mb-3 break-words text-sm font-semibold">{r.title || `Thành tích #${r.achievement_id || i+1}`}</h5>
        <Fields rows={[
          ['Năm ghi nhận',r.recognition_year],['Trạng thái khi nộp',labels[r.status] || r.status],['Nội dung',r.description],['Vai trò đóng góp',r.contribution_role],
          ['Thời gian thực hiện',`${date(r.start_date)} – ${date(r.end_date)}`],['Lần nộp thành tích',s.revision_no],['Ghi chú khi nộp',s.submit_note],
        ]}/><Files files={a.files}/>
      </article>;
    })}{!achievements.length && <p className="text-sm text-slate-500">Không có thành tích trong bản nộp.</p>}</section>
    <section className="space-y-3"><h4 className="text-sm font-bold">Khen thưởng đã nộp ({awards.length})</h4>{awards.map((a,i) => {
      const r = a.record || {}, d = a.decision || {};
      return <article key={r.record_id || i} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60"><h5 className="mb-3 text-sm font-semibold">{d.title || `Khen thưởng #${r.record_id || i+1}`}</h5><Fields rows={[
        ['Năm ghi nhận',r.recognition_year],['Trạng thái khi nộp',labels[r.status] || r.status],['Số quyết định',d.decision_number],['Ngày quyết định',date(d.decision_date)],['Cơ quan ban hành',d.issuer],
      ]}/><Files files={a.files}/></article>;
    })}{!awards.length && <p className="text-sm text-slate-500">Không có khen thưởng liên kết trong bản nộp.</p>}</section>
  </div>;
}
