import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/VaultDialog';
import { ExternalLink, FileDown, Check, Copy, QrCode } from 'lucide-react';
import { api, array, saveBlob } from '../services/vaultApi';
import { useCollection } from '../hooks/useCollection';
import { useLoad } from '../hooks/useLoad';
import { Page } from '../components/common/VaultPage';
import { ErrorMessage, Field, Empty, Load } from '../components/common/VaultPrimitives';
import { input, button, secondary } from '../components/common/vaultStyles';

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
