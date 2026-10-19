import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { calendarApi } from '../../services/calendarApi';
import { CATEGORIES, emptyEvent, eventPayload, mockEvents, monthCells, onDay, shiftMonth, todayKey } from './calendarModel';
import './calendar.css';

const CalendarContext = createContext(null);
const useCalendar = () => useContext(CalendarContext);

export function CalendarProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(todayKey);
  const [month, setMonth] = useState(() => todayKey().slice(0, 7));
  const alive = useRef(true);
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await calendarApi.list(); if (alive.current) setEvents(data); }
    catch (e) { if (alive.current) setError(e.message || 'Không tải được lịch cá nhân.'); }
    finally { if (alive.current) setLoading(false); }
  }, []);
  useEffect(() => { alive.current = true; reload(); return () => { alive.current = false; }; }, [reload]);
  const openCalendar = (day = todayKey()) => { setSelected(day); setMonth(day.slice(0, 7)); setOpen(true); };
  const save = async (draft, original) => {
    const saved = original
      ? await calendarApi.update(original.id, { ...eventPayload(draft), version: original.version })
      : await calendarApi.create(eventPayload(draft));
    if (alive.current) setEvents(items => [...items.filter(e => e.id !== saved.id), saved]);
    return saved;
  };
  const remove = async event => {
    await calendarApi.remove(event.id, event.version);
    if (alive.current) setEvents(items => items.filter(e => e.id !== event.id));
  };
  const value = { events: [...events, ...mockEvents(month)], loading, error, reload, selected, setSelected, month, setMonth, openCalendar, save, remove };
  return <CalendarContext.Provider value={value}>
    {children}
    {open && <CalendarDialog onClose={() => setOpen(false)} />}
  </CalendarContext.Provider>;
}

export function CalendarButton() {
  const { openCalendar } = useCalendar();
  return <button type="button" onClick={() => openCalendar()} aria-label="Mở lịch cá nhân" aria-haspopup="dialog" title="Lịch cá nhân" className="soft-btn-secondary h-11 w-11 shrink-0 !p-0"><CalendarDays className="h-5 w-5" /></button>;
}

function MonthControls() {
  const { month, setMonth, setSelected } = useCalendar();
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" aria-label="Tháng trước" disabled={month <= '1900-01'} className="calendar-icon" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
    <label className="text-sm font-semibold"><span className="sr-only">Chọn tháng và năm</span><input type="month" min="1900-01" max="2199-12" className="calendar-input !w-auto" value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value); }} /></label>
    <button type="button" aria-label="Tháng sau" disabled={month >= '2199-12'} className="calendar-icon" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
    <button type="button" className="calendar-secondary text-xs" onClick={() => { const day = todayKey(); setMonth(day.slice(0, 7)); setSelected(day); }}>Hôm nay</button>
  </div>;
}

function CalendarGrid({ onSelect, compact = false, filter = 'all' }) {
  const { month, selected, events } = useCalendar();
  const today = todayKey();
  return <div className={`calendar-grid ${compact ? 'calendar-grid-compact' : ''}`}>
    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500">{day}</div>)}
    {monthCells(month).map(day => {
      const items = events.filter(e => onDay(e, day) && (filter === 'all' || e.category === filter));
      return <button type="button" key={day} onClick={() => onSelect(day)} aria-label={`${day}${items.length ? `, ${items.length} sự kiện` : ''}`} aria-pressed={selected === day}
        className={`calendar-day ${day.slice(0, 7) !== month ? 'calendar-muted' : ''} ${selected === day ? 'calendar-selected' : ''} ${today === day ? 'calendar-today' : ''}`}>
        <span className="text-xs font-semibold">{Number(day.slice(-2))}</span>
        <span className="mt-1 flex min-h-1.5 justify-center gap-1" aria-hidden="true">{[...new Set(items.map(e => e.category))].map(category => <i key={category} className={`h-1.5 w-1.5 rounded-full ${CATEGORIES[category].color}`} />)}</span>
        {!compact && items.slice(0, 2).map(e => <span key={e.id} className={`calendar-chip ${CATEGORIES[e.category].color} ${e.completed ? 'line-through opacity-50' : ''}`}>{e.title}</span>)}
        {!compact && items.length > 2 && <small className="text-[10px]">+{items.length - 2} sự kiện</small>}
      </button>;
    })}
  </div>;
}

