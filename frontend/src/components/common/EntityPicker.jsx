import React, { useState } from 'react';
import Select from './Select';

export const lecturerLabel = l => [l.name,l.employeeCode,l.unitName].filter(Boolean).join(' · ');
export const recordLabel = r => [r.title,r.decisionNumber,r.year].filter(Boolean).join(' · ');
const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();

export function EntitySelect({label,options,value,onChange,placeholder='Chọn một mục',required=false,disabled=false,className='soft-input w-full',getLabel=o=>o.name}) {
  return <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
    {label}<Select aria-label={label} className={className} required={required} disabled={disabled} value={value || ''} onChange={e=>onChange(e.target.value)}>
      <option value="">{placeholder}</option>{options.map(o=><option key={o.id} value={o.id} disabled={o.disabled}>{getLabel(o)}</option>)}
    </Select>
  </label>;
}

export function RecordPicker({label,options,value=[],onChange,loading=false,disabled=false,emptyMessage='Chưa có hồ sơ phù hợp.',getLabel=recordLabel}) {
  const [search,setSearch] = useState('');
  const selected = new Set(value.map(String));
  const visible = options.filter(o=>normalize(getLabel(o)).includes(normalize(search)));
  function toggle(id,checked) { onChange(checked ? [...value.map(String),String(id)] : value.filter(v=>String(v)!==String(id))); }
  return <fieldset disabled={disabled || loading} className="min-w-0 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <legend className="px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}{selected.size ? ` (${selected.size} đã chọn)` : ''}</legend>
    <input type="search" aria-label={`Tìm ${label.toLocaleLowerCase('vi')}`} className="soft-input w-full text-sm" placeholder="Tìm theo tên hồ sơ" value={search} onChange={e=>setSearch(e.target.value)} />
    {loading ? <p role="status" className="text-xs text-slate-500">Đang tải hồ sơ…</p> : <div className="max-h-48 space-y-2 overflow-y-auto">
      {visible.map(o=><label key={o.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-teal-50 dark:hover:bg-teal-950/30"><input type="checkbox" className="mt-1 accent-teal-600" checked={selected.has(String(o.id))} onChange={e=>toggle(o.id,e.target.checked)} /><span className="break-words">{getLabel(o)}</span></label>)}
      {!visible.length && <p className="text-xs text-slate-500">{options.length ? 'Không tìm thấy hồ sơ khớp từ khóa.' : emptyMessage}</p>}
    </div>}
  </fieldset>;
}
