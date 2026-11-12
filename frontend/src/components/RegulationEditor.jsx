import Select from './common/Select';
import React, { useEffect, useState } from 'react';
import { regulationsApi } from '../services/regulationsApi';

function useSourceCatalogs() {
  const [catalogs, setCatalogs] = useState({});
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    regulationsApi.getSourceCatalogs().then(data => { if (active) setCatalogs(data); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  return { catalogs, error };
}

function SourceFields({ value, onChange, targetType }) {
  const { catalogs, error } = useSourceCatalogs();
  const sourceType = value?.sourceType || '';
  const idKey = sourceType === 'ACHIEVEMENT' ? 'achievementTypeIds' : 'awardTypeIds';
  const ids = value?.[idKey] || [];
  const subject = targetType === 'INDIVIDUAL' ? 'LECTURER' : targetType === 'COLLECTIVE' ? 'UNIT' : 'BOTH';
  const options = (catalogs[sourceType] || []).filter(row =>
    (row.is_active && (row.applicable_subject_type === 'BOTH' || row.applicable_subject_type === subject)) || ids.includes(Number(row.id)));
  return <fieldset className="space-y-2 sm:col-span-2 text-xs">
    <legend className="font-semibold">Nguồn hồ sơ để tính tiêu chí</legend>
    {error && <p role="alert" className="text-rose-600">{error}</p>}
    <Select aria-label="Nguồn hồ sơ" value={sourceType} onChange={e => onChange(e.target.value ? { sourceType: e.target.value, [e.target.value === 'ACHIEVEMENT' ? 'achievementTypeIds' : 'awardTypeIds']: [] } : null)} className="soft-input w-full">
      <option value="">Chưa ánh xạ (cần người rà soát)</option><option value="ACHIEVEMENT">Thành tích đã xác minh</option><option value="AWARD_RECORD">Khen thưởng đã ghi nhận</option>
    </Select>
    {sourceType && <div className="max-h-44 overflow-auto space-y-2">{options.map(row => <label key={row.id} className="flex items-center gap-2"><input type="checkbox" checked={ids.includes(Number(row.id))} onChange={e => onChange({ ...value, [idKey]: e.target.checked ? [...ids, Number(row.id)] : ids.filter(id => id !== Number(row.id)) })} />{row.code} — {row.name}{!row.is_active && ' (đã ngừng dùng — hãy bỏ chọn)'}</label>)}{!options.length && <p>Không có loại hồ sơ phù hợp.</p>}</div>}
    {sourceType && !ids.length && <p className="text-amber-700">Chọn ít nhất một loại hồ sơ trước khi lưu.</p>}
    {sourceType && <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(value.requireConsecutive)} onChange={e => onChange({ ...value, requireConsecutive: e.target.checked })} />Yêu cầu các năm liên tiếp (khi đơn vị đo là năm)</label>}
  </fieldset>;
}

export function CriterionSources({ criterion, canConfigure, onSaved }) {
  const { catalogs } = useSourceCatalogs();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(criterion.source_rules || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      await regulationsApi.configureSourceRules(criterion.criteria_version_id, { sourceRules: value, expectedRevision: criterion.source_rules_revision || 0 });
      setOpen(false); await onSaved();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const rules = criterion.source_rules;
  const labels = rules ? (rules.achievementTypeIds || rules.awardTypeIds || []).map(id => {
    const row = (catalogs[rules.sourceType] || []).find(item => Number(item.id) === Number(id));
    return row ? `${row.code} — ${row.name}${row.is_active ? '' : ' (đã ngừng dùng)'}` : `Loại #${id} (chưa có trong danh mục)`;
  }).join('; ') : '';
  return <div className="mt-2 space-y-2 text-xs">
    <p>{rules ? `${rules.sourceType === 'ACHIEVEMENT' ? 'Thành tích' : 'Khen thưởng'}: ${labels} · cấu hình v${criterion.source_rules_revision}${rules.requireConsecutive ? ' · yêu cầu năm liên tiếp' : ''}` : 'Chưa ánh xạ nguồn hồ sơ'}</p>
    {canConfigure && <button type="button" className="soft-btn text-xs" onClick={() => { setOpen(!open); setValue(criterion.source_rules || null); }}>Cấu hình nguồn</button>}
    {open && <div className="space-y-2"><SourceFields value={value} onChange={setValue} targetType={criterion.target_type} /><p>Đổi nguồn sẽ bỏ phê duyệt tiêu chí. Cần kiểm tra và phê duyệt lại trước khi áp dụng.</p><button type="button" onClick={save} disabled={busy || Boolean(value && !(value.achievementTypeIds || value.awardTypeIds)?.length)} className="soft-btn-primary text-xs">{busy ? 'Đang lưu…' : 'Lưu nguồn'}</button></div>}
    {error && <p role="alert" className="text-rose-600">{error}</p>}
  </div>;
}

export default function RegulationEditor({ version, mode, onSaved, canConfigureSources = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ targetType: 'INDIVIDUAL' });
  const chunks = mode === 'chunks';
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (chunks) await regulationsApi.addChunks(version.version_id, [{ content: form.content, articleNo: form.articleNo || null, clauseNo: form.clauseNo || null }]);
      else await regulationsApi.createCriteria(version.version_id, { criterionCode: form.criterionCode, name: form.name, targetType: form.targetType, minThreshold: form.minThreshold === '' || form.minThreshold == null ? null : Number(form.minThreshold), unitMetric: form.unitMetric || null, legalReferences: form.legalReferences || null, notes: form.notes || null, ...(canConfigureSources ? { sourceRules: form.sourceRules || null } : {}) });
      setOpen(false); setForm({ targetType: 'INDIVIDUAL' }); await onSaved();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const fields = chunks ? [['articleNo','Điều'],['clauseNo','Khoản'],['content','Nội dung trích đoạn',true]] : [['criterionCode','Mã tiêu chí'],['name','Tên tiêu chí'],['minThreshold','Ngưỡng tối thiểu'],['unitMetric','Đơn vị đo'],['legalReferences','Căn cứ điều / khoản'],['notes','Ghi chú',true]];
  return <div className="soft-card p-5 space-y-3"><div className="flex flex-wrap justify-between gap-3"><p className="text-sm">Bổ sung vào phiên bản <strong>{version.version_number}</strong>. Tiêu chí mới cần được phê duyệt trước khi áp dụng.</p><button type="button" onClick={()=>setOpen(v=>!v)} className="soft-btn-primary text-xs">{open ? 'Đóng biểu mẫu' : chunks ? 'Thêm trích đoạn' : 'Thêm tiêu chí'}</button></div>{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}{open && <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">{fields.map(([key,label,multiline])=><label key={key} className={`text-xs font-semibold ${multiline ? 'sm:col-span-2' : ''}`}>{label}{multiline ? <textarea required={key==='content'} minLength={key==='content' ? 5 : undefined} maxLength={key==='content' ? 10000 : 2000} value={form[key] || ''} onChange={e=>setForm({...form,[key]:e.target.value})} className="soft-input mt-1 w-full" rows={5} /> : <input required={['criterionCode','name'].includes(key)} type={key==='minThreshold' ? 'number':'text'} min={key==='minThreshold' ? 0 : undefined} step="any" value={form[key] ?? ''} onChange={e=>setForm({...form,[key]:e.target.value})} className="soft-input mt-1 w-full" />}</label>)}{!chunks && <label className="text-xs font-semibold">Đối tượng<Select value={form.targetType} onChange={e=>setForm({...form,targetType:e.target.value,sourceRules:null})} className="soft-input mt-1 w-full"><option value="INDIVIDUAL">Cá nhân</option><option value="COLLECTIVE">Tập thể</option><option value="BOTH">Cả hai</option></Select></label>}{!chunks && canConfigureSources && <SourceFields value={form.sourceRules} targetType={form.targetType} onChange={sourceRules=>setForm({...form,sourceRules})} />}<button disabled={busy || Boolean(form.sourceRules && !(form.sourceRules.achievementTypeIds || form.sourceRules.awardTypeIds)?.length)} className="soft-btn-primary self-end text-sm">{busy ? 'Đang lưu…':'Lưu'}</button></form>}</div>;
}
