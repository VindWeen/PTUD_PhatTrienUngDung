import organizationRepository from './organizationRepository.js';
import { ConflictError, ConcurrencyConflictError, NotFoundError } from '../../utils/errors.js';

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

  async function updateUnit(unitId, payload) {
    if (!await repository.findUnit(unitId)) throw new NotFoundError('Không tìm thấy đơn vị');
    await ensureParent(unitId, payload.parentId);
    const result = await repository.updateUnit(unitId, payload.version, payload);
    if (!result) throw new ConcurrencyConflictError();
    return result;
  }

  async function removeUnit(unitId) {
    if (!await repository.findUnit(unitId)) throw new NotFoundError('Không tìm thấy đơn vị');
    const dependencies = await repository.getDependencyCounts(unitId);
    if (Object.values(dependencies).some((count) => Number(count) > 0)) {
      throw new ConflictError('Không thể xóa đơn vị đang có dữ liệu hoặc lịch sử liên quan', 'ORGANIZATION_HAS_DATA', [dependencies]);
    }
    await repository.deleteUnit(unitId);
  }

  async function transferLecturer(payload, assignedBy) {
    if (!await repository.findUnit(payload.unitId)) throw new NotFoundError('Không tìm thấy đơn vị nhận công tác');
    const assignment = await repository.transferLecturer({ ...payload, assignedBy });
    if (!assignment) throw new NotFoundError('Không tìm thấy hồ sơ giảng viên');
    return assignment;
  }

  return {
    listUnits: () => repository.listUnits(),
    getUnitProfile,
    createUnit: (payload) => repository.createUnit(payload),
    updateUnit,
    removeUnit,
    appointRepresentative: (payload, assignedBy) => repository.appointRepresentative({ ...payload, assignedBy }),
    transferLecturer,
  };
}

export default createOrganizationService();
