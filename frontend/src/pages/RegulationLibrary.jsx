import React, { Fragment, useCallback, useEffect, useState } from 'react';
import VaultModal from '../components/common/VaultDialog';
import { formatRegulationOperator } from './regulationRule';
import RegulationRuleDescription from './RegulationRuleDescription';
import VaultTabs from '../components/common/VaultTabs';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { request } from '../services/request';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, Plus, Sparkles, ArrowRight, Eye, Layers, RefreshCw, 
  X, Calendar, Building2, AlertCircle, FileText,
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
const formatDate = value => date(value).split('-').reverse().join('/');

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
    <label className="vault-field block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
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
 * Form tạo phiên bản nháp mới - Gọn gàng, phân khu vực rõ ràng
 */
function VersionForm({ initial, onSubmit, onCancel, submitLabel = "Tạo bản nháp", children }) {
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
      {children}
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
          <select className={input} value={form.aggregation.operator} onChange={e => update('aggregation', { ...form.aggregation, operator: e.target.value })}>
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
function RegulationCriterionForm({ kind, item, catalog, groups, onCancel, onSave }) {
  const isGroup = kind === 'groups';
  const originalRule = item?.rule;
  const simpleRule = !originalRule || (originalRule.type === 'count' && !originalRule.from && !originalRule.to && !originalRule.last_years
    && (!originalRule.filters?.length || (originalRule.filters.length === 1 && originalRule.filters[0].field === 'achievement_type_id' && originalRule.filters[0].operator === 'eq')));
  const [form, setForm] = useState(() => ({
    code: item?.code || '', title: item?.title || '', is_required: item ? !!item.is_required : true,
    operator: item?.operator || 'AND', source_reference: item?.source_reference || '', description: item?.description || '',
    criterion_group_id: item?.criterion_group_id || '', coverage_status: item?.coverage_status || 'AUTOMATED',
    typeId: originalRule?.filters?.[0]?.value || '', target: originalRule?.target ?? 1,
    comparator: originalRule?.comparator || 'gte', measure_unit: originalRule?.measure_unit || 'thành tích',
  }));
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return <form className="regulation-configuration space-y-3" onSubmit={event => {
    event.preventDefault();
    const base = { code: form.code, title: form.title, is_required: form.is_required };
    if (isGroup) { onSave({ ...base, operator: form.operator }); return; }
    const details = { ...base, source_reference: form.source_reference, description: form.description || null,
      criterion_group_id: form.criterion_group_id ? Number(form.criterion_group_id) : null, coverage_status: form.coverage_status };
    const rule = { type: 'count', comparator: form.comparator, target: Number(form.target), measure_unit: form.measure_unit,
      filters: form.typeId ? [{ field: 'achievement_type_id', operator: 'eq', value: Number(form.typeId) }] : [] };
    onSave(simpleRule ? { ...details, rule } : details);
  }}>
    <h3 className="font-bold">{item ? 'Sửa ' : 'Thêm '}{isGroup ? 'nhóm tiêu chí' : 'tiêu chí'}</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Mã"><input required maxLength={80} className={input} value={form.code} onChange={event => update('code', event.target.value)} /></Field>
      <Field label="Tên"><input required maxLength={300} className={input} value={form.title} onChange={event => update('title', event.target.value)} /></Field>
    </div>
    {isGroup ? <Field label="Điều kiện đạt nhóm"><select className={input} value={form.operator} onChange={event => update('operator', event.target.value)}>
      <option value="AND">Đạt tất cả</option><option value="OR">Đạt ít nhất một</option>
    </select></Field> : <>
      <Field label="Căn cứ"><input required maxLength={1000} className={input} value={form.source_reference} onChange={event => update('source_reference', event.target.value)} /></Field>
      <Field label="Mô tả"><textarea className={input} maxLength={20000} value={form.description} onChange={event => update('description', event.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nhóm tiêu chí"><select className={input} value={form.criterion_group_id} onChange={event => update('criterion_group_id', event.target.value)}>
          <option value="">Không thuộc nhóm</option>{groups.map(group => <option key={group.id} value={group.id}>{group.title}</option>)}
        </select></Field>
        <Field label="Cách xét"><select className={input} value={form.coverage_status} onChange={event => update('coverage_status', event.target.value)}>
          <option value="AUTOMATED">Đối chiếu tự động</option><option value="MANUAL">Xét thủ công</option><option value="UNSUPPORTED">Chưa hỗ trợ</option>
        </select></Field>
      </div>
      {simpleRule ? <>
        <Field label="Loại thành tích được tính"><select className={input} value={form.typeId} onChange={event => update('typeId', event.target.value)}>
          <option value="">Mọi loại thành tích</option>
          {form.typeId && !catalog.some(type => String(type.id) === String(form.typeId)) && <option value={form.typeId}>Loại hiện tại (#{form.typeId})</option>}
          {catalog.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quan hệ"><select className={input} value={form.comparator} onChange={event => update('comparator', event.target.value)}>
            <option value="gte">Ít nhất</option><option value="lte">Nhiều nhất</option><option value="eq">Đúng bằng</option>
          </select></Field>
          <Field label="Số lượng"><input type="number" required min={0} step={1} max={1e12} className={input} value={form.target} onChange={event => update('target', event.target.value)} /></Field>
        </div>
      </> : <p className="vault-meta">Tiêu chí này có quy tắc nâng cao. Quy tắc hiện tại sẽ được giữ khi lưu thông tin chung.</p>}
    </>}
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.is_required} onChange={event => update('is_required', event.target.checked)} /> Bắt buộc</label>
    <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={onCancel}>Hủy</button><button className={button}>Lưu {isGroup ? 'nhóm' : 'tiêu chí'}</button></div>
  </form>;
}

function Editor({ doc, versionId, catalog, refresh, action, confirmAction }) {
  const [version, setVersion] = useState(null);
  const [source, setSource] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [configuration, setConfiguration] = useState(null);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

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
  const citations = [...new Map(items(version.criteria).flatMap(criterion => items(criterion.provenance?.citations))
    .filter(citation => typeof citation?.label === 'string' && /^https?:[/][/]/i.test(citation.url))
    .map(citation => [citation.url, citation])).values()];
  const legalNotes = [...new Set(items(version.criteria).filter(criterion => criterion.provenance?.citations?.length)
    .map(criterion => criterion.provenance.note).filter(Boolean))];
  const run = (fn, msg) => action(async () => { await fn(); await load(); await refresh(); }, msg);

  async function download() {
    const blob = await api(`/regulations/versions/${versionId}/source/download`, 'GET', undefined, { responseType: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = source?.originalFilename || 'quy-che.pdf';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function openPreview() {
    setPreview({ loading: true });
    try {
      if (source.mimeType === 'application/pdf') {
        const blob = await api('/regulations/versions/' + versionId + '/source/download', 'GET', undefined, { responseType: 'blob' });
        setPreview({ url: URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })) });
      } else {
        const payload = await api('/regulations/versions/' + versionId + '/source/preview');
        setPreview({ text: payload.text });
      }
    } catch (error) {
      setPreview({ error: error.message || 'Không thể xem trước tài liệu.' });
    }
  }

  return (
    <div className="space-y-6">
      {draft && <div className="regulation-draft-banner">
        <div><strong>Đang xem bản nháp {version.version_label}</strong><p>Bước 2/2 · Thiết lập tiêu chí. Bản nháp chưa có hiệu lực đối chiếu.</p></div>
        {doc.can_publish && <button type="button" className={button} disabled={!version.criteria?.length} onClick={() => confirmAction({
          title: 'Công bố phiên bản',
          detail: doc.name + ' · ' + version.version_label + ' · Hiệu lực từ ' + formatDate(version.effective_from),
          impact: 'Nội dung phiên bản sẽ bị khóa sau khi công bố.',
          run: () => run(() => api('/regulations/versions/' + versionId + '/publish', 'POST', {}), 'Đã công bố phiên bản.'),
        })}><ShieldCheck size={16} /> Công bố phiên bản này</button>}
      </div>}
      <div className="regulation-detail-columns">
      {/* Thông tin nguồn & Tệp đính kèm */}
      <div className={panel + " space-y-3"}>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <FileText size={14} className="text-teal-600" />
          <span>Văn bản nguồn & Tài liệu căn cứ</span>
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <p><span className="text-slate-400">Nguồn ban hành:</span> <strong>{version.source_title || 'Chưa cập nhật'}</strong></p>
          <p><span className="text-slate-400">Cơ quan:</span> <strong>{version.issuing_authority || 'Chưa cập nhật'}</strong></p>
          <p><span className="text-slate-400">Đối tượng:</span> <strong>{version.applicability?.person_types?.map(type => ({ STUDENT: 'Sinh viên', LECTURER: 'Giảng viên', STAFF: 'Nhân viên', OTHER: 'Khác' })[type] || type).join(', ') || 'Tất cả đối tượng'}</strong></p>
          <p><span className="text-slate-400">Hình thức:</span> <strong>{({ OFFICIAL: 'Chính thức', DEMO: 'Tiêu chí mẫu', MANUAL: 'Tự đặt' })[version.source_kind] || 'Chưa cập nhật'}</strong></p>
        </div>

        {citations.length > 0 && <ul className="divide-y divide-slate-200 dark:divide-slate-700" aria-label="Văn bản căn cứ">
          {citations.map(citation => <li key={citation.url}>
            <a className="flex min-h-11 items-center text-sm font-medium underline underline-offset-4" href={citation.url} target="_blank" rel="noreferrer">{citation.label}</a>
          </li>)}
        </ul>}
        {legalNotes.length > 0 && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <h3 className="font-semibold">Lưu ý khi xét tặng</h3>
          {legalNotes.map(note => <p key={note}>{note}</p>)}
        </div>}
        {Object.entries(version.coverage || {}).some(([, list]) => list?.length > 0) && <div className="space-y-2">
          <h4 className="font-semibold">Ghi chú điều khoản</h4>
          {Object.entries(version.coverage).map(([key, list]) => list?.length > 0 && <p className="vault-meta" key={key}>{({ automated: 'Tự động', manual: 'Xét thủ công', unsupported: 'Chưa hỗ trợ' })[key]}: {list.join(', ')}</p>)}
        </div>}
        {source ? (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mt-2">
            <button type="button" disabled={preview?.loading} className="min-h-11 min-w-0 text-left text-sm font-semibold text-teal-800 underline dark:text-teal-300 flex items-center gap-2" onClick={openPreview}>
              <FileText size={15} className="text-teal-600 shrink-0" />
              <span className="break-all">{source.originalFilename} ({(source.byteSize / 1024 / 1024).toFixed(2)} MB)</span>
            </button>
            <button type="button" className="soft-btn-secondary text-xs py-1 px-3 inline-flex items-center gap-1" onClick={() => action(download)}>
              <FileDown size={14} /> Tải văn bản
            </button>
          </div>
        ) : !citations.length && (
          <p className="text-xs text-slate-400 italic">Chưa đính kèm tệp văn bản PDF/DOCX cho phiên bản này.</p>
        )}
      </div>

      <VaultModal open={!!preview} title={source?.originalFilename || 'Xem trước văn bản'} maxWidth="max-w-4xl"
        onClose={() => { if (!preview?.loading) setPreview(null); }}>
        {preview?.loading && <p role="status">Đang tải bản xem trước…</p>}
        {preview?.error && <p role="alert" className="mb-3 text-rose-700 dark:text-rose-300">{preview.error}</p>}
        {preview?.url && <iframe title="Xem trước văn bản PDF" src={preview.url} className="h-[64dvh] w-full rounded-lg border" />}
        {preview?.text && <><p className="vault-meta mb-3">Bản văn xem nhanh từ tệp DOCX.</p><p className="whitespace-pre-wrap break-words text-sm">{preview.text}</p></>}
        {source && <button type="button" className={secondary + ' mt-3'} onClick={() => action(download)}>Tải văn bản gốc</button>}
      </VaultModal>

      <section className={panel + ' space-y-4 min-w-0'}>
        <div>
          <h2 className="text-lg font-bold">Danh mục tiêu chí xét duyệt</h2>
          <p className="vault-meta">{version.criteria?.length || 0} tiêu chí · {version.criteria?.filter(criterion => criterion.is_required).length || 0} bắt buộc
            · {version.criteria?.filter(criterion => !criterion.is_required).length || 0} tùy chọn
            · {version.aggregation?.require_ungrouped && version.aggregation.operator === 'OR' ? 'Đạt điều kiện chung và ít nhất một nhóm' : formatRegulationOperator(version.aggregation?.operator)}</p>
        </div>
        {editable && <div className="flex flex-wrap gap-2">
          <button type="button" className={secondary} onClick={() => setConfiguration({ kind: 'groups' })}><Plus size={16} /> Thêm nhóm</button>
          <button type="button" className={button} onClick={() => setConfiguration({ kind: 'criteria' })}><Plus size={16} /> Thêm tiêu chí</button>
        </div>}
        {configuration && editable && <RegulationCriterionForm key={configuration.kind + ':' + (configuration.item?.id || 'new')}
          kind={configuration.kind} item={configuration.item} catalog={catalog} groups={items(version.groups)}
          onCancel={() => setConfiguration(null)} onSave={async data => {
            const { kind, item } = configuration;
            const saved = await run(() => api(item ? '/regulations/' + kind + '/' + item.id : '/regulations/versions/' + versionId + '/' + kind, item ? 'PATCH' : 'POST', data), 'Đã lưu cấu hình.');
            if (saved) setConfiguration(null);
          }} />}
        {!version.criteria?.length && (!editable || !version.groups?.length) ? (
          <p className="text-xs text-slate-400 italic p-4 text-center border border-dashed border-slate-200 rounded-xl">
            Phiên bản này chưa có tiêu chí nào.
          </p>
        ) : (
          <div className="space-y-3">
            {[{ id: null, title: version.aggregation?.require_ungrouped ? 'Điều kiện bắt buộc chung' : null }, ...items(version.groups)].map((group, index) => {
              const criteria = items(version.criteria).filter(c => String(c.criterion_group_id ?? '') === String(group.id ?? ''));
              if (!criteria.length && (!editable || !group.id)) return null;
              return <Fragment key={group.id ?? 'ungrouped'}>
                {index > 1 && group.is_required && items(version.groups).slice(0, index - 1).some(previous =>
                  previous.is_required && (editable || items(version.criteria).some(c => String(c.criterion_group_id) === String(previous.id)))) &&
                  version.aggregation?.operator === 'OR' && <div className="flex items-center gap-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span className="h-px flex-1 bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
                    <span className="rounded-full border border-slate-300 px-2.5 py-0.5 dark:border-slate-600">HOẶC</span>
                    <span className="h-px flex-1 bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
                  </div>}
                <section className={group.id ? 'space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/45 sm:p-4' : 'space-y-3'}>
                {group.title && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
                  <div><h3 className="font-semibold">{group.title}</h3>
                    {group.id && <p className="vault-meta">{formatRegulationOperator(group.operator)}{!group.is_required && ' · Nhóm tùy chọn'}</p>}
                  </div>
                  {editable && group.id && <button type="button" className={secondary} onClick={() => setConfiguration({ kind: 'groups', item: group })}>Sửa nhóm</button>}
                </div>}
                {criteria.map(c => (
                  <div key={c.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold">{c.title}</h4>
                        <p className="vault-meta mt-0.5">{c.source_reference}</p>
                      </div>
                      <p className="vault-meta">{c.is_exclusion ? 'Loại trừ' : c.is_required ? 'Bắt buộc' : 'Tùy chọn'}</p>
                    </div>
                    {c.description && <p className="text-sm">{c.description}</p>}
                    <div className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900 dark:bg-teal-950/30 dark:text-teal-200">
                      <RegulationRuleDescription rule={c.rule} catalog={catalog} coverageStatus={c.coverage_status} />
                    </div>
                    {c.provenance?.source_quote && <details className="text-sm">
                      <summary className="min-h-11 cursor-pointer py-3 font-medium">Xem trích dẫn</summary>
                      <blockquote className="border-l-2 pl-3">{c.provenance.source_quote}</blockquote>
                    </details>}
                    {c.provenance?.note && !legalNotes.includes(c.provenance.note) && <p className="vault-meta">{c.provenance.note}</p>}
                    {editable && <button type="button" className={secondary} onClick={() => setConfiguration({ kind: 'criteria', item: c })}>Sửa tiêu chí</button>}
                  </div>
                ))}
                </section>
              </Fragment>;
            })}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

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
  const [confirmation, setConfirmation] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('applicable');
  const [unitFilter, setUnitFilter] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Selected inspection document
  const { regulationId: selected } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [sharingOpen, setSharingOpen] = useState(false);
  function setVersion(id) {
    const next = new URLSearchParams(params);
    if (id) next.set('version', id); else next.delete('version');
    setParams(next, { replace: true });
  }
  function closeInspector() { navigate('/regulations'); }
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [newDoc, setNewDoc] = useState({ code: '', name: '', owner_organization_id: '' });
  const [adoptOrg, setAdoptOrg] = useState('');
  const [recipientOrg, setRecipientOrg] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  const reload = useCallback(async () => {
    const [d, c, s, o, p, cat] = await Promise.all([
      selected ? api('/regulations/documents/' + selected).then(doc => [doc]) : allDocuments(),
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
  }, [selected]);

  const action = useCallback(async (fn, msg) => {
    setBusy(n => n + 1);
    try {
      setError(null);
      setMessage('');
      await fn();
      if (msg) setMessage(msg);
      return true;
    } catch (err) {
      setError(err);
      return false;
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

  const permits = (id, permission) => hasRole('SYSTEM_ADMIN') ||
    (profile.orgGrants || []).some(g => g.permission_code === permission && Number(g.organization_id) === Number(id));

  const name = id => orgs.find(o => Number(o.id) === Number(id))?.name || `Tổ chức #${id}`;

  const relevantOrganizations = new Set((profile.memberships || []).map(m => Number(m.organization_id)));
  for (const grant of profile.orgGrants || []) {
    relevantOrganizations.add(Number(grant.organization_id));
    if (grant.include_descendants) {
      for (const candidate of orgs) {
        let cursor = candidate;
        const seen = new Set();
        while (cursor && !seen.has(cursor.id)) {
          seen.add(cursor.id);
          if (Number(cursor.id) === Number(grant.organization_id)) { relevantOrganizations.add(Number(candidate.id)); break; }
          cursor = orgs.find(org => Number(org.id) === Number(cursor.parent_id));
        }
      }
    }
  }
  for (const memberId of [...relevantOrganizations]) {
    let cursor = orgs.find(org => Number(org.id) === memberId);
    const seen = new Set();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id); relevantOrganizations.add(Number(cursor.id));
      cursor = orgs.find(org => Number(org.id) === Number(cursor.parent_id));
    }
  }
  const schoolIds = new Set(orgs.filter(org => org.organization_type === 'UNIVERSITY' && relevantOrganizations.has(Number(org.id))).map(org => Number(org.id)));
  const unitOrganizations = orgs.filter(org => org.organization_type !== 'UNIVERSITY' && (hasRole('SYSTEM_ADMIN') || relevantOrganizations.has(Number(org.id))));
  const schoolDocs = docs.filter(doc => doc.owner_type === 'ORGANIZATION' && (hasRole('SYSTEM_ADMIN') || schoolIds.has(Number(doc.owner_organization_id))) && orgs.some(org => Number(org.id) === Number(doc.owner_organization_id) && org.organization_type === 'UNIVERSITY'));
  const unitDocs = docs.filter(doc => doc.owner_type === 'ORGANIZATION' && unitOrganizations.some(org => Number(org.id) === Number(doc.owner_organization_id)));
  const personalDocs = docs.filter(doc => doc.owner_type === 'PERSONAL' && (doc.can_manage || doc.can_publish));
  const unitCount = org => unitDocs.filter(doc => Number(doc.owner_organization_id) === Number(org.id)).length;

  const manageable = (tab === 'school' ? schoolDocs : tab === 'unit' ? unitDocs : personalDocs)
    .filter(doc => tab !== 'unit' || !unitFilter || Number(doc.owner_organization_id) === Number(unitFilter));

  const publicDocs = docs.filter(d => d.is_public && d.versions?.some(v => v.publication_status === 'PUBLISHED'));
  const internalDocs = docs.filter(d => !d.is_public && d.owner_type === 'ORGANIZATION' && d.versions?.some(v => v.publication_status === 'PUBLISHED'));
  const discoverableDocs = tab === 'internal' ? internalDocs : publicDocs;
  const categoryLabels = { nckh: 'Nghiên cứu', teaching: 'Giảng dạy', award: 'Thi đua', other: 'Khác' };
  const activeContexts = [...new Map([
    ...contexts,
    ...docs.filter(doc => doc.owner_type === 'ORGANIZATION' && relevantOrganizations.has(Number(doc.owner_organization_id)) && (doc.can_manage || doc.can_publish || doc.can_share))
      .flatMap(doc => (doc.versions || []).filter(version => version.publication_status === 'PUBLISHED' && date(version.effective_from) <= new Date().toISOString().slice(0,10) && (!version.effective_to || date(version.effective_to) >= new Date().toISOString().slice(0,10)))
      .map(version => ({...version,regulation_id:doc.id,regulation_version_id:version.id,name:doc.name,code:doc.code,organization_id:doc.owner_organization_id,context_type:'ORGANIZATION'}))),
  ].map(context => [context.regulation_version_id, context])).values()];
  const selectedDoc = docs.find(d => Number(d.id) === Number(selected));
  const selectedVersion = selectedDoc?.versions?.find(v => String(v.id) === params.get('version')) || selectedDoc?.versions?.[0];
  const version = selectedVersion ? String(selectedVersion.id) : '';
  const personalApplied = contexts.some(c => ['PERSONAL', 'OWNER'].includes(c.context_type) && String(c.regulation_version_id) === version);
  const acceptedPersonalShare = shares.some(share => share.status === 'ACCEPTED' && !share.recipient_organization_id
    && share.can_respond && String(share.regulation_version_id) === version);
  const adoptionOrganizations = selectedDoc && selectedVersion?.publication_status === 'PUBLISHED'
    ? orgs.filter(org => (selectedDoc.is_public || Number(org.id) === Number(selectedDoc.owner_organization_id)) &&
      (hasRole('SYSTEM_ADMIN') || (profile.orgGrants || []).some(grant => Number(grant.organization_id) === Number(org.id)
        && ['REGULATIONS_ADOPT', 'REGULATIONS_UPDATE'].includes(grant.permission_code))))
    : [];
  const canApplyPersonal = selectedVersion?.publication_status === 'PUBLISHED'
    && (personalApplied || selectedDoc?.is_public || acceptedPersonalShare || (selectedDoc?.owner_type === 'PERSONAL' && selectedDoc.can_manage));
  const personalOrganizationIds = new Set();
  for (const membership of profile.memberships || []) {
    let org = orgs.find(o => Number(o.id) === Number(membership.organization_id));
    while (org && !personalOrganizationIds.has(Number(org.id))) {
      personalOrganizationIds.add(Number(org.id));
      org = orgs.find(o => Number(o.id) === Number(org.parent_id));
    }
  }

  function openInspector(docId, vId) {
    navigate('/regulations/' + docId + (vId ? '?version=' + vId : ''));
  }

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
        <span>Đối chiếu quy chế</span>
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
    <main className="vault-page" data-page={selected ? 'Chi tiết quy chế' : 'Kho quy chế'}>
      {!selected && (
      <header className="vault-page-header">
        <div>
          <h1>Kho quy chế</h1>
          <p className="vault-page-description">Tra cứu, tiếp nhận và quản lý các quy chế đánh giá thành tích tại trường.</p>
        </div>
        <div className="vault-page-actions">
          {pageActions}
        </div>
      </header>)}

      <fieldset disabled={busy > 0} aria-busy={busy > 0} className="vault-content min-w-0 border-0 p-0">
        <Notice error={error} message={message} />

        {!selected && <section className={panel}>
          {/* Tabs chính */}
          <div className="vault-list-heading pb-3 border-b border-slate-100 dark:border-slate-800">
            <VaultTabs label="Phạm vi quy chế" value={tab} onChange={value => { setTab(value); }}
              items={[
                ['applicable', 'Đang áp dụng (' + activeContexts.length + ')'],
                ['school', 'Trường (' + schoolDocs.length + ')'],
                ['unit', 'Khoa (' + unitDocs.length + ')'],
                ['personal', 'Cá nhân (' + personalDocs.length + ')'],
              ]} />
          </div>

          {/* Ô tìm kiếm & Bộ lọc Danh mục */}
          {tab !== 'shares' && (
            <div className="regulation-filters">
              <div className="min-w-0">
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
                  ['nckh', 'Nghiên cứu'],
                  ['teaching', 'Giảng dạy'],
                  ['award', 'Thi đua'],
                  ['other', 'Khác']
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

          {tab === 'unit' && <div className="vault-task-section">
            {unitOrganizations.length === 1 ? <p className="text-sm">Đơn vị trực thuộc: <strong>{unitOrganizations[0].name}</strong></p> : unitOrganizations.length < 10 ? (
              <div className="flex flex-wrap gap-2">{[{id:'',name:'Tất cả'}, ...unitOrganizations].map(org => <button key={org.id} type="button" className={String(unitFilter) === String(org.id) ? button : secondary} onClick={() => setUnitFilter(String(org.id))}>{org.name} ({org.id ? unitCount(org) : unitDocs.length})</button>)}</div>
            ) : <div className="space-y-3">
              <Field label="Tìm khoa / phòng ban"><input className={input} type="search" value={unitSearch} onChange={event => setUnitSearch(event.target.value)} placeholder="Nhập tên khoa / phòng ban" /></Field>
              <Field label="Chọn khoa / phòng ban"><select className={input} value={unitFilter} onChange={event => setUnitFilter(event.target.value)}><option value="">Tất cả ({unitDocs.length})</option>{unitOrganizations.filter(org => String(org.id) === unitFilter || org.name.toLocaleLowerCase('vi').includes(unitSearch.toLocaleLowerCase('vi'))).map(org => <option key={org.id} value={org.id}>{org.name} ({unitCount(org)})</option>)}</select></Field>
            </div>}
          </div>}
          {!loading && <div className="vault-summary mb-4" role="status">
            <span>{(tab === 'applicable' ? activeContexts : manageable).filter(matches).filter(matchesCategory).length} kết quả</span>
            {(search || categoryFilter !== 'all' || (tab === 'unit' && unitFilter)) && <button type="button" className={secondary}
              onClick={() => { setSearch(''); setCategoryFilter('all'); setUnitFilter(''); setUnitSearch(''); }}>Xóa bộ lọc</button>}
          </div>}
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-xs font-semibold text-slate-500">Đang tải kho quy chế…</p>
            </div>
          ) : (
            <>
              {/* TAB 1: ĐANG ÁP DỤNG */}
              {tab === 'applicable' && (
                !activeContexts.filter(matches).filter(matchesCategory).length ? (
                  <p className="p-8 text-center text-xs text-slate-500">
                    Chưa có quy chế nào phù hợp với bộ lọc. Bạn có thể mở tab Trường, Khoa hoặc Cá nhân để chọn quy chế.
                  </p>
                ) : (
                  <div className="regulation-card-grid">
                    {activeContexts.filter(matches).filter(matchesCategory).map((c, i) => {
                      const criterionCount = docs.find(doc => String(doc.id) === String(c.regulation_id))?.versions?.find(version => String(version.id) === String(c.regulation_version_id))?.criterion_count;
                      const expired = c.effective_to && date(c.effective_to) < new Date().toISOString().slice(0, 10);
                      return (
                        <article 
                          key={`${c.adoption_id}-${c.regulation_version_id}-${c.member_organization_id}-${i}`} 
                          className="vault-regulation-card"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="vault-regulation-code">{c.code}</span>
                            <span className="vault-meta">{c.context_type === 'ORGANIZATION' ? categoryLabels[categorize(c)] : 'Cá nhân'}</span>
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
                              <span>Hiệu lực: {formatDate(c.effective_from)} {c.effective_to ? `đến ${formatDate(c.effective_to)}` : '(không giới hạn)'}</span>
                            </p>
                          </div>

                          {c.update_available && (
                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                              <span>Có phiên bản mới: <strong>{c.latest_version_label}</strong></span>
                              <button 
                                type="button"
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shrink-0"
                                onClick={async () => {
                                  const preview = {
                                    title: 'Cập nhật phiên bản',
                                    detail: c.name + ' · ' + c.version_label + ' → ' + c.latest_version_label,
                                    impact: 'Phiên bản mới sẽ thay phiên bản đang áp dụng cho ' + (c.context_type === 'ORGANIZATION' ? name(c.organization_id) : 'hồ sơ cá nhân của bạn') + '.',
                                    run: () => action(async () => {
                                      await api('/regulations/versions/' + c.latest_version_id + '/adopt', 'POST', c.context_type === 'ORGANIZATION' ? { organization_id: Number(c.organization_id) } : {});
                                      await reload();
                                    }, 'Đã cập nhật phiên bản.'),
                                  };
                                  setError(null);
                                  setConfirmation({ ...preview, loading: true });
                                  try {
                                    const [prior, next] = await Promise.all([
                                      api('/regulations/versions/' + c.regulation_version_id),
                                      api('/regulations/versions/' + c.latest_version_id),
                                    ]);
                                    const before = new Map(items(prior.criteria).map(rule => [rule.code, rule]));
                                    const after = new Map(items(next.criteria).map(rule => [rule.code, rule]));
                                    const compare = rule => JSON.stringify([rule.title, rule.description, rule.source_reference, Boolean(rule.is_required), Boolean(rule.is_exclusion), rule.rule]);
                                    const changes = [
                                      ...[...after.values()].filter(rule => !before.has(rule.code)).map(rule => 'Thêm: ' + rule.title),
                                      ...[...before.values()].filter(rule => !after.has(rule.code)).map(rule => 'Bỏ: ' + rule.title),
                                      ...[...after.values()].filter(rule => before.has(rule.code) && compare(rule) !== compare(before.get(rule.code))).map(rule => 'Sửa: ' + rule.title),
                                    ];
                                    setConfirmation(current => current?.run === preview.run
                                      ? { ...preview, changes, effectiveFrom: formatDate(next.effective_from) } : current);
                                  } catch {
                                    setConfirmation(current => current?.run === preview.run
                                      ? { ...preview, previewError: true } : current);
                                  }
                                }}
                              >
                                Xem cập nhật
                              </button>
                            </div>
                          )}

                          <div className="vault-card-actions regulation-card-footer">
                            {criterionCount != null && <span className="vault-meta">{criterionCount} tiêu chí</span>}
                            <button 
                              type="button"
                              className="regulation-detail-link"
                              onClick={() => openInspector(c.regulation_id, c.regulation_version_id)}
                            >
                              <Eye size={14} />
                              <span>Chi tiết →</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )
              )}

              {/* TAB 2: TÔI QUẢN LÝ */}
              {['school','unit','personal'].includes(tab) && (
                !manageable.filter(matches).filter(matchesCategory).length ? (
                  <p className="p-8 text-center text-xs text-slate-500">Không tìm thấy quy chế phù hợp trong danh mục quản lý của bạn. Hãy chọn danh mục khác hoặc nhấn “Tạo quy chế”.</p>
                ) : (
                  <div className="regulation-card-grid">
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
                            <span>Xem chi tiết</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              )}

              {/* TAB 3: CỘNG ĐỒNG */}
              {['public', 'internal'].includes(tab) && (
                !discoverableDocs.filter(matches).filter(matchesCategory).length ? (
                  <p className="p-8 text-center text-xs text-slate-500">Không tìm thấy quy chế phù hợp.</p>
                ) : (
                  <div className="regulation-card-grid">
                    {discoverableDocs.filter(matches).filter(matchesCategory).map(d => (
                      <article key={d.id} className="vault-regulation-card">
                        <span className="vault-regulation-code">{d.code}</span>
                        <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{d.name}</h3>
                        <p className="text-xs text-slate-500">Ban hành bởi: <strong>{d.owner_type === 'PERSONAL' ? 'Cá nhân' : name(d.owner_organization_id)}</strong></p>
                        
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

              {tab === 'personal' && shares.length > 0 && [
                ['received', 'Chia sẻ đã nhận', shares.filter(share => share.can_respond)],
                ['sent', 'Chia sẻ đã gửi', shares.filter(share => share.can_revoke)],
              ].map(([direction, title, group]) => group.length > 0 && (
                <section key={direction} className="vault-task-section mt-4">
                  <h3>{title}</h3>
                  <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {group.map(share => (
                      <li key={share.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div>
                          <strong>{share.name} · {share.version_label}</strong>
                          <p className="vault-meta">{share.recipient_name ? 'Bên nhận: ' + share.recipient_name + ' · ' : ''}{({ PENDING: 'Đang chờ', ACCEPTED: 'Đã tiếp nhận', REJECTED: 'Đã từ chối', REVOKED: 'Đã thu hồi' })[share.status] || share.status}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={secondary} onClick={() => openInspector(share.regulation_id, share.regulation_version_id)} disabled={!docs.some(doc => Number(doc.id) === Number(share.regulation_id))}>Xem quy chế</button>
                          {share.status === 'PENDING' && direction === 'sent' && (
                            <button type="button" className={secondary} onClick={() => setConfirmation({
                              title: 'Thu hồi lời chia sẻ', detail: share.name + ' · ' + share.version_label,
                              impact: 'Bên nhận sẽ không còn có thể tiếp nhận lời chia sẻ này.',
                              run: () => action(async () => { await api('/regulations/shares/' + share.id + '/revoke', 'POST', {}); await reload(); }, 'Đã thu hồi lời chia sẻ.'),
                            })}>Thu hồi chia sẻ</button>
                          )}
                          {share.status === 'PENDING' && direction === 'received' && [true, false].map(accept => (
                            <button key={String(accept)} type="button" className={accept ? button : secondary} onClick={() => action(async () => {
                              await api('/regulations/shares/' + share.id + '/respond', 'POST', { accept });
                              await reload();
                            }, accept ? 'Đã chấp nhận chia sẻ.' : 'Đã từ chối chia sẻ.')}>{accept ? 'Chấp nhận chia sẻ' : 'Từ chối chia sẻ'}</button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </section>}

        {selected && loading && <p role="status">Đang tải quy chế…</p>}
        {selected && !loading && !selectedDoc && <Link className={secondary} to="/regulations">Về Kho quy chế</Link>}
        {selectedDoc && <div className="space-y-4">
          <Link className="min-h-11 inline-flex items-center text-teal-800 underline dark:text-teal-300" to="/regulations">← Quay lại Kho quy chế</Link>
          <header className="vault-page-header">
            <div><h1>{selectedDoc.name}</h1><p className="vault-meta">{selectedDoc.code} · Chủ sở hữu: {selectedDoc.owner_type === 'PERSONAL' ? 'Cá nhân' : name(selectedDoc.owner_organization_id)}</p></div>
            <div className="vault-page-actions">
              {canApplyPersonal && <button type="button" aria-pressed={personalApplied} className={personalApplied ? 'soft-btn-secondary regulation-applied' : secondary}
                disabled={Boolean(busy)} onClick={() => action(async () => {
                  await api('/regulations/versions/' + version + '/adopt', personalApplied ? 'DELETE' : 'POST', personalApplied ? undefined : {});
                  await reload();
                }, personalApplied ? 'Đã bỏ áp dụng cho hồ sơ cá nhân.' : 'Đã áp dụng cho hồ sơ cá nhân.')}>
                {personalApplied && <Check size={16} aria-hidden="true" />}
                {personalApplied ? 'Đang áp dụng cho tôi' : 'Áp dụng cho hồ sơ cá nhân'}
              </button>}
              {(selectedDoc.can_share || adoptionOrganizations.length > 0) &&
                <button type="button" className={secondary} onClick={() => setSharingOpen(true)}><Share2 size={16} /> Chia sẻ & Phạm vi</button>}
            </div>
          </header>
              {/* Chọn phiên bản & Nút tạo bản nháp */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-end justify-between gap-3">
                <div className="flex-1 min-w-[220px]">
                  <Field label="Chọn phiên bản quy chế">
                    <select className={input} value={version} onChange={e => setVersion(e.target.value)}>
                      <option value="">Chọn phiên bản...</option>
                      {(selectedDoc.versions || []).map(v => (
                        <option key={v.id} value={v.id}>
                          {v.version_label} · {v.publication_status === 'DRAFT' ? 'Bản nháp' : 'Đã công bố'}{v.effective_from && ' · Hiệu lực từ ' + formatDate(v.effective_from)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="vault-meta mt-1">Đổi phiên bản được xem. Phiên bản đang áp dụng chỉ thay đổi khi bạn chọn áp dụng.</p>
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

              {selectedDoc.can_manage && (selectedVersion?.publication_status === 'DRAFT' || selectedDoc.versions?.length === 0) && (
                <button type="button" className="soft-btn-danger" disabled={Boolean(busy)} onClick={() => {
                  const draft = selectedVersion?.publication_status === 'DRAFT' ? selectedVersion : null;
                  const documentId = selectedDoc.id;
                  setError(null);
                  setConfirmation({
                    danger: true,
                    title: draft ? 'Xóa bản nháp' : 'Xóa văn bản quy chế',
                    detail: draft ? selectedDoc.name + ' · ' + draft.version_label : selectedDoc.name,
                    impact: draft
                      ? 'Bản nháp, tiêu chí và tài liệu đính kèm sẽ không còn truy cập được. Thao tác này không thể hoàn tác.'
                      : 'Văn bản chưa có phiên bản sẽ bị xóa. Thao tác này không thể hoàn tác.',
                    run: () => action(async () => {
                      if (draft) {
                        await api('/regulations/versions/' + draft.id, 'DELETE');
                        const remaining = selectedDoc.versions.filter(item => String(item.id) !== String(draft.id));
                        setDocs(current => current.map(doc => String(doc.id) === String(documentId)
                          ? { ...doc, versions: doc.versions.filter(item => String(item.id) !== String(draft.id)) } : doc));
                        setVersion(remaining.length ? String(remaining[0].id) : '');
                      } else {
                        await api('/regulations/documents/' + documentId, 'DELETE');
                        setDocs(current => current.filter(doc => String(doc.id) !== String(documentId)));
                        closeInspector();
                      }
                    }, draft ? 'Đã xóa bản nháp.' : 'Đã xóa văn bản quy chế.'),
                  });
                }}>{selectedVersion?.publication_status === 'DRAFT' ? 'Xóa bản nháp' : 'Xóa văn bản quy chế'}</button>
              )}

              {version ? (
                <Editor 
                  key={version} 
                  doc={selectedDoc} 
                  versionId={version} 
                  catalog={catalog} 
                  refresh={reload} 
                  action={action}
                  confirmAction={setConfirmation}
                />
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Chọn phiên bản để xem nhóm và tiêu chí.
                </div>
              )}

          <VaultModal open={sharingOpen} onClose={() => { if (!busy) setSharingOpen(false); }} title="Chia sẻ & Phạm vi">
            <div className="space-y-4">
              <Notice error={error} message={message} />
              {selectedDoc.can_share && (
                <section className="vault-task-section"><h3>Phạm vi truy cập</h3><div className="flex flex-wrap gap-3">
                  <button className={secondary} disabled={Boolean(busy)} onClick={() => setConfirmation({
                    title: selectedDoc.is_public ? 'Tắt công khai' : 'Bật công khai',
                    detail: selectedDoc.name,
                    impact: selectedDoc.is_public ? 'Quy chế sẽ rời danh mục công khai.' : 'Người dùng có thể tìm thấy quy chế trong danh mục công khai.',
                    run: () => action(async () => {
                      await api('/regulations/documents/' + selectedDoc.id + '/distribution', 'PATCH', { is_public: !selectedDoc.is_public });
                      await reload();
                    }, 'Đã cập nhật phạm vi công khai.'),
                  })}>{selectedDoc.is_public ? 'Tắt công khai' : 'Bật công khai'}</button>
                  {selectedDoc.owner_type === 'ORGANIZATION' && (
                    <button className={secondary} disabled={Boolean(busy)} onClick={() => action(async () => {
                      await api(`/regulations/documents/${selectedDoc.id}/distribution`, 'PATCH', { is_internal: !selectedDoc.is_internal });
                      await reload();
                    })}>{selectedDoc.is_internal ? 'Tắt chia sẻ nội bộ' : 'Bật chia sẻ nội bộ'}</button>
                  )}
                </div></section>
              )}
              {selectedVersion?.publication_status === 'PUBLISHED' && selectedDoc.can_share && (
                <form className="vault-task-section flex flex-wrap items-end gap-3" onSubmit={e => {
                  e.preventDefault();
                  action(async () => {
                    const target = recipientOrg ? { recipient_organization_id: Number(recipientOrg) } : { recipient_email: recipientEmail.trim() };
                    await api(`/regulations/versions/${version}/shares`, 'POST', target);
                    setRecipientOrg('');
                    setRecipientEmail('');
                    await reload();
                  }, 'Đã gửi lời chia sẻ.');
                }}>
                  <h3 className="w-full">Chia sẻ phiên bản</h3>
                  <Field label="Tổ chức nhận">
                    <select className={input} value={recipientOrg} onChange={e => { setRecipientOrg(e.target.value); setRecipientEmail(''); }}>
                      <option value="">Chọn tổ chức</option>
                      {orgs.filter(o => selectedDoc.owner_type === 'PERSONAL' ? personalOrganizationIds.has(Number(o.id)) : Number(o.id) !== Number(selectedDoc.owner_organization_id)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Hoặc email người nhận">
                    <input className={input} type="email" value={recipientEmail} onChange={e => { setRecipientEmail(e.target.value); setRecipientOrg(''); }} />
                  </Field>
                  <button className={button} disabled={Boolean(busy) || (!recipientOrg && !recipientEmail.trim())}>Chia sẻ phiên bản</button>
                </form>
              )}
              {adoptionOrganizations.length > 0 && (
                <form className="vault-task-section flex flex-wrap items-end gap-3" onSubmit={e => {
                  e.preventDefault();
                  setConfirmation({
                    title: 'Áp dụng phiên bản',
                    detail: selectedDoc.name + ' · ' + selectedVersion.version_label,
                    impact: 'Áp dụng cho ' + name(adoptOrg) + '. Nếu đơn vị đã áp dụng quy chế này, phiên bản mới sẽ thay phiên bản hiện tại.',
                    run: () => action(async () => {
                      await api('/regulations/versions/' + version + '/adopt', 'POST', { organization_id: Number(adoptOrg) });
                      await reload();
                    }, 'Đã áp dụng phiên bản cho tổ chức.'),
                  });
                }}>
                  <h3 className="w-full">Áp dụng cho tổ chức</h3>
                  <Field label="Tổ chức áp dụng">
                    <select className={input} value={adoptOrg} onChange={e => setAdoptOrg(e.target.value)}>
                      <option value="">Chọn tổ chức</option>
                      {adoptionOrganizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </Field>
                  <button className={button} disabled={!adoptOrg || Boolean(busy)}>Áp dụng cho tổ chức</button>
                </form>
              )}
            </div>
          </VaultModal>
        </div>}
        {/* MODAL: TẠO PHIÊN BẢN NHÁP MỚI */}
        <VaultModal
          open={Boolean(creatingVersion && selectedDoc)}
          onClose={() => setCreatingVersion(false)}
          title={`Tạo phiên bản nháp cho: ${selectedDoc?.name || ''}`}
          subtitle="Tạo bản nháp để chỉnh nội dung trước khi công bố."
          maxWidth="max-w-2xl"
        >
          {creatingVersion && selectedDoc && (
            <VersionForm 
              initial={{}}
              submitLabel="Tạo bản nháp"
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
          onClose={() => { if (!busy) setCreatingDoc(false); }}
          title="Tạo quy chế và bản nháp đầu tiên"
          maxWidth="max-w-4xl"
        >
          {creatingDoc && <VersionForm initial={{ version_label: 'v1.0' }} submitLabel="Tiếp tục thiết lập tiêu chí"
            onCancel={() => setCreatingDoc(false)} onSubmit={first_version => action(async () => {
              const document = await api('/regulations/documents', 'POST', {
                code: newDoc.code, name: newDoc.name, first_version,
                ...(newDoc.owner_organization_id ? { owner_organization_id: Number(newDoc.owner_organization_id) } : {}),
              });
              setNewDoc({ code: '', name: '', owner_organization_id: '' });
              setCreatingDoc(false);
              openInspector(document.id, document.versions[0].id);
            }, 'Đã tạo quy chế và bản nháp đầu tiên.')}>
            <p className="vault-meta">Bước 1/2 · Thông tin chung và phiên bản đầu tiên</p>
            <Notice error={error} />
            <Field label="Mã quy chế * (ví dụ: QC-NCKH-2026)">
              <input required className={input} value={newDoc.code} onChange={e => setNewDoc({ ...newDoc, code: e.target.value })} placeholder="QC-NCKH-2026" />
            </Field>
            <Field label="Tên quy chế *">
              <input required className={input} value={newDoc.name} onChange={e => setNewDoc({ ...newDoc, name: e.target.value })} placeholder="Quy chế Đánh giá Nghiên cứu khoa học..." />
            </Field>
            <Field label="Chủ sở hữu ban hành">
              <select className={input} value={newDoc.owner_organization_id} onChange={e => setNewDoc({ ...newDoc, owner_organization_id: e.target.value })}>
                <option value="">Cá nhân tôi</option>
                {orgs.filter(o => permits(o.id, 'REGULATIONS_CREATE') && permits(o.id, 'REGULATIONS_MANAGE')).map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </Field>
          </VersionForm>}
        </VaultModal>
      </fieldset>
      <VaultModal open={Boolean(confirmation)} title={confirmation?.title || 'Xác nhận'} maxWidth="max-w-lg"
        onClose={event => { if (confirming) event?.preventDefault(); else setConfirmation(null); }}>
        {confirmation && <form className="space-y-4" onSubmit={async event => {
          event.preventDefault();
          setConfirming(true);
          try {
            const ok = await confirmation.run();
            if (ok !== false) setConfirmation(null);
          } finally { setConfirming(false); }
        }}>
          <p><strong>{confirmation.detail}</strong></p>
          <p className="vault-meta">{confirmation.impact}</p>
          {confirmation.loading && <p role="status" className="vault-meta">Đang so sánh tiêu chí…</p>}
          {confirmation.previewError && <p role="status" className="vault-meta">Chưa tải được phần so sánh. Hãy kiểm tra phiên bản mới trước khi áp dụng.</p>}
          {confirmation.changes && <div className="vault-task-section">
            <p>Ngày bắt đầu hiệu lực: {confirmation.effectiveFrom}</p>
            {confirmation.changes.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{confirmation.changes.map((change, index) => <li key={index}>{change}</li>)}</ul> : <p className="vault-meta">Không thấy thay đổi ở các trường tiêu chí được so sánh.</p>}
          </div>}
          <Notice error={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} disabled={confirming} onClick={() => setConfirmation(null)}>Hủy</button>
            <button className={confirmation.danger ? 'soft-btn-danger' : button} disabled={confirming || confirmation.loading}>{confirming ? (confirmation.danger ? 'Đang xóa…' : 'Đang cập nhật…') : confirmation.title}</button>
          </div>
        </form>}
      </VaultModal>
    </main>
  );
}
