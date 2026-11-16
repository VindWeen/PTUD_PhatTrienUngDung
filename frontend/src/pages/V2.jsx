import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { request } from '../services/request';
import { useAuth } from '../context/AuthContext';
import NumberedPagination from '../components/common/NumberedPagination';
import { 
  ArrowRight, FolderOpen, Plus, X, Paperclip, Eye, Pencil, Trash2, 
  BarChart3, Sparkles, UploadCloud, CheckCircle2, AlertCircle, 
  Calendar, Award, FileText, FileArchive, Target, ExternalLink, 
  FileDown, BookOpen, RotateCcw, Check, CheckSquare, Square, 
  Sliders, ChevronDown, ChevronUp, Clock, Network, CornerDownRight, Building2
} from 'lucide-react';

const api = (url, method = 'GET', data, options = {}) => request({ 
  url, 
  method, 
  data, 
  fresh: true, 
  ...(data instanceof FormData ? { headers: { 'Content-Type': undefined } } : {}), 
  ...options 
});

const array = value => Array.isArray(value) ? value : value?.items || [];
const input = 'soft-input w-full';
const button = 'soft-btn-primary';
const secondary = 'soft-btn-secondary';
const panel = 'soft-card p-5 sm:p-6';

async function saveBlob(url, filename, method = 'GET', data) {
  const blob = await api(url, method, data, { responseType: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); 
  link.download = filename; 
  link.click(); 
  URL.revokeObjectURL(link.href);
}

const pageLinks = {
  'Hồ sơ cá nhân': ['/me/cv', 'Thiết kế CV', Sparkles],
  'Kho thành tích': ['/me/ai-forecast', 'Khám hồ sơ AI', Sparkles],
  'Khám hồ sơ': ['/regulations', 'Xem kho quy chế', BookOpen],
  'Mục tiêu / KPI': ['/me/ai-forecast', 'Khám hồ sơ AI', Sparkles],
  'Kho quy chế': ['/me/ai-forecast', 'Khám hồ sơ AI', Sparkles],
  'CV cá nhân': ['/achievements', 'Kho thành tích', Award],
  'Tổng quan cá nhân': ['/achievements', 'Kho thành tích', Award],
};

function Page({ title, description, children, actions }) { 
  const linkInfo = pageLinks[title]; 
  const LinkIcon = linkInfo?.[2] || ArrowRight;

  return (
    <main className="vault-page" data-page={title}>
      <header className="vault-page-header">
        <div>
          <h1>{title}</h1>
          {description && <p className="vault-page-description">{description}</p>}
        </div>
        <div className="vault-page-actions">
          {linkInfo && (
            <Link 
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200/80 hover:bg-teal-100 hover:border-teal-300 transition-all shadow-sm shadow-teal-900/5 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800" 
              to={linkInfo[0]}
            >
              <LinkIcon size={14} className="text-teal-600 dark:text-teal-400" />
              <span>{linkInfo[1]}</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          )}
          {actions}
        </div>
      </header>
      <div className="vault-content">{children}</div>
    </main>
  ); 
}

function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => { 
    const dialog = ref.current; 
    if (open && !dialog.open) dialog.showModal(); 
    else if (!open && dialog.open) dialog.close(); 
  }, [open]);

  return (
    <dialog 
      ref={ref} 
      className="vault-modal" 
      aria-label={title} 
      onCancel={onClose} 
      onClose={onClose} 
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="vault-modal-heading">
        <h2>{title}</h2>
        <button type="button" className={secondary} aria-label="Đóng" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="vault-modal-body">{children}</div>
    </dialog>
  );
}

function Tabs({ items, value, onChange }) { 
  return (
    <div className="vault-tabs" role="tablist">
      {items.map(([key, label]) => (
        <button 
          key={key} 
          type="button" 
          role="tab" 
          aria-selected={value === key} 
          tabIndex={value === key ? 0 : -1} 
          onKeyDown={event => { 
            if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; 
            event.preventDefault(); 
            const index = items.findIndex(([item]) => item === key); 
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length; 
            onChange(items[next][0]); 
            event.currentTarget.parentElement.children[next].focus(); 
          }} 
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  ); 
}

function useCollection(url) {
  const [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => { 
    const current = ++generation.current; 
    setLoading(true); 
    setError(null); 
    try { 
      const rows = []; 
      let page = 1; 
      while (true) { 
        const result = await api(`${url}${url.includes('?') ? '&' : '?'}pageSize=100&page=${page}`); 
        if (current !== generation.current) return; 
        const batch = array(result); 
        rows.push(...batch); 
        if (batch.length < 100 || (result.total != null && rows.length >= result.total)) break; 
        page++; 
      } 
      setData({ items: rows, total: rows.length }); 
    } catch (e) { 
      if (current === generation.current) setError(e); 
    } finally { 
      if (current === generation.current) setLoading(false); 
    } 
  }, [url]);

  useEffect(() => { 
    const counter = generation; 
    reload(); 
    return () => { counter.current++; }; 
  }, [reload]); 

  return { data, error, loading, reload };
}

function ErrorMessage({ error }) { 
  return error ? (
    <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900 text-sm">
      {error.message || String(error)}
    </p>
  ) : null; 
}

function Field({ label, children }) { 
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  ); 
}

function FilePicker({ label, onChange }) {
  const [fileName, setFileName] = useState('');
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <label 
        className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:bg-teal-50/20 rounded-2xl cursor-pointer transition-all bg-slate-50/60 dark:bg-slate-800/40 text-center group"
        onDragOver={event => event.preventDefault()} 
        onDrop={event => { 
          event.preventDefault(); 
          const file = event.dataTransfer.files?.[0]; 
          if (file) { 
            setFileName(file.name); 
            onChange({ target: { files: [file], value: '' } }); 
          } 
        }}
      >
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center text-teal-600 mb-2 group-hover:scale-105 transition-transform">
          <UploadCloud size={20} />
        </div>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {fileName ? (
            <span className="text-teal-700 font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={15} /> {fileName}
            </span>
          ) : (
            'Kéo thả tệp minh chứng vào đây hoặc bấm để chọn tệp'
          )}
        </span>
        <span className="text-[11px] text-slate-400 mt-1">
          Hỗ trợ PDF, DOCX, JPG, PNG (tối đa 15MB) - AI tự động trích xuất thông tin
        </span>
        <input 
          type="file" 
          className="hidden" 
          onChange={event => { 
            setFileName(event.target.files?.[0]?.name || ''); 
            onChange(event); 
          }} 
        />
      </label>
    </div>
  );
}

function Empty({ children, action }) { 
  return (
    <div className="vault-empty">
      <span className="vault-empty-icon">
        <FolderOpen size={24} aria-hidden="true" />
      </span>
      <p>{children}</p>
      {action}
    </div>
  ); 
}

function useLoad(url) {
  const [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => { 
    const current = ++generation.current; 
    setLoading(true); 
    setError(null); 
    try { 
      const value = await api(url); 
      if (current === generation.current) setData(value); 
    } catch (e) { 
      if (current === generation.current) setError(e); 
    } finally { 
      if (current === generation.current) setLoading(false); 
    } 
  }, [url]);

  useEffect(() => { 
    const counter = generation; 
    reload(); 
    return () => { counter.current++; }; 
  }, [reload]);

  return { data, error, loading, reload };
}

function Load({ state, children }) { 
  if (state.loading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-xs font-semibold text-slate-500">Đang tải dữ liệu…</p>
      </div>
    );
  }
  if (state.error) return <ErrorMessage error={state.error} />; 
  return children; 
}

function Item({ children }) { return <div className="vault-item">{children}</div>; }

function DateText({ value }) { return value ? <span>{String(value).slice(0, 10)}</span> : null; }

const conclusionLabel = value => ({ 
  MET: 'Đạt theo hồ sơ', 
  NOT_MET: 'Chưa đạt', 
  INSUFFICIENT_DATA: 'Chưa đủ dữ liệu', 
  NOT_APPLICABLE: 'Không áp dụng' 
}[value] || value);

const displayLabel = value => ({
  PLANNED: 'Đã lên kế hoạch', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
  TODO: 'Cần thực hiện', DONE: 'Hoàn thành', SCHEDULED: 'Đã lên lịch',
  DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố', PENDING: 'Đang chờ phản hồi', ACCEPTED: 'Đã đồng ý', DECLINED: 'Đã từ chối', REVOKED: 'Đã thu hồi', EXPIRED: 'Đã hết hạn',
  ACTIVE: 'Đang hoạt động', DISABLED: 'Đã vô hiệu hóa',
  UNIVERSITY: 'Trường', FACULTY: 'Khoa', DEPARTMENT: 'Bộ môn', CLASS: 'Lớp', COMPANY: 'Doanh nghiệp', TEAM: 'Nhóm', OTHER: 'Khác',
  SYSTEM_ADMIN: 'Quản trị hệ thống', REGULATION_MANAGER: 'Quản lý quy chế',
  Modern: 'Hiện đại', Academic: 'Học thuật', Minimalist: 'Tối giản',
}[value] || conclusionLabel(value));

function StatusBadge({ value }) { 
  return (
    <span className={`vault-status ${['COMPLETED', 'DONE', 'PUBLISHED', 'ACCEPTED', 'ACTIVE', 'MET'].includes(value) ? 'is-positive' : ['CANCELLED', 'DECLINED', 'DISABLED', 'NOT_MET'].includes(value) ? 'is-muted' : ''}`}>
      {displayLabel(value)}
    </span>
  ); 
}

function missingText(details) {
  if (!details) return '';
  if (typeof details === 'string') return details;
  if (details.unknown_attributes) return 'Một số thông tin thành tích còn thiếu; hãy kiểm tra và bổ sung hồ sơ.';
  if (typeof details.remaining === 'number' && details.remaining > 0) return `Còn thiếu ${details.remaining} so với yêu cầu.`;
  return '';
}

function parseRuleJson(value) {
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error('Dữ liệu thuộc tính không hợp lệ. Hãy kiểm tra lại.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Thuộc tính phải là một đối tượng key-value.');
  return parsed;
}

/**
 * Trình nhập thuộc tính bổ sung thân thiện cho người dùng thường, thay thế ô textarea JSON
 */
