import { USE_FIXTURES } from './apiConfig.js';
import { fixtureClient, toDashboardSummary } from './fixtureClient.js';
import { request } from './request.js';

export const portfolioApi = {
  getPersonalProfile() {
    return USE_FIXTURES ? fixtureClient.getPersonalProfile() : request({ method: 'GET', url: '/me/profile' });
  },
  updatePersonalProfile(payload) {
    return USE_FIXTURES ? fixtureClient.updatePersonalProfile(payload) : request({ method: 'PATCH', url: '/me/profile', data: payload });
  },
  getUnitProfile(unitId) {
    return USE_FIXTURES ? fixtureClient.getUnitProfile(unitId) : request({ method: 'GET', url: `/units/${unitId}/profile` });
  },
  async getDashboardSummary() {
    if (USE_FIXTURES) return fixtureClient.getDashboardSummary();
    try {
      const res = await request({ method: 'GET', url: '/dashboard/summary' });
      if (res && Array.isArray(res.summary)) {
        const achValid = res.summary.filter((s) => s.kind === 'ACHIEVEMENT').reduce((acc, cur) => acc + (cur.valid_count || 0), 0);
        const achTotal = res.summary.filter((s) => s.kind === 'ACHIEVEMENT').reduce((acc, cur) => acc + (cur.total || 0), 0);
        const awdValid = res.summary.filter((s) => s.kind === 'AWARD').reduce((acc, cur) => acc + (cur.valid_count || 0), 0);
        const awdTotal = res.summary.filter((s) => s.kind === 'AWARD').reduce((acc, cur) => acc + (cur.total || 0), 0);
        return {
          achievements: {
            VerifiedCount: achValid,
            PendingCount: Math.max(0, achTotal - achValid),
            RevokedCount: 0,
          },
          awards: {
            RecordedCount: awdValid,
            RevokedAwardCount: Math.max(0, awdTotal - awdValid),
          },
          categories: {
            RESEARCH: achValid,
          },
          raw: res,
        };
      }
      return toDashboardSummary(res);
    } catch {
      return request({ method: 'GET', url: '/me/profile' }).then(toDashboardSummary);
    }
  },
};
