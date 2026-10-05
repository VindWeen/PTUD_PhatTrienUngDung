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

  remove: (id) =>
    USE_FIXTURES ? fixtureWriteError() : request({ method: 'DELETE', url: `/achievements/${id}` }),

  listAchievementTypes: () =>
    USE_FIXTURES
      ? Promise.resolve([
          { achievement_type_id: 1, code: 'RESEARCH_JOURNAL_Q1', name: 'Bài báo quốc tế ISI/Scopus Q1' },
          { achievement_type_id: 2, code: 'RESEARCH_PATENT', name: 'Bằng độc quyền sáng chế / Giải pháp hữu ích' },
          { achievement_type_id: 3, code: 'TEACHING_CURRICULUM', name: 'Biên soạn giáo trình / Tài liệu giảng dạy' },
        ])
      : request({ method: 'GET', url: '/admin/achievement-types' }),
};

export default achievementsApi;
