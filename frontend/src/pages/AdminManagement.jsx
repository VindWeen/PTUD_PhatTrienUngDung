import Select from '../components/common/Select';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Shield, Pencil, LockKeyhole, CircleCheck, CircleMinus, X } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import UnderlineTabs from '../components/common/UnderlineTabs';
import { EmptyState, ErrorState, LoadingState } from '../components/common/AsyncState';
import { request } from '../services/request';
import apiClient from '../services/apiClient';
import { USE_FIXTURES } from '../services/apiConfig';
import UserPermissionsDialog from '../components/admin/UserPermissionsDialog';

const resources = {
  users: { label: 'Tài khoản', key: 'user_id', fields: { username: 'text', email: 'email', displayName: 'text', password: 'password' } },
  'user-roles': { label: 'Vai trò tài khoản', key: 'user_role_id', fields: { userId: 'user', roleId: 'role', validFrom: 'datetime-local', validTo: 'datetime-local' } },
  scopes: { label: 'Phạm vi quản lý', key: 'user_unit_scope_id', fields: { userId: 'user', roleId: 'role', unitId: 'unit', includeDescendants: 'checkbox', validFrom: 'datetime-local', validTo: 'datetime-local' } },
  representatives: { label: 'Đại diện có hạn', key: 'unit_representative_id', fields: { userId: 'user', unitId: 'unit', validFrom: 'datetime-local', validTo: 'datetime-local' } },
  'academic-years': { label: 'Năm học', key: 'academic_year_id', fields: { code: 'text', name: 'text', startDate: 'date', endDate: 'date', isCurrent: 'checkbox', isActive: 'checkbox' } },
  'achievement-types': { label: 'Loại thành tích', key: 'achievement_type_id', fields: { code: 'text', name: 'text', description: 'text', applicableSubjectType: ['BOTH','LECTURER','UNIT'], isActive: 'checkbox' } },
  'award-types': { label: 'Loại thưởng', key: 'award_type_id', fields: { code: 'text', name: 'text', description: 'text', category: ['TITLE','REWARD_FORM'], level: ['FACULTY','UNIVERSITY','MINISTRY','STATE'], applicableSubjectType: ['BOTH','LECTURER','UNIT'], isActive: 'checkbox' } },
};
const labels = { username: 'Tên đăng nhập', email: 'Email', displayName: 'Tên hiển thị', password: 'Mật khẩu ban đầu (ít nhất 10 ký tự)', userId: 'Tài khoản', roleId: 'Vai trò', unitId: 'Đơn vị', includeDescendants: 'Bao gồm đơn vị con', validFrom: 'Hiệu lực từ', validTo: 'Hiệu lực đến (bỏ trống: vô thời hạn)', code: 'Mã', name: 'Tên', startDate: 'Ngày bắt đầu', endDate: 'Ngày kết thúc', isCurrent: 'Năm hiện tại', isActive: 'Đang hoạt động', description: 'Mô tả', category: 'Nhóm', level: 'Cấp', applicableSubjectType: 'Đối tượng', status: 'Trạng thái' };
const roleLabels = {
  ADMIN: 'Quản trị viên', LECTURER: 'Giảng viên', UNIT_REPRESENTATIVE: 'Đại diện tập thể',
  MANAGER: 'Quản lý đơn vị', COUNCIL: 'Hội đồng xét duyệt', RECORDS_OFFICER: 'Chuyên viên thi đua khen thưởng',
  SYSTEM_ADMIN: 'Quản trị hệ thống', DEPARTMENT_ADMIN: 'Quản trị đơn vị',
};
const optionLabels = {
  applicableSubjectType: { BOTH: 'Cá nhân và tập thể', LECTURER: 'Cá nhân', UNIT: 'Tập thể' },
  category: { TITLE: 'Danh hiệu thi đua', REWARD_FORM: 'Hình thức khen thưởng' },
  level: { FACULTY: 'Cấp khoa', UNIVERSITY: 'Cấp trường', MINISTRY: 'Cấp bộ', STATE: 'Cấp nhà nước' },
  status: { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', LOCKED: 'Đã khóa' },
};
const optionLabel = (field, value) => optionLabels[field]?.[value] || value;
const camel = s => s.replace(/_([a-z])/g, (_,c) => c.toUpperCase());
export function assignmentState(row, now = Date.now()) {
  if (row.revoked_at) return { label: 'Đã thu hồi', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
  if (row.valid_to && new Date(row.valid_to).getTime() <= now) return { label: 'Hết hạn', tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
  if (row.valid_from && new Date(row.valid_from).getTime() > now) return { label: 'Chưa đến hạn', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
  return { label: 'Đang hiệu lực', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
}
function AccountDialog({ children, editing, busy, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current, opener = document.activeElement, overflow = document.body.style.overflow;
    node.showModal(); document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} aria-labelledby="account-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl dark:bg-slate-900 dark:text-slate-100 [&::backdrop]:bg-slate-900/50">
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700"><h2 id="account-dialog-title" className="text-xl font-bold">{editing ? 'Sửa tài khoản' : 'Thêm tài khoản'}</h2><button type="button" aria-label="Đóng biểu mẫu tài khoản" disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 focus-visible:outline-teal-600 disabled:opacity-50 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
    {children}
  </dialog>;
}
function AccountAction({ label, icon: Icon, tone, ...props }) {
  return <button type="button" aria-label={label} title={label} {...props} className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}><Icon aria-hidden="true" className="h-[18px] w-[18px]" /></button>;
}
export default function AdminManagement() {
  const [resource,setResource] = useState('users');
  const [rows,setRows] = useState([]);
  const [choices,setChoices] = useState({ user: [], role: [], unit: [] });
  const [directory,setDirectory] = useState({ user: [], role: [], unit: [] });
  const [form,setForm] = useState({});
  const [editing,setEditing] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error,setError] = useState('');
  const [saveError,setSaveError] = useState(null);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const [permissionsUser, setPermissionsUser] = useState(null);
  const requestSequence = useRef(0);
  const currentResource = useRef(resource);
  currentResource.current = resource;
  const definition = resources[resource];
  const grantingLecturer = resource === 'user-roles' && choices.role.some(([id,,code]) => String(id) === String(form.roleId) && code === 'LECTURER');
  const fields = editing && resource === 'users' ? { email: 'email', displayName: 'text', status: ['ACTIVE','INACTIVE','LOCKED'] }
    : grantingLecturer ? { ...definition.fields, employeeCode: 'text', unitId: 'unit' } : definition.fields;
  const load = useCallback(async (fresh = true) => {
    const sequence = ++requestSequence.current;
    const active = () => sequence === requestSequence.current && currentResource.current === resource;
    setLoading(true); setError('');
    if (USE_FIXTURES) { setError('Quản trị cần phiên đăng nhập API thật; dữ liệu mẫu chưa hỗ trợ quản trị.'); setLoading(false); return; }
    try {
      const needed = new Set(Object.values(resources[resource].fields));
      if (resource === 'user-roles') needed.add('unit');
      const [list, users, roles, units] = await Promise.all([
        request({url: `/admin/${resource}`, fresh}),
        needed.has('user') ? request({url: '/admin/users', fresh}) : [],
        needed.has('role') ? request({url: '/admin/roles', fresh}) : [],
        needed.has('unit') ? request({url: '/organizations', fresh}) : [],
      ]);
      if (!active()) return;
      setRows(list || []);
      setDirectory({user: users.map(v => [v.user_id, v.display_name || v.username]), role: roles.map(v => [v.role_id, roleLabels[v.code] || v.name || v.code]), unit: (units?.items || units || []).map(v => [v.unitId, v.name])});
      setChoices({
        user: users.map(v => [v.user_id,`${v.display_name} (${v.username})`]),
        role: roles.filter(v => v.is_active).map(v => [v.role_id,roleLabels[v.code] || v.name || v.code,v.code]),
        unit: (units?.items || units || []).filter(v => v.isActive).map(v => [v.unitId,v.name]),
      });
    } catch(e) { if (active()) setError(e.message); }
    finally { if (active()) setLoading(false); }
  }, [resource]);
  const invalidateRequests = useCallback(() => { requestSequence.current++; }, []);
  useEffect(() => {
    load(false);
    return invalidateRequests;
  }, [load, invalidateRequests]);
  function changeResource(next) {
    if (next === resource || busy) return;
    requestSequence.current++;
    setResource(next); setRows([]); setChoices({user: [], role: [], unit: []});
    setForm({}); setEditing(null); setAccountOpen(false); setError(''); setSaveError(null); setNotice(''); setLoading(true);
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setSaveError(null); setNotice('');
    try {
      const payload = {};
      for (const [key,type] of Object.entries(fields)) {
        const value = form[key];
        if (grantingLecturer && ['unitId','employeeCode'].includes(key) && !value) continue;
        payload[key] = type === 'checkbox' ? Boolean(value ?? key === 'isActive') : ['user','role','unit'].includes(type) ? Number(value) : type === 'datetime-local' ? (value ? new Date(value).toISOString() : null) : value ?? (Array.isArray(type) ? type[0] : '');
      }
      if (editing && resource === 'users') payload.version = Number(editing.version);
      if (editing) await apiClient.patch(`/admin/${resource}/${editing[definition.key]}`,payload);
      else await apiClient.post(`/admin/${resource}`,payload);
      setForm({}); setEditing(null); setAccountOpen(false); setNotice(grantingLecturer
        ? payload.unitId ? 'Đã cấp vai trò, liên kết hồ sơ giảng viên và đơn vị công tác.' : 'Đã cấp vai trò và liên kết hồ sơ giảng viên. Chọn trang Tổ chức để phân công đơn vị công tác chính trước khi kê khai.'
        : 'Đã lưu thành công.'); await load();
    } catch(e) { setSaveError(e); } finally { setBusy(false); }
  }
  function edit(row) {
    setSaveError(null);
    if (resource === 'users') setAccountOpen(true);
    setEditing(row);
    setForm(Object.fromEntries(Object.entries(row).map(([k,v]) => [camel(k), ['start_date','end_date'].includes(k) ? String(v).slice(0,10) : v])));
  }
  async function deactivate(row) {
    setBusy(true); setError('');
    try {
      if (resource === 'users') await apiClient.patch(`/admin/users/${row.user_id}`, { email: row.email, displayName: row.display_name, version: Number(row.version), status: 'LOCKED' });
      else await apiClient.delete(`/admin/${resource}/${row[definition.key]}`);
      setNotice(resource === 'users' ? 'Đã khóa tài khoản. Các phiên đăng nhập đã bị thu hồi.' : 'Đã ngừng hoạt động / thu hồi; lịch sử được giữ lại.'); await load();
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  const fieldClass = 'soft-input w-full !rounded-xl !px-3 !py-2.5 text-sm';
  const lookup = (kind, id, fallback) => directory[kind].find(([key]) => String(key) === String(id))?.[1] || fallback;
  const timedAssignment = ['scopes','user-roles','representatives'].includes(resource);
  function closeAccount() { if (!busy) { setAccountOpen(false); setEditing(null); setForm({}); setSaveError(null); } }
  const editor = (<form onSubmit={save} className={`${resource === 'users' ? 'p-5' : 'soft-card p-5 sm:p-6'} space-y-5`}>
      {saveError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
        <p>{saveError.message}</p>
        {saveError.fieldErrors && <ul className="mt-2 list-disc pl-5">{Object.entries(saveError.fieldErrors).map(([key,message]) => <li key={key}>{labels[key] || key}: {message}</li>)}</ul>}
      </div>}
      {resource !== 'users' && <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{editing ? 'Chỉnh sửa' : 'Thêm mới'} · {definition.label}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{['scopes','user-roles','representatives'].includes(resource) ? 'Phân công quyền và thời hạn hiệu lực cho tài khoản.' : 'Nhập thông tin và lưu để cập nhật danh mục.'}</p></div>
        {editing && <button type="button" onClick={() => {setEditing(null); setForm({});}} className="soft-btn-secondary text-sm" disabled={busy}>Hủy sửa</button>}
      </div>}
      <fieldset disabled={busy || loading} className={`grid gap-4 ${resource === 'users' ? 'sm:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} disabled:opacity-60`}>
        {Object.entries(fields).map(([key,type]) => <label key={key} className={type === 'checkbox' ? 'flex items-center gap-3 text-sm font-medium md:self-end md:pb-3' : 'flex min-w-0 flex-col gap-2 text-sm font-medium'}>
          {grantingLecturer && key === 'employeeCode' ? 'Mã giảng viên (bỏ trống: mã tạm nội bộ)' : grantingLecturer && key === 'unitId' ? 'Đơn vị công tác chính (không bắt buộc)' : key === 'validTo' && resource === 'representatives' ? 'Hiệu lực đến (bắt buộc)' : labels[key]}
          {Array.isArray(type) || choices[type] ? <Select required={!(grantingLecturer && key === 'unitId')} value={form[key] ?? (Array.isArray(type) ? type[0] : '')} onChange={e => setForm({ ...form,[key]: e.target.value })} className={fieldClass}>
            {!Array.isArray(type) && <option value="">{loading ? 'Đang tải lựa chọn...' : 'Chọn...'}</option>}{(Array.isArray(type) ? type.map(v => [v,optionLabel(key, v)]) : choices[type]).map(([v,label]) => <option key={v} value={v}>{label}</option>)}
          </Select> : <input type={type} minLength={key === 'password' ? 10 : undefined} maxLength={key === 'password' ? 72 : key === 'username' || key === 'employeeCode' ? 50 : key === 'email' ? 255 : key === 'displayName' ? 100 : undefined} pattern={key === 'username' ? '[A-Za-z0-9_.\\-]+' : undefined} autoComplete={key === 'password' ? 'new-password' : undefined} required={(key === 'validTo' && resource === 'representatives') || (!['validTo','description','employeeCode'].includes(key) && type !== 'checkbox')} checked={type === 'checkbox' ? Boolean(form[key] ?? key === 'isActive') : undefined} value={type === 'checkbox' ? undefined : form[key] ?? ''} onChange={e => setForm({ ...form,[key]: type === 'checkbox' ? e.target.checked : e.target.value })} className={type === 'checkbox' ? 'h-4 w-4 accent-teal-600' : fieldClass} />}
        </label>)}
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">{resource === 'users' && <button type="button" disabled={busy} onClick={closeAccount} className="soft-btn-secondary text-sm">Hủy</button>}<button disabled={busy || loading || USE_FIXTURES} className="soft-btn-primary text-sm">{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : ['scopes','user-roles','representatives'].includes(resource) ? 'Tạo phân công' : resource === 'users' ? 'Tạo tài khoản' : 'Tạo mới'}</button></div>
    </form>);
  return <main className="space-y-6 animate-fadeIn text-slate-800 dark:text-slate-100">
    <PageHeader title="Quản trị hệ thống" description="Quản lý tài khoản, vai trò và phạm vi trong một lần lưu." icon={ShieldCheck} primaryAction={resource === 'users' ? { label: 'Thêm tài khoản', disabled: busy || loading, onClick: () => { setEditing(null); setForm({}); setSaveError(null); setAccountOpen(true); } } : undefined} onRefresh={load} refreshing={busy || loading} tabs={<UnderlineTabs label="Danh mục quản trị" value={resource} onChange={changeResource} disabled={busy} items={Object.entries(resources).filter(([id]) => !['user-roles','scopes','representatives'].includes(id)).map(([id, item]) => ({id, label: item.label}))} />} />
    {resource === 'users' && <p className="text-sm text-slate-600 dark:text-slate-300">Chọn <strong>Quản lý quyền</strong> ở mỗi tài khoản để tích nhiều vai trò, phân công đơn vị và thời hạn.</p>}
    {error && <ErrorState message={error} onRetry={load} />}
    {notice && <p role="status" className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200">{notice}</p>}
    {resource === 'users' ? accountOpen && <AccountDialog editing={editing} busy={busy} onClose={closeAccount}>{editor}</AccountDialog> : editor}
    <section className="soft-card overflow-hidden">
      <div className="border-b border-slate-200 p-5 dark:border-slate-700"><h2 className="font-bold">Danh sách {definition.label.toLowerCase()}</h2></div>
      {loading ? <div className="p-5"><LoadingState label={`Đang tải ${definition.label.toLowerCase()}...`} rows={4} /></div> : error ? <p className="p-5 text-sm text-slate-500">Chưa tải được danh sách. Hãy thử lại ở thông báo phía trên.</p> : !rows.length ? <div className="p-5"><EmptyState message="Chưa có bản ghi trong danh mục này." /></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/40 dark:text-slate-400"><tr><th className="px-5 py-3">Bản ghi</th><th className="px-5 py-3">Trạng thái / thời hạn</th><th className="px-5 py-3">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{rows.map(row => <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50" key={row[definition.key]}>
        <td className="px-5 py-4"><span className="font-semibold">{row.name || row.display_name || lookup('user', row.user_id, `Tài khoản #${row.user_id}`)}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">#{row[definition.key]} · {row.code || row.username}{row.unit_id && ` · ${lookup('unit', row.unit_id, `Đơn vị #${row.unit_id}`)}`}{row.role_id && ` · ${lookup('role', row.role_id, `Vai trò #${row.role_id}`)}`}{row.include_descendants && ' · Gồm đơn vị con'}</span></td>
        <td className="px-5 py-4"><span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${timedAssignment ? assignmentState(row).tone : resource === 'users' ? row.status === 'ACTIVE' ? 'gap-1.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : row.status === 'LOCKED' ? 'gap-1.5 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'gap-1.5 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800'}`}>{resource === 'users' && (row.status === 'ACTIVE' ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : row.status === 'LOCKED' ? <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleMinus className="h-3.5 w-3.5" aria-hidden="true" />)}{timedAssignment ? assignmentState(row).label : optionLabel('status', row.status) || (row.revoked_at ? 'Đã thu hồi' : row.is_active === false ? 'Ngừng hoạt động' : 'Hoạt động')}</span>{row.valid_from && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{new Date(row.valid_from).toLocaleString('vi-VN')} → {row.valid_to ? new Date(row.valid_to).toLocaleString('vi-VN') : 'Vô thời hạn'}</p>}</td>
        <td className="px-5 py-4"><div className="flex flex-nowrap gap-2">{resource === 'users' ? <>
<AccountAction label="Quản lý quyền" icon={Shield} disabled={busy || row.status !== 'ACTIVE'} onClick={() => setPermissionsUser(row)} tone="bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-900" />
<AccountAction label="Sửa tài khoản" icon={Pencil} disabled={busy} onClick={() => edit(row)} tone="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900" />
<AccountAction label={row.status === 'LOCKED' ? 'Tài khoản đã khóa' : 'Khóa tài khoản'} icon={LockKeyhole} disabled={busy || row.status === 'LOCKED'} onClick={() => deactivate(row)} tone="bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900" />
</> : <><button disabled={busy} onClick={() => edit(row)} className="soft-btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">Sửa</button><button disabled={busy || Boolean(row.revoked_at) || row.is_active === false} onClick={() => deactivate(row)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-950/30 dark:text-rose-300">Ngừng hoạt động</button></>}</div></td>
      </tr>)}</tbody></table>{rows.length === 500 && <p className="p-4 text-xs text-slate-500">Hiển thị tối đa 500 bản ghi.</p>}</div>}
    </section>
    {permissionsUser && <UserPermissionsDialog user={permissionsUser} roleLabels={roleLabels} onClose={() => setPermissionsUser(null)} onSaved={() => { setPermissionsUser(null); setNotice('Đã lưu vai trò và phạm vi của tài khoản. Lịch sử phân công được giữ lại.'); load(); }} />}
  </main>;
}