function CalendarStatus() {
  const { loading, error, reload } = useCalendar();
  if (loading) return <p role="status" className="my-2 text-xs text-slate-500">Đang tải lịch cá nhân…</p>;
  if (error) return <div role="alert" className="my-2 text-xs text-rose-600">{error} <button type="button" onClick={reload} className="underline">Thử lại</button></div>;
  return null;
}

export function PersonalCalendarCard() {
  const { openCalendar, month } = useCalendar();
  return <section className="rounded-[34px] bg-white p-5 shadow-[0_8px_30px_rgba(55,78,107,0.05)] dark:bg-slate-900 sm:p-8">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl font-extrabold"><CalendarDays className="h-5 w-5 text-teal-500" />Lịch cá nhân</h2>
      <button type="button" className="text-xs font-semibold text-teal-600 dark:text-teal-300" onClick={() => openCalendar(`${month}-01`)}>Mở lịch đầy đủ ↗</button>
    </div>
    <MonthControls /><CalendarStatus />
    <CalendarGrid compact onSelect={openCalendar} />
    <p className="mt-3 text-xs text-slate-500">Chọn ngày để ghi lịch. Chấm xanh lá: sự kiện chung minh họa.</p>
  </section>;
}

function CalendarDialog({ onClose }) {
  const { events, selected, setSelected, setMonth, save, remove, loading, error, reload } = useCalendar();
  const dialog = useRef(null);
  const details = useRef(null);
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState('');
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  useEffect(() => {
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    node.showModal(); document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const allowDiscard = () => !busy && (!dirty || window.confirm('Bạn có nội dung chưa lưu. Bỏ thay đổi này?'));
  const close = () => { if (allowDiscard()) onClose(); };
  const cancelEdit = () => { if (allowDiscard()) { setDraft(null); setEditor(null); setWriteError(''); } };
  const startEdit = event => {
    if (!allowDiscard()) return;
    const next = event ? eventPayload(event) : emptyEvent(selected);
    setEditor(event || null); setDraft(next); setBaseline(JSON.stringify(next)); setWriteError(''); setNotice('');
  };
  const selectDay = day => {
    if (!allowDiscard()) return;
    setDraft(null); setEditor(null); setWriteError(''); setSelected(day); setMonth(day.slice(0, 7));
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => details.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
    }
  };
  const mutate = async action => {
    setBusy(true); setWriteError(''); setNotice('');
    try { await action(); }
    catch (e) { setWriteError(e.message || 'Không lưu được lịch. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  };
  const submit = event => {
    event.preventDefault();
    if (busy) return;
    if (!draft.title.trim()) { setWriteError('Vui lòng nhập tiêu đề.'); return; }
    if (draft.endsAt < draft.startsAt) { setWriteError('Ngày giờ kết thúc phải từ ngày giờ bắt đầu.'); return; }
    mutate(async () => {
      await save(draft, editor); setSelected(draft.startsAt.slice(0, 10)); setMonth(draft.startsAt.slice(0, 7));
      setDraft(null); setEditor(null); setNotice('Đã lưu lịch cá nhân.');
    });
  };
  const dayEvents = events.filter(e => onDay(e, selected) && (filter === 'all' || e.category === filter)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return <dialog ref={dialog} className="personal-calendar-dialog" aria-labelledby="calendar-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="calendar-shell" onClick={e => e.stopPropagation()}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-700">
        <div><h2 id="calendar-title" className="flex items-center gap-2 text-xl font-extrabold"><CalendarDays className="text-teal-500" />Lịch cá nhân</h2><p className="mt-1 text-xs text-slate-500">Lịch của bạn · Giờ Việt Nam (UTC+7)</p></div>
        <button autoFocus type="button" className="calendar-icon" aria-label="Đóng lịch cá nhân" disabled={busy} onClick={close}><X /></button>
      </header>
      <div className="calendar-body">
        <section className="min-w-0 p-4 sm:p-5" aria-label="Lịch tháng">
          <MonthControls />
          <label className="my-4 flex items-center gap-3 text-xs">Hiển thị
            <select aria-label="Lọc loại sự kiện" className="calendar-input !w-auto" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tất cả</option>{Object.entries(CATEGORIES).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}</select>
          </label>
          <CalendarStatus />
          <CalendarGrid onSelect={selectDay} filter={filter} />
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500">{Object.entries(CATEGORIES).map(([key, v]) => <span key={key} className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${v.color}`} />{v.label}</span>)}</div>
          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700"><h3 className="mb-2 text-sm font-bold">Sắp tới</h3>
            {events.filter(e => e.endsAt.slice(0, 10) >= todayKey() && !e.completed && (filter === 'all' || e.category === filter)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5).map(e => <button key={e.id} type="button" onClick={() => selectDay(e.startsAt.slice(0, 10))} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"><i className={`h-2 w-2 shrink-0 rounded-full ${CATEGORIES[e.category].color}`} /><span className="min-w-0 flex-1 break-words">{e.title}{e.readOnly ? ' · Minh họa' : ''}</span><time className="shrink-0 text-slate-500">{e.startsAt.slice(0, 10).split('-').reverse().join('/')}</time></button>)}
          </div>
        </section>
        <aside ref={details} className="min-w-0 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/30 sm:p-5 lg:border-l lg:border-t-0" aria-label="Chi tiết ngày">
          <div className="mb-4 flex items-center justify-between gap-2"><h3 className="font-bold">Ngày {selected.split('-').reverse().join('/')}</h3>{!draft && <button type="button" className="calendar-primary" disabled={loading || !!error || busy} onClick={() => startEdit(null)}><Plus size={15} />Thêm lịch</button>}</div>
          {writeError && <div role="alert" className="mb-3 text-sm text-rose-600">{writeError}{!draft && <button type="button" onClick={reload} className="ml-2 underline">Tải lại lịch</button>}</div>}
          {notice && <p role="status" className="mb-3 text-sm text-teal-600">{notice}</p>}
          {draft ? <form onSubmit={submit} className="space-y-3">
            <h4 className="font-semibold">{editor ? 'Sửa lịch' : 'Lịch mới'}</h4>
            <fieldset disabled={busy} className="space-y-3">
              <label className="calendar-label">Tiêu đề *<input autoFocus className="calendar-input" required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
              <label className="calendar-label">Loại sự kiện<select className="calendar-input" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{Object.entries(CATEGORIES).filter(([key]) => key !== 'system').map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}</select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.allDay} onChange={e => setDraft({ ...draft, allDay: e.target.checked, startsAt: `${draft.startsAt.slice(0, 10)}T${e.target.checked ? '00:00' : '09:00'}`, endsAt: `${draft.endsAt.slice(0, 10)}T${e.target.checked ? '00:00' : '10:00'}` })} />Cả ngày</label>
              <label className="calendar-label">Bắt đầu *<input className="calendar-input" type={draft.allDay ? 'date' : 'datetime-local'} required min={draft.allDay ? '1900-01-01' : '1900-01-01T00:00'} max={draft.allDay ? '2199-12-31' : '2199-12-31T23:59'} value={draft.allDay ? draft.startsAt.slice(0, 10) : draft.startsAt} onChange={e => setDraft({ ...draft, startsAt: draft.allDay ? `${e.target.value}T00:00` : e.target.value })} /></label>
              <label className="calendar-label">Kết thúc *<input className="calendar-input" type={draft.allDay ? 'date' : 'datetime-local'} required min={draft.allDay ? draft.startsAt.slice(0, 10) : draft.startsAt} max={draft.allDay ? '2199-12-31' : '2199-12-31T23:59'} value={draft.allDay ? draft.endsAt.slice(0, 10) : draft.endsAt} onChange={e => setDraft({ ...draft, endsAt: draft.allDay ? `${e.target.value}T00:00` : e.target.value })} /></label>
              <label className="calendar-label">Địa điểm / đường dẫn<input className="calendar-input" maxLength={500} value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} /></label>
              <label className="calendar-label">Ghi chú<textarea className="calendar-input" rows={3} maxLength={4000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.completed} onChange={e => setDraft({ ...draft, completed: e.target.checked })} />Đã hoàn thành</label>
            </fieldset>
            <div className="flex gap-2"><button type="submit" disabled={busy} className="calendar-primary">{busy ? 'Đang lưu…' : 'Lưu lịch'}</button><button type="button" disabled={busy} onClick={cancelEdit} className="calendar-secondary">Hủy</button></div>
            {writeError && <button type="button" className="text-xs underline" disabled={busy} onClick={async () => { if (!allowDiscard()) return; setDraft(null); setEditor(null); setWriteError(''); await reload(); }}>Bỏ bản sửa và tải lại lịch</button>}
          </form> : <div className="space-y-3">
            {!dayEvents.length && <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Ngày này chưa có lịch. Thêm lịch thi, cuộc thi hoặc việc cần làm của bạn.</div>}
            {dayEvents.map(event => {
              const overdue = event.category === 'task' && !event.completed && event.endsAt < new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(' ', 'T');
              return <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-2 flex items-center gap-2 text-[11px] text-slate-500"><i className={`h-2 w-2 rounded-full ${CATEGORIES[event.category].color}`} />{CATEGORIES[event.category].label}</p>
                <h4 className={`break-words font-bold ${event.completed ? 'line-through opacity-60' : ''}`}>{event.title}</h4>
                <p className="mt-1 text-xs text-slate-500">{event.allDay ? 'Cả ngày' : `${event.startsAt.slice(11)} – ${event.endsAt.slice(11)}`}{event.startsAt.slice(0, 10) !== event.endsAt.slice(0, 10) && ` · ${event.startsAt.slice(0, 10).split('-').reverse().join('/')} → ${event.endsAt.slice(0, 10).split('-').reverse().join('/')}`}</p>
                {event.location && <p className="mt-2 break-words text-xs">📍 {event.location}</p>}
                {event.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500">{event.description}</p>}
                {overdue && <p className="mt-2 text-xs font-semibold text-rose-600">Quá hạn</p>}
                {event.completed && <p className="mt-2 text-xs text-teal-600">Đã hoàn thành</p>}
                {!event.readOnly && <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className="calendar-icon" aria-label={`Sửa ${event.title}`} onClick={() => startEdit(event)}><Pencil size={15} /></button>
                  <button type="button" disabled={busy} className="calendar-secondary text-xs" onClick={() => mutate(async () => { await save({ ...event, completed: !event.completed }, event); setNotice(event.completed ? 'Đã mở lại công việc.' : 'Đã đánh dấu hoàn thành.'); })}><Check size={14} />{event.completed ? 'Mở lại' : 'Hoàn thành'}</button>
                  <button type="button" disabled={busy} className="calendar-icon text-rose-600" aria-label={`Xóa ${event.title}`} onClick={() => { if (window.confirm(`Xóa lịch “${event.title}”?`)) mutate(async () => { await remove(event); setNotice('Đã xóa lịch.'); }); }}><Trash2 size={15} /></button>
                </div>}
              </article>;
            })}
          </div>}
        </aside>
      </div>
    </div>
  </dialog>;
}
