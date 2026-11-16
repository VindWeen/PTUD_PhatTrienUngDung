import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function NumberedPagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    if (start > 2) pages.push('ellipsis-1');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('ellipsis-2');

    pages.push(totalPages);
    return pages;
  };

  const pages = getPages();

  return (
    <nav 
      className="flex items-center justify-center gap-1.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800"
      aria-label="Phân trang danh sách"
    >
      {/* Nút về trang đầu « */}
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(1)}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        title="Trang đầu (1)"
        aria-label="Trang đầu"
      >
        <ChevronsLeft size={16} />
      </button>

      {/* Nút trang trước ‹ */}
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        title="Trang trước"
        aria-label="Trang trước"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Danh sách các số trang */}
      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          if (typeof p === 'string') {
            return (
              <span key={`el-${idx}`} className="px-2 py-1 text-slate-400 text-xs font-bold select-none">
                …
              </span>
            );
          }

          const isActive = p === page;
          return (
            <button
              key={p}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={`min-w-[34px] h-[34px] px-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-teal-700 text-white shadow-sm shadow-teal-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Nút trang sau › */}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        title="Trang sau"
        aria-label="Trang sau"
      >
        <ChevronRight size={16} />
      </button>

      {/* Nút về trang cuối » */}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(totalPages)}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        title={`Trang cuối (${totalPages})`}
        aria-label="Trang cuối"
      >
        <ChevronsRight size={16} />
      </button>
    </nav>
  );
}
