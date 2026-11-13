import React, { useCallback, useEffect, useState, useRef } from 'react';
import { 
  CalendarDays, ChevronLeft, ChevronRight, Plus, Check, Trash2, 
  Pencil, Sparkles, Clock, AlertCircle, Bookmark, Tag, X, RefreshCw
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import { calendarApi } from '../services/calendarApi';
import { 
  CATEGORIES, emptyEvent, eventPayload, monthCells, onDay, 
  shiftMonth, todayKey, monthLabel 
} from '../components/calendar/calendarModel';
import '../components/calendar/calendar.css';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [systemEvents, setSystemEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [month, setMonth] = useState(() => todayKey().slice(0, 7));
  const [filter, setFilter] = useState('all');

  // Event creation/editing state
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userEvs, sysEvs, remList] = await Promise.all([
        calendarApi.list().catch(() => []),
        calendarApi.listSystem().catch(() => []),
        calendarApi.listReminders().catch(() => []),
      ]);
      setEvents(Array.isArray(userEvs) ? userEvs : []);
      setSystemEvents(Array.isArray(sysEvs) ? sysEvs : []);
      setReminders(Array.isArray(remList) ? remList : []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu lịch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const allEvents = [...events, ...systemEvents];
  const dayEvents = allEvents.filter(e => onDay(e, selectedDay) && (filter === 'all' || e.category === filter));

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setDraft(emptyEvent(selectedDay));
    setEditorOpen(true);
  };

  const handleOpenEdit = (evt) => {
    if (evt.category === 'system') return; // Cannot edit system events
    setEditingEvent(evt);
    setDraft({
      title: evt.title || '',
      description: evt.description || '',
      location: evt.location || '',
      category: evt.category || 'personal',
      startsAt: evt.startsAt?.slice(0, 16) || `${selectedDay}T09:00`,
      endsAt: evt.endsAt?.slice(0, 16) || `${selectedDay}T10:00`,
      allDay: Boolean(evt.allDay),
      completed: Boolean(evt.completed),
    });
    setEditorOpen(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      if (editingEvent) {
        const updated = await calendarApi.update(editingEvent.id, {
          ...eventPayload(draft),
          version: editingEvent.version,
        });
        setEvents(items => items.map(ev => ev.id === updated.id ? updated : ev));
      } else {
        const created = await calendarApi.create(eventPayload(draft));
        setEvents(items => [...items, created]);
      }
      setEditorOpen(false);
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu sự kiện');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (evt) => {
    if (!window.confirm(`Xóa sự kiện "${evt.title}"?`)) return;
    try {
      await calendarApi.remove(evt.id, evt.version);
      setEvents(items => items.filter(e => e.id !== evt.id));
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa sự kiện');
    }
  };

  const handleToggleComplete = async (evt) => {
    if (evt.category === 'system') return;
    try {
      const updated = await calendarApi.update(evt.id, {
        ...eventPayload(evt),
        completed: !evt.completed,
        version: evt.version,
      });
      setEvents(items => items.map(e => e.id === updated.id ? updated : e));
    } catch (err) {
      alert(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  // Calculate deadline countdown helper
  const getDeadlineBadge = (deadlineDateStr) => {
    if (!deadlineDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineDateStr);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `Quá hạn ${Math.abs(diffDays)} ngày`, color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' };
    }
    if (diffDays === 0) {
      return { label: 'Hôm nay đến hạn', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold animate-pulse' };
    }
    if (diffDays <= 7) {
      return { label: `Còn ${diffDays} ngày`, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' };
    }
    return { label: `Còn ${diffDays} ngày`, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch cá nhân & Nhắc nhở hạn nộp"
        description="Theo dõi lịch làm việc, sự kiện hạn nộp quy chế khen thưởng và mục tiêu từ Lộ trình AI Gap."
        icon={CalendarDays}
        onRefresh={loadAll}
        refreshing={loading}
        secondaryActions={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-teal-600 hover:bg-teal-700 shadow-soft-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm sự kiện mới</span>
          </button>
        }
      />

      {error && (
        <div role="alert" className="p-4 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadAll} className="underline text-xs">Thử lại</button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Calendar (7 Cols) */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-4">
          {/* Calendar Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Tháng trước"
                disabled={month <= '1900-01'}
                onClick={() => setMonth(shiftMonth(month, -1))}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
              <h2 className="text-base font-bold text-slate-800 dark:text-white px-2">
                {monthLabel(month)}
              </h2>
              <button
                type="button"
                aria-label="Tháng sau"
                disabled={month >= '2199-12'}
                onClick={() => setMonth(shiftMonth(month, 1))}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const today = todayKey();
                  setMonth(today.slice(0, 7));
                  setSelectedDay(today);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
              >
                Hôm nay
              </button>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">Tất cả danh mục</option>
                {Object.entries(CATEGORIES).map(([catKey, catVal]) => (
                  <option key={catKey} value={catKey}>{catVal.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Grid */}
          <div className="calendar-grid">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-slate-400">
                {day}
              </div>
            ))}
            {monthCells(month).map(day => {
              const items = allEvents.filter(e => onDay(e, day) && (filter === 'all' || e.category === filter));
              const isToday = day === todayKey();
              const isSelected = day === selectedDay;
              const isCurrentMonth = day.slice(0, 7) === month;

              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`calendar-day min-h-[70px] p-1.5 rounded-xl text-left transition flex flex-col justify-between ${
                    !isCurrentMonth ? 'calendar-muted opacity-40' : ''
                  } ${
                    isSelected ? 'calendar-selected ring-2 ring-teal-500 bg-teal-50/40 dark:bg-teal-950/20' : ''
                  } ${
                    isToday ? 'calendar-today font-bold text-teal-600 dark:text-teal-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{Number(day.slice(-2))}</span>
                    {items.length > 0 && (
                      <span className="flex gap-0.5">
                        {[...new Set(items.map(e => e.category))].map(cat => (
                          <span key={cat} className={`w-1.5 h-1.5 rounded-full ${CATEGORIES[cat]?.color || 'bg-slate-400'}`} />
                        ))}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 mt-1 overflow-hidden">
                    {items.slice(0, 2).map(ev => (
                      <div
                        key={ev.id}
                        className={`text-[10px] px-1 py-0.5 rounded truncate ${
                          ev.completed ? 'line-through opacity-50 bg-slate-100 text-slate-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {items.length > 2 && (
                      <div className="text-[9px] text-slate-400 font-medium pl-0.5">
                        +{items.length - 2} sự kiện
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Category Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-500">
            {Object.entries(CATEGORIES).map(([catKey, catVal]) => (
              <span key={catKey} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${catVal.color}`} />
                <span>{catVal.label}</span>
              </span>
            ))}
          </div>

          {/* Selected Day Event List */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                <span>Sự kiện ngày {selectedDay.slice(8)}/{selectedDay.slice(5, 7)}/{selectedDay.slice(0, 4)}</span>
                <span className="text-xs font-normal text-slate-400">({dayEvents.length})</span>
              </h3>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm vào ngày này
              </button>
            </div>

            {dayEvents.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center italic">
                Không có sự kiện nào trong ngày này.
              </p>
            ) : (
              <div className="space-y-2">
                {dayEvents.map(evt => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${CATEGORIES[evt.category]?.color || 'bg-slate-400'}`} />
                        <span className={`font-semibold text-slate-800 dark:text-white truncate ${evt.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                          {evt.title}
                        </span>
                        {evt.category === 'system' && (
                          <span className="px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px]">
                            Hệ thống
                          </span>
                        )}
                      </div>
                      {evt.description && (
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-2">
                          {evt.description}
                        </p>
                      )}
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{evt.allDay ? 'Cả ngày' : `${evt.startsAt?.slice(11, 16)} - ${evt.endsAt?.slice(11, 16)}`}</span>
                        {evt.location && <span>• {evt.location}</span>}
                      </div>
                    </div>

                    {evt.category !== 'system' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(evt)}
                          title={evt.completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành'}
                          className={`p-1.5 rounded-lg border transition ${
                            evt.completed
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:border-emerald-800'
                              : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-emerald-600'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(evt)}
                          title="Sửa sự kiện"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(evt)}
                          title="Xóa sự kiện"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: AI Gap Reminders & Synchronized Deadlines (5 Cols) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="bg-gradient-to-br from-purple-500/10 via-teal-500/5 to-transparent rounded-3xl p-5 sm:p-6 border border-purple-200/60 dark:border-purple-800/40 shadow-soft-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-purple-200/40 dark:border-purple-800/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Nhắc nhở hạn nộp & Lộ trình AI
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Sự kiện tự động đồng bộ từ phân tích AI Gap
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60">
                {reminders.length}
              </span>
            </div>

            {reminders.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Bookmark className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Chưa có hạn nộp nào được nhắc nhở. Khi chạy &ldquo;Khám theo quy chế&rdquo; và chuyển tiêu chí thiếu thành mục tiêu KPI, bạn có thể chọn thêm vào lịch nhắc nhở tại đây.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map((rem) => {
                  const deadlineDate = rem.deadlineDate || rem.eventDate || rem.startsAt?.slice(0, 10);
                  const badge = getDeadlineBadge(deadlineDate);

                  return (
                    <article
                      key={rem.reminderId || rem.id}
                      className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm space-y-2.5 transition hover:border-purple-300 dark:hover:border-purple-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                          {rem.title || rem.regulationTitle || 'Hạn nộp hồ sơ thi đua'}
                        </h4>
                        {badge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>

                      {rem.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {rem.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                        {rem.regulationTitle && (
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60">
                            Quy chế: {rem.regulationTitle}
                          </span>
                        )}
                        {rem.kpiGoalTitle && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                            KPI: {rem.kpiGoalTitle}
                          </span>
                        )}
                        <span className="text-slate-400 ml-auto">
                          Hạn: {deadlineDate ? `${deadlineDate.slice(8, 10)}/${deadlineDate.slice(5, 7)}/${deadlineDate.slice(0, 4)}` : 'Chưa định ngày'}
                        </span>
                      </div>

                      {deadlineDate && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDay(deadlineDate);
                              setMonth(deadlineDate.slice(0, 7));
                            }}
                            className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-medium"
                          >
                            Xem ngày trên lịch →
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Event Add/Edit Modal */}
      {editorOpen && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-soft-2xl border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-teal-600" />
                <span>{editingEvent ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện lịch mới'}</span>
              </h2>
              <button
                onClick={() => setEditorOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề sự kiện <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nộp bài báo hội nghị, hoàn thiện hồ sơ khen thưởng..."
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Danh mục
                  </label>
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  >
                    <option value="task">Công việc</option>
                    <option value="exam">Lịch thi</option>
                    <option value="competition">Cuộc thi</option>
                    <option value="personal">Cá nhân</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Địa điểm / Ghi chú nhanh
                  </label>
                  <input
                    type="text"
                    placeholder="Phòng họp, online..."
                    value={draft.location}
                    onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bắt đầu
                  </label>
                  <input
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kết thúc
                  </label>
                  <input
                    type="datetime-local"
                    value={draft.endsAt}
                    onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả chi tiết
                </label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú nội dung công việc hoặc các tiêu chí cần chuẩn bị..."
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Lưu sự kiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
