import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../services/request';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, Plus, Sparkles, ArrowRight, Eye, Layers, RefreshCw, 
  X, Calendar, Building2, CheckCircle2, AlertCircle, FileText, 
  FileDown, UploadCloud, ChevronRight, Check, Code, ShieldCheck,
  Share2, CheckSquare, Clock
} from 'lucide-react';

const api = (url, method = 'GET', data, options = {}) => request({ 
  url, 
  method, 
  data, 
  fresh: true, 
  ...(data instanceof FormData ? { headers: { 'Content-Type': undefined } } : {}), 
  ...options 
});

const items = value => Array.isArray(value) ? value : value?.items || [];

async function allDocuments() { 
  const first = await api('/regulations/documents?pageSize=100'); 
  const pages = Math.ceil((first.total || items(first).length) / 100); 
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => api(`/regulations/documents?pageSize=100&page=${i + 2}`))); 
  return [...items(first), ...rest.flatMap(items)]; 
}

const input = 'soft-input w-full';
const button = 'soft-btn-primary';
const secondary = 'soft-btn-secondary';
const panel = 'soft-card p-5 sm:p-6';
const date = value => value ? String(value).slice(0, 10) : '';

const blankCriterion = () => ({ 
  code: '', 
  title: '', 
  source_reference: '', 
  description: '', 
  criterion_group_id: '', 
  is_required: true, 
  is_exclusion: false, 
  coverage_status: 'AUTOMATED', 
  provenance: {}, 
  rule: { type: 'count', filters: [], target: 1, comparator: 'gte', measure_unit: 'thành tích' } 
});

function Field({ label, children }) { 
  return (
    <label className="block space-y-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  ); 
}

function Notice({ error, message }) { 
  return (
    <>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3.5 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900 text-xs font-semibold mb-3">
          {error.message || String(error)}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-teal-50 p-3.5 text-teal-900 border border-teal-200 dark:bg-teal-950 dark:text-teal-100 dark:border-teal-900 text-xs font-semibold mb-3">
          {message}
        </p>
      )}
    </>
  ); 
}

function Lines({ label, value, onChange }) { 
  return (
    <Field label={label}>
      <textarea 
        className={input} 
        rows={2} 
        value={(value || []).join('\n')} 
        onChange={e => onChange(e.target.value.split('\n'))} 
        placeholder="Mỗi dòng là một nội dung/điều khoản..."
      />
    </Field>
  ); 
}

/**
 * Dịch quy tắc JSON kỹ thuật sang tiếng Việt thân thiện, dễ hiểu cho người dùng bình thường
 */
function formatRuleToVietnamese(rule) {
  if (!rule || typeof rule !== 'object') return 'Không có quy tắc tự động';
  const parts = [];
  
  if (rule.type === 'count') {
    const comp = rule.comparator === 'gte' ? 'tối thiểu' : rule.comparator === 'lte' ? 'tối đa' : 'bằng';
    parts.push(`Số lượng thành tích ${comp} ${rule.target ?? 1} ${rule.measure_unit || 'mục'}`);
  } else if (rule.type === 'sum') {
    const comp = rule.comparator === 'gte' ? 'tối thiểu' : rule.comparator === 'lte' ? 'tối đa' : 'bằng';
    parts.push(`Tổng cộng ${comp} ${rule.target ?? 1} ${rule.measure_unit || ''}`);
  } else if (rule.type === 'distinct_years') {
    parts.push(`Yêu cầu đạt được trong tối thiểu ${rule.target ?? 1} năm khác nhau`);
  } else if (rule.type === 'boolean') {
    parts.push(rule.is_exclusion ? 'Điều kiện loại trừ (Không được vi phạm)' : 'Yêu cầu có ít nhất 1 minh chứng hợp lệ');
  } else {
    parts.push(`Cách tính: ${rule.type}`);
  }

  if (rule.filters && rule.filters.length > 0) {
    const filterTexts = rule.filters.map(f => {
      if (f.field === 'attributes.category') return `Loại hoạt động: "${f.value}"`;
      if (f.field === 'achievement_type_id') return `Loại thành tích: #${f.value}`;
      return `${f.field} = "${f.value}"`;
    });
    parts.push(`Điều kiện: ${filterTexts.join(', ')}`);
  }

  if (rule.from || rule.to) {
    parts.push(`Xét từ ${rule.from || '...'} đến ${rule.to || '...'}`);
  }

  return parts.join(' · ');
}

