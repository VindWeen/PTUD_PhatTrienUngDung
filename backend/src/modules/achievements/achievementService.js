import achievementRepository from './achievementRepository.js';
import { getActiveRoles, getActiveScopes, isUnitInUserScope } from '../auth/authRepository.js';
import { recordAuditLog } from '../audit/auditService.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ConcurrencyConflictError,
  ValidationError,
} from '../../utils/errors.js';

export function createAchievementService(repo = achievementRepository) {
  async function listAchievements(user, queryParams = {}) {
    const roles = (await getActiveRoles(user.userId)).map((r) => r.Code);
    const filters = { ...queryParams };

    const isAdmin = roles.includes('ADMIN');
    const isManager = roles.includes('MANAGER');
    const isRecordsOfficer = roles.includes('RECORDS_OFFICER');
    const isUnitRep = roles.includes('UNIT_REPRESENTATIVE');
    const isLecturer = roles.includes('LECTURER');

    // 1. Phân quyền hiển thị danh sách theo vai trò
    if (!isAdmin) {
      const orConditions = [];

      // A. Nếu là Giảng viên: Thấy thành tích cá nhân của chính mình
      let myLecturerId = null;
      if (isLecturer || isManager || isUnitRep) {
        const lecturerProfile = await repo.findLecturerByUserId(user.userId);
        if (lecturerProfile) {
          myLecturerId = lecturerProfile.lecturerId;
          orConditions.push(`a.lecturer_id = ${myLecturerId}`);
        }
      }

      // B. Nếu là Đại diện đơn vị: Thấy thành tích của các đơn vị mình đại diện
      if (isUnitRep) {
        const representedUnitIds = await repo.listUserRepresentedUnitIds(user.userId);
        if (representedUnitIds.length > 0) {
          orConditions.push(`a.unit_id = ANY(ARRAY[${representedUnitIds.join(',')}]::bigint[])`);
        }
      }

      // C. Nếu là Manager hoặc Records Officer: Thấy tất cả hồ sơ có ContextUnitId trong Scope
      if (isManager || isRecordsOfficer) {
        const scopes = await getActiveScopes(user.userId);
        const scopedUnitIds = scopes.map((s) => s.unitId);
        if (scopedUnitIds.length > 0) {
          // Bao gồm cả đơn vị con nếu includeDescendants
          orConditions.push(`a.context_unit_id = ANY(ARRAY[${scopedUnitIds.join(',')}]::bigint[])`);
        }
      }

      if (orConditions.length === 0) {
        // Tài khoản không có vai trò nào được gán -> trả về rỗng
        return { items: [], pagination: { total: 0, page: queryParams.page, pageSize: queryParams.pageSize, totalPages: 0 } };
      }

      filters.scopeCondition = {
        clause: `(${orConditions.join(' OR ')})`,
      };
    }

    const limit = queryParams.pageSize || 10;
    const page = queryParams.page || 1;
    const offset = (page - 1) * limit;

    const { items, total } = await repo.listAchievements({
      filters,
      limit,
      offset,
      sortBy: queryParams.sortBy || 'updatedAt',
      sortOrder: queryParams.sortOrder || 'desc',
    });

    return {
      items,
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async function getAchievementById(user, id) {
    const achievement = await repo.findAchievementById(id);
    if (!achievement) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
    }

    const roles = (await getActiveRoles(user.userId)).map((r) => r.Code);
    const isAdmin = roles.includes('ADMIN');

    if (isAdmin) {
      return achievement;
    }

    // 1. Kiểm tra chính chủ cá nhân
    if (achievement.subjectType === 'LECTURER' && achievement.lecturer?.userId === user.userId) {
      return achievement;
    }

    // 2. Kiểm tra đại diện đơn vị tập thể
    if (achievement.subjectType === 'UNIT' && achievement.organizationUnitId) {
      const isRep = await repo.findActiveRepresentative(user.userId, achievement.organizationUnitId);
      if (isRep) return achievement;
    }

    // 3. Kiểm tra phạm vi quản lý (MANAGER / RECORDS_OFFICER) theo ContextUnitId
    for (const roleCode of ['MANAGER', 'RECORDS_OFFICER']) {
      if (roles.includes(roleCode)) {
        const inScope = await isUnitInUserScope(user.userId, achievement.contextUnitId, roleCode);
        if (inScope) return achievement;
      }
    }

    throw new ForbiddenError('Bạn không có quyền xem thông tin hồ sơ thành tích này');
  }

  async function createAchievement(user, payload) {
    let lecturerId = null;
    let organizationUnitId = null;
    let contextUnitId = null;

    if (payload.subjectType === 'LECTURER') {
      const lecturer = await repo.findLecturerByUserId(user.userId);
      if (!lecturer) {
        throw new ForbiddenError('Tài khoản của bạn chưa được liên kết hồ sơ giảng viên để kê khai thành tích cá nhân');
      }
      lecturerId = lecturer.lecturerId;
      organizationUnitId = null;

      // Tự động gán ContextUnitId là đơn vị công tác chính của giảng viên lúc tạo
      if (!lecturer.primaryUnitId) {
        throw new ValidationError('Giảng viên chưa được chỉ định đơn vị công tác chính để xác định ContextUnitId');
      }
      contextUnitId = lecturer.primaryUnitId;
    } else if (payload.subjectType === 'UNIT') {
      if (!payload.organizationUnitId) {
        throw new ValidationError('Vui lòng chọn đơn vị cho thành tích tập thể');
      }

      // Nghiệm thu: Kiểm tra đại diện đúng hạn
      const activeRep = await repo.findActiveRepresentative(user.userId, payload.organizationUnitId);
      if (!activeRep) {
        throw new ForbiddenError(
          `Bạn không có phân công đại diện còn hiệu lực cho đơn vị #${payload.organizationUnitId} để tạo thành tích tập thể`
        );
      }

      organizationUnitId = payload.organizationUnitId;
      lecturerId = null;
      contextUnitId = payload.organizationUnitId; // ContextUnit của tập thể chính là đơn vị đó
    } else {
      throw new ValidationError('Loại chủ thể không hợp lệ (chỉ chấp nhận LECTURER hoặc UNIT)');
    }

    const created = await repo.createAchievement({
      lecturerId,
      organizationUnitId,
      contextUnitId,
      achievementTypeId: payload.achievementTypeId,
      title: payload.title,
      description: payload.description,
      contributionRole: payload.contributionRole,
      startDate: payload.startDate,
      endDate: payload.endDate,
      recognitionYear: payload.recognitionYear,
      academicYearId: payload.academicYearId,
      createdBy: user.userId,
    });

    const fullRecord = await repo.findAchievementById(created.achievementId);

    // Ghi nhật ký kiểm toán
    await recordAuditLog({
      userId: user.userId,
      action: 'ACHIEVEMENT_CREATE',
      entityName: 'achievements',
      entityId: created.achievementId,
      newValues: fullRecord,
    });

    return fullRecord;
  }

  async function updateAchievement(user, id, payload) {
    const existing = await repo.findAchievementById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
    }

    // Nghiệm thu: Chỉ được sửa khi đang ở DRAFT hoặc NEED_CORRECTION
    if (!['DRAFT', 'NEED_CORRECTION'].includes(existing.status)) {
      throw new ConflictError(
        `Không thể chỉnh sửa hồ sơ đang ở trạng thái [${existing.status}]. Chỉ hồ sơ [DRAFT] hoặc [NEED_CORRECTION] mới được phép sửa.`
      );
    }

    // Kiểm tra quyền sửa
    const roles = (await getActiveRoles(user.userId)).map((r) => r.Code);
    const isAdmin = roles.includes('ADMIN');

    if (!isAdmin) {
      if (existing.subjectType === 'LECTURER') {
        if (existing.lecturer?.userId !== user.userId) {
          throw new ForbiddenError('Chỉ chủ hồ sơ giảng viên mới được phép chỉnh sửa thành tích này');
        }
      } else if (existing.subjectType === 'UNIT') {
        const activeRep = await repo.findActiveRepresentative(user.userId, existing.organizationUnitId);
        if (!activeRep) {
          throw new ForbiddenError('Chỉ người đại diện đơn vị còn hiệu lực mới được phép chỉnh sửa thành tích tập thể này');
        }
      }
    }

    // Khóa các trường nhạy cảm khỏi PATCH trái phép
    const safeUpdates = {
      title: payload.title,
      description: payload.description,
      contributionRole: payload.contributionRole,
      startDate: payload.startDate,
      endDate: payload.endDate,
      recognitionYear: payload.recognitionYear,
      academicYearId: payload.academicYearId,
      achievementTypeId: payload.achievementTypeId,
    };

    // Loại bỏ các trường undefined
    Object.keys(safeUpdates).forEach((key) => {
      if (safeUpdates[key] === undefined) delete safeUpdates[key];
    });

    // Thực hiện cập nhật đồng thời với kiểm tra version
    const updated = await repo.updateAchievement(id, payload.version, safeUpdates);
    if (!updated) {
      throw new ConcurrencyConflictError(
        'Hồ sơ thành tích đã bị thay đổi bởi phiên làm việc khác hoặc số phiên bản (version) không khớp. Vui lòng làm mới trang.'
      );
    }

    const fullRecord = await repo.findAchievementById(id);

    // Ghi nhật ký kiểm toán
    await recordAuditLog({
      userId: user.userId,
      action: 'ACHIEVEMENT_UPDATE',
      entityName: 'achievements',
      entityId: id,
      oldValues: existing,
      newValues: fullRecord,
    });

    return fullRecord;
  }

  async function deleteAchievement(user, id) {
    const existing = await repo.findAchievementById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
    }

    // Nghiệm thu: "chỉ nháp chưa gửi được xóa"
    if (existing.status !== 'DRAFT') {
      throw new ConflictError(
        `Không thể xóa hồ sơ ở trạng thái [${existing.status}]. Quy tắc hệ thống chỉ cho phép xóa hồ sơ Bản nháp (DRAFT) chưa từng gửi duyệt.`
      );
    }

    // Kiểm tra quyền xóa
    const roles = (await getActiveRoles(user.userId)).map((r) => r.Code);
    const isAdmin = roles.includes('ADMIN');

    if (!isAdmin) {
      if (existing.subjectType === 'LECTURER') {
        if (existing.lecturer?.userId !== user.userId) {
          throw new ForbiddenError('Chỉ người tạo hoặc chủ sở hữu hồ sơ mới được quyền xóa bản nháp này');
        }
      } else if (existing.subjectType === 'UNIT') {
        const activeRep = await repo.findActiveRepresentative(user.userId, existing.organizationUnitId);
        if (!activeRep) {
          throw new ForbiddenError('Chỉ đại diện đơn vị còn hiệu lực mới được quyền xóa bản nháp thành tích tập thể này');
        }
      }
    }

    const deleted = await repo.deleteAchievement(id);
    if (!deleted) {
      throw new ConflictError('Không thể xóa bản ghi thành tích');
    }

    // Ghi nhật ký kiểm toán
    await recordAuditLog({
      userId: user.userId,
      action: 'ACHIEVEMENT_DELETE',
      entityName: 'achievements',
      entityId: id,
      oldValues: existing,
    });

    return { message: 'Đã xóa bản nháp thành tích thành công' };
  }

  return {
    listAchievements,
    getAchievementById,
    createAchievement,
    updateAchievement,
    deleteAchievement,
  };
}

export default createAchievementService();
