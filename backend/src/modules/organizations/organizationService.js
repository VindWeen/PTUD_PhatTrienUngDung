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

  return {
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
