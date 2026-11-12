import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Select from '../common/Select';
import { LoadingState } from '../common/AsyncState';
import { request } from '../../services/request';
import { adminApi } from '../../services/adminApi';
import { editableAssignment, liveAssignment, localDateTime, permissionChanges, scopedRoleCodes, serializedPeriod } from '../../services/adminPermissions';

const inputClass = 'soft-input w-full min-w-0 !rounded-xl !px-3 !py-2 text-sm';
const checkboxClass = 'h-4 w-4 shrink-0 accent-teal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600';
const newPeriod = () => ({ validFrom: localDateTime(), validTo: '', includeDescendants: false });

export default function UserPermissionsDialog({ user, roleLabels, onClose, onSaved }) {
  const dialog = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [states, setStates] = useState([]);
  const [units, setUnits] = useState([]);
  const [reload, setReload] = useState(0);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const node = dialog.current, opener = document.activeElement, overflow = document.body.style.overflow;
    node.showModal(); document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([adminApi.permissions(user.user_id), request({ url: '/admin/roles', fresh: true }), request({ url: '/organizations', fresh: true })])
      .then(([data, roles, organizations]) => {
        if (!active) return;
        setSnapshot(data); setUnits(organizations.items || organizations || []);
        setStates(roles.filter(role => role.is_active || data['user-roles'].some(row => String(row.role_id) === String(role.role_id) && liveAssignment(row))).map(role => {
          const grants = data['user-roles'].filter(row => String(row.role_id) === String(role.role_id) && liveAssignment(row)).map(editableAssignment);
          const assignedUnits = (role.code === 'UNIT_REPRESENTATIVE' ? data.representatives : data.scopes.filter(row => String(row.role_id) === String(role.role_id))).filter(row => liveAssignment(row)).map(editableAssignment);
          return { roleId: role.role_id, code: role.code, name: roleLabels[role.code] || role.name, active: role.is_active, enabled: grants.length > 0, grants: grants.length ? grants : [newPeriod()], units: assignedUnits, employeeCode: '', workUnitId: '' };
        }));
        setDirty(false);
      }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.user_id, roleLabels, reload]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function close() { if (!saving && (!dirty || window.confirm('Bỏ các thay đổi quyền chưa lưu?'))) onClose(); }
  function update(index, fn) { setDirty(true); setStates(previous => previous.map((state, i) => i === index ? fn(state) : state)); }
  function periodField(index, kind, rowIndex, field, value) {
    update(index, state => ({ ...state, [kind]: state[kind].map((row, i) => i === rowIndex ? { ...row, [field]: value } : row) }));
  }
  function toggleUnit(index, unitId, checked) {
    update(index, state => {
      const exists = state.units.some(row => String(row.unitId) === String(unitId));
      const rows = state.units.map(row => String(row.unitId) === String(unitId) ? { ...row, removed: !checked } : row);
      if (checked && !exists) {
        const grant = state.grants[0], exact = serializedPeriod(grant);
        rows.push({ ...newPeriod(), validFrom: grant.validFrom, validTo: grant.validTo,
          inheritedPeriod: { valid_from: exact.validFrom, valid_to: exact.validTo }, unitId });
      }
      return { ...state, units: rows };
    });
  }
  async function save(event) {
    event.preventDefault(); if (saving || loading) return;
    setError('');
    try {
      for (const state of states.filter(value => value.enabled)) {
        for (const row of [...state.grants, ...state.units.filter(value => !value.removed)]) {
          if (row.validTo && Date.parse(row.validTo) <= Date.parse(row.validFrom)) {
            throw new Error(`${state.name}: thời hạn kết thúc phải sau thời hạn bắt đầu.`);
          }
        }
      }
      const payload = permissionChanges(user.user_id, snapshot, states);
      if (!payload.additions.length && !payload.revocations.length) { onClose(); return; }
      setSaving(true);
      await adminApi.savePermissions(user.user_id, payload);
      onSaved();
    } catch (e) { setError(e.message || 'Chưa lưu được quyền. Kiểm tra thời hạn và thử lại.'); }
    finally { setSaving(false); }
  }
  const removedCount = states.reduce((count, state) => count + [...state.grants, ...state.units].filter(row => row.original && (!state.enabled || row.removed)).length, 0);
  function periods(state, index, kind) {
    return state[kind].map((row, rowIndex) => !row.removed && <div key={rowIndex} className="grid min-w-0 gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800 sm:grid-cols-2">
      <label className="min-w-0 space-y-1.5 text-xs font-medium"><span>{kind === 'grants' ? 'Vai trò có hiệu lực từ' : 'Phạm vi có hiệu lực từ'}{state[kind].length > 1 ? ` · giai đoạn ${rowIndex + 1}` : ''}</span><input aria-label={`${state.name} ${kind === 'grants' ? 'vai trò' : 'phạm vi'} từ ${rowIndex + 1}`} type="datetime-local" required value={row.validFrom} onChange={e => periodField(index, kind, rowIndex, 'validFrom', e.target.value)} className={inputClass} /></label>
      <label className="min-w-0 space-y-1.5 text-xs font-medium"><span>Đến {kind === 'units' && state.code === 'UNIT_REPRESENTATIVE' ? '(bắt buộc)' : '(bỏ trống: vô thời hạn)'}</span><input aria-label={`${state.name} ${kind === 'grants' ? 'vai trò' : 'phạm vi'} đến ${rowIndex + 1}`} type="datetime-local" required={kind === 'units' && state.code === 'UNIT_REPRESENTATIVE'} value={row.validTo} onChange={e => periodField(index, kind, rowIndex, 'validTo', e.target.value)} className={inputClass} /></label>
      {kind === 'units' && <p className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">{units.find(unit => String(unit.unitId) === String(row.unitId))?.name || `Đơn vị #${row.unitId}`}{row.original && ' · Phân công đã lưu'}</p>}
      {kind === 'units' && scopedRoleCodes.includes(state.code) && <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" className={checkboxClass} checked={row.includeDescendants} onChange={e => periodField(index, kind, rowIndex, 'includeDescendants', e.target.checked)} />Bao gồm đơn vị con</label>}
    </div>);
  }
  return <dialog ref={dialog} aria-labelledby="user-permissions-title" aria-describedby="user-permissions-description" onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl overflow-hidden rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl dark:bg-slate-900 dark:text-slate-100 [&::backdrop]:bg-slate-900/50">
    <form onSubmit={save} className="flex max-h-[calc(100dvh-2rem)] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">
        <div className="min-w-0"><h2 id="user-permissions-title" className="break-words text-xl font-bold">Quản lý quyền · {user.display_name || user.username}</h2><p id="user-permissions-description" className="mt-2 text-sm text-slate-600 dark:text-slate-300">Tích các vai trò và chọn phạm vi ngay bên dưới. Mọi thay đổi được lưu cùng lúc.</p></div>
        <button autoFocus type="button" aria-label="Đóng quản lý quyền" disabled={saving} onClick={close} className="rounded-lg p-2 hover:bg-slate-100 focus-visible:outline-teal-600 disabled:opacity-50 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
        {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}{!snapshot && <button type="button" onClick={() => setReload(value => value + 1)} className="ml-2 underline">Thử lại</button>}</div>}
        {loading ? <LoadingState label="Đang tải vai trò và phạm vi…" rows={4} /> : snapshot && <fieldset disabled={saving} className="space-y-1 disabled:opacity-60">
          {states.map((state, index) => <section key={state.roleId} className="border-b border-slate-200 py-4 first:pt-0 last:border-0 dark:border-slate-700">
            <label className="flex items-center gap-3 font-semibold"><input type="checkbox" className={checkboxClass} disabled={!state.active && !state.grants.some(row => row.original)} checked={state.enabled} onChange={event => update(index, value => ({ ...value, enabled: event.target.checked }))} />{state.name}{!state.active && <span className="text-xs font-normal text-slate-500">Ngừng cấp mới</span>}</label>
            {state.enabled && <div className="mt-3 pl-0 sm:pl-7">
              {periods(state, index, 'grants')}
              {state.code === 'LECTURER' && <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">Đơn vị công tác chính là nơi giảng viên làm việc. Phạm vi quản lý được chọn ở các vai trò quản lý bên dưới.</p>
                {snapshot.lecturer ? <p className="text-sm">Mã giảng viên: <strong>{snapshot.lecturer.employee_code}</strong> · Đơn vị công tác: <strong>{units.find(unit => String(unit.unitId) === String(snapshot.lecturer.unit_id))?.name || 'Chưa phân công'}</strong>. Chuyển đơn vị tại trang Tổ chức.</p> : <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-medium"><span>Mã giảng viên (tùy chọn)</span><input maxLength={50} value={state.employeeCode} onChange={e => update(index, value => ({ ...value, employeeCode: e.target.value }))} className={inputClass} /></label><label className="min-w-0 space-y-1.5 text-xs font-medium"><span>Đơn vị công tác chính (tùy chọn)</span><Select value={state.workUnitId} onChange={e => update(index, value => ({ ...value, workUnitId: e.target.value }))} className={inputClass}><option value="">Chưa phân công</option>{units.filter(unit => unit.isActive).map(unit => <option key={unit.unitId} value={unit.unitId}>{unit.name}</option>)}</Select></label></div>}
              </div>}
              {(scopedRoleCodes.includes(state.code) || state.code === 'UNIT_REPRESENTATIVE') && <div className="mt-4">
                <h3 className="text-sm font-semibold">{state.code === 'UNIT_REPRESENTATIVE' ? 'Đơn vị được đại diện' : 'Phạm vi đơn vị'}</h3><p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Thời hạn từng đơn vị phải nằm trong thời hạn vai trò.{state.code === 'UNIT_REPRESENTATIVE' && ' Mỗi phân công đại diện cần ngày kết thúc.'}</p>
                <div className="mt-3 grid max-h-48 gap-3 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-800 sm:grid-cols-2">{units.filter(unit => unit.isActive || state.units.some(row => String(row.unitId) === String(unit.unitId))).map(unit => <label key={unit.unitId} className="flex items-start gap-2 text-sm"><input type="checkbox" className={`${checkboxClass} mt-0.5`} checked={state.units.some(row => String(row.unitId) === String(unit.unitId) && !row.removed)} onChange={event => toggleUnit(index, unit.unitId, event.target.checked)} /><span>{unit.name}{!unit.isActive && ' (ngừng hoạt động)'}</span></label>)}</div>
                {periods(state, index, 'units')}
                {!state.units.some(row => !row.removed) && <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">Chưa chọn đơn vị. Vai trò này chưa có phạm vi để xử lý hồ sơ.</p>}
              </div>}
            </div>}
          </section>)}
          <details className="pt-4 text-xs text-slate-600 dark:text-slate-300"><summary className="cursor-pointer font-medium">Lịch sử đã hết hạn / thu hồi được giữ lại</summary><p className="mt-2">{['user-roles', 'scopes', 'representatives'].reduce((n, key) => n + snapshot[key].filter(row => !liveAssignment(row)).length, 0)} phân công cũ. Thay đổi thời hạn tạo phân công mới và thu hồi bản cũ để giữ lịch sử.</p></details>
        </fieldset>}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-5 dark:border-slate-700"><p role="status" className="text-xs text-slate-600 dark:text-slate-300">{removedCount ? `Sẽ thu hồi ${removedCount} phân công khi lưu.` : 'Các quyền chưa chỉnh sửa được giữ nguyên.'}</p><div className="flex gap-2"><button type="button" disabled={saving} onClick={close} className="soft-btn-secondary text-sm">Hủy</button><button type="submit" disabled={saving || loading || !snapshot} className="soft-btn-primary text-sm disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu quyền'}</button></div></footer>
    </form>
  </dialog>;
}
