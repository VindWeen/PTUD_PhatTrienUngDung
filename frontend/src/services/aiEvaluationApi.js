import { request } from './request.js';

export const aiEvaluationApi = {
  /**
   * Chạy thẩm định tiêu chí có cấu trúc với dữ liệu thật / snapshot
   */
  evaluateStructured: (data) =>
    request({ method: 'POST', url: '/ai/evaluations/structured', data }),

  /**
   * Lấy chi tiết phiên đánh giá theo runId
   */
  getEvaluationRun: (runId) =>
    request({ method: 'GET', url: `/ai/evaluations/${runId}` }),

  /**
   * Danh sách lịch sử các phiên đánh giá
   */
  listEvaluationRuns: (params = {}) =>
    request({ method: 'GET', url: '/ai/evaluations', params }),

  /**
   * Kiểm tra tính stale của phiên đánh giá
   */
  checkEvaluationStale: (runId) =>
    request({ method: 'GET', url: `/ai/evaluations/${runId}/stale-check` }),

  /**
   * RAG giải thích kết quả tiêu chí kèm citations Điều/Khoản/Trang
   */
  explainEvaluation: (data) =>
    request({ method: 'POST', url: '/ai/rag/explain', data }),

  /**
   * Danh sách tiêu chí quy chế
   */
  listCriteria: (params = {}) =>
    request({ method: 'GET', url: '/regulations/criteria', params }),
};

export default aiEvaluationApi;
