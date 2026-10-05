import crypto from 'crypto';
import { getPool } from '../../config/database.js';
import {
  ValidationError,
  UnauthorizedError,
  OutOfScopeError,
  ConflictError,
} from '../../utils/errors.js';
import { recordAuditLog } from '../audit/auditService.js';
import { isUnitInUserScope } from '../auth/authRepository.js';
import achievementRepository from '../achievements/achievementRepository.js';
import evidenceRepository from './evidenceRepository.js';
import defaultStorageAdapter from './storage/localStorageAdapter.js';
import {
  validateUploadedFile,
  createEvidenceSchema,
} from './evidenceValidators.js';

export class EvidenceService {
  constructor(storageAdapter = defaultStorageAdapter) {
    this.storage = storageAdapter;
  }

  /**
   * Kiểm tra quyền truy cập/chỉnh sửa của người dùng đối với hồ sơ thành tích
   */
  async _assertCanModifyAchievement(achievement, user) {
    const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));

    // Kiểm tra trạng thái hồ sơ: Chỉ DRAFT và NEED_CORRECTION được phép thêm/sửa minh chứng (VERIFIED khóa sửa/file)
    const allowedStatuses = ['DRAFT', 'NEED_CORRECTION'];
    if (!allowedStatuses.includes(achievement.status)) {
      throw new ConflictError(
        `Không thể thêm, sửa hoặc xóa minh chứng khi hồ sơ đang ở trạng thái "${achievement.status}". Dữ liệu hồ sơ đã được khóa bất biến.`,
        'ACHIEVEMENT_IMMUTABLE'
      );
    }

    // Admin và Records Officer có quyền quản trị trong giai đoạn hồ sơ cho phép chỉnh sửa
    if (roles.includes('ADMIN') || roles.includes('RECORDS_OFFICER')) {
      return true;
    }

    const lecturerUserId = achievement.lecturer?.userId || achievement.lecturerUserId;
    const unitId = achievement.unitId || achievement.organizationUnitId;

    // Nếu là thành tích cá nhân: Người dùng phải là giảng viên chủ hồ sơ
    if (achievement.lecturerId || lecturerUserId) {
      if (lecturerUserId !== user.userId) {
        throw new OutOfScopeError('Bạn không có quyền chỉnh sửa minh chứng cho hồ sơ của giảng viên khác');
      }
      return true;
    }

    // Nếu là thành tích tập thể: Người dùng phải là đại diện đơn vị còn hiệu lực
    if (unitId) {
      const activeRep = await achievementRepository.findActiveRepresentative(user.userId, unitId);
      if (!activeRep) {
        throw new OutOfScopeError(
          'Chỉ đại diện được ủy quyền của đơn vị trong thời hạn mới có quyền chỉnh sửa minh chứng'
        );
      }
      return true;
    }

    throw new OutOfScopeError('Không xác định được chủ thể của hồ sơ thành tích');
  }

  /**
   * Kiểm tra quyền xem của người dùng đối với hồ sơ thành tích
   */
  async _assertCanViewAchievement(achievement, user) {
    const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));

    if (roles.includes('ADMIN') || roles.includes('RECORDS_OFFICER')) {
      return true;
    }

    const lecturerUserId = achievement.lecturer?.userId || achievement.lecturerUserId;
    const unitId = achievement.unitId || achievement.organizationUnitId;

    // Giảng viên chủ hồ sơ
    if (lecturerUserId && lecturerUserId === user.userId) {
      return true;
    }

    // Đại diện đơn vị
    if (unitId) {
      const activeRep = await achievementRepository.findActiveRepresentative(user.userId, unitId);
      if (activeRep) {
        return true;
      }
    }

    // Manager phụ trách ContextUnitId (kiểm tra phân cấp cây tổ chức)
    if (roles.includes('MANAGER') && achievement.contextUnitId) {
      const inScope = await isUnitInUserScope(user.userId, achievement.contextUnitId, 'MANAGER');
      if (inScope) return true;
    }

    throw new OutOfScopeError('Bạn không có quyền truy cập hoặc tải minh chứng của hồ sơ này');
  }

  /**
   * Tạo danh mục minh chứng mới kèm tệp tin phiên bản đầu tiên (v1)
   */
  async createEvidence({ achievementId, body, file, user, ipAddress, userAgent }) {
    if (!user || !user.userId) {
      throw new UnauthorizedError('Yêu cầu đăng nhập để thực hiện thao tác này');
    }

    // 1. Kiểm tra tồn tại hồ sơ thành tích
    const achievement = await achievementRepository.findAchievementById(achievementId);
    if (!achievement) {
      throw new ValidationError(`Hồ sơ thành tích #${achievementId} không tồn tại`, {
        achievementId: ['Hồ sơ thành tích không tìm thấy'],
      });
    }

    // 2. Kiểm tra quyền thao tác và trạng thái hồ sơ
    await this._assertCanModifyAchievement(achievement, user);

    // 3. Validate dữ liệu danh mục minh chứng (title, description)
    const validatedBody = createEvidenceSchema.parse(body);

    // 4. Validate tệp tin (Đuôi, MIME, Kích thước <= 10MB, Magic Bytes, SHA-256)
    const fileMeta = validateUploadedFile(file);

    // 5. Chuẩn bị lưu trữ tệp vật lý vào kho Private
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const storageKey = `evidences/${year}/ach_${achievementId}_ev_${Date.now()}_v1_${randomHex}${fileMeta.fileExtension}`;

    // Lưu file vào Private Storage trước
    await this.storage.saveFile(storageKey, file.buffer);

    // 6. Thực hiện lưu vào CSDL trong Transaction
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Tạo bản ghi danh mục minh chứng (app.evidences)
      const evidenceRecord = await evidenceRepository.createEvidenceRecord(
        {
          achievementId,
          title: validatedBody.title,
          description: validatedBody.description,
          createdBy: user.userId,
        },
        client
      );

      // Tạo bản ghi tệp tin phiên bản 1 (app.evidence_files)
      const fileRecord = await evidenceRepository.createEvidenceFileRecord(
        {
          evidenceId: evidenceRecord.evidenceId,
          versionNo: 1,
          originalFileName: fileMeta.originalFileName,
          storageKey,
          mimeType: fileMeta.mimeType,
          fileExtension: fileMeta.fileExtension,
          fileSize: fileMeta.fileSize,
          sha256Hash: fileMeta.sha256Hash,
          uploadedBy: user.userId,
        },
        client
      );

      await client.query('COMMIT');

      // 7. Ghi Audit Log (W1-Q4)
      await recordAuditLog({
        actorId: user.userId,
        action: 'CREATE_EVIDENCE',
        entityName: 'Evidences',
        entityId: evidenceRecord.evidenceId,
        ipAddress,
        userAgent,
        afterData: {
          evidence: evidenceRecord,
          initialFile: fileRecord,
        },
      });

      return {
        ...evidenceRecord,
        files: [
          {
            ...fileRecord,
            downloadUrl: `/api/v1/evidence-files/${fileRecord.evidenceFileId}/download`,
          },
        ],
      };
    } catch (dbErr) {
      await client.query('ROLLBACK');
      // Dọn dẹp tệp tin vật lý khi ghi DB thất bại (tránh file mồ côi)
      await this.storage.deleteFile(storageKey);
      throw dbErr;
    } finally {
      client.release();
    }
  }

  /**
   * Thay thế tệp tin minh chứng -> Tạo phiên bản mới (version_no = version_no + 1)
   */
  async uploadFileVersion({ evidenceId, file, user, ipAddress, userAgent }) {
    if (!user || !user.userId) {
      throw new UnauthorizedError('Yêu cầu đăng nhập để tải lên phiên bản mới');
    }

    // 1. Kiểm tra tồn tại danh mục minh chứng
    const evidence = await evidenceRepository.findEvidenceById(evidenceId);
    if (!evidence || evidence.isRemoved) {
      throw new ValidationError(`Minh chứng #${evidenceId} không tồn tại hoặc đã bị xóa`, {
        evidenceId: ['Minh chứng không tìm thấy'],
      });
    }

    // 2. Lấy thông tin thành tích để kiểm tra quyền và trạng thái
    const achievement = await achievementRepository.findAchievementById(evidence.achievementId);
    await this._assertCanModifyAchievement(achievement, user);

    // 3. Validate tệp tin mới
    const fileMeta = validateUploadedFile(file);

    // 4. Xác định version_no tiếp theo
    const currentMaxVersion = await evidenceRepository.getLatestVersionNo(evidenceId);
    const nextVersionNo = currentMaxVersion + 1;

    // 5. Chuẩn bị lưu trữ tệp vật lý
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const storageKey = `evidences/${year}/ach_${evidence.achievementId}_ev_${evidenceId}_v${nextVersionNo}_${randomHex}${fileMeta.fileExtension}`;

    // Lưu tệp vật lý
    await this.storage.saveFile(storageKey, file.buffer);

    // 6. Ghi CSDL trong Transaction
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const fileRecord = await evidenceRepository.createEvidenceFileRecord(
        {
          evidenceId,
          versionNo: nextVersionNo,
          originalFileName: fileMeta.originalFileName,
          storageKey,
          mimeType: fileMeta.mimeType,
          fileExtension: fileMeta.fileExtension,
          fileSize: fileMeta.fileSize,
          sha256Hash: fileMeta.sha256Hash,
          uploadedBy: user.userId,
        },
        client
      );

      await client.query('COMMIT');

      // Ghi Audit Log
      await recordAuditLog({
        actorId: user.userId,
        action: 'UPLOAD_EVIDENCE_VERSION',
        entityName: 'EvidenceFiles',
        entityId: fileRecord.evidenceFileId,
        ipAddress,
        userAgent,
        afterData: fileRecord,
      });

      return {
        ...fileRecord,
        downloadUrl: `/api/v1/evidence-files/${fileRecord.evidenceFileId}/download`,
      };
    } catch (dbErr) {
      await client.query('ROLLBACK');
      // Dọn file vật lý khi DB thất bại
      await this.storage.deleteFile(storageKey);
      throw dbErr;
    } finally {
      client.release();
    }
  }

  /**
   * Xóa mềm danh mục minh chứng (is_removed = TRUE)
   */
  async deleteEvidence({ evidenceId, user, ipAddress, userAgent }) {
    if (!user || !user.userId) {
      throw new UnauthorizedError('Yêu cầu đăng nhập để xóa minh chứng');
    }

    const evidence = await evidenceRepository.findEvidenceById(evidenceId);
    if (!evidence || evidence.isRemoved) {
      throw new ValidationError(`Minh chứng #${evidenceId} không tồn tại hoặc đã bị xóa`);
    }

    const achievement = await achievementRepository.findAchievementById(evidence.achievementId);
    await this._assertCanModifyAchievement(achievement, user);

    const deleted = await evidenceRepository.softDeleteEvidence(evidenceId);

    await recordAuditLog({
      actorId: user.userId,
      action: 'DELETE_EVIDENCE',
      entityName: 'Evidences',
      entityId: evidenceId,
      ipAddress,
      userAgent,
      beforeData: evidence,
      afterData: deleted,
    });

    return {
      success: true,
      message: 'Đã xóa minh chứng thành công',
      evidenceId,
    };
  }

  /**
   * Lấy danh sách minh chứng của một hồ sơ thành tích
   */
  async getEvidencesByAchievementId({ achievementId, user }) {
    const achievement = await achievementRepository.findAchievementById(achievementId);
    if (!achievement) {
      throw new ValidationError(`Hồ sơ thành tích #${achievementId} không tồn tại`);
    }

    await this._assertCanViewAchievement(achievement, user);

    const evidences = await evidenceRepository.getEvidencesByAchievementId(achievementId);
    return evidences.map((ev) => ({
      ...ev,
      latestDownloadUrl: ev.latestFileId
        ? `/api/v1/evidence-files/${ev.latestFileId}/download`
        : null,
    }));
  }

  /**
   * Lấy thông tin và luồng Stream tệp tin để tải về (Bảo vệ quyền truy cập chặt chẽ)
   */
  async getFileForDownload({ evidenceFileId, user }) {
    if (!user || !user.userId) {
      throw new UnauthorizedError('Yêu cầu đăng nhập để tải tệp minh chứng');
    }

    const fileDetail = await evidenceRepository.findEvidenceFileDetail(evidenceFileId);
    if (!fileDetail) {
      throw new ValidationError(`Tệp tin minh chứng #${evidenceFileId} không tồn tại`, {
        evidenceFileId: ['Tệp tin không tìm thấy trong hệ thống'],
      });
    }

    // Kiểm tra quyền xem / tải tệp tin
    const achievementInfo = {
      achievementId: fileDetail.achievementId,
      lecturerId: fileDetail.lecturerId,
      unitId: fileDetail.unitId,
      contextUnitId: fileDetail.contextUnitId,
      status: fileDetail.achievementStatus,
      lecturerUserId: fileDetail.lecturerUserId,
    };

    await this._assertCanViewAchievement(achievementInfo, user);

    // Kiểm tra file vật lý trên đĩa
    const exists = await this.storage.fileExists(fileDetail.storageKey);
    if (!exists) {
      throw new ValidationError('Tệp tin vật lý không tồn tại trên kho lưu trữ', {
        storageKey: ['Không tìm thấy tệp tin trên hệ thống lưu trữ'],
      });
    }

    const stream = this.storage.getFileStream(fileDetail.storageKey);

    return {
      fileDetail,
      stream,
    };
  }
}

export const evidenceService = new EvidenceService();
export default evidenceService;
