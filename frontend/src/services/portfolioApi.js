import { USE_FIXTURES } from './apiConfig.js';
import { fixtureClient } from './fixtureClient.js';
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
  getDashboardSummary() {
    return request({ method: 'GET', url: '/dashboard/summary' });
  },
};
