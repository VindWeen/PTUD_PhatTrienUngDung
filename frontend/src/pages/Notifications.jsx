import React, { useState } from 'react';
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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import useNotifications from '../hooks/useNotifications';
import { notificationsApi } from '../services/notificationsApi';

export function notificationText(n) {
  const label = {
    SUBMITTED: 'đã gửi',
    NEED_CORRECTION: 'cần bổ sung',
    VERIFIED: 'đã xác nhận',
    REJECTED: 'bị từ chối',
    CANCELLED: 'đã hủy',
    REVOKED: 'đã thu hồi',
    RECORDED: 'đã ghi nhận quyết định',
  };
  return `${n.entityType === 'AWARD' ? 'Bản ghi khen thưởng' : 'Thành tích'} #${n.entityId}: ${label[n.toStatus] || n.toStatus}`;
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
  const { result, error, busy, reload } = useNotifications(page, 20, unread);

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

  const unreadCount = result?.unreadCount ?? 0;
  const totalItems = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / 20));

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-teal-50 text-[#008080] dark:bg-teal-950/50 dark:text-teal-400">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Trung tâm Thông báo
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Cập nhật tiến trình xét duyệt thành tích, khen thưởng và điều chỉnh hồ sơ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {unreadCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>{unreadCount} chưa đọc</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Đã đọc tất cả</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Filter Navigation Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setUnread(false);
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              !unread
                ? 'bg-teal-50 text-[#008080] dark:bg-teal-950/40 dark:text-teal-300 font-semibold shadow-soft-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Tất cả thông báo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setUnread(true);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              unread
                ? 'bg-teal-50 text-[#008080] dark:bg-teal-950/40 dark:text-teal-300 font-semibold shadow-soft-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Chỉ chưa đọc {unreadCount > 0 && `(${unreadCount})`}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={busy}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition border border-slate-200 dark:border-slate-700 self-start sm:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${busy ? 'animate-spin text-[#008080]' : ''}`} />
          <span>{busy ? 'Đang cập nhật...' : 'Làm mới'}</span>
        </button>
      </div>

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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
            />
          ))}
        </div>
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
