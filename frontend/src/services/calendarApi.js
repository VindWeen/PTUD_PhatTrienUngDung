import { request } from './request';
import { USE_FIXTURES } from './apiConfig';

const call = config => {
  if (USE_FIXTURES) return Promise.reject(new Error('Lịch cá nhân cần chế độ API để lưu dữ liệu. Sự kiện chung bên dưới là minh họa.'));
  return request(config);
};
export const calendarApi = {
  list: () => call({ url: '/me/calendar' }),
  create: data => call({ url: '/me/calendar', method: 'POST', data }),
  update: (id, data) => call({ url: `/me/calendar/${id}`, method: 'PUT', data }),
  remove: (id, version) => call({ url: `/me/calendar/${id}`, method: 'DELETE', data: { version } }),
};
