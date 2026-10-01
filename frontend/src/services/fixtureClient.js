import authFixtures from '../../../docs/api/fixtures/auth.fixtures.json';
import profileFixtures from '../../../docs/api/fixtures/profile.fixtures.json';
import achievementFixtures from '../../../docs/api/fixtures/achievements.fixtures.json';
import awardFixtures from '../../../docs/api/fixtures/awards.fixtures.json';
import { ApiError } from './apiError.js';

const clone = (value) => structuredClone(value);
const payloadData = (fixture) => clone(fixture.payload.data);

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
  getPersonalProfile: async () => payloadData(profileFixtures.personalProfile),
  getDashboardSummary: async () => toDashboardSummary(payloadData(profileFixtures.personalProfile)),
  fixtures: { achievements: achievementFixtures, awards: awardFixtures },
};
