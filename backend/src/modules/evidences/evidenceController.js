import evidenceService from './evidenceService.js';

export class EvidenceController {
  /**
   * Tạo danh mục minh chứng kèm file v1
   * POST /api/v1/achievements/:id/evidences
   */
  async createEvidence(req, res, next) {
    try {
      const achievementId = parseInt(req.params.id, 10);
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await evidenceService.createEvidence({
        achievementId,
        body: req.body,
        file: req.file,
        user: req.user,
        ipAddress,
        userAgent,
      });

      return res.status(201).json({
        success: true,
        message: 'Thêm danh mục minh chứng thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy danh sách minh chứng của một hồ sơ thành tích
   * GET /api/v1/achievements/:id/evidences
   */
  async getEvidencesByAchievement(req, res, next) {
    try {
      const achievementId = parseInt(req.params.id, 10);
      const evidences = await evidenceService.getEvidencesByAchievementId({
        achievementId,
        user: req.user,
      });

      return res.status(200).json({
        success: true,
        data: evidences,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Tải lên phiên bản tệp tin mới cho minh chứng
   * POST /api/v1/evidences/:id/versions
   */
  async uploadFileVersion(req, res, next) {
    try {
      const evidenceId = parseInt(req.params.id, 10);
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await evidenceService.uploadFileVersion({
        evidenceId,
        file: req.file,
        user: req.user,
        ipAddress,
        userAgent,
      });

      return res.status(201).json({
        success: true,
        message: 'Tải lên phiên bản tệp minh chứng thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Xóa mềm minh chứng
   * DELETE /api/v1/evidences/:id
   */
  async deleteEvidence(req, res, next) {
    try {
      const evidenceId = parseInt(req.params.id, 10);
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await evidenceService.deleteEvidence({
        evidenceId,
        user: req.user,
        ipAddress,
        userAgent,
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Tải về tệp tin minh chứng từ kho Private
   * GET /api/v1/evidence-files/:id/download
   */
  async downloadEvidenceFile(req, res, next) {
    try {
      const evidenceFileId = parseInt(req.params.id, 10);
      const { fileDetail, stream } = await evidenceService.getFileForDownload({
        evidenceFileId,
        user: req.user,
      });

      // Headers tải về an toàn
      const asciiFileName = fileDetail.originalFileName.replace(/[^\x20-\x7E]/g, '_');
      const encodedFileName = encodeURIComponent(fileDetail.originalFileName);

      res.setHeader('Content-Type', fileDetail.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`
      );
      res.setHeader('Content-Length', fileDetail.fileSize);
      res.setHeader('ETag', `"${fileDetail.sha256Hash}"`);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

      stream.on('error', (err) => {
        next(err);
      });

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
}

export const evidenceController = new EvidenceController();
export default evidenceController;
