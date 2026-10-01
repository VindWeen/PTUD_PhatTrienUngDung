import { USE_FIXTURES } from './apiConfig.js';
import { fixtureClient, toDashboardSummary } from './fixtureClient.js';
import { request } from './request.js';

export const portfolioApi = {
  getPersonalProfile() {
    return USE_FIXTURES ? fixtureClient.getPersonalProfile() : request({ method: 'GET', url: '/me/profile' });
  },
  getDashboardSummary() {
    if (USE_FIXTURES) return fixtureClient.getDashboardSummary();
    return request({ method: 'GET', url: '/me/profile' }).then(toDashboardSummary);
  },
};
