export const CATEGORIES = {
  exam: { label: 'Lịch thi', color: 'bg-violet-500' },
  competition: { label: 'Cuộc thi', color: 'bg-amber-500' },
  task: { label: 'Công việc', color: 'bg-blue-500' },
  personal: { label: 'Cá nhân', color: 'bg-rose-500' },
  system: { label: 'Sự kiện chung · Minh họa', color: 'bg-teal-500' },
};
export function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function monthCells(month) {
  const [year, index] = month.split('-').map(Number);
  const first = new Date(year, index - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => dateKey(new Date(year, index - 1, 1 - offset + i)));
}
export function shiftMonth(month, amount) {
  const [year, index] = month.split('-').map(Number);
  return dateKey(new Date(year, index - 1 + amount, 1)).slice(0, 7);
}
export const monthLabel = month => `Tháng ${Number(month.slice(5))} / ${month.slice(0, 4)}`;
export const onDay = (event, day) => event.startsAt.slice(0, 10) <= day && event.endsAt.slice(0, 10) >= day;
export function mockEvents(month) {
  // Illustrations repeat in the viewed month; they are not live council assignments.
  return [
    { id: `mock-council-${month}`, title: 'Hội đồng xét duyệt', location: 'Phòng Hội thảo 1', startsAt: `${month}-21T11:30`, endsAt: `${month}-21T12:30`, description: 'Lịch minh họa, chưa phải thông báo hay phân công thực tế.' },
    { id: `mock-deadline-${month}`, title: 'Hạn nộp hồ sơ khen thưởng', location: '', startsAt: `${month}-25T00:00`, endsAt: `${month}-25T00:00`, allDay: true, description: 'Hạn nộp minh họa để xem thử lịch.' },
  ].map(event => ({ ...event, category: 'system', readOnly: true, completed: false }));
}
export function emptyEvent(day) {
  return { title: '', description: '', location: '', category: 'personal', startsAt: `${day}T09:00`, endsAt: `${day}T10:00`, allDay: false, completed: false };
}
export function eventPayload(event) {
  const { title, description, location, category, startsAt, endsAt, allDay, completed } = event;
  return { title, description, location, category, startsAt, endsAt, allDay, completed };
}
