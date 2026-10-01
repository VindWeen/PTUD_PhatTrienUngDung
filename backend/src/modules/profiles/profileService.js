import profileRepository from './profileRepository.js';
import { ConcurrencyConflictError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { recordAuditLog } from '../audit/auditService.js';

const formatPeriod = (row) => {
  const start = new Date(row.validFrom).getUTCFullYear();
  const end = row.validTo ? new Date(row.validTo).getUTCFullYear() : 'Hiện tại';
  return `${start} – ${end}`;
};

export function createProfileService(repository = profileRepository) {
  async function buildProfile(lecturer) {
    const [history, titlesAndHonors, stats] = await Promise.all([
      repository.getWorkHistory(lecturer.lecturerId),
      repository.getTitlesAndHonors(lecturer.lecturerId),
      repository.getProfileStats(lecturer.lecturerId),
    ]);
    return {
      ...lecturer,
      workHistory: history.map((item) => ({
        ...item,
        period: formatPeriod(item),
        position: [lecturer.title, lecturer.degree].filter(Boolean).join(', ') || 'Giảng viên',
        department: [item.unitName, item.parentUnitName].filter(Boolean).join(', '),
      })),
      titlesAndHonors,
      stats,
    };
  }

  async function getOwnProfile(userId) {
    const ref = await repository.findLecturerByUserId(userId);
    if (!ref) throw new NotFoundError('Tài khoản chưa có hồ sơ giảng viên');
    return getProfile(ref.lecturerId);
  }

  async function getProfile(lecturerId) {
    const lecturer = await repository.findLecturerById(lecturerId);
    if (!lecturer) throw new NotFoundError('Không tìm thấy hồ sơ giảng viên');
    return buildProfile(lecturer);
  }

  async function updateProfile(requesterUserId, lecturerId, payload) {
    const lecturer = await repository.findLecturerById(lecturerId);
    if (!lecturer) throw new NotFoundError('Không tìm thấy hồ sơ giảng viên');
    if (Number(lecturer.userId) !== Number(requesterUserId)) {
      throw new ForbiddenError('Bạn chỉ được sửa hồ sơ cá nhân của chính mình', 'PROFILE_OWNER_REQUIRED');
    }
    const updated = await repository.updateLecturer(lecturerId, payload.version, payload);
    if (!updated) throw new ConcurrencyConflictError();
    await recordAuditLog({
      userId: requesterUserId,
      action: 'PROFILE_UPDATE',
      entityName: 'lecturers',
      entityId: lecturerId,
      oldValues: { title: lecturer.title, degree: lecturer.degree, phone: lecturer.phone, version: lecturer.version },
      newValues: { title: updated.title, degree: updated.degree, phone: updated.phone, version: updated.version },
    });
    return buildProfile(updated);
  }

  return { getOwnProfile, getProfile, updateProfile };
}

export default createProfileService();
