import React, { useState } from 'react';
import { awardsApi as api } from '../services/awardsApi';
export default function Awards() {
 const [form,setForm] = useState({subjectType:'LECTURER',recognitionYear:new Date().getFullYear()});
 const [unit,setUnit] = useState(''); const [items,setItems] = useState([]); const [detail,setDetail] = useState(null); const [file,setFile] = useState(null); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false); const [reason,setReason] = useState('');
 const run = async fn => {setBusy(true);setMessage('');try {await fn();}catch(e){setMessage(e.message || 'Thao tác thất bại');}finally{setBusy(false);}};
 const input = (name,label,type='text',required=true) => <label className="flex flex-col gap-1">{label}<input className="border rounded p-2 text-slate-900" type={type} required={required} value={form[name] || ''} onChange={e=>setForm({...form,[name]:e.target.value})}/></label>;
 const create = e => {e.preventDefault();run(async()=>{
  let decisionId=form.decisionId;
  if(!decisionId){const d=await api.decision({decisionNumber:form.decisionNumber,decisionDate:form.decisionDate,issuer:form.issuer,title:form.title});decisionId=d.decision_id;setForm(f=>({...f,decisionId}));}
  const r=await api.create({[form.subjectType==='LECTURER'?'lecturerId':'organizationUnitId']:Number(form.subjectId),awardTypeId:Number(form.awardTypeId),decisionId:Number(decisionId),recognitionYear:Number(form.recognitionYear),achievementIds:(form.achievementIds || '').split(',').filter(v=>v.trim()).map(Number),...(form.replacesAwardRecordId ? {replacesAwardRecordId:Number(form.replacesAwardRecordId)} : {})});
  setDetail(await api.detail(r.record_id));setMessage('Đã tạo DRAFT. Tải file và ghi nhận khi đủ quyết định.');
 });};
 return <section className="p-6 space-y-5 text-slate-800 dark:text-slate-100"><h1 className="text-2xl font-bold">Nhập quyết định và ghi nhận khen thưởng</h1><p>Ghi nhận quyết định đã ban hành. API thật kiểm tra vai trò và phạm vi RecordsOfficer.</p>
 {message && <p role="status" className="p-3 bg-amber-100 text-slate-900 rounded">{message}</p>}
 <form onSubmit={create} className="grid md:grid-cols-2 gap-4"><label>Chủ thể<select className="block border p-2 text-slate-900" value={form.subjectType} onChange={e=>setForm({...form,subjectType:e.target.value})}><option value="LECTURER">Cá nhân</option><option value="UNIT">Tập thể</option></select></label>
 {input('subjectId','Mã giảng viên / đơn vị','number')}{input('awardTypeId','Mã loại khen thưởng','number')}{input('recognitionYear','Năm ghi nhận','number')}{input('decisionId','Mã quyết định có sẵn (dùng chung nhiều người)','number',false)}
 {!form.decisionId && <>{input('decisionNumber','Số quyết định')}{input('decisionDate','Ngày quyết định','date')}{input('issuer','Cơ quan ban hành')}{input('title','Tên quyết định')}</>}
 {input('achievementIds','Mã thành tích tùy chọn, ngăn bằng dấu phẩy','text',false)}{input('replacesAwardRecordId','Mã bản đã thu hồi cần thay thế','number',false)}<button disabled={busy} className="bg-blue-700 text-white rounded p-2">Tạo bản nháp</button></form>
 <div className="flex gap-3"><input aria-label="Mã đơn vị lọc" className="border p-2 text-slate-900" value={unit} onChange={e=>setUnit(e.target.value)} placeholder="Mã đơn vị trong scope"/><button disabled={busy} onClick={()=>run(async()=>setItems((await api.list(unit)).items))}>Tải danh sách</button></div>
 <ul>{items.map(r=><li key={r.record_id}><button onClick={()=>run(async()=>setDetail(await api.detail(r.record_id)))}>#{r.record_id} — {r.lecturer_id ? `Cá nhân ${r.lecturer_id}` : `Tập thể ${r.unit_id}`} — {r.recognition_year} — {r.status}</button></li>)}</ul>
 {detail && <article className="border rounded p-4 space-y-3"><h2 className="font-bold">Bản ghi #{detail.record_id} — {detail.status} — v{detail.version}</h2><p>{detail.decision.decision_number} / {String(detail.decision.decision_date).slice(0,10)} / {detail.decision.issuer}</p>
 <ul>{detail.files.map(f=><li key={f.decision_file_id}><button onClick={()=>run(()=>api.download(f))}>Tải {f.original_file_name} (v{f.version_no})</button></li>)}</ul>
 {detail.status==='DRAFT' && <><input type="file" aria-label="File quyết định" accept=".pdf,.docx,.jpg,.jpeg,.png" onChange={e=>setFile(e.target.files[0])}/><button disabled={busy || !file} onClick={()=>run(async()=>{await api.upload(detail.decision_id,file);setDetail(await api.detail(detail.record_id));})}>Tải file quyết định</button><button disabled={busy || !detail.files.length} className="block bg-green-700 text-white p-2 rounded" onClick={()=>run(async()=>{await api.transition(detail.record_id,'record',{version:Number(detail.version)});setDetail(await api.detail(detail.record_id));})}>Ghi nhận RECORDED</button></>}
 {detail.status==='RECORDED' && <><input aria-label="Lý do thu hồi" className="border p-2 text-slate-900" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Lý do thu hồi bắt buộc"/><button disabled={busy || !reason.trim()} onClick={()=>run(async()=>{await api.transition(detail.record_id,'revoke',{version:Number(detail.version),reason});setDetail(await api.detail(detail.record_id));})}>Thu hồi</button></>}
 <h3>Lịch sử</h3><ul>{detail.histories.map(h=><li key={h.history_id}>{h.from_status || 'Khởi tạo'} → {h.to_status} — {h.reason} — {h.created_at}</li>)}</ul></article>}
 </section>;
}
