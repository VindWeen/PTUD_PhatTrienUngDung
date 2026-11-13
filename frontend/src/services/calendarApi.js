import { request } from './request';
import { USE_FIXTURES } from './apiConfig';

const call = config => {
  if (USE_FIXTURES) return Promise.reject(new Error('Lịch cần chế độ API để tải và lưu dữ liệu.'));
  return request(config);
};
export const calendarApi = {
  list: () => call({ url: '/me/calendar' }),
  listSystem: () => call({ url: '/me/calendar/system' }),
  create: data => call({ url: '/me/calendar', method: 'POST', data }),
  update: (id, data) => call({ url: `/me/calendar/${id}`, method: 'PUT', data }),
  remove: (id, version) => call({ url: `/me/calendar/${id}`, method: 'DELETE', data: { version } }),
  createReminder: data => call({ url: '/me/calendar/reminder', method: 'POST', data }),
  listReminders: () => call({ url: '/me/calendar/reminders' }),
};
