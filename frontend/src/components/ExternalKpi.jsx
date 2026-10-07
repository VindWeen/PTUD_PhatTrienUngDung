import React, {useState} from 'react';
import {kpiApi} from '../services/kpiApi';
export default function ExternalKpi({types = []}) {
 const [data,setData] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(false);
 const [employeeId,setEmployeeId] = useState(''), [lecturerId,setLecturerId] = useState(''), [type,setType] = useState('');
 async function act(fn) {
   setBusy(true); setError('');
   try { await fn(); setData(await kpiApi.external()); } catch(e) {setError(e.message);} finally {setBusy(false);}
 }
 return <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3 text-sm text-slate-800 dark:text-slate-100 [&_button]:rounded-lg [&_button]:border [&_button]:px-3 [&_button]:py-2 [&_button]:m-1 [&_button]:bg-teal-50 [&_button]:text-teal-900 [&_button:disabled]:opacity-40 [&_input]:border [&_input]:rounded [&_input]:p-2 [&_input]:m-1 [&_input]:text-slate-900 [&_select]:border [&_select]:p-2 [&_select]:text-slate-900 [&_li]:my-2 [&_li]:break-words">
   <h2 className="font-semibold">Nguồn KPI MÔ PHỎNG — Import runs</h2>
   <p>Chưa tích hợp hệ thống bên ngoài thật. Chỉ ghép employeeId theo mã đã ánh xạ, không theo tên. Mỗi phiên bản nguồn giữ riêng; tạo nháp để rà soát, không ghi đè hồ sơ VERIFIED.</p>
   <button disabled={busy} onClick={()=>act(async()=>{})}>Tải nguồn và nhật ký</button>
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
     <label>Loại thành tích để tạo nháp <select value={type} onChange={e=>setType(e.target.value)}><option value="">Chọn loại</option>{types.filter(t=>['LECTURER','BOTH'].includes(t.applicable_subject_type)).map(t=><option key={t.achievement_type_id} value={t.achievement_type_id}>{t.name}</option>)}</select></label>
     <ul>{data.records.map(r=><li key={r.record_id}>{r.payload.title} — {r.payload.employeeId}; {r.payload.periodStart} → {r.payload.periodEnd}; revision {r.source_version}: {r.status} {r.reason}
       {r.achievement_id && <span> — nháp #{r.achievement_id}</span>}
       {!data.isAdmin && r.status==='READY' && <button disabled={busy || !type} onClick={()=>act(()=>kpiApi.externalDraft(r.record_id,{version:r.version,achievementTypeId:type}))}>Xác nhận tạo nháp riêng</button>}
     </li>)}</ul>
   </>}
 </section>;
}
