import React, { useCallback, useEffect, useState } from 'react';
import Select from '../components/common/Select';
import PageHeader from '../components/common/PageHeader';
import { EntitySelect, RecordPicker, lecturerLabel, recordLabel } from '../components/common/EntityPicker';
import { useSelectionOptions, useSelectionSources } from '../hooks/useSelections';
import { Award } from 'lucide-react';
import { awardsApi as api } from '../services/awardsApi';

const field = 'soft-input w-full';
const statuses = {DRAFT:'Bản nháp',RECORDED:'Đã ghi nhận',REVOKED:'Đã thu hồi'};
export default function Awards() {
  const [form,setForm] = useState({subjectType:'LECTURER',recognitionYear:new Date().getFullYear(),achievementIds:[]});
  const [unit,setUnit] = useState('');
  const [items,setItems] = useState([]);
  const [detail,setDetail] = useState(null);
  const [file,setFile] = useState(null);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [listLoading,setListLoading] = useState(true);
  const [reason,setReason] = useState('');
  const choices = useSelectionOptions('AWARD');
  const sources = useSelectionSources('AWARD',form.subjectType,form.subjectId);
  const subjects = form.subjectType==='LECTURER' ? choices.lecturers : choices.subjectUnits;
  const run = async fn => {setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(e.message || 'Thao tác thất bại');}finally{setBusy(false);}};
  const loadItems = useCallback(async(fresh=false)=>{
    if(unit) return (await api.list(unit,fresh)).items || [];
    const lists=await Promise.all(choices.workflowUnits.map(u=>api.list(u.id,fresh)));
    return [...new Map(lists.flatMap(out=>out.items || []).map(r=>[r.record_id,r])).values()].sort((a,b)=>Number(b.record_id)-Number(a.record_id));
  },[unit,choices.workflowUnits]);
  useEffect(()=>{
    let active=true;
    if(choices.loading)return;
    setListLoading(true);setItems([]);
    loadItems().then(rows=>{if(active)setItems(rows);}).catch(e=>{if(active)setMessage(e.message);}).finally(()=>{if(active)setListLoading(false);});
    return()=>{active=false;};
  },[choices.loading,loadItems]);
  const input=(name,label,type='text',required=true)=><label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}<input className={field} type={type} required={required} value={form[name] || ''} onChange={e=>setForm({...form,[name]:e.target.value})}/></label>;
  const changeSubject=(subjectType,subjectId='')=>setForm({...form,subjectType,subjectId,awardTypeId:'',achievementIds:[],replacesAwardRecordId:''});
  const openRecord=async(id)=>{setDetail(await api.detail(id));setFile(null);setReason('');};
  const refreshRecord=async()=>{await openRecord(detail.record_id);setItems(await loadItems(true));choices.refresh();};
  const create=e=>{e.preventDefault();run(async()=>{
    let decisionId=form.decisionId;
    if(!decisionId){const d=await api.decision({decisionNumber:form.decisionNumber,decisionDate:form.decisionDate,issuer:form.issuer,title:form.title});decisionId=d.decision_id;setForm(f=>({...f,decisionId}));}
    const r=await api.create({[form.subjectType==='LECTURER'?'lecturerId':'organizationUnitId']:Number(form.subjectId),awardTypeId:Number(form.awardTypeId),decisionId:Number(decisionId),recognitionYear:Number(form.recognitionYear),achievementIds:form.achievementIds.map(Number),...(form.replacesAwardRecordId ? {replacesAwardRecordId:Number(form.replacesAwardRecordId)} : {})});
    await openRecord(r.record_id);setItems(await loadItems(true));choices.refresh();setMessage('Đã tạo bản nháp. Tải file quyết định và ghi nhận khi đủ thông tin.');
  });};
  const subjectName=r=>r.subject_name || (r.lecturer_id ? choices.lecturers.find(l=>String(l.id)===String(r.lecturer_id))?.name : choices.subjectUnits.find(u=>String(u.id)===String(r.unit_id))?.name) || (r.lecturer_id ? 'Cá nhân' : 'Tập thể');
  return <section className="space-y-5 text-slate-800 dark:text-slate-100">
    <PageHeader title="Khen thưởng" description="Nhập quyết định đã ban hành và ghi nhận khen thưởng cá nhân, tập thể." icon={Award} onRefresh={()=>run(async()=>{setItems(await loadItems(true));choices.refresh();})} refreshing={busy || listLoading}/>
    {message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{message}</p>}
    {(choices.error || sources.error) && <p role="alert" className="text-sm text-rose-600">{choices.error || sources.error}</p>}
    <form onSubmit={create} className="soft-card grid gap-4 p-6 md:grid-cols-2">
      <h2 className="font-bold md:col-span-2">Chuẩn bị bản ghi khen thưởng</h2>
      <label className="space-y-1.5 text-xs font-semibold">Chủ thể<Select aria-label="Chủ thể khen thưởng" className={field} value={form.subjectType} onChange={e=>changeSubject(e.target.value)}><option value="LECTURER">Cá nhân</option><option value="UNIT">Tập thể</option></Select></label>
      <EntitySelect label={form.subjectType==='LECTURER' ? 'Giảng viên nhận khen thưởng' : 'Đơn vị nhận khen thưởng'} options={subjects} value={form.subjectId} onChange={id=>changeSubject(form.subjectType,id)} getLabel={form.subjectType==='LECTURER' ? lecturerLabel : o=>o.name} placeholder="Chọn chủ thể" required disabled={choices.loading}/>
      <EntitySelect label="Loại khen thưởng" options={choices.awardTypes.filter(t=>['BOTH',form.subjectType].includes(t.subjectType))} value={form.awardTypeId} onChange={awardTypeId=>setForm({...form,awardTypeId})} placeholder="Chọn loại khen thưởng" required disabled={choices.loading}/>
      {input('recognitionYear','Năm ghi nhận','number')}
      <EntitySelect label="Quyết định khen thưởng" options={choices.decisions} value={form.decisionId} onChange={decisionId=>setForm({...form,decisionId})} placeholder="Nhập quyết định mới" getLabel={d=>[d.decisionNumber,d.title,d.date].join(' · ')} disabled={choices.loading}/>
      {!form.decisionId && <>{input('decisionNumber','Số quyết định')}{input('decisionDate','Ngày quyết định','date')}{input('issuer','Cơ quan ban hành')}{input('title','Tên quyết định')}</>}
      <RecordPicker label="Thành tích liên quan (nếu có)" options={sources.achievements} value={form.achievementIds} onChange={achievementIds=>setForm({...form,achievementIds})} loading={sources.loading} disabled={!form.subjectId} emptyMessage="Chưa có thành tích của chủ thể đã chọn." getLabel={r=>recordLabel(r)+' · '+(r.status==='VERIFIED' ? 'Đã xác nhận' : r.status)}/>
      <EntitySelect label="Bản đã thu hồi cần thay thế (nếu có)" options={sources.awardRecords} value={form.replacesAwardRecordId} onChange={replacesAwardRecordId=>setForm({...form,replacesAwardRecordId})} placeholder="Không thay thế bản ghi nào" disabled={!form.subjectId || sources.loading} getLabel={recordLabel}/>
      <button disabled={busy || choices.loading || sources.loading || !!sources.error || !form.subjectId} className="soft-btn-primary self-end justify-self-start">Tạo bản nháp</button>
    </form>
    <EntitySelect label="Đơn vị xem sổ khen thưởng" options={choices.workflowUnits} value={unit} onChange={setUnit} placeholder="Tất cả đơn vị trong phạm vi" disabled={choices.loading}/>
    {listLoading ? <p role="status" className="text-sm text-slate-500">Đang tải sổ khen thưởng…</p> : <ul className="space-y-2">{items.map(r=><li key={r.record_id}><button className="soft-card w-full p-4 text-left" onClick={()=>run(()=>openRecord(r.record_id))}><strong>{subjectName(r)}</strong> · {choices.awardTypes.find(t=>String(t.id)===String(r.award_type_id))?.name || 'Khen thưởng'} · {r.recognition_year} · {statuses[r.status]}<span className="block text-xs text-slate-500">{choices.decisions.find(d=>String(d.id)===String(r.decision_id))?.decisionNumber || r.decision_number}</span></button></li>)}{!items.length && <li className="text-sm text-slate-500">Chưa có bản ghi trong phạm vi đã chọn.</li>}</ul>}
    {detail && <article className="soft-card space-y-3 p-5">
      <h2 className="font-bold">{subjectName(detail)} · {statuses[detail.status]}</h2><p>{detail.decision.decision_number} / {String(detail.decision.decision_date).slice(0,10)} / {detail.decision.issuer}</p>
      <ul>{detail.files.map(f=><li key={f.decision_file_id}><button className="soft-btn-secondary" onClick={()=>run(()=>api.download(f))}>Tải {f.original_file_name} (v{f.version_no})</button></li>)}</ul>
      {detail.status==='DRAFT' && <><input type="file" aria-label="File quyết định" accept=".pdf,.docx,.jpg,.jpeg,.png" onChange={e=>setFile(e.target.files[0])}/><button disabled={busy || !file} className="soft-btn-secondary" onClick={()=>run(async()=>{await api.upload(detail.decision_id,file);await refreshRecord();})}>Tải file quyết định</button><button disabled={busy || !detail.files.length} className="soft-btn-primary" onClick={()=>run(async()=>{await api.transition(detail.record_id,'record',{version:Number(detail.version)});await refreshRecord();})}>Ghi nhận khen thưởng</button></>}
      {detail.status==='RECORDED' && <><input aria-label="Lý do thu hồi" className={field} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Lý do thu hồi bắt buộc"/><button disabled={busy || !reason.trim()} className="soft-btn-secondary" onClick={()=>run(async()=>{await api.transition(detail.record_id,'revoke',{version:Number(detail.version),reason});await refreshRecord();})}>Thu hồi</button></>}
      {detail.status==='REVOKED' && <button disabled={busy} className="soft-btn-secondary" onClick={()=>{setForm({subjectType:detail.lecturer_id?'LECTURER':'UNIT',subjectId:String(detail.lecturer_id || detail.unit_id),awardTypeId:detail.award_type_id,recognitionYear:detail.recognition_year,replacesAwardRecordId:detail.record_id,achievementIds:detail.achievementIds.map(String)});setMessage('Đã chọn chủ thể và bản thay thế. Nhập quyết định sửa sai rồi tạo nháp mới.');}}>Chuẩn bị bản thay thế</button>}
      <h3 className="font-semibold">Lịch sử</h3><ul>{detail.histories.map(h=><li key={h.history_id} className="text-sm">{statuses[h.from_status] || 'Khởi tạo'} → {statuses[h.to_status]} · {h.reason} · {new Date(h.created_at).toLocaleString('vi-VN')}</li>)}</ul>
    </article>}
  </section>;
}
