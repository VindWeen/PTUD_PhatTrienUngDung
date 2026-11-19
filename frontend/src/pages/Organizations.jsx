import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/VaultDialog';
import { ArrowRight, Plus, X, Pencil, Trash2, ChevronDown, ChevronUp, Network, CornerDownRight, Building2 } from 'lucide-react';
import { api, array } from '../services/vaultApi';
import { useLoad } from '../hooks/useLoad';
import { Page } from '../components/common/VaultPage';
import { ErrorMessage, Field, Empty, Load, Item, StatusBadge, displayLabel } from '../components/common/VaultPrimitives';
import { input, button, secondary, panel } from '../components/common/vaultStyles';

/* =====================================================================
   Cơ cấu tổ chức trực quan (Tree Hierarchy)
   ===================================================================== */
function OrgHierarchyTree({ org, parentOrg, childUnits }) {
  const [open, setOpen] = useState(false);
  if (!parentOrg && !childUnits.length) return null;

  return (
    <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1.5"
      >
        <Network size={14} />
        <span>Cơ cấu phân tầng tổ chức</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          {/* Cấp trên (Parent) */}
          {parentOrg && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
                ↑
              </span>
              <span>Cấp trên: <strong>{parentOrg.name}</strong></span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-semibold">
                {displayLabel(parentOrg.organization_type)}
              </span>
            </div>
          )}

          {/* Đơn vị hiện tại (Active) */}
          <div className="flex items-center gap-2 pl-4 py-1 border-l-2 border-teal-500 font-bold text-teal-800 dark:text-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            <span>{org.name}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-[10px] font-bold text-teal-800 dark:text-teal-200">
              Đang chọn ({displayLabel(org.organization_type)})
            </span>
          </div>

          {/* Đơn vị trực thuộc con (Children) */}
          {childUnits.length > 0 && (
            <div className="pl-6 space-y-1 pt-1 border-l-2 border-slate-200 dark:border-slate-700 ml-2">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                Đơn vị trực thuộc ({childUnits.length}):
              </span>
              {childUnits.map(child => (
                <div key={child.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <CornerDownRight size={13} className="text-slate-400 shrink-0" />
                  <span>{child.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-semibold">
                    {displayLabel(child.organization_type)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   Trang Tổ chức (Giữ nguyên các chức năng, đồng bộ style)
   ===================================================================== */
export function Organizations() {
  const state = useLoad('/organizations'), invites = useLoad('/me/invitations'), profile = useLoad('/me/profile');
  const applications = useLoad('/me/join-requests');
  const [showApplications, setShowApplications] = useState(false);
  const [joinOrg, setJoinOrg] = useState('');
  const [joinReason, setJoinReason] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const { hasRole } = useAuth();
  const admin = hasRole('SYSTEM_ADMIN');
  const [showForm, setShowForm] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [detailParams, setDetailParams] = useSearchParams();
  const selected = detailParams.get('organization') ? Number(detailParams.get('organization')) : null;
  const setSelected = id => setDetailParams(id ? { organization: String(id) } : {});
  const [renameOpen, setRenameOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [members, setMembers] = useState([]);
  const [workspaceTab, setWorkspaceTab] = useState('members');
  const [showMemberInvite, setShowMemberInvite] = useState(false);
  const [inviteFailures, setInviteFailures] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('TEAM');
  const [parent, setParent] = useState('');
  const membership = profile.data?.memberships || [];
  const permitted = useCallback((id, permission) => {
    if (admin) return true;
    return (profile.data?.orgGrants || []).some(grant => {
      if (grant.permission_code !== permission) return false;
      if (String(grant.organization_id) === String(id)) return true;
      if (!grant.include_descendants) return false;
      let cursor = array(state.data).find(org => String(org.id) === String(id));
      const seen = new Set();
      while(cursor?.parent_id && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        if(String(cursor.parent_id) === String(grant.organization_id)) return true;
        cursor = array(state.data).find(org => String(org.id) === String(cursor.parent_id));
      }
      return false;
    });
  }, [admin, profile.data, state.data]);
  const grants = profile.data?.orgGrants || [];

  const mine = array(state.data).filter(org => admin || membership.some(m => String(m.organization_id) === String(org.id)) || grants.some(g => String(g.organization_id) === String(org.id)));

  const workspaceTabs = [
    ['members', 'Thành viên'],
    ...(selected && permitted(selected, 'STRUCTURE_MANAGE') ? [['structure', 'Cơ cấu tổ chức']] : []),
  ];
  const activeTab = workspaceTabs.some(([id]) => id === workspaceTab) ? workspaceTab : 'members';

  async function select(id) {
    if (id !== selected) {
      setWorkspaceTab('members');
      setShowMemberInvite(false);
      setMembers([]);
    }
    setSelected(id);
    setError(null);
    try {
      if (permitted(id, 'MEMBERS_VIEW')) setMembers(array(await api(`/organizations/${id}/members?includeDescendants=auto`)));
      else setMembers([]);
      // Cuộn mượt đến không gian tổ chức vừa mở
      setTimeout(() => {
        const el = document.getElementById('active-org-workspace');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch(err) {
      setMembers([]);
      setError(err);
    }
  }

  async function respond(id, accept) {
    try {
      await api(`/invitations/${id}/respond`, 'POST', { accept });
      await invites.reload();
      await state.reload();
      await profile.reload();
    } catch(err) {
      setError(err);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!selected || !profile.data || !state.data) return;
    if (!permitted(selected, 'MEMBERS_VIEW')) { setMembers([]); return; }
    api('/organizations/' + selected + '/members?includeDescendants=auto').then(value => { if (!cancelled) setMembers(array(value)); }).catch(err => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [selected, profile.data, state.data, permitted]);

  const selectedOrg = array(state.data).find(o => String(o.id) === String(selected));

  return (
    <Page
      title="Tổ chức"
      description="Không gian của các tổ chức bạn tham gia và những đơn vị bạn được giao quản lý."
      actions={
        <div className="flex items-center gap-2">
          <button className={secondary} onClick={() => setShowApplications(true)}>Xin gia nhập</button>
          <button className={secondary} onClick={() => setShowInvites(true)}>
            Lời mời đến ({array(invites.data).filter(i => i.status === 'PENDING').length})
          </button>
          <button className={button} onClick={() => setShowForm(true)}>
            <Plus size={16} />
            <span>{admin ? 'Tạo tổ chức' : 'Tạo nhóm độc lập'}</span>
          </button>
        </div>
      }
    >
      <ErrorMessage error={error} />
      <Modal open={showApplications} onClose={() => setShowApplications(false)} title="Xin gia nhập tổ chức">
        <ErrorMessage error={error} />
        <form className="space-y-3" onSubmit={async event => {
          event.preventDefault();
          setError(null);
          try {
            await api(`/organizations/${joinOrg}/join-requests`, 'POST', joinReason.trim() ? { reason: joinReason.trim() } : {});
            setJoinOrg('');
            setJoinReason('');
            await applications.reload();
          } catch (err) { setError(err); }
        }}>
          <Field label="Đơn vị">
            <select className={input} required value={joinOrg} onChange={e => setJoinOrg(e.target.value)}>
              <option value="">Chọn đơn vị</option>
              {array(state.data).filter(o => !membership.some(m => String(m.organization_id) === String(o.id)) &&
                !array(applications.data).some(r => String(r.organization_id) === String(o.id) && r.status === 'PENDING'))
                .map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
            </select>
          </Field>
          <Field label="Lý do (không bắt buộc)"><input className={input} maxLength={500} value={joinReason} onChange={e => setJoinReason(e.target.value)} /></Field>
          <button className={button} disabled={!joinOrg}>Gửi yêu cầu</button>
        </form>
        <Load state={applications}>
          <ul className="mt-4 space-y-2">
            {array(applications.data).map(r => <li key={r.id}>{r.organization_name} · {({ PENDING: 'Đang chờ', ACCEPTED: 'Đã chấp nhận', DECLINED: 'Đã từ chối' })[r.status]}</li>)}
          </ul>
        </Load>
      </Modal>

      <nav aria-label="Đường dẫn" className="flex items-center gap-2 text-sm"><button type="button" className="min-h-11 text-teal-700" onClick={() => setSelected(null)}>Tổ chức</button>{selected && <span> / Chi tiết tổ chức</span>}</nav>
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Đổi tên tổ chức"><form className="space-y-4" onSubmit={async e => { e.preventDefault(); try { await api("/organizations/" + selected, "PATCH", { name: organizationName }); await state.reload(); setRenameOpen(false); } catch (err) { setError(err); } }}><Field label="Tên tổ chức"><input required maxLength={300} className={input} value={organizationName} onChange={e => setOrganizationName(e.target.value)} /></Field><button className={button}>Lưu thay đổi</button></form></Modal>
      {/* KHÔNG GIAN TỔ CHỨC ĐƯỢC CHỌN (HIỂN THỊ RÕ RÀNG VỚI NÚT ĐÓNG NỔI BẬT) */}
      {selected && selectedOrg && (
        <section id="active-org-workspace" className="p-6 mb-6 rounded-2xl bg-white dark:bg-slate-800 space-y-5 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 flex items-center justify-center font-bold text-lg">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{selectedOrg.name}</h2>{permitted(selected, "STRUCTURE_MANAGE") && <button type="button" className="min-h-11 min-w-11" aria-label="Đổi tên tổ chức" onClick={() => { setOrganizationName(selectedOrg.name); setRenameOpen(true); }}><Pencil size={17} /></button>}
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">
                    {displayLabel(selectedOrg.organization_type)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Mã đơn vị: {selectedOrg.code}</p>
              </div>
            </div>

            <button
              type="button"
              className="soft-btn-secondary text-xs px-3.5 py-2 inline-flex items-center gap-1.5 font-bold hover:bg-slate-200 transition-colors"
              onClick={() => setSelected(null)}
            >
              <X size={16} /> Quay lại danh sách
            </button>
          </div>

          <nav aria-label="Nội dung chi tiết tổ chức" className="flex flex-wrap gap-x-5 border-b border-slate-200 dark:border-slate-700">
            {workspaceTabs.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={activeTab === id}
                className={'min-h-11 border-b-2 px-2 text-sm font-semibold ' + (activeTab === id ? 'border-teal-600 text-teal-700 dark:text-teal-300' : 'border-transparent text-slate-600 hover:text-teal-700 dark:text-slate-300')}
                onClick={() => setWorkspaceTab(id)}>
                {label}
              </button>
            ))}
          </nav>
          <div hidden={activeTab !== 'members'}>
            <OrganizationMembers key={selected} members={members}
              organizationId={selected}
              organizations={array(state.data)} onOpenOrganization={select}
              canView={permitted(selected, 'MEMBERS_VIEW')} canEdit={permitted(selected, 'ACCESS_MANAGE')}
              canManage={permitted(selected, 'MEMBERS_MANAGE')} onInvite={() => setShowMemberInvite(true)}
              onRemove={async member => {
                if (!window.confirm('Xóa “' + (member.full_name || member.email) + '” khỏi “' + selectedOrg.name + '”?')) return false;
                await api('/organizations/' + selected + '/members/' + member.id, 'DELETE');
                await select(selected);
                return true;
              }}
              onSaved={profile.reload}
              canManageManagers={admin || (selectedOrg.parent_id && permitted(selectedOrg.parent_id, 'ACCESS_MANAGE'))}
            />
              {permitted(selected, 'MEMBERS_MANAGE') && (
                <Modal open={showMemberInvite} onClose={event => { if (inviting) event?.preventDefault(); else { setShowMemberInvite(false); setInviteFailures([]); } }} title="Mời thành viên">
                <form
                  className="space-y-3"
                  onSubmit={async e => {
                    e.preventDefault();
                    try {
                      const raw = [...new Set(email.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean))];
                      if (!raw.length) return;
                      setInviting(true);
                      setInviteFailures([]);
                      const failures = [];
                      for (const address of raw) {
                        try {
                          await api('/organizations/' + selected + '/invitations', 'POST', { email: address });
                        } catch (err) {
                          failures.push({ address, message: err.message || 'Không thể gửi lời mời.' });
                        }
                      }
                      const count = raw.length - failures.length;
                      setInviteFailures(failures);
                      setEmail(failures.map(item => item.address).join(', '));
                      if (!failures.length) setShowMemberInvite(false);
                      setMessage('Đã gửi ' + count + '/' + raw.length + ' lời mời.');
                    } catch(err) {
                      setError(err);
                    } finally { setInviting(false); }
                  }}
                >
                  <Field label="Email thành viên (cách nhau bằng dấu phẩy hoặc xuống dòng)">
                    <textarea
                      rows={2}
                      required
                      placeholder="nguyenvana@lhu.edu.vn, tranvanb@lhu.edu.vn..."
                      className={input}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </Field>
                  {inviteFailures.length > 0 && <ul className="space-y-1 text-sm text-rose-700 dark:text-rose-300" role="alert">{inviteFailures.map(item => <li key={item.address}>{item.address} · {item.message}</li>)}</ul>}
                  <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                    <span className="vault-meta">
                      Tài khoản sẽ nhận được thông báo lời mời và xuất hiện trong danh sách sau khi đồng ý.
                    </span>
                    <button className={button} disabled={inviting}>{inviting ? 'Đang gửi…' : 'Gửi lời mời'}</button>
                  </div>
                </form>
                </Modal>
              )}
          </div>

          {selected && (workspaceTabs.length > 1 || permitted(selected, 'MEMBERS_MANAGE')) && (
            <OrganizationTools
              permissions={{
                structure: permitted(selected, 'STRUCTURE_MANAGE'),
                members: permitted(selected, 'MEMBERS_MANAGE')
              }}
              key={selected}
              organizationId={selected}
              activeTab={activeTab}
              organizations={array(state.data)}
              members={members}
              refresh={async () => { await state.reload(); await profile.reload(); await select(selected); }}
            />
          )}
        </section>
      )}

      {/* DANH SÁCH CÁC TỔ CHỨC CỦA BẠN */}
      <section hidden={!!selected} className={panel}>
        <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100">Tổ chức của bạn</h2>
        <Load state={profile}>
          <Load state={state}>
            {!mine.length ? (
              <Empty action={<button className={secondary} onClick={() => setShowInvites(true)}>Xem lời mời tham gia</button>}>
                Bạn chưa tham gia tổ chức nào. Hãy kiểm tra lời mời hoặc tạo nhóm độc lập.
              </Empty>
            ) : (
              <div className="vault-library-list vault-organization-list">
                {mine.map(org => {
                  const role = membership.find(m => String(m.organization_id) === String(org.id));
                  const parentOrg = array(state.data).find(o => String(o.id) === String(org.parent_id));
                  const isSelected = String(selected) === String(org.id);

                  return (
                    <article
                      className="vault-organization-card"
                      key={org.id}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {displayLabel(org.organization_type)}
                        </span>
                        <span className="vault-status">
                          {admin ? 'Quản trị hệ thống' : role?.title || (grants.some(g => String(g.organization_id) === String(org.id)) ? 'Được cấp quyền quản lý' : 'Thành viên')}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 mt-1">{org.name}</h3>
                      <p className="vault-meta">{org.code}{parentOrg ? ' · Cấp trên: ' + parentOrg.name : ''}</p>

                      {/* Nút Xem chi tiết tổ chức - Nổi bật, dễ nhận biết */}
                      <div className="vault-card-actions pt-2 mt-auto">
                        <button
                          type="button"
                          className={secondary}
                          aria-current={isSelected ? 'true' : undefined}
                          onClick={() => select(org.id)}
                        >
                          <Building2 size={15} />
                          <span>{isSelected ? 'Đang xem tổ chức' : 'Xem tổ chức'}</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Load>
        </Load>
      </section>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={admin ? 'Tạo tổ chức' : 'Tạo nhóm độc lập'}>
        <ErrorMessage error={error} />
        {!admin && <p className="mb-4 text-xs text-slate-500">Bạn có thể tạo nhóm độc lập. Tạo đơn vị trực thuộc yêu cầu quyền quản lý cơ cấu của tổ chức cha.</p>}
        <form className="space-y-4" onSubmit={async e => { e.preventDefault(); try { await api('/organizations', 'POST', { name, code, organizationType: type, parentId: parent ? Number(parent) : null, ...(managerEmail.trim() ? { managerEmail: managerEmail.trim() } : {}) }); setName(''); setCode(''); setManagerEmail(''); setShowForm(false); await state.reload(); await profile.reload(); } catch (err) { setError(err); } }}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên"><input required className={input} value={name} onChange={e => setName(e.target.value)} /></Field>
            <Field label="Mã"><input required className={input} value={code} onChange={e => setCode(e.target.value)} /></Field>
            <Field label="Loại">
              <select className={input} value={type} onChange={e => setType(e.target.value)}>
                {(admin ? ['OTHER','UNIVERSITY','FACULTY','DEPARTMENT','CLASS','COMPANY','TEAM'] : parent ? ['FACULTY','DEPARTMENT','TEAM','OTHER'] : ['TEAM','OTHER']).map(t => <option key={t} value={t}>{displayLabel(t)}</option>)}
              </select>
            </Field>
            <Field label="Tổ chức cha">
              <select className={input} value={parent} onChange={e => { setParent(e.target.value); if (!admin && !e.target.value) setType('TEAM'); }}>
                <option value="">Không có</option>
                {array(state.data).filter(org => permitted(org.id,'STRUCTURE_MANAGE')).map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            </Field>
            {parent && <Field label="Email quản lý đơn vị mới (không bắt buộc)">
              <input className={input} type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} />
              <p className="text-xs text-slate-500">Để trống để bạn quản lý trực tiếp đơn vị mới.</p>
            </Field>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondary} onClick={() => setShowForm(false)}>Hủy</button>
            <button className={button}>Tạo tổ chức</button>
          </div>
        </form>
      </Modal>

      <Modal open={showInvites} onClose={() => setShowInvites(false)} title="Lời mời đến">
        <Load state={invites}>
          {!array(invites.data).length ? (
            <Empty>Chưa có lời mời. Người quản lý tổ chức có thể mời bạn bằng email tài khoản.</Empty>
          ) : (
            array(invites.data).map(inv => (
              <Item key={inv.id}>
                <p><strong>{inv.organization_name}</strong> · <StatusBadge value={inv.status} /></p>
                {inv.status === 'PENDING' && (
                  <div className="mt-3 flex gap-2">
                    <button className={button} onClick={() => respond(inv.id,true)}>Chấp nhận lời mời</button>
                    <button className={secondary} onClick={() => respond(inv.id,false)}>Từ chối</button>
                  </div>
                )}
              </Item>
            ))
          )}
        </Load>
      </Modal>
    </Page>
  );
}

function OrganizationTools({ organizationId, organizations, members, permissions, activeTab, refresh }) {
  const links = useLoad(permissions.structure ? '/organizations/' + organizationId + '/link-requests' : null);
  const joinRequests = useLoad(permissions.members ? '/organizations/' + organizationId + '/join-requests' : null);
  const [childToInvite, setChildToInvite] = useState('');
  const [parent, setParent] = useState('');
  const [review, setReview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null), [message, setMessage] = useState('');
  const currentOrg = organizations.find(o => String(o.id) === String(organizationId));
  async function changeRequest(work, reload) {
    setError(null);
    setMessage('');
    try {
      await work();
      await reload();
      await refresh();
      setMessage('Đã cập nhật yêu cầu.');
    } catch (err) { setError(err); }
  }

  return (
    <div className="space-y-4">
      <ErrorMessage error={error} />
      {message && <p role="status" className="p-3 rounded-xl bg-teal-50 text-teal-800 text-xs font-semibold">{message}</p>}

      {permissions.members && (
        <section hidden={activeTab !== 'members'} className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="font-semibold text-sm">Yêu cầu gia nhập {array(joinRequests.data).filter(r => r.status === 'PENDING').length || ''}</h3>
          <Load state={joinRequests}>
            {!array(joinRequests.data).length && <p className="text-sm text-slate-500">Chưa có yêu cầu.</p>}
            {array(joinRequests.data).map(r => (
              <Item key={r.id}>
                <p><strong>{r.email}</strong> · <StatusBadge value={r.status} /></p>
                {r.reason && <p className="text-sm">{r.reason}</p>}
                {r.status === 'PENDING' && <div className="mt-2 flex gap-2">
                  {[true, false].map(accept => <button key={String(accept)} className={accept ? button : "soft-btn-danger"}
                    onClick={() => changeRequest(() => api(`/organizations/${organizationId}/join-requests/${r.id}/respond`, 'POST', { accept }), joinRequests.reload)}>
                    {accept ? 'Chấp nhận' : 'Từ chối'}
                  </button>)}
                </div>}
              </Item>
            ))}
          </Load>
        </section>
      )}
      {permissions.structure && (
        <div hidden={activeTab !== 'structure'} className="space-y-3">
          {currentOrg && <OrgHierarchyTree org={currentOrg}
            parentOrg={organizations.find(org => String(org.id) === String(currentOrg.parent_id))}
            childUnits={organizations.filter(org => String(org.parent_id) === String(organizationId))} />}
          <section className="vault-task-section"><h3>Thay đổi tổ chức cấp trên</h3>
          <p className="text-xs text-slate-500 mt-0.5">Đề nghị gắn với tổ chức cha hoặc tách khỏi cha hiện tại.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Field label="Tổ chức cha đề nghị">
                <select className={input} value={parent} onChange={e => setParent(e.target.value)}>
                  <option value="">Tách khỏi tổ chức cha</option>
                  {organizations.filter(o => String(o.id) !== String(organizationId)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
            </div>
            <button className={button} disabled={!parent && !currentOrg?.parent_id} onClick={() => {
              const from = organizations.find(o => String(o.id) === String(currentOrg?.parent_id))?.name || 'Không có';
              const to = organizations.find(o => String(o.id) === parent)?.name || 'Không có';
              setError(null);
              setReview({ from, to, targetParentId: parent ? Number(parent) : null });
            }}>
              Gửi yêu cầu
            </button>
          </div>
          </section>
          <section className="vault-task-section"><h3>Mời đơn vị trực thuộc</h3><div className="flex flex-wrap items-end gap-3">
            <Field label="Đơn vị muốn mời">
              <select className={input} value={childToInvite} onChange={e => setChildToInvite(e.target.value)}>
                <option value="">Chọn đơn vị</option>
                {organizations.filter(o => String(o.id) !== String(organizationId) && String(o.parent_id) !== String(organizationId))
                  .map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <button className={button} disabled={!childToInvite} onClick={() => changeRequest(async () => {
              await api(`/organizations/${childToInvite}/link-requests`, 'POST', { targetParentId: Number(organizationId) });
              setChildToInvite('');
            }, links.reload)}>Gửi lời mời liên kết</button>
          </div></section>
          <section className="vault-task-section"><Load state={links}>
            <h4 className="mt-4 text-sm font-semibold">Yêu cầu liên kết đến và đi</h4>
            {!array(links.data).length && <p className="text-sm text-slate-500">Chưa có yêu cầu.</p>}
            {array(links.data).map(r => (
              <Item key={r.id}>
                <p><strong>{r.child_name}</strong> {r.target_parent_name ? `→ ${r.target_parent_name}` : '· Tách khỏi đơn vị cha'} · <StatusBadge value={r.status} /></p>
                {r.status === 'PENDING' && new Date(r.expires_at) > new Date() && (
                  (String(r.child_organization_id) === String(organizationId) && !r.child_consented_by_user_id)
                  || (String(r.target_parent_id) === String(organizationId) && !r.parent_consented_by_user_id)
                ) && <div className="mt-2 flex gap-2">
                  {[true, false].map(accept => <button key={String(accept)} className={accept ? button : "soft-btn-danger"}
                    onClick={() => changeRequest(() => api(`/organization-link-requests/${r.id}/respond`, 'POST', { accept }), links.reload)}>
                    {accept ? 'Chấp nhận' : 'Từ chối'}
                  </button>)}
                </div>}
              </Item>
            ))}
          </Load></section>
        </div>
      )}

      <Modal open={!!review} title="Xác nhận yêu cầu đổi cấp trên" onClose={() => { if (!sending) setReview(null); }}>
        {review && <div className="space-y-4">
          <p><strong>{currentOrg?.name}</strong></p>
          <p className="vault-meta">Cấp trên hiện tại: {review.from}</p>
          <p className="vault-meta">Cấp trên đề nghị: {review.to}</p>
          <ErrorMessage error={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} disabled={sending} onClick={() => setReview(null)}>Hủy</button>
            <button type="button" className={button} disabled={sending} onClick={async () => {
              setSending(true);
              try {
                const ok = await changeRequest(() => api('/organizations/' + organizationId + '/link-requests', 'POST', { targetParentId: review.targetParentId }), links.reload);
                if (ok !== false) setReview(null);
              } finally { setSending(false); }
            }}>{sending ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
          </div>
        </div>}
      </Modal>
    </div>
  );
}

const organizationPermissionGroups = [
  ['Thành viên & cơ cấu', {
    MEMBERS_VIEW: 'Xem thành viên',
    MEMBERS_MANAGE: 'Quản lý thành viên',
    STRUCTURE_MANAGE: 'Quản lý cơ cấu',
    ACCESS_MANAGE: 'Quản lý quyền',
  }],
  ['Hồ sơ & thông báo', {
    ASSESSMENTS_VIEW: 'Xem kết quả đối chiếu',
    ASSESSMENTS_RUN: 'Đối chiếu hồ sơ',
    MEMBERS_NOTIFY: 'Gửi thông báo',
  }],
  ['Quy chế', {
    REGULATIONS_CREATE: 'Tạo quy chế',
    REGULATIONS_MANAGE: 'Soạn quy chế',
    REGULATIONS_PUBLISH: 'Công bố quy chế',
    REGULATIONS_SHARE: 'Chia sẻ quy chế',
    REGULATIONS_ADOPT: 'Tiếp nhận quy chế',
    REGULATIONS_UPDATE: 'Đổi phiên bản quy chế',
  }],
];

function OrganizationMembers({ organizationId, members, canView, canEdit, canManage, onInvite, onRemove, onSaved, canManageManagers, organizations, onOpenOrganization }) {
  const accessUrl = '/organizations/' + organizationId + '/access';
  const access = useLoad(canEdit ? accessUrl : null);
  const [editor, setEditor] = useState(null);
  const [unitFilter, setUnitFilter] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const byUser = new Map();
  for (const grant of canEdit ? array(access.data) : []) {
    const id = String(grant.user_id);
    if (!byUser.has(id)) byUser.set(id, []);
    byUser.get(id).push(grant);
  }
  const memberIds = new Set(members.map(member => String(member.user_id)));
  const organizationManagers = [...byUser.entries()].filter(([id, grants]) => !memberIds.has(id) && grants.some(g => g.permission_code === "ACCESS_MANAGE")).map(([, grants]) => ({ ...grants[0], title: "Quản lý" }));
  const allMembers = [...members, ...organizationManagers];
  const units = [...new Map(allMembers.map(member => [String(member.organization_id || organizationId), {
    id: String(member.organization_id || organizationId),
    name: member.organization_name || organizations.find(org => String(org.id) === String(organizationId))?.name || '',
  }])).values()];
  const filteredMembers = allMembers.filter(member =>
    (!unitFilter || String(member.organization_id || organizationId) === unitFilter) &&
    ((member.full_name || '') + ' ' + (member.email || '')).toLocaleLowerCase('vi').includes(memberSearch.trim().toLocaleLowerCase('vi')));
  const groupedMembers = new Map();
  for (const member of filteredMembers) {
    const key = String(member.user_id);
    if (!groupedMembers.has(key)) groupedMembers.set(key, []);
    groupedMembers.get(key).push(member);
  }
  const visibleMembers = [...groupedMembers.values()].map(entries => ({ ...entries[0], memberships: entries }));
  const totalPeople = new Set(allMembers.map(member => String(member.user_id))).size;
  const managers = !canManageManagers ? [] : canView ? [...byUser.entries()].filter(([id, grants]) => !memberIds.has(id) && !grants.some(g => g.permission_code === 'ACCESS_MANAGE')) : [...byUser.entries()];
  const accessReady = canEdit && !access.loading && !access.error;
  const actionClass = 'min-h-11 min-w-11 rounded-lg border border-transparent hover:border-current px-2 font-semibold hover:underline disabled:opacity-50';

  async function remove(member) {
    setRemoving(member.id);
    setError(null);
    setMessage('');
    try {
      if (await onRemove(member)) {
        setMessage('Đã xóa thành viên khỏi tổ chức.');
        if (canEdit) await access.reload();
        await onSaved();
      }
    } catch (err) {
      setError(err);
    } finally {
      setRemoving(null);
    }
  }

  function renderTable(people, isMembership) {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-4 py-3">Họ tên / Email</th>
              {isMembership && <th scope="col" className="px-4 py-3">Khoa / Đơn vị</th>}
              {isMembership && <th scope="col" className="px-4 py-3">Vai trò</th>}
              {canEdit && <th scope="col" className="px-4 py-3">Quyền</th>}
              {(canEdit || (isMembership && canManage)) && <th scope="col" className="px-4 py-3">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {people.map(person => {
              const grants = byUser.get(String(person.user_id)) || [];
              const manager = grants.some(g => g.permission_code === 'ACCESS_MANAGE');
              const direct = !person.organization_id || String(person.organization_id) === String(organizationId);
              const editable = direct && (!manager || canManageManagers);
              return (
                <tr key={person.user_id}>
                  <td className="px-4 py-3">
                    <strong className="block">{person.full_name || person.email}</strong>
                    {person.full_name && <span className="block text-xs text-slate-600 dark:text-slate-300">{person.email}</span>}
                  </td>
                  {isMembership && <td className="px-4 py-3"><div className="space-y-1">{(person.memberships || [person]).map(member => (
                    <div key={member.organization_id || organizationId}>{member.organization_name || organizations.find(org => String(org.id) === String(organizationId))?.name}
                      {member.organization_id && String(member.organization_id) !== String(organizationId) && <button type="button" className="ml-2 min-h-11 text-teal-700 underline" onClick={() => onOpenOrganization(member.organization_id)}>Xem đơn vị</button>}
                    </div>
                  ))}</div></td>}
                  {isMembership && <td className="px-4 py-3">{manager ? 'Quản lý' : person.title || 'Thành viên'}</td>}
                  {canEdit && <td className="px-4 py-3 whitespace-nowrap">{direct && accessReady ? new Set(grants.map(grant => grant.permission_code)).size + ' quyền' : '—'}</td>}
                  {(canEdit || (isMembership && canManage)) && (
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap">
                        {canEdit && editable && <button type="button" aria-label={"Chỉnh sửa quyền của " + (person.full_name || person.email)} title="Chỉnh sửa quyền" disabled={!accessReady || removing !== null}
                          className={actionClass + ' text-teal-700 dark:text-teal-300'}
                          onClick={() => setEditor({ person, grants })}><Pencil size={17} /></button>}
                        {isMembership && canManage && editable && memberIds.has(String(person.user_id)) && <button type="button" aria-label={"Xóa " + (person.full_name || person.email) + " khỏi tổ chức"} title="Xóa khỏi tổ chức" disabled={removing !== null}
                          className={actionClass + ' text-rose-700 dark:text-rose-300'}
                          onClick={() => remove(person)}><Trash2 size={17} /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">Danh sách thành viên{canView && ' (' + totalPeople + ')'}</h3>
        {canManage && <button type="button" className={button} onClick={onInvite}>Mời thành viên</button>}
      </div>
      {canView && <div className="flex flex-wrap items-end gap-3">
        <Field label="Tìm thành viên"><input className={input} type="search" placeholder="Họ tên hoặc email" value={memberSearch} onChange={event => setMemberSearch(event.target.value)} /></Field>
        <Field label="Khoa / Đơn vị"><select className={input} value={unitFilter} onChange={event => setUnitFilter(event.target.value)}><option value="">Tất cả đơn vị</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field>
        <p className="pb-3 text-sm text-slate-600 dark:text-slate-300">{visibleMembers.length} / {totalPeople} thành viên</p>
      </div>}
      <ErrorMessage error={error || (canEdit ? access.error : null)} />
      {message && <p role="status" className="text-sm text-teal-700 dark:text-teal-300">{message}</p>}
      {canView && visibleMembers.length > 0 ? renderTable(visibleMembers, true) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {canView ? allMembers.length ? 'Không có thành viên phù hợp với bộ lọc.' : 'Chưa có thành viên trong tổ chức.' : 'Bạn cần quyền xem danh sách thành viên.'}
        </p>
      )}
      {managers.length > 0 && (
        <section className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold">{canView ? 'Người được cấp quyền quản lý ngoài danh sách thành viên' : 'Người được cấp quyền trong tổ chức'}</h3>
          {renderTable(managers.map(([, grants]) => grants[0]), false)}
        </section>
      )}
      {canEdit && editor && (
        <OrganizationPermissionDialog
          editor={editor} accessUrl={accessUrl}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            setMessage('Đã lưu thay đổi quyền.');
            await access.reload();
            await onSaved();
          }}
        />
      )}
    </div>
  );
}

function OrganizationPermissionDialog({ editor, accessUrl, onClose, onSaved }) {
  const { person, grants } = editor;
  const [choices, setChoices] = useState(() => {
    const initial = new Map();
    for (const grant of grants) {
      initial.set(grant.permission_code, !!grant.include_descendants || initial.get(grant.permission_code) === true);
    }
    return initial;
  });
  const [initialChoices] = useState(choices);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const added = [...choices].filter(([code]) => !initialChoices.has(code)).length;
  const removed = [...initialChoices].filter(([code]) => !choices.has(code)).length;
  const changed = [...choices].filter(([code, scope]) => initialChoices.has(code) && initialChoices.get(code) !== scope).length;
  const [error, setError] = useState(null);

  function change(code, scope) {
    setChoices(previous => {
      const next = new Map(previous);
      if (scope === undefined) next.delete(code);
      else next.set(code, scope);
      return next;
    });
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!reviewing) { setReviewing(true); return; }
    setSaving(true);
    setError(null);
    try {
      await api(accessUrl + '/users/' + person.user_id, 'PUT', {
        grantIds: grants.map(grant => grant.id),
        permissions: [...choices].map(([permissionCode, includeDescendants]) => ({ permissionCode, includeDescendants })),
      });
      await onSaved();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <Modal open title={reviewing ? 'Xác nhận thay đổi quyền' : 'Chỉnh sửa quyền'} onClose={event => {
      if (saving) event?.preventDefault();
      else if (reviewing) setReviewing(false);
      else onClose();
    }}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <p className="font-semibold">{person.full_name || person.email}</p>
          {person.full_name && <p className="text-sm text-slate-600 dark:text-slate-300">{person.email}</p>}
        </div>
        <ErrorMessage error={error} />
        <p className="text-sm text-slate-600">Bao gồm đơn vị trực thuộc sẽ áp dụng quyền xuống các tổ chức con, ví dụ từ trường xuống các khoa.</p>
        {reviewing && <div role="status" className="vault-summary"><span>Thêm {added} quyền</span><span>Bỏ {removed} quyền</span><span>Đổi phạm vi {changed} quyền</span></div>}
        <div hidden={reviewing} className="max-h-[48dvh] overflow-y-auto pr-2 space-y-4">
          {organizationPermissionGroups.map(([group, labels]) => (
            <fieldset key={group} disabled={saving} className="rounded-xl border border-slate-200 px-3 dark:border-slate-700">
              <legend className="px-1 text-sm font-semibold"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="accent-teal-700" ref={node => { if (node) node.indeterminate = Object.keys(labels).some(code => choices.has(code)) && !Object.keys(labels).every(code => choices.has(code)); }} checked={Object.keys(labels).every(code => choices.has(code))} onChange={e => { const enabled = e.target.checked; setChoices(previous => { const next = new Map(previous); for (const code of Object.keys(labels)) { if (enabled) next.set(code, previous.get(code) ?? false); else next.delete(code); } return next; }); }} />{group}</label></legend>
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {Object.entries(labels).map(([code, label]) => (
                  <div key={code} className="flex flex-wrap items-center justify-between gap-x-4">
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-teal-700" checked={choices.has(code)}
                        onChange={e => change(code, e.target.checked ? false : undefined)} />
                      {label}
                    </label>
                    {choices.has(code) && (
                      <label className="flex min-h-11 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input type="checkbox" className="accent-teal-700" checked={choices.get(code)}
                          aria-label={label + ' — Bao gồm đơn vị trực thuộc'}
                          onChange={e => change(code, e.target.checked)} />
                        Bao gồm đơn vị trực thuộc
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button type="button" className={secondary} disabled={saving} onClick={() => reviewing ? setReviewing(false) : onClose()}>{reviewing ? 'Quay lại' : 'Hủy'}</button>
          <button className={button} disabled={saving}>{saving ? 'Đang lưu…' : reviewing ? 'Xác nhận lưu quyền' : 'Xem thay đổi'}</button>
        </div>
      </form>
    </Modal>
  );
}
