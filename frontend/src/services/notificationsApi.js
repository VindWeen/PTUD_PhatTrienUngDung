import { request } from './request.js';
import { USE_FIXTURES } from './apiConfig.js';
export const notificationsApi = {
 list: (params, fresh = false) => USE_FIXTURES
  ? Promise.reject(new Error('Thông báo cần VITE_DATA_SOURCE=api và phiên đăng nhập thật; chưa có fixture được chốt.'))
  : request({ method:'GET',url:'/notifications',params,fresh }),
 read: id => request({ method:'PATCH',url:`/notifications/${id}/read` }),
};
