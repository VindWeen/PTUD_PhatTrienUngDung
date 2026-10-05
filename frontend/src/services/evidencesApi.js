import { USE_FIXTURES } from './apiConfig.js';
import { fixtureClient } from './fixtureClient.js';
import apiClient from './apiClient.js';
import { request } from './request.js';

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
    if (USE_FIXTURES) {
      return fixtureClient.createEvidence(achievementId, { title, description, file });
    }
    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('file', file);

    const res = await apiClient.post(`/achievements/${achievementId}/evidences`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.data || res.data;
  },

  /**
   * Tải lên phiên bản mới cho minh chứng (Thay file -> tăng version_no)
   */
  async uploadFileVersion(evidenceId, file) {
    if (USE_FIXTURES) {
      return fixtureClient.uploadFileVersion(evidenceId, file);
    }
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post(`/evidences/${evidenceId}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
    const res = await apiClient.get(`/evidence-files/${evidenceFileId}/download`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
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
