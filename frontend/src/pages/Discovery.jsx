import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import RegulationRuleDescription from './RegulationRuleDescription';
import { assessmentContexts, effective } from './assessmentSelection';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/VaultDialog';
import VaultTabs from '../components/common/VaultTabs';
import NumberedPagination from '../components/common/NumberedPagination';
import { Plus, FileArchive } from 'lucide-react';
import { api, array, saveBlob } from '../services/vaultApi';
import { useLoad } from '../hooks/useLoad';
import { Page } from '../components/common/VaultPage';
import { ErrorMessage, Field, Empty, Load, DateText, conclusionLabel } from '../components/common/VaultPrimitives';
import { input, button, secondary, panel } from '../components/common/vaultStyles';
import { localDay } from '../components/calendar/calendarDates';

function missingText(details) {
  if (!details) return '';
  if (typeof details === 'string') return details;
  const missingBranch = Array.isArray(details.children) && !details.children.some(child => child.conclusion === 'MET')
    && details.children.some(child => child.conclusion === 'INSUFFICIENT_DATA' && missingText(child.missing));
  if (details.unknown_attributes || missingBranch) return 'Một số thông tin thành tích còn thiếu; hãy kiểm tra và bổ sung hồ sơ.';
  if (typeof details.remaining === 'number' && details.remaining > 0) return `Còn thiếu ${details.remaining} so với yêu cầu.`;
  return '';
}

function canAssessOrganization(organizations, grants, admin, organizationId) {
  if (admin) return true;
  return ['ASSESSMENTS_RUN', 'ASSESSMENTS_VIEW', 'MEMBERS_VIEW'].every(code =>
    grants.some(grant => {
      if (grant.permission_code !== code) return false;
      let org = organizations.find(item => String(item.id) === String(organizationId));
      const seen = new Set();
      while (org && !seen.has(org.id)) {
        seen.add(org.id);
        if (String(org.id) === String(grant.organization_id)) {
          return String(org.id) === String(organizationId) || !!grant.include_descendants;
        }
        org = organizations.find(item => String(item.id) === String(org.parent_id));
      }
      return false;
    })
  );
}