function AttributeBuilder({ jsonString, onChange }) {
  const [entries, setEntries] = useState(() => {
    try {
      const obj = JSON.parse(jsonString || '{}');
      return Object.entries(obj).map(([k, v]) => ({ key: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) }));
    } catch {
      return [];
    }
  });
  const [showJson, setShowJson] = useState(false);

  const presets = [
    { label: '+ Vai trò tham gia', key: 'role', defaultValue: 'Chủ nhiệm' },
    { label: '+ Xếp loại', key: 'grade', defaultValue: 'Xuất sắc' },
    { label: '+ Số giờ hoạt động', key: 'hours', defaultValue: '2' },
    { label: '+ Đề tài / Tên khóa', key: 'topic', defaultValue: '' },
    { label: '+ Khóa học / Chứng chỉ', key: 'course_type', defaultValue: 'social_skills' },
  ];

  const updateEntries = newEntries => {
    setEntries(newEntries);
    const obj = {};
    for (const item of newEntries) {
      if (item.key.trim()) {
        const val = item.value.trim();
        obj[item.key.trim()] = !isNaN(Number(val)) && val !== '' ? Number(val) : val;
      }
    }
    onChange(JSON.stringify(obj, null, 2));
  };

  const addField = (k = '', v = '') => {
    updateEntries([...entries, { key: k, value: v }]);
  };

  const changeField = (index, field, val) => {
    const next = [...entries];
    next[index][field] = val;
    updateEntries(next);
  };

  const removeField = index => {
    updateEntries(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="attr-builder space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Thuộc tính bổ sung theo quy chế
          </h4>
          <p className="text-[11px] text-slate-500">
            Dùng khi tiêu chí quy chế yêu cầu thông tin chi tiết (ví dụ: số giờ, vai trò, loại kỹ năng).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowJson(!showJson)}
          className="text-[11px] text-teal-700 hover:underline flex items-center gap-1 font-semibold"
        >
          {showJson ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showJson ? 'Thu gọn JSON' : 'Sửa mã JSON trực tiếp'}
        </button>
      </div>

      {/* Preset suggestions */}
      <div>
        <span className="text-[11px] text-slate-400 font-medium block mb-1">Thêm nhanh gợi ý:</span>
        <div className="attr-presets">
          {presets.map(p => (
            <button
              key={p.key}
              type="button"
              className="attr-preset-chip"
              onClick={() => addField(p.key, p.defaultValue)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* List of Key-Value Rows */}
      {entries.length === 0 ? (
        <div className="text-center p-3 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400">
          Chưa có thuộc tính bổ sung. Chọn gợi ý ở trên hoặc bấm "+ Thêm thuộc tính".
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((item, idx) => (
            <div key={idx} className="attr-row">
              <input
                type="text"
                placeholder="Tên thuộc tính (vd: role, hours)"
                value={item.key}
                onChange={e => changeField(idx, 'key', e.target.value)}
              />
              <input
                type="text"
                placeholder="Giá trị (vd: Chủ nhiệm, 2)"
                value={item.value}
                onChange={e => changeField(idx, 'value', e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeField(idx)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Xóa thuộc tính này"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => addField('', '')}
        className="soft-btn-secondary text-xs inline-flex items-center gap-1 py-1 px-3"
      >
        <Plus size={13} /> Thêm thuộc tính
      </button>

      {/* Advanced JSON View (Collapsed by default) */}
      {showJson && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
          <label className="text-[11px] text-slate-500 font-mono block mb-1">Mã JSON nguyên bản:</label>
          <textarea
            className={`${input} font-mono text-xs`}
            rows={3}
            value={jsonString}
            onChange={e => {
              onChange(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value);
                setEntries(Object.entries(parsed).map(([k, v]) => ({ key: k, value: String(v) })));
              } catch {}
            }}
          />
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   Trang Hồ sơ cá nhân & Thiết kế CV
   ===================================================================== */
export function Profile() {
  const state = useLoad('/me/profile');
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  
  const tab = ['personal', 'cv', 'security'].includes(params.get('tab')) ? params.get('tab') : 'personal';
  const setTab = value => setParams({ tab: value });

  useEffect(() => { 
    if (state.data) {
      setForm({ 
        fullName: state.data.fullName || '', 
        personType: state.data.personType || 'OTHER', 
        birthDate: state.data.birth_date?.slice(0, 10) || '', 
        phone: state.data.phone || '', 
        headline: state.data.headline || '', 
        biography: state.data.biography || '' 
      }); 
    }
  }, [state.data]);

  const edit = (key, value) => setForm(old => ({ ...old, [key]: value }));

  async function save(e) { 
    e.preventDefault(); 
    setError(null); 
    setMessage(''); 
    try { 
      await api('/me/profile', 'PATCH', { ...form, birthDate: form.birthDate || null }); 
      setMessage('Đã lưu hồ sơ thành công.'); 
    } catch(err) { 
      setError(err); 
    } 
  }

  return (
    <Page title="Hồ sơ & CV" description="Quản lý thông tin, thiết kế CV và bảo mật tài khoản.">
      <Tabs 
        items={[
          ["personal", "Thông tin cá nhân"],
          ["cv", "Thiết kế & Xuất CV"],
          ["security", "Bảo mật tài khoản"]
        ]} 
        value={tab} 
        onChange={setTab} 
      />
      <div role="tabpanel">
        {tab === 'personal' && (
          <Load state={state}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Cột trái: Thẻ định danh cá nhân */}
              <div className="lg:col-span-4 soft-card p-6 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 flex items-center justify-center text-3xl font-bold border-4 border-white dark:border-slate-800 shadow-sm mb-4">
                  {(form.fullName || state.data?.fullName || 'U').charAt(0).toUpperCase()}
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{form.fullName || state.data?.fullName || 'Hồ sơ người dùng'}</h2>
                <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">
                  {displayLabel(form.personType || state.data?.personType || 'STUDENT')}
                </span>
                <p className="text-xs text-slate-500 mt-2 truncate max-w-full">{state.data?.email}</p>
                
                <div className="w-full border-t border-slate-100 dark:border-slate-800 my-4 pt-4 text-left text-xs space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-slate-400 shrink-0">Đơn vị:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-right">
                      {(state.data?.memberships || []).map(m => m.organization_name).join(', ') || 'Chưa tham gia'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số điện thoại:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{form.phone || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ngày sinh:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{form.birthDate || 'Chưa cập nhật'}</span>
                  </div>
                </div>

                <button type="button" className="soft-btn-secondary w-full text-xs mt-2" onClick={() => setTab('cv')}>
                  Chuyển sang Thiết kế CV →
                </button>
              </div>

              {/* Cột phải: Form thông tin cá nhân */}
              <form className="lg:col-span-8 soft-card p-6 space-y-5" onSubmit={save}>
                <ErrorMessage error={error} />
                {message && <p role="status" className="p-3 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-sm font-semibold">{message}</p>}
                
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-3">
                    Thông tin cơ bản
                  </h3>
                  <div className="vault-form-grid">
                    <Field label="Họ và tên"><input required className={input} value={form.fullName || ''} onChange={e => edit('fullName', e.target.value)} /></Field>
                    <Field label="Ngày sinh"><input type="date" className={input} value={form.birthDate || ''} onChange={e => edit('birthDate', e.target.value)} /></Field>
                    <Field label="Nhóm đối tượng">
                      <select className={input} value={form.personType || 'OTHER'} onChange={e => edit('personType', e.target.value)}>
                        {[['OTHER','Khác'],['STUDENT','Sinh viên'],['LECTURER','Giảng viên'],['STAFF','Nhân viên']].map(([key,label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Số điện thoại"><input type="tel" className={input} value={form.phone || ''} onChange={e => edit('phone', e.target.value)} /></Field>
                    <Field label="Email tài khoản"><input readOnly type="email" className={`${input} opacity-80 cursor-not-allowed`} value={state.data?.email || ''} /></Field>
                    <Field label="Đơn vị / Tổ chức trực thuộc">
                      <input readOnly className={`${input} opacity-80 cursor-not-allowed`} value={(state.data?.memberships || []).map(m => m.organization_name).join(', ') || 'Chưa tham gia tổ chức'} />
                    </Field>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-3">
                    Giới thiệu & Mục tiêu
                  </h3>
                  <div className="space-y-4">
                    <Field label="Giới thiệu ngắn">
                      <input className={input} value={form.headline || ''} onChange={e => edit('headline', e.target.value)} placeholder="Ví dụ: Sinh viên ngành CNTT, định hướng phát triển ứng dụng di động..." />
                    </Field>
                    <Field label="Tiểu sử chi tiết">
                      <textarea className={input} rows={4} value={form.biography || ''} onChange={e => edit('biography', e.target.value)} placeholder="Tóm tắt về kinh nghiệm, định hướng nghiên cứu và mong muốn cá nhân..." />
                    </Field>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button className={button}>Lưu hồ sơ</button>
                </div>
              </form>
            </div>
          </Load>
        )}
        {tab === 'cv' && <Cv embedded />}
        {tab === 'security' && <PasswordForm />}
      </div>
    </Page>
  );
}

function PasswordForm() {
  const { changePassword } = useAuth();
  const [oldPassword, setOld] = useState(''), [newPassword, setNew] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState(null), [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(null);
    if (newPassword !== confirm) { setError(new Error('Mật khẩu xác nhận không khớp.')); return; }
    setBusy(true);
    try { await changePassword({ oldPassword, newPassword }); } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return <form className={`${panel} max-w-3xl space-y-4`} onSubmit={submit}><h2 className="text-lg font-semibold">Đổi mật khẩu</h2><p className="text-sm text-slate-600 dark:text-slate-300">Sau khi đổi mật khẩu, bạn cần đăng nhập lại.</p><ErrorMessage error={error} /><Field label="Mật khẩu hiện tại"><input type="password" autoComplete="current-password" required className={input} value={oldPassword} onChange={e => setOld(e.target.value)} /></Field><Field label="Mật khẩu mới"><input type="password" autoComplete="new-password" minLength={8} required className={input} value={newPassword} onChange={e => setNew(e.target.value)} /></Field><Field label="Xác nhận mật khẩu mới"><input type="password" autoComplete="new-password" required className={input} value={confirm} onChange={e => setConfirm(e.target.value)} /></Field><button className={button} disabled={busy}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</button></form>;
}

/* =====================================================================
   Tab Thiết kế & Xuất CV (Redesigned 2-column + No loading flicker)
   ===================================================================== */
export function Cv({ embedded = false }) {
  const state = useLoad('/me/cv');
  const achievements = useCollection('/achievements');
  const [form, setForm] = useState({ 
    slug: '', 
    headline: '', 
    bio: '', 
    templateId: 'Modern', 
    isPublic: false, 
    selectedAchievementIds: [], 
    contact: {}, 
    showEmail: false, 
    showPhone: false 
  });
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => { 
    if (state.data) {
      setForm(old => ({ 
        ...old, 
        ...state.data, 
        selectedAchievementIds: state.data.selectedAchievementIds || [], 
        contact: state.data.contact || {},
        showEmail: !!state.data.showEmail,
        showPhone: !!state.data.showPhone,
        isPublic: !!state.data.isPublic,
      })); 
    }
  }, [state.data]);

  async function save(e) { 
    e.preventDefault(); 
    setError(null);
    setMessage('');
    try { 
      const result = await api('/me/cv', 'PUT', { 
        slug: form.slug || null, 
        templateId: form.templateId, 
        isPublic: !!form.isPublic, 
        headline: form.headline || '', 
        bio: form.bio || '', 
        selectedAchievementIds: form.selectedAchievementIds.map(Number), 
        showEmail: !!form.showEmail, 
        showPhone: !!form.showPhone 
      }); 
      setForm(old => ({ ...old, ...result })); 
      setMessage('Đã lưu cấu hình CV thành công.'); 
      setError(null); 
    } catch (err) { 
      setError(err); 
    } 
  }

  // Loại bỏ hoàn toàn flicker chớp nháy: chỉ render khi đã nạp dữ liệu xong
  if (state.loading) {
    return (
      <div className="soft-card p-12 text-center flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-slate-600">Đang chuẩn bị hồ sơ CV cá nhân...</p>
      </div>
    );
  }

  const Wrapper = embedded ? 'div' : Page;
  const wrapperProps = embedded ? { className: "vault-cv-wrapper" } : { title: "Hồ sơ & CV", description: "Chọn thành tích muốn chia sẻ và tùy chỉnh đường dẫn CV." };

  return (
    <Wrapper {...wrapperProps}>
      <ErrorMessage error={error} />
      {message && <p role="status" className="p-3 mb-4 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-sm font-semibold">{message}</p>}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái (7 cols): Form cấu hình CV */}
        <form className="lg:col-span-7 soft-card p-6 space-y-5" onSubmit={save}>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
              Cấu hình & Tùy biến CV
            </h3>
            <p className="text-xs text-slate-500">
              Chỉnh sửa thông tin xuất bản và lựa chọn các thành tích sẽ xuất hiện trên CV.
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Đường dẫn định danh CV (URL slug)">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">/cv/</span>
                <input 
                  className={input} 
                  placeholder="Để trống để tạo tự động (ví dụ: nguyen-van-a)" 
                  value={form.slug || ''} 
                  onChange={e => setForm({ ...form, slug: e.target.value })} 
                />
              </div>
            </Field>

            <Field label="Mẫu giao diện CV">
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  ['Modern', 'Hiện đại', 'Thanh lịch, viền teal sang trọng'],
                  ['Academic', 'Học thuật', 'Font có chân chuẩn nghiên cứu'],
                  ['Minimalist', 'Tối giản', 'Gọn gàng, tinh tế và thoáng đãng']
                ].map(([id, title, desc]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setForm({ ...form, templateId: id })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      (form.templateId || 'Modern') === id
                        ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 shadow-sm ring-1 ring-teal-600'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <strong className="block text-xs font-bold">{title}</strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5 leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Tiêu đề nghề nghiệp / Chuyên môn">
              <input 
                className={input} 
                value={form.headline || ''} 
                onChange={e => setForm({ ...form, headline: e.target.value })} 
                placeholder="Ví dụ: Kỹ sư Phần mềm | Giảng viên CNTT"
              />
            </Field>

            <Field label="Tóm tắt bản thân & Mục tiêu">
              <textarea 
                className={input} 
                rows={3} 
                value={form.bio || ''} 
                onChange={e => setForm({ ...form, bio: e.target.value })} 
                placeholder="Đoạn văn ngắn giới thiệu về kỹ năng, kinh nghiệm và định hướng..."
              />
            </Field>

            {/* Quyền riêng tư & Hiển thị liên hệ */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-2">
                Tùy chọn hiển thị & Công khai
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input 
                    type="checkbox" 
                    className="rounded text-teal-600"
                    checked={!!form.isPublic} 
                    onChange={e => setForm({ ...form, isPublic: e.target.checked })} 
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Công khai CV</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input 
                    type="checkbox" 
                    className="rounded text-teal-600"
                    checked={!!form.showEmail} 
                    onChange={e => setForm({ ...form, showEmail: e.target.checked })} 
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Hiện Email</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input 
                    type="checkbox" 
                    className="rounded text-teal-600"
                    checked={!!form.showPhone} 
                    onChange={e => setForm({ ...form, showPhone: e.target.checked })} 
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Hiện Số điện thoại</span>
                </label>
              </div>
            </div>

            {/* Thành tích hiển thị */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="block text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                  Thành tích đưa vào CV ({form.selectedAchievementIds?.length || 0} đã chọn)
                </span>
                <span className="text-[11px] text-slate-400">Đánh dấu để đưa vào bản in CV</span>
              </div>
              <Load state={achievements}>
                {!array(achievements.data).length ? (
                  <Empty>Chưa có thành tích trong kho để chọn.</Empty>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {array(achievements.data).map(item => {
                      const isSelected = form.selectedAchievementIds.map(String).includes(String(item.id));
                      return (
                        <label 
                          key={item.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-teal-50/50 border-teal-300 text-teal-900 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-200' 
                              : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            className="mt-0.5 rounded text-teal-600"
                            checked={isSelected} 
                            onChange={e => setForm({ 
                              ...form, 
                              selectedAchievementIds: e.target.checked 
                                ? [...form.selectedAchievementIds, item.id] 
                                : form.selectedAchievementIds.filter(id => String(id) !== String(item.id)) 
                            })} 
                          />
                          <div className="flex-1 min-w-0">
                            <strong className="block truncate font-semibold">{item.title}</strong>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {[item.typeName, item.recognitionYear || String(item.achievedAt).slice(0, 4)].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </Load>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button className={button}>Lưu cấu hình CV</button>
            {form.profileId && (
              <button 
                type="button" 
                className={secondary} 
                onClick={async () => { 
                  try { 
                    await saveBlob('/me/cv/export-docx', 'cv.docx'); 
                  } catch (err) { 
                    setError(err); 
                  } 
                }}
              >
                <FileDown size={15} /> Tải CV DOCX
              </button>
            )}
            {form.isPublic && form.slug && (
              <a 
                className="soft-btn-secondary inline-flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300" 
                href={`/cv/${encodeURIComponent(form.slug)}`} 
                target="_blank" 
                rel="noreferrer"
              >
                <ExternalLink size={14} /> Xem CV công khai
              </a>
            )}
          </div>
        </form>

        {/* Cột phải (5 cols): Xem trước trực quan A4 Live Preview */}
        <div className="lg:col-span-5 sticky top-6">
          <CvLivePreview form={form} achievements={array(achievements.data)} />
        </div>
      </div>
    </Wrapper>
  );
}

function CvLivePreview({ form, achievements }) {
  const { user } = useAuth();
  const chosen = achievements.filter(item => (form.selectedAchievementIds || []).map(String).includes(String(item.id)));
  const templateClass = `cv-template-${String(form.templateId || 'Modern').toLowerCase()}`;

  return (
    <aside className="cv-preview">
      <div className="cv-preview-heading">
        <div>
          <h2>Xem trước trực tiếp (Live Preview)</h2>
          <p>Nội dung cập nhật tức thời khi bạn thao tác</p>
        </div>
        <span className="cv-preview-badge">{form.templateId || 'Modern'}</span>
      </div>

      <div className={`cv-preview-paper ${templateClass}`}>
        <h1 className="cv-preview-name">{user?.fullName || 'Họ và tên'}</h1>
        <p className="cv-preview-headline">{form.headline || 'Tiêu đề nghề nghiệp / Chuyên môn'}</p>
        
        {/* Contact snippet */}
        {(form.showEmail || form.showPhone) && (
          <div className="cv-preview-contact">
            {form.showEmail && user?.email && <span>✉ {user.email}</span>}
            {form.showPhone && form.contact?.phone && <span>☎ {form.contact.phone}</span>}
          </div>
        )}

        {form.bio && (
          <p className="cv-preview-bio">{form.bio}</p>
        )}

        <h3>Thành tích & Dấu mốc</h3>
        {chosen.length ? (
          <div className="space-y-2">
            {chosen.map(item => (
              <div className="cv-preview-item" key={item.id}>
                <strong>{item.title}</strong>
                <span>{[item.typeName, item.recognitionYear || String(item.achievedAt).slice(0, 4)].filter(Boolean).join(' · ')}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="cv-preview-muted">Chọn các thành tích bên trái để hiển thị tại đây.</p>
        )}
      </div>

      <p className="cv-preview-note">
        Chỉ những thành tích đã tích chọn và thông tin được cấp phép mới xuất hiện trên CV công khai.
      </p>
    </aside>
  );
}

/* =====================================================================
   Trang Kho thành tích (Achievements Hub - Pagination, Icons, Attribute Form)
   ===================================================================== */
export function Achievements() {
  const [tab, setTab] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [year, setYear] = useState('');
  const [issuer, setIssuer] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';

  const state = useCollection('/achievements');
  const trash = useCollection('/achievements?trash=true');
  const catalogs = useLoad('/achievements/catalogs');

  const [form, setForm] = useState({ title: '', achievedAt: '', description: '', issuer: '', achievementTypeId: '', levelCode: '' });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [files, setFiles] = useState([]);
  const [attributesJson, setAttributesJson] = useState('{}');

  const edit = (key, value) => setForm(old => ({ ...old, [key]: value }));
  function reset() { 
    setEditing(null); 
    setForm({ title: '', achievedAt: '', description: '', issuer: '', achievementTypeId: '', levelCode: '' }); 
    setAttributesJson('{}'); 
  }

  async function save(e) { 
    e.preventDefault(); 
    setError(null); 
    try { 
      const attributes = parseRuleJson(attributesJson); 
      await api(editing ? `/achievements/${editing}` : '/achievements', editing ? 'PATCH' : 'POST', { 
        ...form, 
        attributes, 
        achievementTypeId: form.achievementTypeId ? Number(form.achievementTypeId) : null 
      }); 
      reset(); 
      setShowForm(false); 
      await state.reload(); 
    } catch (err) { 
      setError(err); 
    } 
  }

  async function remove(id) { 
    if (!window.confirm('Chuyển thành tích này vào thùng rác?')) return; 
    try { 
      await api(`/achievements/${id}`, 'DELETE'); 
      await state.reload(); 
      await trash.reload(); 
    } catch (err) { 
      setError(err); 
    } 
  }

  async function openFiles(id) { 
    try { 
      setExpanded(id); 
      setFiles(array(await api(`/achievements/${id}/evidences`))); 
    } catch (err) { 
      setError(err); 
    } 
  }

  async function upload(e, id) { 
    const file = e.target.files?.[0]; 
    if (!file) return; 
    const data = new FormData(); 
    data.append('file', file); 
    try { 
      await api(`/achievements/${id}/evidences`, 'POST', data); 
      await openFiles(id); 
      await state.reload(); 
    } catch (err) { 
      setError(err); 
    } 
    e.target.value = ''; 
  }

  async function extract(e) { 
    const file = e.target.files?.[0]; 
    if (!file) return; 
    const data = new FormData(); 
    data.append('file', file); 
    try { 
      const result = await api('/achievements/ai-extract', 'POST', data); 
      if (result.data) {
        setForm(old => ({ 
          ...old, 
          title: result.data.title || old.title, 
          achievedAt: result.data.issueDate || old.achievedAt, 
          issuer: result.data.issuer || old.issuer 
        })); 
      } else {
        setError(new Error(result.message || 'Không thể trích xuất tự động. Hãy nhập thông tin thủ công.')); 
      }
    } catch (err) { 
      setError(err); 
    } 
    e.target.value = ''; 
  }

  async function download(file) { 
    try { 
      const blob = await api(`/evidence-files/${file.id}/download`, 'GET', undefined, { responseType: 'blob' }); 
      const link = document.createElement('a'); 
      link.href = URL.createObjectURL(blob); 
      link.download = file.originalFileName; 
      link.click(); 
      URL.revokeObjectURL(link.href); 
    } catch (err) { 
      setError(err); 
    } 
  }

  const source = tab === 'trash' ? trash : state;
  const filteredRows = array(source.data).filter(item => 
    (!search || `${item.title} ${item.description}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) && 
    (!typeFilter || String(item.achievementTypeId) === typeFilter) && 
    (!year || String(item.achievedAt).startsWith(year)) && 
    (!issuer || item.issuer === issuer)
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  function begin(item) { 
    setError(null); 
    if (item) { 
      setEditing(item.id); 
      setAttributesJson(JSON.stringify(item.attributes || {}, null, 2)); 
      setForm({ 
        title: item.title || '', 
        achievedAt: item.achievedAt?.slice(0, 10) || '', 
        description: item.description || '', 
        issuer: item.issuer || '', 
        achievementTypeId: item.achievementTypeId || '', 
        levelCode: item.levelCode || '' 
      }); 
    } else {
      reset(); 
    }
    setShowForm(true); 
  }

  const pageActions = (
    <div className="flex items-center gap-2">
      <Link 
        to="/reports" 
        className="soft-btn-secondary inline-flex items-center gap-1.5 text-xs font-bold"
        title="Xem thống kê phân bố thành tích theo năm và loại"
      >
        <BarChart3 size={15} />
        <span>Thống kê & Báo cáo</span>
      </Link>
      <button type="button" className={button} onClick={() => begin()}>
        <Plus size={16} aria-hidden="true" />
        <span>Thêm thành tích</span>
      </button>
    </div>
  );

  return (
    <Page title="Kho thành tích" description="Lưu những dấu mốc và minh chứng của bạn để khám hồ sơ hoặc tạo CV." actions={pageActions}>
      <ErrorMessage error={error} />
      
      <section className={panel}>
        <div className="vault-list-heading flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <Tabs 
            items={[
              ["all", `Tất cả thành tích (${state.data?.total ?? 0})`],
              ["trash", `Thùng rác (${trash.data?.total ?? 0})`]
            ]} 
            value={tab} 
            onChange={t => { setTab(t); setPage(1); }} 
          />
        </div>

        {/* Toolbar bộ lọc */}
        <div className="vault-toolbar mt-4">
          <Field label="Tìm thành tích">
            <input 
              type="search" 
              className={input} 
              placeholder="Nhập tên thành tích..." 
              value={search} 
              onChange={e => { setSearchParams(e.target.value ? { search: e.target.value } : {}); setPage(1); }} 
            />
          </Field>
          <Field label="Loại thành tích">
            <select className={input} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">Tất cả loại</option>
              {(catalogs.data?.achievementTypes || []).map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Năm đạt được">
            <select className={input} value={year} onChange={e => { setYear(e.target.value); setPage(1); }}>
              <option value="">Tất cả năm</option>
              {[...new Set(array(source.data).map(item => String(item.achievedAt).slice(0, 4)))].sort().reverse().map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Đơn vị cấp">
            <select className={input} value={issuer} onChange={e => { setIssuer(e.target.value); setPage(1); }}>
              <option value="">Tất cả đơn vị</option>
              {[...new Set(array(source.data).map(item => item.issuer).filter(Boolean))].sort().map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        </div>

        <Load state={source}>
          {!filteredRows.length ? (
            <Empty action={tab === 'all' && !array(state.data).length ? (
              <button className={button} onClick={() => begin()}><Plus size={16} /> Thêm thành tích đầu tiên</button>
            ) : (
              <button className={secondary} onClick={() => { setSearchParams({}); setTypeFilter(''); setYear(''); setIssuer(''); setPage(1); }}>
                Xóa bộ lọc
              </button>
            )}>
              {tab === 'trash' ? 'Không có thành tích trong thùng rác.' : array(state.data).length ? 'Không tìm thấy thành tích phù hợp.' : 'Chưa có thành tích nào. Hãy thêm dấu mốc đầu tiên của bạn.'}
            </Empty>
          ) : (
            <>
              <div className="vault-table-wrap mt-2">
                <table className="vault-table">
                  <caption className="sr-only">{tab === 'trash' ? 'Thành tích trong thùng rác' : 'Thành tích của bạn'}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tên thành tích</th>
                      <th scope="col">Loại</th>
                      <th scope="col">Đơn vị cấp</th>
                      <th scope="col">Ngày đạt</th>
                      <th scope="col">Minh chứng</th>
                      <th scope="col" className="text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td>
                          <strong className="block text-slate-800 dark:text-slate-100 font-semibold">{item.title}</strong>
                          {item.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.description}</p>}
                        </td>
                        <td>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {item.typeName || 'Chưa phân loại'}
                          </span>
                        </td>
                        <td className="text-slate-600 text-xs">{item.issuer || '—'}</td>
                        <td className="text-slate-600 text-xs"><DateText value={item.achievedAt} /></td>
                        <td>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Paperclip size={13} aria-hidden="true" />
                            {item.evidenceCount || 0}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1.5">
                            {tab === 'trash' ? (
                              <button 
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 inline-flex items-center gap-1" 
                                onClick={async () => { 
                                  try { 
                                    await api(`/achievements/${item.id}/restore`, 'POST'); 
                                    await state.reload(); 
                                    await trash.reload(); 
                                  } catch(err) { 
                                    setError(err); 
                                  } 
                                }}
                              >
                                <RotateCcw size={13} /> Khôi phục
                              </button>
                            ) : (
                              <>
                                <button 
                                  type="button" 
                                  title="Xem & đính kèm minh chứng" 
                                  aria-label="Xem minh chứng"
                                  className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 transition-colors" 
                                  onClick={() => openFiles(item.id)}
                                >
                                  <Eye size={15} />
                                </button>
                                <button 
                                  type="button" 
                                  title="Chỉnh sửa thông tin thành tích" 
                                  aria-label="Sửa thành tích"
                                  className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors" 
                                  onClick={() => begin(item)}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button 
                                  type="button" 
                                  title="Chuyển vào thùng rác" 
                                  aria-label="Xóa thành tích"
                                  className="w-8 h-8 rounded-xl inline-flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 transition-colors" 
                                  onClick={() => remove(item.id)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Numbered Pagination < << 1 2 3 ... >> > */}
              <NumberedPagination 
                page={page} 
                totalPages={totalPages} 
                onPageChange={setPage} 
              />
            </>
          )}
        </Load>
      </section>

      {/* Modal Thêm / Sửa thành tích */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Sửa thành tích' : 'Thêm thành tích mới'}>
        <form onSubmit={save} className="space-y-4">
          <ErrorMessage error={error} />
          
          {/* Custom Styled Drag & Drop Picker */}
          <FilePicker label="Trích xuất thông tin tự động từ minh chứng (tùy chọn)" onChange={extract} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên thành tích *">
              <input required className={input} value={form.title} onChange={e => edit('title', e.target.value)} placeholder="Tên văn bằng, giải thưởng, bài báo..." />
            </Field>
            <Field label="Ngày đạt được *">
              <input required type="date" className={input} value={form.achievedAt} onChange={e => edit('achievedAt', e.target.value)} />
            </Field>
            <Field label="Loại thành tích">
              <select className={input} value={form.achievementTypeId} onChange={e => edit('achievementTypeId', e.target.value)}>
                <option value="">Chưa chọn loại</option>
                {(catalogs.data?.achievementTypes || []).map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Đơn vị cấp / Ban tổ chức">
              <input className={input} value={form.issuer} onChange={e => edit('issuer', e.target.value)} placeholder="Ví dụ: Trường ĐH Lạc Hồng, Bộ GD&ĐT..." />
            </Field>
          </div>

          <Field label="Mô tả chi tiết">
            <textarea className={input} rows={2} value={form.description} onChange={e => edit('description', e.target.value)} placeholder="Tóm tắt nội dung, kết quả hoặc xếp loại..." />
          </Field>

          {/* Thay thế khung JSON bằng Trình nhập thuộc tính trực quan */}
          <AttributeBuilder jsonString={attributesJson} onChange={setAttributesJson} />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" className={secondary} onClick={() => { reset(); setShowForm(false); }}>
              Hủy
            </button>
            <button className={button}>
              {editing ? 'Lưu thay đổi' : 'Thêm thành tích'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Minh chứng */}
      <Modal open={expanded !== null} onClose={() => setExpanded(null)} title="Minh chứng & Tệp đính kèm">
        <ErrorMessage error={error} />
        <FilePicker label="Tải lên tệp minh chứng mới" onChange={e => upload(e, expanded)} />
        
        <div className="mt-4 space-y-2">
          {!files.length ? (
            <Empty>Chưa có tệp minh chứng nào. Bạn hãy tải lên tệp đầu tiên để làm căn cứ đối chiếu.</Empty>
          ) : (
            files.map(file => (
              <div key={file.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-800">
                <button type="button" className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-2 truncate" onClick={() => download(file)}>
                  <Paperclip size={14} className="shrink-0" />
                  <span className="truncate">{file.originalFileName}</span>
                </button>
                <button 
                  type="button" 
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" 
                  onClick={async () => { 
                    try { 
                      await api(`/evidences/${file.id}`, 'DELETE'); 
                      await openFiles(expanded); 
                      await state.reload(); 
                    } catch(err) { 
                      setError(err); 
                    } 
                  }}
                  title="Xóa minh chứng này"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>
    </Page>
  );
}

/* =====================================================================
   Trang Khám hồ sơ (Discovery Hub - Clean spacing, Criteria modal, Spotlight Results)
   ===================================================================== */
export function Discovery() {
  const docs = useLoad('/regulations/library');
  const history = useLoad('/ai/evaluations/structured?pageSize=20');
  const [params] = useSearchParams();
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(localDay);

  const versions = array(docs.data).map(context => ({ 
    context, 
    doc: { name: context.name, code: context.code }, 
    version: { 
      id: context.regulation_version_id, 
      version_label: context.version_label, 
      effective_from: context.effective_from, 
      effective_to: context.effective_to, 
      publication_status: 'PUBLISHED', 
      source_title: context.context_type === 'ORGANIZATION' ? `Bối cảnh tổ chức #${context.organization_id}` : context.context_type === 'OWNER' ? 'Quy chế cá nhân do tôi tạo' : 'Kho cá nhân' 
    } 
  })).filter(({ version }) => effective(version, evaluationDate));

  async function evaluate(version, context) { 
    setError(null); 
    setMessage(''); 
    setBusy(true); 
    try { 
      const result = await api(version ? '/ai/evaluations/structured' : '/ai/auto-discovery', 'POST', version ? { 
        regulation_version_id: Number(version), 
        evaluation_date: evaluationDate, 
        ...(context?.adoption_id ? { adoption_id: Number(context.adoption_id) } : {}) 
      } : { evaluation_date: evaluationDate }); 
      setRuns(version ? [result] : array(result)); 
      await history.reload(); 
    } catch(err) { 
      setError(err); 
    } finally { 
      setBusy(false); 
    } 
  }

  async function goal(result) { 
    setError(null); 
    try { 
      await api('/kpi/from-ai-gap', 'POST', { source_result_id: result.id }); 
      setMessage('Đã tạo mục tiêu thành công từ tiêu chí còn thiếu! Bạn có thể xem và theo dõi tại trang Mục tiêu / KPI.'); 
    } catch(err) { 
      setError(err); 
    } 
  }

  const pageActions = (
    <Link 
      to="/regulations" 
      className="soft-btn-secondary inline-flex items-center gap-1.5 text-xs font-bold"
    >
      <BookOpen size={15} />
      <span>Tra cứu kho quy chế</span>
    </Link>
  );

  return (
    <Page title="Khám hồ sơ" description="Đối chiếu thành tích với quy chế. Kết quả dựa trên dữ liệu bạn cung cấp." actions={pageActions}>
      <ErrorMessage error={error} />
      {message && <p role="status" className="p-3 mb-4 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-sm font-semibold">{message}</p>}
      
      <div className="space-y-6">
        {/* Card Kết quả khám hồ sơ (Hiển thị nổi bật, có nút đóng dismiss) */}
        {runs.map((run, index) => {
          const isMet = run.conclusion === 'MET';
          return (
            <section className="evaluation-spotlight" key={run.id || index}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={isMet ? 'eval-badge-met' : 'eval-badge-not-met'}>
                      {conclusionLabel(run.conclusion)}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      Tỷ lệ hoàn thành: <strong className="text-slate-800">{run.completion_percent ?? 0}%</strong>
                    </span>
                  </div>
                  <h2 className="font-bold text-xl text-slate-900 mt-2">
                    {run.regulation_name || run.name || `Kết quả khám hồ sơ #${index + 1}`}
                  </h2>
                </div>
                <button 
                  type="button" 
                  onClick={() => setRuns(runs.filter((_, i) => i !== index))}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Đóng kết quả"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden my-4 border border-slate-200">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${isMet ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, Math.max(0, run.completion_percent ?? 0))}%` }}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <button 
                  type="button"
                  className="soft-btn-primary inline-flex items-center gap-1.5 text-xs font-bold" 
                  onClick={async () => { 
                    try { 
                      await saveBlob('/ai/export-dossier-zip', 'minh-chung.zip', 'POST', { runId: run.id }); 
                    } catch (err) { 
                      setError(err); 
                    } 
                  }}
                >
                  <FileArchive size={15} /> Tải toàn bộ minh chứng ZIP
                </button>
              </div>

              {/* Criteria details */}
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Chi tiết đánh giá từng tiêu chí ({run.results?.length || 0})
              </h3>
              <div className="space-y-3">
                {(run.results || []).map(result => {
                  const criterionMet = result.conclusion === 'MET';
                  return (
                    <div key={result.id} className="eval-criterion-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                            {result.criterion?.title || result.title || 'Tiêu chí'}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              criterionMet ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {conclusionLabel(result.conclusion)}
                            </span>
                            <span className="text-xs text-slate-600 font-semibold">
                              Thực tế: <strong className="text-slate-800">{result.actual_value ?? 0}</strong> / Yêu cầu: <strong className="text-slate-800">{result.target_value ?? '—'}</strong> {result.measure_unit || ''}
                            </span>
                          </div>
                        </div>

                        {/* Prominent CTA to convert gap into KPI goal */}
                        {result.conclusion === 'NOT_MET' && (
                          <button 
                            type="button" 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all shrink-0" 
                            onClick={() => goal(result)}
                            title="Tạo mục tiêu KPI để khắc phục phần còn thiếu này"
                          >
                            <Target size={14} />
                            <span>Tạo KPI từ tiêu chí này</span>
                          </button>
                        )}
                      </div>

                      {missingText(result.missing_details) && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                          <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                          <span>{missingText(result.missing_details)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Card 1: Thiết lập nhanh */}
        <section className={`${panel} vault-discovery-settings`}>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Thiết lập thời điểm khám</h2>
            <p className="text-xs text-slate-500 mt-0.5">Chọn mốc thời gian để hệ thống kiểm tra các quy chế có hiệu lực tại thời điểm đó.</p>
          </div>
          <Field label="Thời điểm đối chiếu">
            <input 
              type="date" 
              required 
              className={input} 
              value={evaluationDate} 
              onChange={e => setEvaluationDate(e.target.value || localDay())} 
            />
          </Field>
          <button 
            className="soft-btn-primary inline-flex items-center gap-1.5" 
            disabled={!versions.length || busy} 
            onClick={() => evaluate(null)}
          >
            <Sparkles size={16} />
            <span>{busy ? 'Đang khám hồ sơ…' : 'Quét tự động tất cả quy chế phù hợp'}</span>
          </button>
        </section>

        {/* Card 2: Quy chế đang áp dụng */}
        <section className={panel}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Quy chế đang áp dụng</h2>
              <p className="text-xs text-slate-500">Các quy chế thuộc tổ chức hoặc cá nhân đang có hiệu lực tại ngày {evaluationDate}.</p>
            </div>
          </div>
          
          <Load state={docs}>
            {!versions.length ? (
              <Empty action={<Link className={secondary} to="/regulations">Tra cứu kho quy chế</Link>}>
                Chưa có quy chế nào có hiệu lực vào thời điểm đã chọn.
              </Empty>
            ) : (
              <div className="vault-card-grid">
                {[...versions].sort((a,b) => Number(String(b.version.id) === params.get('version')) - Number(String(a.version.id) === params.get('version'))).map(({doc,version,context},index) => (
                  <RegulationCard 
                    key={`${context.adoption_id}-${context.member_organization_id}-${version.id}-${index}`} 
                    doc={doc} 
                    version={version} 
                    busy={busy} 
                    onEvaluate={id => evaluate(id,context)} 
                  />
                ))}
              </div>
            )}
          </Load>
        </section>

        {/* Card 3: Lịch sử khám hồ sơ */}
        <section className={panel}>
          <div className="vault-list-heading flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Lịch sử khám hồ sơ</h2>
              <p className="text-xs text-slate-500">Các lần quét và đối chiếu quy chế đã thực hiện trước đây.</p>
            </div>
            <button className={secondary} onClick={history.reload} disabled={history.loading}>
              Làm mới lịch sử
            </button>
          </div>
          
          <Load state={history}>
            {!array(history.data).length ? (
              <Empty>Chưa có lần khám nào. Chọn một quy chế ở phía trên để bắt đầu đối chiếu.</Empty>
            ) : (
              <div className="vault-table-wrap">
                <table className="vault-table">
                  <caption className="sr-only">20 lần khám hồ sơ gần nhất</caption>
                  <thead>
                    <tr>
                      <th>Thời điểm</th>
                      <th>Quy chế</th>
                      <th>Kết quả</th>
                      <th>Tình trạng dữ liệu</th>
                      <th className="text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {array(history.data).map(run => (
                      <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                        <td className="text-xs font-medium"><DateText value={run.evaluation_date} /></td>
                        <td className="font-semibold text-slate-800">
                          {versions.find(({version}) => String(version.id) === String(run.regulation_version_id))?.doc.name || `Phiên bản #${run.regulation_version_id}`}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <StatusBadge value={run.conclusion} />
                            <span className="text-xs text-slate-600 font-semibold">{run.completion_percent}% đạt</span>
                          </div>
                        </td>
                        <td className="text-xs">
                          {run.stale ? (
                            <span className="text-amber-700 font-semibold flex items-center gap-1">
                              <AlertCircle size={13} /> Hồ sơ đã thay đổi · Cần khám lại
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={13} /> Khớp dữ liệu hiện tại
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          <button 
                            className="soft-btn-primary text-xs py-1.5 px-3" 
                            onClick={async () => { 
                              try { 
                                const res = await api(`/ai/evaluations/structured/${run.id}`);
                                setRuns([res]); 
                                window.scrollTo({ top: 120, behavior: 'smooth' });
                              } catch(err) { 
                                setError(err); 
                              } 
                            }}
                          >
                            Xem kết quả
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Load>
        </section>
      </div>
    </Page>
  );
}

/* =====================================================================
   Trang Mục tiêu / KPI (Goals Hub - Column headers, Centered pagination, Clean modal)
   ===================================================================== */
export function Goals() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const state = useLoad(`/kpi/goals?page=${page}`);
  const [form, setForm] = useState({ title: '', target_value: '1', measure_unit: '', due_date: '' });
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [progress, setProgress] = useState('');
  const [task, setTask] = useState('');

  const totalPages = state.data?.total != null 
    ? Math.max(1, Math.ceil(state.data.total / (state.data.pageSize || 20))) 
    : 1;

  async function open(id) { 
    try { 
      setError(null); 
      setDetail(old => String(old?.id) === String(id) ? old : null); 
      setSelected(id); 
      setDetail(await api(`/kpi/goals/${id}`)); 
    } catch (err) { 
      setError(err); 
    } 
  }

  async function create(e) { 
    e.preventDefault(); 
    try { 
      await api('/kpi/goals', 'POST', { 
        ...form, 
        target_value: Number(form.target_value), 
        due_date: form.due_date || null 
      }); 
      setForm({ title: '', target_value: '1', measure_unit: '', due_date: '' }); 
      setShowForm(false); 
      await state.reload(); 
    } catch (err) { 
      setError(err); 
    } 
  }

  const addButton = (
    <button type="button" className={button} onClick={() => { setError(null); setShowForm(true); }}>
      <Plus size={16} aria-hidden="true" />
      <span>Tạo mục tiêu mới</span>
    </button>
  );

  return (
    <Page title="Mục tiêu / KPI" description="Theo dõi tiến độ, việc cần làm và thành tích hỗ trợ cho từng mục tiêu." actions={addButton}>
      <ErrorMessage error={error} />
      
      <section className={panel}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Danh sách mục tiêu cá nhân</h2>
            <p className="text-xs text-slate-500">Tiến độ được cập nhật dựa trên giá trị nhập và các thành tích đã liên kết.</p>
          </div>
        </div>

        <Load state={state}>
          {!array(state.data).length ? (
            <Empty action={addButton}>
              Chưa có mục tiêu nào. Hãy tạo mục tiêu đầu tiên hoặc khám hồ sơ để nhận đề xuất từ AI.
            </Empty>
          ) : (
            <>
              {/* Bảng danh sách mục tiêu có tiêu đề cột rõ ràng */}
              <div className="vault-table-wrap">
                <table className="vault-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '35%' }}>Tên mục tiêu & Nguồn</th>
                      <th scope="col">Thời hạn</th>
                      <th scope="col">Thực tế / Chỉ tiêu</th>
                      <th scope="col" style={{ width: '22%' }}>Tiến độ (%)</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col" className="text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {array(state.data).map(item => {
                      const percent = Math.min(100, Math.max(0, Number(item.completion_percent) || 0));
                      const overdue = item.due_date && String(item.due_date).slice(0, 10) < localDay() && !['COMPLETED', 'CANCELLED'].includes(item.status);
                      
                      return (
                        <tr key={item.id} className="vault-goal-table-row">
                          <td>
                            <button 
                              type="button"
                              className="font-bold text-slate-800 hover:text-teal-700 text-left transition-colors" 
                              onClick={() => open(item.id)}
                            >
                              {item.title}
                            </button>
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              {item.source_result_id ? 'Tạo từ khoảng trống quy chế AI' : 'Mục tiêu tự tạo cá nhân'}
                            </span>
                          </td>
                          <td className="text-xs">
                            <span className={overdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                              {overdue ? 'Quá hạn · ' : ''}
                              {item.due_date ? <DateText value={item.due_date} /> : 'Chưa đặt hạn'}
                            </span>
                          </td>
                          <td className="text-xs font-semibold text-slate-700">
                            <strong>{item.current_value ?? 0}</strong> / {item.target_value} {item.measure_unit}
                          </td>
                          <td>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-bold text-slate-700">
                                <span>{percent}%</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${percent >= 100 ? 'bg-emerald-500' : 'bg-teal-600'}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            <StatusBadge value={item.status} />
                          </td>
                          <td className="text-center">
                            <button 
                              className="soft-btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1" 
                              onClick={() => open(item.id)}
                            >
                              <span>Chi tiết</span>
                              <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Numbered Pagination < << 1 2 3 ... >> > */}
              <NumberedPagination 
                page={page} 
                totalPages={totalPages} 
                onPageChange={setPage} 
              />
            </>
          )}
        </Load>
      </section>

      {/* Modal Tạo mục tiêu mới */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Tạo mục tiêu KPI mới">
        <form onSubmit={create} className="space-y-4">
          <ErrorMessage error={error} />
          <Field label="Tên mục tiêu *">
            <input required className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ví dụ: Xuất bản 02 bài báo quốc tế, Hoàn thành 15 giờ NCKH..." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Chỉ tiêu cần đạt *">
              <input required type="number" min="0.01" step="any" className={input} value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} />
            </Field>
            <Field label="Đơn vị tính *">
              <input required className={input} value={form.measure_unit} onChange={e => setForm({ ...form, measure_unit: e.target.value })} placeholder="bài báo, giờ, đề tài..." />
            </Field>
            <Field label="Hạn hoàn thành">
              <input type="date" className={input} value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" className={secondary} onClick={() => setShowForm(false)}>Hủy</button>
            <button className={button}>Tạo mục tiêu</button>
          </div>
        </form>
      </Modal>

      {/* Modal Chi tiết mục tiêu (Đã phân 3 khu vực rõ ràng) */}
      <Modal open={selected !== null && !!detail} onClose={() => { setSelected(null); setDetail(null); }} title={detail?.title || 'Chi tiết mục tiêu KPI'}>
        <ErrorMessage error={error} />
        {detail && (
          <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
            {/* Khu vực 1: Tiến độ thực tế & Cập nhật */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    Tiến độ thực hiện
                  </h3>
                  <p className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                    {detail.current_value ?? 0} / {detail.target_value} {detail.measure_unit} ({Math.min(100, Math.round(Number(detail.completion_percent) || 0))}%)
                  </p>
                </div>
                <StatusBadge value={detail.status} />
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div 
                  className="h-full bg-teal-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, Number(detail.completion_percent) || 0))}%` }}
                />
              </div>

              {/* Form cập nhật số lượng tiến độ */}
              <form 
                className="flex items-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700"
                onSubmit={async e => { 
                  e.preventDefault(); 
                  try { 
                    await api(`/kpi/goals/${detail.id}/progress`, 'POST', { current_value: Number(progress) }); 
                    setProgress(''); 
                    await open(detail.id); 
                    await state.reload(); 
                  } catch (err) { 
                    setError(err); 
                  } 
                }}
              >
                <div className="flex-1">
                  <Field label="Ghi nhận giá trị tiến độ mới">
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className={input} 
                      placeholder={`Nhập giá trị (${detail.measure_unit})...`}
                      value={progress} 
                      onChange={e => setProgress(e.target.value)} 
                    />
                  </Field>
                </div>
                <button className={button}>Lưu tiến độ</button>
              </form>
            </div>

            {/* Khu vực 2: Danh sách việc cần làm (Checklist tương tác) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                Kế hoạch công việc (Checklist)
              </h3>
              
              <div className="space-y-1.5">
                {!(detail.tasks || []).length ? (
                  <p className="text-xs text-slate-400 italic">Chưa có công việc nào trong danh sách.</p>
                ) : (
                  detail.tasks.map(t => {
                    const isDone = t.status === 'DONE';
                    return (
                      <label 
                        key={t.id} 
                        className={`flex items-center gap-2.5 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isDone ? 'bg-slate-50 text-slate-400 line-through' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          className="rounded text-teal-600"
                          checked={isDone} 
                          onChange={async e => { 
                            try { 
                              await api(`/kpi/goals/${detail.id}/tasks/${t.id}`, 'PATCH', { status: e.target.checked ? 'DONE' : 'TODO' }); 
                              await open(detail.id); 
                            } catch (err) { 
                              setError(err); 
                            } 
                          }} 
                        />
                        <span className="flex-1">{t.title}</span>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Form thêm việc cần làm */}
              <form 
                className="flex items-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700" 
                onSubmit={async e => { 
                  e.preventDefault(); 
                  try { 
                    await api(`/kpi/goals/${detail.id}/tasks`, 'POST', { title: task }); 
                    setTask(''); 
                    await open(detail.id); 
                  } catch (err) { 
                    setError(err); 
                  } 
                }}
              >
                <div className="flex-1">
                  <Field label="Thêm đầu việc mới">
                    <input 
                      required 
                      className={input} 
                      placeholder="Nội dung việc cần làm..."
                      value={task} 
                      onChange={e => setTask(e.target.value)} 
                    />
                  </Field>
                </div>
                <button className={secondary}>Thêm việc</button>
              </form>
            </div>

            {/* Khu vực 3: Thành tích hỗ trợ liên kết & Trạng thái */}
            <GoalCompletion 
              key={detail.id} 
              detail={detail} 
              onReload={async () => { 
                await open(detail.id); 
                await state.reload(); 
              }} 
            />
          </div>
        )}
      </Modal>
    </Page>
  );
}

function GoalCompletion({ detail, onReload }) {
  const achievements = useCollection('/achievements');
  const [error, setError] = useState(null), [busy, setBusy] = useState(false);

  async function submit(event, kind) {
    event.preventDefault(); 
    setError(null); 
    setBusy(true);
    const fields = new FormData(event.currentTarget);
    try {
      if (kind === 'status') {
        await api('/kpi/goals/' + detail.id, 'PATCH', { status: fields.get('status') });
      } else {
        await api('/kpi/goals/' + detail.id + '/achievements', 'POST', { 
          achievement_id: Number(fields.get('achievement')), 
          contribution_value: Number(fields.get('contribution')) 
        });
      }
      await onReload();
    } catch (err) { 
      setError(err); 
    } finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
        Liên kết minh chứng & Cập nhật trạng thái
      </h3>
      <ErrorMessage error={error} />
      
      {/* Form trạng thái */}
      <form onSubmit={event => submit(event, 'status')} className="flex flex-wrap items-end gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex-1 min-w-[200px]">
          <Field label="Trạng thái mục tiêu">
            <select className={input} name="status" defaultValue={detail.status} disabled={busy}>
              {['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(status => (
                <option key={status} value={status}>{displayLabel(status)}</option>
              ))}
            </select>
          </Field>
        </div>
        <button className={secondary} disabled={busy}>Lưu trạng thái</button>
      </form>

      {/* Danh sách thành tích đã liên kết */}
      <div>
        <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          Thành tích đã liên kết làm căn cứ:
        </span>
        {!(detail.achievements || []).length ? (
          <p className="text-xs text-slate-400 italic">Chưa liên kết thành tích nào từ kho.</p>
        ) : (
          <div className="space-y-1 mb-3">
            {detail.achievements.map(item => (
              <div key={item.achievement_id} className="flex items-center justify-between p-2 rounded-lg bg-teal-50/50 text-xs text-teal-900 border border-teal-200/50">
                <span className="font-semibold truncate">{item.title}</span>
                <span className="shrink-0 font-bold ml-2">+{item.contribution_value} {detail.measure_unit}</span>
              </div>
            ))}
          </div>
        )}

        {/* Form liên kết thêm thành tích */}
        <Load state={achievements}>
          <form onSubmit={event => submit(event, 'achievement')} className="flex flex-wrap items-end gap-2 pt-2">
            <div className="flex-1 min-w-[180px]">
              <Field label="Thêm thành tích hỗ trợ">
                <select className={input} name="achievement" required disabled={busy} defaultValue="">
                  <option value="">Chọn thành tích trong kho...</option>
                  {array(achievements.data)
                    .filter(item => !(detail.achievements || []).some(link => link.achievement_id === item.id))
                    .map(item => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                </select>
              </Field>
            </div>
            <div className="w-24">
              <Field label="Đóng góp">
                <input name="contribution" type="number" required min="0.01" step="any" className={input} defaultValue="1" disabled={busy} />
              </Field>
            </div>
            <button className={secondary} disabled={busy}>Gắn kết</button>
          </form>
        </Load>
      </div>
    </div>
  );
}

const localDay = () => { 
  const date = new Date(); 
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; 
};

const effective = (version, day = localDay()) => 
  version.publication_status === 'PUBLISHED' && 
  String(version.effective_from).slice(0, 10) <= day && 
  (!version.effective_to || String(version.effective_to).slice(0, 10) >= day);

function RegulationCard({ doc, version, onEvaluate, busy }) {
  const details = useLoad(`/regulations/versions/${version.id}`);
  const [open, setOpen] = useState(false);

  return (
    <article className="vault-regulation-card">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="vault-regulation-code">{doc.code} · {version.version_label}</span>
        <StatusBadge value={version.publication_status === 'DRAFT' ? 'DRAFT' : effective(version) ? 'ACTIVE' : 'EXPIRED'} />
      </div>
      <h2>{doc.name}</h2>
      <p>{version.source_title || 'Chưa có thông tin nguồn ban hành'}</p>
      <p className="text-sm">Hiệu lực từ <DateText value={version.effective_from} />{version.effective_to && <> đến <DateText value={version.effective_to} /></>}</p>
      <p className="text-sm font-semibold text-teal-700">
        {details.loading ? 'Đang tải tiêu chí…' : details.error ? 'Không tải được số tiêu chí' : `${details.data?.groups?.length || 0} nhóm · ${details.data?.criteria?.length || 0} tiêu chí`}
      </p>
      <div className="vault-card-actions">
        <button type="button" className={secondary} onClick={() => setOpen(true)}>
          Xem chi tiết tiêu chí
        </button>
        {onEvaluate ? (
          <button type="button" className={button} disabled={busy} onClick={() => onEvaluate(version.id)}>
            Khám theo quy chế này
          </button>
        ) : version.publication_status === 'PUBLISHED' && (
          <Link className={secondary} to={`/me/ai-forecast?version=${version.id}`}>
            Khám hồ sơ ngay <ArrowRight size={15} />
          </Link>
        )}
      </div>

      {/* Modal Xem chi tiết tiêu chí - Formatted cards with badges */}
      <Modal open={open} onClose={() => setOpen(false)} title={`Danh mục tiêu chí: ${doc.name}`}>
        <Load state={details}>
          {!details.data?.criteria?.length ? (
            <Empty>Phiên bản quy chế này chưa có tiêu chí nào được cấu hình.</Empty>
          ) : (
            <div className="space-y-3.5 max-h-[68vh] overflow-y-auto pr-1">
              {details.data.criteria.map((criterion, idx) => (
                <div key={criterion.id} className="p-4 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center border border-teal-200 shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{criterion.title}</h4>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        criterion.is_required ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {criterion.is_required ? 'Bắt buộc' : 'Tùy chọn'}
                      </span>
                      {criterion.is_exclusion && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Tiêu chí loại trừ
                        </span>
                      )}
                    </div>
                  </div>
                  {criterion.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-8">
                      {criterion.description}
                    </p>
                  )}
                  {criterion.source_reference && (
                    <div className="ml-8 mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                      <FileText size={12} className="shrink-0 text-slate-400" />
                      <span>Căn cứ pháp lý: <strong className="text-slate-700 dark:text-slate-200">{criterion.source_reference}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Load>
      </Modal>
    </article>
  );
}

export { default as Regulations } from './RegulationLibrary';

/* =====================================================================
   Cơ cấu tổ chức trực quan (Tree Hierarchy)
   ===================================================================== */
function OrgHierarchyTree({ org, parentOrg, children }) {
  const [open, setOpen] = useState(false);
  if (!parentOrg && !children.length) return null;

  return (
    <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1.5"
      >
        <Network size={14} />
        <span>Cơ cấu phân tầng tổ chức</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          {/* Cấp trên (Parent) */}
          {parentOrg && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
                ↑
              </span>
              <span>Cấp trên: <strong>{parentOrg.name}</strong></span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-semibold">
                {displayLabel(parentOrg.organization_type)}
              </span>
            </div>
          )}

          {/* Đơn vị hiện tại (Active) */}
          <div className="flex items-center gap-2 pl-4 py-1 border-l-2 border-teal-500 font-bold text-teal-800 dark:text-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            <span>{org.name}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-[10px] font-bold text-teal-800 dark:text-teal-200">
              Đang chọn ({displayLabel(org.organization_type)})
            </span>
          </div>

          {/* Đơn vị trực thuộc con (Children) */}
          {children.length > 0 && (
            <div className="pl-6 space-y-1 pt-1 border-l-2 border-slate-200 dark:border-slate-700 ml-2">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                Đơn vị trực thuộc ({children.length}):
              </span>
              {children.map(child => (
                <div key={child.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <CornerDownRight size={13} className="text-slate-400 shrink-0" />
                  <span>{child.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-semibold">
                    {displayLabel(child.organization_type)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   Trang Tổ chức (Giữ nguyên các chức năng, đồng bộ style)
   ===================================================================== */
export function Organizations() {
  const state = useLoad('/organizations'), invites = useLoad('/me/invitations'), profile = useLoad('/me/profile');
  const { hasRole } = useAuth();
  const admin = hasRole('SYSTEM_ADMIN');
  const [showForm, setShowForm] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('TEAM');
  const [parent, setParent] = useState('');
  const membership = profile.data?.memberships || [];
  const grants = profile.data?.orgGrants || [];
  
  function permitted(id, permission) { 
    if (admin) return true; 
    return grants.some(grant => { 
      if (grant.permission_code !== permission) return false; 
      if (String(grant.organization_id) === String(id)) return true; 
      if (!grant.include_descendants) return false; 
      let cursor = array(state.data).find(org => String(org.id) === String(id)); 
      const seen = new Set(); 
      while(cursor?.parent_id && !seen.has(cursor.id)) { 
        seen.add(cursor.id); 
        if(String(cursor.parent_id) === String(grant.organization_id)) return true; 
        cursor = array(state.data).find(org => String(org.id) === String(cursor.parent_id)); 
      } 
      return false; 
    }); 
  }
  
  const mine = array(state.data).filter(org => admin || membership.some(m => String(m.organization_id) === String(org.id)) || grants.some(g => String(g.organization_id) === String(org.id)));
  
  async function select(id) { 
    setSelected(id); 
    setError(null); 
    try { 
      if (permitted(id, 'MEMBERS_VIEW')) setMembers(array(await api(`/organizations/${id}/members`))); 
      else setMembers([]); 
      // Cuộn mượt đến không gian tổ chức vừa mở
      setTimeout(() => {
        const el = document.getElementById('active-org-workspace');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch(err) { 
      setMembers([]); 
      setError(err); 
    } 
  }
  
  async function respond(id, accept) { 
    try { 
      await api(`/invitations/${id}/respond`, 'POST', { accept }); 
      await invites.reload(); 
      await state.reload(); 
      await profile.reload(); 
    } catch(err) { 
      setError(err); 
    } 
  }

  const selectedOrg = array(state.data).find(o => o.id === selected);

  return (
    <Page 
      title="Tổ chức" 
      description="Không gian của các tổ chức bạn tham gia và những đơn vị bạn được giao quản lý." 
      actions={
        <div className="flex items-center gap-2">
          <button className={secondary} onClick={() => setShowInvites(true)}>
            Lời mời tham gia ({array(invites.data).filter(i => i.status === 'PENDING').length})
          </button>
          <button className={button} onClick={() => setShowForm(true)}>
            <Plus size={16} />
            <span>{admin ? 'Tạo tổ chức' : 'Tạo nhóm độc lập'}</span>
          </button>
        </div>
      }
    >
      <ErrorMessage error={error} />

      {/* KHÔNG GIAN TỔ CHỨC ĐƯỢC CHỌN (HIỂN THỊ RÕ RÀNG VỚI NÚT ĐÓNG NỔI BẬT) */}
      {selected && selectedOrg && (
        <section id="active-org-workspace" className="p-6 mb-6 rounded-3xl bg-white dark:bg-slate-800 border-2 border-teal-600 shadow-xl space-y-5 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 flex items-center justify-center font-bold text-lg">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{selectedOrg.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">
                    {displayLabel(selectedOrg.organization_type)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Mã đơn vị: {selectedOrg.code}</p>
              </div>
            </div>

            <button 
              type="button" 
              className="soft-btn-secondary text-xs px-3.5 py-2 inline-flex items-center gap-1.5 font-bold hover:bg-slate-200 transition-colors"
              onClick={() => setSelected(null)}
            >
              <X size={16} /> Đóng không gian
            </button>
          </div>

          {permitted(selected, 'MEMBERS_VIEW') ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Danh sách thành viên ({members.length})
                </h3>
              </div>
              
              {!members.length ? (
                <p className="text-xs text-slate-500 italic p-4 text-center border border-dashed rounded-xl">Chưa có thành viên nào trong đơn vị này.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {members.map(member => (
                    <div key={member.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900 flex justify-between items-center text-xs">
                      <div className="truncate mr-2">
                        <strong className="block font-bold text-slate-800 dark:text-slate-100 truncate">{member.full_name}</strong>
                        <span className="text-[11px] text-slate-400 truncate block">{member.email} {member.title && `· ${member.title}`}</span>
                      </div>
                      {permitted(selected, 'MEMBERS_MANAGE') && (
                        <button 
                          type="button" 
                          className="text-rose-600 hover:text-rose-700 font-semibold p-1 hover:bg-rose-50 rounded shrink-0" 
                          onClick={async () => { 
                            if (!window.confirm(`Loại thành viên “${member.full_name}” khỏi tổ chức?`)) return; 
                            try { 
                              await api(`/organizations/${selected}/members/${member.id}`, 'DELETE'); 
                              await select(selected); 
                            } catch(err) { 
                              setError(err); 
                            } 
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {permitted(selected, 'MEMBERS_MANAGE') && (
                <form className="mt-4 p-4 rounded-2xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 flex flex-wrap items-end gap-3" onSubmit={async e => { e.preventDefault(); try { await api(`/organizations/${selected}/invitations`, 'POST', { email }); setEmail(''); await select(selected); setMessage('Đã gửi lời mời thành công!'); } catch(err) { setError(err); } }}>
                  <div className="flex-1 min-w-[220px]">
                    <Field label="Mời thành viên mới tham gia (Nhập Email)">
                      <input type="email" required placeholder="nhanvien@lhu.edu.vn" className={input} value={email} onChange={e => setEmail(e.target.value)} />
                    </Field>
                  </div>
                  <button className={button}>Gửi lời mời</button>
                </form>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
              Bạn đang tham gia tổ chức này với quyền xem cơ bản. Liên hệ ban quản lý để được cấp thêm quyền quản trị.
            </p>
          )}

          {selected && ['ACCESS_MANAGE', 'STRUCTURE_MANAGE', 'ASSESSMENTS_RUN'].some(permission => permitted(selected, permission)) && (
            <OrganizationTools 
              permissions={{ 
                scan: permitted(selected, 'ASSESSMENTS_RUN') && permitted(selected, 'ASSESSMENTS_VIEW'), 
                structure: permitted(selected, 'STRUCTURE_MANAGE'), 
                access: permitted(selected, 'ACCESS_MANAGE') 
              }} 
              key={selected} 
              organizationId={selected} 
              organizations={array(state.data)} 
              members={members} 
            />
          )}
        </section>
      )}

      {/* DANH SÁCH CÁC TỔ CHỨC CỦA BẠN */}
      <section className={panel}>
        <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100">Tổ chức của bạn</h2>
        <Load state={profile}>
          <Load state={state}>
            {!mine.length ? (
              <Empty action={<button className={secondary} onClick={() => setShowInvites(true)}>Xem lời mời tham gia</button>}>
                Bạn chưa tham gia tổ chức nào. Hãy kiểm tra lời mời hoặc tạo nhóm độc lập.
              </Empty>
            ) : (
              <div className="vault-card-grid">
                {mine.map(org => { 
                  const role = membership.find(m => String(m.organization_id) === String(org.id)); 
                  const parentOrg = array(state.data).find(o => String(o.id) === String(org.parent_id)); 
                  const children = array(state.data).filter(o => String(o.parent_id) === String(org.id)); 
                  const isSelected = selected === org.id;

                  return (
                    <article 
                      className={`vault-organization-card ${isSelected ? 'ring-2 ring-teal-600 bg-teal-50/20 dark:bg-teal-950/20' : ''}`} 
                      key={org.id}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {displayLabel(org.organization_type)}
                        </span>
                        <span className="vault-status">
                          {admin ? 'Quản trị hệ thống' : role?.title || (grants.some(g => String(g.organization_id) === String(org.id)) ? 'Được cấp quyền quản lý' : 'Thành viên')}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 mt-1">{org.name}</h3>
                      <p className="text-xs font-mono text-slate-400">Mã: {org.code}</p>

                      {/* Phân tầng cơ cấu trực quan (Tree) */}
                      <OrgHierarchyTree org={org} parentOrg={parentOrg} children={children} />

                      {/* Nút Mở không gian tổ chức - Nổi bật, dễ nhận biết */}
                      <div className="vault-card-actions pt-2 mt-auto">
                        <button 
                          type="button"
                          className="soft-btn-primary w-full text-xs font-bold inline-flex items-center justify-center gap-2 py-2.5" 
                          onClick={() => select(org.id)}
                        >
                          <Building2 size={15} />
                          <span>Mở không gian tổ chức</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </article>
                  ); 
                })}
              </div>
            )}
          </Load>
        </Load>
      </section>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={admin ? 'Tạo tổ chức' : 'Tạo nhóm độc lập'}>
        <ErrorMessage error={error} />
        {!admin && <p className="mb-4 text-xs text-slate-500">Bạn có thể tạo nhóm độc lập. Tạo đơn vị trực thuộc yêu cầu quyền quản lý cơ cấu của tổ chức cha.</p>}
        <form className="space-y-4" onSubmit={async e => { e.preventDefault(); try { await api('/organizations', 'POST', { name, code, organizationType: type, parentId: parent ? Number(parent) : null }); setName(''); setCode(''); setShowForm(false); await state.reload(); await profile.reload(); } catch (err) { setError(err); } }}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên"><input required className={input} value={name} onChange={e => setName(e.target.value)} /></Field>
            <Field label="Mã"><input required className={input} value={code} onChange={e => setCode(e.target.value)} /></Field>
            <Field label="Loại">
              <select className={input} value={type} onChange={e => setType(e.target.value)}>
                {(admin ? ['OTHER','UNIVERSITY','FACULTY','DEPARTMENT','CLASS','COMPANY','TEAM'] : ['TEAM','OTHER']).map(t => <option key={t} value={t}>{displayLabel(t)}</option>)}
              </select>
            </Field>
            <Field label="Tổ chức cha">
              <select className={input} value={parent} onChange={e => setParent(e.target.value)}>
                <option value="">Không có</option>
                {array(state.data).filter(org => permitted(org.id,'STRUCTURE_MANAGE')).map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondary} onClick={() => setShowForm(false)}>Hủy</button>
            <button className={button}>Tạo tổ chức</button>
          </div>
        </form>
      </Modal>

      <Modal open={showInvites} onClose={() => setShowInvites(false)} title="Lời mời tham gia">
        <Load state={invites}>
          {!array(invites.data).length ? (
            <Empty>Chưa có lời mời. Người quản lý tổ chức có thể mời bạn bằng email tài khoản.</Empty>
          ) : (
            array(invites.data).map(inv => (
              <Item key={inv.id}>
                <p><strong>{inv.organization_name}</strong> · <StatusBadge value={inv.status} /></p>
                {inv.status === 'PENDING' && (
                  <div className="mt-3 flex gap-2">
                    <button className={button} onClick={() => respond(inv.id,true)}>Đồng ý</button>
                    <button className={secondary} onClick={() => respond(inv.id,false)}>Từ chối</button>
                  </div>
                )}
              </Item>
            ))
          )}
        </Load>
      </Modal>
    </Page>
  );
}

function OrganizationTools({ organizationId, organizations, members, permissions }) {
  const docs = useLoad('/regulations/documents'), links = useLoad(`/organizations/${organizationId}/link-requests`);
  const [version, setVersion] = useState(''), [descendants, setDescendants] = useState(false), [results, setResults] = useState(null), [parent, setParent] = useState(''), [error, setError] = useState(null), [message, setMessage] = useState('');
  const versions = array(docs.data).flatMap(doc => (doc.versions || []).filter(v => v.publication_status === 'PUBLISHED').map(v => ({ ...v, name: doc.name })));
  
  return (
    <section className={`${panel} space-y-4 mt-6`}>
      <h2 className="text-lg font-bold">Công cụ quản lý tổ chức</h2>
      <ErrorMessage error={error} />
      {message && <p role="status" className="p-3 rounded-xl bg-teal-50 text-teal-800 text-xs font-semibold">{message}</p>}
      
      {permissions.scan && (
        <div className="space-y-3">
          <Field label="Quy chế để khám thành viên">
            <select className={input} value={version} onChange={e => setVersion(e.target.value)}>
              <option value="">Chọn quy chế</option>
              {versions.map(v => <option key={v.id} value={v.id}>{v.name} · {v.version_label}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={descendants} onChange={e => setDescendants(e.target.checked)} className="rounded text-teal-600" />
            Bao gồm các đơn vị tổ chức con
          </label>
          <button className={button} disabled={!version} onClick={async () => { try { setError(null); setResults(array(await api(`/organizations/units/${organizationId}/ai-scan`, 'POST', { regulation_version_id: Number(version), include_descendants: descendants }))); } catch (err) { setError(err); } }}>
            Khám hồ sơ thành viên
          </button>
          
          {results && (
            !results.length ? <Empty>Không có thành viên trong phạm vi đã chọn.</Empty> : (
              <div className="space-y-2 mt-2">
                {results.map(run => (
                  <Item key={run.id}>
                    <p className="font-semibold text-xs">
                      {members.find(m => String(m.user_id) === String(run.subject_user_id))?.full_name || `Thành viên #${run.subject_user_id}`} · {conclusionLabel(run.conclusion)} ({run.completion_percent}% hoàn thành)
                    </p>
                    <button className="mt-2 text-xs text-teal-700 underline font-semibold" onClick={async () => { try { await api(`/organizations/${organizationId}/notifications`, 'POST', { title: 'Kết quả khám hồ sơ', body: `Hồ sơ của bạn đã được đối chiếu với quy chế. Kết quả: ${conclusionLabel(run.conclusion)}.`, userIds: [Number(run.subject_user_id)], includeDescendants: descendants }); setMessage('Đã gửi thông báo cho thành viên.'); } catch (err) { setError(err); } }}>
                      Gửi thông báo kết quả cho thành viên
                    </button>
                  </Item>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {permissions.structure && (
        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="font-semibold text-sm">Liên kết tổ chức</h3>
          <p className="text-xs text-slate-500 mt-0.5">Đề nghị gắn với tổ chức cha hoặc tách khỏi cha hiện tại.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Field label="Tổ chức cha đề nghị">
                <select className={input} value={parent} onChange={e => setParent(e.target.value)}>
                  <option value="">Tách khỏi tổ chức cha</option>
                  {organizations.filter(o => String(o.id) !== String(organizationId)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
            </div>
            <button className={secondary} onClick={async () => { try { await api(`/organizations/${organizationId}/link-requests`, 'POST', { targetParentId: parent ? Number(parent) : null }); setMessage('Đã gửi yêu cầu liên kết.'); await links.reload(); } catch (err) { setError(err); } }}>
              Gửi yêu cầu
            </button>
          </div>
        </div>
      )}

      {permissions.access && <OrganizationAccess organizationId={organizationId} members={members} />}
    </section>
  );
}

function OrganizationAccess({ organizationId, members }) {
  const state = useLoad(`/organizations/${organizationId}/access`), [userId, setUserId] = useState(''), [permissionCode, setPermission] = useState('MEMBERS_VIEW'), [includeDescendants, setDescendants] = useState(false), [error, setError] = useState(null);
  const labels = { MEMBERS_VIEW: 'Xem thành viên', ASSESSMENTS_VIEW: 'Xem kết quả khám', ASSESSMENTS_RUN: 'Khám hồ sơ', MEMBERS_NOTIFY: 'Gửi thông báo', MEMBERS_MANAGE: 'Quản lý thành viên', STRUCTURE_MANAGE: 'Quản lý cơ cấu', ACCESS_MANAGE: 'Quản lý quyền' };
  if (state.error?.status === 403) return null;
  
  return (
    <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
      <h3 className="font-semibold text-sm mb-2">Phân quyền trong tổ chức</h3>
      <ErrorMessage error={error} />
      <Load state={state}>
        <div className="space-y-1.5">
          {array(state.data).map(grant => (
            <div key={grant.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs">
              <span>{grant.full_name || grant.email} · <strong>{labels[grant.permission_code] || grant.permission_code}</strong>{grant.include_descendants ? ' · gồm tổ chức con' : ''}</span>
              <button className="text-rose-600 hover:underline" onClick={async () => { try { await api(`/organizations/${organizationId}/access/${grant.id}`, 'DELETE'); await state.reload(); } catch (err) { setError(err); } }}>
                Thu hồi
              </button>
            </div>
          ))}
        </div>
      </Load>
      <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={async e => { e.preventDefault(); try { await api(`/organizations/${organizationId}/access`, 'POST', { userId: Number(userId), permissionCode, includeDescendants }); setUserId(''); await state.reload(); } catch (err) { setError(err); } }}>
        <Field label="Thành viên">
          <select className={input} required value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">Chọn thành viên</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name} · {m.email}</option>)}
          </select>
        </Field>
        <Field label="Quyền">
          <select className={input} value={permissionCode} onChange={e => setPermission(e.target.value)}>
            {Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={includeDescendants} onChange={e => setDescendants(e.target.checked)} className="rounded text-teal-600" />
            Bao gồm tổ chức con
          </label>
          <button className={button}>Cấp quyền</button>
        </div>
      </form>
    </div>
  );
}

/* =====================================================================
   Trang Public CV & Báo cáo & Admin
   ===================================================================== */
export function PublicCv() {
  const { slug } = useParams(), state = useLoad(`/public/cv/${encodeURIComponent(slug)}`);
  return (
    <main className="min-h-screen bg-slate-50 p-5 sm:p-10 text-slate-800">
      <div className={`mx-auto max-w-3xl bg-white p-6 sm:p-10 ${
        state.data?.templateId === "Academic" 
          ? "font-serif border-t-8 border-slate-800" 
          : state.data?.templateId === "Minimalist" 
          ? "border border-slate-200" 
          : "rounded-xl shadow-lg border-t-8 border-teal-700"
      }`}>
        <Load state={state}>
          <h1 className="text-3xl font-bold">{state.data?.contact?.fullName || 'CV cá nhân'}</h1>
          <p className="mt-2 text-lg text-teal-700 font-semibold">{state.data?.headline}</p>
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">{state.data?.bio}</p>
          {(state.data?.contact?.email || state.data?.contact?.phone) && (
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              {state.data?.contact?.email && <p>Email: {state.data.contact.email}</p>}
              {state.data?.contact?.phone && <p>Điện thoại: {state.data.contact.phone}</p>}
            </div>
          )}
          <h2 className="mt-8 text-xl font-bold border-b border-slate-200 pb-2">Thành tích & Dấu mốc</h2>
          {!state.data?.achievements?.length ? (
            <Empty>Chưa có thành tích được chia sẻ.</Empty>
          ) : (
            <div className="space-y-3 mt-4">
              {state.data.achievements.map(item => (
                <div key={item.id || item.achievementId} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="font-bold text-sm text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{[item.type, item.recognitionYear].filter(Boolean).join(' · ')}</p>
                </div>
              ))}
            </div>
          )}
        </Load>
      </div>
    </main>
  );
}

export function Reports() {
  const state = useCollection('/achievements');
  const items = array(state.data), years = {}, types = {};
  for (const item of items) { 
    const year = String(item.achievedAt).slice(0,4); 
    years[year] = (years[year] || 0) + 1; 
    const type = item.typeName || 'Chưa phân loại'; 
    types[type] = (types[type] || 0) + 1; 
  }
  const yearly = Object.entries(years).sort(([a],[b]) => a.localeCompare(b)), categories = Object.entries(types).sort((a,b) => b[1]-a[1]), maximum = Math.max(1,...Object.values(years));
  const colors = ['#0f766e','#1d4ed8','#b45309','#be185d','#475569','#15803d']; 
  let offset = 0;
  const segments = categories.map(([name,count],index) => { 
    const start = offset; 
    offset += count / items.length * 100; 
    return { name, count, color: colors[index % colors.length], start, end: offset }; 
  });

  return (
    <Page title="Thống kê & Báo cáo" description="Phân bố thành tích theo năm và loại, được tổng hợp từ toàn bộ kho của bạn." actions={<Link className={secondary} to="/achievements"><Award size={15} /> Về kho thành tích</Link>}>
      <Load state={state}>
        {!items.length ? (
          <section className={panel}>
            <Empty action={<Link className={button} to="/achievements">Thêm thành tích đầu tiên</Link>}>
              Chưa có dữ liệu để lập báo cáo.
            </Empty>
          </section>
        ) : (
          <>
            <p className="vault-report-summary">Đang thống kê <strong>{items.length} thành tích</strong> trong <strong>{yearly.length} năm</strong>, thuộc <strong>{categories.length} loại</strong>.</p>
            <div className="vault-report-grid">
              <section className={panel}>
                <h2 className="text-lg font-bold mb-3">Thành tích theo năm</h2>
                <div className="vault-bar-chart" role="img" aria-label={yearly.map(([year,count]) => `${year}: ${count} thành tích`).join('; ')}>
                  {yearly.map(([year,count]) => (
                    <div className="vault-bar-column" key={year}>
                      <strong>{count}</strong>
                      <div className="vault-bar-track"><span style={{height:`${count/maximum*100}%`}} /></div>
                      <span>{year}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className={panel}>
                <h2 className="text-lg font-bold mb-3">Tỷ lệ theo loại thành tích</h2>
                <div className="vault-donut-layout">
                  <div className="vault-donut-chart" role="img" aria-label={segments.map(s => `${s.name}: ${s.count}, ${Math.round(s.count/items.length*100)}%`).join('; ')} style={{background:`conic-gradient(${segments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(',')})`}}>
                    <span>{items.length}<small>thành tích</small></span>
                  </div>
                  <ul className="vault-chart-legend">
                    {segments.map(s => (
                      <li key={s.name}>
                        <span className="vault-legend-dot" style={{backgroundColor:s.color}} aria-hidden="true" />
                        <span>{s.name}</span>
                        <strong>{s.count} · {Math.round(s.count/items.length*100)}%</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
            <section className={`${panel} mt-6`}>
              <h2 className="text-lg font-bold mb-4">Dữ liệu tổng hợp theo năm</h2>
              <div className="vault-table-wrap">
                <table className="vault-table">
                  <thead>
                    <tr><th scope="col">Năm</th><th scope="col">Số thành tích</th><th scope="col">Tỷ trọng</th></tr>
                  </thead>
                  <tbody>
                    {yearly.map(([year,count]) => (
                      <tr key={year}>
                        <th scope="row">{year}</th>
                        <td>{count}</td>
                        <td>{Math.round(count/items.length*100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </Load>
    </Page>
  );
}

export function Admin() {
  const users = useLoad('/admin/users'), roles = useLoad('/admin/global-roles'), [userId, setUserId] = useState(''), [roleCode, setRole] = useState('REGULATION_MANAGER'), [error, setError] = useState(null);
  return (
    <Page title="Quản trị hệ thống" description="Quản lý tài khoản và quyền toàn hệ thống.">
      <ErrorMessage error={error} />
      <section className={panel}>
        <h2 className="font-bold text-lg mb-3">Danh sách tài khoản</h2>
        <Load state={users}>
          {!array(users.data).length ? (
            <Empty>Chưa có tài khoản.</Empty>
          ) : (
            <div className="space-y-2">
              {array(users.data).map(user => (
                <div key={user.id} className="flex flex-wrap items-center justify-between p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 text-xs">
                  <span><strong>{user.full_name}</strong> · {user.email} · <StatusBadge value={user.account_status} /></span>
                  <button className={secondary} onClick={async () => { try { await api(`/admin/users/${user.id}`, 'PATCH', { accountStatus: user.account_status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }); await users.reload(); } catch (err) { setError(err); } }}>
                    {user.account_status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Load>
      </section>

      <section className={`${panel} mt-6`}>
        <h2 className="font-bold text-lg mb-3">Phân quyền toàn hệ thống</h2>
        <Load state={roles}>
          <div className="space-y-2">
            {array(roles.data).map(grant => (
              <div key={grant.id} className="flex flex-wrap justify-between items-center p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 text-xs">
                <span><strong>{grant.full_name || grant.email}</strong> · <StatusBadge value={grant.role_code} /></span>
                <button className="text-rose-600 hover:underline font-semibold" onClick={async () => { try { await api(`/admin/global-roles/${grant.id}`, 'DELETE'); await roles.reload(); } catch (err) { setError(err); } }}>
                  Thu hồi quyền
                </button>
              </div>
            ))}
          </div>
        </Load>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={async e => { e.preventDefault(); try { await api('/admin/global-roles', 'POST', { userId: Number(userId), roleCode }); setUserId(''); await roles.reload(); } catch (err) { setError(err); } }}>
          <Field label="Tài khoản">
            <select className={input} required value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="">Chọn tài khoản</option>
              {array(users.data).map(user => <option key={user.id} value={user.id}>{user.full_name} · {user.email}</option>)}
            </select>
          </Field>
          <Field label="Quyền hạn">
            <select className={input} value={roleCode} onChange={e => setRole(e.target.value)}>
              <option value="REGULATION_MANAGER">Quản lý quy chế</option>
              <option value="SYSTEM_ADMIN">Quản trị hệ thống</option>
            </select>
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <button className={button}>Cấp quyền quản trị</button>
          </div>
        </form>
      </section>

      <div className="mt-6">
        <AchievementCatalog />
      </div>
    </Page>
  );
}

function AchievementCatalog() {
  const state = useLoad('/achievements/catalogs'), [code, setCode] = useState(''), [name, setName] = useState(''), [error, setError] = useState(null);
  return (
    <section className={panel}>
      <h2 className="font-bold text-lg mb-1">Danh mục loại thành tích</h2>
      <p className="text-xs text-slate-500 mb-3">Dùng để phân loại thành tích và cấu hình tiêu chí quy chế toàn trường.</p>
      <ErrorMessage error={error} />
      <Load state={state}>
        {!(state.data?.achievementTypes || []).length ? (
          <Empty>Chưa có loại thành tích.</Empty>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
            {state.data.achievementTypes.map(item => (
              <div key={item.id} className="p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 text-xs">
                <strong className="block text-slate-800 dark:text-slate-100">{item.name}</strong>
                <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>
              </div>
            ))}
          </div>
        )}
      </Load>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={async e => { e.preventDefault(); try { setError(null); await api('/achievements/catalogs', 'POST', { code, name }); setCode(''); setName(''); await state.reload(); } catch (err) { setError(err); } }}>
        <Field label="Mã loại"><input required className={input} value={code} onChange={e => setCode(e.target.value)} placeholder="Ví dụ: SCIENTIFIC_PAPER" /></Field>
        <Field label="Tên loại"><input required className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Bài báo khoa học quốc tế" /></Field>
        <div className="md:col-span-2 flex justify-end">
          <button className={button}>Thêm loại thành tích</button>
        </div>
      </form>
    </section>
  );
}
