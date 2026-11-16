import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { request } from '../../services/request';
import './dashboard-calendar.css';
import { startOfDay, sameDay, localInput, intersectsDay } from './calendarDates';

const labels = { SCHEDULED: 'Đã lên lịch', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const dayLabel = date => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
const blankForm = date => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10);
  return { title: '', description: '', startsAt: localInput(start), endsAt: localInput(end), remindAt: '', status: 'SCHEDULED' };
};
const editForm = event => ({ title: event.title, description: event.description || '', startsAt: localInput(new Date(event.startsAt)), endsAt: localInput(new Date(event.endsAt)), remindAt: event.remindAt ? localInput(new Date(event.remindAt)) : '', status: event.status });
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
  const [preview, setPreview] = useState(null), [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null), [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const dialog = useRef(null), trigger = useRef(null), saving = useRef(false);
  const today = new Date();

  const load = useCallback(async () => {
    try { const data = await request({ url: '/me/calendar/events', fresh: true }); setEvents(Array.isArray(data) ? data : []); setLoadError(null); }
    catch (error) { setLoadError(error); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const node = dialog.current;
    if (selected && node && !node.open) node.showModal();
  }, [selected]);

  const dayEvents = useCallback(date => (events || []).filter(event => intersectsDay(event, date)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)), [events]);
  const activeEvents = useMemo(() => (events || []).filter(event => event.status !== 'CANCELLED' && new Date(event.endsAt) > new Date()).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).slice(0, 4), [events]);
  const openDay = (date, element) => { trigger.current = element; setPreview(null); setForm(null); setEditingId(null); setFormError(''); setNotice(''); setSelected(startOfDay(date)); };
  const closeDialog = () => { if (!busy) dialog.current?.close(); };
  const onClosed = () => { setSelected(null); setForm(null); setFormError(''); requestAnimationFrame(() => trigger.current?.focus()); };
  const beginCreate = () => { setEditingId(null); setForm(blankForm(selected)); setFormError(''); setNotice(''); };
  const beginEdit = event => { setEditingId(event.id); setForm(editForm(event)); setFormError(''); setNotice(''); };
  async function submit(event) {
    event.preventDefault();
    if (saving.current) return;
    setFormError('');
    const start = new Date(form.startsAt), end = new Date(form.endsAt), reminder = form.remindAt ? new Date(form.remindAt) : null;
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) { setFormError('Thời gian kết thúc phải sau thời gian bắt đầu.'); return; }
    if (reminder && (!Number.isFinite(reminder.getTime()) || reminder > start)) { setFormError('Thời gian nhắc phải trước hoặc bằng thời gian bắt đầu.'); return; }
    saving.current = true; setBusy(true);
    try {
      const payload = { title: form.title.trim(), description: form.description, startsAt: start.toISOString(), endsAt: end.toISOString(), remindAt: reminder ? reminder.toISOString() : null, status: form.status };
      await request({ url: editingId ? `/me/calendar/events/${editingId}` : '/me/calendar/events', method: editingId ? 'PATCH' : 'POST', data: payload });
      await load(); setSelected(startOfDay(start)); setMonth(new Date(start.getFullYear(), start.getMonth(), 1)); setForm(null); setNotice(editingId ? 'Đã cập nhật sự kiện.' : 'Đã thêm sự kiện.');
    } catch (error) { setFormError(error.message || 'Không thể lưu sự kiện.'); }
    finally { saving.current = false; setBusy(false); }
  }
  async function remove(event) {
    if (saving.current || !window.confirm(`Xóa sự kiện “${event.title}”?`)) return;
    saving.current = true; setBusy(true); setFormError('');
    try { await request({ url: `/me/calendar/events/${event.id}`, method: 'DELETE' }); await load(); setForm(null); setNotice('Đã xóa sự kiện.'); }
    catch (error) { setFormError(error.message || 'Không thể xóa sự kiện.'); }
    finally { saving.current = false; setBusy(false); }
  }

  const start = (month.getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const previewEvents = preview ? dayEvents(preview) : [];
  const selectedEvents = selected ? dayEvents(selected) : [];
  return <section className="dash-calendar interactive-calendar" aria-labelledby="calendar-title">
    <div className="dash-section-head"><div><h2 id="calendar-title">Lịch cá nhân</h2><p>Chọn một ngày để xem và quản lý sự kiện.</p></div><div className="cal-header-actions"><button type="button" className="cal-add" onClick={e => { const date = startOfDay(new Date()); openDay(date, e.currentTarget); setForm(blankForm(date)); }}><Plus size={16} aria-hidden="true" /> Thêm sự kiện</button><button type="button" className="cal-today" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setPreview(startOfDay(d)); }}>Hôm nay</button></div></div>
    {loadError && <div role="alert" className="cal-load-error">Không tải được lịch: {loadError.message} <button type="button" onClick={load}>Thử lại</button></div>}
    <div className="dash-calendar-layout"><div><div className="dash-month"><button aria-label="Tháng trước" type="button" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); setPreview(null); }}><ChevronLeft size={18} /></button><strong>Tháng {month.getMonth() + 1}, {month.getFullYear()}</strong><button aria-label="Tháng sau" type="button" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); setPreview(null); }}><ChevronRight size={18} /></button></div>
      <div className="dash-calendar-grid">{weekdays.map(day => <span className="dash-weekday" key={day}>{day}</span>)}{Array.from({ length: start }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: days }, (_, i) => { const date = new Date(month.getFullYear(), month.getMonth(), i + 1), list = dayEvents(date); return <button type="button" key={i} className={`cal-day ${sameDay(date, today) ? 'is-today' : ''}`} aria-label={`${dayLabel(date)}, ${list.length} sự kiện`} aria-describedby={preview && sameDay(preview, date) ? 'calendar-preview' : undefined} aria-current={sameDay(date, today) ? 'date' : undefined} onMouseEnter={() => setPreview(date)} onFocus={() => setPreview(date)} onClick={e => openDay(date, e.currentTarget)}><span>{i + 1}</span><span className="cal-dots" aria-hidden="true">{list.slice(0, 3).map(item => <i key={item.id} className={`cal-dot ${item.status.toLowerCase()}`} />)}{list.length > 3 && <small>+{list.length - 3}</small>}</span></button>; })}</div>
      <div className="cal-legend" aria-label="Chú thích trạng thái">{Object.entries(labels).map(([key, label]) => <span key={key}><i className={`cal-dot ${key.toLowerCase()}`} aria-hidden="true" />{label}</span>)}</div>
      <div id="calendar-preview" className="cal-preview" aria-live="polite">{preview ? <><strong>{dayLabel(preview)}</strong>{previewEvents.length ? <span>{previewEvents.slice(0, 3).map(item => item.title).join(' · ')}{previewEvents.length > 3 ? ` · và ${previewEvents.length - 3} sự kiện khác` : ''}</span> : <span>Không có sự kiện.</span>}</> : <span>Di chuột hoặc dùng bàn phím để xem nhanh một ngày.</span>}</div>
    </div><div className="dash-upcoming"><h3>Sắp tới</h3>{!events && !loadError ? <p>Đang tải lịch…</p> : !activeEvents.length ? <p>Chưa có sự kiện sắp tới.</p> : activeEvents.map(event => <button type="button" className="cal-upcoming" key={event.id} onClick={e => { const day = new Date(event.startsAt); setMonth(new Date(day.getFullYear(), day.getMonth(), 1)); openDay(day, e.currentTarget); }}><CalendarDays size={18} aria-hidden="true" /><span><strong>{event.title}</strong><small>{new Date(event.startsAt).toLocaleString('vi-VN')}</small></span></button>)}</div></div>
    <dialog ref={dialog} className="cal-dialog" aria-labelledby="cal-dialog-title" onCancel={e => { if (busy) e.preventDefault(); }} onClose={onClosed}>
      {selected && <><div className="cal-dialog-header"><div><h2 id="cal-dialog-title">Sự kiện trong ngày</h2><p>{dayLabel(selected)}</p></div><button type="button" className="cal-close" aria-label="Đóng lịch" disabled={busy} onClick={closeDialog}><X size={20} /></button></div>
      <div className="cal-dialog-body"><div className="cal-dialog-list"><div className="cal-list-head"><h3>Danh sách sự kiện</h3><button type="button" className="cal-add" onClick={beginCreate} disabled={busy}><Plus size={16} aria-hidden="true" /> Thêm sự kiện</button></div>{notice && <p role="status" className="cal-notice">{notice}</p>}{loadError && <p role="alert" className="cal-error">Không tải được danh sách mới: {loadError.message}</p>}{formError && !form && <p role="alert" className="cal-error">{formError}</p>}{!selectedEvents.length ? <p className="cal-empty">Ngày này chưa có sự kiện. Bạn có thể thêm sự kiện mới.</p> : selectedEvents.map(item => <article className="cal-event-row" key={item.id}><span className={`cal-dot ${item.status.toLowerCase()}`} aria-hidden="true" /><div><h4>{item.title}</h4><p>{eventRange(item)} · {labels[item.status] || item.status}</p>{item.description && <p className="cal-event-description">{item.description}</p>}</div><div className="cal-event-actions"><button type="button" onClick={() => beginEdit(item)} disabled={busy}>Sửa</button><button type="button" onClick={() => remove(item)} disabled={busy}>Xóa</button></div></article>)}</div>
      <div className="cal-dialog-editor">{form ? <form onSubmit={submit} className="cal-form"><h3>{editingId ? 'Sửa sự kiện' : 'Thêm sự kiện'}</h3>{formError && <p role="alert" className="cal-error">{formError}</p>}<label>Tên sự kiện<input autoFocus required maxLength={300} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Mô tả<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><div className="cal-form-grid"><label>Bắt đầu<input type="datetime-local" required value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} /></label><label>Kết thúc<input type="datetime-local" required value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} /></label><label>Nhắc trước (tùy chọn)<input type="datetime-local" value={form.remindAt} onChange={e => setForm({ ...form, remindAt: e.target.value })} /></label><label>Trạng thái<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><div className="cal-form-actions"><button type="submit" className="cal-save" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu sự kiện'}</button><button type="button" className="cal-cancel" disabled={busy} onClick={() => { setForm(null); setFormError(''); }}>Hủy</button></div></form> : <div className="cal-editor-empty"><CalendarDays size={26} aria-hidden="true" /><p>Chọn một sự kiện để chỉnh sửa hoặc thêm sự kiện mới.</p></div>}</div></div></>}
    </dialog>
  </section>;
}
