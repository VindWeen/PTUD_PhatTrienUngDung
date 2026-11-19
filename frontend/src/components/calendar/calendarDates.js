export const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const localInput = date => {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
// Intersect half-open intervals [start, end) with the user's local calendar day.
export const intersectsDay = (event, date) => {
  const start = startOfDay(date), end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return new Date(event.startsAt) < end && new Date(event.endsAt) > start;
};

export const localDay = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