/**
 * Form tạo phiên bản nháp mới - Gọn gàng, phân khu vực rõ ràng
 */
function VersionForm({ initial, onSubmit, onCancel, submitLabel = "Tạo bản nháp" }) {
  const [form, setForm] = useState(() => ({
    version_label: initial?.version_label || '',
    effective_from: date(initial?.effective_from) || new Date().toISOString().slice(0, 10),
    effective_to: date(initial?.effective_to) || '',
    source_title: initial?.source_title || '',
    source_url: initial?.source_url || '',
    source_kind: initial?.source_kind || 'MANUAL',
    issuing_authority: initial?.issuing_authority || '',
    applicability: initial?.applicability || {},
    aggregation: initial?.aggregation || { operator: 'AND' },
    coverage: initial?.coverage || { automated: [], manual: [], unsupported: [] }
  }));

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  return (
    <form 
      className="space-y-4 text-left" 
      onSubmit={e => {
        e.preventDefault();
        onSubmit({
          ...form,
          effective_to: form.effective_to || null,
          source_url: form.source_url || null,
          issuing_authority: form.issuing_authority || null,
          coverage: Object.fromEntries(Object.entries(form.coverage).map(([k, v]) => [k, v.map(x => x.trim()).filter(Boolean)]))
        });
      }}
    >
      {/* Khu vực 1: Thông tin phiên bản & Căn cứ */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
        <h4 className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
          1. Thông tin phiên bản & Thẩm quyền
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên phiên bản * (ví dụ: v1.0, 2026-CT)">
            <input required className={input} value={form.version_label} onChange={e => update('version_label', e.target.value)} placeholder="v1.0" />
          </Field>
          <Field label="Tên nguồn hoặc văn bản căn cứ *">
            <input required className={input} value={form.source_title} onChange={e => update('source_title', e.target.value)} placeholder="Quyết định số 123/QĐ-ĐHLH..." />
          </Field>
          <Field label="Hiệu lực từ ngày *">
            <input required type="date" className={input} value={form.effective_from} onChange={e => update('effective_from', e.target.value)} />
          </Field>
          <Field label="Hiệu lực đến ngày (để trống nếu vô hạn)">
            <input type="date" className={input} value={form.effective_to} onChange={e => update('effective_to', e.target.value)} />
          </Field>
          <Field label="Loại nguồn văn bản">
            <select className={input} value={form.source_kind} onChange={e => update('source_kind', e.target.value)}>
              <option value="OFFICIAL">Văn bản chính thức</option>
              <option value="MANUAL">Tự đặt / nhập thủ công</option>
              <option value="DEMO">Nguồn minh họa</option>
            </select>
          </Field>
          <Field label="Cơ quan / Đơn vị ban hành">
            <input className={input} value={form.issuing_authority} onChange={e => update('issuing_authority', e.target.value)} placeholder="Ban Giám hiệu, Khoa CNTT..." />
          </Field>
        </div>
      </div>

      {/* Khu vực 2: Đối tượng áp dụng & Quy tắc kết hợp */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
        <h4 className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
          2. Đối tượng & Cách kết hợp tiêu chí
        </h4>
        <Field label="Cách kết hợp các tiêu chí bắt buộc">
          <select className={input} value={form.aggregation.operator} onChange={e => update('aggregation', { operator: e.target.value })}>
            <option value="AND">Tất cả tiêu chí bắt buộc phải đạt (AND)</option>
            <option value="OR">Ít nhất một tiêu chí bắt buộc đạt (OR)</option>
          </select>
        </Field>

        <div>
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Nhóm đối tượng áp dụng:
          </span>
          <div className="flex flex-wrap gap-3">
            {[
              ['STUDENT', 'Sinh viên'],
              ['LECTURER', 'Giảng viên'],
              ['STAFF', 'Nhân viên'],
              ['OTHER', 'Khác']
            ].map(([val, text]) => {
              const checked = (form.applicability.person_types || []).includes(val);
              return (
                <label key={val} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                  checked ? 'bg-teal-50 border-teal-300 text-teal-900 dark:bg-teal-950 dark:border-teal-700 dark:text-teal-200' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700'
                }`}>
                  <input 
                    type="checkbox" 
                    className="rounded text-teal-600"
                    checked={checked} 
                    onChange={e => {
                      const list = form.applicability.person_types || [];
                      const next = e.target.checked ? [...list, val] : list.filter(x => x !== val);
                      update('applicability', next.length ? { person_types: next } : {});
                    }} 
                  />
                  <span>{text}</span>
                </label>
              );
            })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Để trống nếu áp dụng chung cho mọi đối tượng.</span>
        </div>
      </div>

      {/* Khu vực 3: Phạm vi điều khoản */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
        <h4 className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
          3. Ghi chú điều khoản (Tùy chọn)
        </h4>
        <Lines label="Điều khoản đã hỗ trợ tự động" value={form.coverage.automated} onChange={v => update('coverage', { ...form.coverage, automated: v })} />
        <Lines label="Điều khoản cần kiểm tra thủ công" value={form.coverage.manual} onChange={v => update('coverage', { ...form.coverage, manual: v })} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button type="button" className={secondary} onClick={onCancel}>
            Hủy
          </button>
        )}
        <button className={button}>{submitLabel}</button>
      </div>
    </form>
  );
}

/**
 * Trình xem và chỉnh sửa phiên bản quy chế (Inspector)
 */
function Editor({ doc, versionId, organizations, catalog, refresh, action, onClose }) {
  const [version, setVersion] = useState(null);
  const [source, setSource] = useState(null);
  const [file, setFile] = useState(null);
  const [showRawJson, setShowRawJson] = useState({});

  const load = useCallback(async () => {
    const v = await api(`/regulations/versions/${versionId}`);
    setVersion(v);
    try {
      setSource(await api(`/regulations/versions/${versionId}/source`));
    } catch (err) {
      if (err.status === 404) setSource(null);
      else throw err;
    }
  }, [versionId]);

  useEffect(() => {
    setVersion(null);
    setSource(null);
    action(load);
  }, [load, action]);

  if (!version) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-xs font-semibold text-slate-500">Đang nạp chi tiết phiên bản quy chế...</p>
      </div>
    );
  }

  const draft = version.publication_status === 'DRAFT';
  const editable = draft && doc.can_manage;
  const run = (fn, msg) => action(async () => { await fn(); await load(); await refresh(); }, msg);

  async function download() {
    const blob = await api(`/regulations/versions/${versionId}/source/download`, 'GET', undefined, { responseType: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = source?.originalFilename || 'quy-che.pdf';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      {/* Banner đầu phiên bản */}
      <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200/80 dark:bg-teal-950/30 dark:border-teal-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-teal-700 text-white">
              {version.version_label}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              draft ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            }`}>
              {draft ? 'Bản nháp' : 'Đã công bố chính thức'}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
            <Calendar size={13} className="text-slate-400" />
            <span>Hiệu lực từ <strong>{date(version.effective_from)}</strong> {version.effective_to ? `đến ${date(version.effective_to)}` : '(vô thời hạn)'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!draft && (
            <button 
              type="button"
              className="soft-btn-primary text-xs font-bold inline-flex items-center gap-1.5" 
              onClick={() => {
                run(async () => {
                  await api(`/regulations/versions/${versionId}/adopt`, 'POST', {});
                }, 'Đã thêm quy chế này vào danh sách theo dõi định mức cá nhân!');
              }}
              title="Ghim quy chế vào hồ sơ cá nhân để hệ thống tự động đối chiếu định mức NCKH/Giảng dạy"
            >
              <CheckCircle2 size={15} /> Theo dõi định mức này (Ghim vào hồ sơ)
            </button>
          )}

          {draft && doc.can_publish && (
            <button 
              type="button"
              className="soft-btn-primary text-xs font-bold" 
              onClick={() => {
                if (window.confirm('Bạn có chắc muốn công bố phiên bản này? Khi đã công bố, nội dung sẽ được khóa để đảm bảo tính pháp lý.')) {
                  run(() => api(`/regulations/versions/${versionId}/publish`, 'POST', {}), 'Đã công bố phiên bản thành công!');
                }
              }}
            >
              <ShieldCheck size={15} /> Công bố phiên bản này
            </button>
          )}
        </div>
      </div>

      {/* Thẻ tóm tắt nhanh điều kiện định mức */}
      <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} /> Tóm tắt điều kiện định mức
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">{version.criteria?.length || 0} tiêu chuẩn cần đạt</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(version.criteria || []).length === 0 ? (
            <span className="text-xs text-slate-400 italic">Chưa thiết lập tiêu chuẩn cho phiên bản này.</span>
          ) : (
            (version.criteria || []).slice(0, 4).map(crit => (
              <span key={crit.id} className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-teal-200/80 dark:border-teal-700 font-medium text-slate-700 dark:text-slate-200 shadow-2xs">
                • {crit.title}
              </span>
            ))
          )}
          {(version.criteria?.length || 0) > 4 && (
            <span className="px-2 py-1 text-slate-400 text-xs italic">
              + {(version.criteria.length - 4)} tiêu chí khác
            </span>
          )}
        </div>
      </div>

      {/* Thông tin nguồn & Tệp đính kèm */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <FileText size={14} className="text-teal-600" />
          <span>Văn bản nguồn & Tài liệu căn cứ</span>
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <p><span className="text-slate-400">Nguồn ban hành:</span> <strong>{version.source_title || 'Chưa cập nhật'}</strong></p>
          <p><span className="text-slate-400">Cơ quan:</span> <strong>{version.issuing_authority || 'Trường ĐH Lạc Hồng'}</strong></p>
          <p><span className="text-slate-400">Đối tượng:</span> <strong>{version.applicability?.person_types?.join(', ') || 'Tất cả đối tượng'}</strong></p>
          <p><span className="text-slate-400">Hình thức:</span> <strong>{version.source_kind === 'OFFICIAL' ? 'Chính thức' : 'Tự đặt'}</strong></p>
        </div>

        {source ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mt-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 truncate">
              <FileText size={15} className="text-teal-600 shrink-0" />
              <span className="truncate">{source.originalFilename} ({(source.byteSize / 1024 / 1024).toFixed(2)} MB)</span>
            </span>
            <button type="button" className="soft-btn-secondary text-xs py-1 px-3 inline-flex items-center gap-1" onClick={download}>
              <FileDown size={14} /> Tải văn bản
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa đính kèm tệp văn bản PDF/DOCX cho phiên bản này.</p>
        )}
      </div>

      {/* Danh sách tiêu chí đánh giá (Format thẻ đẹp mắt, bỏ JSON thô) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>Danh mục tiêu chí xét duyệt</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              {version.criteria?.length || 0} tiêu chí
            </span>
          </h4>
        </div>

        {!version.criteria?.length ? (
          <p className="text-xs text-slate-400 italic p-4 text-center border border-dashed border-slate-200 rounded-xl">
            Phiên bản này chưa có tiêu chí nào.
          </p>
        ) : (
          <div className="space-y-3">
            {version.criteria.map((c, idx) => (
              <div key={c.id} className="p-4 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800/80 dark:border-slate-700 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center border border-teal-200 shrink-0 mt-0.5 dark:bg-teal-950 dark:border-teal-800 dark:text-teal-300">
                      {idx + 1}
                    </span>
                    <div>
                      <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100">{c.title}</h5>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{c.code} · Căn cứ: {c.source_reference}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      c.is_required ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {c.is_required ? 'Bắt buộc' : 'Tùy chọn'}
                    </span>
                    {c.is_exclusion && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Loại trừ
                      </span>
                    )}
                  </div>
                </div>

                {c.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 pl-8 leading-relaxed">
                    {c.description}
                  </p>
                )}

                {/* Diễn giải quy tắc thân thiện */}
                <div className="ml-8 p-2.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-teal-600 mt-0.5" />
                  <div className="flex-1">
                    <strong className="block text-[11px] text-teal-800 dark:text-teal-300 uppercase">Quy tắc tự động:</strong>
                    <span>{formatRuleToVietnamese(c.rule)}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowRawJson(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline shrink-0"
                  >
                    {showRawJson[c.id] ? 'Thu gọn' : 'Xem JSON'}
                  </button>
                </div>

                {showRawJson[c.id] && (
                  <pre className="ml-8 p-2.5 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-mono overflow-auto max-h-40">
                    {JSON.stringify(c.rule, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VaultModal({ open, onClose, title, subtitle, maxWidth = "max-w-4xl", children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className={`vault-modal ${maxWidth} w-[94vw] max-h-[90vh] overflow-y-auto`}
      aria-label={typeof title === 'string' ? title : 'Hộp thoại'}
      onCancel={onClose}
      onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="vault-modal-heading sticky top-0 bg-white dark:bg-slate-800 z-10 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between p-4 sm:p-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 font-mono mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="soft-btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1 font-bold rounded-xl"
          onClick={onClose}
          aria-label="Đóng"
        >
          <X size={16} /> Đóng
        </button>
      </div>
      <div className="vault-modal-body p-4 sm:p-6 space-y-6">
        {children}
      </div>
    </dialog>
  );
}

/**
 * Trang Kho quy chế chính
 */
export default function RegulationLibrary() {
  const { hasRole } = useAuth();
  const [docs, setDocs] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [shares, setShares] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [profile, setProfile] = useState({});
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('applicable');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Selected inspection document
  const [selected, setSelected] = useState(null);
  const [version, setVersion] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [newDoc, setNewDoc] = useState({ code: '', name: '', owner_organization_id: '' });
  const [adoptOrg, setAdoptOrg] = useState('');

  const reload = useCallback(async () => {
    const [d, c, s, o, p, cat] = await Promise.all([
      allDocuments(),
      api('/regulations/library'),
      api('/regulations/shares'),
      api('/organizations'),
      api('/me/profile'),
      api('/achievements/catalogs')
    ]);
    setDocs(items(d));
    setContexts(items(c));
    setShares(items(s));
    setOrgs(items(o));
    setProfile(p || {});
    setCatalog(cat?.achievementTypes || []);
  }, []);

  const action = useCallback(async (fn, msg) => {
    setBusy(n => n + 1);
    try {
      setError(null);
      setMessage('');
      await fn();
      if (msg) setMessage(msg);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(n => n - 1);
    }
  }, []);

  useEffect(() => {
    action(async () => {
      try {
        await reload();
      } finally {
        setLoading(false);
      }
    });
  }, [reload, action]);

  const permits = (id, permission) => 
    hasRole('SYSTEM_ADMIN') || 
    (hasRole('REGULATION_MANAGER') && ['REGULATIONS_CREATE', 'REGULATIONS_MANAGE', 'REGULATIONS_PUBLISH', 'REGULATIONS_SHARE'].includes(permission)) || 
    (profile.orgGrants || []).some(g => {
      if (g.permission_code !== permission) return false;
      if (Number(g.organization_id) === Number(id)) return true;
      if (!g.include_descendants) return false;
      let org = orgs.find(o => Number(o.id) === Number(id));
      const seen = new Set();
      while (org?.parent_id && !seen.has(org.id)) {
        seen.add(org.id);
        if (Number(org.parent_id) === Number(g.organization_id)) return true;
        org = orgs.find(o => Number(o.id) === Number(org.parent_id));
      }
      return false;
    });

  const name = id => orgs.find(o => Number(o.id) === Number(id))?.name || `Tổ chức #${id}`;
  const manageable = docs.filter(d => d.can_manage || d.can_publish || d.can_share);
  const publicDocs = docs.filter(d => d.is_public && d.versions?.some(v => v.publication_status === 'PUBLISHED'));
  const selectedDoc = docs.find(d => Number(d.id) === Number(selected));

  const openInspector = (docId, vId) => {
    setSelected(docId);
    setVersion(vId ? String(vId) : '');
  };

  const matches = x => `${x.name || ''} ${x.code || ''} ${x.version_label || ''}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'));

  const categorize = d => {
    const text = `${d.name || ''} ${d.code || ''} ${d.description || ''}`.toLowerCase();
    if (text.includes('nghiên cứu') || text.includes('nckh') || text.includes('bài báo') || text.includes('khoa học') || text.includes('sáng chế') || text.includes('đề tài')) {
      return 'nckh';
    }
    if (text.includes('giảng dạy') || text.includes('đào tạo') || text.includes('giờ chuẩn') || text.includes('giáo trình') || text.includes('bài giảng') || text.includes('khóa luận')) {
      return 'teaching';
    }
    if (text.includes('thi đua') || text.includes('khen thưởng') || text.includes('chiến sĩ') || text.includes('lao động tiên tiến') || text.includes('dạy giỏi') || text.includes('danh hiệu')) {
      return 'award';
    }
    return 'other';
  };

  const matchesCategory = d => {
    if (categoryFilter === 'all') return true;
    return categorize(d) === categoryFilter;
  };

  const pageActions = (
    <div className="flex items-center gap-2">
      <Link 
        to="/me/ai-forecast" 
        className="soft-btn-secondary inline-flex items-center gap-1.5 text-xs font-bold"
      >
        <Sparkles size={14} className="text-teal-600" />
        <span>Khám hồ sơ AI</span>
      </Link>
      <button 
        type="button" 
        className={button} 
        disabled={busy > 0} 
        onClick={() => setCreatingDoc(true)}
      >
        <Plus size={16} />
        <span>Tạo quy chế</span>
      </button>
    </div>
  );

  return (
    <main className="vault-page" data-page="Kho quy chế">
      <header className="vault-page-header">
        <div>
          <h1>Kho quy chế</h1>
          <p className="vault-page-description">Tra cứu, tiếp nhận và quản lý các quy chế đánh giá thành tích tại trường.</p>
        </div>
        <div className="vault-page-actions">
          {pageActions}
        </div>
      </header>

      <fieldset disabled={busy > 0} aria-busy={busy > 0} className="vault-content min-w-0 border-0 p-0">
        <Notice error={error} message={message} />

        <section className={panel}>
          {/* Tabs chính */}
          <div className="vault-list-heading pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="vault-tabs" role="tablist">
              {[
                ['applicable', `Đang áp dụng (${contexts.length})`],
                ['managed', `Tôi quản lý (${manageable.length})`],
                ['public', `Cộng đồng (${publicDocs.length})`],
                ['shares', `Chia sẻ (${shares.length})`]
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => { setTab(id); setSelected(null); }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Ô tìm kiếm & Bộ lọc Danh mục */}
          {tab !== 'shares' && (
            <div className="mt-4 mb-5 space-y-3">
              <div className="max-w-md">
                <Field label="Tìm kiếm theo tên quy chế hoặc mã">
                  <input 
                    type="search" 
                    className={input} 
                    placeholder="Nhập tên hoặc mã quy chế..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                  />
                </Field>
              </div>

              {/* Chips phân loại danh mục dành cho Giảng viên & Nhà trường */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  ['all', 'Tất cả quy chế'],
                  ['nckh', '🔬 Nghiên cứu khoa học & Bài báo'],
                  ['teaching', '📖 Giảng dạy & Đào tạo'],
                  ['award', '🏆 Thi đua - Khen thưởng'],
                  ['other', 'Khác / Sinh viên']
                ].map(([catId, catLabel]) => (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => setCategoryFilter(catId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      categoryFilter === catId
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {catLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-xs font-semibold text-slate-500">Đang tải kho quy chế…</p>
            </div>
          ) : (
            <>
              {/* TAB 1: ĐANG ÁP DỤNG */}
              {tab === 'applicable' && (
                !contexts.filter(matches).filter(matchesCategory).length ? (
                  <p className="p-8 text-center text-xs text-slate-500">
                    Chưa có quy chế nào phù hợp với bộ lọc. Bạn có thể duyệt tab "Cộng đồng" để theo dõi quy chế mới hoặc tạo quy chế riêng.
                  </p>
                ) : (
                  <div className="vault-card-grid">
                    {contexts.filter(matches).filter(matchesCategory).map((c, i) => {
                      const expired = c.effective_to && date(c.effective_to) < new Date().toISOString().slice(0, 10);
                      return (
                        <article 
                          key={`${c.adoption_id}-${c.regulation_version_id}-${c.member_organization_id}-${i}`} 
                          className="vault-regulation-card"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="vault-regulation-code">{c.code} · {c.version_label}</span>
                            <span className={`vault-status ${expired ? 'is-muted' : 'is-positive'}`}>
                              {expired ? 'Hết hiệu lực' : 'Đang áp dụng'}
                            </span>
                          </div>

                          <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{c.name}</h3>

                          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <p className="flex items-center gap-1.5">
                              <Building2 size={13} className="text-slate-400" />
                              <span>{c.context_type === 'ORGANIZATION' ? `Tổ chức: ${name(c.organization_id)}` : 'Quy chế cá nhân'}</span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-slate-400" />
                              <span>Hiệu lực: {date(c.effective_from)} {c.effective_to ? `đến ${date(c.effective_to)}` : '(không giới hạn)'}</span>
                            </p>
                          </div>

                          {c.update_available && (
                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                              <span>Có phiên bản mới: <strong>{c.latest_version_label}</strong></span>
                              <button 
                                type="button"
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shrink-0"
                                onClick={() => {
                                  if (window.confirm(`Cập nhật sang phiên bản mới ${c.latest_version_label}?`)) {
                                    action(async () => {
                                      await api(`/regulations/versions/${c.latest_version_id}/adopt`, 'POST', c.context_type === 'ORGANIZATION' ? { organization_id: Number(c.organization_id) } : {});
                                      await reload();
                                    }, 'Đã cập nhật phiên bản quy chế thành công.');
                                  }
                                }}
                              >
                                Cập nhật ngay
                              </button>
                            </div>
                          )}

                          <div className="vault-card-actions">
                            <button 
                              type="button"
                              className="soft-btn-primary w-full text-xs font-bold inline-flex items-center justify-center gap-1.5" 
                              onClick={() => openInspector(c.regulation_id, c.regulation_version_id)}
                            >
                              <Eye size={14} />
                              <span>Xem chi tiết & Tiêu chí</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )
              )}

              {/* TAB 2: TÔI QUẢN LÝ */}
              {tab === 'managed' && (
                !manageable.filter(matches).filter(matchesCategory).length ? (
                  <p className="p-8 text-center text-xs text-slate-500">Không tìm thấy quy chế phù hợp trong danh mục quản lý của bạn. Hãy chọn danh mục khác hoặc nhấn "Tạo quy chế".</p>
                ) : (
                  <div className="vault-card-grid">
                    {manageable.filter(matches).filter(matchesCategory).map(d => (
                      <article key={d.id} className="vault-regulation-card">
                        <div className="flex justify-between items-center gap-2">
                          <span className="vault-regulation-code">{d.code}</span>
                          <span className="text-xs text-slate-400 font-semibold">{d.versions?.length || 0} phiên bản</span>
                        </div>
                        <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{d.name}</h3>
                        <p className="text-xs text-slate-500">
                          Chủ sở hữu: <strong>{d.owner_type === 'PERSONAL' ? 'Cá nhân tôi' : name(d.owner_organization_id)}</strong>
                        </p>
                        <div className="vault-card-actions">
                          <button 
                            type="button"
                            className="soft-btn-primary w-full text-xs font-bold inline-flex items-center justify-center gap-1.5" 
                            onClick={() => openInspector(d.id, d.versions?.[0]?.id)}
                          >
                            <Layers size={14} />
                            <span>Quản lý phiên bản & Soạn thảo</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              )}

              {/* TAB 3: CỘNG ĐỒNG */}
              {tab === 'public' && (
                !publicDocs.filter(matches).filter(matchesCategory).length ? (
                  <p className="p-8 text-center text-xs text-slate-500">Không tìm thấy quy chế cộng đồng nào phù hợp với bộ lọc danh mục đã chọn.</p>
                ) : (
                  <div className="vault-card-grid">
                    {publicDocs.filter(matches).filter(matchesCategory).map(d => (
                      <article key={d.id} className="vault-regulation-card">
                        <span className="vault-regulation-code">{d.code}</span>
                        <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{d.name}</h3>
                        <p className="text-xs text-slate-500">Ban hành bởi: <strong>{name(d.owner_organization_id)}</strong></p>
                        
                        <div className="space-y-1.5 my-2">
                          <span className="text-[11px] text-slate-400 font-bold block">Phiên bản công bố:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {d.versions.filter(v => v.publication_status === 'PUBLISHED').map(v => (
                              <button 
                                key={v.id} 
                                type="button" 
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200"
                                onClick={() => openInspector(d.id, v.id)}
                              >
                                Xem {v.version_label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="vault-card-actions">
                          <button 
                            type="button" 
                            className="soft-btn-secondary w-full text-xs font-bold"
                            onClick={() => openInspector(d.id, d.versions?.find(v => v.publication_status === 'PUBLISHED')?.id)}
                          >
                            Xem chi tiết quy chế
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              )}

              {/* TAB 4: CHIA SẺ */}
              {tab === 'shares' && (
                !shares.length ? (
                  <p className="p-8 text-center text-xs text-slate-500">Chưa có lời chia sẻ quy chế nào.</p>
                ) : (
                  <div className="space-y-3">
                    {shares.map(s => (
                      <div key={s.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between">
                        <div>
                          <strong className="text-sm font-bold block">{s.name} · {s.version_label}</strong>
                          <span className="text-xs text-slate-500">Đơn vị nhận: {s.recipient_name}</span>
                        </div>
                        {s.status === 'PENDING' && s.can_respond && (
                          <div className="flex gap-2">
                            <button className={button} onClick={() => action(async () => { await api(`/regulations/shares/${s.id}/respond`, 'POST', { accept: true }); await reload(); }, 'Đã chấp nhận chia sẻ.')}>Đồng ý</button>
                            <button className={secondary} onClick={() => action(async () => { await api(`/regulations/shares/${s.id}/respond`, 'POST', { accept: false }); await reload(); }, 'Từ chối')}>Từ chối</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </section>

        {/* MODAL / INSPECTOR CHI TIẾT QUY CHẾ */}
        <VaultModal
          open={Boolean(selectedDoc)}
          onClose={() => setSelected(null)}
          title={selectedDoc?.name || ''}
          subtitle={selectedDoc ? `${selectedDoc.code} · ${selectedDoc.owner_type === 'PERSONAL' ? 'Quy chế cá nhân' : name(selectedDoc.owner_organization_id)}` : ''}
          maxWidth="max-w-4xl"
        >
          {selectedDoc && (
            <div className="space-y-6">
              {/* Chọn phiên bản & Nút tạo bản nháp */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-end justify-between gap-3">
                <div className="flex-1 min-w-[220px]">
                  <Field label="Chọn phiên bản quy chế">
                    <select className={input} value={version} onChange={e => setVersion(e.target.value)}>
                      <option value="">Chọn phiên bản...</option>
                      {(selectedDoc.versions || []).map(v => (
                        <option key={v.id} value={v.id}>
                          {v.version_label} · {v.publication_status === 'DRAFT' ? 'Bản nháp' : 'Đã công bố chính thức'}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {selectedDoc.can_manage && (
                  <button 
                    type="button" 
                    className="soft-btn-primary text-xs font-bold inline-flex items-center gap-1.5"
                    onClick={() => setCreatingVersion(true)}
                  >
                    <Plus size={15} /> Tạo phiên bản nháp mới
                  </button>
                )}
              </div>

              {/* Chi tiết nội dung phiên bản */}
              {version ? (
                <Editor 
                  key={version} 
                  doc={selectedDoc} 
                  versionId={version} 
                  organizations={orgs} 
                  catalog={catalog} 
                  refresh={reload} 
                  action={action} 
                  onClose={() => setSelected(null)}
                />
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Vui lòng chọn một phiên bản ở trên để xem chi tiết danh mục tiêu chí.
                </div>
              )}
            </div>
          )}
        </VaultModal>

        {/* MODAL: TẠO PHIÊN BẢN NHÁP MỚI */}
        <VaultModal
          open={Boolean(creatingVersion && selectedDoc)}
          onClose={() => setCreatingVersion(false)}
          title={`Tạo phiên bản nháp cho: ${selectedDoc?.name || ''}`}
          maxWidth="max-w-2xl"
        >
          {creatingVersion && selectedDoc && (
            <VersionForm 
              initial={{}}
              submitLabel="Tạo bản nháp ngay"
              onCancel={() => setCreatingVersion(false)}
              onSubmit={data => {
                action(async () => {
                  const v = await api(`/regulations/documents/${selectedDoc.id}/versions`, 'POST', data);
                  setVersion(String(v.id));
                  setCreatingVersion(false);
                  await reload();
                }, 'Đã tạo phiên bản nháp mới thành công.');
              }}
            />
          )}
        </VaultModal>

        {/* MODAL: TẠO QUY CHẾ MỚI */}
        <VaultModal
          open={creatingDoc}
          onClose={() => setCreatingDoc(false)}
          title="Tạo văn bản quy chế mới"
          maxWidth="max-w-lg"
        >
          <form 
            className="space-y-4" 
            onSubmit={e => {
              e.preventDefault();
              action(async () => {
                const d = await api('/regulations/documents', 'POST', {
                  code: newDoc.code,
                  name: newDoc.name,
                  ...(newDoc.owner_organization_id ? { owner_organization_id: Number(newDoc.owner_organization_id) } : {})
                });
                setNewDoc({ code: '', name: '', owner_organization_id: '' });
                setCreatingDoc(false);
                setTab('managed');
                openInspector(d.id);
                await reload();
              }, 'Đã khởi tạo quy chế mới.');
            }}
          >
            <Field label="Mã quy chế * (ví dụ: QC-NCKH-2026)">
              <input required className={input} value={newDoc.code} onChange={e => setNewDoc({ ...newDoc, code: e.target.value })} placeholder="QC-NCKH-2026" />
            </Field>
            <Field label="Tên quy chế *">
              <input required className={input} value={newDoc.name} onChange={e => setNewDoc({ ...newDoc, name: e.target.value })} placeholder="Quy chế Đánh giá Nghiên cứu khoa học..." />
            </Field>
            <Field label="Chủ sở hữu ban hành">
              <select className={input} value={newDoc.owner_organization_id} onChange={e => setNewDoc({ ...newDoc, owner_organization_id: e.target.value })}>
                <option value="">Cá nhân tôi</option>
                {orgs.filter(o => permits(o.id, 'REGULATIONS_CREATE')).map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={secondary} onClick={() => setCreatingDoc(false)}>Hủy</button>
              <button className={button}>Khởi tạo quy chế</button>
            </div>
          </form>
        </VaultModal>
      </fieldset>
    </main>
  );
}
