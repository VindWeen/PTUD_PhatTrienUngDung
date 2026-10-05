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
  listAchievements: async (params = {}) => {
    let items = clone(achievementFixtures.achievementsList.payload.data.items);
    if (params.subjectType) items = items.filter(i => i.subjectType === params.subjectType);
    if (params.status) items = items.filter(i => i.status === params.status);
    return { items, pagination: { total: items.length, page: 1, pageSize: 10, totalPages: 1 } };
  },
  getAchievementById: async () => clone(achievementFixtures.achievementDetailVerified.payload.data),
  getEvidencesByAchievement: async (achievementId) => {
    return [
      {
        evidenceId: 303,
        achievementId: Number(achievementId),
        title: 'Hợp đồng nghiên cứu khoa học và biên bản nghiệm thu cấp trường',
        description: 'Hợp đồng số 45/HĐ-KHCN ký ngày 15/01/2024',
        isRemoved: false,
        createdBy: 1,
        createdAt: '2024-08-22T08:10:00Z',
        latestFileId: 405,
        latestVersionNo: 1,
        latestFileName: 'Hop_dong_NCKH_daky.pdf',
        latestFileSize: 3355443,
        latestMimeType: 'application/pdf',
        latestSha256Hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
        latestUploadedAt: '2024-08-22T08:15:00Z',
        totalVersions: 1,
      },
    ];
  },
  createEvidence: async (achievementId, payload) => ({
    evidenceId: Date.now(),
    achievementId: Number(achievementId),
    title: payload.title,
    description: payload.description || null,
    isRemoved: false,
    createdBy: 1,
    createdAt: new Date().toISOString(),
    files: [
      {
        evidenceFileId: Date.now() + 1,
        versionNo: 1,
        originalFileName: payload.file?.name || 'file.pdf',
        fileSize: payload.file?.size || 1024,
        mimeType: payload.file?.type || 'application/pdf',
      },
    ],
  }),
  uploadFileVersion: async (evidenceId, file) => ({
    evidenceFileId: Date.now(),
    evidenceId: Number(evidenceId),
    versionNo: 2,
    originalFileName: file?.name || 'file_v2.pdf',
    fileSize: file?.size || 2048,
    mimeType: file?.type || 'application/pdf',
  }),
  deleteEvidence: async (evidenceId) => ({ success: true, evidenceId }),
  submitAchievement: async (id, data) => {
    return { ...clone(achievementFixtures.achievementDetailVerified.payload.data), status: 'SUBMITTED', version: (data?.version || 1) + 1 };
  },
  verifyAchievement: async (id, data) => {
    return { ...clone(achievementFixtures.achievementDetailVerified.payload.data), status: 'VERIFIED', version: (data?.version || 1) + 1 };
  },
  requestCorrection: async (id, data) => {
    return { ...clone(achievementFixtures.achievementDetailNeedCorrection.payload.data), status: 'NEED_CORRECTION', latestCorrectionReason: data?.reason, version: (data?.version || 1) + 1 };
  },
  rejectAchievement: async (id, data) => {
    return { ...clone(achievementFixtures.achievementDetailVerified.payload.data), status: 'REJECTED', version: (data?.version || 1) + 1 };
  },
  cancelAchievement: async (id, data) => {
    return { ...clone(achievementFixtures.achievementDetailVerified.payload.data), status: 'CANCELLED', version: (data?.version || 1) + 1 };
  },
  revokeAchievement: async (id, data) => {
    return { ...clone(achievementFixtures.achievementDetailVerified.payload.data), status: 'REVOKED', version: (data?.version || 1) + 1 };
  },
  getAchievementHistory: async (id) => clone(achievementFixtures.achievementHistoryList.payload.data),
  getAchievementSubmissions: async (id) => [
    {
      submissionId: 501,
      revisionNo: 1,
      submittedBy: { userId: 1, displayName: 'PGS.TS. Nguyễn Văn An' },
      submittedAt: '2024-02-20T09:30:00Z',
      frozenFilesCount: 2,
    },
  ],
  fixtures: { achievements: achievementFixtures, awards: awardFixtures },
};
