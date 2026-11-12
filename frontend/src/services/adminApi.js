import { request } from './request';
import apiClient from './apiClient';

export const adminApi = {
  permissions: userId => request({ url: `/admin/users/${userId}/permissions`, fresh: true }),
  savePermissions: (userId, payload) => apiClient.post(`/admin/users/${userId}/permissions`, payload),
};
