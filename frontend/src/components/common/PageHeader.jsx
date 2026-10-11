import React from 'react';
import { Download, Moon, Plus, RefreshCw, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối';
  return <button type="button" onClick={toggleTheme} aria-label={label} title={label}
    className="soft-btn-secondary h-11 w-11 shrink-0 !p-0 justify-center">
    {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
  </button>;
}

// Shared action order: refresh, export, page-specific action, theme.
export default function PageHeader({ title, description, icon: Icon, badge, onRefresh, refreshing = false, exportAction, primaryAction, secondaryActions, tabs }) {
  return <header data-page-header className="soft-card overflow-hidden [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-teal-500">
    <div className="flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <span className="shrink-0 rounded-2xl bg-teal-50 p-2.5 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400"><Icon className="h-6 w-6" /></span>}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{title}</h1>{badge}</div>
          {description && <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {onRefresh && <button type="button" onClick={() => onRefresh()} disabled={refreshing} className="soft-btn-secondary h-11 text-sm disabled:opacity-50 disabled:cursor-not-allowed" aria-busy={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} /> Làm mới
        </button>}
        {exportAction && <button type="button" onClick={exportAction.onClick} disabled={exportAction.disabled} className="soft-btn-secondary h-11 text-sm disabled:opacity-50 disabled:cursor-not-allowed"><Download className="h-4 w-4" />{exportAction.label || 'Xuất dữ liệu'}</button>}
        {secondaryActions}
        {primaryAction && <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled} className="soft-btn-primary h-11 text-sm"><Plus className="h-4 w-4" />{primaryAction.label}</button>}
        <ThemeToggle />
      </div>
    </div>
    {tabs && <div className="border-t border-slate-200/80 px-5 pb-3 pt-1 dark:border-slate-700/80 sm:px-6">{tabs}</div>}
  </header>;
}
