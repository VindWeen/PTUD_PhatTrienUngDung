import achievementRepository from './achievementRepository.js';
import { getActiveRoles, getActiveScopes, isUnitInUserScope } from '../auth/authRepository.js';
import { recordAuditLog } from '../audit/auditService.js';
import { notifyStatusChanged } from '../notifications/notificationService.js';
import storage from '../evidences/storage/localStorageAdapter.js';
import { withTransaction } from '../../utils/dbHelper.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ConcurrencyConflictError,
  ValidationError,
  SelfApprovalError,
  OutOfScopeError,
} from '../../utils/errors.js';

export function createAchievementService(
  repo = achievementRepository,
  {
    roles = getActiveRoles,
    scope = isUnitInUserScope,
    adapter = storage,
    notify = notifyStatusChanged,
  } = {}
) {
  async function getUserRoles(user) {
    if (user?.userId) {
      try {
        const active = await roles(user.userId);
        if (Array.isArray(active)) {
          return active.map((r) => (typeof r === 'string' ? r : r.Code || r.code));
        }
      } catch (err) {}
    }
    if (Array.isArray(user?.roles)) {
      return user.roles.map((r) => (typeof r === 'string' ? r : r.code || r.Code));
    }
    return [];
  }

  async function listAchievements(user, queryParams = {}) {
    const roles = await getUserRoles(user);
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

  /**
   * W2-Q3: Gửi duyệt hồ sơ thành tích (DRAFT hoặc NEED_CORRECTION -> SUBMITTED)
   * Yêu cầu: Đủ dữ liệu, ít nhất 1 file, snapshot nội dung/phiên bản file, transaction ghi trạng thái/history/audit/notification, UPDATE với id+version+status
   */
  async function submitAchievement(user, id, payload) {
    const existing = await repo.findAchievementById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
    }

    if (!['DRAFT', 'NEED_CORRECTION'].includes(existing.status)) {
      throw new ConflictError(
        `Không thể nộp hồ sơ đang ở trạng thái [${existing.status}]. Chỉ hồ sơ [DRAFT] hoặc [NEED_CORRECTION] mới được phép nộp duyệt.`
      );
    }

    if (existing.subjectType === 'LECTURER') {
      if (existing.lecturer?.userId !== user.userId) {
        throw new ForbiddenError('Chỉ giảng viên chủ hồ sơ mới được phép nộp duyệt thành tích cá nhân');
      }
    } else if (existing.subjectType === 'UNIT') {
      const activeRep = await repo.findActiveRepresentative(user.userId, existing.organizationUnitId);
      if (!activeRep) {
        throw new ForbiddenError('Chỉ đại diện đơn vị còn hiệu lực mới được phép nộp duyệt thành tích tập thể này');
      }
    }

    if (!existing.title || !existing.recognitionYear || !existing.achievementTypeId) {
      throw new ValidationError('Hồ sơ thành tích chưa điền đủ các thông tin bắt buộc');
    }

    const preflightEvidences = await repo.getActiveEvidencesWithFiles(id);
    if (!preflightEvidences || preflightEvidences.length === 0) {
      throw new ValidationError(
        'Hồ sơ thành tích phải có ít nhất một minh chứng kèm tệp tin đính kèm trước khi gửi duyệt'
      );
    }

    return await withTransaction(async ({ client }) => {
      const locked = await repo.findAchievementForUpdate(client, id);
      if (!locked) {
        throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
      }

      if (!['DRAFT', 'NEED_CORRECTION'].includes(locked.status)) {
        throw new ConflictError(`Trạng thái hồ sơ đã thay đổi thành [${locked.status}]. Không thể nộp.`);
      }

      if (Number(locked.version) !== Number(payload.version)) {
        throw new ConcurrencyConflictError(
          'Hồ sơ thành tích đã bị thay đổi bởi phiên làm việc khác hoặc version không khớp. Vui lòng làm mới trang.'
        );
      }

      // W2-Q4: Đọc danh sách minh chứng và tệp tin BÊN TRONG transaction sau khi đã khóa dòng
      const evidencesWithFiles = await repo.getActiveEvidencesWithFiles(id, client);
      if (!evidencesWithFiles || evidencesWithFiles.length === 0) {
        throw new ValidationError(
          'Hồ sơ thành tích phải có ít nhất một minh chứng kèm tệp tin đính kèm trước khi gửi duyệt'
        );
      }

      // W2-Q4: Kiểm tra tệp tin vật lý trong kho lưu trữ private trước khi đóng băng snapshot
      for (const ev of evidencesWithFiles) {
        const fileExists = await adapter.fileExists(ev.storageKey);
        if (!fileExists) {
          throw new ValidationError(
            `Tệp tin minh chứng "${ev.originalFileName}" không tồn tại trên hệ thống lưu trữ`
          );
        }
      }

      const currentVersion = Number(locked.version);
      const newVersion = currentVersion + 1;
      const fromStatus = locked.status;

      const revRes = await client.query(
        `SELECT COALESCE(MAX(revision_no), 0) + 1 AS next_rev FROM app.achievement_submissions WHERE achievement_id = $1`,
        [id]
      );
      const revisionNo = Number(revRes.rows[0].next_rev);

      const note = payload.note || payload.submitNote || null;
      const snapshotData = {
        achievementId: id,
        revisionNo,
        subjectType: locked.subjectType,
        lecturerId: locked.lecturer_id ? Number(locked.lecturer_id) : null,
        unitId: locked.unit_id ? Number(locked.unit_id) : null,
        contextUnitId: Number(locked.context_unit_id),
        achievementTypeId: Number(locked.achievement_type_id),
        title: locked.title,
        description: locked.description,
        contributionRole: locked.contribution_role,
        startDate: locked.start_date,
        endDate: locked.end_date,
        recognitionYear: Number(locked.recognition_year),
        academicYearId: locked.academic_year_id ? Number(locked.academic_year_id) : null,
        note,
        submittedBy: {
          userId: user.userId,
          email: user.email,
        },
        submittedAt: new Date().toISOString(),
        evidences: evidencesWithFiles.map((ev) => ({
          evidenceId: Number(ev.evidenceId),
          title: ev.title,
          description: ev.description,
          file: {
            evidenceFileId: Number(ev.evidenceFileId),
            versionNo: Number(ev.versionNo),
            originalFileName: ev.originalFileName,
            storageKey: ev.storageKey,
            mimeType: ev.mimeType,
            fileSize: Number(ev.fileSize),
            sha256Hash: ev.sha256Hash,
            uploadedAt: ev.uploadedAt,
          },
        })),
      };

      const submission = await repo.createSubmission(client, {
        achievementId: id,
        revisionNo,
        snapshotData,
        submittedBy: user.userId,
      });

      const fileIds = evidencesWithFiles.map((ev) => Number(ev.evidenceFileId));
      await repo.linkSubmissionEvidenceFiles(client, submission.submissionId, fileIds);

      const updated = await repo.updateAchievementStatus(client, id, currentVersion, fromStatus, 'SUBMITTED', {
        submittedBy: user.userId,
        submittedAt: new Date(),
      });

      if (!updated) {
        throw new ConcurrencyConflictError(
          'Xung đột đồng thời khi cập nhật trạng thái nộp hồ sơ. Vui lòng làm mới trang.'
        );
      }

      await repo.recordStatusHistory(client, {
        achievementId: id,
        submissionId: submission.submissionId,
        fromStatus,
        toStatus: 'SUBMITTED',
        actorId: user.userId,
        reason: payload.note || null,
      });

      await recordAuditLog({
        client,
        throwOnError: true,
        userId: user.userId,
        action: 'ACHIEVEMENT_SUBMIT',
        entityName: 'achievements',
        entityId: id,
        oldValues: { status: fromStatus, version: currentVersion },
        newValues: { status: 'SUBMITTED', version: newVersion, revisionNo },
      });

      await notify(client, {
        entityType: 'ACHIEVEMENT',
        entityId: id,
        version: newVersion,
        fromStatus,
        toStatus: 'SUBMITTED',
      });

      return await repo.findAchievementById(id, client);
    });
  }

  /**
   * W2-Q3: Xác nhận hồ sơ thành tích (SUBMITTED -> VERIFIED)
   * Yêu cầu: Manager có Scope, cấm tự duyệt, transaction cùng pg client, UPDATE với id+version+status trả 409
   */
  async function verifyAchievement(user, id, payload) {
    const existing = await repo.findAchievementById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
    }

    if (existing.status !== 'SUBMITTED') {
      throw new ConflictError(
        `Không thể xác nhận hồ sơ đang ở trạng thái [${existing.status}]. Chỉ hồ sơ [SUBMITTED] mới được phép thẩm định.`
      );
    }

    // 1. Quy tắc CẤM TỰ DUYỆT (Self-Approval Prohibited):
    if (existing.subjectType === 'LECTURER' && existing.lecturer?.userId === user.userId) {
      throw new SelfApprovalError('Quy tắc liêm chính: Giảng viên không được phép tự thẩm định hồ sơ thành tích của chính mình');
    }

    if (existing.createdBy === user.userId) {
      throw new SelfApprovalError('Quy tắc liêm chính: Cán bộ không được phép thẩm định hồ sơ do chính mình khởi tạo');
    }

    if (existing.submittedBy === user.userId) {
      throw new SelfApprovalError('Quy tắc liêm chính: Cán bộ không được phép thẩm định hồ sơ do chính mình nộp duyệt');
    }

    if (repo.findLecturerByUserId) {
      const userLecturer = await repo.findLecturerByUserId(user.userId);
      if (userLecturer && existing.lecturerId && userLecturer.lecturerId === existing.lecturerId) {
        throw new SelfApprovalError('Quy tắc liêm chính: Giảng viên không được phép tự thẩm định hồ sơ thành tích của chính mình');
      }
    }

    // 2. Phân quyền: Phải có vai trò MANAGER đang hiệu lực trong phạm vi Scope
    const roles = await getUserRoles(user);
    if (!roles.includes('MANAGER')) {
      throw new ForbiddenError('Chỉ cán bộ có vai trò MANAGER mới có thẩm quyền xác nhận hồ sơ thành tích');
    }

    const inScope = await scope(user.userId, existing.contextUnitId, 'MANAGER');
    if (!inScope) {
      throw new OutOfScopeError('Hồ sơ thành tích này nằm ngoài phạm vi đơn vị được phân công quản lý của bạn');
    }

    // 3. Thực thi Transaction CÙNG PG CLIENT
    return await withTransaction(async ({ client }) => {
      const locked = await repo.findAchievementForUpdate(client, id);
      if (!locked) {
        throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
      }

      if (locked.status !== 'SUBMITTED') {
        throw new ConflictError(`Trạng thái hồ sơ đã thay đổi thành [${locked.status}]. Không thể xác nhận.`);
      }

      if (Number(locked.version) !== Number(payload.version)) {
        throw new ConcurrencyConflictError(
          'Hồ sơ thành tích đã bị thay đổi bởi phiên làm việc khác hoặc version không khớp. Vui lòng làm mới trang.'
        );
      }

      const currentVersion = Number(locked.version);
      const newVersion = currentVersion + 1;

      const updated = await repo.updateAchievementStatus(client, id, currentVersion, 'SUBMITTED', 'VERIFIED', {
        verifiedBy: user.userId,
        verifiedAt: new Date(),
      });

      if (!updated) {
        throw new ConcurrencyConflictError(
          'Xung đột đồng thời khi cập nhật trạng thái xác nhận hồ sơ. Vui lòng làm mới trang.'
        );
      }

      await repo.recordStatusHistory(client, {
        achievementId: id,
        submissionId: null,
        fromStatus: 'SUBMITTED',
        toStatus: 'VERIFIED',
        actorId: user.userId,
        reason: payload.note || 'Xác nhận đạt chuẩn hồ sơ thành tích',
      });

      await recordAuditLog({
        client,
        throwOnError: true,
        userId: user.userId,
        action: 'ACHIEVEMENT_VERIFY',
        entityName: 'achievements',
        entityId: id,
        oldValues: { status: 'SUBMITTED', version: currentVersion },
        newValues: { status: 'VERIFIED', version: newVersion },
      });

      await notify(client, {
        entityType: 'ACHIEVEMENT',
        entityId: id,
        version: newVersion,
        fromStatus: 'SUBMITTED',
        toStatus: 'VERIFIED',
      });

      return await repo.findAchievementById(id, client);
    });
  }

  /**
   * W2-Q3: Yêu cầu bổ sung hồ sơ thành tích (SUBMITTED -> NEED_CORRECTION)
   */
  async function requestCorrection(user, id, payload) {
    const existing = await repo.findAchievementById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
    }

    if (existing.status !== 'SUBMITTED') {
      throw new ConflictError(
        `Không thể yêu cầu bổ sung hồ sơ đang ở trạng thái [${existing.status}]. Chỉ hồ sơ [SUBMITTED] mới có thể yêu cầu bổ sung.`
      );
    }

    // 1. Quy tắc CẤM TỰ DUYỆT (Self-Approval Prohibited):
    if (existing.subjectType === 'LECTURER' && existing.lecturer?.userId === user.userId) {
      throw new SelfApprovalError('Quy tắc liêm chính: Giảng viên không được thao tác trên hồ sơ của chính mình');
    }
    if (existing.createdBy === user.userId) {
      throw new SelfApprovalError('Quy tắc liêm chính: Cán bộ không được phép thao tác trên hồ sơ do chính mình khởi tạo');
    }
    if (existing.submittedBy === user.userId) {
      throw new SelfApprovalError('Quy tắc liêm chính: Cán bộ không được phép thao tác trên hồ sơ do chính mình nộp duyệt');
    }
    if (repo.findLecturerByUserId) {
      const userLecturer = await repo.findLecturerByUserId(user.userId);
      if (userLecturer && existing.lecturerId && userLecturer.lecturerId === existing.lecturerId) {
        throw new SelfApprovalError('Quy tắc liêm chính: Giảng viên không được thao tác trên hồ sơ của chính mình');
      }
    }

    // 2. Phân quyền: Phải có vai trò MANAGER đang hiệu lực trong phạm vi Scope
    const roles = await getUserRoles(user);
    if (!roles.includes('MANAGER')) {
      throw new ForbiddenError('Chỉ cán bộ có vai trò MANAGER mới có quyền yêu cầu bổ sung hồ sơ');
    }

    const inScope = await scope(user.userId, existing.contextUnitId, 'MANAGER');
    if (!inScope) {
      throw new OutOfScopeError('Hồ sơ nằm ngoài phạm vi đơn vị được phân công quản lý của bạn');
    }

    return await withTransaction(async ({ client }) => {
      const locked = await repo.findAchievementForUpdate(client, id);
      if (!locked || locked.status !== 'SUBMITTED' || Number(locked.version) !== Number(payload.version)) {
        throw new ConcurrencyConflictError('Hồ sơ đã bị thay đổi bởi phiên làm việc khác. Vui lòng làm mới trang.');
      }

      const currentVersion = Number(locked.version);
      const newVersion = currentVersion + 1;

      const updated = await repo.updateAchievementStatus(client, id, currentVersion, 'SUBMITTED', 'NEED_CORRECTION');
      if (!updated) {
        throw new ConcurrencyConflictError('Xung đột đồng thời khi yêu cầu bổ sung hồ sơ.');
      }

      await repo.recordStatusHistory(client, {
        achievementId: id,
        fromStatus: 'SUBMITTED',
        toStatus: 'NEED_CORRECTION',
        actorId: user.userId,
        reason: payload.reason,
      });

      await recordAuditLog({
        client,
        throwOnError: true,
        userId: user.userId,
        action: 'ACHIEVEMENT_REQUEST_CORRECTION',
        entityName: 'achievements',
        entityId: id,
        oldValues: { status: 'SUBMITTED', version: currentVersion },
        newValues: { status: 'NEED_CORRECTION', version: newVersion, reason: payload.reason },
      });

      await notify(client, {
        entityType: 'ACHIEVEMENT',
        entityId: id,
        version: newVersion,
        fromStatus: 'SUBMITTED',
        toStatus: 'NEED_CORRECTION',
      });

      return await repo.findAchievementById(id, client);
    });
  }

  /**
   * W2-Q3: Từ chối hồ sơ thành tích (SUBMITTED -> REJECTED)
   */
  async function rejectAchievement(user, id, payload) {
    const existing = await repo.findAchievementById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
    }

    if (existing.status !== 'SUBMITTED') {
      throw new ConflictError(
        `Không thể từ chối hồ sơ đang ở trạng thái [${existing.status}]. Chỉ hồ sơ [SUBMITTED] mới có thể từ chối.`
      );
    }

    // 1. Quy tắc CẤM TỰ DUYỆT (Self-Approval Prohibited):
    if (existing.subjectType === 'LECTURER' && existing.lecturer?.userId === user.userId) {
      throw new SelfApprovalError('Quy tắc liêm chính: Giảng viên không được thao tác trên hồ sơ của chính mình');
    }
    if (existing.createdBy === user.userId) {
      throw new SelfApprovalError('Quy tắc liêm chính: Cán bộ không được phép thao tác trên hồ sơ do chính mình khởi tạo');
    }
    if (existing.submittedBy === user.userId) {
      throw new SelfApprovalError('Quy tắc liêm chính: Cán bộ không được phép thao tác trên hồ sơ do chính mình nộp duyệt');
    }
    if (repo.findLecturerByUserId) {
      const userLecturer = await repo.findLecturerByUserId(user.userId);
      if (userLecturer && existing.lecturerId && userLecturer.lecturerId === existing.lecturerId) {
        throw new SelfApprovalError('Quy tắc liêm chính: Giảng viên không được thao tác trên hồ sơ của chính mình');
      }
    }

    // 2. Phân quyền: Phải có vai trò MANAGER đang hiệu lực trong phạm vi Scope
    const roles = await getUserRoles(user);
    if (!roles.includes('MANAGER')) {
      throw new ForbiddenError('Chỉ cán bộ có vai trò MANAGER mới có quyền từ chối hồ sơ');
    }

    const inScope = await scope(user.userId, existing.contextUnitId, 'MANAGER');
    if (!inScope) {
      throw new OutOfScopeError('Hồ sơ nằm ngoài phạm vi đơn vị được phân công quản lý của bạn');
    }

    return await withTransaction(async ({ client }) => {
      const locked = await repo.findAchievementForUpdate(client, id);
      if (!locked || locked.status !== 'SUBMITTED' || Number(locked.version) !== Number(payload.version)) {
        throw new ConcurrencyConflictError('Hồ sơ đã bị thay đổi bởi phiên làm việc khác. Vui lòng làm mới trang.');
      }

      const currentVersion = Number(locked.version);
      const newVersion = currentVersion + 1;

      const updated = await repo.updateAchievementStatus(client, id, currentVersion, 'SUBMITTED', 'REJECTED');
      if (!updated) {
        throw new ConcurrencyConflictError('Xung đột đồng thời khi từ chối hồ sơ.');
      }

      await repo.recordStatusHistory(client, {
        achievementId: id,
        fromStatus: 'SUBMITTED',
        toStatus: 'REJECTED',
        actorId: user.userId,
        reason: payload.reason,
      });

      await recordAuditLog({
        client,
        throwOnError: true,
        userId: user.userId,
        action: 'ACHIEVEMENT_REJECT',
        entityName: 'achievements',
        entityId: id,
        oldValues: { status: 'SUBMITTED', version: currentVersion },
        newValues: { status: 'REJECTED', version: newVersion, reason: payload.reason },
      });

      await notify(client, {
        entityType: 'ACHIEVEMENT',
        entityId: id,
        version: newVersion,
        fromStatus: 'SUBMITTED',
        toStatus: 'REJECTED',
      });

      return await repo.findAchievementById(id, client);
    });
  }

  /**
   * W2-Q3: Hủy hồ sơ thành tích (DRAFT, SUBMITTED hoặc NEED_CORRECTION -> CANCELLED)
   */
  async function cancelAchievement(user, id, payload) {
    const existing = await repo.findAchievementById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
    }

    if (!['DRAFT', 'SUBMITTED', 'NEED_CORRECTION'].includes(existing.status)) {
      throw new ConflictError(
        `Không thể hủy hồ sơ đang ở trạng thái [${existing.status}]. Chỉ hồ sơ DRAFT, SUBMITTED hoặc NEED_CORRECTION mới được hủy.`
      );
    }

    if (existing.subjectType === 'LECTURER') {
      if (existing.lecturer?.userId !== user.userId) {
        throw new ForbiddenError('Chỉ chủ sở hữu hồ sơ mới được quyền hủy hồ sơ này');
      }
    } else if (existing.subjectType === 'UNIT') {
      const activeRep = await repo.findActiveRepresentative(user.userId, existing.organizationUnitId);
      if (!activeRep) {
        throw new ForbiddenError('Chỉ đại diện đơn vị còn hiệu lực mới được quyền hủy hồ sơ tập thể này');
      }
    }

    return await withTransaction(async ({ client }) => {
      const locked = await repo.findAchievementForUpdate(client, id);
      if (!locked || !['DRAFT', 'SUBMITTED', 'NEED_CORRECTION'].includes(locked.status) || Number(locked.version) !== Number(payload.version)) {
        throw new ConcurrencyConflictError('Hồ sơ đã bị thay đổi bởi phiên làm việc khác. Vui lòng làm mới trang.');
      }

      const currentVersion = Number(locked.version);
      const newVersion = currentVersion + 1;
      const fromStatus = locked.status;

      const updated = await repo.updateAchievementStatus(client, id, currentVersion, fromStatus, 'CANCELLED');
      if (!updated) {
        throw new ConcurrencyConflictError('Xung đột đồng thời khi hủy hồ sơ.');
      }

      await repo.recordStatusHistory(client, {
        achievementId: id,
        fromStatus,
        toStatus: 'CANCELLED',
        actorId: user.userId,
        reason: payload.reason || 'Người dùng tự hủy hồ sơ',
      });

      await recordAuditLog({
        client,
        throwOnError: true,
        userId: user.userId,
        action: 'ACHIEVEMENT_CANCEL',
        entityName: 'achievements',
        entityId: id,
        oldValues: { status: fromStatus, version: currentVersion },
        newValues: { status: 'CANCELLED', version: newVersion },
      });

      await notify(client, {
        entityType: 'ACHIEVEMENT',
        entityId: id,
        version: newVersion,
        fromStatus,
        toStatus: 'CANCELLED',
      });

      return await repo.findAchievementById(id, client);
    });
  }

  /**
   * W2-Q3: Thu hồi xác nhận thành tích (VERIFIED -> REVOKED)
   */
  async function revokeAchievement(user, id, payload) {
    const existing = await repo.findAchievementById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ thành tích với ID #${id}`);
    }

    if (existing.status !== 'VERIFIED') {
      throw new ConflictError(
        `Không thể thu hồi hồ sơ đang ở trạng thái [${existing.status}]. Chỉ hồ sơ [VERIFIED] mới có thể thu hồi.`
      );
    }

    const roles = (await getActiveRoles(user.userId)).map((r) => r.Code);
    if (!roles.includes('MANAGER')) {
      throw new ForbiddenError('Chỉ cán bộ có vai trò MANAGER mới có quyền thu hồi hồ sơ');
    }

    const inScope = await isUnitInUserScope(user.userId, existing.contextUnitId, 'MANAGER');
    if (!inScope) {
      throw new OutOfScopeError('Hồ sơ nằm ngoài phạm vi đơn vị được phân công quản lý của bạn');
    }

    return await withTransaction(async ({ client }) => {
      const locked = await repo.findAchievementForUpdate(client, id);
      if (!locked || locked.status !== 'VERIFIED' || Number(locked.version) !== Number(payload.version)) {
        throw new ConcurrencyConflictError('Hồ sơ đã bị thay đổi bởi phiên làm việc khác. Vui lòng làm mới trang.');
      }

      const currentVersion = Number(locked.version);
      const newVersion = currentVersion + 1;

      const updated = await repo.updateAchievementStatus(client, id, currentVersion, 'VERIFIED', 'REVOKED');
      if (!updated) {
        throw new ConcurrencyConflictError('Xung đột đồng thời khi thu hồi hồ sơ.');
      }

      await repo.recordStatusHistory(client, {
        achievementId: id,
        fromStatus: 'VERIFIED',
        toStatus: 'REVOKED',
        actorId: user.userId,
        reason: payload.reason,
      });

      await recordAuditLog({
        client,
        throwOnError: true,
        userId: user.userId,
        action: 'ACHIEVEMENT_REVOKE',
        entityName: 'achievements',
        entityId: id,
        oldValues: { status: 'VERIFIED', version: currentVersion },
        newValues: { status: 'REVOKED', version: newVersion, reason: payload.reason },
      });

      await notify(client, {
        entityType: 'ACHIEVEMENT',
        entityId: id,
        version: newVersion,
        fromStatus: 'VERIFIED',
        toStatus: 'REVOKED',
      });

      return await repo.findAchievementById(id, client);
    });
  }

  /**
   * W2-Q3: Xem lịch sử chuyển trạng thái
   */
  async function getAchievementHistory(user, id) {
    await getAchievementById(user, id);
    const histories = await repo.listHistories(id);
    return { achievementId: id, histories };
  }

  /**
   * W2-Q3: Xem danh sách các lần nộp hồ sơ
   */
  async function getAchievementSubmissions(user, id) {
    await getAchievementById(user, id);
    const submissions = await repo.listSubmissions(id);
    return { achievementId: id, submissions };
  }

  return {
    listAchievements,
    getAchievementById,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    submitAchievement,
    verifyAchievement,
    requestCorrection,
    rejectAchievement,
    cancelAchievement,
    revokeAchievement,
    getAchievementHistory,
    getAchievementSubmissions,
  };
}

export class AchievementService {
  constructor({
    repository = achievementRepository,
    roles = getActiveRoles,
    scope = isUnitInUserScope,
    adapter = storage,
    notify = notifyStatusChanged,
  } = {}) {
    Object.assign(this, createAchievementService(repository, { roles, scope, adapter, notify }));
  }
}

export default createAchievementService();
