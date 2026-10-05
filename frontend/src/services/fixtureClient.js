import authFixtures from '../../../docs/api/fixtures/auth.fixtures.json';
import profileFixtures from '../../../docs/api/fixtures/profile.fixtures.json';
import achievementFixtures from '../../../docs/api/fixtures/achievements.fixtures.json';
import awardFixtures from '../../../docs/api/fixtures/awards.fixtures.json';
import { ApiError } from './apiError.js';

const clone = (value) => structuredClone(value);
const payloadData = (fixture) => clone(fixture.payload.data);
let fixtureProfile = payloadData(profileFixtures.personalProfile);
let fixtureUnit = payloadData(profileFixtures.unitProfile);

function login({ username, password }) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const lecturerAccounts = ['an.nv', 'an.nv@lhu.edu.vn'];
  const managerAccounts = ['bich.tt', 'bich.tt@lhu.edu.vn'];
  if (![...lecturerAccounts, ...managerAccounts].includes(normalizedUsername) || password !== 'demo1234') {
    throw new ApiError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Tài khoản fixture hoặc mật khẩu không chính xác.' });
  }
  const fixture = managerAccounts.includes(normalizedUsername)
    ? authFixtures.loginSuccessManager
    : authFixtures.loginSuccess;
  return payloadData(fixture);
}

export function toDashboardSummary(profile) {
  const stats = profile.stats || {};
  return {
    achievements: {
      VerifiedCount: stats.verifiedAchievements || 0,
      PendingCount: stats.pendingAchievements || 0,
      RevokedCount: stats.revokedAchievements || 0,
    },
    awards: {
      RecordedCount: stats.recordedAwards || 0,
      RevokedAwardCount: 0,
    },
    categories: { RESEARCH: stats.verifiedAchievements || 0 },
  };
}

export const fixtureClient = {
  login: async (credentials) => login(credentials),
  refresh: async () => { throw new ApiError({ status: 401, code: 'FIXTURE_SESSION_EXPIRED', message: 'Phiên fixture đã kết thúc. Vui lòng đăng nhập lại.' }); },
  logout: async () => null,
  getMe: async () => payloadData(authFixtures.meProfileLecturer),
  getPersonalProfile: async () => clone(fixtureProfile),
  updatePersonalProfile: async (payload) => {
    if (Number(payload.version) !== Number(fixtureProfile.version)) {
      throw new ApiError({ status: 409, code: 'CONCURRENCY_CONFLICT', message: 'Fixture đã đổi phiên bản. Vui lòng tải lại.' });
    }
    fixtureProfile = { ...fixtureProfile, phone: payload.phone ?? null, title: payload.title ?? null,
      degree: payload.degree ?? null, version: fixtureProfile.version + 1, updatedAt: new Date().toISOString() };
    return clone(fixtureProfile);
  },
  getUnitProfile: async (unitId) => Number(unitId) === Number(fixtureUnit.unitId) ? clone(fixtureUnit) : null,
  listOrganizations: async () => [clone(fixtureUnit)],
  getDashboardSummary: async () => toDashboardSummary(fixtureProfile),
  fixtures: { achievements: achievementFixtures, awards: awardFixtures },
};
