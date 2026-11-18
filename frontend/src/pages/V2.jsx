import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { detailLabels, numericDetails, basicDetailKeys, primaryLabels, displayAchievementTitle, dynamicAchievementFields, suggestedAchievementFields, formatAchievementValue } from './achievementFields';
import RegulationRuleDescription from './RegulationRuleDescription';
import { assessmentContexts, effective } from './assessmentSelection';
import { request } from '../services/request';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/VaultDialog';
import VaultTabs from '../components/common/VaultTabs';
import NumberedPagination from '../components/common/NumberedPagination';
import { 
  ArrowRight, FolderOpen, Plus, X, Paperclip, Eye, Pencil, Trash2, 
  BarChart3, Sparkles, UploadCloud, CheckCircle2, AlertCircle, 
  Calendar, Award, FileText, FileArchive, Target, ExternalLink, 
  FileDown, BookOpen, RotateCcw, Check, CheckSquare, Square, 
  Sliders, ChevronDown, ChevronUp, Clock, Network, CornerDownRight, Building2,
  Copy, QrCode
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
  'Khám hồ sơ': ['/regulations', 'Xem kho quy chế', BookOpen],
  'Mục tiêu / KPI': ['/me/ai-forecast', 'Đối chiếu quy chế', Sparkles],
  'Kho quy chế': ['/me/ai-forecast', 'Đối chiếu quy chế', Sparkles],
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

function useCollection(url) {
  const [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => { 
    const current = ++generation.current;
    if (!url) { setData(null); setError(null); setLoading(false); return; }
    if (!url) { setData(null); setError(null); setLoading(false); return; }
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
    <label className="vault-field block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      {children}
    </label>
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
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
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
  if (state.loading) return <div className="vault-loading" role="status">
    <div aria-hidden="true" className="vault-loading-line" />
    <div aria-hidden="true" className="vault-loading-line is-short" />
    <span className="vault-meta">Đang tải dữ liệu…</span>
  </div>;
  if (state.error) return <div className="space-y-2">
    <ErrorMessage error={state.error} />
    {state.reload && <button type="button" className={secondary} onClick={state.reload}>Thử tải lại</button>}
  </div>;
  return children;
}

function Item({ children }) { return <div className="vault-item">{children}</div>; }

function DateText({ value }) {
  const date = String(value || '').slice(0, 10);
  return date ? <time dateTime={date}>{date.split('-').reverse().join('/')}</time> : null;
}

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
  const missingBranch = Array.isArray(details.children) && !details.children.some(child => child.conclusion === 'MET')
    && details.children.some(child => child.conclusion === 'INSUFFICIENT_DATA' && missingText(child.missing));
  if (details.unknown_attributes || missingBranch) return 'Một số thông tin thành tích còn thiếu; hãy kiểm tra và bổ sung hồ sơ.';
  if (typeof details.remaining === 'number' && details.remaining > 0) return `Còn thiếu ${details.remaining} so với yêu cầu.`;
  return '';
}

export function Profile() {
  const state = useLoad('/me/profile');
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  
  const tab = ['personal', 'cv', 'security'].includes(params.get('tab')) ? params.get('tab') : 'personal';
  const [cvVisited, setCvVisited] = useState(tab === 'cv');
  useEffect(() => { if (tab === 'cv') setCvVisited(true); }, [tab]);
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
      <VaultTabs
        items={[
          ["personal", "Thông tin cá nhân"],
          ["cv", "Thiết kế & Xuất CV"],
          ["security", "Bảo mật tài khoản"]
        ]} 
        value={tab} 
        onChange={setTab} label="Hồ sơ và CV"
      >
        {tab === 'personal' && (
          <Load state={state}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Cột trái: Thẻ định danh cá nhân */}
              <div className="lg:col-span-4 soft-card p-5 flex flex-col items-start">
                <div className="h-12 w-12 rounded-xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 flex items-center justify-center text-xl font-bold mb-3">
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
                  Chỉnh sửa CV
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
        {(cvVisited || tab === 'cv') && <div hidden={tab !== 'cv'}><Cv embedded /></div>}
        {tab === 'security' && <PasswordForm />}
      </VaultTabs>
    </Page>
  );
}

function PasswordForm() {
  const { changePassword } = useAuth();
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const mismatch = Boolean(confirm) && newPassword !== confirm;
  const type = show ? 'text' : 'password';

  async function submit(event) {
    event.preventDefault();
    if (mismatch || busy) return;
    setError(null);
    setBusy(true);
    try { await changePassword({ oldPassword, newPassword }); }
    catch (err) { setError(err); }
    finally { setBusy(false); }
  }

  return <form className={panel + ' max-w-3xl space-y-4'} onSubmit={submit}>
    <h2 className="text-lg font-semibold">Đổi mật khẩu</h2>
    <p className="vault-meta">Sau khi đổi mật khẩu, bạn cần đăng nhập lại.</p>
    <ErrorMessage error={error} />
    <Field label="Mật khẩu hiện tại"><input type={type} autoComplete="current-password" required className={input} value={oldPassword} onChange={e => setOld(e.target.value)} /></Field>
    <Field label="Mật khẩu mới"><input type={type} autoComplete="new-password" minLength={8} required className={input} value={newPassword} onChange={e => setNew(e.target.value)} /><span className="vault-meta">Ít nhất 8 ký tự.</span></Field>
    <Field label="Xác nhận mật khẩu mới"><input type={type} autoComplete="new-password" required className={input} value={confirm} onChange={e => setConfirm(e.target.value)} aria-invalid={mismatch} aria-describedby={mismatch ? 'password-mismatch' : undefined} /></Field>
    {mismatch && <p id="password-mismatch" className="text-sm text-rose-700 dark:text-rose-300">Mật khẩu xác nhận không khớp.</p>}
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Hiện mật khẩu</label>
    <button className={button} disabled={busy || mismatch}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</button>
  </form>;
}

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
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState(null);
  const [cvView, setCvView] = useState('edit');
  const [achievementQuery, setAchievementQuery] = useState('');
  const [achievementType, setAchievementType] = useState('');
  const [confirmVisibility, setConfirmVisibility] = useState(false);
  const [saving, setSaving] = useState(false);
  const achievementRows = array(achievements.data);
  const achievementTypes = [...new Set(achievementRows.map(item => item.typeName).filter(Boolean))].sort();
  const matchingAchievements = achievementRows.filter(item => (!achievementType || item.typeName === achievementType)
    && item.title.toLocaleLowerCase('vi').includes(achievementQuery.trim().toLocaleLowerCase('vi')));

  const [publishedCv, setPublishedCv] = useState(null);
  const publicCvUrl = publishedCv?.isPublic && publishedCv.slug ? `${window.location.origin}/cv/${encodeURIComponent(publishedCv.slug)}` : '';

  useEffect(() => {
    if (!showQr || !publicCvUrl) return;
    let active = true;
    import('qrcode').then(({ default: generator }) => generator.toDataURL(publicCvUrl, { width: 240 }))
      .then(src => { if (active) setQr({ url: publicCvUrl, src }); })
      .catch(() => { if (active) setQr({ url: publicCvUrl, error: true }); });
    return () => { active = false; };
  }, [showQr, publicCvUrl]);

  const copyCvLink = async () => {
    if (!publicCvUrl) return;
    try {
      await navigator.clipboard.writeText(publicCvUrl);
      setCopied(true);
      setMessage('Đã sao chép liên kết CV vào bộ nhớ tạm!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('Sao chép đường dẫn CV:', publicCvUrl);
    }
  };

  useEffect(() => { 
    if (state.data) {
      const validTemplate = ['Modern', 'Academic', 'Minimalist'].includes(state.data.templateId) 
        ? state.data.templateId 
        : 'Modern';
      setPublishedCv(state.data);
      setForm(old => ({ 
        ...old, 
        ...state.data, 
        templateId: validTemplate,
        selectedAchievementIds: state.data.selectedAchievementIds || [], 
        contact: state.data.contact || {},
        showEmail: !!state.data.showEmail,
        showPhone: !!state.data.showPhone,
        isPublic: !!state.data.isPublic,
      })); 
    }
  }, [state.data]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage('');
    try { 
      const validTemplate = ['Modern', 'Academic', 'Minimalist'].includes(form.templateId) 
        ? form.templateId 
        : 'Modern';
      const result = await api('/me/cv', 'PUT', { 
        slug: form.slug ? form.slug.trim().toLowerCase() : null, 
        templateId: validTemplate, 
        isPublic: !!form.isPublic, 
        headline: form.headline || '', 
        bio: form.bio || '', 
        selectedAchievementIds: (form.selectedAchievementIds || []).map(Number).filter(n => !isNaN(n) && n > 0), 
        showEmail: !!form.showEmail, 
        showPhone: !!form.showPhone 
      }); 
      setConfirmVisibility(false);
      setPublishedCv(result);
      setForm(old => ({ ...old, ...result, templateId: validTemplate })); 
      setMessage('Đã lưu cấu hình CV thành công. CV của bạn đã được cập nhật.'); 
      setError(null); 
    } catch (err) { 
      setError(err);
    } finally { setSaving(false); }
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
      
      <div className="mb-4 flex flex-wrap gap-2 lg:hidden" aria-label="Chế độ CV">
        <button className={secondary} type="button" aria-pressed={cvView === 'edit'} onClick={() => setCvView('edit')}>Chỉnh sửa</button>
        <button className={secondary} type="button" aria-pressed={cvView === 'preview'} onClick={() => setCvView('preview')}>Xem trước</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái (7 cols): Form cấu hình CV */}
        <form className={"lg:col-span-7 soft-card p-6 space-y-5 lg:block " + (cvView === 'preview' ? 'hidden' : '')} onSubmit={event => { event.preventDefault(); if (Boolean(form.isPublic) !== Boolean(publishedCv?.isPublic)) { setError(null); setConfirmVisibility(true); } else save(); }}>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
              Cấu hình & Tùy biến CV
            </h3>
            <p className="text-xs text-slate-500">
              Chỉnh sửa thông tin xuất bản và lựa chọn các thành tích sẽ xuất hiện trên CV.
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Đường link CV của bạn (URL chia sẻ)">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 select-all shrink-0">
                    {window.location.origin}/cv/
                  </span>
                  <input 
                    className={input} 
                    placeholder="nguyen-van-a (để trống sẽ tạo tự động)" 
                    value={form.slug || ''} 
                    onChange={e => setForm({ ...form, slug: e.target.value })} 
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Đường dẫn này dùng để gửi cho nhà tuyển dụng hoặc dán vào hồ sơ xin học bổng mà không cần đăng nhập.
                </p>
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
                <span className="text-[11px] text-slate-400">Chọn thành tích để hiển thị trên CV</span>
              </div>
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <Field label="Tìm thành tích"><input type="search" className={input} value={achievementQuery} onChange={event => setAchievementQuery(event.target.value)} /></Field>
                <Field label="Loại thành tích"><select className={input} value={achievementType} onChange={event => setAchievementType(event.target.value)}><option value="">Tất cả loại</option>{achievementTypes.map(type => <option key={type}>{type}</option>)}</select></Field>
              </div>
              <Load state={achievements}>
                {!array(achievements.data).length ? (
                  <Empty>Chưa có thành tích trong kho để chọn.</Empty>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {!matchingAchievements.length && <p className="vault-meta">Không tìm thấy thành tích phù hợp.</p>}
                    {matchingAchievements.map(item => {
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
                            <strong className="block break-words font-semibold">{item.title}</strong>
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
            <button className={button} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu cấu hình CV'}</button>
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
            {publicCvUrl && (
              <>
                <button 
                  type="button" 
                  onClick={copyCvLink} 
                  className="soft-btn-secondary inline-flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300 font-semibold"
                  title="Sao chép đường link CV để gửi cho nhà tuyển dụng"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Đã sao chép link!' : 'Sao chép link CV'}</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowQr(true)} 
                  className="soft-btn-secondary inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200"
                  title="Mở mã QR Code để quét xem trên điện thoại"
                >
                  <QrCode size={14} />
                  <span>Mã QR</span>
                </button>
                <a 
                  className="soft-btn-secondary inline-flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300 font-semibold" 
                  href={publicCvUrl}
                  target="_blank" 
                  rel="noreferrer"
                >
                  <ExternalLink size={14} /> Mở CV công khai
                </a>
              </>
            )}
          </div>
        </form>

        {/* Cột phải (5 cols): Xem trước trực quan A4 Live Preview */}
        <div className={"lg:col-span-5 lg:sticky lg:top-6 lg:block " + (cvView === 'edit' ? 'hidden' : '')}>
          <CvLivePreview form={form} achievements={array(achievements.data)} />
        </div>
      </div>

      <Modal open={confirmVisibility} title={form.isPublic ? 'Công khai CV' : 'Ẩn CV công khai'} onClose={() => { if (!saving) setConfirmVisibility(false); }}>
        <div className="space-y-4">
          <p>{form.isPublic ? 'Người có liên kết sẽ xem được CV và thành tích bạn đã chọn.' : 'Liên kết công khai sẽ ngừng hiển thị CV.'}</p>
          {form.isPublic && <p className="vault-meta">Thông tin liên hệ hiển thị: {[form.showEmail && 'email', form.showPhone && 'số điện thoại'].filter(Boolean).join(', ') || 'không hiện email hoặc số điện thoại'}.</p>}
          <ErrorMessage error={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} disabled={saving} onClick={() => setConfirmVisibility(false)}>Hủy</button>
            <button type="button" className={button} disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : form.isPublic ? 'Công khai CV' : 'Ẩn CV'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal Mã QR CV */}
      <Modal open={showQr && !!publicCvUrl} onClose={() => setShowQr(false)} title="Mã QR của CV công khai">
        <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
          <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200">
            {qr?.url === publicCvUrl && qr.src ? <img src={qr.src} alt="Mã QR dẫn tới CV công khai" className="h-48 w-48" />
              : <p role="status" className="text-sm text-slate-700">{qr?.url === publicCvUrl && qr.error ? 'Không tạo được mã QR. Dùng liên kết bên dưới.' : 'Đang tạo mã QR…'}</p>}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Quét để xem CV trên điện thoại</p>
            <p className="text-xs text-slate-400 font-mono mt-1 break-all max-w-sm px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
              {publicCvUrl}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={secondary} onClick={copyCvLink}>
              {copied ? 'Đã sao chép' : 'Sao chép link'}
            </button>
          </div>
        </div>
      </Modal>
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
          <h2>Xem trước CV</h2>
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
function AchievementDrop({ label, onFile, disabled, prominent }) {
  return <label className={'achievement-drop' + (prominent ? ' is-prominent' : '')} aria-disabled={disabled}
    onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault();
      if (!disabled) onFile(event.dataTransfer.files[0]);
    }}>
    <input type="file" className="sr-only" accept=".pdf,.docx,.jpg,.jpeg,.png" disabled={disabled} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) onFile(file);
    }} />
    {prominent ? <Sparkles size={18} aria-hidden="true" /> : <UploadCloud size={18} aria-hidden="true" />}
    <span><strong>{label}</strong><span className="vault-meta block">PDF, DOCX, JPG, PNG</span></span>
  </label>;
}

export function Achievements() {
  const [tab, setTab] = useState('all');
  const [extraFilters, setExtraFilters] = useState(false);
  const [showForm, setShowForm] = useState(() => new URLSearchParams(window.location.search).get('add') === '1');
  const [typeFilter, setTypeFilter] = useState('');
  const [year, setYear] = useState('');
  const [issuer, setIssuer] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [searchParams, setSearchParams] = useSearchParams();
  const [addContext, setAddContext] = useState(() => searchParams.get('add') === '1' ? searchParams.get('criterion') : null);
  const [achievementDetail, setAchievementDetail] = useState(null);
  const search = searchParams.get('search') || '';
  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    const next = new URLSearchParams(searchParams);
    ['add', 'criterion', 'type'].forEach(name => next.delete(name));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const state = useCollection('/achievements');
  const trash = useCollection('/achievements?trash=true');
  const catalogs = useLoad('/achievements/catalogs');

  const emptyForm = { title: '', achievedAt: '', description: '', issuer: '', achievementTypeId: '', levelCode: '' };
  const [form, setForm] = useState(() => ({ ...emptyForm, achievementTypeId: searchParams.get('add') === '1' && /^\d+$/.test(searchParams.get('type') || '') ? searchParams.get('type') : '' }));
  const [error, setError] = useState(null);
  const [drawerError, setDrawerError] = useState(null);
  const [busyFile, setBusyFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadRetry, setUploadRetry] = useState(null);
  const [archiveNotice, setArchiveNotice] = useState(null);
  const [attributes, setAttributes] = useState({});
  const [newDetail, setNewDetail] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const [proposal, setProposal] = useState([]);
  const [assisted, setAssisted] = useState([]);
  const [preview, setPreview] = useState(null);
  const [removeFile, setRemoveFile] = useState(null);
  const [jump, setJump] = useState(0);
  const evidenceSection = useRef(null);
  const previewSection = useRef(null);
  const editing = showForm ? achievementDetail?.id : null;
  const evidence = useLoad(achievementDetail && !achievementDetail.deletedAt && tab !== 'trash' ? '/achievements/' + achievementDetail.id + '/evidences' : null);
  const types = catalogs.data?.achievementTypes || [];
  const type = types.find(item => String(item.id) === String(form.achievementTypeId));
  const recognitionFields = type?.attributeSchema?.properties || {};
  const dynamicFields = [...dynamicAchievementFields(type), ...['recognition_scope', 'has_recognition_doc'].filter(key => recognitionFields[key])];
  const blocked = saving || busyFile || extracting;
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => { if (preview) previewSection.current?.focus(); }, [preview]);
  useEffect(() => {
    if (!jump || !achievementDetail) return;
    const frame = requestAnimationFrame(() => evidenceSection.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [jump, achievementDetail]);

  function initForm(item) {
    setForm(item ? {
      title: item.title || '', achievedAt: item.achievedAt?.slice(0, 10) || '',
      description: item.description || '', issuer: item.issuer || '',
      achievementTypeId: item.achievementTypeId || '', levelCode: item.levelCode || '',
    } : emptyForm);
    setAttributes(item?.attributes || {});
    setNewDetail(''); setAttachedFile(null); setExtraction(null); setProposal([]); setAssisted([]);
    setPreview(null); setRemoveFile(null); setDrawerError(null);
  }

  function closeDrawer() {
    if (blocked) return;
    setAchievementDetail(null); setShowForm(false); setPreview(null); setRemoveFile(null);
  }

  function view(item, focusEvidence = false) {
    setAchievementDetail(item); setShowForm(false); setDrawerError(null); setPreview(null); setRemoveFile(null);
    if (focusEvidence) setJump(value => value + 1);
    else setJump(0);
  }

  function begin(item) {
    setAddContext(null);
    setAchievementDetail(item || null); setJump(0); initForm(item); setShowForm(true);
  }

  const edit = (key, value) => {
    setForm(current => ({ ...current, [key]: value }));
    setAssisted(current => current.filter(item => item !== key));
  };

  function editDetail(key, value) {
    setAttributes(current => {
      const next = { ...current };
      next[key] = value;
      return next;
    });
    setAssisted(current => current.filter(item => item !== key));
  }

  function addDetail(name) {
    const key = name.trim();
    if (!key || [...basicDetailKeys, ...dynamicFields, '__proto__', 'constructor', 'prototype'].includes(key) || Object.hasOwn(attributes, key)) {
      setDrawerError(new Error('Tên thông tin đã có hoặc không hợp lệ.')); return;
    }
    setDrawerError(null);
    setAttributes(current => ({ ...current, [key]: '' }));
    setNewDetail('');
  }

  function applySuggestions(changes) {
    setForm(current => ({ ...current, ...Object.fromEntries(changes.filter(change => !change.detail).map(change => [change.key, change.next])) }));
    setAttributes(current => ({ ...current, ...Object.fromEntries(changes.filter(change => change.detail).map(change => [change.key, change.next])) }));
    setAssisted(current => [...new Set([...current, ...changes.map(change => change.key)])]);
  }

  async function extract(file, review) {
    if (!file) return;
    setExtracting(true); setDrawerError(null); setProposal([]); setExtraction({ fileName: file.name });
    try {
      const payload = new FormData(); payload.append('file', file);
      const response = await api('/achievements/ai-extract', 'POST', payload);
      if (!response.data) { setExtraction({ fileName: file.name, message: 'Chưa trích xuất được. Bạn có thể nhập thủ công.' }); return; }
      const suggested = suggestedAchievementFields(response.data, types);
      const entries = (values, existing, detail) => Object.entries(values)
        .filter(([key, value]) => String(existing[key] ?? '') !== String(value))
        .map(([key, next]) => ({ key, next, detail }));
      const changes = [...entries(suggested.fields, form, false), ...entries(suggested.details, attributes, true)];
      const fill = review ? [] : changes.filter(change => (change.detail ? attributes : form)[change.key] == null || (change.detail ? attributes : form)[change.key] === '');
      if (fill.length) applySuggestions(fill);
      setProposal(changes.filter(change => !fill.includes(change)));
      setExtraction({ fileName: file.name, count: changes.length, filled: fill.length });
    } catch (err) {
      setExtraction({ fileName: file.name, message: 'Không đọc được tài liệu. Bạn có thể thử lại hoặc nhập thủ công.' });
      setDrawerError(err);
    } finally { setExtracting(false); }
  }

  function attach(file) {
    if (!file || blocked) return;
    setAttachedFile(file); setPreview(null); extract(file, Boolean(editing));
  }

  async function readEvidence(file) {
    return api('/evidence-files/' + file.id + '/download', 'GET', undefined, { responseType: 'blob' });
  }

  async function extractEvidence(file) {
    setBusyFile(true); setDrawerError(null);
    try {
      const blob = await readEvidence(file);
      await extract(new File([blob], file.originalFileName, { type: blob.type }), true);
    } catch (err) { setDrawerError(err); }
    finally { setBusyFile(false); }
  }

  async function showPreview(file, stored = true) {
    setBusyFile(true); setDrawerError(null);
    try {
      const blob = stored ? await readEvidence(file) : file;
      const name = stored ? file.originalFileName : file.name;
      const pdf = blob.type === 'application/pdf' || /\.pdf$/i.test(name);
      const image = /\.(jpe?g|png)$/i.test(name);
      setPreview({ name, pdf, image, url: pdf || image ? URL.createObjectURL(pdf ? new Blob([blob], { type: 'application/pdf' }) : blob) : null });
    } catch (err) { setDrawerError(err); }
    finally { setBusyFile(false); }
  }

  async function download(file) {
    try { await saveBlob('/evidence-files/' + file.id + '/download', file.originalFileName); }
    catch (err) { setDrawerError(err); }
  }

  async function uploadEvidence(file, id) {
    const data = new FormData(); data.append('file', file);
    await api('/achievements/' + id + '/evidences', 'POST', data);
  }

  async function upload(file) {
    if (!file || !achievementDetail || blocked) return;
    const id = achievementDetail.id;
    setBusyFile(true); setDrawerError(null);
    try {
      await uploadEvidence(file, id);
      setUploadRetry(null);
      await Promise.all([evidence.reload(), state.reload()]);
    } catch (err) { setUploadRetry({ id, file }); setDrawerError(err); }
    finally { setBusyFile(false); }
  }

  async function save(event) {
    event.preventDefault();
    if (blocked || proposal.length) return;
    setSaving(true); setDrawerError(null);
    try {
      const result = await api(editing ? '/achievements/' + editing : '/achievements', editing ? 'PATCH' : 'POST', {
        ...form,
        achievementTypeId: form.achievementTypeId ? Number(form.achievementTypeId) : null,
        attributes: Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== '')),
      });
      const id = editing || result?.id;
      const file = attachedFile;
      setAttachedFile(null); setExtraction(null); setPreview(null);
      if (file && id) {
        try { await uploadEvidence(file, id); if (editing) await evidence.reload(); }
        catch (err) { setUploadRetry({ id, file }); setDrawerError(err); }
      }
      setAchievementDetail(result?.id ? result : { ...achievementDetail, ...form, id, attributes, typeName: type?.name });
      setShowForm(false);
      await state.reload();
    } catch (err) { setDrawerError(err); }
    finally { setSaving(false); }
  }

  async function remove(id, title) {
    try {
      await api('/achievements/' + id, 'DELETE');
      await Promise.all([state.reload(), trash.reload()]);
      setArchiveNotice({ id, title });
    } catch (err) { setError(err); }
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

  const aiLabel = (key, label) => <>{label}{assisted.includes(key) && <span className="achievement-ai-chip">AI điền</span>}</>;
  const detailField = key => {
    const value = attributes[key];
    const definition = recognitionFields[key];
    const label = definition?.title || detailLabels[key] || key;
    if (definition?.enum || definition?.type === 'boolean') {
      const options = definition.enum || [true, false];
      return <Field label={label}><select className={input} value={String(value ?? '')} onChange={event => editDetail(key, options.find(option => String(option) === event.target.value) ?? '')}>
        <option value="">Chưa xác định</option>
        {options.map((option, index) => <option key={String(option)} value={String(option)}>{definition.enumNames?.[index] || formatAchievementValue(option)}</option>)}
      </select></Field>;
    }
    if (value && typeof value === 'object') return <div><strong>{label}</strong><p className="vault-meta">{formatAchievementValue(value)}</p></div>;
    if (typeof value === 'boolean') return <Field label={aiLabel(key, label)}><select className={input} value={String(value)} onChange={event => editDetail(key, event.target.value === 'true')}><option value="true">Có</option><option value="false">Không</option></select></Field>;
    const numeric = numericDetails.has(key) || typeof value === 'number';
    return <Field label={aiLabel(key, label)}><input className={input} type={numeric ? 'number' : 'text'}
      placeholder={key === 'role' && dynamicFields.includes('contribution_percent') ? 'Ví dụ: Tác giả chính, đồng tác giả' : undefined}
      min={numericDetails.has(key) ? 0 : undefined} max={key === 'contribution_percent' ? 100 : undefined} step={numeric ? 'any' : undefined}
      value={value ?? ''} onChange={event => editDetail(key, numeric && event.target.value !== '' ? Number(event.target.value) : event.target.value)} /></Field>;
  };
  const evidenceArea = achievementDetail && tab !== 'trash' && <section className="achievement-section" aria-labelledby="achievement-evidence-heading">
    <h3 ref={evidenceSection} tabIndex={-1} className="font-semibold" id="achievement-evidence-heading">Minh chứng</h3>
    <Load state={evidence}>
      {array(evidence.data).length ? <ul className="achievement-files">
        {array(evidence.data).map(file => <li key={file.id}>
          <button type="button" className="achievement-file-name" disabled={blocked} onClick={() => showPreview(file)}>{file.originalFileName}</button>
          <div className="flex flex-wrap gap-2">
            {showForm && <button type="button" className={secondary} disabled={blocked} onClick={() => extractEvidence(file)}><Sparkles size={14} /> Trích xuất lại</button>}
            <button type="button" className={secondary + ' !px-3'} disabled={blocked} aria-label={'Tải ' + file.originalFileName} title="Tải xuống" onClick={() => download(file)}><FileDown size={16} /></button>
            <button type="button" className="soft-btn-danger !px-3" disabled={blocked} aria-label={'Xóa ' + file.originalFileName} title="Xóa tệp" onClick={() => setRemoveFile(file)}><Trash2 size={16} /></button>
          </div>
        </li>)}
      </ul> : <p className="vault-meta">Chưa có tệp minh chứng.</p>}
    </Load>
    {removeFile && <div className="achievement-inline-review">
      <p>Xóa minh chứng <strong>{removeFile.originalFileName}</strong>?</p>
      <div className="mt-2 flex gap-2">
        <button type="button" className={secondary} disabled={blocked} onClick={() => setRemoveFile(null)}>Giữ tệp</button>
        <button type="button" className="soft-btn-danger" disabled={blocked} onClick={async () => {
          setBusyFile(true); setDrawerError(null);
          try {
            await api('/evidences/' + removeFile.id, 'DELETE');
            setRemoveFile(null); setPreview(null);
            await Promise.all([evidence.reload(), state.reload()]);
          } catch (err) { setDrawerError(err); }
          finally { setBusyFile(false); }
        }}>Xóa minh chứng</button>
      </div>
    </div>}
    <AchievementDrop label="Kéo thả hoặc chọn tệp minh chứng" disabled={blocked} onFile={upload} />
    {uploadRetry?.id === achievementDetail.id && <button type="button" className={secondary} disabled={blocked} onClick={() => upload(uploadRetry.file)}>Thử tải lại {uploadRetry.file.name}</button>}
  </section>;
  const proposedLabel = change => (change.detail ? detailLabels[change.key] : primaryLabels[change.key]) || change.key;
  const proposedValue = (change, value) => change.key === 'achievementTypeId'
    ? types.find(item => String(item.id) === String(value))?.name || formatAchievementValue(value)
    : formatAchievementValue(value);
  const customKeys = Object.keys(attributes).filter(key => !basicDetailKeys.includes(key) && !dynamicFields.includes(key));

  const pageActions = (
    <div className="flex items-center gap-2">
      <Link 
        to="/reports" 
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-teal-600/40 text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 hover:border-teal-600 shadow-sm transition-all"
        title="Xem thống kê phân bố thành tích theo năm và loại"
      >
        <BarChart3 size={16} className="text-teal-600 dark:text-teal-400" />
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
      {archiveNotice && <div className="vault-summary mb-4">
        <p role="status">Đã chuyển {archiveNotice.title || 'thành tích'} vào thùng rác.</p>
        <button type="button" className={secondary} onClick={async () => {
          try {
            await api('/achievements/' + archiveNotice.id + '/restore', 'POST', {});
            setArchiveNotice(null);
            await Promise.all([state.reload(), trash.reload()]);
          } catch (err) { setError(err); }
        }}>Hoàn tác</button>
      </div>}
      <section className={panel}>
        <div className="vault-list-heading flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <VaultTabs
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
          <button type="button" className={secondary + ' sm:hidden'} aria-expanded={extraFilters} aria-controls="achievement-extra-filters" onClick={() => setExtraFilters(value => !value)}>Bộ lọc năm và đơn vị</button>
          <div id="achievement-extra-filters" className={extraFilters ? 'grid gap-3 sm:contents' : 'hidden sm:contents'}>
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
        </div>
        {!source.loading && !source.error && <div className="vault-summary mb-4" aria-live="polite">
          <span>{filteredRows.length} kết quả</span>
          {(search || typeFilter || year || issuer) && <button type="button" className={secondary} onClick={() => {
            setSearchParams({}); setTypeFilter(''); setYear(''); setIssuer(''); setPage(1);
          }}>Xóa bộ lọc</button>}
        </div>}

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
                <table className="vault-table achievement-table">
                  <caption className="sr-only">{tab === 'trash' ? 'Thành tích trong thùng rác' : 'Thành tích của bạn'}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tên thành tích</th>
                      <th scope="col">Loại</th>
                      <th scope="col">Thông tin bổ sung</th>
                      <th scope="col">Minh chứng</th>
                      <th scope="col" className="text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td>
                          <button type="button" className="min-h-11 text-left font-semibold text-teal-800 hover:underline dark:text-teal-300" onClick={() => view(item)}>{displayAchievementTitle(item.title)}</button>
                          <p className="vault-meta"><DateText value={item.achievedAt} />{item.issuer && <> · {item.issuer}</>}{/^\s*\[DEMO\]/i.test(item.title) && <> · Dữ liệu mẫu</>}</p>
                        </td>
                        <td>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {item.typeName || 'Chưa phân loại'}
                          </span>
                        </td>
                        <td className="vault-meta">{Object.entries(item.attributes || {}).filter(([, value]) => ['string', 'number'].includes(typeof value) && value !== '').slice(0, 2).map(([key, value]) => (detailLabels[key] || key) + ': ' + value).join(' · ') || '—'}</td>
                        <td>
                          <button type="button" className={'achievement-evidence-badge' + (item.evidenceCount ? '' : ' is-empty')}
                            aria-label={'Xem ' + (item.evidenceCount || 0) + ' minh chứng của ' + displayAchievementTitle(item.title)} onClick={() => view(item, true)}>
                            <Paperclip size={14} aria-hidden="true" /> {item.evidenceCount || 0}
                          </button>
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
                                  title="Chỉnh sửa thông tin thành tích" 
                                  aria-label="Sửa thành tích"
                                  className={secondary + ' !px-3'}
                                  onClick={() => begin(item)}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button 
                                  type="button" 
                                  title="Chuyển vào thùng rác" 
                                  aria-label="Xóa thành tích"
                                  className="soft-btn-danger !px-3"
                                  onClick={() => remove(item.id, item.title)}
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

      <Modal drawer open={showForm || !!achievementDetail} onClose={closeDrawer}
        title={showForm ? (editing ? 'Sửa thành tích' : 'Thêm thành tích mới') : displayAchievementTitle(achievementDetail?.title)}>
        <ErrorMessage error={drawerError} />
        {showForm ? <form onSubmit={save} className="space-y-4">
          {addContext && !editing && <p className="vault-meta">Bổ sung cho tiêu chí: <strong>{addContext}</strong></p>}
          {editing && evidenceArea}
          <section className="achievement-section">
            <h3 className="font-semibold">Nhập nhanh từ minh chứng</h3>
            {!attachedFile ? <AchievementDrop prominent label="Kéo thả hoặc chọn tài liệu để AI đọc" disabled={blocked} onFile={attach} /> :
              <div className="achievement-inline-review">
                <p className="break-all font-semibold">{attachedFile.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={secondary} disabled={blocked} onClick={() => extract(attachedFile, true)}><RotateCcw size={14} /> Quét lại</button>
                  <button type="button" className={secondary} disabled={blocked} onClick={() => showPreview(attachedFile, false)}><Eye size={14} /> Xem tệp</button>
                  <button type="button" className="soft-btn-danger" disabled={blocked} onClick={() => {
                    setAttachedFile(null); setExtraction(null); setProposal([]); setPreview(null);
                  }}>Bỏ tệp</button>
                </div>
                <p className="vault-meta mt-2">Tệp sẽ được đính kèm khi lưu thành tích.</p>
              </div>}
            {extracting && <p role="status" className="vault-meta">AI đang đọc tài liệu và tìm thông tin…</p>}
            {!extracting && extraction && <p role="status" className="vault-meta">
              {extraction.fileName} · {extraction.message || (extraction.count ? 'Đã điền ' + extraction.filled + '/' + extraction.count + ' trường tìm được.' : 'Không có giá trị mới để cập nhật.')}
            </p>}
          </section>

          {!!proposal.length && <section className="achievement-inline-review" aria-label="Đề xuất của AI">
            <h3 className="font-semibold">Kiểm tra trước khi áp dụng</h3>
            <p className="vault-meta">Thông tin chỉ thay đổi trong form sau khi bạn áp dụng. Bấm Lưu để ghi vào hồ sơ.</p>
            <dl className="achievement-proposal">{proposal.map(change => <div key={change.key}>
              <dt className="font-semibold">{proposedLabel(change)}</dt>
              <dd className="vault-meta">Hiện tại: {proposedValue(change, (change.detail ? attributes : form)[change.key]) || 'Chưa có'}</dd>
              <dd>Đề xuất: {proposedValue(change, change.next)}</dd>
            </div>)}</dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondary} disabled={blocked} onClick={() => setProposal([])}>Giữ dữ liệu hiện tại</button>
              <button type="button" className={button} disabled={blocked} onClick={() => { applySuggestions(proposal); setExtraction(current => ({ ...current, filled: current.filled + proposal.length })); setProposal([]); }}>Áp dụng đề xuất</button>
            </div>
          </section>}

          <fieldset disabled={blocked} className="space-y-4 min-w-0">
            <section className="achievement-section">
              <h3 className="font-semibold">Thông tin cơ bản</h3>
              <Field label={aiLabel('title', 'Tên thành tích *')}><input required maxLength={300} className={input} value={form.title} onChange={event => edit('title', event.target.value)} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={aiLabel('achievedAt', 'Ngày đạt *')}><input required type="date" className={input} value={form.achievedAt} onChange={event => edit('achievedAt', event.target.value)} /></Field>
                <Field label={aiLabel('achievementTypeId', 'Loại thành tích')}><select className={input} value={form.achievementTypeId} onChange={event => edit('achievementTypeId', event.target.value)}>
                  <option value="">Chưa chọn loại</option>
                  {form.achievementTypeId && !type && <option value={form.achievementTypeId}>Loại đã lưu</option>}
                  {types.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select></Field>
              </div>
              <Field label={aiLabel('issuer', 'Đơn vị cấp / Ban tổ chức')}><input maxLength={300} className={input} value={form.issuer} onChange={event => edit('issuer', event.target.value)} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">{basicDetailKeys.map(key => <div key={key}>{detailField(key)}</div>)}</div>
              <Field label="Mô tả chi tiết"><textarea className={input} rows={3} maxLength={20000} value={form.description} onChange={event => edit('description', event.target.value)} /></Field>
            </section>

            <section className="achievement-section">
              <div><h3 className="font-semibold">Thông tin chi tiết bổ sung</h3><p className="vault-meta">Dùng để đối chiếu quy chế và theo dõi mục tiêu.</p></div>
              {dynamicFields.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{dynamicFields.map(key => <div key={key}>{detailField(key)}</div>)}</div>}
              {customKeys.map(key => <div key={key} className="achievement-detail-row">
                {detailField(key)}
                <button type="button" className="soft-btn-danger !px-3" aria-label={'Bỏ ' + (detailLabels[key] || key)} onClick={() => {
                  setAttributes(current => Object.fromEntries(Object.entries(current).filter(([id]) => id !== key)));
                  setAssisted(current => current.filter(id => id !== key));
                }}><Trash2 size={16} /></button>
              </div>)}
              <div className="flex flex-wrap gap-2">
                {['hours', 'decision_number', 'academic_year', 'contribution_percent'].filter(key => !dynamicFields.includes(key) && !Object.hasOwn(attributes, key)).map(key =>
                  <button type="button" key={key} className={secondary} onClick={() => addDetail(key)}><Plus size={14} />{detailLabels[key]}</button>)}
              </div>
              <div className="achievement-detail-row">
                <Field label="Tên thông tin khác"><input className={input} maxLength={80} value={newDetail} onChange={event => setNewDetail(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addDetail(newDetail); } }} /></Field>
                <button type="button" className={secondary} disabled={!newDetail.trim()} onClick={() => addDetail(newDetail)}>Thêm</button>
              </div>
            </section>
          </fieldset>

          <div className="achievement-form-actions">
            <button type="button" className={secondary} disabled={blocked} onClick={() => {
              if (editing) { setShowForm(false); setPreview(null); setDrawerError(null); } else closeDrawer();
            }}>Hủy</button>
            <button className={button} disabled={blocked || !!proposal.length}>{saving ? 'Đang lưu…' : 'Lưu thành tích'}</button>
          </div>
        </form> : achievementDetail && <>
          <section className="achievement-section">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Tổng quan</h3>
              {tab !== 'trash' && <button type="button" className={secondary} disabled={blocked} onClick={() => begin(achievementDetail)}><Pencil size={16} /> Chỉnh sửa</button>}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div><dt className="vault-meta">Loại</dt><dd>{achievementDetail.typeName || 'Chưa phân loại'}</dd></div>
              <div><dt className="vault-meta">Ngày đạt</dt><dd><DateText value={achievementDetail.achievedAt} /></dd></div>
              <div><dt className="vault-meta">Đơn vị cấp</dt><dd>{achievementDetail.issuer || 'Chưa cập nhật'}</dd></div>
              {Object.entries(achievementDetail.attributes || {}).map(([key, value]) => <div key={key}><dt className="vault-meta">{detailLabels[key] || key}</dt><dd className="break-words">{formatAchievementValue(value)}</dd></div>)}
            </dl>
            <div><h4 className="font-semibold">Mô tả</h4><p className="vault-meta whitespace-pre-wrap">{achievementDetail.description || 'Chưa có mô tả.'}</p></div>
          </section>
          {evidenceArea}
        </>}
        {preview && <section className="achievement-section" ref={previewSection} tabIndex={-1} aria-label="Xem trước tệp">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="break-all font-semibold">{preview.name}</h3><button type="button" className={secondary} onClick={() => setPreview(null)}>Đóng bản xem trước</button></div>
          {preview.pdf ? <iframe src={preview.url} title={'Xem trước ' + preview.name} className="achievement-file-preview" />
            : preview.image ? <img src={preview.url} alt={preview.name} className="achievement-file-preview object-contain" />
              : <p className="vault-meta">Xem trước hỗ trợ PDF và ảnh. Bạn có thể tải tệp đã lưu xuống để mở.</p>}
        </section>}
      </Modal>
    </Page>
  );
}

function canAssessOrganization(organizations, grants, admin, organizationId) {
  if (admin) return true;
  return ['ASSESSMENTS_RUN', 'ASSESSMENTS_VIEW', 'MEMBERS_VIEW'].every(code =>
    grants.some(grant => {
      if (grant.permission_code !== code) return false;
      let org = organizations.find(item => String(item.id) === String(organizationId));
      const seen = new Set();
      while (org && !seen.has(org.id)) {
        seen.add(org.id);
        if (String(org.id) === String(grant.organization_id)) {
          return String(org.id) === String(organizationId) || !!grant.include_descendants;
        }
        org = organizations.find(item => String(item.id) === String(org.parent_id));
      }
      return false;
    })
  );
}

function AssessmentPicker({ label, items, selected, onChange, disabled }) {
  const ref = useRef(null);
  const [search, setSearch] = useState('');
  const options = items.filter(item => matchesAssessmentSearch(item.search || item.label, search));
  const checked = options.filter(item => selected.includes(item.id)).length;
  useEffect(() => {
    const close = event => {
      if (ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  return <details ref={ref} className="org-assessment-picker" onKeyDown={event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      ref.current.open = false;
      ref.current.querySelector('summary')?.focus();
    }
  }}>
    <summary className="soft-btn-secondary" aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }}>
      {label}: {selected.length}/{items.length} đã chọn
    </summary>
    <div className="org-assessment-options">
      <Field label={'Tìm ' + label.toLocaleLowerCase('vi')}><input type="search" className={input} value={search} onChange={event => setSearch(event.target.value)} /></Field>
      <label className="vault-selection-target vault-inline-choice">
        <input type="checkbox" disabled={disabled || !options.length} checked={!!options.length && checked === options.length}
          ref={node => { if (node) node.indeterminate = checked > 0 && checked < options.length; }}
          onChange={event => {
            const shown = new Set(options.map(item => item.id));
            onChange(event.target.checked ? [...new Set([...selected, ...shown])] : selected.filter(id => !shown.has(id)));
          }} />
        Chọn tất cả kết quả ({options.length})
      </label>
      <div className="max-h-64 overflow-auto">
        {options.map(item => <label className="vault-selection-target vault-inline-choice" key={item.id}>
          <input type="checkbox" disabled={disabled} checked={selected.includes(item.id)}
            onChange={event => onChange(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />
          <span>{item.label}{item.meta && <span className="vault-meta block">{item.meta}</span>}</span>
        </label>)}
        {!options.length && <p className="vault-meta px-3 py-2">Không có mục phù hợp.</p>}
      </div>
    </div>
  </details>;
}

function matchesAssessmentSearch(value, search) {
  const normalize = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('vi').replaceAll('đ', 'd');
  return normalize(value || '').includes(normalize(search.trim()));
}

const assessmentNeedsReview = result => ['NOT_MET', 'INSUFFICIENT_DATA'].includes(result.conclusion);
const notificationMissingCount = run => array(run.results).filter(assessmentNeedsReview).length;

function OrganizationAssessment() {
  const organizations = useLoad('/organizations');
  const profile = useLoad('/me/profile');
  const { hasRole } = useAuth();
  const [organizationId, setOrganizationId] = useState('');
  const [includeChildren, setIncludeChildren] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [selectedRules, setSelectedRules] = useState([]);
  const [evaluationDate, setEvaluationDate] = useState(localDay);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState([]);
  const [sent, setSent] = useState({});
  const [draft, setDraft] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const orgs = array(organizations.data);
  function permitted(id, code, descendants = false) {
    if (hasRole('SYSTEM_ADMIN')) return true;
    return (profile.data?.orgGrants || []).some(grant => {
      if (grant.permission_code !== code || (descendants && !grant.include_descendants)) return false;
      let org = orgs.find(item => String(item.id) === String(id));
      const seen = new Set();
      while (org && !seen.has(org.id)) {
        seen.add(org.id);
        if (String(org.id) === String(grant.organization_id)) return String(org.id) === String(id) || !!grant.include_descendants;
        org = orgs.find(item => String(item.id) === String(org.parent_id));
      }
      return false;
    });
  }
  const manageable = orgs.filter(org => canAssessOrganization(orgs, profile.data?.orgGrants || [], hasRole('SYSTEM_ADMIN'), org.id));
  const members = useLoad(organizationId ? '/organizations/' + organizationId + '/members?includeDescendants=' + includeChildren : null);
  const options = useLoad(organizationId ? '/organizations/units/' + organizationId + '/assessment-options' : null);
  const ready = Boolean(organizationId && !members.loading && !members.error && !options.loading && !options.error);
  const people = new Map(array(members.data).map(person => [String(person.user_id), person]));
  const rules = array(options.data).filter(version => effective(version, evaluationDate));
  const peopleIds = selectedPeople.filter(id => people.has(id));
  const chosen = rules.filter(rule => selectedRules.includes(String(rule.id)));
  const parentName = orgs.find(org => String(org.id) === organizationId)?.name || 'Tổ chức';
  const notifyAllowed = Boolean(organizationId) && permitted(organizationId, 'MEMBERS_NOTIFY', includeChildren);
  const grouped = new Map();
  for (const run of results) {
    const id = String(run.subject_user_id);
    if (!grouped.has(id)) {
      const person = people.get(id);
      grouped.set(id, { id, name: person?.full_name || person?.email || 'Thành viên #' + id, unit: person?.organization_name, runs: [] });
    }
    grouped.get(id).runs.push(run);
  }
  const rows = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const passed = row => row.runs.some(run => run.conclusion === 'MET');
  const needsReview = row => row.runs.some(assessmentNeedsReview);
  const visible = rows.filter(row => (filter === 'all' || (filter === 'passed' ? passed(row) : needsReview(row)))
    && matchesAssessmentSearch([row.name, row.unit].filter(Boolean).join(' '), search));
  const eligible = visible.filter(row => !sent[row.id] && !row.runs.some(run => run.stale));
  const selectedRecipients = eligible.filter(row => picked.includes(row.id));
  const pageSize = 20;
  const maxPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, maxPage);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function clearResults() {
    setResults([]); setProgress(null); setPicked([]); setSent({}); setFilter('all'); setSearch(''); setPage(1);
    setMessage('');
  }

  async function check() {
    if (busy || !ready || peopleIds.length < 1 || peopleIds.length > 500 || !chosen.length) return;
    clearResults();
    setBusy(true);
    const failures = [];
    let finished = 0;
    setProgress({ finished, total: chosen.length, failures: [] });
    try {
      for (const rule of chosen) {
        try {
          const response = await api('/organizations/units/' + organizationId + '/ai-scan', 'POST', {
            regulation_version_id: Number(rule.id), evaluation_date: evaluationDate,
            include_descendants: includeChildren, user_ids: peopleIds.map(Number),
          });
          setResults(previous => [...previous, ...array(response).map(run => ({ ...run, regulation_name: rule.name }))]);
        } catch (failure) { failures.push({ name: rule.name, error: failure }); }
        finished++;
        setProgress({ finished, total: chosen.length, failures: [...failures] });
      }
    } finally { setBusy(false); }
  }

  function startMessage(recipients, resend = false) {
    setMessage('');
    setDraft({ recipients, note: '', deadline: '', previewIndex: 0, resendKey: resend ? crypto.randomUUID() : undefined, errors: [] });
  }

  async function send(event) {
    event.preventDefault();
    if (sending || !notifyAllowed || !draft?.recipients.length) return;
    setSending(true);
    const failed = [];
    const errors = [];
    let count = 0;
    try {
      for (const row of draft.recipients) {
        try {
          const result = await api('/organizations/units/' + organizationId + '/assessment-notifications', 'POST', {
            runIds: row.runs.map(run => Number(run.id)), note: draft.note,
            ...(draft.deadline ? { deadline: draft.deadline } : {}),
            ...(draft.resendKey ? { resendKey: draft.resendKey } : {}),
          });
          setSent(previous => ({ ...previous, [row.id]: result.sentAt }));
          setPicked(previous => previous.filter(id => id !== row.id));
          count++;
        } catch (failure) {
          failed.push(row); errors.push({ name: row.name, error: failure });
        }
      }
      setMessage('Đã xác nhận gửi cho ' + count + '/' + draft.recipients.length + ' thành viên.');
      setDraft(failed.length ? { ...draft, recipients: failed, errors, previewIndex: 0 } : null);
    } finally { setSending(false); }
  }

  const preview = draft?.recipients[draft.previewIndex];
  return <>
    <section className={panel + ' space-y-3'}>
      <details open className="org-assessment-filters">
        <summary className="cursor-pointer font-bold">Bộ lọc đối chiếu hàng loạt</summary>
        <fieldset disabled={busy || sending} className="mt-3 min-w-0">
          <div className="org-assessment-toolbar">
            <Field label="Đơn vị"><select className={input} value={organizationId} onChange={event => {
              setOrganizationId(event.target.value); setIncludeChildren(false); setSelectedPeople([]); setSelectedRules([]); clearResults();
            }}><option value="">Chọn đơn vị</option>{manageable.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
            <Field label="Ngày đối chiếu"><input type="date" className={input} value={evaluationDate} onChange={event => {
              const day = event.target.value || localDay();
              setEvaluationDate(day);
              setSelectedRules(previous => previous.filter(id => array(options.data).some(rule => String(rule.id) === id && effective(rule, day))));
              clearResults();
            }} /></Field>
            {organizationId && ['ASSESSMENTS_RUN', 'ASSESSMENTS_VIEW', 'MEMBERS_VIEW'].every(code => permitted(organizationId, code, true)) &&
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={includeChildren} onChange={event => {
                setIncludeChildren(event.target.checked); setSelectedPeople([]); clearResults();
              }} />Gồm đơn vị trực thuộc</label>}
          </div>
          <div className="org-assessment-toolbar mt-2">
            <AssessmentPicker key={'people:' + organizationId + ':' + includeChildren} label="Thành viên" disabled={!ready || busy}
              items={Array.from(people, ([id, person]) => ({ id, label: person.full_name || person.email, meta: person.organization_name, search: [person.full_name, person.email, person.organization_name].filter(Boolean).join(' ') }))}
              selected={peopleIds} onChange={setSelectedPeople} />
            <AssessmentPicker key={'rules:' + organizationId} label="Quy chế" disabled={!ready || busy}
              items={rules.map(rule => ({ id: String(rule.id), label: rule.name, meta: rule.version_label }))}
              selected={chosen.map(rule => String(rule.id))} onChange={setSelectedRules} />
            <button type="button" className={button} disabled={!ready || busy || !peopleIds.length || peopleIds.length > 500 || !chosen.length} onClick={check}>
              {busy ? 'Đang đối chiếu…' : 'Chạy đối chiếu (' + peopleIds.length * chosen.length + ')'}
            </button>
          </div>
          {peopleIds.length > 500 && <p className="vault-meta mt-2">Chọn tối đa 500 thành viên mỗi lượt.</p>}
        </fieldset>
      </details>
      <ErrorMessage error={organizations.error || profile.error || members.error || options.error} />
      {progress && <div role="status" className="vault-meta">
        Đã xử lý {progress.finished}/{progress.total} quy chế.
        {progress.failures.map(item => <div key={item.name}><strong>{item.name}</strong><ErrorMessage error={item.error} /></div>)}
      </div>}
    </section>

    {!!rows.length && <section className={panel + ' space-y-4'}>
      <h2 className="text-lg font-bold">Kết quả đối chiếu ({rows.length} thành viên)</h2>
      <VaultTabs label="Lọc kết quả đối chiếu" value={filter} onChange={value => { setFilter(value); setPage(1); setPicked([]); }}
        items={[
          ['all', 'Tất cả (' + rows.length + ')'],
          ['passed', 'Đạt ít nhất 1 quy chế (' + rows.filter(passed).length + ')'],
          ['missing', 'Còn thiếu hoặc chưa đạt (' + rows.filter(needsReview).length + ')'],
        ]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="Tìm thành viên trong kết quả"><input type="search" className={input} value={search} onChange={event => {
          setSearch(event.target.value); setPage(1); setPicked([]);
        }} /></Field>
        {notifyAllowed && <button type="button" className={button} disabled={busy || sending || !selectedRecipients.length}
          onClick={() => startMessage(selectedRecipients)}>Gửi thông báo hàng loạt ({selectedRecipients.length})</button>}
      </div>
      {message && <p role="status" className="vault-meta">{message}</p>}
      {visible.length ? <div className="vault-table-wrap">
        <table className="vault-table org-assessment-table">
          <thead><tr>
            {notifyAllowed && <th scope="col"><input type="checkbox" aria-label="Chọn tất cả thành viên đủ điều kiện gửi trong kết quả lọc"
              disabled={busy || !eligible.length} checked={!!eligible.length && eligible.every(row => picked.includes(row.id))}
              ref={node => { if (node) node.indeterminate = !!selectedRecipients.length && selectedRecipients.length < eligible.length; }}
              onChange={event => setPicked(event.target.checked ? eligible.map(row => row.id) : [])} /></th>}
            <th scope="col">Thành viên / Đơn vị</th><th scope="col">Tổng quan</th><th scope="col">Kết quả theo quy chế</th>
            {notifyAllowed && <th scope="col">Thông báo</th>}
          </tr></thead>
          <tbody>{pageRows.map(row => <tr key={row.id}>
            {notifyAllowed && <td><input type="checkbox" aria-label={'Chọn gửi cho ' + row.name} checked={picked.includes(row.id)}
              disabled={busy || Boolean(sent[row.id]) || row.runs.some(run => run.stale)}
              onChange={event => setPicked(previous => event.target.checked ? [...previous, row.id] : previous.filter(id => id !== row.id))} /></td>}
            <td><strong>{row.name}</strong>{row.unit && <p className="vault-meta">{row.unit}</p>}</td>
            <td><strong>Đạt {row.runs.filter(run => run.conclusion === 'MET').length}/{row.runs.length}</strong><p className="vault-meta">quy chế</p></td>
            <td><div className="org-result-rules">{row.runs.map(run => <details key={run.id}>
              <summary><span>{run.regulation_name}</span><AssessmentBadge run={run} /></summary>
              <ul>{array(run.results).filter(assessmentNeedsReview).map(result => <li key={result.id}>
                {result.criterion?.title || 'Tiêu chí'}{missingText(result.missing_details) && ' · ' + missingText(result.missing_details)}
              </li>)}</ul>
              {!notificationMissingCount(run) && <p className="vault-meta">{conclusionLabel(run.conclusion)}</p>}
            </details>)}</div></td>
            {notifyAllowed && <td>
              {sent[row.id] && <p className="vault-meta">Đã gửi lúc {new Date(sent[row.id]).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>}
              <button type="button" className={secondary} disabled={busy || sending || row.runs.some(run => run.stale)}
                onClick={() => startMessage([row], Boolean(sent[row.id]))}>{sent[row.id] ? 'Gửi lại' : 'Gửi thông báo'}</button>
              {row.runs.some(run => run.stale) && <p className="vault-meta">Cần đối chiếu lại</p>}
            </td>}
          </tr>)}</tbody>
        </table>
      </div> : <p className="vault-meta">Không có thành viên khớp bộ lọc.</p>}
      {maxPage > 1 && <NumberedPagination page={currentPage} totalPages={maxPage} onPageChange={setPage} />}
    </section>}

    <Modal open={Boolean(draft)} title={draft?.resendKey ? 'Gửi lại thông báo' : 'Xem trước thông báo'} onClose={() => { if (!sending) setDraft(null); }}>
      {draft && <form className="space-y-4" onSubmit={send}>
        <p className="vault-meta">Mỗi thành viên nhận một thông báo tổng hợp các quy chế đã xét.</p>
        {draft.recipients.length > 1 && <Field label="Xem trước theo người nhận"><select className={input} value={draft.previewIndex} disabled={sending}
          onChange={event => setDraft({ ...draft, previewIndex: Number(event.target.value) })}>
          {draft.recipients.map((row, index) => <option value={index} key={row.id}>{row.name}</option>)}
        </select></Field>}
        <div className="org-message-preview">
          <strong>{preview?.name}</strong>
          <p>{parentName} thông báo kết quả đối chiếu ngày <DateText value={evaluationDate} />.</p>
          <ul className="list-disc pl-5">{preview?.runs.map(run => <li key={run.id}>{run.regulation_name} — {conclusionLabel(run.conclusion)}{notificationMissingCount(run) > 0 && ' (' + notificationMissingCount(run) + ' tiêu chí cần xem)'}</li>)}</ul>
          {draft.deadline && <p>Hạn bổ sung hồ sơ: <DateText value={draft.deadline} />.</p>}
          {draft.note.trim() && <p className="whitespace-pre-wrap">{draft.note.trim()}</p>}
        </div>
        {draft.errors.map(item => <div key={item.name}><strong>{item.name}</strong><ErrorMessage error={item.error} /></div>)}
        <Field label="Hạn bổ sung (không bắt buộc)"><input className={input} type="date" value={draft.deadline} disabled={sending}
          onChange={event => setDraft({ ...draft, deadline: event.target.value })} /></Field>
        <Field label="Lời nhắn thêm (không bắt buộc)"><textarea className={input} rows={3} maxLength={2000} value={draft.note} disabled={sending}
          onChange={event => setDraft({ ...draft, note: event.target.value })} /></Field>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={secondary} disabled={sending} onClick={() => setDraft(null)}>Hủy</button>
          <button className={button} disabled={sending}>{sending ? 'Đang gửi…' : draft.resendKey ? 'Xác nhận gửi lại' : 'Gửi cho ' + draft.recipients.length + ' thành viên'}</button>
        </div>
      </form>}
    </Modal>
  </>;
}

export function Discovery() {
  const profile = useLoad('/me/profile');
  const organizations = useLoad('/organizations');
  const catalog = useLoad('/achievements/catalogs');
  const { hasRole } = useAuth();
  const orgs = array(organizations.data);
  const canCheckOrganization = !profile.loading && !profile.error && !organizations.loading && !organizations.error
    && orgs.some(org => canAssessOrganization(orgs, profile.data?.orgGrants || [], hasRole('SYSTEM_ADMIN'), org.id));
  const docs = useLoad('/regulations/library');
  const latest = useLoad('/ai/evaluations/structured/latest');
  const [params] = useSearchParams();
  const [scope, setScope] = useState('personal');
  const [date, setDate] = useState(localDay);
  const [selected, setSelected] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [previousRun, setPreviousRun] = useState(null);
  const [freshSummaries, setFreshSummaries] = useState({});
  const [mobileDetail, setMobileDetail] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(null);
  const [createdGoals, setCreatedGoals] = useState({});
  const [creatingGoal, setCreatingGoal] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const selectAll = useRef(null);
  const detailHeading = useRef(null);
  const listHeading = useRef(null);
  const summaries = new Map(array(latest.data).map(run => [String(run.regulation_version_id) + ':' + (run.adoption_id ?? 'owner'), run]));
  for (const [id, fresh] of Object.entries(freshSummaries)) {
    if (Number(fresh.id) > Number(summaries.get(id)?.id || 0)) summaries.set(id, fresh);
  }
  const versions = assessmentContexts(array(docs.data)).filter(([, context]) => effective({ ...context, publication_status: 'PUBLISHED' }, date));
  const selectedItems = versions.filter(([key]) => selected.includes(key));
  const linked = versions.find(([, item]) => String(item.regulation_version_id) === params.get('version')
    && (!params.get('adoption') || String(item.adoption_id) === params.get('adoption')));
  const [key, active] = versions.find(([id]) => id === activeKey) || linked || versions[0] || [];
  const summary = summaries.get(key);
  const runId = (previousRun && previousRun.key === key ? previousRun.id : null) || summary?.id;
  const details = useLoad(active ? '/regulations/versions/' + active.regulation_version_id : null);
  const result = useLoad(runId ? '/ai/evaluations/structured/' + runId : null);
  const history = useLoad(active && historyPage ? '/ai/evaluations/structured/history?' + new URLSearchParams({
    version: active.regulation_version_id,
    ...(active.adoption_id ? { adoption: active.adoption_id } : {}),
    page: historyPage, pageSize: 10,
  }) : null);
  const run = String(result.data?.id) === String(runId) && result.data ? result.data : null;
  const version = String(details.data?.id) === String(active?.regulation_version_id) ? details.data : null;
  const criteria = run ? array(run.results).map(row => ({ criterion: row.criterion, row })) : array(version?.criteria).map(criterion => ({ criterion }));
  const personalVisible = !canCheckOrganization || scope === 'personal';

  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selectedItems.length > 0 && selectedItems.length < versions.length;
  }, [selectedItems.length, versions.length, personalVisible]);

  function setDay(value) {
    const nextDay = value || localDay();
    const remaining = selectedItems.filter(([, item]) => effective({ ...item, publication_status: 'PUBLISHED' }, nextDay));
    setSelected(remaining.map(([id]) => id));
    setNotice(remaining.length < selectedItems.length ? 'Đã bỏ chọn các quy chế ngoài thời gian hiệu lực.' : '');
    setDate(nextDay);
    setPreviousRun(null);
    setBatch(null);
  }

  function inspect(id) {
    setActiveKey(id);
    setPreviousRun(null);
    setMobileDetail(true);
    setError(null);
    requestAnimationFrame(() => detailHeading.current?.focus({ preventScroll: !window.matchMedia('(max-width: 767px)').matches }));
  }

  async function evaluate(items, previous = 0) {
    if (busy || !items.length) return;
    setBusy(true);
    setError(null);
    setNotice('');
    const failures = [];
    const total = previous + items.length;
    let completed = previous;
    let firstSuccess;
    setBatch({ completed, total, failures: [] });
    try {
      for (const [id, item] of items) {
        try {
          const completedRun = await api('/ai/evaluations/structured', 'POST', {
            regulation_version_id: Number(item.regulation_version_id), evaluation_date: date,
            ...(item.adoption_id ? { adoption_id: Number(item.adoption_id) } : {}),
          });
          setFreshSummaries(previous => ({ ...previous, [id]: {
            ...completedRun, history_count: Number(summaries.get(id)?.history_count || 0) + 1,
            criterion_count: array(completedRun.results).length, met_count: array(completedRun.results).filter(row => row.conclusion === 'MET').length,
          } }));
          firstSuccess ??= id;
          completed++;
          setBatch({ completed, total, failures: [...failures] });
        } catch (err) {
          failures.push({ item: [id, item], error: err });
        }
      }
      if (firstSuccess) {
        await latest.reload();
        inspect(firstSuccess);
      }
    } finally {
      setBatch({ completed, total, failures });
      setBusy(false);
    }
  }

  async function download(url, name, data) {
    setError(null);
    setDownloading(name);
    try { await saveBlob(url, name, data ? 'POST' : 'GET', data); }
    catch (err) { setError(err); }
    finally { setDownloading(null); }
  }

  async function createGoal(row) {
    setCreatingGoal(row.id);
    setError(null);
    try {
      const goal = await api('/kpi/from-ai-gap', 'POST', { source_result_id: row.id });
      setCreatedGoals(previous => ({ ...previous, [row.id]: goal?.id || true }));
    } catch (err) { setError(err); }
    finally { setCreatingGoal(null); }
  }

  return <Page title="Đối chiếu quy chế" description="Xem tiêu chí và kiểm tra hồ sơ theo ngày đối chiếu."
    actions={<>
      {personalVisible && <Field label="Ngày đối chiếu"><input className={input} type="date" value={date} disabled={busy} onChange={event => setDay(event.target.value)} /></Field>}
      <Link className={secondary} to="/regulations">Tra cứu kho quy chế</Link>
    </>}>
    {canCheckOrganization && <VaultTabs value={scope} onChange={setScope} items={[['personal', 'Cá nhân'], ['organization', 'Tổ chức']]} />}
    {!personalVisible && <OrganizationAssessment />}
    {personalVisible && <>
      {latest.error && <div className="mb-3 flex flex-wrap items-center gap-2"><ErrorMessage error={latest.error} /><button type="button" className={secondary} onClick={latest.reload}>Tải lại kết quả</button></div>}
      <div className="assessment-workspace" data-mobile-detail={mobileDetail && !!active}>
        <section className={panel + ' assessment-sidebar'}>
          <h2 className="text-lg font-bold" ref={listHeading} tabIndex={-1}>Quy chế đang áp dụng</h2>
          <Load state={docs}>
            {versions.length ? <>
              <div className="assessment-toolbar">
                <label className="flex min-h-11 cursor-pointer items-center gap-2">
                  <input ref={selectAll} type="checkbox" className="accent-teal-700" disabled={busy} checked={selectedItems.length === versions.length}
                    onChange={event => setSelected(event.target.checked ? versions.map(([id]) => id) : [])} />
                  Chọn tất cả ({versions.length})
                </label>
                <button type="button" className={button} disabled={busy || !selectedItems.length} onClick={() => evaluate(selectedItems)}>
                  {busy ? 'Đang đối chiếu…' : selectedItems.length ? 'Đối chiếu (' + selectedItems.length + ')' : 'Đối chiếu'}
                </button>
              </div>
              <ul className="assessment-list">
                {versions.map(([id, item]) => {
                  const last = summaries.get(id);
                  const scopeLabel = item.context_type === 'ORGANIZATION'
                    ? orgs.find(org => String(org.id) === String(item.organization_id))?.name || 'Tổ chức #' + item.organization_id
                    : item.context_type === 'OWNER' ? 'Do tôi tạo' : 'Kho cá nhân';
                  return <li key={id} className="assessment-row" data-active={id === key}>
                    <label className="assessment-check" title={'Chọn để đối chiếu: ' + item.name}>
                      <input type="checkbox" className="accent-teal-700" aria-label={'Chọn ' + item.name + ' · ' + scopeLabel}
                        checked={selected.includes(id)} disabled={busy}
                        onChange={event => setSelected(event.target.checked ? [...selected, id] : selected.filter(value => value !== id))} />
                    </label>
                    <button type="button" className="assessment-open" aria-current={id === key ? 'true' : undefined} onClick={() => inspect(id)}>
                      <strong className="block break-words">{item.name}</strong>
                      {id === key && <span className="assessment-view-label">Đang xem</span>}
                      <span className="vault-meta block">{item.code} · {item.version_label} · {scopeLabel}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        {last ? <><AssessmentBadge run={last} /><span className="vault-meta">{last.met_count}/{last.criterion_count} đạt · Xét <DateText value={last.evaluation_date} /></span></>
                          : <span className="vault-meta">{latest.loading ? 'Đang tải kết quả…' : latest.error ? 'Chưa tải được kết quả' : 'Chưa đối chiếu'}</span>}
                      </span>
                    </button>
                  </li>;
                })}
              </ul>
            </> : <Empty action={<Link className={secondary} to="/regulations">Xem kho quy chế</Link>}>Chưa có quy chế nào có hiệu lực vào ngày này.</Empty>}
          </Load>
          {notice && <p role="status" className="vault-meta mt-3">{notice}</p>}
          {batch && <div className="mt-3 space-y-2" aria-live="polite">
            <p className="vault-meta">Hoàn tất {batch.completed}/{batch.total} quy chế</p>
            {!busy && batch.failures.map(({ item: [id, item], error: failure }) => <div key={id}><strong>{item.name}</strong><ErrorMessage error={failure} /></div>)}
            {!busy && batch.failures.length > 0 && <button type="button" className={secondary} onClick={() => evaluate(batch.failures.map(entry => entry.item), batch.completed)}>Thử lại mục lỗi</button>}
          </div>}
        </section>
        <section className={panel + ' assessment-detail'} aria-labelledby="assessment-detail-heading">
          <button type="button" className={secondary + ' assessment-back mb-3'} onClick={() => {
            setMobileDetail(false);
            requestAnimationFrame(() => listHeading.current?.focus());
          }}>Về danh sách quy chế</button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="assessment-detail-heading" className="min-w-0 break-words text-lg font-bold" ref={detailHeading} tabIndex={-1}>{active?.name || 'Chi tiết đối chiếu'}</h2>
            {summary && <button type="button" className={secondary} onClick={() => setHistoryPage(1)}>Lịch sử chạy ({summary.history_count})</button>}
          </div>
          <ErrorMessage error={error} />
          {!active ? <p className="vault-meta mt-3">Tiêu chí và kết quả sẽ hiện ở đây khi có quy chế để xem.</p> :
            <Load state={runId ? result : details}>
              {runId && !run || !runId && !version ? <p role="status" className="vault-meta mt-3">Đang tải chi tiết…</p> : <>
              {run && <div className="assessment-run-header">
                <AssessmentBadge run={run} />
                <p className="vault-meta">Ngày xét <DateText value={run.evaluation_date} />{run.completed_at && ' · Chạy lúc ' + new Date(run.completed_at).toLocaleString('vi-VN')}</p>
                {(String(run.evaluation_date).slice(0, 10) !== date || run.stale || previousRun?.key === key) && <p className="vault-meta">
                  {run.stale ? 'Hồ sơ đã thay đổi. Hãy chạy lại để cập nhật kết quả.' : 'Đang hiển thị kết quả lần trước.'}
                  {previousRun?.key === key && <button type="button" className="ml-2 text-teal-700 underline dark:text-teal-300" onClick={() => setPreviousRun(null)}>Về kết quả mới nhất</button>}
                </p>}
                <button type="button" className={secondary} disabled={downloading !== null}
                  onClick={() => download('/ai/export-dossier-zip', 'minh-chung.zip', { runId: run.id })}><FileArchive size={16} /> Tải minh chứng (ZIP)</button>
              </div>}
              <h3 className="mt-4 font-semibold">{run ? 'Kết quả từng tiêu chí' : 'Tiêu chí cần đạt'} ({run ? criteria.filter(({ row }) => row.conclusion === 'MET').length + '/' : ''}{criteria.length}{run ? ' đạt' : ''})</h3>
              {!criteria.length && <p className="vault-meta mt-2">Phiên bản này chưa có tiêu chí.</p>}
              <ul className="assessment-criteria">
                {criteria.map(({ criterion, row }, index) => {
                  const missing = row && ['NOT_MET', 'INSUFFICIENT_DATA'].includes(row.conclusion);
                  const needsLess = row && ['lte', 'eq'].includes(row.missing_details?.comparator)
                    && row.target_value != null && Number(row.actual_value) > Number(row.target_value);
                  const manualReview = row?.conclusion === 'INSUFFICIENT_DATA' && criterion?.coverage_status === 'MANUAL';
                  const canAdd = missing && !criterion?.is_exclusion && !needsLess;
                  const type = criterion?.rule?.filters?.find(filter => filter.field === 'achievement_type_id' && filter.operator === 'eq');
                  const addParams = new URLSearchParams({ add: '1', criterion: criterion?.title || '', ...(type ? { type: type.value } : {}) });
                  return <li key={row?.id || criterion?.id || index}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <strong>{criterion?.title || 'Tiêu chí'}</strong>
                      {manualReview ? <span className="vault-status assessment-warning">Cần hội đồng rà soát</span> : row && <AssessmentBadge run={row} />}
                    </div>
                    <div className="vault-meta mt-1"><RegulationRuleDescription rule={criterion?.rule || criterion?.rule_json} catalog={catalog.data?.achievementTypes} coverageStatus={criterion?.coverage_status} /></div>
                    {row?.actual_value != null && <p className="vault-meta">Hồ sơ ghi nhận: {row.actual_value} {row.measure_unit}</p>}
                    {criterion?.source_reference && <p className="vault-meta">Căn cứ: {criterion.source_reference}</p>}
                    {row && missingText(row.missing_details) && <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{missingText(row.missing_details)}</p>}
                    {!!row?.evidence_files?.length && <ul className="mt-2">{row.evidence_files.map(file => <li key={file.id}>
                      <button type="button" className="min-h-11 break-all text-left text-sm text-teal-800 underline dark:text-teal-300" disabled={downloading !== null}
                        onClick={() => download('/evidence-files/' + file.id + '/download', file.original_filename)}>{file.original_filename}</button>
                    </li>)}</ul>}
                    {missing && !manualReview && <div className="mt-2 flex flex-wrap gap-2">
                      {canAdd && <Link className={secondary} to={'/achievements?' + addParams}><Plus size={15} /> Bổ sung thành tích</Link>}
                      {(row.conclusion === 'INSUFFICIENT_DATA' || needsLess || criterion?.is_exclusion) && <Link className={secondary} to="/achievements">Kiểm tra dữ liệu đã nhập</Link>}
                      {!run.stale && row.conclusion === 'NOT_MET' && row.missing_details?.comparator === 'gte' && Number(row.missing_details?.remaining) > 0 && !criterion?.is_exclusion &&
                        (createdGoals[row.id] ? <Link className={secondary} to={createdGoals[row.id] === true ? '/kpi' : '/kpi?goal=' + createdGoals[row.id]}>Xem mục tiêu</Link>
                          : <button type="button" className={secondary} disabled={creatingGoal !== null} onClick={() => createGoal(row)}>{creatingGoal === row.id ? 'Đang tạo…' : 'Tạo mục tiêu'}</button>)}
                    </div>}
                  </li>;
                })}
              </ul>
              </>}
            </Load>}
        </section>
      </div>
      <Modal open={historyPage > 0} title="Lịch sử đối chiếu" subtitle={active?.name} onClose={() => setHistoryPage(0)}>
        <Load state={history}>
          <ul className="space-y-2">{array(history.data).map(entry => <li key={entry.id}>
            <button type="button" className={secondary + ' w-full flex-wrap !justify-between'} onClick={() => {
              setPreviousRun({ key, id: entry.id }); setHistoryPage(0);
            }}><span>Xét <DateText value={entry.evaluation_date} />{entry.completed_at && ' · ' + new Date(entry.completed_at).toLocaleString('vi-VN')}</span><AssessmentBadge run={entry} /></button>
          </li>)}</ul>
          {!array(history.data).length && <Empty>Chưa có lượt đối chiếu.</Empty>}
          {Number(summary?.history_count) > 10 && <NumberedPagination page={historyPage} totalPages={Math.ceil(Number(summary.history_count) / 10)} onPageChange={setHistoryPage} />}
        </Load>
      </Modal>
    </>}
  </Page>;
}

function AssessmentBadge({ run }) {
  return <span className={'vault-status ' + (run.conclusion === 'MET' ? 'is-positive' : run.conclusion === 'NOT_MET' ? 'is-muted' : run.conclusion === 'INSUFFICIENT_DATA' ? 'assessment-warning' : '')}>
    {conclusionLabel(run.conclusion)}{run.completion_percent != null ? ' · ' + run.completion_percent + '%' : ''}
  </span>;
}

export function Goals() {
  const [params, setParams] = useSearchParams();
  const requestedGoal = params.get('goal');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const state = useLoad(`/kpi/goals?page=${page}`);
  const [form, setForm] = useState({ title: '', target_value: '1', measure_unit: '', due_date: '' });
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [progress, setProgress] = useState('');
  const [task, setTask] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const detailRequest = useRef(0);

  const lecturerPresets = [
    { label: '01 Bài báo Scopus/WoS', title: 'Xuất bản 01 bài báo quốc tế uy tín (Scopus/WoS Q1-Q4)', target: 1, unit: 'bài báo' },
    { label: '02 Bài báo Tạp chí HĐGSNN', title: 'Xuất bản 02 bài báo tạp chí chuyên ngành tính điểm', target: 2, unit: 'bài báo' },
    { label: '01 Đề tài NCKH cấp Trường', title: 'Chủ nhiệm 01 đề tài NCKH cấp cơ sở nghiệm thu đạt', target: 1, unit: 'đề tài' },
    { label: '350 Giờ chuẩn giảng dạy', title: 'Hoàn thành định mức 350 giờ chuẩn giảng dạy trong năm học', target: 350, unit: 'giờ chuẩn' },
    { label: 'Hướng dẫn 02 Khóa luận TN', title: 'Hướng dẫn 02 sinh viên làm khóa luận tốt nghiệp / NCKH', target: 2, unit: 'sinh viên' },
  ];

  const totalPages = state.data?.total != null
    ? Math.max(1, Math.ceil(state.data.total / (state.data.pageSize || 20)))
    : 1;

  const goalList = array(state.data);
  const today = localDay();
  const dueSoonDays = 30;

  const getDaysLeft = (dueDate) => {
    if (!dueDate) return null;
    const diffTime = new Date(dueDate) - new Date(today);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const dueSoonCount = goalList.filter(g => {
    const d = getDaysLeft(g.due_date);
    return d !== null && d >= 0 && d <= dueSoonDays && !['COMPLETED', 'CANCELLED'].includes(g.status);
  }).length;

  const overdueCount = goalList.filter(g => {
    const d = getDaysLeft(g.due_date);
    return d !== null && d < 0 && !['COMPLETED', 'CANCELLED'].includes(g.status);
  }).length;

  const completedCount = goalList.filter(g => g.status === 'COMPLETED' || (Number(g.completion_percent) >= 100)).length;

  const open = useCallback(async id => {
    const requestId = ++detailRequest.current;
    try {
      setError(null);
      setConfirmDelete(false);
      setDetail(old => String(old?.id) === String(id) ? old : null);
      setSelected(id);
      const goal = await api('/kpi/goals/' + id);
      if (requestId === detailRequest.current) setDetail(goal);
    } catch (err) {
      if (requestId === detailRequest.current) {
        setError(err.status === 404 ? new Error('Mục tiêu này không còn trong danh sách của bạn.') : err);
      }
    }
  }, []);

  function closeGoal() {
    detailRequest.current++;
    setSelected(null); setDetail(null); setConfirmDelete(false); setError(null);
    if (requestedGoal) {
      const next = new URLSearchParams(params);
      next.delete('goal');
      setParams(next, { replace: true });
    }
  }

  async function deleteGoal() {
    if (deleting || !detail || !confirmDelete) return;
    setDeleting(true); setError(null); setNotice('');
    try {
      try { await api('/kpi/goals/' + detail.id, 'DELETE'); }
      catch (err) { if (err.status !== 404) throw err; }
      closeGoal();
      setNotice('Đã xóa mục tiêu KPI.');
      if (page > 1 && goalList.length <= 1) setPage(page - 1);
      else await state.reload();
    } catch (err) { setError(err); }
    finally { setDeleting(false); }
  }

  useEffect(() => {
    if (/^\d+$/.test(requestedGoal || '')) open(requestedGoal);
  }, [requestedGoal, open]);

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
    <Page title="Mục tiêu / KPI" description="Theo dõi định mức nghiên cứu khoa học, giờ giảng dạy và nhiệm vụ năm học của giảng viên." actions={addButton}>
      <ErrorMessage error={error} />
      {notice && <p role="status" className="vault-meta">{notice}</p>}
      
      <div className="vault-summary" aria-label="Tóm tắt mục tiêu">
        <span><strong>{state.data?.total ?? goalList.length}</strong> mục tiêu</span>
        <span className="vault-meta">Trên trang này</span>
        <span><strong>{dueSoonCount}</strong> sắp đến hạn</span>
        <span><strong>{overdueCount}</strong> quá hạn</span>
        <span><strong>{completedCount}</strong> hoàn thành</span>
      </div>

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
              Chưa có mục tiêu. Tạo mục tiêu hoặc bổ sung từ kết quả đối chiếu.
            </Empty>
          ) : (
            <>
              {/* Bảng danh sách mục tiêu có tiêu đề cột rõ ràng */}
              <div className="vault-table-wrap">
                <table className="vault-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '35%' }}>Tên mục tiêu & Nguồn</th>
                      <th scope="col">Thời hạn hoàn thành</th>
                      <th scope="col">Thực tế / Chỉ tiêu</th>
                      <th scope="col" style={{ width: '22%' }}>Tiến độ (%)</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col" className="text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {array(state.data).map(item => {
                      const percent = Math.min(100, Math.max(0, Number(item.completion_percent) || 0));
                      const daysLeft = getDaysLeft(item.due_date);
                      const isOverdue = daysLeft !== null && daysLeft < 0 && !['COMPLETED', 'CANCELLED'].includes(item.status);
                      const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= dueSoonDays && !['COMPLETED', 'CANCELLED'].includes(item.status);
                      
                      return (
                        <tr key={item.id} className="vault-goal-table-row">
                          <td>
                            <button 
                              type="button"
                              className="font-bold text-slate-800 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-300 text-left transition-colors" 
                              onClick={() => open(item.id)}
                            >
                              {item.title}
                            </button>
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              {item.source_result_id ? 'Tạo từ khoảng trống quy chế AI' : 'Mục tiêu định mức cá nhân'}
                            </span>
                          </td>
                          <td className="text-xs">
                            {item.due_date ? (
                              <div className="space-y-0.5">
                                <span className={isOverdue ? 'text-rose-600 font-bold' : isDueSoon ? 'text-amber-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                                  <DateText value={item.due_date} />
                                </span>
                                {isOverdue && (
                                  <span className="block text-[10px] text-rose-600 font-semibold">Đã quá hạn</span>
                                )}
                                {isDueSoon && (
                                  <span className="block text-[10px] text-amber-600 font-semibold">Còn {daysLeft} ngày</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Không đặt hạn</span>
                            )}
                          </td>
                          <td className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <strong>{item.current_value ?? 0}</strong> / {item.target_value} {item.measure_unit}
                          </td>
                          <td>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                                <span>{percent}%</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-700">
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

      {/* Modal Tạo mục tiêu mới kèm Gợi ý mẫu Giảng viên */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Tạo mục tiêu">
        <form onSubmit={create} className="space-y-4">
          <ErrorMessage error={error} />

          {/* Gợi ý mục tiêu nhanh chuẩn Giảng viên */}
          <div className="p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 space-y-2">
            <span className="text-xs font-bold text-teal-800 dark:text-teal-300 block">
              Gợi ý định mức chuẩn Giảng viên (Bấm để điền nhanh):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {lecturerPresets.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setForm({
                    ...form,
                    title: preset.title,
                    target_value: String(preset.target),
                    measure_unit: preset.unit,
                  })}
                  className="min-h-11 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 hover:border-teal-600 text-teal-900 dark:text-teal-200 hover:bg-teal-50 transition-all shadow-2xs"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Tên mục tiêu *">
            <input required className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ví dụ: Xuất bản 01 bài báo quốc tế (Scopus/WoS), 350 giờ chuẩn giảng dạy..." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Chỉ tiêu cần đạt *">
              <input required type="number" min="0.01" step="any" className={input} value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} />
            </Field>
            <Field label="Đơn vị tính *">
              <input required className={input} value={form.measure_unit} onChange={e => setForm({ ...form, measure_unit: e.target.value })} placeholder="bài báo, giờ chuẩn, đề tài..." />
            </Field>
            <Field label="Hạn hoàn thành">
              <input type="date" className={input} value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" className={secondary} onClick={() => setShowForm(false)}>Hủy</button>
            <button className={button}>Lưu mục tiêu</button>
          </div>
        </form>
      </Modal>

      {/* Modal Chi tiết mục tiêu (Đã phân 3 khu vực rõ ràng) */}
      <Modal open={selected !== null && !!detail} onClose={() => { if (!deleting) closeGoal(); }} title={detail?.title || 'Chi tiết mục tiêu KPI'}>
        <ErrorMessage error={error} />
        {detail && (confirmDelete ? <section className="space-y-4" aria-label="Xác nhận xóa mục tiêu">
          <h3 className="text-lg font-semibold">Xóa mục tiêu này?</h3>
          <p>Tiến độ và việc cần làm sẽ không còn truy cập được từ danh sách KPI. Hiện chưa có nút khôi phục.</p>
          <p className="vault-meta">Thành tích, minh chứng, kết quả đối chiếu và sự kiện lịch vẫn còn. Sự kiện lịch sẽ được gỡ liên kết với KPI này.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} disabled={deleting} onClick={() => { setConfirmDelete(false); setError(null); }}>Giữ mục tiêu</button>
            <button type="button" className="soft-btn-danger" disabled={deleting} onClick={deleteGoal}>{deleting ? 'Đang xóa…' : 'Xóa mục tiêu'}</button>
          </div>
        </section> :
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
            <button type="button" className="soft-btn-danger" onClick={() => { setConfirmDelete(true); setError(null); }}><Trash2 size={15} aria-hidden="true" /> Xóa mục tiêu</button>
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

export { default as Regulations } from './RegulationLibrary';

/* =====================================================================
   Cơ cấu tổ chức trực quan (Tree Hierarchy)
   ===================================================================== */
function OrgHierarchyTree({ org, parentOrg, childUnits }) {
  const [open, setOpen] = useState(false);
  if (!parentOrg && !childUnits.length) return null;

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
          {childUnits.length > 0 && (
            <div className="pl-6 space-y-1 pt-1 border-l-2 border-slate-200 dark:border-slate-700 ml-2">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                Đơn vị trực thuộc ({childUnits.length}):
              </span>
              {childUnits.map(child => (
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
  const applications = useLoad('/me/join-requests');
  const [showApplications, setShowApplications] = useState(false);
  const [joinOrg, setJoinOrg] = useState('');
  const [joinReason, setJoinReason] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const { hasRole } = useAuth();
  const admin = hasRole('SYSTEM_ADMIN');
  const [showForm, setShowForm] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [detailParams, setDetailParams] = useSearchParams();
  const selected = detailParams.get('organization') ? Number(detailParams.get('organization')) : null;
  const setSelected = id => setDetailParams(id ? { organization: String(id) } : {});
  const [renameOpen, setRenameOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [members, setMembers] = useState([]);
  const [workspaceTab, setWorkspaceTab] = useState('members');
  const [showMemberInvite, setShowMemberInvite] = useState(false);
  const [inviteFailures, setInviteFailures] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('TEAM');
  const [parent, setParent] = useState('');
  const membership = profile.data?.memberships || [];
  const permitted = useCallback((id, permission) => {
    if (admin) return true; 
    return (profile.data?.orgGrants || []).some(grant => {
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
  }, [admin, profile.data, state.data]);
  const grants = profile.data?.orgGrants || [];

  const mine = array(state.data).filter(org => admin || membership.some(m => String(m.organization_id) === String(org.id)) || grants.some(g => String(g.organization_id) === String(org.id)));
  
  const workspaceTabs = [
    ['members', 'Thành viên'],
    ...(selected && permitted(selected, 'STRUCTURE_MANAGE') ? [['structure', 'Cơ cấu tổ chức']] : []),
  ];
  const activeTab = workspaceTabs.some(([id]) => id === workspaceTab) ? workspaceTab : 'members';

  async function select(id) {
    if (id !== selected) {
      setWorkspaceTab('members');
      setShowMemberInvite(false);
      setMembers([]);
    }
    setSelected(id); 
    setError(null); 
    try { 
      if (permitted(id, 'MEMBERS_VIEW')) setMembers(array(await api(`/organizations/${id}/members?includeDescendants=auto`)));
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

  useEffect(() => {
    let cancelled = false;
    if (!selected || !profile.data || !state.data) return;
    if (!permitted(selected, 'MEMBERS_VIEW')) { setMembers([]); return; }
    api('/organizations/' + selected + '/members?includeDescendants=auto').then(value => { if (!cancelled) setMembers(array(value)); }).catch(err => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [selected, profile.data, state.data, permitted]);

  const selectedOrg = array(state.data).find(o => String(o.id) === String(selected));

  return (
    <Page 
      title="Tổ chức" 
      description="Không gian của các tổ chức bạn tham gia và những đơn vị bạn được giao quản lý." 
      actions={
        <div className="flex items-center gap-2">
          <button className={secondary} onClick={() => setShowApplications(true)}>Xin gia nhập</button>
          <button className={secondary} onClick={() => setShowInvites(true)}>
            Lời mời đến ({array(invites.data).filter(i => i.status === 'PENDING').length})
          </button>
          <button className={button} onClick={() => setShowForm(true)}>
            <Plus size={16} />
            <span>{admin ? 'Tạo tổ chức' : 'Tạo nhóm độc lập'}</span>
          </button>
        </div>
      }
    >
      <ErrorMessage error={error} />
      <Modal open={showApplications} onClose={() => setShowApplications(false)} title="Xin gia nhập tổ chức">
        <ErrorMessage error={error} />
        <form className="space-y-3" onSubmit={async event => {
          event.preventDefault();
          setError(null);
          try {
            await api(`/organizations/${joinOrg}/join-requests`, 'POST', joinReason.trim() ? { reason: joinReason.trim() } : {});
            setJoinOrg('');
            setJoinReason('');
            await applications.reload();
          } catch (err) { setError(err); }
        }}>
          <Field label="Đơn vị">
            <select className={input} required value={joinOrg} onChange={e => setJoinOrg(e.target.value)}>
              <option value="">Chọn đơn vị</option>
              {array(state.data).filter(o => !membership.some(m => String(m.organization_id) === String(o.id)) &&
                !array(applications.data).some(r => String(r.organization_id) === String(o.id) && r.status === 'PENDING'))
                .map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
            </select>
          </Field>
          <Field label="Lý do (không bắt buộc)"><input className={input} maxLength={500} value={joinReason} onChange={e => setJoinReason(e.target.value)} /></Field>
          <button className={button} disabled={!joinOrg}>Gửi yêu cầu</button>
        </form>
        <Load state={applications}>
          <ul className="mt-4 space-y-2">
            {array(applications.data).map(r => <li key={r.id}>{r.organization_name} · {({ PENDING: 'Đang chờ', ACCEPTED: 'Đã chấp nhận', DECLINED: 'Đã từ chối' })[r.status]}</li>)}
          </ul>
        </Load>
      </Modal>

      <nav aria-label="Đường dẫn" className="flex items-center gap-2 text-sm"><button type="button" className="min-h-11 text-teal-700" onClick={() => setSelected(null)}>Tổ chức</button>{selected && <span> / Chi tiết tổ chức</span>}</nav>
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Đổi tên tổ chức"><form className="space-y-4" onSubmit={async e => { e.preventDefault(); try { await api("/organizations/" + selected, "PATCH", { name: organizationName }); await state.reload(); setRenameOpen(false); } catch (err) { setError(err); } }}><Field label="Tên tổ chức"><input required maxLength={300} className={input} value={organizationName} onChange={e => setOrganizationName(e.target.value)} /></Field><button className={button}>Lưu thay đổi</button></form></Modal>
      {/* KHÔNG GIAN TỔ CHỨC ĐƯỢC CHỌN (HIỂN THỊ RÕ RÀNG VỚI NÚT ĐÓNG NỔI BẬT) */}
      {selected && selectedOrg && (
        <section id="active-org-workspace" className="p-6 mb-6 rounded-2xl bg-white dark:bg-slate-800 space-y-5 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 flex items-center justify-center font-bold text-lg">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{selectedOrg.name}</h2>{permitted(selected, "STRUCTURE_MANAGE") && <button type="button" className="min-h-11 min-w-11" aria-label="Đổi tên tổ chức" onClick={() => { setOrganizationName(selectedOrg.name); setRenameOpen(true); }}><Pencil size={17} /></button>}
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
              <X size={16} /> Quay lại danh sách
            </button>
          </div>

          <nav aria-label="Nội dung chi tiết tổ chức" className="flex flex-wrap gap-x-5 border-b border-slate-200 dark:border-slate-700">
            {workspaceTabs.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={activeTab === id}
                className={'min-h-11 border-b-2 px-2 text-sm font-semibold ' + (activeTab === id ? 'border-teal-600 text-teal-700 dark:text-teal-300' : 'border-transparent text-slate-600 hover:text-teal-700 dark:text-slate-300')}
                onClick={() => setWorkspaceTab(id)}>
                {label}
              </button>
            ))}
          </nav>
          <div hidden={activeTab !== 'members'}>
            <OrganizationMembers key={selected} members={members}
              organizationId={selected}
              organizations={array(state.data)} onOpenOrganization={select}
              canView={permitted(selected, 'MEMBERS_VIEW')} canEdit={permitted(selected, 'ACCESS_MANAGE')}
              canManage={permitted(selected, 'MEMBERS_MANAGE')} onInvite={() => setShowMemberInvite(true)}
              onRemove={async member => {
                if (!window.confirm('Xóa “' + (member.full_name || member.email) + '” khỏi “' + selectedOrg.name + '”?')) return false;
                await api('/organizations/' + selected + '/members/' + member.id, 'DELETE');
                await select(selected);
                return true;
              }}
              onSaved={profile.reload}
              canManageManagers={admin || (selectedOrg.parent_id && permitted(selectedOrg.parent_id, 'ACCESS_MANAGE'))}
            />
              {permitted(selected, 'MEMBERS_MANAGE') && (
                <Modal open={showMemberInvite} onClose={event => { if (inviting) event?.preventDefault(); else { setShowMemberInvite(false); setInviteFailures([]); } }} title="Mời thành viên">
                <form 
                  className="space-y-3"
                  onSubmit={async e => { 
                    e.preventDefault(); 
                    try { 
                      const raw = [...new Set(email.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean))];
                      if (!raw.length) return;
                      setInviting(true);
                      setInviteFailures([]);
                      const failures = [];
                      for (const address of raw) {
                        try {
                          await api('/organizations/' + selected + '/invitations', 'POST', { email: address });
                        } catch (err) {
                          failures.push({ address, message: err.message || 'Không thể gửi lời mời.' });
                        }
                      }
                      const count = raw.length - failures.length;
                      setInviteFailures(failures);
                      setEmail(failures.map(item => item.address).join(', '));
                      if (!failures.length) setShowMemberInvite(false);
                      setMessage('Đã gửi ' + count + '/' + raw.length + ' lời mời.');
                    } catch(err) {
                      setError(err);
                    } finally { setInviting(false); }
                  }}
                >
                  <Field label="Email thành viên (cách nhau bằng dấu phẩy hoặc xuống dòng)">
                    <textarea 
                      rows={2}
                      required 
                      placeholder="nguyenvana@lhu.edu.vn, tranvanb@lhu.edu.vn..." 
                      className={input} 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                    />
                  </Field>
                  {inviteFailures.length > 0 && <ul className="space-y-1 text-sm text-rose-700 dark:text-rose-300" role="alert">{inviteFailures.map(item => <li key={item.address}>{item.address} · {item.message}</li>)}</ul>}
                  <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                    <span className="vault-meta">
                      Tài khoản sẽ nhận được thông báo lời mời và xuất hiện trong danh sách sau khi đồng ý.
                    </span>
                    <button className={button} disabled={inviting}>{inviting ? 'Đang gửi…' : 'Gửi lời mời'}</button>
                  </div>
                </form>
                </Modal>
              )}
          </div>

          {selected && (workspaceTabs.length > 1 || permitted(selected, 'MEMBERS_MANAGE')) && (
            <OrganizationTools 
              permissions={{ 
                structure: permitted(selected, 'STRUCTURE_MANAGE'), 
                members: permitted(selected, 'MEMBERS_MANAGE')
              }} 
              key={selected} 
              organizationId={selected} 
              activeTab={activeTab}
              organizations={array(state.data)} 
              members={members} 
              refresh={async () => { await state.reload(); await profile.reload(); await select(selected); }}
            />
          )}
        </section>
      )}

      {/* DANH SÁCH CÁC TỔ CHỨC CỦA BẠN */}
      <section hidden={!!selected} className={panel}>
        <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100">Tổ chức của bạn</h2>
        <Load state={profile}>
          <Load state={state}>
            {!mine.length ? (
              <Empty action={<button className={secondary} onClick={() => setShowInvites(true)}>Xem lời mời tham gia</button>}>
                Bạn chưa tham gia tổ chức nào. Hãy kiểm tra lời mời hoặc tạo nhóm độc lập.
              </Empty>
            ) : (
              <div className="vault-library-list vault-organization-list">
                {mine.map(org => { 
                  const role = membership.find(m => String(m.organization_id) === String(org.id)); 
                  const parentOrg = array(state.data).find(o => String(o.id) === String(org.parent_id)); 
                  const isSelected = String(selected) === String(org.id);

                  return (
                    <article 
                      className="vault-organization-card"
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
                      <p className="vault-meta">{org.code}{parentOrg ? ' · Cấp trên: ' + parentOrg.name : ''}</p>

                      {/* Nút Xem chi tiết tổ chức - Nổi bật, dễ nhận biết */}
                      <div className="vault-card-actions pt-2 mt-auto">
                        <button 
                          type="button"
                          className={secondary}
                          aria-current={isSelected ? 'true' : undefined}
                          onClick={() => select(org.id)}
                        >
                          <Building2 size={15} />
                          <span>{isSelected ? 'Đang xem tổ chức' : 'Xem tổ chức'}</span>
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
        <form className="space-y-4" onSubmit={async e => { e.preventDefault(); try { await api('/organizations', 'POST', { name, code, organizationType: type, parentId: parent ? Number(parent) : null, ...(managerEmail.trim() ? { managerEmail: managerEmail.trim() } : {}) }); setName(''); setCode(''); setManagerEmail(''); setShowForm(false); await state.reload(); await profile.reload(); } catch (err) { setError(err); } }}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên"><input required className={input} value={name} onChange={e => setName(e.target.value)} /></Field>
            <Field label="Mã"><input required className={input} value={code} onChange={e => setCode(e.target.value)} /></Field>
            <Field label="Loại">
              <select className={input} value={type} onChange={e => setType(e.target.value)}>
                {(admin ? ['OTHER','UNIVERSITY','FACULTY','DEPARTMENT','CLASS','COMPANY','TEAM'] : parent ? ['FACULTY','DEPARTMENT','TEAM','OTHER'] : ['TEAM','OTHER']).map(t => <option key={t} value={t}>{displayLabel(t)}</option>)}
              </select>
            </Field>
            <Field label="Tổ chức cha">
              <select className={input} value={parent} onChange={e => { setParent(e.target.value); if (!admin && !e.target.value) setType('TEAM'); }}>
                <option value="">Không có</option>
                {array(state.data).filter(org => permitted(org.id,'STRUCTURE_MANAGE')).map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            </Field>
            {parent && <Field label="Email quản lý đơn vị mới (không bắt buộc)">
              <input className={input} type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} />
              <p className="text-xs text-slate-500">Để trống để bạn quản lý trực tiếp đơn vị mới.</p>
            </Field>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondary} onClick={() => setShowForm(false)}>Hủy</button>
            <button className={button}>Tạo tổ chức</button>
          </div>
        </form>
      </Modal>

      <Modal open={showInvites} onClose={() => setShowInvites(false)} title="Lời mời đến">
        <Load state={invites}>
          {!array(invites.data).length ? (
            <Empty>Chưa có lời mời. Người quản lý tổ chức có thể mời bạn bằng email tài khoản.</Empty>
          ) : (
            array(invites.data).map(inv => (
              <Item key={inv.id}>
                <p><strong>{inv.organization_name}</strong> · <StatusBadge value={inv.status} /></p>
                {inv.status === 'PENDING' && (
                  <div className="mt-3 flex gap-2">
                    <button className={button} onClick={() => respond(inv.id,true)}>Chấp nhận lời mời</button>
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

function OrganizationTools({ organizationId, organizations, members, permissions, activeTab, refresh }) {
  const links = useLoad(permissions.structure ? '/organizations/' + organizationId + '/link-requests' : null);
  const joinRequests = useLoad(permissions.members ? '/organizations/' + organizationId + '/join-requests' : null);
  const [childToInvite, setChildToInvite] = useState('');
  const [parent, setParent] = useState('');
  const [review, setReview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null), [message, setMessage] = useState('');
  const currentOrg = organizations.find(o => String(o.id) === String(organizationId));
  async function changeRequest(work, reload) {
    setError(null);
    setMessage('');
    try {
      await work();
      await reload();
      await refresh();
      setMessage('Đã cập nhật yêu cầu.');
    } catch (err) { setError(err); }
  }

  return (
    <div className="space-y-4">
      <ErrorMessage error={error} />
      {message && <p role="status" className="p-3 rounded-xl bg-teal-50 text-teal-800 text-xs font-semibold">{message}</p>}
      
      {permissions.members && (
        <section hidden={activeTab !== 'members'} className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="font-semibold text-sm">Yêu cầu gia nhập {array(joinRequests.data).filter(r => r.status === 'PENDING').length || ''}</h3>
          <Load state={joinRequests}>
            {!array(joinRequests.data).length && <p className="text-sm text-slate-500">Chưa có yêu cầu.</p>}
            {array(joinRequests.data).map(r => (
              <Item key={r.id}>
                <p><strong>{r.email}</strong> · <StatusBadge value={r.status} /></p>
                {r.reason && <p className="text-sm">{r.reason}</p>}
                {r.status === 'PENDING' && <div className="mt-2 flex gap-2">
                  {[true, false].map(accept => <button key={String(accept)} className={accept ? button : "soft-btn-danger"}
                    onClick={() => changeRequest(() => api(`/organizations/${organizationId}/join-requests/${r.id}/respond`, 'POST', { accept }), joinRequests.reload)}>
                    {accept ? 'Chấp nhận' : 'Từ chối'}
                  </button>)}
                </div>}
              </Item>
            ))}
          </Load>
        </section>
      )}
      {permissions.structure && (
        <div hidden={activeTab !== 'structure'} className="space-y-3">
          {currentOrg && <OrgHierarchyTree org={currentOrg}
            parentOrg={organizations.find(org => String(org.id) === String(currentOrg.parent_id))}
            childUnits={organizations.filter(org => String(org.parent_id) === String(organizationId))} />}
          <section className="vault-task-section"><h3>Thay đổi tổ chức cấp trên</h3>
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
            <button className={button} disabled={!parent && !currentOrg?.parent_id} onClick={() => {
              const from = organizations.find(o => String(o.id) === String(currentOrg?.parent_id))?.name || 'Không có';
              const to = organizations.find(o => String(o.id) === parent)?.name || 'Không có';
              setError(null);
              setReview({ from, to, targetParentId: parent ? Number(parent) : null });
            }}>
              Gửi yêu cầu
            </button>
          </div>
          </section>
          <section className="vault-task-section"><h3>Mời đơn vị trực thuộc</h3><div className="flex flex-wrap items-end gap-3">
            <Field label="Đơn vị muốn mời">
              <select className={input} value={childToInvite} onChange={e => setChildToInvite(e.target.value)}>
                <option value="">Chọn đơn vị</option>
                {organizations.filter(o => String(o.id) !== String(organizationId) && String(o.parent_id) !== String(organizationId))
                  .map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <button className={button} disabled={!childToInvite} onClick={() => changeRequest(async () => {
              await api(`/organizations/${childToInvite}/link-requests`, 'POST', { targetParentId: Number(organizationId) });
              setChildToInvite('');
            }, links.reload)}>Gửi lời mời liên kết</button>
          </div></section>
          <section className="vault-task-section"><Load state={links}>
            <h4 className="mt-4 text-sm font-semibold">Yêu cầu liên kết đến và đi</h4>
            {!array(links.data).length && <p className="text-sm text-slate-500">Chưa có yêu cầu.</p>}
            {array(links.data).map(r => (
              <Item key={r.id}>
                <p><strong>{r.child_name}</strong> {r.target_parent_name ? `→ ${r.target_parent_name}` : '· Tách khỏi đơn vị cha'} · <StatusBadge value={r.status} /></p>
                {r.status === 'PENDING' && new Date(r.expires_at) > new Date() && (
                  (String(r.child_organization_id) === String(organizationId) && !r.child_consented_by_user_id)
                  || (String(r.target_parent_id) === String(organizationId) && !r.parent_consented_by_user_id)
                ) && <div className="mt-2 flex gap-2">
                  {[true, false].map(accept => <button key={String(accept)} className={accept ? button : "soft-btn-danger"}
                    onClick={() => changeRequest(() => api(`/organization-link-requests/${r.id}/respond`, 'POST', { accept }), links.reload)}>
                    {accept ? 'Chấp nhận' : 'Từ chối'}
                  </button>)}
                </div>}
              </Item>
            ))}
          </Load></section>
        </div>
      )}

      <Modal open={!!review} title="Xác nhận yêu cầu đổi cấp trên" onClose={() => { if (!sending) setReview(null); }}>
        {review && <div className="space-y-4">
          <p><strong>{currentOrg?.name}</strong></p>
          <p className="vault-meta">Cấp trên hiện tại: {review.from}</p>
          <p className="vault-meta">Cấp trên đề nghị: {review.to}</p>
          <ErrorMessage error={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} disabled={sending} onClick={() => setReview(null)}>Hủy</button>
            <button type="button" className={button} disabled={sending} onClick={async () => {
              setSending(true);
              try {
                const ok = await changeRequest(() => api('/organizations/' + organizationId + '/link-requests', 'POST', { targetParentId: review.targetParentId }), links.reload);
                if (ok !== false) setReview(null);
              } finally { setSending(false); }
            }}>{sending ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
          </div>
        </div>}
      </Modal>
    </div>
  );
}

const organizationPermissionGroups = [
  ['Thành viên & cơ cấu', {
    MEMBERS_VIEW: 'Xem thành viên',
    MEMBERS_MANAGE: 'Quản lý thành viên',
    STRUCTURE_MANAGE: 'Quản lý cơ cấu',
    ACCESS_MANAGE: 'Quản lý quyền',
  }],
  ['Hồ sơ & thông báo', {
    ASSESSMENTS_VIEW: 'Xem kết quả đối chiếu',
    ASSESSMENTS_RUN: 'Đối chiếu hồ sơ',
    MEMBERS_NOTIFY: 'Gửi thông báo',
  }],
  ['Quy chế', {
    REGULATIONS_CREATE: 'Tạo quy chế',
    REGULATIONS_MANAGE: 'Soạn quy chế',
    REGULATIONS_PUBLISH: 'Công bố quy chế',
    REGULATIONS_SHARE: 'Chia sẻ quy chế',
    REGULATIONS_ADOPT: 'Tiếp nhận quy chế',
    REGULATIONS_UPDATE: 'Đổi phiên bản quy chế',
  }],
];

function OrganizationMembers({ organizationId, members, canView, canEdit, canManage, onInvite, onRemove, onSaved, canManageManagers, organizations, onOpenOrganization }) {
  const accessUrl = '/organizations/' + organizationId + '/access';
  const access = useLoad(canEdit ? accessUrl : null);
  const [editor, setEditor] = useState(null);
  const [unitFilter, setUnitFilter] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const byUser = new Map();
  for (const grant of canEdit ? array(access.data) : []) {
    const id = String(grant.user_id);
    if (!byUser.has(id)) byUser.set(id, []);
    byUser.get(id).push(grant);
  }
  const memberIds = new Set(members.map(member => String(member.user_id)));
  const organizationManagers = [...byUser.entries()].filter(([id, grants]) => !memberIds.has(id) && grants.some(g => g.permission_code === "ACCESS_MANAGE")).map(([, grants]) => ({ ...grants[0], title: "Quản lý" }));
  const allMembers = [...members, ...organizationManagers];
  const units = [...new Map(allMembers.map(member => [String(member.organization_id || organizationId), {
    id: String(member.organization_id || organizationId),
    name: member.organization_name || organizations.find(org => String(org.id) === String(organizationId))?.name || '',
  }])).values()];
  const filteredMembers = allMembers.filter(member =>
    (!unitFilter || String(member.organization_id || organizationId) === unitFilter) &&
    ((member.full_name || '') + ' ' + (member.email || '')).toLocaleLowerCase('vi').includes(memberSearch.trim().toLocaleLowerCase('vi')));
  const groupedMembers = new Map();
  for (const member of filteredMembers) {
    const key = String(member.user_id);
    if (!groupedMembers.has(key)) groupedMembers.set(key, []);
    groupedMembers.get(key).push(member);
  }
  const visibleMembers = [...groupedMembers.values()].map(entries => ({ ...entries[0], memberships: entries }));
  const totalPeople = new Set(allMembers.map(member => String(member.user_id))).size;
  const managers = !canManageManagers ? [] : canView ? [...byUser.entries()].filter(([id, grants]) => !memberIds.has(id) && !grants.some(g => g.permission_code === 'ACCESS_MANAGE')) : [...byUser.entries()];
  const accessReady = canEdit && !access.loading && !access.error;
  const actionClass = 'min-h-11 min-w-11 rounded-lg border border-transparent hover:border-current px-2 font-semibold hover:underline disabled:opacity-50';

  async function remove(member) {
    setRemoving(member.id);
    setError(null);
    setMessage('');
    try {
      if (await onRemove(member)) {
        setMessage('Đã xóa thành viên khỏi tổ chức.');
        if (canEdit) await access.reload();
        await onSaved();
      }
    } catch (err) {
      setError(err);
    } finally {
      setRemoving(null);
    }
  }

  function renderTable(people, isMembership) {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-4 py-3">Họ tên / Email</th>
              {isMembership && <th scope="col" className="px-4 py-3">Khoa / Đơn vị</th>}
              {isMembership && <th scope="col" className="px-4 py-3">Vai trò</th>}
              {canEdit && <th scope="col" className="px-4 py-3">Quyền</th>}
              {(canEdit || (isMembership && canManage)) && <th scope="col" className="px-4 py-3">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {people.map(person => {
              const grants = byUser.get(String(person.user_id)) || [];
              const manager = grants.some(g => g.permission_code === 'ACCESS_MANAGE');
              const direct = !person.organization_id || String(person.organization_id) === String(organizationId);
              const editable = direct && (!manager || canManageManagers);
              return (
                <tr key={person.user_id}>
                  <td className="px-4 py-3">
                    <strong className="block">{person.full_name || person.email}</strong>
                    {person.full_name && <span className="block text-xs text-slate-600 dark:text-slate-300">{person.email}</span>}
                  </td>
                  {isMembership && <td className="px-4 py-3"><div className="space-y-1">{(person.memberships || [person]).map(member => (
                    <div key={member.organization_id || organizationId}>{member.organization_name || organizations.find(org => String(org.id) === String(organizationId))?.name}
                      {member.organization_id && String(member.organization_id) !== String(organizationId) && <button type="button" className="ml-2 min-h-11 text-teal-700 underline" onClick={() => onOpenOrganization(member.organization_id)}>Xem đơn vị</button>}
                    </div>
                  ))}</div></td>}
                  {isMembership && <td className="px-4 py-3">{manager ? 'Quản lý' : person.title || 'Thành viên'}</td>}
                  {canEdit && <td className="px-4 py-3 whitespace-nowrap">{direct && accessReady ? new Set(grants.map(grant => grant.permission_code)).size + ' quyền' : '—'}</td>}
                  {(canEdit || (isMembership && canManage)) && (
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap">
                        {canEdit && editable && <button type="button" aria-label={"Chỉnh sửa quyền của " + (person.full_name || person.email)} title="Chỉnh sửa quyền" disabled={!accessReady || removing !== null}
                          className={actionClass + ' text-teal-700 dark:text-teal-300'}
                          onClick={() => setEditor({ person, grants })}><Pencil size={17} /></button>}
                        {isMembership && canManage && editable && memberIds.has(String(person.user_id)) && <button type="button" aria-label={"Xóa " + (person.full_name || person.email) + " khỏi tổ chức"} title="Xóa khỏi tổ chức" disabled={removing !== null}
                          className={actionClass + ' text-rose-700 dark:text-rose-300'}
                          onClick={() => remove(person)}><Trash2 size={17} /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">Danh sách thành viên{canView && ' (' + totalPeople + ')'}</h3>
        {canManage && <button type="button" className={button} onClick={onInvite}>Mời thành viên</button>}
      </div>
      {canView && <div className="flex flex-wrap items-end gap-3">
        <Field label="Tìm thành viên"><input className={input} type="search" placeholder="Họ tên hoặc email" value={memberSearch} onChange={event => setMemberSearch(event.target.value)} /></Field>
        <Field label="Khoa / Đơn vị"><select className={input} value={unitFilter} onChange={event => setUnitFilter(event.target.value)}><option value="">Tất cả đơn vị</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field>
        <p className="pb-3 text-sm text-slate-600 dark:text-slate-300">{visibleMembers.length} / {totalPeople} thành viên</p>
      </div>}
      <ErrorMessage error={error || (canEdit ? access.error : null)} />
      {message && <p role="status" className="text-sm text-teal-700 dark:text-teal-300">{message}</p>}
      {canView && visibleMembers.length > 0 ? renderTable(visibleMembers, true) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {canView ? allMembers.length ? 'Không có thành viên phù hợp với bộ lọc.' : 'Chưa có thành viên trong tổ chức.' : 'Bạn cần quyền xem danh sách thành viên.'}
        </p>
      )}
      {managers.length > 0 && (
        <section className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold">{canView ? 'Người được cấp quyền quản lý ngoài danh sách thành viên' : 'Người được cấp quyền trong tổ chức'}</h3>
          {renderTable(managers.map(([, grants]) => grants[0]), false)}
        </section>
      )}
      {canEdit && editor && (
        <OrganizationPermissionDialog
          editor={editor} accessUrl={accessUrl}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            setMessage('Đã lưu thay đổi quyền.');
            await access.reload();
            await onSaved();
          }}
        />
      )}
    </div>
  );
}

function OrganizationPermissionDialog({ editor, accessUrl, onClose, onSaved }) {
  const { person, grants } = editor;
  const [choices, setChoices] = useState(() => {
    const initial = new Map();
    for (const grant of grants) {
      initial.set(grant.permission_code, !!grant.include_descendants || initial.get(grant.permission_code) === true);
    }
    return initial;
  });
  const [initialChoices] = useState(choices);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const added = [...choices].filter(([code]) => !initialChoices.has(code)).length;
  const removed = [...initialChoices].filter(([code]) => !choices.has(code)).length;
  const changed = [...choices].filter(([code, scope]) => initialChoices.has(code) && initialChoices.get(code) !== scope).length;
  const [error, setError] = useState(null);

  function change(code, scope) {
    setChoices(previous => {
      const next = new Map(previous);
      if (scope === undefined) next.delete(code);
      else next.set(code, scope);
      return next;
    });
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!reviewing) { setReviewing(true); return; }
    setSaving(true);
    setError(null);
    try {
      await api(accessUrl + '/users/' + person.user_id, 'PUT', {
        grantIds: grants.map(grant => grant.id),
        permissions: [...choices].map(([permissionCode, includeDescendants]) => ({ permissionCode, includeDescendants })),
      });
      await onSaved();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <Modal open title={reviewing ? 'Xác nhận thay đổi quyền' : 'Chỉnh sửa quyền'} onClose={event => {
      if (saving) event?.preventDefault();
      else if (reviewing) setReviewing(false);
      else onClose();
    }}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <p className="font-semibold">{person.full_name || person.email}</p>
          {person.full_name && <p className="text-sm text-slate-600 dark:text-slate-300">{person.email}</p>}
        </div>
        <ErrorMessage error={error} />
        <p className="text-sm text-slate-600">Bao gồm đơn vị trực thuộc sẽ áp dụng quyền xuống các tổ chức con, ví dụ từ trường xuống các khoa.</p>
        {reviewing && <div role="status" className="vault-summary"><span>Thêm {added} quyền</span><span>Bỏ {removed} quyền</span><span>Đổi phạm vi {changed} quyền</span></div>}
        <div hidden={reviewing} className="max-h-[48dvh] overflow-y-auto pr-2 space-y-4">
          {organizationPermissionGroups.map(([group, labels]) => (
            <fieldset key={group} disabled={saving} className="rounded-xl border border-slate-200 px-3 dark:border-slate-700">
              <legend className="px-1 text-sm font-semibold"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="accent-teal-700" ref={node => { if (node) node.indeterminate = Object.keys(labels).some(code => choices.has(code)) && !Object.keys(labels).every(code => choices.has(code)); }} checked={Object.keys(labels).every(code => choices.has(code))} onChange={e => { const enabled = e.target.checked; setChoices(previous => { const next = new Map(previous); for (const code of Object.keys(labels)) { if (enabled) next.set(code, previous.get(code) ?? false); else next.delete(code); } return next; }); }} />{group}</label></legend>
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {Object.entries(labels).map(([code, label]) => (
                  <div key={code} className="flex flex-wrap items-center justify-between gap-x-4">
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-teal-700" checked={choices.has(code)}
                        onChange={e => change(code, e.target.checked ? false : undefined)} />
                      {label}
                    </label>
                    {choices.has(code) && (
                      <label className="flex min-h-11 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input type="checkbox" className="accent-teal-700" checked={choices.get(code)}
                          aria-label={label + ' — Bao gồm đơn vị trực thuộc'}
                          onChange={e => change(code, e.target.checked)} />
                        Bao gồm đơn vị trực thuộc
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button type="button" className={secondary} disabled={saving} onClick={() => reviewing ? setReviewing(false) : onClose()}>{reviewing ? 'Quay lại' : 'Hủy'}</button>
          <button className={button} disabled={saving}>{saving ? 'Đang lưu…' : reviewing ? 'Xác nhận lưu quyền' : 'Xem thay đổi'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* =====================================================================
   Trang Public CV & Báo cáo & Admin
   ===================================================================== */
export function PublicCv() {
  const { slug } = useParams(), state = useLoad(`/public/cv/${encodeURIComponent(slug)}`);
  return (
    <main className="public-cv min-h-screen bg-slate-50 p-5 sm:p-10 text-slate-800">
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
  const items = array(state.data);
  const years = new Map();
  const types = new Map();
  for (const item of items) {
    const year = String(item.achievedAt || '').slice(0, 4) || 'Chưa rõ';
    const type = item.typeName || 'Chưa phân loại';
    years.set(year, (years.get(year) || 0) + 1);
    types.set(type, (types.get(type) || 0) + 1);
  }
  const yearly = [...years].sort(([a], [b]) => a.localeCompare(b));
  const categories = [...types].sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b, 'vi'));
  const maxAnnual = Math.max(1, ...years.values());

  return (
    <Page title="Thống kê & Báo cáo"
      description="Thành tích trong kho cá nhân của bạn, tổng hợp theo năm và loại."
      actions={<Link className={secondary} to="/achievements">Về kho thành tích</Link>}>
      <Load state={state}>
        {!items.length ? <section className={panel}>
          <Empty action={<Link className={button} to="/achievements">Về kho thành tích</Link>}>Chưa có dữ liệu để thống kê.</Empty>
        </section> : <>
          <p className="vault-summary"><strong>{items.length} thành tích</strong><span>Tính trên toàn bộ kho cá nhân</span></p>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className={panel}>
              <h2 className="mb-3 text-lg font-bold">Thành tích theo năm</h2>
              <div className="vault-table-wrap"><table className="vault-table">
                <thead><tr><th scope="col">Năm</th><th scope="col">Số thành tích</th><th scope="col">Tỷ trọng</th></tr></thead>
                <tbody>{yearly.map(([year, count]) => <tr key={year}>
                  <th scope="row">{year}</th>
                  <td><strong>{count}</strong><div className="vault-report-track" aria-hidden="true"><span style={{ width: count / maxAnnual * 100 + '%' }} /></div></td>
                  <td>{Math.round(count / items.length * 100)}%</td>
                </tr>)}</tbody>
              </table></div>
            </section>
            <section className={panel}>
              <h2 className="mb-3 text-lg font-bold">Thành tích theo loại</h2>
              <ul className="space-y-4">{categories.map(([name, count]) => {
                const share = count / items.length * 100;
                return <li key={name}>
                  <div className="flex justify-between gap-2 text-sm"><span>{name}</span><strong className="shrink-0">{count} · {Math.round(share)}%</strong></div>
                  <div className="vault-report-track" aria-hidden="true"><span style={{ width: share + '%' }} /></div>
                </li>;
              })}</ul>
            </section>
          </div>
        </>}
      </Load>
    </Page>
  );
}

export function Admin() {
  const users = useLoad('/admin/users');
  const roles = useLoad('/admin/global-roles');
  const [tab, setTab] = useState('accounts');
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const accounts = array(users.data);
  const visibleAccounts = accounts.filter(user => (!status || status === user.account_status)
    && [user.full_name, user.email].filter(Boolean).join(' ').toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));

  function prepare(action) {
    setError(null);
    setMessage('');
    setPending(action);
  }

  async function confirm(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await pending.run();
      setMessage(pending.success);
      setPending(null);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title="Quản trị hệ thống" description="Quản lý tài khoản và quyền toàn hệ thống.">
      {message && <p role="status" className="vault-summary mb-4">{message}</p>}
      <VaultTabs label="Quản trị hệ thống" value={tab} onChange={setTab}
        items={[['accounts', 'Tài khoản'], ['roles', 'Phân quyền'], ['catalog', 'Danh mục']]}>
        {tab === 'accounts' && <section className={panel}>
          <div className="vault-toolbar">
            <Field label="Tìm theo tên hoặc email"><input type="search" className={input} value={query} onChange={event => setQuery(event.target.value)} /></Field>
            <Field label="Trạng thái"><select className={input} value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="DISABLED">Đã vô hiệu hóa</option>
            </select></Field>
          </div>
          <Load state={users}>
            {visibleAccounts.length ? <div className="vault-table-wrap"><table className="vault-table">
              <caption className="sr-only">Danh sách tài khoản</caption>
              <thead><tr><th scope="col">Tài khoản</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
              <tbody>{visibleAccounts.map(user => {
                const active = user.account_status === 'ACTIVE';
                return <tr key={user.id}>
                  <td><strong>{user.full_name || user.email}</strong>{user.full_name && <p className="vault-meta">{user.email}</p>}</td>
                  <td><StatusBadge value={user.account_status} /></td>
                  <td><button type="button" className={secondary} onClick={() => prepare({
                    title: active ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản',
                    target: user.email,
                    description: active ? 'Tài khoản sẽ không thể đăng nhập.' : 'Tài khoản có thể đăng nhập trở lại.',
                    success: active ? 'Đã vô hiệu hóa ' + user.email : 'Đã kích hoạt ' + user.email,
                    danger: active,
                    run: async () => { await api('/admin/users/' + user.id, 'PATCH', { accountStatus: active ? 'DISABLED' : 'ACTIVE' }); await users.reload(); },
                  })}>{active ? 'Vô hiệu hóa' : 'Kích hoạt'}</button></td>
                </tr>;
              })}</tbody>
            </table></div> : <Empty>{accounts.length ? 'Không có tài khoản khớp bộ lọc.' : 'Chưa có tài khoản.'}</Empty>}
          </Load>
        </section>}
        {tab === 'roles' && <section className={panel}>
          <h2 className="text-lg font-bold">Quyền toàn hệ thống</h2>
          <Load state={roles}>
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {array(roles.data).map(grant => <li key={grant.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span><strong>{grant.full_name || grant.email}</strong> · <StatusBadge value={grant.role_code} /></span>
                <button type="button" className={secondary} onClick={() => prepare({
                  title: 'Thu hồi quyền', target: grant.email || grant.full_name,
                  description: 'Quyền ' + (displayLabel(grant.role_code)) + ' sẽ bị thu hồi trên toàn hệ thống.',
                  success: 'Đã thu hồi quyền.', danger: true,
                  run: async () => { await api('/admin/global-roles/' + grant.id, 'DELETE'); await roles.reload(); },
                })}>Thu hồi quyền</button>
              </li>)}
            </ul>
            {!array(roles.data).length && <Empty>Chưa có quyền nào được cấp.</Empty>}
          </Load>
          <form className="vault-selection-footer" onSubmit={event => {
            event.preventDefault();
            const user = accounts.find(account => String(account.id) === userId);
            if (!user) return;
            prepare({
              title: 'Cấp quyền quản trị hệ thống', target: user.email,
              description: 'Tài khoản có thể quản lý danh sách tài khoản và quyền toàn hệ thống.',
              success: 'Đã cấp quyền cho ' + user.email,
              run: async () => { await api('/admin/global-roles', 'POST', { userId: Number(user.id), roleCode: 'SYSTEM_ADMIN' }); setUserId(''); await roles.reload(); },
            });
          }}>
            <Field label="Tài khoản"><select className={input} required value={userId} onChange={event => setUserId(event.target.value)}>
              <option value="">Chọn tài khoản</option>{accounts.map(user => <option key={user.id} value={user.id}>{user.full_name} · {user.email}</option>)}
            </select></Field>
            <button className={button} disabled={!userId}>Cấp quyền quản trị</button>
          </form>
        </section>}
        {tab === 'catalog' && <AchievementCatalog />}
      </VaultTabs>

      <Modal open={!!pending} title={pending?.title || 'Xác nhận'} onClose={event => {
        if (saving) event?.preventDefault();
        else setPending(null);
      }}>
        {pending && <form onSubmit={confirm} className="space-y-4">
          <div><strong>{pending.target}</strong><p className="vault-meta">{pending.description}</p></div>
          <ErrorMessage error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondary} disabled={saving} onClick={() => setPending(null)}>Hủy</button>
            <button className={pending.danger ? 'soft-btn-danger' : button} disabled={saving}>{saving ? 'Đang lưu…' : pending.title}</button>
          </div>
        </form>}
      </Modal>
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
          <div className="vault-table-wrap"><table className="vault-table">
            <thead><tr><th scope="col">Tên loại</th><th scope="col">Mã</th></tr></thead>
            <tbody>{state.data.achievementTypes.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.code}</td></tr>)}</tbody>
          </table></div>
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
