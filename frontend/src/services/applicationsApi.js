import { request } from './request';
export const applicationsApi = {
  cycles: () => request({ url: '/award-cycles' }),
  cycle: (data) => request({ method: 'POST', url: '/award-cycles', data }),
  create: (data) => request({ method: 'POST', url: '/award-applications', data }),
  list: (contextUnitId, fresh = false) =>
    request({ url: '/award-applications', params: contextUnitId ? { contextUnitId } : {}, fresh }),
  detail: (id) => request({ url: `/award-applications/${id}` }),
  transition: (id, action, data) =>
    request({ method: 'POST', url: `/award-applications/${id}/${action}`, data }),
};
