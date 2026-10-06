import { request } from './request.js';
import apiClient from './apiClient.js';

// W3-P1 always uses Express/SQL, including when other pages show demo fixtures.
export const reportsApi = {
  list: (params, dashboard = false) => request({ method: 'GET', url: dashboard ? '/dashboard/summary' : '/reports', params }),
  exportCsv: params => apiClient.get('/reports/export.csv', { params, responseType: 'blob' }),
};
