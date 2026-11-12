import crypto from 'crypto';
import { withTransaction } from '../../utils/dbHelper.js';
import * as regulationRepo from './regulationRepository.js';
import { sourceRulesSchema } from './regulationSchemas.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../utils/errors.js';

// Danh sách quyền quản trị quy chế & tiêu chí
const ADMIN_ROLES = ['ADMIN', 'SYSTEM_ADMIN', 'COUNCIL', 'DEPARTMENT_ADMIN', 'MANAGER'];
const APPROVAL_ROLES = ['ADMIN', 'SYSTEM_ADMIN', 'COUNCIL'];

function checkHasRole(userRoles, allowedRoles) {
  const roles = (userRoles || []).map((r) => (typeof r === 'string' ? r : r.code || r.role_code));
  return roles.some((role) => allowedRoles.includes(role));
}

function computeSha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// 1. Quản lý Văn bản gốc
export async function getDocuments(filters, user) {
  return await regulationRepo.listDocuments(null, filters);
}

export async function getDocumentById(documentId) {
  const doc = await regulationRepo.findDocumentById(null, documentId);
  if (!doc) {
    throw new NotFoundError(`Không tìm thấy văn bản quy định với ID #${documentId}`);
  }
  const versions = await regulationRepo.listVersionsByDocumentId(null, documentId);
  return { ...doc, versions };
}

export async function createDocument(data, user) {
  if (!checkHasRole(user.roles, ADMIN_ROLES)) {
    throw new ForbiddenError('Chỉ Quản trị viên hệ thống hoặc Hội đồng mới có quyền tạo văn bản quy chế');
  }

  const existing = await regulationRepo.findDocumentByCode(null, data.documentCode);
  if (existing) {
    throw new ConflictError(`Văn bản có mã ${data.documentCode} đã tồn tại trong hệ thống`);
  }

  return await regulationRepo.createDocument(null, data);
}

// 2. Quản lý Phiên bản Văn bản
export async function getVersionById(versionId) {
  const version = await regulationRepo.findVersionById(null, versionId);
  if (!version) {
    throw new NotFoundError(`Không tìm thấy phiên bản quy định với ID #${versionId}`);
  }
  const chunks = await regulationRepo.listChunksByVersionId(null, versionId);
  const criteria = await regulationRepo.listCriteriaVersions(null, { versionId, confirmedOnly: false });
  return { ...version, chunks, criteria };
}

export async function createVersion(documentId, data, user) {
  if (!checkHasRole(user.roles, ADMIN_ROLES)) {
    throw new ForbiddenError('Chỉ Quản trị viên hệ thống hoặc Hội đồng mới có quyền ban hành phiên bản quy chế mới');
  }

  const doc = await regulationRepo.findDocumentById(null, documentId);
  if (!doc) {
    throw new NotFoundError(`Không tìm thấy văn bản quy định với ID #${documentId}`);
  }

  // Kiểm tra trùng phiên bản
  const existingVersion = await regulationRepo.findVersionByDocAndNumber(null, documentId, data.versionNumber);
  if (existingVersion) {
    throw new ConflictError(`Phiên bản ${data.versionNumber} đã tồn tại cho văn bản này. Quy định là bất biến, vui lòng tăng số hiệu phiên bản.`);
  }

  // Xử lý SHA-256 hash
  let sha256 = data.sha256Hash;
  if (!sha256) {
    if (data.contentForHash) {
      sha256 = computeSha256(data.contentForHash);
    } else {
      // Băm thông tin định danh tối thiểu nếu không có tệp đính kèm
      sha256 = computeSha256(`${doc.document_code}:${data.versionNumber}:${data.effectiveFrom}`);
    }
  }

  // Kiểm tra quan hệ thay thế (supersedes)
  if (data.supersedesVersionId) {
    const prevVersion = await regulationRepo.findVersionById(null, data.supersedesVersionId);
    if (!prevVersion) {
      throw new NotFoundError(`Không tìm thấy phiên bản tiền nhiệm với ID #${data.supersedesVersionId}`);
    }
    if (Number(prevVersion.document_id) !== Number(documentId)) {
      throw new ValidationError('Phiên bản tiền nhiệm phải thuộc về cùng một văn bản quy định');
    }
  }

  return await withTransaction(async ({ client }) => {
    // Chuyển tiếp hiệu lực phiên bản tiền nhiệm nếu cần (không ghi đè nội dung cũ)
    if (data.supersedesVersionId) {
      await client.query(
        `UPDATE app.regulation_document_versions
         SET effective_to = CASE WHEN effective_to IS NULL OR effective_to > CAST($1 AS date) THEN CAST($1 AS date) ELSE effective_to END
         WHERE version_id = $2`,
        [data.effectiveFrom, data.supersedesVersionId]
      );
    }

    return await regulationRepo.createVersion(
      client,
      {
        ...data,
        documentId,
        sha256Hash: sha256,
      },
      user.userId
    );
  });
}

