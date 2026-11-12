import { request } from './request';
import apiClient from './apiClient';
export const awardsApi = {
 readyApplications: (contextUnitId,page = 1) => request({url:'/award-applications/ready-for-award',params:{...(contextUnitId ? {contextUnitId} : {}),page,pageSize:20},fresh:true}),
 createFromApplication: (id,data) => request({method:'POST',url:`/award-applications/${id}/award-record`,data}),
 list: (contextUnitId,fresh = false,page = 1) => request({url:'/award-records',params:{contextUnitId,page},fresh}),
 detail: (id,fresh = false) => request({url:`/award-records/${id}`,fresh}),
 decision: data => request({method:'POST',url:'/award-decisions',data}),
 create: data => request({method:'POST',url:'/award-records',data}),
 upload: (id,file) => { const data = new FormData(); data.append('file',file); return request({method:'POST',url:`/award-decisions/${id}/files`,data,headers:{'Content-Type':'multipart/form-data'}}); },
 transition: (id,action,data) => request({method:'POST',url:`/award-records/${id}/${action}`,data}),
 download: async file => { const blob = await apiClient.get(`/award-decision-files/${file.decision_file_id}/download`,{responseType:'blob'}); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download=file.original_file_name; link.click(); URL.revokeObjectURL(url); },
};
