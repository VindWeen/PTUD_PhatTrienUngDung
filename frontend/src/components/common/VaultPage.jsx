import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Award, BookOpen } from 'lucide-react';

const pageLinks = {
  'Hồ sơ cá nhân': ['/me/cv', 'Thiết kế CV', Sparkles],
  'Khám hồ sơ': ['/regulations', 'Xem kho quy chế', BookOpen],
  'Mục tiêu / KPI': ['/me/ai-forecast', 'Đối chiếu quy chế', Sparkles],
  'Kho quy chế': ['/me/ai-forecast', 'Đối chiếu quy chế', Sparkles],
  'CV cá nhân': ['/achievements', 'Kho thành tích', Award],
  'Tổng quan cá nhân': ['/achievements', 'Kho thành tích', Award],
};

export function Page({ title, description, children, actions }) {
  const linkInfo = pageLinks[title];
  const LinkIcon = linkInfo?.[2] || ArrowRight;

  return (
    <main className="vault-page" data-page={title}>
      <header className="vault-page-header">
        <div>
          <h1>{title}</h1>
          {description && <p className="vault-page-description">{description}</p>}
        </div>
        <div className="vault-page-actions">
          {linkInfo && (
            <Link
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200/80 hover:bg-teal-100 hover:border-teal-300 transition-all shadow-sm shadow-teal-900/5 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800"
              to={linkInfo[0]}
            >
              <LinkIcon size={14} className="text-teal-600 dark:text-teal-400" />
              <span>{linkInfo[1]}</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          )}
          {actions}
        </div>
      </header>
      <div className="vault-content">{children}</div>
    </main>
  );
}
