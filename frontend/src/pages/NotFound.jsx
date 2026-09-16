import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="text-6xl font-black text-brand-500 mb-2">404</div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        Không tìm thấy trang yêu cầu
      </h2>
      <p className="text-xs text-slate-400 max-w-sm mb-6">
        Đường dẫn bạn truy cập không tồn tại hoặc đã được thay đổi trong hệ thống.
      </p>
      <Link to="/" className="soft-btn-primary text-xs">
        <Home className="w-4 h-4" />
        <span>Về Bảng điều khiển</span>
      </Link>
    </div>
  );
}
