import { LoadingState } from './common/AsyncState';
import React, {useEffect, useState} from 'react';
import {kpiApi} from '../services/kpiApi';
export default function ExternalKpi({types = [], refreshKey = 0, onBusyChange, autoLoad = false}) {
 const [data,setData] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(autoLoad);
 const [employeeId,setEmployeeId] = useState(''), [lecturerId,setLecturerId] = useState(''), [type,setType] = useState('');
 useEffect(() => {
   if (!autoLoad && refreshKey === 0) return;
   let active = true;
   setBusy(true); setError('');
   kpiApi.external(refreshKey > 0).then(result => { if(active) setData(result); })
     .catch(e => { if(active) setError(e.message); })
     .finally(() => { if(active) setBusy(false); });
   return () => { active = false; };
 }, [refreshKey, autoLoad]);
 useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
 async function act(fn) {
   setBusy(true); setError('');
   try { await fn(); setData(await kpiApi.external(true)); } catch(e) {setError(e.message);} finally {setBusy(false);}
 }
 return <section className="soft-card p-5 sm:p-6 space-y-4 text-sm text-slate-800 dark:text-slate-100 [&_button]:rounded-xl [&_button]:border [&_button]:border-teal-200 [&_button]:px-3 [&_button]:py-2 [&_button]:m-1 [&_button]:bg-teal-50 [&_button]:text-teal-800 [&_button:disabled]:opacity-40 dark:[&_button]:border-teal-900 dark:[&_button]:bg-teal-950/40 dark:[&_button]:text-teal-200 [&_input]:border [&_input]:border-slate-200 [&_input]:bg-slate-50 [&_input]:rounded-xl [&_input]:p-2 [&_input]:m-1 [&_input]:text-slate-800 dark:[&_input]:border-slate-700 dark:[&_input]:bg-slate-900 dark:[&_input]:text-white [&_select]:border [&_select]:border-slate-200 [&_select]:bg-slate-50 [&_select]:rounded-xl [&_select]:p-2 [&_select]:text-slate-800 dark:[&_select]:border-slate-700 dark:[&_select]:bg-slate-900 dark:[&_select]:text-white [&_li]:my-2 [&_li]:break-words">
   <h2 className="font-semibold">Nguồn KPI MÔ PHỎNG — Import runs</h2>
   <p>Chưa tích hợp hệ thống bên ngoài thật. Chỉ ghép employeeId theo mã đã ánh xạ, không theo tên. Mỗi phiên bản nguồn giữ riêng; tạo nháp để rà soát, không ghi đè hồ sơ VERIFIED.</p>
   <button disabled={busy} onClick={()=>act(async()=>{})}>Tải nguồn và nhật ký</button>
   {busy && !data && <LoadingState label="Đang tải nguồn KPI và nhật ký..." rows={3} />}
   {error && <p role="alert" className="text-red-600">{error}</p>}
   {data?.isAdmin && <div className="space-y-2">
     <label>Mã nhân viên ngoài <input value={employeeId} onChange={e=>setEmployeeId(e.target.value)} /></label>
     <label>ID giảng viên nội bộ <input value={lecturerId} onChange={e=>setLecturerId(e.target.value)} /></label>
     <button disabled={busy || !employeeId || !lecturerId} onClick={()=>act(()=>kpiApi.externalMapping({employeeId,lecturerId}))}>Lưu ánh xạ mã</button>
     <button disabled={busy} onClick={()=>act(()=>kpiApi.externalRun({}))}>Pull qua HTTP</button>
     <p>Ánh xạ: {data.mappings.map(m=>`${m.employee_id} → ${m.lecturer_id}`).join('; ') || 'Chưa có'}</p>
     <ul>{data.runs.map(r=><li key={r.run_id}>{r.run_id}: {r.status}; lần gọi {r.attempts}; {JSON.stringify(r.summary)}
       {r.status !== 'RUNNING' && <button disabled={busy} onClick={()=>act(()=>kpiApi.externalRun({retryOf:r.run_id}))}>Retry</button>}
       <ul>{data.items.filter(i=>i.run_id===r.run_id).map(i=><li key={i.item_index}>Dòng {i.item_index + 1}: {i.outcome}</li>)}</ul>
     </li>)}</ul>
   </div>}
   {data && <>
     {!data.isAdmin && <label>Loại thành tích để tạo nháp <select value={type} onChange={e=>setType(e.target.value)}><option value="">Chọn loại</option>{types.filter(t=>['LECTURER','BOTH'].includes(t.applicable_subject_type)).map(t=><option key={t.achievement_type_id} value={t.achievement_type_id}>{t.name}</option>)}</select></label>}
     <ul>{data.records.map(r=><li key={r.record_id}>{r.payload.title} — {r.payload.employeeId}; {r.payload.periodStart} → {r.payload.periodEnd}; revision {r.source_version}: {r.status} {r.reason}
       {r.achievement_id && <span> — nháp #{r.achievement_id}</span>}
       {!data.isAdmin && r.status==='READY' && <button disabled={busy || !type} onClick={()=>act(()=>kpiApi.externalDraft(r.record_id,{version:r.version,achievementTypeId:type}))}>Xác nhận tạo nháp riêng</button>}
     </li>)}</ul>
   </>}
 </section>;
}
