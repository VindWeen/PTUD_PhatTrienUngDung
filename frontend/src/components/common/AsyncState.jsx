import React from 'react';

export function LoadingState({ label = 'Đang tải dữ liệu...' }) {
  return <div role="status" className="soft-card p-8 text-center text-sm text-slate-500 dark:text-slate-400">{label}</div>;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="soft-card p-8 text-center">
      <p className="font-semibold text-rose-600 dark:text-rose-400">{error?.message || 'Không thể tải dữ liệu.'}</p>
      {error?.correlationId && <p className="mt-1 text-xs text-slate-400">Mã tra cứu: {error.correlationId}</p>}
      {onRetry && <button type="button" onClick={onRetry} className="soft-btn-primary mt-4 text-xs">Thử lại</button>}
    </div>
  );
}

export function EmptyState({ message = 'Chưa có dữ liệu.' }) {
  return <div className="soft-card p-8 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>;
}
