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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async event => {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setLoading(true);
    try { const result = await authApi.resetPassword(token, password); setPassword(''); setConfirm(''); setSuccess(result.message); }
    catch (err) { setError(err.message || 'Không thể đặt lại mật khẩu.'); }
    finally { setLoading(false); }
  };
  return <main className="mx-auto max-w-md p-8">
    <h1 className="mb-4 text-2xl font-bold">Đặt lại mật khẩu</h1>
    {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
    {success ? <p role="status">{success}</p> : token ? <form onSubmit={submit} className="space-y-4">
      <label className="block">Mật khẩu mới<input className="mt-1 w-full rounded border p-2" type="password" minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      <label className="block">Xác nhận mật khẩu<input className="mt-1 w-full rounded border p-2" type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
      <button className="rounded bg-blue-700 px-4 py-2 text-white" disabled={loading}>{loading ? 'Đang xử lý…' : 'Đặt lại mật khẩu'}</button>
    </form> : <p role="alert">Liên kết đặt lại mật khẩu không hợp lệ.</p>}
    <p className="mt-4"><Link className="text-blue-700 underline" to="/login">Quay lại đăng nhập</Link></p>
  </main>;
}
