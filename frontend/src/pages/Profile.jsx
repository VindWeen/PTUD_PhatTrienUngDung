import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VaultTabs from '../components/common/VaultTabs';
import { api } from '../services/vaultApi';
import { useLoad } from '../hooks/useLoad';
import { Page } from '../components/common/VaultPage';
import { ErrorMessage, Field, Load, displayLabel } from '../components/common/VaultPrimitives';
import { input, button, panel } from '../components/common/vaultStyles';
import { Cv } from './Cv';

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
