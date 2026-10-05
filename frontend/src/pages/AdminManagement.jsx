import React, { useCallback, useEffect, useState } from 'react';
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
const camel = s => s.replace(/_([a-z])/g, (_,c) => c.toUpperCase());
export default function AdminManagement() {
  const [resource,setResource] = useState('users');
  const [rows,setRows] = useState([]);
  const [choices,setChoices] = useState({ user: [], role: [], unit: [] });
  const [form,setForm] = useState({});
  const [editing,setEditing] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(false);
  const [notice,setNotice] = useState('');
  const load = useCallback(async () => {
    if (USE_FIXTURES) { setError('Quản trị cần VITE_DATA_SOURCE=api và đăng nhập API thật. Fixture không hỗ trợ ghi dữ liệu.'); return; }
    setLoading(true);
    try {
      const [list,users,roles,units] = await Promise.all([apiClient.get(`/admin/${resource}`), apiClient.get('/admin/users'), apiClient.get('/admin/roles'), apiClient.get('/organizations')]);
      setRows(list.data);
      setChoices({ user: users.data.map(v => [v.user_id,`${v.display_name} (${v.username})`]), role: roles.data.filter(v => v.is_active).map(v => [v.role_id,v.code]), unit: (units.data?.items || units.data || []).filter(v => v.isActive).map(v => [v.unitId,v.name]) });
    } catch(e) { setError(e.message); } finally { setLoading(false); }
  }, [resource]);
  useEffect(() => { setRows([]); setForm({}); setEditing(null); setError(''); setNotice(''); load(); }, [load]);
  const definition = resources[resource];
  const fields = editing && resource === 'users' ? { email: 'email', displayName: 'text', status: ['ACTIVE','INACTIVE','LOCKED'] } : definition.fields;
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = {};
      for (const [key,type] of Object.entries(fields)) {
        const value = form[key];
        payload[key] = type === 'checkbox' ? Boolean(value ?? key === 'isActive') : ['user','role','unit'].includes(type) ? Number(value) : type === 'datetime-local' ? (value ? new Date(value).toISOString() : null) : value ?? (Array.isArray(type) ? type[0] : '');
      }
      if (editing && resource === 'users') payload.version = Number(editing.version);
      if (editing) await apiClient.patch(`/admin/${resource}/${editing[definition.key]}`,payload);
      else await apiClient.post(`/admin/${resource}`,payload);
      setForm({}); setEditing(null); setNotice('Đã lưu'); await load();
    } catch(e) { setError(e.message); } finally { setBusy(false); }
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
      setNotice('Đã ngừng hoạt động / thu hồi; giữ lịch sử'); await load();
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="p-6 space-y-5 text-slate-800 dark:text-slate-100">
    <h1 className="text-2xl font-bold">Quản trị tài khoản, phân công và danh mục</h1>
    <p>Admin quản trị hệ thống. Quyền xác nhận cần vai trò Manager và phạm vi đang hiệu lực riêng.</p>
    <div className="flex flex-wrap gap-2">{Object.entries(resources).map(([key,v]) => <button disabled={busy || loading} className={`px-3 py-2 rounded ${resource === key ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-900'}`} key={key} onClick={() => setResource(key)}>{v.label}</button>)}</div>
    {error && <p role="alert" className="text-red-600">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form onSubmit={save} className="grid md:grid-cols-3 gap-4 p-4 rounded bg-white dark:bg-slate-800">
      {Object.entries(fields).map(([key,type]) => <label key={key} className="flex flex-col gap-1">{key === 'validTo' && resource === 'representatives' ? 'Hiệu lực đến (bắt buộc)' : labels[key]}
        {Array.isArray(type) || choices[type] ? <select required value={form[key] ?? (Array.isArray(type) ? type[0] : '')} onChange={e => setForm({ ...form,[key]: e.target.value })} className="p-2 border rounded text-slate-900">
          {!Array.isArray(type) && <option value="">Chọn...</option>}{(Array.isArray(type) ? type.map(v => [v,v]) : choices[type]).map(([v,label]) => <option key={v} value={v}>{label}</option>)}
        </select> : <input type={type} required={(key === 'validTo' && resource === 'representatives') || (!['validTo','description'].includes(key) && type !== 'checkbox')} checked={type === 'checkbox' ? Boolean(form[key] ?? key === 'isActive') : undefined} value={type === 'checkbox' ? undefined : form[key] ?? ''} onChange={e => setForm({ ...form,[key]: type === 'checkbox' ? e.target.checked : e.target.value })} className="p-2 border rounded text-slate-900" />}
      </label>)}
      <button disabled={busy || loading || USE_FIXTURES} className="bg-blue-700 text-white rounded p-2">{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo mới / phân công'}</button>
      {editing && <button type="button" onClick={() => { setEditing(null); setForm({}); }}>Hủy sửa</button>}
    </form>
    {loading ? <p role="status">Đang tải...</p> : <div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>Bản ghi</th><th>Trạng thái / thời hạn</th><th>Thao tác</th></tr></thead><tbody>{rows.map(row => <tr className="border-b" key={row[definition.key]}>
      <td className="p-3">#{row[definition.key]} {row.name || row.display_name || `Tài khoản #${row.user_id}`} {row.code || row.username}{row.unit_id && ` · Đơn vị #${row.unit_id}`}{row.role_id && ` · Vai trò #${row.role_id}`}{row.include_descendants && ' · Gồm đơn vị con'}</td>
      <td>{row.status || (row.revoked_at ? 'Đã thu hồi' : row.is_active === false ? 'Ngừng hoạt động' : 'Hoạt động')} {row.valid_from && `${new Date(row.valid_from).toLocaleString('vi-VN')} → ${row.valid_to ? new Date(row.valid_to).toLocaleString('vi-VN') : 'Vô thời hạn'}`}</td>
      <td className="space-x-3">{!['scopes','user-roles','representatives'].includes(resource) && <button disabled={busy} onClick={() => edit(row)}>Sửa</button>}<button disabled={busy || Boolean(row.revoked_at)} onClick={() => deactivate(row)}>{['scopes','user-roles','representatives'].includes(resource) ? 'Thu hồi' : 'Ngừng hoạt động'}</button></td>
    </tr>)}</tbody></table>{rows.length === 500 && <p>Hiển thị tối đa 500 bản ghi.</p>}</div>}
  </main>;
}
