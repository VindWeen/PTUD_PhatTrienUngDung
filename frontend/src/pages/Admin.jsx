import React, { useState } from 'react';
import Modal from '../components/common/VaultDialog';
import VaultTabs from '../components/common/VaultTabs';
import { api, array } from '../services/vaultApi';
import { useLoad } from '../hooks/useLoad';
import { Page } from '../components/common/VaultPage';
import { ErrorMessage, Field, Empty, Load, StatusBadge, displayLabel } from '../components/common/VaultPrimitives';
import { input, button, secondary, panel } from '../components/common/vaultStyles';

export function Admin() {
  const users = useLoad('/admin/users');
  const roles = useLoad('/admin/global-roles');
  const [tab, setTab] = useState('accounts');
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const accounts = array(users.data);
  const visibleAccounts = accounts.filter(user => (!status || status === user.account_status)
    && [user.full_name, user.email].filter(Boolean).join(' ').toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));

  function prepare(action) {
    setError(null);
    setMessage('');
    setPending(action);
  }

  async function confirm(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await pending.run();
      setMessage(pending.success);
      setPending(null);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title="Quản trị hệ thống" description="Quản lý tài khoản và quyền toàn hệ thống.">
      {message && <p role="status" className="vault-summary mb-4">{message}</p>}
      <VaultTabs label="Quản trị hệ thống" value={tab} onChange={setTab}
        items={[['accounts', 'Tài khoản'], ['roles', 'Phân quyền'], ['catalog', 'Danh mục']]}>
        {tab === 'accounts' && <section className={panel}>
          <div className="vault-toolbar">
            <Field label="Tìm theo tên hoặc email"><input type="search" className={input} value={query} onChange={event => setQuery(event.target.value)} /></Field>
            <Field label="Trạng thái"><select className={input} value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="DISABLED">Đã vô hiệu hóa</option>
            </select></Field>
          </div>
          <Load state={users}>
            {visibleAccounts.length ? <div className="vault-table-wrap"><table className="vault-table">
              <caption className="sr-only">Danh sách tài khoản</caption>
              <thead><tr><th scope="col">Tài khoản</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
              <tbody>{visibleAccounts.map(user => {
                const active = user.account_status === 'ACTIVE';
                return <tr key={user.id}>
                  <td><strong>{user.full_name || user.email}</strong>{user.full_name && <p className="vault-meta">{user.email}</p>}</td>
                  <td><StatusBadge value={user.account_status} /></td>
                  <td><button type="button" className={secondary} onClick={() => prepare({
                    title: active ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản',
                    target: user.email,
                    description: active ? 'Tài khoản sẽ không thể đăng nhập.' : 'Tài khoản có thể đăng nhập trở lại.',
                    success: active ? 'Đã vô hiệu hóa ' + user.email : 'Đã kích hoạt ' + user.email,
                    danger: active,
                    run: async () => { await api('/admin/users/' + user.id, 'PATCH', { accountStatus: active ? 'DISABLED' : 'ACTIVE' }); await users.reload(); },
                  })}>{active ? 'Vô hiệu hóa' : 'Kích hoạt'}</button></td>
                </tr>;
              })}</tbody>
            </table></div> : <Empty>{accounts.length ? 'Không có tài khoản khớp bộ lọc.' : 'Chưa có tài khoản.'}</Empty>}
          </Load>
        </section>}
        {tab === 'roles' && <section className={panel}>
          <h2 className="text-lg font-bold">Quyền toàn hệ thống</h2>
          <Load state={roles}>
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {array(roles.data).map(grant => <li key={grant.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span><strong>{grant.full_name || grant.email}</strong> · <StatusBadge value={grant.role_code} /></span>
                <button type="button" className={secondary} onClick={() => prepare({
                  title: 'Thu hồi quyền', target: grant.email || grant.full_name,
                  description: 'Quyền ' + (displayLabel(grant.role_code)) + ' sẽ bị thu hồi trên toàn hệ thống.',
                  success: 'Đã thu hồi quyền.', danger: true,
                  run: async () => { await api('/admin/global-roles/' + grant.id, 'DELETE'); await roles.reload(); },
                })}>Thu hồi quyền</button>
              </li>)}
            </ul>
            {!array(roles.data).length && <Empty>Chưa có quyền nào được cấp.</Empty>}
          </Load>
          <form className="vault-selection-footer" onSubmit={event => {
            event.preventDefault();
            const user = accounts.find(account => String(account.id) === userId);
            if (!user) return;
            prepare({
              title: 'Cấp quyền quản trị hệ thống', target: user.email,
              description: 'Tài khoản có thể quản lý danh sách tài khoản và quyền toàn hệ thống.',
              success: 'Đã cấp quyền cho ' + user.email,
              run: async () => { await api('/admin/global-roles', 'POST', { userId: Number(user.id), roleCode: 'SYSTEM_ADMIN' }); setUserId(''); await roles.reload(); },
            });
          }}>
            <Field label="Tài khoản"><select className={input} required value={userId} onChange={event => setUserId(event.target.value)}>
              <option value="">Chọn tài khoản</option>{accounts.map(user => <option key={user.id} value={user.id}>{user.full_name} · {user.email}</option>)}
            </select></Field>
            <button className={button} disabled={!userId}>Cấp quyền quản trị</button>
          </form>
        </section>}
        {tab === 'catalog' && <AchievementCatalog />}
      </VaultTabs>

      <Modal open={!!pending} title={pending?.title || 'Xác nhận'} onClose={event => {
        if (saving) event?.preventDefault();
        else setPending(null);
      }}>
        {pending && <form onSubmit={confirm} className="space-y-4">
          <div><strong>{pending.target}</strong><p className="vault-meta">{pending.description}</p></div>
          <ErrorMessage error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondary} disabled={saving} onClick={() => setPending(null)}>Hủy</button>
            <button className={pending.danger ? 'soft-btn-danger' : button} disabled={saving}>{saving ? 'Đang lưu…' : pending.title}</button>
          </div>
        </form>}
      </Modal>
    </Page>
  );
}

function AchievementCatalog() {
  const state = useLoad('/achievements/catalogs'), [code, setCode] = useState(''), [name, setName] = useState(''), [error, setError] = useState(null);
  return (
    <section className={panel}>
      <h2 className="font-bold text-lg mb-1">Danh mục loại thành tích</h2>
      <p className="text-xs text-slate-500 mb-3">Dùng để phân loại thành tích và cấu hình tiêu chí quy chế toàn trường.</p>
      <ErrorMessage error={error} />
      <Load state={state}>
        {!(state.data?.achievementTypes || []).length ? (
          <Empty>Chưa có loại thành tích.</Empty>
        ) : (
          <div className="vault-table-wrap"><table className="vault-table">
            <thead><tr><th scope="col">Tên loại</th><th scope="col">Mã</th></tr></thead>
            <tbody>{state.data.achievementTypes.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.code}</td></tr>)}</tbody>
          </table></div>
        )}
      </Load>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={async e => { e.preventDefault(); try { setError(null); await api('/achievements/catalogs', 'POST', { code, name }); setCode(''); setName(''); await state.reload(); } catch (err) { setError(err); } }}>
        <Field label="Mã loại"><input required className={input} value={code} onChange={e => setCode(e.target.value)} placeholder="Ví dụ: SCIENTIFIC_PAPER" /></Field>
        <Field label="Tên loại"><input required className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Bài báo khoa học quốc tế" /></Field>
        <div className="md:col-span-2 flex justify-end">
          <button className={button}>Thêm loại thành tích</button>
        </div>
      </form>
    </section>
  );
}
