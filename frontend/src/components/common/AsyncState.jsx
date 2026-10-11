import React from 'react';

export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-700/60 ${className}`} />;
}

export function LoadingState({ label = 'Đang tải dữ liệu...', message, rows = 4, layout = 'list' }) {
  return <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
    <span className="sr-only">{message || label}</span>
    <div aria-hidden="true" className={layout === 'cards' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="soft-card p-5 space-y-4">
        <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 shrink-0" /><Skeleton className="h-4 w-2/5" /><Skeleton className="ml-auto h-6 w-20" /></div>
        <Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/2" />
      </div>)}
    </div>
  </div>;
}

export function PageSkeleton({ title, label, layout = 'cards' }) {
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{title}</h1><Skeleton className="mt-3 h-3 w-64 max-w-full" /></header>
    <LoadingState label={label} layout={layout} rows={layout === 'cards' ? 6 : 4} />
  </div>;
}

export function ErrorState({ error, message, onRetry }) {
  return (
    <div role="alert" className="soft-card p-8 text-center">
      <p className="font-semibold text-rose-600 dark:text-rose-400">{error?.message || message || 'Không thể tải dữ liệu.'}</p>
      {error?.correlationId && <p className="mt-1 text-xs text-slate-400">Mã tra cứu: {error.correlationId}</p>}
      {onRetry && <button type="button" onClick={onRetry} className="soft-btn-primary mt-4 text-xs">Thử lại</button>}
    </div>
  );
}

export function EmptyState({ message = 'Chưa có dữ liệu.' }) {
  return <div className="soft-card p-8 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>;
}
