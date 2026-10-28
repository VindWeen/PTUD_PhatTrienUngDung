import PortfolioAchievements from '../components/PortfolioAchievements';
import UnderlineTabs from '../components/common/UnderlineTabs';
import PageHeader from '../components/common/PageHeader';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Medal,
  LockKeyhole,
  KeyRound,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useDemoAuth';
import { portfolioApi } from '../services/portfolioApi';
import { EmptyState, ErrorState, LoadingState } from '../components/common/AsyncState';

export default function ProfilePortfolio() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('nckh');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [profileDraft, setProfileDraft] = useState({ phone: '', title: '', degree: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState('');

  const loadProfile = useCallback(async (fresh = true) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await portfolioApi.getPersonalProfile(fresh);
      setProfile(data);
      setProfileDraft({ phone: data.phone || '', title: data.title || '', degree: data.degree || '' });
    } catch (error) {
      setProfile(null);
      setProfileError(error);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(false); }, [loadProfile]);

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileSaving(true); setProfileError(null); setProfileSaveMessage('');
    try {
      const updated = await portfolioApi.updatePersonalProfile({ ...profileDraft, version: profile.version });
      setProfile(updated);
      setProfileDraft({ phone: updated.phone || '', title: updated.title || '', degree: updated.degree || '' });
      setProfileSaveMessage('Đã cập nhật hồ sơ cá nhân.');
    } catch (error) { setProfileError(error); } finally { setProfileSaving(false); }
  };

  const tabs = [
    { id: 'nckh', label: 'Nghiên cứu khoa học' },
    { id: 'teaching', label: 'Giảng dạy' },
    { id: 'awards', label: 'Khen thưởng' },
    { id: 'evidences', label: 'Minh chứng' },
  ];

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    if (oldPassword === newPassword) {
      setPasswordError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({ oldPassword, newPassword });
      setPasswordSuccess('Đổi mật khẩu thành công! Các phiên đăng nhập cũ đã được thu hồi. Đang chuyển về trang đăng nhập...');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      setPasswordError(err.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const pageHeader = (<PageHeader title="Hồ sơ năng lực" description={profile?.updatedAt ? `Cập nhật lần cuối: ${new Date(profile.updatedAt).toLocaleDateString('vi-VN')}` : 'Thông tin cá nhân, thành tích và minh chứng của bạn.'} icon={Medal} onRefresh={loadProfile} refreshing={profileLoading} secondaryActions={<><button type="button" onClick={() => navigate('/me/cv')} className="soft-btn-secondary h-11 text-sm">Tạo CV cá nhân</button><button
            onClick={() => {
              setShowPasswordModal(true);
              setPasswordError(null);
              setPasswordSuccess(null);
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }}
            type="button" disabled={profileLoading}
            className="soft-btn-secondary h-11 text-sm disabled:opacity-50"
          >
            <LockKeyhole className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Đổi mật khẩu</span>
          </button></>} tabs={<UnderlineTabs label="Nội dung hồ sơ năng lực" items={tabs} value={activeTab} onChange={setActiveTab} />} />);
  if (profileLoading) return <div className="space-y-6">{pageHeader}<LoadingState label="Đang tải hồ sơ năng lực..." layout="cards" /></div>;
  if (profileError) return <div className="space-y-6">{pageHeader}<ErrorState error={profileError} onRetry={loadProfile} /></div>;
  if (!profile) return <div className="space-y-6">{pageHeader}<EmptyState message="Chưa có hồ sơ năng lực." /></div>;

  return (
    <div className="space-y-7 animate-fadeIn">
      {pageHeader}

      <form onSubmit={handleProfileSave} className="soft-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div><h2 className="font-bold text-slate-900 dark:text-white">Thông tin hồ sơ cá nhân</h2><p className="text-xs text-slate-500">Mã {profile.employeeCode} · {profile.fullName} · {profile.email}</p></div>
          <button type="submit" disabled={profileSaving} className="soft-btn-primary text-xs">{profileSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </div>
        {profileSaveMessage && <p className="text-xs text-emerald-600">{profileSaveMessage}</p>}
        {profileError && <p role="alert" className="text-xs text-rose-600">{profileError.message || 'Không thể cập nhật hồ sơ.'}</p>}
        <div className="grid sm:grid-cols-3 gap-4">
          {[['phone', 'Số điện thoại'], ['title', 'Chức danh'], ['degree', 'Học vị']].map(([field, label]) => <label key={field} className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}<input value={profileDraft[field]} onChange={(e) => setProfileDraft((value) => ({ ...value, [field]: e.target.value }))} maxLength={field === 'phone' ? 20 : 50} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" /></label>)}
        </div>
      </form>

      {/* 2. Main Two Columns Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* LEFT COLUMN (4 cols): Quá trình công tác + Danh hiệu */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Quá trình công tác */}
          <div className="soft-card p-6 sm:p-7">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="w-1.5 h-6 rounded-full bg-slate-800 dark:bg-slate-300" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Quá trình công tác
              </h2>
            </div>

            <p className="mb-4 text-xs text-slate-500">Lịch sử được lấy từ phân công đơn vị công tác trong hệ thống. Việc đổi phân công cần cán bộ quản trị cập nhật; hiện chưa có biểu mẫu thêm/sửa/xóa tại hồ sơ cá nhân.</p>
            <div className="relative pl-6 space-y-7 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {(profile.workHistory || []).map((item, index) => <div className="relative" key={item.assignmentId}>
                <div className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full ${index === 0 ? 'bg-slate-800 dark:bg-slate-200' : 'bg-slate-300 dark:bg-slate-500'} ring-4 ring-white dark:ring-soft-darkCard`} />
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{item.period}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{item.position}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{item.department || item.unitName}</div>
              </div>)}
              {!profile.workHistory?.length && <p className="text-xs text-slate-500">Chưa có lịch sử công tác.</p>}
            </div>
          </div>

          {/* Card 2: Danh hiệu */}
          <div className="soft-card p-6 sm:p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-1.5 h-6 rounded-full bg-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Danh hiệu</h2>
            </div>

            <div className="space-y-3.5">
              {(profile.titlesAndHonors || []).map((award) => <div key={award.awardRecordId} className="p-4 rounded-2xl bg-[#fdf9e8] dark:bg-[#2b271b] border border-amber-200/50 dark:border-amber-900/40 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white dark:bg-amber-950/60 text-amber-500 flex items-center justify-center"><Medal className="w-6 h-6" /></div>
                <div><div className="text-xs sm:text-sm font-bold">{award.awardTypeName} ({award.recognitionYear})</div><div className="text-[11px] text-amber-700 dark:text-amber-300/80">{award.level} · {award.decisionNumber}</div></div>
              </div>)}
              {!profile.titlesAndHonors?.length && <p className="text-xs text-slate-500">Chưa có danh hiệu được ghi nhận.</p>}
            </div>
            <p className="mt-4 text-xs text-slate-500">Danh hiệu được cán bộ phụ trách ghi nhận tại trang Khen thưởng, dựa trên quyết định chính thức.</p>
          </div>
        </div>

        <div className="lg:col-span-8"><PortfolioAchievements key={profile.updatedAt} profile={profile} activeTab={activeTab} /></div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="soft-card max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Đổi mật khẩu tài khoản
                </h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đổi mật khẩu sẽ tự động thu hồi tất cả các phiên làm việc và refresh token trên các thiết bị khác.
            </p>

            {passwordError && (
              <div className="p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 text-xs rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                {passwordSuccess}
              </div>
            )}

            {!passwordSuccess && (
              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu mới (tối thiểu 8 ký tự)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới từ 8 ký tự"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={passwordLoading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="soft-btn-primary text-xs"
                  >
                    {passwordLoading ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
