import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="text-6xl font-bold text-teal-700 mb-4 dark:text-teal-300">404</div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        Không tìm thấy trang yêu cầu
      </h2>
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300 max-w-sm mb-6">
        Đường dẫn bạn truy cập không tồn tại hoặc đã được thay đổi trong hệ thống.
      </p>
      <Link to="/" className="soft-btn-primary text-xs">
        <Home className="w-4 h-4" />
        <span>Về Bảng điều khiển</span>
      </Link>
    </div>
  );
}
