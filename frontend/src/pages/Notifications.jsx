import UnderlineTabs from '../components/common/UnderlineTabs';
import PageHeader from '../components/common/PageHeader';
import React, { useState } from 'react';
import { LoadingState } from '../components/common/AsyncState';
import {
  BellRing,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Award,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import useNotifications from '../hooks/useNotifications';
import { notificationsApi } from '../services/notificationsApi';

export function notificationText(n) {
  const label = {
    SUBMITTED: 'đã gửi',
    COUNCIL_PENDING: 'chờ Hội đồng',
    UNDER_REVIEW: 'đang xét',
    RECOMMENDED: 'được đề nghị khen thưởng, chưa có quyết định',
    NOT_RECOMMENDED: 'không được đề nghị',
    NEED_CORRECTION: 'cần bổ sung',
    VERIFIED: 'đã xác nhận',
    REJECTED: 'bị từ chối',
    CANCELLED: 'đã hủy',
    REVOKED: 'đã thu hồi',
    RECORDED: 'đã ghi nhận quyết định',
  };
  return `${n.entityType === 'APPLICATION' ? 'Hồ sơ đề nghị' : n.entityType === 'AWARD' ? 'Bản ghi khen thưởng' : 'Thành tích'} #${n.entityId}: ${label[n.toStatus] || n.toStatus}`;
}

const STATUS_CONFIG = {
  VERIFIED: {
    icon: CheckCircle2,
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Đã xác nhận',
  },
  RECORDED: {
    icon: Award,
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-400',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    label: 'Đã ghi nhận',
  },
  NEED_CORRECTION: {
    icon: AlertTriangle,
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    label: 'Cần bổ sung',
  },
  REJECTED: {
    icon: XCircle,
    color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    label: 'Bị từ chối',
  },
  SUBMITTED: {
    icon: Clock,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    label: 'Đã nộp duyệt',
  },
  REVOKED: {
    icon: ShieldAlert,
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    label: 'Đã thu hồi',
  },
  CANCELLED: {
    icon: XCircle,
    color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    label: 'Đã hủy',
  },
};

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const [reading, setReading] = useState(null);
  const [writeError, setWriteError] = useState('');
  const { result, error, busy, reload, unreadCount } = useNotifications(page, 20, unread);

  async function read(id) {
    setReading(id);
    setWriteError('');
    try {
      await notificationsApi.read(id);
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (e) {
      setWriteError(e.message || 'Không đánh dấu được thông báo');
    } finally {
      setReading(null);
    }
  }

  const totalItems = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / 20));

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader title="Thông báo" description="Theo dõi tiến trình xét duyệt thành tích, khen thưởng và điều chỉnh hồ sơ." icon={BellRing} onRefresh={reload} refreshing={busy} badge={<span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">{unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc tất cả'}</span>} tabs={<UnderlineTabs label="Lọc thông báo" value={unread ? 'unread' : 'all'} onChange={id => {setUnread(id === 'unread'); setPage(1);}} items={[
        {id: 'all', label: 'Tất cả thông báo'},
        {id: 'unread', label: `Chỉ chưa đọc${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: Filter},
      ]} />} />

      {/* Alerts */}
      {(error || writeError) && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
        >
          {error || writeError}
        </div>
      )}

      {/* Loading Skeleton */}
      {busy && !result && (
        <LoadingState label="Đang tải thông báo..." rows={3} />
      )}

      {/* Empty State */}
      {!busy && !error && result?.items.length === 0 && (
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center shadow-soft-sm">
          <CheckCheck className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white mt-3">
            Không có thông báo nào
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {unread
              ? 'Tuyệt vời! Bạn không còn thông báo chưa đọc nào.'
              : 'Hiện chưa có cập nhật mới nào trong hệ thống.'}
          </p>
        </div>
      )}

      {/* Notifications List */}
      <div className="grid gap-3">
        {result?.items.map((n) => {
          const cfg = STATUS_CONFIG[n.toStatus] || {
            icon: BellRing,
            color: 'text-slate-600 bg-slate-100 dark:bg-slate-800',
            badge: 'bg-slate-100 text-slate-700',
            label: n.toStatus,
          };
          const Icon = cfg.icon;
          const isUnread = !n.readAt;

          return (
            <div
              key={n.notificationId}
              className={`bg-white dark:bg-slate-800/80 rounded-2xl p-4 sm:p-5 border shadow-soft-sm hover:shadow-soft-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isUnread
                  ? 'border-l-4 border-l-[#008080] border-slate-200/80 dark:border-slate-700'
                  : 'border-slate-200/60 dark:border-slate-700/60 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                  <Icon className="w-5 h-5" />
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {n.entityType === 'AWARD' ? 'Khen thưởng' : 'Thành tích'} #{n.entityId}
                    </span>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-[#008080]" title="Chưa đọc" />
                    )}
                  </div>

                  <p
                    className={`text-sm leading-snug ${
                      isUnread
                        ? 'font-bold text-slate-900 dark:text-white'
                        : 'font-medium text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {notificationText(n)}
                  </p>

                  <p className="text-[11px] text-slate-400">
                    {new Date(n.createdAt).toLocaleString('vi-VN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {isUnread ? (
                  <button
                    type="button"
                    disabled={reading !== null}
                    onClick={() => read(n.notificationId)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-50 text-[#008080] hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 text-xs font-semibold transition active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{String(reading) === String(n.notificationId) ? 'Đang lưu...' : 'Đánh dấu đã đọc'}</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-slate-400">
                    <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Đã xem</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Pagination */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Trang <strong className="text-slate-800 dark:text-white">{page}</strong> / {totalPages}{' '}
            ({totalItems} thông báo)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trước</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages || busy}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
            >
              <span>Sau</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
