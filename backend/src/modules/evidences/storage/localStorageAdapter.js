import fs from 'fs';
import path from 'path';
import { ValidationError } from '../../../utils/errors.js';

/**
 * Storage Adapter cho kho lưu trữ Private tệp minh chứng
 * Hỗ trợ lưu file, stream tải về, dọn dẹp file khi DB lỗi và phòng chống Path Traversal
 */
export class LocalStorageAdapter {
  constructor(baseDir) {
    if (baseDir) {
      this.baseDir = baseDir;
    } else if (process.env.STORAGE_DIR) {
      this.baseDir = path.resolve(process.env.STORAGE_DIR);
    } else {
      const cwdPath = path.resolve(process.cwd(), 'storage/private/evidences');
      const backendSubPath = path.resolve(process.cwd(), 'backend/storage/private/evidences');
      if (fs.existsSync(cwdPath)) {
        this.baseDir = cwdPath;
      } else if (fs.existsSync(backendSubPath)) {
        this.baseDir = backendSubPath;
      } else {
        this.baseDir = cwdPath;
      }
    }

    // Đảm bảo thư mục lưu trữ private tồn tại
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch {
      // Bỏ qua lỗi khởi tạo đồng bộ ban đầu
    }
  }

  /**
   * Chuẩn hóa và xác thực đường dẫn tệp tin an toàn (Chống Path Traversal)
   * @param {string} storageKey Khóa định danh tệp tin
   * @returns {string} Đường dẫn tệp tin tuyệt đối an toàn trên đĩa
   */
  resolveSafePath(storageKey) {
    if (!storageKey || typeof storageKey !== 'string') {
      throw new ValidationError('StorageKey không hợp lệ');
    }

    // Chặn các ký tự nguy hiểm: null byte, đường dẫn tương đối ngược ..
    if (storageKey.includes('\0') || storageKey.includes('..')) {
      throw new ValidationError('Phát hiện đường dẫn tệp tin không an toàn (Path Traversal Attempt)');
    }

    // Chuẩn hóa đường dẫn đích
    const resolvedBase = path.resolve(this.baseDir);
    const resolvedTarget = path.resolve(resolvedBase, storageKey);

    // Bắt buộc đường dẫn đích phải nằm hoàn toàn trong resolvedBase
    if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
      throw new ValidationError('Đường dẫn tệp tin nằm ngoài kho lưu trữ cho phép');
    }

    return resolvedTarget;
  }

  /**
   * Lưu tệp tin vào kho lưu trữ Private
   * @param {string} storageKey Khóa định danh tệp tin
   * @param {Buffer} buffer Dữ liệu nhị phân của tệp tin
   * @returns {Promise<string>} Đường dẫn tuyệt đối của tệp đã lưu
   */
  async saveFile(storageKey, buffer) {
    const targetPath = this.resolveSafePath(storageKey);
    const dir = path.dirname(targetPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(targetPath, buffer);
    return targetPath;
  }

  /**
   * Xóa tệp tin khỏi đĩa (Dọn dẹp khi DB thất bại hoặc dọn rác)
   * @param {string} storageKey Khóa định danh tệp tin
   * @returns {Promise<boolean>}
   */
  async deleteFile(storageKey) {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      await fs.promises.unlink(targetPath);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false; // File không tồn tại
      }
      console.error(`[LocalStorageAdapter] Lỗi khi xóa tệp ${storageKey}:`, err.message);
      return false;
    }
  }

  /**
   * Kiểm tra tệp tin có tồn tại trên đĩa hay không
   * @param {string} storageKey 
   * @returns {Promise<boolean>}
   */
  async fileExists(storageKey) {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      await fs.promises.access(targetPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Trả về Stream đọc tệp tin để tải về
   * @param {string} storageKey 
   * @returns {fs.ReadStream}
   */
  getFileStream(storageKey) {
    const targetPath = this.resolveSafePath(storageKey);
    return fs.createReadStream(targetPath);
  }
}

// Export singleton instance mặc định
export const defaultStorageAdapter = new LocalStorageAdapter();
export default defaultStorageAdapter;
