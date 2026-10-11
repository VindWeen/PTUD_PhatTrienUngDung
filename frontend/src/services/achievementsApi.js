import { USE_FIXTURES } from './apiConfig.js';
import { fixtureClient } from './fixtureClient.js';
import { request } from './request.js';

const fixtureWriteError = () =>
  Promise.reject(
    new Error('Chế độ fixture chỉ dùng để xem; chuyển sang VITE_DATA_SOURCE=api để thực hiện thao tác trên cơ sở dữ liệu thật.')
  );

export const achievementsApi = {
  list: (params = {}) =>
    USE_FIXTURES ? fixtureClient.listAchievements(params) : request({ method: 'GET', url: '/achievements', params }),

  getById: (id) =>
    USE_FIXTURES ? fixtureClient.getAchievementById(id) : request({ method: 'GET', url: `/achievements/${id}` }),

  create: (data) =>
    USE_FIXTURES ? fixtureWriteError() : request({ method: 'POST', url: '/achievements', data }),

  update: (id, data) =>
    USE_FIXTURES ? fixtureWriteError() : request({ method: 'PATCH', url: `/achievements/${id}`, data }),

  submit: (id, data) =>
    USE_FIXTURES ? fixtureClient.submitAchievement(id, data) : request({ method: 'POST', url: `/achievements/${id}/submit`, data }),

  verify: (id, data) =>
    USE_FIXTURES ? fixtureClient.verifyAchievement(id, data) : request({ method: 'POST', url: `/achievements/${id}/verify`, data }),

  requestCorrection: (id, data) =>
    USE_FIXTURES ? fixtureClient.requestCorrection(id, data) : request({ method: 'POST', url: `/achievements/${id}/request-correction`, data }),

  reject: (id, data) =>
    USE_FIXTURES ? fixtureClient.rejectAchievement(id, data) : request({ method: 'POST', url: `/achievements/${id}/reject`, data }),

  cancel: (id, data) =>
    USE_FIXTURES ? fixtureClient.cancelAchievement(id, data) : request({ method: 'POST', url: `/achievements/${id}/cancel`, data }),

  revoke: (id, data) =>
    USE_FIXTURES ? fixtureClient.revokeAchievement(id, data) : request({ method: 'POST', url: `/achievements/${id}/revoke`, data }),

  resubmit: (id, data) =>
    USE_FIXTURES ? fixtureClient.submitAchievement(id, data) : request({ method: 'POST', url: `/achievements/${id}/resubmit`, data }),

  replace: (id, data = {}) =>
    USE_FIXTURES ? fixtureWriteError() : request({ method: 'POST', url: `/achievements/${id}/replace`, data }),

  getHistory: (id) =>
    USE_FIXTURES ? fixtureClient.getAchievementHistory(id) : request({ method: 'GET', url: `/achievements/${id}/history` }),

  getSubmissions: (id) =>
    USE_FIXTURES ? fixtureClient.getAchievementSubmissions(id) : request({ method: 'GET', url: `/achievements/${id}/submissions` }),

  listAchievementTypes: () =>
    USE_FIXTURES
      ? Promise.resolve([
          { achievement_type_id: 1, code: 'RESEARCH_JOURNAL_Q1', name: 'Bài báo quốc tế ISI/Scopus Q1' },
          { achievement_type_id: 2, code: 'RESEARCH_PATENT', name: 'Bằng độc quyền sáng chế / Giải pháp hữu ích' },
          { achievement_type_id: 3, code: 'TEACHING_CURRICULUM', name: 'Biên soạn giáo trình / Tài liệu giảng dạy' },
        ])
      : request({ method: 'GET', url: '/achievements/catalogs' }),
};

export default achievementsApi;
