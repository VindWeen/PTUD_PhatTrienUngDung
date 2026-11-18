import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/authApi';

export default function ResetPassword() {
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    return value;
  });
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const mismatch = (attempted || Boolean(confirm)) && confirm !== password;
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async event => {
    event.preventDefault(); setError(''); setAttempted(true);
    if (password !== confirm) return;
    setLoading(true);
    try { const result = await authApi.resetPassword(token, password); setPassword(''); setConfirm(''); setSuccess(result.data?.message || 'Mật khẩu đã được cập nhật. Bạn có thể đăng nhập lại.'); }
    catch (err) { setError(err.message || 'Không thể đặt lại mật khẩu.'); }
    finally { setLoading(false); }
  };
  return <main className="min-h-screen bg-slate-100 px-5 py-12 text-slate-800 dark:bg-slate-950 dark:text-slate-100"><div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-9">
    <h1 className="mb-2 mt-4 text-2xl font-bold">Đặt lại mật khẩu</h1>
    <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">Tạo mật khẩu mới cho tài khoản của bạn.</p>
    {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
    {success ? <p role="status">{success}</p> : token ? <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">Mật khẩu mới<input className="soft-input mt-1 w-full" type={show ? 'text' : 'password'} minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      <label className="block text-sm font-medium">Xác nhận mật khẩu<input className="soft-input mt-1 w-full" type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
      {mismatch && <p id="reset-confirm-error" className="text-sm text-rose-700 dark:text-rose-300">Mật khẩu xác nhận không khớp.</p>}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} />Hiện mật khẩu</label>
      <button className="soft-btn-primary min-h-11 w-full" disabled={loading}>{loading ? 'Đang xử lý…' : 'Đặt lại mật khẩu'}</button>
    </form> : <p role="alert">Liên kết đặt lại mật khẩu không hợp lệ. Quay lại đăng nhập để yêu cầu liên kết mới.</p>}
    <p className="mt-6 text-sm"><Link className="font-semibold text-teal-700 underline dark:text-teal-300" to="/login">Quay lại đăng nhập</Link></p>
  </div></main>;
}
