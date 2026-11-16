import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, Bell, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { request } from '../../services/request';
import './dashboard-calendar.css';
import { startOfDay, sameDay, localInput, intersectsDay } from './calendarDates';

const labels = { SCHEDULED: 'Đã lên lịch', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };
const weekdays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const dayLabel = date => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);

const blankForm = date => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10);
  return { title: '', description: '', startsAt: localInput(start), endsAt: localInput(end), remindAt: '', status: 'SCHEDULED' };
};

const editForm = event => ({ 
  title: event.title, 
  description: event.description || '', 
  startsAt: localInput(new Date(event.startsAt)), 
  endsAt: localInput(new Date(event.endsAt)), 
  remindAt: event.remindAt ? localInput(new Date(event.remindAt)) : '', 
  status: event.status 
});

const formatTime = date => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
const eventRange = event => {
  const start = new Date(event.startsAt), end = new Date(event.endsAt);
  if (sameDay(start, end)) return `${formatTime(start)} – ${formatTime(end)}`;
  const format = date => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  return `${format(start)} – ${format(end)}`;
};

export default function DashboardCalendar() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState(null), [loadError, setLoadError] = useState(null);
  const [activeDate, setActiveDate] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null), [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const dialog = useRef(null), trigger = useRef(null), saving = useRef(false);
  const today = new Date();

  const load = useCallback(async () => {
    try { 
      const data = await request({ url: '/me/calendar/events', fresh: true }); 
      setEvents(Array.isArray(data) ? data : []); 
      setLoadError(null); 
    } catch (error) { 
      setLoadError(error); 
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const node = dialog.current;
    if (selected && node && !node.open) node.showModal();
  }, [selected]);

  const dayEvents = useCallback(date => (events || []).filter(event => intersectsDay(event, date)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)), [events]);

  const openDayModal = (date, element, startWithNew = false) => { 
    trigger.current = element; 
    setEditingId(null); 
    setFormError(''); 
    setNotice(''); 
    const targetDate = startOfDay(date);
    setActiveDate(targetDate);
    setSelected(targetDate); 
    if (startWithNew) {
      setForm(blankForm(targetDate));
    } else {
      setForm(null);
    }
  };

  const closeDialog = () => { if (!busy) dialog.current?.close(); };
  const onClosed = () => { setSelected(null); setForm(null); setFormError(''); requestAnimationFrame(() => trigger.current?.focus()); };
  const beginCreate = () => { setEditingId(null); setForm(blankForm(selected || activeDate)); setFormError(''); setNotice(''); };
  const beginEdit = event => { setEditingId(event.id); setForm(editForm(event)); setFormError(''); setNotice(''); };

  async function submit(event) {
    event.preventDefault();
    if (saving.current) return;
    setFormError('');
    const start = new Date(form.startsAt), end = new Date(form.endsAt), reminder = form.remindAt ? new Date(form.remindAt) : null;
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) { 
      setFormError('Thời gian kết thúc phải sau thời gian bắt đầu.'); 
      return; 
    }
    if (reminder && (!Number.isFinite(reminder.getTime()) || reminder > start)) { 
      setFormError('Thời gian nhắc phải trước hoặc bằng thời gian bắt đầu.'); 
      return; 
    }
    saving.current = true; setBusy(true);
    try {
      const payload = { title: form.title.trim(), description: form.description, startsAt: start.toISOString(), endsAt: end.toISOString(), remindAt: reminder ? reminder.toISOString() : null, status: form.status };
      await request({ url: editingId ? `/me/calendar/events/${editingId}` : '/me/calendar/events', method: editingId ? 'PATCH' : 'POST', data: payload });
      await load(); 
      setActiveDate(startOfDay(start));
      setMonth(new Date(start.getFullYear(), start.getMonth(), 1)); 
      setForm(null); 
      setNotice(editingId ? 'Đã cập nhật sự kiện.' : 'Đã thêm sự kiện.');
    } catch (error) { 
      setFormError(error.message || 'Không thể lưu sự kiện.'); 
    } finally { 
      saving.current = false; setBusy(false); 
    }
  }

  async function remove(event) {
    if (saving.current || !window.confirm(`Xóa sự kiện “${event.title}”?`)) return;
    saving.current = true; setBusy(true); setFormError('');
    try { 
      await request({ url: `/me/calendar/events/${event.id}`, method: 'DELETE' }); 
      await load(); 
      setForm(null); 
      setNotice('Đã xóa sự kiện.'); 
    } catch (error) { 
      setFormError(error.message || 'Không thể xóa sự kiện.'); 
    } finally { 
      saving.current = false; setBusy(false); 
    }
  }

  const start = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const selectedEvents = selected ? dayEvents(selected) : [];

  return (
    <section className="dash-calendar interactive-calendar cal-fullwidth-card" aria-labelledby="calendar-title">
      {/* Header Lịch */}
      <div className="dash-section-head">
        <div>
          <h2 id="calendar-title">Lịch xét duyệt & Sự kiện</h2>
          <p>Tháng {month.getMonth() + 1}, {month.getFullYear()}</p>
        </div>
        <div className="cal-header-actions">
          <button 
            type="button" 
            className="cal-btn-add" 
            onClick={e => { 
              const date = startOfDay(new Date()); 
              openDayModal(date, e.currentTarget, true);
            }}
          >
            <Plus size={15} aria-hidden="true" /> Thêm sự kiện
          </button>
          <button 
            type="button" 
            className="cal-btn-today" 
            onClick={() => { 
              const d = new Date(); 
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); 
              setActiveDate(startOfDay(d)); 
            }}
          >
            Hôm nay
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="cal-load-error">
          Không tải được lịch: {loadError.message} <button type="button" onClick={load}>Thử lại</button>
        </div>
      )}

      {/* Bố cục Calendar: Dàn trọn card theo yêu cầu người dùng */}
      <div className="cal-full-container">
        {/* Month Navigator */}
        <div className="dash-month">
          <button 
            aria-label="Tháng trước" 
            type="button" 
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <strong>Tháng {month.getMonth() + 1}, {month.getFullYear()}</strong>
          <button 
            aria-label="Tháng sau" 
            type="button" 
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Grid Lịch dàn rộng */}
        <div className="dash-calendar-grid cal-grid-expanded">
          {weekdays.map(day => (
            <span className="dash-weekday" key={day}>{day}</span>
          ))}
          {Array.from({ length: start }, (_, i) => (
            <span key={`blank-${i}`} className="cal-day-blank" />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
            const list = dayEvents(date);
            const isToday = sameDay(date, today);
            const isActive = sameDay(date, activeDate);

            return (
              <div 
                key={i} 
                className={`cal-day-wrapper ${list.length > 0 ? 'has-events' : ''}`}
              >
                <button 
                  type="button" 
                  className={`cal-day ${isToday ? 'is-today' : ''} ${isActive ? 'is-active' : ''}`}
                  aria-label={`${dayLabel(date)}, ${list.length} sự kiện. Nhấn để quản lý sự kiện.`} 
                  onClick={e => openDayModal(date, e.currentTarget, list.length === 0)}
                >
                  <span className="cal-day-number">{i + 1}</span>
                  {list.length > 0 && (
                    <span className="cal-dots" aria-hidden="true">
                      {list.slice(0, 3).map(item => (
                        <i key={item.id} className={`cal-dot ${item.status.toLowerCase()}`} />
                      ))}
                      {list.length > 3 && <span className="cal-more-dot">+{list.length - 3}</span>}
                    </span>
                  )}
                </button>

                {/* Popover / Tooltip nổi khi hover ngày có sự kiện */}
                {list.length > 0 && (
                  <div className="cal-hover-popover" role="tooltip">
                    <div className="cal-popover-header">
                      <strong>Ngày {i + 1} tháng {month.getMonth() + 1}</strong>
                      <span className="cal-popover-count">{list.length} sự kiện</span>
                    </div>
                    <div className="cal-popover-list">
                      {list.slice(0, 3).map(ev => (
                        <div key={ev.id} className="cal-popover-item">
                          <div className="cal-popover-item-title">
                            <i className={`cal-dot ${ev.status.toLowerCase()}`} />
                            <span className="truncate">{ev.title}</span>
                          </div>
                          <div className="cal-popover-item-time">
                            <Clock size={11} className="shrink-0" />
                            <span>{eventRange(ev)}</span>
                          </div>
                          {ev.description && (
                            <p className="cal-popover-item-desc truncate">{ev.description}</p>
                          )}
                        </div>
                      ))}
                      {list.length > 3 && (
                        <p className="cal-popover-more">Và {list.length - 3} sự kiện khác...</p>
                      )}
                    </div>
                    <div className="cal-popover-hint">
                      Nhấp để xem chi tiết / sửa sự kiện →
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend nhỏ gọn */}
        <div className="cal-legend" aria-label="Chú thích trạng thái">
          <span><i className="cal-dot scheduled" /> Đã lên lịch</span>
          <span><i className="cal-dot completed" /> Hoàn thành</span>
          <span><i className="cal-dot cancelled" /> Đã hủy</span>
          <span className="cal-legend-hint">Nhấp chuột trực tiếp vào ngày bất kỳ để quản lý hoặc tạo sự kiện</span>
        </div>
      </div>

      {/* Modal chi tiết & chỉnh sửa sự kiện */}
      <dialog 
        ref={dialog} 
        className="cal-dialog" 
        aria-labelledby="cal-dialog-title" 
        onCancel={e => { if (busy) e.preventDefault(); }} 
        onClose={onClosed}
      >
        {selected && (
          <>
            <div className="cal-dialog-header">
              <div>
                <h2 id="cal-dialog-title">Sự kiện & Xét duyệt</h2>
                <p>{dayLabel(selected)}</p>
              </div>
              <button 
                type="button" 
                className="cal-close" 
                aria-label="Đóng lịch" 
                disabled={busy} 
                onClick={closeDialog}
              >
                <X size={20} />
              </button>
            </div>

            <div className="cal-dialog-body">
              <div className="cal-dialog-list">
                <div className="cal-list-head">
                  <h3>Danh sách sự kiện ({selectedEvents.length})</h3>
                  <button type="button" className="cal-btn-add" onClick={beginCreate} disabled={busy}>
                    <Plus size={16} aria-hidden="true" /> Thêm sự kiện
                  </button>
                </div>

                {notice && <p role="status" className="cal-notice">{notice}</p>}
                {loadError && <p role="alert" className="cal-error">{loadError.message}</p>}
                {formError && !form && <p role="alert" className="cal-error">{formError}</p>}

                {!selectedEvents.length ? (
                  <div className="cal-empty-card">
                    <CalendarDays size={28} className="text-slate-400 mb-2" />
                    <p className="font-semibold text-slate-700">Ngày này chưa có sự kiện</p>
                    <p className="text-xs text-slate-500 mt-1">Bạn có thể tạo lịch xét duyệt, hạn nộp hoặc ghi chú mới.</p>
                    <button type="button" className="cal-btn-add mt-3" onClick={beginCreate} disabled={busy}>
                      + Thêm sự kiện ngay
                    </button>
                  </div>
                ) : (
                  selectedEvents.map(item => (
                    <article className="cal-event-row" key={item.id}>
                      <span className={`cal-dot ${item.status.toLowerCase()}`} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm truncate">{item.title}</h4>
                          <span className={`cal-status-chip ${item.status.toLowerCase()}`}>
                            {labels[item.status] || item.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <Clock size={12} className="shrink-0 text-slate-400" />
                          <span>{eventRange(item)}</span>
                        </p>
                        {item.description && (
                          <p className="cal-event-description mt-1 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="cal-event-actions">
                        <button type="button" onClick={() => beginEdit(item)} disabled={busy} className="cal-act-edit">Sửa</button>
                        <button type="button" onClick={() => remove(item)} disabled={busy} className="cal-act-del">Xóa</button>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="cal-dialog-editor">
                {form ? (
                  <form onSubmit={submit} className="cal-form">
                    <h3>{editingId ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện mới'}</h3>
                    {formError && <p role="alert" className="cal-error">{formError}</p>}
                    
                    <label>
                      Tên sự kiện / Lịch xét duyệt
                      <input 
                        autoFocus 
                        required 
                        maxLength={300} 
                        value={form.title} 
                        onChange={e => setForm({ ...form, title: e.target.value })} 
                        placeholder="Ví dụ: Hội đồng xét duyệt CSTĐ, Hạn nộp minh chứng..."
                      />
                    </label>

                    <label>
                      Địa điểm / Mô tả chi tiết
                      <textarea 
                        rows={3} 
                        value={form.description} 
                        onChange={e => setForm({ ...form, description: e.target.value })} 
                        placeholder="Phòng họp, link họp trực tuyến hoặc lưu ý..."
                      />
                    </label>

                    <div className="cal-form-grid">
                      <label>
                        Bắt đầu
                        <input 
                          type="datetime-local" 
                          required 
                          value={form.startsAt} 
                          onChange={e => setForm({ ...form, startsAt: e.target.value })} 
                        />
                      </label>
                      <label>
                        Kết thúc
                        <input 
                          type="datetime-local" 
                          required 
                          value={form.endsAt} 
                          onChange={e => setForm({ ...form, endsAt: e.target.value })} 
                        />
                      </label>
                      <label>
                        Nhắc trước (tùy chọn)
                        <input 
                          type="datetime-local" 
                          value={form.remindAt} 
                          onChange={e => setForm({ ...form, remindAt: e.target.value })} 
                        />
                      </label>
                      <label>
                        Trạng thái
                        <select 
                          value={form.status} 
                          onChange={e => setForm({ ...form, status: e.target.value })}
                        >
                          {Object.entries(labels).map(([value, label]) => (
                            <option value={value} key={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="cal-form-actions">
                      <button type="submit" className="cal-save" disabled={busy}>
                        {busy ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Thêm vào lịch'}
                      </button>
                      <button 
                        type="button" 
                        className="cal-cancel" 
                        disabled={busy} 
                        onClick={() => { setForm(null); setFormError(''); }}
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="cal-editor-empty">
                    <CalendarDays size={32} className="text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">Chọn một sự kiện từ danh sách để chỉnh sửa</p>
                    <p className="text-xs text-slate-500 mt-1">Hoặc bấm nút "Thêm sự kiện" để tạo lịch mới cho ngày này.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