// 3. Xác nhận Phiên bản Văn bản (Cổng kiểm duyệt LHU)
export async function confirmVersion(versionId, data, user) {
  if (!checkHasRole(user.roles, APPROVAL_ROLES)) {
    throw new ForbiddenError('Chỉ Hội đồng thẩm định hoặc Quản trị hệ thống mới có quyền phê duyệt văn bản quy chế');
  }

  const version = await regulationRepo.findVersionById(null, versionId);
  if (!version) {
    throw new NotFoundError(`Không tìm thấy phiên bản quy định với ID #${versionId}`);
  }

  // Quy tắc nghiệp vụ bắt buộc: Nếu chưa được xác nhận, TUYỆT ĐỐI không gắn nhãn chính sách LHU
  if (!data.isConfirmed && data.lhuApplicationStatus === 'CONFIRMED_LHU_POLICY') {
    throw new ValidationError('Không thể gắn nhãn CONFIRMED_LHU_POLICY khi văn bản chưa được xác nhận chính thức');
  }

  return await regulationRepo.confirmVersion(null, versionId, {
    isConfirmed: data.isConfirmed,
    lhuApplicationStatus: data.lhuApplicationStatus,
    confirmationNotes: data.confirmationNotes,
    confirmedBy: user.userId,
  });
}

// 4. Quản lý Chunks (Phân đoạn trích dẫn)
export async function addChunks(versionId, chunks, user) {
  if (!checkHasRole(user.roles, ADMIN_ROLES)) {
    throw new ForbiddenError('Chỉ Quản trị viên hệ thống mới có quyền trích xuất phân đoạn văn bản');
  }

  const version = await regulationRepo.findVersionById(null, versionId);
  if (!version) {
    throw new NotFoundError(`Không tìm thấy phiên bản quy định với ID #${versionId}`);
  }

  const preparedChunks = chunks.map((chunk) => {
    const chunkHash = chunk.chunkHash || computeSha256(`${chunk.articleNo || ''}:${chunk.clauseNo || ''}:${chunk.content}`);
    return {
      ...chunk,
      chunkHash,
    };
  });

  return await regulationRepo.batchCreateChunks(null, versionId, preparedChunks);
}

export async function getChunksByVersion(versionId) {
  const version = await regulationRepo.findVersionById(null, versionId);
  if (!version) {
    throw new NotFoundError(`Không tìm thấy phiên bản quy định với ID #${versionId}`);
  }
  return await regulationRepo.listChunksByVersionId(null, versionId);
}

// 5. Quản lý Tiêu chí Khen thưởng (Award Criteria Versions)
export async function getCriteria(filters, user) {
  // Mặc định: confirmedOnly = true trừ khi user có quyền quản trị muốn xem cả bản nháp
  const isManager = checkHasRole(user?.roles, ADMIN_ROLES);
  const confirmedOnly = filters.confirmedOnly !== undefined ? filters.confirmedOnly : !isManager;

  return await regulationRepo.listCriteriaVersions(null, {
    ...filters,
    confirmedOnly,
  });
}

