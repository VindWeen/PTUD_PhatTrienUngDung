import { request } from './request.js';
import { USE_FIXTURES } from './apiConfig.js';
function api(method, url, data, params, fresh = false) {
  if (USE_FIXTURES)
    return Promise.reject(
      new Error('KPI cần API thật. Chạy Vite ở chế độ api; không có fixture KPI đã chốt.')
    );
  return request({ method, url: `/kpi${url}`, data, params, fresh });
}
export const kpiApi = {
  external: (fresh = false) => api('GET', '/external', undefined, undefined, fresh),
  externalMapping: data => api('POST', '/external/mappings',data),
  externalRun: data => api('POST', '/external/runs',data),
  externalDraft: (id,data) => api('POST', `/external/records/${id}/draft`,data),
  recommendations: (runId) => api('GET', '/recommendations', undefined, {runId}),
  generateRecommendations: (data) => api('POST', '/recommendations', data),
  recommendationDecision: (id, data) => api('POST', `/recommendations/${id}/decision`, data),
  catalogs: () => api('GET', '/catalogs'),
  list: (params, fresh = false) => api('GET', '/goals', undefined, params, fresh),
  create: (data) => api('POST', '/goals', data),
  update: (id, data) => api('PATCH', `/goals/${id}`, data),
  remove: (id, version) => api('DELETE', `/goals/${id}`, { version }),
  accept: (id, version) => api('POST', `/goals/${id}/accept`, { version }),
  result: (id, method, data) => api(method, `/goals/${id}/result`, data),
  draft: (id, version, achievementTypeId) =>
    api('POST', `/goals/${id}/result/draft`, { version, achievementTypeId }),
  preview: (csv) => api('POST', '/import/preview', { csv }),
  commit: (csv) => api('POST', '/import/commit', { csv }),
  template: () => api('GET', '/template.csv'),
};
