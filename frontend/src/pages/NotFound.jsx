import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { signedIn } = useAuth();
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-start justify-center gap-4 px-6 text-slate-800 dark:text-slate-100">
      <h1 className="text-2xl font-bold">Không tìm thấy trang</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">Đường dẫn có thể đã thay đổi hoặc hết hiệu lực.</p>
      <Link to={signedIn ? '/me/dashboard' : '/login'} className="soft-btn-primary">
        {signedIn ? 'Về không gian làm việc' : 'Về đăng nhập'}
      </Link>
    </main>
  );
}
