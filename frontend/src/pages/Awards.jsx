import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Select from '../components/common/Select';
import PageHeader from '../components/common/PageHeader';
import { EntitySelect, RecordPicker, lecturerLabel, recordLabel } from '../components/common/EntityPicker';
import { useSelectionOptions, useSelectionSources } from '../hooks/useSelections';
import { Award, Eye, X, FileText, UploadCloud, Download, History } from 'lucide-react';
import { awardsApi as api } from '../services/awardsApi';

const field = 'soft-input w-full';
const statuses = {DRAFT:'Bản nháp',RECORDED:'Đã ghi nhận',REVOKED:'Đã thu hồi'};
const badgeStyles = {DRAFT:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',RECORDED:'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',REVOKED:'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'};
export default function Awards() {
  const [form,setForm] = useState({subjectType:'LECTURER',recognitionYear:new Date().getFullYear(),achievementIds:[]});
  const [unit,setUnit] = useState('');
  const [readyItems,setReadyItems] = useState([]);
  const [readyLoading,setReadyLoading] = useState(true);
  const [readyError,setReadyError] = useState('');
  const [selectedApplicationId,setSelectedApplicationId] = useState(null);
  const [handoffForm,setHandoffForm] = useState({recognitionYear:new Date().getFullYear()});
  const [manualOpen,setManualOpen] = useState(false);
  const selectedApplication = readyItems.find(row=>row.application_id===selectedApplicationId);
  const readyRequest = useRef(0);
  const [items,setItems] = useState([]);
  const [detail,setDetail] = useState(null);
  const [file,setFile] = useState(null);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [listLoading,setListLoading] = useState(true);
  const [reason,setReason] = useState('');
  const dialog = useRef(null);
  const [detailLoading,setDetailLoading] = useState(false);
  const [detailError,setDetailError] = useState('');
  const [detailOpen,setDetailOpen] = useState(false);
  const choices = useSelectionOptions('AWARD');
  const sources = useSelectionSources('AWARD',form.subjectType,form.subjectId);
  const subjects = form.subjectType==='LECTURER' ? choices.lecturers : choices.subjectUnits;
  const run = async fn => {setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(e.message || 'Thao tác thất bại');}finally{setBusy(false);}};
  const loadItems = useCallback(async(fresh=false)=>{
    const readAll = async id => { const rows=[]; let page=1, more; do { const out=await api.list(id,fresh,page++); rows.push(...(out.items || [])); more=out.hasMore; } while(more); return rows; };
    if(unit) return readAll(unit);
    const lists=await Promise.all(choices.workflowUnits.map(u=>readAll(u.id)));
    return [...new Map(lists.flat().map(r=>[r.record_id,r])).values()].sort((a,b)=>Number(b.record_id)-Number(a.record_id));
  },[unit,choices.workflowUnits]);
  useEffect(()=>{
    let active=true;
    if(choices.loading)return;
    setListLoading(true);setItems([]);
    loadItems().then(rows=>{if(active)setItems(rows);}).catch(e=>{if(active)setMessage(e.message);}).finally(()=>{if(active)setListLoading(false);});
    return()=>{active=false;};
  },[choices.loading,loadItems]);
  const loadReady = useCallback(async()=>{
    const requestId=++readyRequest.current;
    setReadyLoading(true);setReadyError('');
    if(choices.loading){setReadyItems([]);return;}
    if(choices.error){setReadyItems([]);setSelectedApplicationId(null);setReadyError(choices.error);setReadyLoading(false);return;}
    try {
      const readAll=async contextUnitId=>{
        const rows=[];let page=1,more;
        do {const out=await api.readyApplications(contextUnitId,page++);rows.push(...(out.items || []));more=out.hasMore;} while(more);
        return rows;
      };
      const lists=await Promise.all((unit ? [unit] : choices.workflowUnits.map(row=>row.id)).map(readAll));
      const rows=[...new Map(lists.flat().map(row=>[row.application_id,row])).values()].sort((a,b)=>Number(b.application_id)-Number(a.application_id));
      if(requestId===readyRequest.current){setReadyItems(rows);setSelectedApplicationId(id=>rows.some(row=>row.application_id===id) ? id : null);}
    } catch(e) {if(requestId===readyRequest.current){setReadyItems([]);setSelectedApplicationId(null);setReadyError(e.message || 'Không tải được hồ sơ đã xét duyệt.');}}
    finally {if(requestId===readyRequest.current)setReadyLoading(false);}
  },[unit,choices.workflowUnits,choices.loading,choices.error]);
  useEffect(()=>{const tracker=readyRequest;loadReady();return()=>{tracker.current++;};},[loadReady]);
  const input=(name,label,type='text',required=true)=><label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}<input className={field} type={type} required={required} value={form[name] || ''} onChange={e=>setForm({...form,[name]:e.target.value})}/></label>;
  const changeSubject=(subjectType,subjectId='')=>setForm({...form,subjectType,subjectId,awardTypeId:'',achievementIds:[],replacesAwardRecordId:''});
  const openRecord=async(id)=>{
    setDetailOpen(true);setDetailLoading(true);setDetailError('');setDetail(null);setFile(null);setReason('');
    try{setDetail(await api.detail(id,true));}catch(e){setDetailError(e.message || 'Không tải được chi tiết khen thưởng.');}finally{setDetailLoading(false);}
  };
  useEffect(()=>{
    if(!detailOpen)return;
    const previousFocus=document.activeElement;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.current?.focus();
    const keyboard=e=>{
      if(e.key==='Escape' && !busy && !detailLoading)setDetailOpen(false);
      if(e.key==='Tab'){
        const controls=dialog.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]');
        if(!controls?.length)return;
        const first=controls[0],last=controls[controls.length-1];
        if(e.shiftKey && (document.activeElement===first || document.activeElement===dialog.current)){e.preventDefault();last.focus();}
        else if(!e.shiftKey && (document.activeElement===last || document.activeElement===dialog.current)){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',keyboard);
    return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',keyboard);previousFocus?.focus();};
  },[detailOpen,busy,detailLoading]);
  const refreshRecord=async()=>{await openRecord(detail.record_id);setItems(await loadItems(true));await loadReady();choices.refresh();};
  const create=e=>{e.preventDefault();run(async()=>{
    let decisionId=form.decisionId;
    if(!decisionId){const d=await api.decision({decisionNumber:form.decisionNumber,decisionDate:form.decisionDate,issuer:form.issuer,title:form.title});decisionId=d.decision_id;setForm(f=>({...f,decisionId}));}
    const r=await api.create({[form.subjectType==='LECTURER'?'lecturerId':'organizationUnitId']:Number(form.subjectId),awardTypeId:Number(form.awardTypeId),decisionId:Number(decisionId),recognitionYear:Number(form.recognitionYear),achievementIds:form.achievementIds.map(Number),...(form.replacesAwardRecordId ? {replacesAwardRecordId:Number(form.replacesAwardRecordId)} : {})});
    await openRecord(r.record_id);setItems(await loadItems(true));await loadReady();choices.refresh();setMessage('Đã tạo bản nháp. Tải file quyết định và ghi nhận khi đủ thông tin.');
  });};
  const prepareApplication=e=>{e.preventDefault();if(!selectedApplication || selectedApplication.linked_record_id)return;
    const application=selectedApplication;
    run(async()=>{
      try {
        let decisionId=handoffForm.decisionId;
        if(!decisionId){const d=await api.decision({decisionNumber:handoffForm.decisionNumber,decisionDate:handoffForm.decisionDate,issuer:handoffForm.issuer,title:handoffForm.title});decisionId=d.decision_id;setHandoffForm(f=>({...f,decisionId}));}
        const record=await api.createFromApplication(application.application_id,{applicationVersion:Number(application.version),decisionId:Number(decisionId),recognitionYear:Number(handoffForm.recognitionYear)});
        setReadyItems(rows=>rows.map(row=>row.application_id===application.application_id ? {...row,linked_record_id:record.record_id,linked_record_status:record.status} : row));
        setSelectedApplicationId(null);setHandoffForm({recognitionYear:new Date().getFullYear()});
        await openRecord(record.record_id);setItems(await loadItems(true));choices.refresh();
        setMessage('Đã tạo bản nháp từ hồ sơ Hội đồng đề nghị. Tải tệp quyết định và ghi nhận khi đủ thông tin.');
      } finally {await loadReady();}
    });
  };
  const handoffInput=(name,label,type='text')=><label className="space-y-1.5 text-xs font-semibold">{label}<input className={field} required type={type} value={handoffForm[name] || ''} onChange={e=>setHandoffForm({...handoffForm,[name]:e.target.value})}/></label>;
  const subjectName=r=>r.subject_name || (r.lecturer_id ? choices.lecturers.find(l=>String(l.id)===String(r.lecturer_id))?.name : choices.subjectUnits.find(u=>String(u.id)===String(r.unit_id))?.name) || (r.lecturer_id ? 'Cá nhân' : 'Tập thể');
  return <section className="space-y-5 text-slate-800 dark:text-slate-100">
    <PageHeader title="Khen thưởng" description="Chuẩn bị khen thưởng từ hồ sơ đã được đề nghị, bổ sung quyết định và ghi nhận." icon={Award} onRefresh={()=>run(async()=>{setItems(await loadItems(true));await loadReady();choices.refresh();})} refreshing={busy || listLoading || readyLoading}/>
    {message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{message}</p>}
    {(choices.error || sources.error) && <p role="alert" className="text-sm text-rose-600">{choices.error || sources.error}</p>}
    <EntitySelect label="Đơn vị xem sổ khen thưởng và hồ sơ chờ chuẩn bị" options={choices.workflowUnits} value={unit} onChange={setUnit} placeholder="Tất cả đơn vị trong phạm vi" disabled={choices.loading || busy}/>
    <section className="soft-card space-y-4 p-6" aria-labelledby="ready-awards-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="ready-awards-title" className="font-bold">Hồ sơ đã được đề nghị – chờ chuẩn bị khen thưởng</h2><button type="button" disabled={busy || readyLoading} className="soft-btn-secondary" onClick={()=>choices.error ? choices.refresh() : loadReady()}>Tải lại danh sách</button></div>
      <p className="text-sm text-slate-500">Chọn hồ sơ Hội đồng đã đề nghị. Chủ thể, loại khen thưởng và nguồn thành tích được giữ theo hồ sơ đã xét duyệt; chuyên viên bổ sung quyết định đã ban hành.</p>
      {readyLoading ? <p role="status" className="text-sm text-slate-500">Đang tải hồ sơ đã xét duyệt…</p> : readyError ? <p role="alert" className="text-sm text-rose-600">{readyError} <button type="button" className="underline" disabled={busy} onClick={()=>choices.error ? choices.refresh() : loadReady()}>Thử lại</button></p> : <ul className="grid gap-3 md:grid-cols-2">{readyItems.map(row=><li key={row.application_id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="font-semibold">{row.subject_name || (row.lecturer_id ? 'Cá nhân' : 'Tập thể')}</h3><p className="mt-1 text-sm">{row.award_type_name}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.purpose}</p><p className="mt-1 text-xs text-slate-500">{row.period_name} · Mã hồ sơ #{row.application_id}</p>
        {row.linked_record_id ? <div className="mt-3 space-y-2"><p className="text-sm">Đã chuẩn bị bản ghi #{row.linked_record_id} · {statuses[row.linked_record_status] || row.linked_record_status}</p><button type="button" disabled={busy || detailLoading} className="soft-btn-secondary" onClick={()=>openRecord(row.linked_record_id)}>Mở bản ghi</button></div> : <button type="button" disabled={busy} className="soft-btn-secondary mt-3" aria-pressed={selectedApplicationId===row.application_id} onClick={()=>{setSelectedApplicationId(row.application_id);setHandoffForm({recognitionYear:new Date().getFullYear()});}}>Chuẩn bị khen thưởng</button>}
      </li>)}{!readyItems.length && <li className="text-sm text-slate-500">{!unit && !choices.workflowUnits.length ? 'Bạn chưa được phân công đơn vị để chuẩn bị khen thưởng. Liên hệ quản trị viên để kiểm tra phạm vi.' : 'Chưa có hồ sơ được đề nghị trong phạm vi đã chọn.'}</li>}</ul>}
      {selectedApplication && !selectedApplication.linked_record_id && !readyLoading && !readyError && <form onSubmit={prepareApplication} className="grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-700 md:grid-cols-2">
        <h3 className="font-bold md:col-span-2">Chuẩn bị {selectedApplication.award_type_name} cho {selectedApplication.subject_name}</h3>
        <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800 md:col-span-2 md:grid-cols-2">
          <div><dt className="text-slate-500">Chủ thể (theo hồ sơ)</dt><dd className="font-semibold">{selectedApplication.subject_name}</dd></div>
          <div><dt className="text-slate-500">Loại khen thưởng (theo hồ sơ)</dt><dd className="font-semibold">{selectedApplication.award_type_name}</dd></div>
          <div className="md:col-span-2"><dt className="text-slate-500">Thành tích trong bản nộp đã xét duyệt · Hồ sơ #{selectedApplication.application_id}</dt><dd className="mt-2 space-y-3">{(selectedApplication.achievement_ids || []).map(id=>{const source=(selectedApplication.achievement_sources || []).find(a=>String(a.id)===String(id));return <div key={id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><p className="font-semibold">{source?.title || `Thành tích #${id}`}</p>{source?.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{source.description}</p>}<div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">Mã #{id}{source?.recognitionYear ? ` · Năm ${source.recognitionYear}` : ''}</span><Link to={`/achievements?id=${id}`} className="text-sm font-semibold text-teal-700 underline dark:text-teal-300">Xem thành tích hiện tại</Link></div></div>;})}</dd></div>
          <div className="md:col-span-2"><dt className="text-slate-500">Mục đích đề nghị</dt><dd className="break-words">{selectedApplication.purpose || '—'}</dd></div>
        </dl>
        {handoffInput('recognitionYear','Năm ghi nhận','number')}
        <EntitySelect label="Quyết định khen thưởng" options={choices.decisions} value={handoffForm.decisionId} onChange={decisionId=>setHandoffForm({...handoffForm,decisionId})} placeholder="Nhập quyết định mới" getLabel={d=>[d.decisionNumber,d.title,d.date].join(' · ')} disabled={busy || choices.loading}/>
        {!handoffForm.decisionId && <>{handoffInput('decisionNumber','Số quyết định')}{handoffInput('decisionDate','Ngày quyết định','date')}{handoffInput('issuer','Cơ quan ban hành')}{handoffInput('title','Tên quyết định')}</>}
        <div className="flex flex-wrap gap-2 md:col-span-2"><button disabled={busy || choices.loading} className="soft-btn-primary">Tạo bản nháp từ hồ sơ</button><button type="button" disabled={busy} className="soft-btn-secondary" onClick={()=>setSelectedApplicationId(null)}>Hủy chọn</button></div>
      </form>}
    </section>
    <details open={manualOpen} onToggle={e=>setManualOpen(e.currentTarget.open)} className="soft-card">
      <summary className="cursor-pointer p-6 font-bold">Nhập khen thưởng theo quyết định ngoài luồng đề nghị</summary>
      <p className="px-6 text-sm text-slate-500">Dùng cho quyết định chưa có hồ sơ đề nghị trong hệ thống. Nếu hồ sơ đã được Hội đồng đề nghị, chọn ở danh sách phía trên để giữ đúng thông tin đã xét duyệt.</p>
    <form onSubmit={create} className="grid gap-4 p-6 md:grid-cols-2">
      <h2 className="font-bold md:col-span-2">Chuẩn bị bản ghi ngoài luồng đề nghị</h2>
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
    </details>
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Sổ khen thưởng <span className="text-sm font-normal text-slate-500">({items.length} bản ghi)</span></h2>
      {listLoading ? <p role="status" className="text-sm text-slate-500">Đang tải sổ khen thưởng…</p> : <ul className="grid gap-3 md:grid-cols-2">{items.map(r=><li key={r.record_id} className="soft-card flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold">{subjectName(r)}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{choices.awardTypes.find(t=>String(t.id)===String(r.award_type_id))?.name || 'Khen thưởng'}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[r.status] || badgeStyles.DRAFT}`}>{statuses[r.status] || r.status}</span></div>
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><FileText className="h-4 w-4 shrink-0"/>Quyết định: {choices.decisions.find(d=>String(d.id)===String(r.decision_id))?.decisionNumber || r.decision_number || '—'}</p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-700"><span className="text-xs text-slate-500">Năm {r.recognition_year} · #{r.record_id}</span><button disabled={busy || detailLoading} className="soft-btn-secondary text-xs" onClick={()=>openRecord(r.record_id)}><Eye className="h-4 w-4"/>Xem chi tiết</button></div>
      </li>)}{!items.length && <li className="soft-card p-8 text-center text-sm text-slate-500 md:col-span-2">Chưa có bản ghi trong phạm vi đã chọn.</li>}</ul>}
    </div>
    {detailOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <article ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="award-detail-title" className="soft-card max-h-[90dvh] w-full max-w-3xl space-y-5 overflow-y-auto p-5 outline-none sm:p-7">
        <div className="flex items-center justify-between gap-4"><h2 id="award-detail-title" className="text-lg font-bold">Chi tiết khen thưởng{detail ? ` #${detail.record_id}` : ''}</h2><button disabled={busy || detailLoading} aria-label="Đóng chi tiết khen thưởng" className="soft-btn-secondary !p-2" onClick={()=>setDetailOpen(false)}><X className="h-5 w-5"/></button></div>
        {detailLoading && <p role="status" className="text-sm text-slate-500">Đang tải chi tiết khen thưởng…</p>}
        {detailError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{detailError}</p>}
        {message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{message}</p>}
        {detail && <>
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold">{subjectName(detail)}</h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[detail.status]}`}>{statuses[detail.status]}</span></div>
          <dl className="grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800 sm:grid-cols-2">
            {[
              ['Loại khen thưởng',choices.awardTypes.find(t=>String(t.id)===String(detail.award_type_id))?.name],
              ['Năm ghi nhận',detail.recognition_year],['Số quyết định',detail.decision?.decision_number],
              ['Ngày quyết định',detail.decision?.decision_date ? new Date(detail.decision.decision_date).toLocaleDateString('vi-VN') : null],
              ['Cơ quan ban hành',detail.decision?.issuer],['Tên quyết định',detail.decision?.title],
              ['Đơn vị ghi nhận',choices.workflowUnits.find(u=>String(u.id)===String(detail.context_unit_id))?.name],
              ['Bản ghi thay thế',detail.replaces_award_record_id ? `#${detail.replaces_award_record_id}` : 'Không có'],
              ['Hồ sơ đề nghị',detail.application_id ? `#${detail.application_id}` : 'Nhập ngoài luồng đề nghị'],
            ].map(([label,value])=><div key={label}><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words font-semibold">{value || '—'}</dd></div>)}
          </dl>
          <div className="space-y-2"><h3 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4"/>Tệp quyết định</h3>
            <ul className="space-y-2">{(detail.files || []).map(f=><li key={f.decision_file_id}><button disabled={busy} className="soft-btn-secondary w-full !justify-start text-left" onClick={()=>run(()=>api.download(f))}><Download className="h-4 w-4 shrink-0"/><span className="break-all">{f.original_file_name} · Phiên bản {f.version_no}</span></button></li>)}</ul>
            {!detail.files?.length && <p className="text-sm text-slate-500">Chưa có tệp quyết định.</p>}
          </div>
          {detail.status==='DRAFT' && <div className="space-y-3 rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 p-4 dark:border-teal-800 dark:bg-teal-950/20">
            <p className="flex items-center gap-2 text-sm font-semibold"><UploadCloud className="h-5 w-5 text-teal-600"/>Bổ sung tệp quyết định</p>
            <label className={`flex flex-wrap items-center gap-3 rounded-xl focus-within:ring-2 focus-within:ring-teal-500 ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
              <input disabled={busy} className="sr-only" type="file" aria-label="File quyết định" accept=".pdf,.docx,.jpg,.jpeg,.png" onChange={e=>setFile(e.target.files[0] || null)}/>
              <span className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white"><UploadCloud className="h-4 w-4"/>Chọn tệp</span><span className="min-w-0 break-all text-sm text-slate-500 dark:text-slate-400">{file?.name || 'Chưa chọn tệp'}</span>
            </label>
            <p className="text-xs text-slate-500">Chọn PDF, DOCX, JPG hoặc PNG để tải lên trước khi ghi nhận.</p>
            <div className="flex flex-wrap gap-2"><button disabled={busy || !file} className="soft-btn-secondary" onClick={()=>run(async()=>{await api.upload(detail.decision_id,file);await refreshRecord();})}>Tải file quyết định</button><button disabled={busy || !detail.files?.length} className="soft-btn-primary" onClick={()=>run(async()=>{await api.transition(detail.record_id,'record',{version:Number(detail.version)});await refreshRecord();})}>Ghi nhận khen thưởng</button></div>
          </div>}
          {detail.status==='RECORDED' && <div className="space-y-3"><label className="block space-y-2 text-sm font-semibold">Lý do thu hồi<input aria-label="Lý do thu hồi" className={field} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Nhập lý do thu hồi bắt buộc"/></label><button disabled={busy || !reason.trim()} className="soft-btn-secondary text-rose-600" onClick={()=>run(async()=>{await api.transition(detail.record_id,'revoke',{version:Number(detail.version),reason});await refreshRecord();})}>Thu hồi</button></div>}
          {detail.status==='REVOKED' && <button disabled={busy} className="soft-btn-secondary" onClick={()=>{
            if(detail.application_id){setSelectedApplicationId(detail.application_id);setHandoffForm({recognitionYear:detail.recognition_year});setMessage('Chọn hồ sơ đã đề nghị ở danh sách trên để chuẩn bị bản thay thế với quyết định mới.');}
            else {setManualOpen(true);setForm({subjectType:detail.lecturer_id?'LECTURER':'UNIT',subjectId:String(detail.lecturer_id || detail.unit_id),awardTypeId:detail.award_type_id,recognitionYear:detail.recognition_year,replacesAwardRecordId:detail.record_id,achievementIds:(detail.achievementIds || []).map(String)});setMessage('Đã chọn chủ thể và bản thay thế. Nhập quyết định sửa sai rồi tạo nháp mới.');}
            setDetailOpen(false);window.scrollTo({top:0,behavior:'smooth'});
          }}>Chuẩn bị bản thay thế</button>}
          <div className="space-y-2"><h3 className="font-semibold">Thành tích liên quan</h3><div className="flex flex-wrap gap-2">{(detail.achievementIds || []).map(id=><Link key={id} to={`/achievements?id=${id}`} className="soft-btn-secondary text-sm">Thành tích #{id}<Eye className="h-4 w-4"/></Link>)}</div>{!detail.achievementIds?.length && <p className="text-sm text-slate-500">Không có thành tích liên kết.</p>}</div>
          <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-700"><h3 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4"/>Lịch sử</h3><ul className="space-y-3">{(detail.histories || []).map(h=><li key={h.history_id} className="border-l-2 border-teal-200 pl-3 text-sm dark:border-teal-800"><p className="font-semibold">{statuses[h.from_status] || 'Khởi tạo'} → {statuses[h.to_status] || h.to_status}</p>{h.reason && <p className="mt-1 break-words text-slate-600 dark:text-slate-300">{h.reason}</p>}<time className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString('vi-VN')}</time></li>)}</ul>{!detail.histories?.length && <p className="text-sm text-slate-500">Chưa có lịch sử.</p>}</div>
        </>}
      </article>
    </div>}
  </section>;
}
