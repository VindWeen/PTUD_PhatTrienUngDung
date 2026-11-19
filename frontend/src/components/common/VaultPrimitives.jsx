import React from 'react';
import { FolderOpen } from 'lucide-react';
import { secondary } from './vaultStyles';

export function ErrorMessage({ error }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900 text-sm">
      {error.message || String(error)}
    </p>
  ) : null;
}

export function Field({ label, children }) {
  return (
    <label className="vault-field block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children, action }) {
  return (
    <div className="vault-empty">
      <span className="vault-empty-icon">
        <FolderOpen size={24} aria-hidden="true" />
      </span>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Load({ state, children }) {
  if (state.loading) return <div className="vault-loading" role="status">
    <div aria-hidden="true" className="vault-loading-line" />
    <div aria-hidden="true" className="vault-loading-line is-short" />
    <span className="vault-meta">Đang tải dữ liệu…</span>
  </div>;
  if (state.error) return <div className="space-y-2">
    <ErrorMessage error={state.error} />
    {state.reload && <button type="button" className={secondary} onClick={state.reload}>Thử tải lại</button>}
  </div>;
  return children;
}

export function Item({ children }) { return <div className="vault-item">{children}</div>; }

export function DateText({ value }) {
  const date = String(value || '').slice(0, 10);
  return date ? <time dateTime={date}>{date.split('-').reverse().join('/')}</time> : null;
}

export const conclusionLabel = value => ({
  MET: 'Đạt theo hồ sơ',
  NOT_MET: 'Chưa đạt',
  INSUFFICIENT_DATA: 'Chưa đủ dữ liệu',
  NOT_APPLICABLE: 'Không áp dụng'
}[value] || value);

export const displayLabel = value => ({
  PLANNED: 'Đã lên kế hoạch', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
  TODO: 'Cần thực hiện', DONE: 'Hoàn thành', SCHEDULED: 'Đã lên lịch',
  DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố', PENDING: 'Đang chờ phản hồi', ACCEPTED: 'Đã đồng ý', DECLINED: 'Đã từ chối', REVOKED: 'Đã thu hồi', EXPIRED: 'Đã hết hạn',
  ACTIVE: 'Đang hoạt động', DISABLED: 'Đã vô hiệu hóa',
  UNIVERSITY: 'Trường', FACULTY: 'Khoa', DEPARTMENT: 'Bộ môn', CLASS: 'Lớp', COMPANY: 'Doanh nghiệp', TEAM: 'Nhóm', OTHER: 'Khác',
  SYSTEM_ADMIN: 'Quản trị hệ thống', REGULATION_MANAGER: 'Quản lý quy chế',
  Modern: 'Hiện đại', Academic: 'Học thuật', Minimalist: 'Tối giản',
}[value] || conclusionLabel(value));

export function StatusBadge({ value }) {
  return (
    <span className={`vault-status ${['COMPLETED', 'DONE', 'PUBLISHED', 'ACCEPTED', 'ACTIVE', 'MET'].includes(value) ? 'is-positive' : ['CANCELLED', 'DECLINED', 'DISABLED', 'NOT_MET'].includes(value) ? 'is-muted' : ''}`}>
      {displayLabel(value)}
    </span>
  );
}
