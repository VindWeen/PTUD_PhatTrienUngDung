import Select from './common/Select';
import React, { useState } from 'react';
import { regulationsApi } from '../services/regulationsApi';

export default function RegulationEditor({ version, mode, onSaved }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ targetType: 'INDIVIDUAL' });
  const chunks = mode === 'chunks';
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (chunks) await regulationsApi.addChunks(version.version_id, [{ content: form.content, articleNo: form.articleNo || null, clauseNo: form.clauseNo || null }]);
      else await regulationsApi.createCriteria(version.version_id, { criterionCode: form.criterionCode, name: form.name, targetType: form.targetType, minThreshold: form.minThreshold === '' || form.minThreshold == null ? null : Number(form.minThreshold), unitMetric: form.unitMetric || null, legalReferences: form.legalReferences || null, notes: form.notes || null });
      setOpen(false); setForm({ targetType: 'INDIVIDUAL' }); await onSaved();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const fields = chunks ? [['articleNo','Điều'],['clauseNo','Khoản'],['content','Nội dung trích đoạn',true]] : [['criterionCode','Mã tiêu chí'],['name','Tên tiêu chí'],['minThreshold','Ngưỡng tối thiểu'],['unitMetric','Đơn vị đo'],['legalReferences','Căn cứ điều / khoản'],['notes','Ghi chú',true]];
  return <div className="soft-card p-5 space-y-3"><div className="flex flex-wrap justify-between gap-3"><p className="text-sm">Bổ sung vào phiên bản <strong>{version.version_number}</strong>. Tiêu chí mới cần được phê duyệt trước khi áp dụng.</p><button type="button" onClick={()=>setOpen(v=>!v)} className="soft-btn-primary text-xs">{open ? 'Đóng biểu mẫu' : chunks ? 'Thêm trích đoạn' : 'Thêm tiêu chí'}</button></div>{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}{open && <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">{fields.map(([key,label,multiline])=><label key={key} className={`text-xs font-semibold ${multiline ? 'sm:col-span-2' : ''}`}>{label}{multiline ? <textarea required={key==='content'} minLength={key==='content' ? 5 : undefined} maxLength={key==='content' ? 10000 : 2000} value={form[key] || ''} onChange={e=>setForm({...form,[key]:e.target.value})} className="soft-input mt-1 w-full" rows={5} /> : <input required={['criterionCode','name'].includes(key)} type={key==='minThreshold' ? 'number':'text'} min={key==='minThreshold' ? 0 : undefined} step="any" value={form[key] ?? ''} onChange={e=>setForm({...form,[key]:e.target.value})} className="soft-input mt-1 w-full" />}</label>)}{!chunks && <label className="text-xs font-semibold">Đối tượng<Select value={form.targetType} onChange={e=>setForm({...form,targetType:e.target.value})} className="soft-input mt-1 w-full"><option value="INDIVIDUAL">Cá nhân</option><option value="COLLECTIVE">Tập thể</option><option value="BOTH">Cả hai</option></Select></label>}<button disabled={busy} className="soft-btn-primary self-end text-sm">{busy ? 'Đang lưu…':'Lưu'}</button></form>}</div>;
}
