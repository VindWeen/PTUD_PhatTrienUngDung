import { USE_FIXTURES } from './apiConfig.js';
import { fixtureClient } from './fixtureClient.js';
import apiClient from './apiClient.js';
import { request } from './request.js';

function validateEvidenceFile(file) {
  if (!file) throw new Error('Vui lòng chọn tệp minh chứng.');
  if (!/\.(pdf|jpe?g|png|docx)$/i.test(file.name)) throw new Error('Chỉ hỗ trợ PDF, JPG, PNG và DOCX.');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Tệp phải có nội dung và dung lượng không quá 10 MB.');
}

export const evidencesApi = {
  /**
   * Lấy danh sách minh chứng của một hồ sơ thành tích
   */
  async getEvidencesByAchievement(achievementId) {
    if (USE_FIXTURES) {
      return fixtureClient.getEvidencesByAchievement(achievementId);
    }
    return request({
      method: 'GET',
      url: `/achievements/${achievementId}/evidences`,
    });
  },

  /**
   * Thêm minh chứng mới kèm tệp tin ban đầu (v1)
   */
  async createEvidence(achievementId, { title, description, file }) {
    validateEvidenceFile(file);
    if (USE_FIXTURES) {
      return fixtureClient.createEvidence(achievementId, { title, description, file });
    }
    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('file', file);

    const res = await apiClient.post(`/achievements/${achievementId}/evidences`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return res.data?.data || res.data;
  },

  /**
   * Tải lên phiên bản mới cho minh chứng (Thay file -> tăng version_no)
   */
  async uploadFileVersion(evidenceId, file) {
    validateEvidenceFile(file);
    if (USE_FIXTURES) {
      return fixtureClient.uploadFileVersion(evidenceId, file);
    }
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post(`/evidences/${evidenceId}/versions`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return res.data?.data || res.data;
  },

  /**
   * Xóa mềm minh chứng
   */
  async deleteEvidence(evidenceId) {
    if (USE_FIXTURES) {
      return fixtureClient.deleteEvidence(evidenceId);
    }
    return request({
      method: 'DELETE',
      url: `/evidences/${evidenceId}`,
    });
  },

  /**
   * Tải về tệp tin minh chứng
   */
  async downloadEvidenceFile(evidenceFileId, originalFileName) {
    const blob = await apiClient.get(`/evidence-files/${evidenceFileId}/download`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', originalFileName || `evidence_file_${evidenceFileId}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default evidencesApi;