function AssessmentPicker({ label, items, selected, onChange, disabled }) {
  const ref = useRef(null);
  const [search, setSearch] = useState('');
  const options = items.filter(item => matchesAssessmentSearch(item.search || item.label, search));
  const checked = options.filter(item => selected.includes(item.id)).length;
  useEffect(() => {
    const close = event => {
      if (ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  return <details ref={ref} className="org-assessment-picker" onKeyDown={event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      ref.current.open = false;
      ref.current.querySelector('summary')?.focus();
    }
  }}>
    <summary className="soft-btn-secondary" aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }}>
      {label}: {selected.length}/{items.length} đã chọn
    </summary>
    <div className="org-assessment-options">
      <Field label={'Tìm ' + label.toLocaleLowerCase('vi')}><input type="search" className={input} value={search} onChange={event => setSearch(event.target.value)} /></Field>
      <label className="vault-selection-target vault-inline-choice">
        <input type="checkbox" disabled={disabled || !options.length} checked={!!options.length && checked === options.length}
          ref={node => { if (node) node.indeterminate = checked > 0 && checked < options.length; }}
          onChange={event => {
            const shown = new Set(options.map(item => item.id));
            onChange(event.target.checked ? [...new Set([...selected, ...shown])] : selected.filter(id => !shown.has(id)));
          }} />
        Chọn tất cả kết quả ({options.length})
      </label>
      <div className="max-h-64 overflow-auto">
        {options.map(item => <label className="vault-selection-target vault-inline-choice" key={item.id}>
          <input type="checkbox" disabled={disabled} checked={selected.includes(item.id)}
            onChange={event => onChange(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />
          <span>{item.label}{item.meta && <span className="vault-meta block">{item.meta}</span>}</span>
        </label>)}
        {!options.length && <p className="vault-meta px-3 py-2">Không có mục phù hợp.</p>}
      </div>
    </div>
  </details>;
}

function matchesAssessmentSearch(value, search) {
  const normalize = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('vi').replaceAll('đ', 'd');
  return normalize(value || '').includes(normalize(search.trim()));
}

const assessmentNeedsReview = result => ['NOT_MET', 'INSUFFICIENT_DATA'].includes(result.conclusion);
const notificationMissingCount = run => array(run.results).filter(assessmentNeedsReview).length;

function OrganizationAssessment() {
  const organizations = useLoad('/organizations');
  const profile = useLoad('/me/profile');
  const { hasRole } = useAuth();
  const [organizationId, setOrganizationId] = useState('');
  const [includeChildren, setIncludeChildren] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [selectedRules, setSelectedRules] = useState([]);
  const [evaluationDate, setEvaluationDate] = useState(localDay);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState([]);
  const [sent, setSent] = useState({});
  const [draft, setDraft] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const orgs = array(organizations.data);
  function permitted(id, code, descendants = false) {
    if (hasRole('SYSTEM_ADMIN')) return true;
    return (profile.data?.orgGrants || []).some(grant => {
      if (grant.permission_code !== code || (descendants && !grant.include_descendants)) return false;
      let org = orgs.find(item => String(item.id) === String(id));
      const seen = new Set();
      while (org && !seen.has(org.id)) {
        seen.add(org.id);
        if (String(org.id) === String(grant.organization_id)) return String(org.id) === String(id) || !!grant.include_descendants;
        org = orgs.find(item => String(item.id) === String(org.parent_id));
      }
      return false;
    });
  }
  const manageable = orgs.filter(org => canAssessOrganization(orgs, profile.data?.orgGrants || [], hasRole('SYSTEM_ADMIN'), org.id));
  const members = useLoad(organizationId ? '/organizations/' + organizationId + '/members?includeDescendants=' + includeChildren : null);
  const options = useLoad(organizationId ? '/organizations/units/' + organizationId + '/assessment-options' : null);
  const ready = Boolean(organizationId && !members.loading && !members.error && !options.loading && !options.error);
  const people = new Map(array(members.data).map(person => [String(person.user_id), person]));
  const rules = array(options.data).filter(version => effective(version, evaluationDate));
  const peopleIds = selectedPeople.filter(id => people.has(id));
  const chosen = rules.filter(rule => selectedRules.includes(String(rule.id)));
  const parentName = orgs.find(org => String(org.id) === organizationId)?.name || 'Tổ chức';
  const notifyAllowed = Boolean(organizationId) && permitted(organizationId, 'MEMBERS_NOTIFY', includeChildren);
  const grouped = new Map();
  for (const run of results) {
    const id = String(run.subject_user_id);
    if (!grouped.has(id)) {
      const person = people.get(id);
      grouped.set(id, { id, name: person?.full_name || person?.email || 'Thành viên #' + id, unit: person?.organization_name, runs: [] });
    }
    grouped.get(id).runs.push(run);
  }
  const rows = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const passed = row => row.runs.some(run => run.conclusion === 'MET');
  const needsReview = row => row.runs.some(assessmentNeedsReview);
  const visible = rows.filter(row => (filter === 'all' || (filter === 'passed' ? passed(row) : needsReview(row)))
    && matchesAssessmentSearch([row.name, row.unit].filter(Boolean).join(' '), search));
  const eligible = visible.filter(row => !sent[row.id] && !row.runs.some(run => run.stale));
  const selectedRecipients = eligible.filter(row => picked.includes(row.id));
  const pageSize = 20;
  const maxPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, maxPage);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function clearResults() {
    setResults([]); setProgress(null); setPicked([]); setSent({}); setFilter('all'); setSearch(''); setPage(1);
    setMessage('');
  }

  async function check() {
    if (busy || !ready || peopleIds.length < 1 || peopleIds.length > 500 || !chosen.length) return;
    clearResults();
    setBusy(true);
    const failures = [];
    let finished = 0;
    setProgress({ finished, total: chosen.length, failures: [] });
    try {
      for (const rule of chosen) {
        try {
          const response = await api('/organizations/units/' + organizationId + '/ai-scan', 'POST', {
            regulation_version_id: Number(rule.id), evaluation_date: evaluationDate,
            include_descendants: includeChildren, user_ids: peopleIds.map(Number),
          });
          setResults(previous => [...previous, ...array(response).map(run => ({ ...run, regulation_name: rule.name }))]);
        } catch (failure) { failures.push({ name: rule.name, error: failure }); }
        finished++;
        setProgress({ finished, total: chosen.length, failures: [...failures] });
      }
    } finally { setBusy(false); }
  }

  function startMessage(recipients, resend = false) {
    setMessage('');
    setDraft({ recipients, note: '', deadline: '', previewIndex: 0, resendKey: resend ? crypto.randomUUID() : undefined, errors: [] });
  }

  async function send(event) {
    event.preventDefault();
    if (sending || !notifyAllowed || !draft?.recipients.length) return;
    setSending(true);
    const failed = [];
    const errors = [];
    let count = 0;
    try {
      for (const row of draft.recipients) {
        try {
          const result = await api('/organizations/units/' + organizationId + '/assessment-notifications', 'POST', {
            runIds: row.runs.map(run => Number(run.id)), note: draft.note,
            ...(draft.deadline ? { deadline: draft.deadline } : {}),
            ...(draft.resendKey ? { resendKey: draft.resendKey } : {}),
          });
          setSent(previous => ({ ...previous, [row.id]: result.sentAt }));
          setPicked(previous => previous.filter(id => id !== row.id));
          count++;
        } catch (failure) {
          failed.push(row); errors.push({ name: row.name, error: failure });
        }
      }
      setMessage('Đã xác nhận gửi cho ' + count + '/' + draft.recipients.length + ' thành viên.');
      setDraft(failed.length ? { ...draft, recipients: failed, errors, previewIndex: 0 } : null);
    } finally { setSending(false); }
  }

  const preview = draft?.recipients[draft.previewIndex];
  return <>
    <section className={panel + ' space-y-3'}>
      <details open className="org-assessment-filters">
        <summary className="cursor-pointer font-bold">Bộ lọc đối chiếu hàng loạt</summary>
        <fieldset disabled={busy || sending} className="mt-3 min-w-0">
          <div className="org-assessment-toolbar">
            <Field label="Đơn vị"><select className={input} value={organizationId} onChange={event => {
              setOrganizationId(event.target.value); setIncludeChildren(false); setSelectedPeople([]); setSelectedRules([]); clearResults();
            }}><option value="">Chọn đơn vị</option>{manageable.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
            <Field label="Ngày đối chiếu"><input type="date" className={input} value={evaluationDate} onChange={event => {
              const day = event.target.value || localDay();
              setEvaluationDate(day);
              setSelectedRules(previous => previous.filter(id => array(options.data).some(rule => String(rule.id) === id && effective(rule, day))));
              clearResults();
            }} /></Field>
            {organizationId && ['ASSESSMENTS_RUN', 'ASSESSMENTS_VIEW', 'MEMBERS_VIEW'].every(code => permitted(organizationId, code, true)) &&
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={includeChildren} onChange={event => {
                setIncludeChildren(event.target.checked); setSelectedPeople([]); clearResults();
              }} />Gồm đơn vị trực thuộc</label>}
          </div>
          <div className="org-assessment-toolbar mt-2">
            <AssessmentPicker key={'people:' + organizationId + ':' + includeChildren} label="Thành viên" disabled={!ready || busy}
              items={Array.from(people, ([id, person]) => ({ id, label: person.full_name || person.email, meta: person.organization_name, search: [person.full_name, person.email, person.organization_name].filter(Boolean).join(' ') }))}
              selected={peopleIds} onChange={setSelectedPeople} />
            <AssessmentPicker key={'rules:' + organizationId} label="Quy chế" disabled={!ready || busy}
              items={rules.map(rule => ({ id: String(rule.id), label: rule.name, meta: rule.version_label }))}
              selected={chosen.map(rule => String(rule.id))} onChange={setSelectedRules} />
            <button type="button" className={button} disabled={!ready || busy || !peopleIds.length || peopleIds.length > 500 || !chosen.length} onClick={check}>
              {busy ? 'Đang đối chiếu…' : 'Chạy đối chiếu (' + peopleIds.length * chosen.length + ')'}
            </button>
          </div>
          {peopleIds.length > 500 && <p className="vault-meta mt-2">Chọn tối đa 500 thành viên mỗi lượt.</p>}
        </fieldset>
      </details>
      <ErrorMessage error={organizations.error || profile.error || members.error || options.error} />
      {progress && <div role="status" className="vault-meta">
        Đã xử lý {progress.finished}/{progress.total} quy chế.
        {progress.failures.map(item => <div key={item.name}><strong>{item.name}</strong><ErrorMessage error={item.error} /></div>)}
      </div>}
    </section>

    {!!rows.length && <section className={panel + ' space-y-4'}>
      <h2 className="text-lg font-bold">Kết quả đối chiếu ({rows.length} thành viên)</h2>
      <VaultTabs label="Lọc kết quả đối chiếu" value={filter} onChange={value => { setFilter(value); setPage(1); setPicked([]); }}
        items={[
          ['all', 'Tất cả (' + rows.length + ')'],
          ['passed', 'Đạt ít nhất 1 quy chế (' + rows.filter(passed).length + ')'],
          ['missing', 'Còn thiếu hoặc chưa đạt (' + rows.filter(needsReview).length + ')'],
        ]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="Tìm thành viên trong kết quả"><input type="search" className={input} value={search} onChange={event => {
          setSearch(event.target.value); setPage(1); setPicked([]);
        }} /></Field>
        {notifyAllowed && <button type="button" className={button} disabled={busy || sending || !selectedRecipients.length}
          onClick={() => startMessage(selectedRecipients)}>Gửi thông báo hàng loạt ({selectedRecipients.length})</button>}
      </div>
      {message && <p role="status" className="vault-meta">{message}</p>}
      {visible.length ? <div className="vault-table-wrap">
        <table className="vault-table org-assessment-table">
          <thead><tr>
            {notifyAllowed && <th scope="col"><input type="checkbox" aria-label="Chọn tất cả thành viên đủ điều kiện gửi trong kết quả lọc"
              disabled={busy || !eligible.length} checked={!!eligible.length && eligible.every(row => picked.includes(row.id))}
              ref={node => { if (node) node.indeterminate = !!selectedRecipients.length && selectedRecipients.length < eligible.length; }}
              onChange={event => setPicked(event.target.checked ? eligible.map(row => row.id) : [])} /></th>}
            <th scope="col">Thành viên / Đơn vị</th><th scope="col">Tổng quan</th><th scope="col">Kết quả theo quy chế</th>
            {notifyAllowed && <th scope="col">Thông báo</th>}
          </tr></thead>
          <tbody>{pageRows.map(row => <tr key={row.id}>
            {notifyAllowed && <td><input type="checkbox" aria-label={'Chọn gửi cho ' + row.name} checked={picked.includes(row.id)}
              disabled={busy || Boolean(sent[row.id]) || row.runs.some(run => run.stale)}
              onChange={event => setPicked(previous => event.target.checked ? [...previous, row.id] : previous.filter(id => id !== row.id))} /></td>}
            <td><strong>{row.name}</strong>{row.unit && <p className="vault-meta">{row.unit}</p>}</td>
            <td><strong>Đạt {row.runs.filter(run => run.conclusion === 'MET').length}/{row.runs.length}</strong><p className="vault-meta">quy chế</p></td>
            <td><div className="org-result-rules">{row.runs.map(run => <details key={run.id}>
              <summary><span>{run.regulation_name}</span><AssessmentBadge run={run} /></summary>
              <ul>{array(run.results).filter(assessmentNeedsReview).map(result => <li key={result.id}>
                {result.criterion?.title || 'Tiêu chí'}{missingText(result.missing_details) && ' · ' + missingText(result.missing_details)}
              </li>)}</ul>
              {!notificationMissingCount(run) && <p className="vault-meta">{conclusionLabel(run.conclusion)}</p>}
            </details>)}</div></td>
            {notifyAllowed && <td>
              {sent[row.id] && <p className="vault-meta">Đã gửi lúc {new Date(sent[row.id]).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>}
              <button type="button" className={secondary} disabled={busy || sending || row.runs.some(run => run.stale)}
                onClick={() => startMessage([row], Boolean(sent[row.id]))}>{sent[row.id] ? 'Gửi lại' : 'Gửi thông báo'}</button>
              {row.runs.some(run => run.stale) && <p className="vault-meta">Cần đối chiếu lại</p>}
            </td>}
          </tr>)}</tbody>
        </table>
      </div> : <p className="vault-meta">Không có thành viên khớp bộ lọc.</p>}
      {maxPage > 1 && <NumberedPagination page={currentPage} totalPages={maxPage} onPageChange={setPage} />}
    </section>}

    <Modal open={Boolean(draft)} title={draft?.resendKey ? 'Gửi lại thông báo' : 'Xem trước thông báo'} onClose={() => { if (!sending) setDraft(null); }}>
      {draft && <form className="space-y-4" onSubmit={send}>
        <p className="vault-meta">Mỗi thành viên nhận một thông báo tổng hợp các quy chế đã xét.</p>
        {draft.recipients.length > 1 && <Field label="Xem trước theo người nhận"><select className={input} value={draft.previewIndex} disabled={sending}
          onChange={event => setDraft({ ...draft, previewIndex: Number(event.target.value) })}>
          {draft.recipients.map((row, index) => <option value={index} key={row.id}>{row.name}</option>)}
        </select></Field>}
        <div className="org-message-preview">
          <strong>{preview?.name}</strong>
          <p>{parentName} thông báo kết quả đối chiếu ngày <DateText value={evaluationDate} />.</p>
          <ul className="list-disc pl-5">{preview?.runs.map(run => <li key={run.id}>{run.regulation_name} — {conclusionLabel(run.conclusion)}{notificationMissingCount(run) > 0 && ' (' + notificationMissingCount(run) + ' tiêu chí cần xem)'}</li>)}</ul>
          {draft.deadline && <p>Hạn bổ sung hồ sơ: <DateText value={draft.deadline} />.</p>}
          {draft.note.trim() && <p className="whitespace-pre-wrap">{draft.note.trim()}</p>}
        </div>
        {draft.errors.map(item => <div key={item.name}><strong>{item.name}</strong><ErrorMessage error={item.error} /></div>)}
        <Field label="Hạn bổ sung (không bắt buộc)"><input className={input} type="date" value={draft.deadline} disabled={sending}
          onChange={event => setDraft({ ...draft, deadline: event.target.value })} /></Field>
        <Field label="Lời nhắn thêm (không bắt buộc)"><textarea className={input} rows={3} maxLength={2000} value={draft.note} disabled={sending}
          onChange={event => setDraft({ ...draft, note: event.target.value })} /></Field>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={secondary} disabled={sending} onClick={() => setDraft(null)}>Hủy</button>
          <button className={button} disabled={sending}>{sending ? 'Đang gửi…' : draft.resendKey ? 'Xác nhận gửi lại' : 'Gửi cho ' + draft.recipients.length + ' thành viên'}</button>
        </div>
      </form>}
    </Modal>
  </>;
}

export function Discovery() {
  const profile = useLoad('/me/profile');
  const organizations = useLoad('/organizations');
  const catalog = useLoad('/achievements/catalogs');
  const { hasRole } = useAuth();
  const orgs = array(organizations.data);
  const canCheckOrganization = !profile.loading && !profile.error && !organizations.loading && !organizations.error
    && orgs.some(org => canAssessOrganization(orgs, profile.data?.orgGrants || [], hasRole('SYSTEM_ADMIN'), org.id));
  const docs = useLoad('/regulations/library');
  const latest = useLoad('/ai/evaluations/structured/latest');
  const [params] = useSearchParams();
  const [scope, setScope] = useState('personal');
  const [date, setDate] = useState(localDay);
  const [selected, setSelected] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [previousRun, setPreviousRun] = useState(null);
  const [freshSummaries, setFreshSummaries] = useState({});
  const [mobileDetail, setMobileDetail] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(null);
  const [createdGoals, setCreatedGoals] = useState({});
  const [creatingGoal, setCreatingGoal] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const selectAll = useRef(null);
  const detailHeading = useRef(null);
  const listHeading = useRef(null);
  const summaries = new Map(array(latest.data).map(run => [String(run.regulation_version_id) + ':' + (run.adoption_id ?? 'owner'), run]));
  for (const [id, fresh] of Object.entries(freshSummaries)) {
    if (Number(fresh.id) > Number(summaries.get(id)?.id || 0)) summaries.set(id, fresh);
  }
  const versions = assessmentContexts(array(docs.data)).filter(([, context]) => effective({ ...context, publication_status: 'PUBLISHED' }, date));
  const selectedItems = versions.filter(([key]) => selected.includes(key));
  const linked = versions.find(([, item]) => String(item.regulation_version_id) === params.get('version')
    && (!params.get('adoption') || String(item.adoption_id) === params.get('adoption')));
  const [key, active] = versions.find(([id]) => id === activeKey) || linked || versions[0] || [];
  const summary = summaries.get(key);
  const runId = (previousRun && previousRun.key === key ? previousRun.id : null) || summary?.id;
  const details = useLoad(active ? '/regulations/versions/' + active.regulation_version_id : null);
  const result = useLoad(runId ? '/ai/evaluations/structured/' + runId : null);
  const history = useLoad(active && historyPage ? '/ai/evaluations/structured/history?' + new URLSearchParams({
    version: active.regulation_version_id,
    ...(active.adoption_id ? { adoption: active.adoption_id } : {}),
    page: historyPage, pageSize: 10,
  }) : null);
  const run = String(result.data?.id) === String(runId) && result.data ? result.data : null;
  const version = String(details.data?.id) === String(active?.regulation_version_id) ? details.data : null;
  const criteria = run ? array(run.results).map(row => ({ criterion: row.criterion, row })) : array(version?.criteria).map(criterion => ({ criterion }));
  const personalVisible = !canCheckOrganization || scope === 'personal';

  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selectedItems.length > 0 && selectedItems.length < versions.length;
  }, [selectedItems.length, versions.length, personalVisible]);

  function setDay(value) {
    const nextDay = value || localDay();
    const remaining = selectedItems.filter(([, item]) => effective({ ...item, publication_status: 'PUBLISHED' }, nextDay));
    setSelected(remaining.map(([id]) => id));
    setNotice(remaining.length < selectedItems.length ? 'Đã bỏ chọn các quy chế ngoài thời gian hiệu lực.' : '');
    setDate(nextDay);
    setPreviousRun(null);
    setBatch(null);
  }

  function inspect(id) {
    setActiveKey(id);
    setPreviousRun(null);
    setMobileDetail(true);
    setError(null);
    requestAnimationFrame(() => detailHeading.current?.focus({ preventScroll: !window.matchMedia('(max-width: 767px)').matches }));
  }

  async function evaluate(items, previous = 0) {
    if (busy || !items.length) return;
    setBusy(true);
    setError(null);
    setNotice('');
    const failures = [];
    const total = previous + items.length;
    let completed = previous;
    let firstSuccess;
    setBatch({ completed, total, failures: [] });
    try {
      for (const [id, item] of items) {
        try {
          const completedRun = await api('/ai/evaluations/structured', 'POST', {
            regulation_version_id: Number(item.regulation_version_id), evaluation_date: date,
            ...(item.adoption_id ? { adoption_id: Number(item.adoption_id) } : {}),
          });
          setFreshSummaries(previous => ({ ...previous, [id]: {
            ...completedRun, history_count: Number(summaries.get(id)?.history_count || 0) + 1,
            criterion_count: array(completedRun.results).length, met_count: array(completedRun.results).filter(row => row.conclusion === 'MET').length,
          } }));
          firstSuccess ??= id;
          completed++;
          setBatch({ completed, total, failures: [...failures] });
        } catch (err) {
          failures.push({ item: [id, item], error: err });
        }
      }
      if (firstSuccess) {
        await latest.reload();
        inspect(firstSuccess);
      }
    } finally {
      setBatch({ completed, total, failures });
      setBusy(false);
    }
  }

  async function download(url, name, data) {
    setError(null);
    setDownloading(name);
    try { await saveBlob(url, name, data ? 'POST' : 'GET', data); }
    catch (err) { setError(err); }
    finally { setDownloading(null); }
  }

  async function createGoal(row) {
    setCreatingGoal(row.id);
    setError(null);
    try {
      const goal = await api('/kpi/from-ai-gap', 'POST', { source_result_id: row.id });
      setCreatedGoals(previous => ({ ...previous, [row.id]: goal?.id || true }));
    } catch (err) { setError(err); }
    finally { setCreatingGoal(null); }
  }

  return <Page title="Đối chiếu quy chế" description="Xem tiêu chí và kiểm tra hồ sơ theo ngày đối chiếu."
    actions={<>
      {personalVisible && <Field label="Ngày đối chiếu"><input className={input} type="date" value={date} disabled={busy} onChange={event => setDay(event.target.value)} /></Field>}
      <Link className={secondary} to="/regulations">Tra cứu kho quy chế</Link>
    </>}>
    {canCheckOrganization && <VaultTabs value={scope} onChange={setScope} items={[['personal', 'Cá nhân'], ['organization', 'Tổ chức']]} />}
    {!personalVisible && <OrganizationAssessment />}
    {personalVisible && <>
      {latest.error && <div className="mb-3 flex flex-wrap items-center gap-2"><ErrorMessage error={latest.error} /><button type="button" className={secondary} onClick={latest.reload}>Tải lại kết quả</button></div>}
      <div className="assessment-workspace" data-mobile-detail={mobileDetail && !!active}>
        <section className={panel + ' assessment-sidebar'}>
          <h2 className="text-lg font-bold" ref={listHeading} tabIndex={-1}>Quy chế đang áp dụng</h2>
          <Load state={docs}>
            {versions.length ? <>
              <div className="assessment-toolbar">
                <label className="flex min-h-11 cursor-pointer items-center gap-2">
                  <input ref={selectAll} type="checkbox" className="accent-teal-700" disabled={busy} checked={selectedItems.length === versions.length}
                    onChange={event => setSelected(event.target.checked ? versions.map(([id]) => id) : [])} />
                  Chọn tất cả ({versions.length})
                </label>
                <button type="button" className={button} disabled={busy || !selectedItems.length} onClick={() => evaluate(selectedItems)}>
                  {busy ? 'Đang đối chiếu…' : selectedItems.length ? 'Đối chiếu (' + selectedItems.length + ')' : 'Đối chiếu'}
                </button>
              </div>
              <ul className="assessment-list">
                {versions.map(([id, item]) => {
                  const last = summaries.get(id);
                  const scopeLabel = item.context_type === 'ORGANIZATION'
                    ? orgs.find(org => String(org.id) === String(item.organization_id))?.name || 'Tổ chức #' + item.organization_id
                    : item.context_type === 'OWNER' ? 'Do tôi tạo' : 'Kho cá nhân';
                  return <li key={id} className="assessment-row" data-active={id === key}>
                    <label className="assessment-check" title={'Chọn để đối chiếu: ' + item.name}>
                      <input type="checkbox" className="accent-teal-700" aria-label={'Chọn ' + item.name + ' · ' + scopeLabel}
                        checked={selected.includes(id)} disabled={busy}
                        onChange={event => setSelected(event.target.checked ? [...selected, id] : selected.filter(value => value !== id))} />
                    </label>
                    <button type="button" className="assessment-open" aria-current={id === key ? 'true' : undefined} onClick={() => inspect(id)}>
                      <strong className="block break-words">{item.name}</strong>
                      {id === key && <span className="assessment-view-label">Đang xem</span>}
                      <span className="vault-meta block">{item.code} · {item.version_label} · {scopeLabel}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        {last ? <><AssessmentBadge run={last} /><span className="vault-meta">{last.met_count}/{last.criterion_count} đạt · Xét <DateText value={last.evaluation_date} /></span></>
                          : <span className="vault-meta">{latest.loading ? 'Đang tải kết quả…' : latest.error ? 'Chưa tải được kết quả' : 'Chưa đối chiếu'}</span>}
                      </span>
                    </button>
                  </li>;
                })}
              </ul>
            </> : <Empty action={<Link className={secondary} to="/regulations">Xem kho quy chế</Link>}>Chưa có quy chế nào có hiệu lực vào ngày này.</Empty>}
          </Load>
          {notice && <p role="status" className="vault-meta mt-3">{notice}</p>}
          {batch && <div className="mt-3 space-y-2" aria-live="polite">
            <p className="vault-meta">Hoàn tất {batch.completed}/{batch.total} quy chế</p>
            {!busy && batch.failures.map(({ item: [id, item], error: failure }) => <div key={id}><strong>{item.name}</strong><ErrorMessage error={failure} /></div>)}
            {!busy && batch.failures.length > 0 && <button type="button" className={secondary} onClick={() => evaluate(batch.failures.map(entry => entry.item), batch.completed)}>Thử lại mục lỗi</button>}
          </div>}
        </section>
        <section className={panel + ' assessment-detail'} aria-labelledby="assessment-detail-heading">
          <button type="button" className={secondary + ' assessment-back mb-3'} onClick={() => {
            setMobileDetail(false);
            requestAnimationFrame(() => listHeading.current?.focus());
          }}>Về danh sách quy chế</button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="assessment-detail-heading" className="min-w-0 break-words text-lg font-bold" ref={detailHeading} tabIndex={-1}>{active?.name || 'Chi tiết đối chiếu'}</h2>
            {summary && <button type="button" className={secondary} onClick={() => setHistoryPage(1)}>Lịch sử chạy ({summary.history_count})</button>}
          </div>
          <ErrorMessage error={error} />
          {!active ? <p className="vault-meta mt-3">Tiêu chí và kết quả sẽ hiện ở đây khi có quy chế để xem.</p> :
            <Load state={runId ? result : details}>
              {runId && !run || !runId && !version ? <p role="status" className="vault-meta mt-3">Đang tải chi tiết…</p> : <>
              {run && <div className="assessment-run-header">
                <AssessmentBadge run={run} />
                <p className="vault-meta">Ngày xét <DateText value={run.evaluation_date} />{run.completed_at && ' · Chạy lúc ' + new Date(run.completed_at).toLocaleString('vi-VN')}</p>
                {(String(run.evaluation_date).slice(0, 10) !== date || run.stale || previousRun?.key === key) && <p className="vault-meta">
                  {run.stale ? 'Hồ sơ đã thay đổi. Hãy chạy lại để cập nhật kết quả.' : 'Đang hiển thị kết quả lần trước.'}
                  {previousRun?.key === key && <button type="button" className="ml-2 text-teal-700 underline dark:text-teal-300" onClick={() => setPreviousRun(null)}>Về kết quả mới nhất</button>}
                </p>}
                <button type="button" className={secondary} disabled={downloading !== null}
                  onClick={() => download('/ai/export-dossier-zip', 'minh-chung.zip', { runId: run.id })}><FileArchive size={16} /> Tải minh chứng (ZIP)</button>
              </div>}
              <h3 className="mt-4 font-semibold">{run ? 'Kết quả từng tiêu chí' : 'Tiêu chí cần đạt'} ({run ? criteria.filter(({ row }) => row.conclusion === 'MET').length + '/' : ''}{criteria.length}{run ? ' đạt' : ''})</h3>
              {!criteria.length && <p className="vault-meta mt-2">Phiên bản này chưa có tiêu chí.</p>}
              <ul className="assessment-criteria">
                {criteria.map(({ criterion, row }, index) => {
                  const missing = row && ['NOT_MET', 'INSUFFICIENT_DATA'].includes(row.conclusion);
                  const needsLess = row && ['lte', 'eq'].includes(row.missing_details?.comparator)
                    && row.target_value != null && Number(row.actual_value) > Number(row.target_value);
                  const manualReview = row?.conclusion === 'INSUFFICIENT_DATA' && criterion?.coverage_status === 'MANUAL';
                  const canAdd = missing && !criterion?.is_exclusion && !needsLess;
                  const type = criterion?.rule?.filters?.find(filter => filter.field === 'achievement_type_id' && filter.operator === 'eq');
                  const addParams = new URLSearchParams({ add: '1', criterion: criterion?.title || '', ...(type ? { type: type.value } : {}) });
                  return <li key={row?.id || criterion?.id || index}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <strong>{criterion?.title || 'Tiêu chí'}</strong>
                      {manualReview ? <span className="vault-status assessment-warning">Cần hội đồng rà soát</span> : row && <AssessmentBadge run={row} />}
                    </div>
                    <div className="vault-meta mt-1"><RegulationRuleDescription rule={criterion?.rule || criterion?.rule_json} catalog={catalog.data?.achievementTypes} coverageStatus={criterion?.coverage_status} /></div>
                    {row?.actual_value != null && <p className="vault-meta">Hồ sơ ghi nhận: {row.actual_value} {row.measure_unit}</p>}
                    {criterion?.source_reference && <p className="vault-meta">Căn cứ: {criterion.source_reference}</p>}
                    {row && missingText(row.missing_details) && <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{missingText(row.missing_details)}</p>}
                    {!!row?.evidence_files?.length && <ul className="mt-2">{row.evidence_files.map(file => <li key={file.id}>
                      <button type="button" className="min-h-11 break-all text-left text-sm text-teal-800 underline dark:text-teal-300" disabled={downloading !== null}
                        onClick={() => download('/evidence-files/' + file.id + '/download', file.original_filename)}>{file.original_filename}</button>
                    </li>)}</ul>}
                    {missing && !manualReview && <div className="mt-2 flex flex-wrap gap-2">
                      {canAdd && <Link className={secondary} to={'/achievements?' + addParams}><Plus size={15} /> Bổ sung thành tích</Link>}
                      {(row.conclusion === 'INSUFFICIENT_DATA' || needsLess || criterion?.is_exclusion) && <Link className={secondary} to="/achievements">Kiểm tra dữ liệu đã nhập</Link>}
                      {!run.stale && row.conclusion === 'NOT_MET' && row.missing_details?.comparator === 'gte' && Number(row.missing_details?.remaining) > 0 && !criterion?.is_exclusion &&
                        (createdGoals[row.id] ? <Link className={secondary} to={createdGoals[row.id] === true ? '/kpi' : '/kpi?goal=' + createdGoals[row.id]}>Xem mục tiêu</Link>
                          : <button type="button" className={secondary} disabled={creatingGoal !== null} onClick={() => createGoal(row)}>{creatingGoal === row.id ? 'Đang tạo…' : 'Tạo mục tiêu'}</button>)}
                    </div>}
                  </li>;
                })}
              </ul>
              </>}
            </Load>}
        </section>
      </div>
      <Modal open={historyPage > 0} title="Lịch sử đối chiếu" subtitle={active?.name} onClose={() => setHistoryPage(0)}>
        <Load state={history}>
          <ul className="space-y-2">{array(history.data).map(entry => <li key={entry.id}>
            <button type="button" className={secondary + ' w-full flex-wrap !justify-between'} onClick={() => {
              setPreviousRun({ key, id: entry.id }); setHistoryPage(0);
            }}><span>Xét <DateText value={entry.evaluation_date} />{entry.completed_at && ' · ' + new Date(entry.completed_at).toLocaleString('vi-VN')}</span><AssessmentBadge run={entry} /></button>
          </li>)}</ul>
          {!array(history.data).length && <Empty>Chưa có lượt đối chiếu.</Empty>}
          {Number(summary?.history_count) > 10 && <NumberedPagination page={historyPage} totalPages={Math.ceil(Number(summary.history_count) / 10)} onPageChange={setHistoryPage} />}
        </Load>
      </Modal>
    </>}
  </Page>;
}

function AssessmentBadge({ run }) {
  return <span className={'vault-status ' + (run.conclusion === 'MET' ? 'is-positive' : run.conclusion === 'NOT_MET' ? 'is-muted' : run.conclusion === 'INSUFFICIENT_DATA' ? 'assessment-warning' : '')}>
    {conclusionLabel(run.conclusion)}{run.completion_percent != null ? ' · ' + run.completion_percent + '%' : ''}
  </span>;
}
