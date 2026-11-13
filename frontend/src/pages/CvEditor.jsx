import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Check,
  Copy,
  ExternalLink,
  FileDown,
  Globe,
  Lock,
  Save,
  Sparkles,
  User,
  RefreshCw,
  AlertCircle,
  FileText,
  ShieldCheck,
  GraduationCap,
  Layers,
} from 'lucide-react';
import { request } from '../services/request';
import apiClient from '../services/apiClient';
import {
  SLUG_REGEX,
  RESERVED_SLUGS,
  validateCvSlug,
  buildPublicCvUrl,
} from '../services/cvValidation';

export { SLUG_REGEX, RESERVED_SLUGS, validateCvSlug, buildPublicCvUrl };

export default function CvEditor() {
  const [profile, setProfile] = useState(null);
  const [slug, setSlug] = useState('');
  const [templateId, setTemplateId] = useState('Modern');
  const [isPublic, setIsPublic] = useState(false);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAchievementIds, setSelectedAchievementIds] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [contact, setContact] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [slugError, setSlugError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // 1. Fetch current CV Profile
  useEffect(() => {
    loadCvData();
  }, []);

  const loadCvData = async () => {
    setLoading(true);
    try {
      const res = await request({ url: '/me/cv', fresh: true });
      if (res) {
        setProfile(res);
        setSlug(res.slug || '');
        setTemplateId(res.templateId || 'Modern');
        setIsPublic(Boolean(res.isPublic));
        setHeadline(res.headline || '');
        setBio(res.bio || '');
        setSelectedAchievementIds(Array.isArray(res.selectedAchievementIds) ? res.selectedAchievementIds : []);
        setAchievements(Array.isArray(res.achievements) ? res.achievements : []);
        setContact(res.contact || {});
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Không thể tải thông tin CV' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Validate Slug
  const handleSlugChange = (val) => {
    const cleaned = val.trim().toLowerCase();
    setSlug(cleaned);
    const result = validateCvSlug(cleaned);
    setSlugError(result.error || '');
  };

  // 3. Save CV Profile
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (slug.trim()) {
      const validation = validateCvSlug(slug);
      if (!validation.valid) {
        setSlugError(validation.error);
        return;
      }
    }
    if (slugError) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        slug: slug.trim() || null,
        templateId,
        isPublic,
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        selectedAchievementIds,
      };
      const res = await request({ method: 'PUT', url: '/me/cv', data: payload });
      if (res) {
        setProfile(prev => ({
          ...prev,
          slug: res.slug || payload.slug,
          isPublic: res.isPublic !== undefined ? res.isPublic : payload.isPublic,
          templateId: res.templateId || payload.templateId,
          headline: res.headline || payload.headline,
          bio: res.bio || payload.bio,
          profileId: res.profileId || prev?.profileId,
        }));
      }
      setMessage({ type: 'success', text: 'Đã lưu thay đổi hồ sơ CV thành công!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Lỗi khi lưu CV' });
    } finally {
      setSaving(false);
    }
  };

  // 4. Export DOCX
  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      const response = await apiClient.get('/me/cv/export-docx', {
        responseType: 'blob',
      });
      const blob = new Blob([response], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanName = (contact?.fullName || 'LHU').replace(/\s+/g, '_');
      link.download = `CV_${cleanName}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi khi xuất file Word: ' + (err.message || 'Không thể tạo file') });
    } finally {
      setExportingDocx(false);
    }
  };

  // Toggle achievement selection
  const toggleAchievement = (achId) => {
    const idNum = Number(achId);
    setSelectedAchievementIds(prev =>
      prev.includes(idNum) ? prev.filter(x => x !== idNum) : [...prev, idNum]
    );
  };

  const selectAllAchievements = () => {
    setSelectedAchievementIds(achievements.map(a => Number(a.achievement_id || a.achievementId || a.id)));
  };

  const deselectAllAchievements = () => {
    setSelectedAchievementIds([]);
  };

  // Public identifier & Link
  const publicIdentifier = slug.trim() || profile?.profileId;
  const publicUrl = publicIdentifier ? `${window.location.origin}/cv/${publicIdentifier}` : '';

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      alert('Không thể tự động sao chép. Vui lòng chọn và sao chép đường link bên dưới.');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Đang tải hồ sơ CV...</p>
      </div>
    );
  }

  return (
    <main className="space-y-6 pb-20 text-slate-800 dark:text-slate-100">
      {/* Page Header */}
      <header className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-soft-sm dark:border-slate-700 dark:bg-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/me/profile"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-600 dark:text-slate-400 mb-2 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại Hồ sơ năng lực
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Thiết lập CV & Trang giới thiệu Cá nhân
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tùy chỉnh đường dẫn định danh (Slug), chọn giao diện hiển thị, quản lý quyền riêng tư và tải bản Word (.docx).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Word DOCX Download */}
            <button
              type="button"
              disabled={exportingDocx}
              onClick={handleExportDocx}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 shadow-soft-sm"
            >
              {exportingDocx ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Đang tạo Word...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Tải bản Word (.docx)</span>
                </>
              )}
            </button>

            {/* View Public CV Link */}
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300 text-xs font-semibold flex items-center gap-2 transition shadow-soft-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Xem trang công khai</span>
              </a>
            )}

            {/* Save Button */}
            <button
              type="button"
              disabled={saving || Boolean(slugError)}
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 transition shadow-soft-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {message.text && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 border ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </header>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 Cols): Slug, Privacy, Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Slug & Public Link Setting */}
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-teal-600" />
              <span>Đường dẫn truy cập định danh (Custom Slug)</span>
            </h2>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Địa chỉ URL của trang CV
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs font-mono border border-slate-200 dark:border-slate-600 shrink-0">
                  {window.location.origin}/cv/
                </span>
                <input
                  type="text"
                  placeholder={profile?.profileId ? profile.profileId.slice(0, 18) + '...' : 'ho-ten-giang-vien'}
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={`flex-1 min-w-[200px] px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 ${
                    slugError
                      ? 'border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500'
                  }`}
                />
                {publicUrl && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
                  >
                    {copySuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copySuccess ? 'Đã chép!' : 'Sao chép link'}</span>
                  </button>
                )}
              </div>

              {slugError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{slugError}</p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  {slug ? (
                    <>Slug hợp lệ: 3-100 ký tự chữ thường, số và dấu gạch ngang.</>
                  ) : (
                    <>
                      Nếu để trống slug, hệ thống sẽ sử dụng mã định danh UUID duy nhất:{' '}
                      <strong className="font-mono text-slate-600 dark:text-slate-300">
                        /cv/{profile?.profileId || 'uuid'}
                      </strong>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Public/Private Toggle Switch */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  {isPublic ? (
                    <>
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span>Chế độ Công khai (Public)</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>Chế độ Riêng tư (Private)</span>
                    </>
                  )}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isPublic
                    ? 'Bất kỳ ai có đường link đều có thể xem trang CV này mà không cần đăng nhập.'
                    : 'Người truy cập link sẽ thấy màn hình thông báo hồ sơ đang ở chế độ riêng tư.'}
                </p>
              </div>

              {/* Toggle control */}
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                  isPublic ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPublic ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Section 2: Headline & Bio */}
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-teal-600" />
              <span>Tiêu đề nghề nghiệp & Giới thiệu</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề chức danh / Lĩnh vực chuyên môn (Headline)
                </label>
                <input
                  type="text"
                  maxLength={255}
                  placeholder="Ví dụ: PGS.TS Giảng viên Khoa Công nghệ thông tin | Chuyên gia Trí tuệ nhân tạo"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Tiểu sử tóm tắt (Bio)
                  </label>
                  <span className="text-[11px] text-slate-400">{bio.length} / 5000 ký tự</span>
                </div>
                <textarea
                  rows={5}
                  maxLength={5000}
                  placeholder="Giới thiệu hướng nghiên cứu chính, các giải thưởng khoa học, các dự án thực tế tiêu biểu..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white resize-y"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Select Achievements to Display */}
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-teal-600" />
                  <span>Chọn Thành tích từ Kho cá nhân hiển thị trên CV</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đã chọn {selectedAchievementIds.length} / {achievements.length} thành tích
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllAchievements}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={deselectAllAchievements}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            {achievements.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Bạn chưa có thành tích nào trong Kho cá nhân. Hãy thêm thành tích tại mục{' '}
                <Link to="/achievements" className="text-teal-600 underline">Kho thành tích</Link>.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {achievements.map((ach) => {
                  const id = Number(ach.achievement_id || ach.achievementId || ach.id);
                  const isChecked = selectedAchievementIds.includes(id);

                  return (
                    <label
                      key={id}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border transition cursor-pointer text-xs ${
                        isChecked
                          ? 'border-teal-500 bg-teal-50/40 dark:bg-teal-950/20'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAchievement(id)}
                        className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                      />
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 dark:text-white truncate">
                            {ach.title}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold shrink-0">
                            {ach.status || 'ACTIVE'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          {ach.recognition_year && <span>Năm {ach.recognition_year}</span>}
                          {ach.issuing_authority && <span>• Cấp bởi: {ach.issuing_authority}</span>}
                          {ach.decision_number && <span>• Số QĐ: {ach.decision_number}</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column (4 Cols): Template Selector */}
        <aside className="lg:col-span-4 space-y-6">
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Giao diện mẫu CV (3 Templates)</span>
            </h2>

            <div className="space-y-3">
              {[
                {
                  id: 'Modern',
                  name: 'Modern (Hiện đại)',
                  desc: 'Bố cục 2 cột năng động, màu nhấn teal/slate hiện đại, phù hợp chuyển đổi số.',
                  badge: 'Khuyên dùng',
                },
                {
                  id: 'Academic',
                  name: 'Academic (Hàn lâm)',
                  desc: 'Font serif trang trọng, nhấn mạnh học vị, chức danh và phân loại công trình khoa học.',
                  badge: 'Giảng viên / Nghiên cứu',
                },
                {
                  id: 'Minimalist',
                  name: 'Minimalist (Tối giản)',
                  desc: 'Khoảng trắng thanh lịch, tinh gọn, tập trung trực tiếp vào thành tựu cốt lõi.',
                  badge: 'Gọn gàng',
                },
              ].map((tmpl) => (
                <label
                  key={tmpl.id}
                  className={`block p-4 rounded-2xl border transition cursor-pointer text-xs ${
                    templateId === tmpl.id
                      ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/40 ring-1 ring-teal-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <input
                        type="radio"
                        name="templateId"
                        value={tmpl.id}
                        checked={templateId === tmpl.id}
                        onChange={() => setTemplateId(tmpl.id)}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>{tmpl.name}</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                      {tmpl.badge}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed pl-6">
                    {tmpl.desc}
                  </p>
                </label>
              ))}
            </div>
          </section>

          {/* Contact Preview Card */}
          <section className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Thông tin danh tính LHU</span>
            </h3>
            <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <p><strong>Họ tên:</strong> {contact.fullName || '—'}</p>
              <p><strong>Học vị:</strong> {contact.degree || '—'}</p>
              <p><strong>Chức danh:</strong> {contact.title || '—'}</p>
              <p><strong>Đơn vị:</strong> {contact.unitName || '—'}</p>
              <p><strong>Email:</strong> {contact.email || '—'}</p>
            </div>
            <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
              Thông tin danh tính chính thức được đồng bộ từ tài khoản LHU.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
