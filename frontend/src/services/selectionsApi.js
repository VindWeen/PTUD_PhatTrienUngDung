import { request } from './request';
export const selectionsApi = {
  options: (purpose) => request({ url:'/selection-options', params:{purpose} }),
  sources: (purpose,subjectType,subjectId) => request({ url:'/selection-sources', params:{purpose,subjectType,subjectId} }),
  reviewers: (id) => request({ url:`/award-applications/${id}/reviewers` }),
};
