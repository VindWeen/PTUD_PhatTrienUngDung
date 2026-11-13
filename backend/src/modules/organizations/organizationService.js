
import { evaluateStructuredCriterion } from '../ai/criteriaEvaluator.js';
import { getActiveRoles, getLecturerProfile } from '../auth/authRepository.js';
import { ForbiddenError } from '../../utils/errors.js';

import organizationRepository from './organizationRepository.js';
import { ConflictError, ConcurrencyConflictError, NotFoundError } from '../../utils/errors.js';
import { recordAuditLog } from '../audit/auditService.js';

export function createOrganizationService(repository = organizationRepository) {
  async function getUnitProfile(unitId) {
    const unit = await repository.findUnit(unitId);
    if (!unit) throw new NotFoundError('Không tìm thấy đơn vị');
    const [representative, aggregate] = await Promise.all([
      repository.getCurrentRepresentative(unitId), repository.getUnitStats(unitId),
    ]);
    const { lecturersCount, ...stats } = aggregate;
    return {
      ...unit,
      parentUnit: unit.parentId ? { unitId: unit.parentId, code: unit.parentCode, name: unit.parentName } : null,
      representative,
      lecturersCount,
      stats,
    };
  }

  async function ensureParent(unitId, parentId) {
    if (parentId == null) return;
    if (Number(unitId) === Number(parentId) || await repository.hasDescendant(unitId, parentId)) {
      throw new ConflictError('Không thể chọn chính đơn vị hoặc đơn vị con làm đơn vị cha', 'ORGANIZATION_CYCLE');
    }
    if (!await repository.findUnit(parentId)) throw new NotFoundError('Không tìm thấy đơn vị cha');
  }

  async function createUnit(payload, assignedBy = null) {
    const unit = await repository.createUnit(payload);
    await recordAuditLog({
      userId: assignedBy,
      action: 'ORGANIZATION_CREATE',
      entityName: 'organizations',
      entityId: unit?.unitId,
      newValues: unit,
    });
    return unit;
  }

  async function updateUnit(unitId, payload, assignedBy = null) {
    const current = await repository.findUnit(unitId);
    if (!current) throw new NotFoundError('Không tìm thấy đơn vị');
    await ensureParent(unitId, payload.parentId);
    const result = await repository.updateUnit(unitId, payload.version, payload);
    if (!result) throw new ConcurrencyConflictError();
    await recordAuditLog({
      userId: assignedBy,
      action: 'ORGANIZATION_UPDATE',
      entityName: 'organizations',
      entityId: unitId,
      oldValues: current,
      newValues: result,
    });
    return result;
  }

  async function removeUnit(unitId, assignedBy = null) {
    const current = await repository.findUnit(unitId);
    if (!current) throw new NotFoundError('Không tìm thấy đơn vị');
    const dependencies = await repository.getDependencyCounts(unitId);
    if (Object.values(dependencies).some((count) => Number(count) > 0)) {
      throw new ConflictError('Không thể xóa đơn vị đang có dữ liệu hoặc lịch sử liên quan', 'ORGANIZATION_HAS_DATA', [dependencies]);
    }
    await repository.deleteUnit(unitId);
    await recordAuditLog({
      userId: assignedBy,
      action: 'ORGANIZATION_DELETE',
      entityName: 'organizations',
      entityId: unitId,
      oldValues: current,
    });
  }

  async function appointRepresentative(payload, assignedBy) {
    const rep = await repository.appointRepresentative({ ...payload, assignedBy });
    await recordAuditLog({
      userId: assignedBy,
      action: 'ORGANIZATION_APPOINT_REPRESENTATIVE',
      entityName: 'unit_representatives',
      entityId: payload.unitId,
      newValues: rep,
    });
    return rep;
  }

  async function transferLecturer(payload, assignedBy) {
    if (!await repository.findUnit(payload.unitId)) throw new NotFoundError('Không tìm thấy đơn vị nhận công tác');
    const assignment = await repository.transferLecturer({ ...payload, assignedBy });
    if (!assignment) throw new NotFoundError('Không tìm thấy hồ sơ giảng viên');
    await recordAuditLog({
      userId: assignedBy,
      action: 'ORGANIZATION_TRANSFER_LECTURER',
      entityName: 'lecturer_assignments',
      entityId: payload.lecturerId,
      newValues: assignment,
    });
    return assignment;
  }

  
  async function scanUnitWithAi(unitId, regulationId, user, client = null) {
    unitId = Number(unitId);
    regulationId = Number(regulationId);

    const activeRoles = (user?.activeRoles && user.activeRoles.length)
      ? user.activeRoles
      : (await getActiveRoles(user.userId)).map(r => r.Code);

    const isAdmin = activeRoles.includes('ADMIN');
    const isFacultyLead = activeRoles.includes('FACULTY_LEAD');
    const isDeptHead = activeRoles.includes('DEPARTMENT_HEAD');

    if (!isAdmin && !isFacultyLead && !isDeptHead) {
      throw new ForbiddenError('Yêu cầu một trong các vai trò: DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN');
    }

    const unit = await repository.findUnit(unitId);
    if (!unit) {
      throw new NotFoundError('Không tìm thấy đơn vị');
    }

    if (!isAdmin) {
      const profile = await getLecturerProfile(user.userId);
      const userUnitId = profile?.primaryUnit?.unitId;
      if (!userUnitId) {
        throw new ForbiddenError('Người dùng chưa được phân công đơn vị');
      }

      if (isDeptHead && !isFacultyLead) {
        if (Number(userUnitId) !== Number(unitId)) {
          throw new ForbiddenError('Trưởng Bộ môn chỉ có quyền quét đơn vị bộ môn của mình');
        }
      } else if (isFacultyLead) {
        if (Number(userUnitId) !== Number(unitId)) {
          const isChild = await repository.hasDescendant(userUnitId, unitId);
          if (!isChild) {
            throw new ForbiddenError('Ban Chủ nhiệm Khoa chỉ có quyền quét các đơn vị thuộc khoa của mình');
          }
        }
      }
    }

    const criteria = await repository.getRegulationCriteria(regulationId, client);
    if (!criteria || criteria.length === 0) {
      throw new NotFoundError('Không tìm thấy tiêu chí quy chế để đánh giá');
    }

    const unitIds = await repository.getDescendantUnitIds(unitId, client);
    const members = await repository.getUnitMembers(unitIds, client);

    const asOfDate = new Date().toISOString().slice(0, 10);
    const results = [];

    for (const member of members) {
      const records = await repository.getMemberAchievements(member.lecturer_id, client);
      const matched = [];
      const missing = [];

      for (const crit of criteria) {
        let rules = crit.source_rules || crit.rules || null;
        if (typeof rules === 'string') {
          try { rules = JSON.parse(rules); } catch (_) { rules = null; }
        }

        const evalResult = evaluateStructuredCriterion({
          subject: { subjectType: 'LECTURER', subjectId: member.lecturer_id },
          criterion: {
            ...crit,
            criterionCode: crit.code,
            isConfirmed: true,
          },
          documentVersion: {
            versionId: crit.version_id || 1,
            isConfirmed: true,
            lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
          },
          rules,
          records,
          asOfDate,
        });

        if (evalResult.isSatisfied) {
          matched.push({
            criterionId: crit.criteria_version_id,
            code: crit.code,
            name: crit.name,
          });
        } else {
          missing.push({
            criterionId: crit.criteria_version_id,
            code: crit.code,
            name: crit.name,
            missingCount: evalResult.missingCount || 1,
            unit: crit.unit_metric || 'tiêu chí',
          });
        }
      }

      const totalCriteria = criteria.length;
      const percentage = totalCriteria > 0 ? Math.round((matched.length / totalCriteria) * 100) : 0;
      const isEligible = totalCriteria > 0 && matched.length === totalCriteria;

      results.push({
        userId: member.user_id,
        lecturerId: member.lecturer_id,
        fullName: member.full_name,
        email: member.email,
        unitId: member.unit_id,
        unitName: member.unit_name,
        percentage,
        isEligible,
        matched,
        missing,
      });
    }

    return {
      unitId,
      regulationId,
      totalMembers: members.length,
      eligibleCount: results.filter(r => r.isEligible).length,
      results,
    };
  }

  return {
    scanUnitWithAi,
    listUnits: () => repository.listUnits(),
    getUnitProfile,
    createUnit,
    updateUnit,
    removeUnit,
    appointRepresentative,
    transferLecturer,
  };
}

export default createOrganizationService();
