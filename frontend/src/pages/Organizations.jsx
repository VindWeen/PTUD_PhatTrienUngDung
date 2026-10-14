import PageHeader from '../components/common/PageHeader';
import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/common/AsyncState';
import { organizationsApi } from '../services/organizationsApi';
import { useSelectionOptions } from '../hooks/useSelections';
import { EntitySelect, lecturerLabel } from '../components/common/EntityPicker';
import Select from '../components/common/Select';

export default function Organizations() {
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN');
  const choices=useSelectionOptions('ORGANIZATION',canManage);
  const [action,setAction]=useState(null);
  const [actionForm,setActionForm]=useState({});
  const [actionError,setActionError]=useState('');
  const hasProfileRole = canManage || ['MANAGER', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE'].some(hasRole);
  const canViewProfile = (unit) => unit.canViewProfile ?? hasProfileRole;
  const [units, setUnits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deniedUnitIds, setDeniedUnitIds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const selectionSequence = React.useRef(0);

  const choose = useCallback(async (id, fresh = false) => {
    const sequence = ++selectionSequence.current;
    setSelectedId(id); setSelected(null);
    setBusy(true); setError(null);
    try {
      const profile = await organizationsApi.getProfile(id, fresh);
      if (sequence === selectionSequence.current) setSelected(profile);
    } catch (e) {
      if (sequence === selectionSequence.current) {
        if (e.status === 403 || ['OUT_OF_SCOPE', 'FORBIDDEN'].includes(e.code)) {
          setDeniedUnitIds(ids => [...new Set([...ids, id])]);
        } else setError(e);
      }
    }
    finally { if (sequence === selectionSequence.current) setBusy(false); }
  }, []);

  const load = useCallback(async (fresh = true) => {
    ++selectionSequence.current;
    setBusy(false);
    setLoading(true); setError(null);
    try {
      const list = await organizationsApi.list(fresh);
      setUnits(list || []);
      setSelected(null);
      setSelectedId(null); setDeniedUnitIds([]);
      setLoading(false);
      const firstReadable = list?.find(unit => unit.canViewProfile ?? hasProfileRole);
      if (firstReadable) await choose(firstReadable.unitId, fresh);
    } catch (e) { setError(e); } finally { setLoading(false); }
  }, [choose, hasProfileRole]);
  useEffect(() => { load(false); }, [load]);
  const remove = async () => {
    if (!selected || !window.confirm(`Xóa đơn vị ${selected.name}?`)) return;
    setBusy(true); setError(null);
    try { await organizationsApi.remove(selected.unitId); setSelected(null); await load(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const createUnit = async () => {
    setAction({kind:'create'});setActionForm({type:'DEPARTMENT',parentId:selected?.unitId || ''});setActionError('');
  };
  const editUnit = async () => {
    const name = window.prompt('Tên đơn vị', selected.name);
    if (!name) return;
    const description = window.prompt('Mô tả hồ sơ đơn vị', selected.description || '');
    setBusy(true); setError(null);
    try {
      const updated = await organizationsApi.update(selected.unitId, { code: selected.code, name, type: selected.type,
        parentId: selected.parentUnit?.unitId || null, description: description || null, isActive: selected.isActive, version: selected.version });
      await load(); setSelected(await organizationsApi.getProfile(updated.unitId));
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const appoint = async () => {
    setAction({kind:'representative',unitId:selected.unitId,unitName:selected.name});setActionForm({});setActionError('');
  };
  const transfer = async () => {
    setAction({kind:'transfer',unitId:selected.unitId,unitName:selected.name});setActionForm({});setActionError('');
  };
  const saveAction=async e=>{
    e.preventDefault();setBusy(true);setActionError('');
    try {
      if(action.kind==='create')await organizationsApi.create({code:actionForm.code,name:actionForm.name,type:actionForm.type,parentId:actionForm.parentId ? Number(actionForm.parentId) : null,description:null});
      else if(action.kind==='representative')await organizationsApi.appointRepresentative(action.unitId,{userId:Number(actionForm.userId),validFrom:new Date().toISOString(),validTo:new Date(`${actionForm.endDate}T23:59:59+07:00`).toISOString()});
      else await organizationsApi.transferLecturer(Number(actionForm.lecturerId),{unitId:action.unitId,effectiveAt:new Date().toISOString()});
      setAction(null);await load();choices.refresh();
    }catch(e){setActionError(e.message);}finally{setBusy(false);}
  };

  return <div className="space-y-6">
    <PageHeader title="Tổ chức" description="Hồ sơ đơn vị, đại diện và cơ cấu trực thuộc." icon={Building2} onRefresh={load} refreshing={loading || busy} primaryAction={canManage ? {label: 'Tạo đơn vị', onClick: createUnit, disabled: busy} : null} />
    {error && <ErrorState error={error} onRetry={load} />}
    {action && <form onSubmit={saveAction} className="soft-card grid gap-4 p-5 sm:grid-cols-2">
      <h2 className="font-bold sm:col-span-2">{action.kind==='create' ? 'Tạo đơn vị' : action.kind==='representative' ? 'Phân công đại diện' : 'Chuyển giảng viên'}{action.unitName ? ` · ${action.unitName}` : ''}</h2>
      {action.kind==='create' ? <>
        <label className="text-xs font-semibold">Mã đơn vị mới<input className="soft-input mt-1 w-full" required value={actionForm.code || ''} onChange={e=>setActionForm({...actionForm,code:e.target.value})}/></label>
        <label className="text-xs font-semibold">Tên đơn vị<input className="soft-input mt-1 w-full" required value={actionForm.name || ''} onChange={e=>setActionForm({...actionForm,name:e.target.value})}/></label>
        <label className="text-xs font-semibold">Loại đơn vị<Select className="soft-input mt-1 w-full" value={actionForm.type} onChange={e=>setActionForm({...actionForm,type:e.target.value})}>{Object.entries({UNIVERSITY:'Trường',FACULTY:'Khoa',DEPARTMENT:'Bộ môn',DIVISION:'Ban',OFFICE:'Phòng',CENTER:'Trung tâm'}).map(([id,name])=><option key={id} value={id}>{name}</option>)}</Select></label>
        <EntitySelect label="Đơn vị cha" options={choices.units} value={actionForm.parentId} onChange={parentId=>setActionForm({...actionForm,parentId})} placeholder="Không có đơn vị cha" disabled={choices.loading}/>
      </> : action.kind==='representative' ? <>
        <EntitySelect label="Người đại diện" options={choices.users} value={actionForm.userId} onChange={userId=>setActionForm({...actionForm,userId})} getLabel={u=>`${u.name} (${u.username})`} placeholder="Chọn tài khoản đã có vai trò đại diện" required disabled={choices.loading}/>
        <label className="text-xs font-semibold">Ngày kết thúc phân công<input type="date" required className="soft-input mt-1 w-full" value={actionForm.endDate || ''} onChange={e=>setActionForm({...actionForm,endDate:e.target.value})}/></label>
      </> : <EntitySelect label="Giảng viên cần chuyển" options={choices.lecturers} value={actionForm.lecturerId} onChange={lecturerId=>setActionForm({...actionForm,lecturerId})} getLabel={lecturerLabel} required disabled={choices.loading} placeholder="Chọn giảng viên"/>}
      {(actionError || choices.error) && <p role="alert" className="text-sm text-rose-600 sm:col-span-2">{actionError || choices.error}</p>}
      <div className="flex gap-2 sm:col-span-2"><button className="soft-btn-primary" disabled={busy || choices.loading}>Lưu</button><button type="button" className="soft-btn-secondary" disabled={busy} onClick={()=>setAction(null)}>Đóng</button></div>
    </form>}
    <div className={`grid gap-6 ${units.some(unit => canViewProfile(unit) && !deniedUnitIds.includes(unit.unitId)) ? 'lg:grid-cols-3' : ''}`}>
      <section className="soft-card p-5 space-y-2">
        <h2 className="font-bold mb-3">Danh sách đơn vị</h2>
        {loading && <LoadingState label="Đang tải cơ cấu tổ chức..." rows={4} />}
        {!loading && !units.length && !error && <EmptyState message="Chưa có đơn vị tổ chức." />}
        {units.map((unit) => <button key={unit.unitId} disabled={!canViewProfile(unit) || deniedUnitIds.includes(unit.unitId)} onClick={() => choose(unit.unitId)} className={`w-full text-left p-3 rounded-xl border disabled:cursor-default ${selectedId === unit.unitId && !deniedUnitIds.includes(unit.unitId) ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
          <span className="flex items-center gap-2 font-semibold"><Building2 className="w-4 h-4" />{unit.name}</span><span className="text-xs text-slate-500">{unit.code} · {unit.type}</span>
        </button>)}
      </section>
      {units.some(unit => canViewProfile(unit) && !deniedUnitIds.includes(unit.unitId)) && <section className="soft-card p-6 lg:col-span-2">
        {loading || busy ? <LoadingState label="Đang tải hồ sơ đơn vị..." /> : selected ? <div className="space-y-5">
          <div className="flex justify-between gap-3"><div><h2 className="text-xl font-bold">{selected.name}</h2><p className="text-sm text-slate-500">{selected.code} · {selected.type}</p></div>{canManage && <div className="flex flex-wrap justify-end gap-2"><button onClick={editUnit} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800">Sửa</button><button onClick={remove} disabled={busy} className="px-3 py-2 rounded-xl text-rose-600 bg-rose-50 flex items-center gap-2"><Trash2 className="w-4 h-4" />Xóa</button></div>}</div>
          <p className="text-sm">{selected.description || 'Chưa có mô tả hồ sơ đơn vị.'}</p>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Đơn vị cha</dt><dd className="font-semibold">{selected.parentUnit?.name || 'Không có'}</dd></div><div><dt className="text-slate-500">Số giảng viên hiện tại</dt><dd className="font-semibold">{selected.lecturersCount ?? 0}</dd></div><div><dt className="text-slate-500">Đại diện hiện tại</dt><dd className="font-semibold">{selected.representative?.displayName || 'Chưa phân công'}</dd></div><div><dt className="text-slate-500">Thành tích xác nhận</dt><dd className="font-semibold">{selected.stats?.verifiedAchievements ?? 0}</dd></div></dl>
          {canManage && <div className="flex flex-wrap gap-2 border-t pt-4"><button onClick={appoint} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700">Phân công đại diện</button><button onClick={transfer} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700">Chuyển giảng viên vào đơn vị</button></div>}
          {!canManage && <p className="text-xs text-slate-500 border-t pt-4">Chỉ quản trị viên được thay đổi cơ cấu, đại diện hoặc điều chuyển công tác.</p>}
        </div> : <EmptyState message="Chọn một đơn vị để xem hồ sơ." />}
      </section>}
    </div>
  </div>;
}