export async function createCriteriaVersion(versionId, data, user) {
  if (!checkHasRole(user.roles, ADMIN_ROLES)) {
    throw new ForbiddenError('Chỉ Quản trị viên hệ thống hoặc Hội đồng mới có quyền tạo tiêu chí khen thưởng');
  }

  const version = await regulationRepo.findVersionById(null, versionId);
  if (!version) {
    throw new NotFoundError(`Không tìm thấy phiên bản quy định với ID #${versionId}`);
  }

  if (data.sourceRules) {
    if (!checkHasRole(user.roles, APPROVAL_ROLES)) throw new ForbiddenError('Chỉ Hội đồng hoặc Quản trị hệ thống được cấu hình nguồn tiêu chí');
    await validateSourceRules(data.sourceRules, data.targetType);
  }

  return await regulationRepo.createCriteriaVersion(null, {
    ...data,
    versionId,
    sourceRulesBy: data.sourceRules ? user.userId : null,
  });
}

export async function getSourceCatalogs() {
  return regulationRepo.listSourceCatalogs(null);
}

async function validateSourceRules(rules, targetType, client = null) {
  const parsed = sourceRulesSchema.parse(rules);
  const catalogs = await regulationRepo.listSourceCatalogs(client);
  const ids = parsed.achievementTypeIds || parsed.awardTypeIds;
  const expectedSubject = targetType === 'INDIVIDUAL' ? 'LECTURER' : targetType === 'COLLECTIVE' ? 'UNIT' : 'BOTH';
  if (!ids.every(id => catalogs[parsed.sourceType].some(row => row.is_active && Number(row.id) === id &&
    (row.applicable_subject_type === 'BOTH' || row.applicable_subject_type === expectedSubject)))) {
    throw new ValidationError('Loại hồ sơ không tồn tại, đã ngừng dùng hoặc không phù hợp đối tượng của tiêu chí');
  }
}

export async function configureSourceRules(criteriaVersionId, data, user) {
  if (!checkHasRole(user.roles, APPROVAL_ROLES)) throw new ForbiddenError('Chỉ Hội đồng hoặc Quản trị hệ thống được cấu hình nguồn tiêu chí');
  return withTransaction(async ({ client }) => {
    const criterion = await regulationRepo.findCriteriaVersionById(client, criteriaVersionId);
    if (!criterion) throw new NotFoundError('Không tìm thấy tiêu chí');
    if (data.sourceRules) await validateSourceRules(data.sourceRules, criterion.target_type, client);
    const updated = await regulationRepo.updateSourceRules(client, criteriaVersionId, data, user.userId);
    if (!updated) throw new ConflictError('Cấu hình đã được thay đổi bởi người khác. Vui lòng tải lại');
    return updated;
  });
}

export async function confirmCriterion(criteriaVersionId, data, user) {
  if (!checkHasRole(user.roles, APPROVAL_ROLES)) {
    throw new ForbiddenError('Chỉ Hội đồng thẩm định hoặc Quản trị hệ thống mới có thẩm quyền xác nhận tiêu chí khen thưởng');
  }

  const criterion = await regulationRepo.findCriteriaVersionById(null, criteriaVersionId);
  if (!criterion) {
    throw new NotFoundError(`Không tìm thấy tiêu chí khen thưởng với ID #${criteriaVersionId}`);
  }

  // Kiểm tra phiên bản văn bản cha: nếu văn bản cha chưa được duyệt mà duyệt tiêu chí là cảnh báo
  if (data.isConfirmed && !criterion.is_version_confirmed && criterion.lhu_application_status !== 'CONFIRMED_LHU_POLICY') {
    // Cho phép xác nhận nhưng yêu cầu ghi chú rõ ràng về tính chất chuyển tiếp hoặc độc lập
  }

  if (data.isConfirmed && criterion.source_rules_revision > 0 && data.expectedSourceRulesRevision !== criterion.source_rules_revision) {
    throw new ConflictError('Vui lòng tải lại và kiểm tra cấu hình nguồn trước khi phê duyệt');
  }
  const updated = await regulationRepo.confirmCriteriaVersion(null, criteriaVersionId, {
    isConfirmed: data.isConfirmed,
    notes: data.notes,
    confirmedBy: user.userId,
    expectedSourceRulesRevision: criterion.source_rules_revision,
  });
  if (!updated) throw new ConflictError('Cấu hình nguồn đã thay đổi. Vui lòng tải lại');
  return updated;
}
