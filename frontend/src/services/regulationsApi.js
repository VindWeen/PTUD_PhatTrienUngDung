import { request } from './request.js';

export const regulationsApi = {
  // Documents
  listDocuments: (params = {}) =>
    request({ method: 'GET', url: '/regulations', params }),

  getDocumentById: (id) =>
    request({ method: 'GET', url: `/regulations/${id}` }),

  createDocument: (data) =>
    request({ method: 'POST', url: '/regulations', data }),

  // Versions
  getVersionById: (id) =>
    request({ method: 'GET', url: `/regulations/versions/${id}` }),

  createVersion: (documentId, data) =>
    request({ method: 'POST', url: `/regulations/${documentId}/versions`, data }),

  confirmVersion: (id, data) =>
    request({ method: 'PATCH', url: `/regulations/versions/${id}/confirm`, data }),

  // Chunks
  getChunks: (versionId) =>
    request({ method: 'GET', url: `/regulations/versions/${versionId}/chunks` }),

  addChunks: (versionId, chunks) =>
    request({ method: 'POST', url: `/regulations/versions/${versionId}/chunks`, data: { chunks } }),

  // Criteria
  listCriteria: (params = {}) =>
    request({ method: 'GET', url: '/regulations/criteria', params }),

  createCriteria: (versionId, data) =>
    request({ method: 'POST', url: `/regulations/versions/${versionId}/criteria`, data }),

  confirmCriteria: (id, data) =>
    request({ method: 'PATCH', url: `/regulations/criteria/${id}/confirm`, data }),
};
