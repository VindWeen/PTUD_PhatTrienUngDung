import Select from '../components/common/Select';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import UnderlineTabs from '../components/common/UnderlineTabs';
import { EmptyState, ErrorState, LoadingState } from '../components/common/AsyncState';
import { request } from '../services/request';
import apiClient from '../services/apiClient';
import { USE_FIXTURES } from '../services/apiConfig';

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
export default function AdminManagement() {
  const [resource,setResource] = useState('users');
  const [rows,setRows] = useState([]);
  const [choices,setChoices] = useState({ user: [], role: [], unit: [] });
  const [form,setForm] = useState({});
  const [editing,setEditing] = useState(null);
  const [error,setError] = useState('');
  const [saveError,setSaveError] = useState(null);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const requestSequence = useRef(0);
  const currentResource = useRef(resource);
  currentResource.current = resource;
  const definition = resources[resource];
  const fields = editing && resource === 'users' ? { email: 'email', displayName: 'text', status: ['ACTIVE','INACTIVE','LOCKED'] } : definition.fields;
  const load = useCallback(async (fresh = true) => {
    const sequence = ++requestSequence.current;
    const active = () => sequence === requestSequence.current && currentResource.current === resource;
    setLoading(true); setError('');
    if (USE_FIXTURES) { setError('Quản trị cần phiên đăng nhập API thật; dữ liệu mẫu chưa hỗ trợ quản trị.'); setLoading(false); return; }
    try {
      const needed = new Set(Object.values(resources[resource].fields));
      const [list, users, roles, units] = await Promise.all([
        request({url: `/admin/${resource}`, fresh}),
        needed.has('user') ? request({url: '/admin/users', fresh}) : [],
        needed.has('role') ? request({url: '/admin/roles', fresh}) : [],
        needed.has('unit') ? request({url: '/organizations', fresh}) : [],
      ]);
      if (!active()) return;
      setRows(list || []);
      setChoices({
        user: users.map(v => [v.user_id,`${v.display_name} (${v.username})`]),
        role: roles.filter(v => v.is_active).map(v => [v.role_id,roleLabels[v.code] || v.name || v.code]),
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
    setForm({}); setEditing(null); setError(''); setSaveError(null); setNotice(''); setLoading(true);
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setSaveError(null); setNotice('');
    try {
      const payload = {};
      for (const [key,type] of Object.entries(fields)) {
        const value = form[key];
        payload[key] = type === 'checkbox' ? Boolean(value ?? key === 'isActive') : ['user','role','unit'].includes(type) ? Number(value) : type === 'datetime-local' ? (value ? new Date(value).toISOString() : null) : value ?? (Array.isArray(type) ? type[0] : '');
      }
      if (editing && resource === 'users') payload.version = Number(editing.version);
      if (editing) await apiClient.patch(`/admin/${resource}/${editing[definition.key]}`,payload);
      else await apiClient.post(`/admin/${resource}`,payload);
      setForm({}); setEditing(null); setNotice('Đã lưu thành công.'); await load();
    } catch(e) { setSaveError(e); } finally { setBusy(false); }
  }
  function edit(row) {
    setEditing(row);
    setForm(Object.fromEntries(Object.entries(row).map(([k,v]) => [camel(k), ['start_date','end_date'].includes(k) ? String(v).slice(0,10) : v])));
  }
  async function deactivate(row) {
    setBusy(true); setError('');
    try {
      if (resource === 'users') await apiClient.patch(`/admin/users/${row.user_id}`, { email: row.email, displayName: row.display_name, version: Number(row.version), status: 'INACTIVE' });
      else await apiClient.delete(`/admin/${resource}/${row[definition.key]}`);
      setNotice('Đã ngừng hoạt động / thu hồi; lịch sử được giữ lại.'); await load();
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  const fieldClass = 'soft-input w-full !rounded-xl !px-3 !py-2.5 text-sm';
  return <main className="space-y-6 animate-fadeIn text-slate-800 dark:text-slate-100">
    <PageHeader title="Quản trị hệ thống" description="Quản lý tài khoản, phân công vai trò, phạm vi và danh mục." icon={ShieldCheck} onRefresh={load} refreshing={busy || loading} tabs={<UnderlineTabs label="Danh mục quản trị" value={resource} onChange={changeResource} disabled={busy} items={Object.entries(resources).map(([id, item]) => ({id, label: item.label}))} />} />
    {error && <ErrorState message={error} onRetry={load} />}
    {notice && <p role="status" className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200">{notice}</p>}
    <form onSubmit={save} className="soft-card p-5 sm:p-6 space-y-5">
      {saveError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
        <p>{saveError.message}</p>
        {saveError.fieldErrors && <ul className="mt-2 list-disc pl-5">{Object.entries(saveError.fieldErrors).map(([key,message]) => <li key={key}>{labels[key] || key}: {message}</li>)}</ul>}
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{editing ? 'Chỉnh sửa' : 'Thêm mới'} · {definition.label}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{['scopes','user-roles','representatives'].includes(resource) ? 'Phân công quyền và thời hạn hiệu lực cho tài khoản.' : 'Nhập thông tin và lưu để cập nhật danh mục.'}</p></div>
        {editing && <button type="button" onClick={() => {setEditing(null); setForm({});}} className="soft-btn-secondary text-sm" disabled={busy}>Hủy sửa</button>}
      </div>
      <fieldset disabled={busy || loading} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 disabled:opacity-60">
        {Object.entries(fields).map(([key,type]) => <label key={key} className={type === 'checkbox' ? 'flex items-center gap-3 text-sm font-medium md:self-end md:pb-3' : 'flex min-w-0 flex-col gap-2 text-sm font-medium'}>
          {key === 'validTo' && resource === 'representatives' ? 'Hiệu lực đến (bắt buộc)' : labels[key]}
          {Array.isArray(type) || choices[type] ? <Select required value={form[key] ?? (Array.isArray(type) ? type[0] : '')} onChange={e => setForm({ ...form,[key]: e.target.value })} className={fieldClass}>
            {!Array.isArray(type) && <option value="">{loading ? 'Đang tải lựa chọn...' : 'Chọn...'}</option>}{(Array.isArray(type) ? type.map(v => [v,optionLabel(key, v)]) : choices[type]).map(([v,label]) => <option key={v} value={v}>{label}</option>)}
          </Select> : <input type={type} minLength={key === 'password' ? 10 : undefined} maxLength={key === 'password' ? 72 : key === 'username' ? 50 : key === 'email' ? 255 : key === 'displayName' ? 100 : undefined} pattern={key === 'username' ? '[A-Za-z0-9_.\\-]+' : undefined} autoComplete={key === 'password' ? 'new-password' : undefined} required={(key === 'validTo' && resource === 'representatives') || (!['validTo','description'].includes(key) && type !== 'checkbox')} checked={type === 'checkbox' ? Boolean(form[key] ?? key === 'isActive') : undefined} value={type === 'checkbox' ? undefined : form[key] ?? ''} onChange={e => setForm({ ...form,[key]: type === 'checkbox' ? e.target.checked : e.target.value })} className={type === 'checkbox' ? 'h-4 w-4 accent-teal-600' : fieldClass} />}
        </label>)}
      </fieldset>
      <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700"><button disabled={busy || loading || USE_FIXTURES} className="soft-btn-primary text-sm">{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : ['scopes','user-roles','representatives'].includes(resource) ? 'Tạo phân công' : 'Tạo mới'}</button></div>
    </form>
    <section className="soft-card overflow-hidden">
      <div className="border-b border-slate-200 p-5 dark:border-slate-700"><h2 className="font-bold">Danh sách {definition.label.toLowerCase()}</h2></div>
      {loading ? <div className="p-5"><LoadingState label={`Đang tải ${definition.label.toLowerCase()}...`} rows={4} /></div> : error ? <p className="p-5 text-sm text-slate-500">Chưa tải được danh sách. Hãy thử lại ở thông báo phía trên.</p> : !rows.length ? <div className="p-5"><EmptyState message="Chưa có bản ghi trong danh mục này." /></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/40 dark:text-slate-400"><tr><th className="px-5 py-3">Bản ghi</th><th className="px-5 py-3">Trạng thái / thời hạn</th><th className="px-5 py-3">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{rows.map(row => <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50" key={row[definition.key]}>
        <td className="px-5 py-4"><span className="font-semibold">{row.name || row.display_name || `Tài khoản #${row.user_id}`}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">#{row[definition.key]} · {row.code || row.username}{row.unit_id && ` · Đơn vị #${row.unit_id}`}{row.role_id && ` · ${choices.role.find(([id]) => String(id) === String(row.role_id))?.[1] || `Vai trò #${row.role_id}`}`}{row.include_descendants && ' · Gồm đơn vị con'}</span></td>
        <td className="px-5 py-4"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium dark:bg-slate-800">{optionLabel('status', row.status) || (row.revoked_at ? 'Đã thu hồi' : row.is_active === false ? 'Ngừng hoạt động' : 'Hoạt động')}</span>{row.valid_from && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{new Date(row.valid_from).toLocaleString('vi-VN')} → {row.valid_to ? new Date(row.valid_to).toLocaleString('vi-VN') : 'Vô thời hạn'}</p>}</td>
        <td className="px-5 py-4"><div className="flex flex-wrap gap-2">{!['scopes','user-roles','representatives'].includes(resource) && <button disabled={busy} onClick={() => edit(row)} className="soft-btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">Sửa</button>}<button disabled={busy || Boolean(row.revoked_at) || row.is_active === false || row.status === 'INACTIVE'} onClick={() => deactivate(row)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/60">{['scopes','user-roles','representatives'].includes(resource) ? 'Thu hồi' : 'Ngừng hoạt động'}</button></div></td>
      </tr>)}</tbody></table>{rows.length === 500 && <p className="p-4 text-xs text-slate-500">Hiển thị tối đa 500 bản ghi.</p>}</div>}
    </section>
  </main>;
}
