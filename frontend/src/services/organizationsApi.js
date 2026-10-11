import { USE_FIXTURES } from './apiConfig.js';
import { fixtureClient } from './fixtureClient.js';
import { request } from './request.js';

const fixtureWriteError = () => Promise.reject(new Error('Fixture tổ chức chỉ dùng để xem; chuyển sang VITE_DATA_SOURCE=api để ghi dữ liệu thật.'));

export const organizationsApi = {
  list: (fresh = false) => USE_FIXTURES ? fixtureClient.listOrganizations() : request({ method: 'GET', url: '/organizations', fresh }),
  getProfile: (id, fresh = false) => USE_FIXTURES ? fixtureClient.getUnitProfile(id) : request({ method: 'GET', url: `/units/${id}/profile`, fresh }),
  create: (data) => USE_FIXTURES ? fixtureWriteError() : request({ method: 'POST', url: '/organizations', data }),
  update: (id, data) => USE_FIXTURES ? fixtureWriteError() : request({ method: 'PATCH', url: `/organizations/${id}`, data }),
  remove: (id) => USE_FIXTURES ? fixtureWriteError() : request({ method: 'DELETE', url: `/organizations/${id}` }),
  appointRepresentative: (id, data) => USE_FIXTURES ? fixtureWriteError() : request({ method: 'POST', url: `/organizations/${id}/representative`, data }),
  transferLecturer: (id, data) => USE_FIXTURES ? fixtureWriteError() : request({ method: 'POST', url: `/lecturers/${id}/assignments`, data }),
};
