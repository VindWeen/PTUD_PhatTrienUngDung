import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { detailLabels, numericDetails, basicDetailKeys, primaryLabels, displayAchievementTitle, dynamicAchievementFields, suggestedAchievementFields, formatAchievementValue } from './achievementFields';
import Modal from '../components/common/VaultDialog';
import VaultTabs from '../components/common/VaultTabs';
import NumberedPagination from '../components/common/NumberedPagination';
import { Plus, Paperclip, Eye, Pencil, Trash2, BarChart3, Sparkles, UploadCloud, FileDown, RotateCcw } from 'lucide-react';
import { api, array, saveBlob } from '../services/vaultApi';
import { useCollection } from '../hooks/useCollection';
import { useLoad } from '../hooks/useLoad';
import { Page } from '../components/common/VaultPage';
import { ErrorMessage, Field, Empty, Load, DateText } from '../components/common/VaultPrimitives';
import { input, button, secondary, panel } from '../components/common/vaultStyles';

/* =====================================================================
   Trang Kho thành tích (Achievements Hub - Pagination, Icons, Attribute Form)
   ===================================================================== */
function AchievementDrop({ label, onFile, disabled, prominent }) {
  return <label className={'achievement-drop' + (prominent ? ' is-prominent' : '')} aria-disabled={disabled}
    onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault();
      if (!disabled) onFile(event.dataTransfer.files[0]);
    }}>
    <input type="file" className="sr-only" accept=".pdf,.docx,.jpg,.jpeg,.png" disabled={disabled} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) onFile(file);
    }} />
    {prominent ? <Sparkles size={18} aria-hidden="true" /> : <UploadCloud size={18} aria-hidden="true" />}
    <span><strong>{label}</strong><span className="vault-meta block">PDF, DOCX, JPG, PNG</span></span>
  </label>;
}

export function Achievements() {
  const [tab, setTab] = useState('all');
  const [extraFilters, setExtraFilters] = useState(false);
  const [showForm, setShowForm] = useState(() => new URLSearchParams(window.location.search).get('add') === '1');
  const [typeFilter, setTypeFilter] = useState('');
  const [year, setYear] = useState('');
  const [issuer, setIssuer] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [searchParams, setSearchParams] = useSearchParams();
  const [addContext, setAddContext] = useState(() => searchParams.get('add') === '1' ? searchParams.get('criterion') : null);
  const [achievementDetail, setAchievementDetail] = useState(null);
  const search = searchParams.get('search') || '';
  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    const next = new URLSearchParams(searchParams);
    ['add', 'criterion', 'type'].forEach(name => next.delete(name));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const state = useCollection('/achievements');
  const trash = useCollection('/achievements?trash=true');
  const catalogs = useLoad('/achievements/catalogs');

  const emptyForm = { title: '', achievedAt: '', description: '', issuer: '', achievementTypeId: '', levelCode: '' };
  const [form, setForm] = useState(() => ({ ...emptyForm, achievementTypeId: searchParams.get('add') === '1' && /^\d+$/.test(searchParams.get('type') || '') ? searchParams.get('type') : '' }));
  const [error, setError] = useState(null);
  const [drawerError, setDrawerError] = useState(null);
  const [busyFile, setBusyFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadRetry, setUploadRetry] = useState(null);
  const [archiveNotice, setArchiveNotice] = useState(null);
  const [attributes, setAttributes] = useState({});
  const [newDetail, setNewDetail] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const [proposal, setProposal] = useState([]);
  const [assisted, setAssisted] = useState([]);
  const [preview, setPreview] = useState(null);
  const [removeFile, setRemoveFile] = useState(null);
  const [jump, setJump] = useState(0);
  const evidenceSection = useRef(null);
  const previewSection = useRef(null);
  const editing = showForm ? achievementDetail?.id : null;
  const evidence = useLoad(achievementDetail && !achievementDetail.deletedAt && tab !== 'trash' ? '/achievements/' + achievementDetail.id + '/evidences' : null);
  const types = catalogs.data?.achievementTypes || [];
  const type = types.find(item => String(item.id) === String(form.achievementTypeId));
  const recognitionFields = type?.attributeSchema?.properties || {};
  const dynamicFields = [...dynamicAchievementFields(type), ...['recognition_scope', 'has_recognition_doc'].filter(key => recognitionFields[key])];
  const blocked = saving || busyFile || extracting;
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => { if (preview) previewSection.current?.focus(); }, [preview]);
  useEffect(() => {
    if (!jump || !achievementDetail) return;
    const frame = requestAnimationFrame(() => evidenceSection.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [jump, achievementDetail]);

  function initForm(item) {
    setForm(item ? {
      title: item.title || '', achievedAt: item.achievedAt?.slice(0, 10) || '',
      description: item.description || '', issuer: item.issuer || '',
      achievementTypeId: item.achievementTypeId || '', levelCode: item.levelCode || '',
    } : emptyForm);
    setAttributes(item?.attributes || {});
    setNewDetail(''); setAttachedFile(null); setExtraction(null); setProposal([]); setAssisted([]);
    setPreview(null); setRemoveFile(null); setDrawerError(null);
  }

  function closeDrawer() {
    if (blocked) return;
    setAchievementDetail(null); setShowForm(false); setPreview(null); setRemoveFile(null);
  }

  function view(item, focusEvidence = false) {
    setAchievementDetail(item); setShowForm(false); setDrawerError(null); setPreview(null); setRemoveFile(null);
    if (focusEvidence) setJump(value => value + 1);
    else setJump(0);
  }

  function begin(item) {
    setAddContext(null);
    setAchievementDetail(item || null); setJump(0); initForm(item); setShowForm(true);
  }

  const edit = (key, value) => {
    setForm(current => ({ ...current, [key]: value }));
    setAssisted(current => current.filter(item => item !== key));
  };

  function editDetail(key, value) {
    setAttributes(current => {
      const next = { ...current };
      next[key] = value;
      return next;
    });
    setAssisted(current => current.filter(item => item !== key));
  }

  function addDetail(name) {
    const key = name.trim();
    if (!key || [...basicDetailKeys, ...dynamicFields, '__proto__', 'constructor', 'prototype'].includes(key) || Object.hasOwn(attributes, key)) {
      setDrawerError(new Error('Tên thông tin đã có hoặc không hợp lệ.')); return;
    }
    setDrawerError(null);
    setAttributes(current => ({ ...current, [key]: '' }));
    setNewDetail('');
  }

  function applySuggestions(changes) {
    setForm(current => ({ ...current, ...Object.fromEntries(changes.filter(change => !change.detail).map(change => [change.key, change.next])) }));
    setAttributes(current => ({ ...current, ...Object.fromEntries(changes.filter(change => change.detail).map(change => [change.key, change.next])) }));
    setAssisted(current => [...new Set([...current, ...changes.map(change => change.key)])]);
  }

  async function extract(file, review) {
    if (!file) return;
    setExtracting(true); setDrawerError(null); setProposal([]); setExtraction({ fileName: file.name });
    try {
      const payload = new FormData(); payload.append('file', file);
      const response = await api('/achievements/ai-extract', 'POST', payload);
      if (!response.data) { setExtraction({ fileName: file.name, message: 'Chưa trích xuất được. Bạn có thể nhập thủ công.' }); return; }
      const suggested = suggestedAchievementFields(response.data, types);
      const entries = (values, existing, detail) => Object.entries(values)
        .filter(([key, value]) => String(existing[key] ?? '') !== String(value))
        .map(([key, next]) => ({ key, next, detail }));
      const changes = [...entries(suggested.fields, form, false), ...entries(suggested.details, attributes, true)];
      const fill = review ? [] : changes.filter(change => (change.detail ? attributes : form)[change.key] == null || (change.detail ? attributes : form)[change.key] === '');
      if (fill.length) applySuggestions(fill);
      setProposal(changes.filter(change => !fill.includes(change)));
      setExtraction({ fileName: file.name, count: changes.length, filled: fill.length });
    } catch (err) {
      setExtraction({ fileName: file.name, message: 'Không đọc được tài liệu. Bạn có thể thử lại hoặc nhập thủ công.' });
      setDrawerError(err);
    } finally { setExtracting(false); }
  }

  function attach(file) {
    if (!file || blocked) return;
    setAttachedFile(file); setPreview(null); extract(file, Boolean(editing));
  }

  async function readEvidence(file) {
    return api('/evidence-files/' + file.id + '/download', 'GET', undefined, { responseType: 'blob' });
  }

  async function extractEvidence(file) {
    setBusyFile(true); setDrawerError(null);
    try {
      const blob = await readEvidence(file);
      await extract(new File([blob], file.originalFileName, { type: blob.type }), true);
    } catch (err) { setDrawerError(err); }
    finally { setBusyFile(false); }
  }

  async function showPreview(file, stored = true) {
    setBusyFile(true); setDrawerError(null);
    try {
      const blob = stored ? await readEvidence(file) : file;
      const name = stored ? file.originalFileName : file.name;
      const pdf = blob.type === 'application/pdf' || /\.pdf$/i.test(name);
      const image = /\.(jpe?g|png)$/i.test(name);
      setPreview({ name, pdf, image, url: pdf || image ? URL.createObjectURL(pdf ? new Blob([blob], { type: 'application/pdf' }) : blob) : null });
    } catch (err) { setDrawerError(err); }
    finally { setBusyFile(false); }
  }

  async function download(file) {
    try { await saveBlob('/evidence-files/' + file.id + '/download', file.originalFileName); }
    catch (err) { setDrawerError(err); }
  }

  async function uploadEvidence(file, id) {
    const data = new FormData(); data.append('file', file);
    await api('/achievements/' + id + '/evidences', 'POST', data);
  }

  async function upload(file) {
    if (!file || !achievementDetail || blocked) return;
    const id = achievementDetail.id;
    setBusyFile(true); setDrawerError(null);
    try {
      await uploadEvidence(file, id);
      setUploadRetry(null);
      await Promise.all([evidence.reload(), state.reload()]);
    } catch (err) { setUploadRetry({ id, file }); setDrawerError(err); }
    finally { setBusyFile(false); }
  }

  async function save(event) {
    event.preventDefault();
    if (blocked || proposal.length) return;
    setSaving(true); setDrawerError(null);
    try {
      const result = await api(editing ? '/achievements/' + editing : '/achievements', editing ? 'PATCH' : 'POST', {
        ...form,
        achievementTypeId: form.achievementTypeId ? Number(form.achievementTypeId) : null,
        attributes: Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== '')),
      });
      const id = editing || result?.id;
      const file = attachedFile;
      setAttachedFile(null); setExtraction(null); setPreview(null);
      if (file && id) {
        try { await uploadEvidence(file, id); if (editing) await evidence.reload(); }
        catch (err) { setUploadRetry({ id, file }); setDrawerError(err); }
      }
      setAchievementDetail(result?.id ? result : { ...achievementDetail, ...form, id, attributes, typeName: type?.name });
      setShowForm(false);
      await state.reload();
    } catch (err) { setDrawerError(err); }
    finally { setSaving(false); }
  }

  async function remove(id, title) {
    try {
      await api('/achievements/' + id, 'DELETE');
      await Promise.all([state.reload(), trash.reload()]);
      setArchiveNotice({ id, title });
    } catch (err) { setError(err); }
  }

  const source = tab === 'trash' ? trash : state;
  const filteredRows = array(source.data).filter(item =>
    (!search || `${item.title} ${item.description}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) &&
    (!typeFilter || String(item.achievementTypeId) === typeFilter) &&
    (!year || String(item.achievedAt).startsWith(year)) &&
    (!issuer || item.issuer === issuer)
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const aiLabel = (key, label) => <>{label}{assisted.includes(key) && <span className="achievement-ai-chip">AI điền</span>}</>;
  const detailField = key => {
    const value = attributes[key];
    const definition = recognitionFields[key];
    const label = definition?.title || detailLabels[key] || key;
    if (definition?.enum || definition?.type === 'boolean') {
      const options = definition.enum || [true, false];
      return <Field label={label}><select className={input} value={String(value ?? '')} onChange={event => editDetail(key, options.find(option => String(option) === event.target.value) ?? '')}>
        <option value="">Chưa xác định</option>
        {options.map((option, index) => <option key={String(option)} value={String(option)}>{definition.enumNames?.[index] || formatAchievementValue(option)}</option>)}
      </select></Field>;
    }
    if (value && typeof value === 'object') return <div><strong>{label}</strong><p className="vault-meta">{formatAchievementValue(value)}</p></div>;
    if (typeof value === 'boolean') return <Field label={aiLabel(key, label)}><select className={input} value={String(value)} onChange={event => editDetail(key, event.target.value === 'true')}><option value="true">Có</option><option value="false">Không</option></select></Field>;
    const numeric = numericDetails.has(key) || typeof value === 'number';
    return <Field label={aiLabel(key, label)}><input className={input} type={numeric ? 'number' : 'text'}
      placeholder={key === 'role' && dynamicFields.includes('contribution_percent') ? 'Ví dụ: Tác giả chính, đồng tác giả' : undefined}
      min={numericDetails.has(key) ? 0 : undefined} max={key === 'contribution_percent' ? 100 : undefined} step={numeric ? 'any' : undefined}
      value={value ?? ''} onChange={event => editDetail(key, numeric && event.target.value !== '' ? Number(event.target.value) : event.target.value)} /></Field>;
  };
  const evidenceArea = achievementDetail && tab !== 'trash' && <section className="achievement-section" aria-labelledby="achievement-evidence-heading">
    <h3 ref={evidenceSection} tabIndex={-1} className="font-semibold" id="achievement-evidence-heading">Minh chứng</h3>
    <Load state={evidence}>
      {array(evidence.data).length ? <ul className="achievement-files">
        {array(evidence.data).map(file => <li key={file.id}>
          <button type="button" className="achievement-file-name" disabled={blocked} onClick={() => showPreview(file)}>{file.originalFileName}</button>
          <div className="flex flex-wrap gap-2">
            {showForm && <button type="button" className={secondary} disabled={blocked} onClick={() => extractEvidence(file)}><Sparkles size={14} /> Trích xuất lại</button>}
            <button type="button" className={secondary + ' !px-3'} disabled={blocked} aria-label={'Tải ' + file.originalFileName} title="Tải xuống" onClick={() => download(file)}><FileDown size={16} /></button>
            <button type="button" className="soft-btn-danger !px-3" disabled={blocked} aria-label={'Xóa ' + file.originalFileName} title="Xóa tệp" onClick={() => setRemoveFile(file)}><Trash2 size={16} /></button>
          </div>
        </li>)}
      </ul> : <p className="vault-meta">Chưa có tệp minh chứng.</p>}
    </Load>
    {removeFile && <div className="achievement-inline-review">
      <p>Xóa minh chứng <strong>{removeFile.originalFileName}</strong>?</p>
      <div className="mt-2 flex gap-2">
        <button type="button" className={secondary} disabled={blocked} onClick={() => setRemoveFile(null)}>Giữ tệp</button>
        <button type="button" className="soft-btn-danger" disabled={blocked} onClick={async () => {
          setBusyFile(true); setDrawerError(null);
          try {
            await api('/evidences/' + removeFile.id, 'DELETE');
            setRemoveFile(null); setPreview(null);
            await Promise.all([evidence.reload(), state.reload()]);
          } catch (err) { setDrawerError(err); }
          finally { setBusyFile(false); }
        }}>Xóa minh chứng</button>
      </div>
    </div>}
    <AchievementDrop label="Kéo thả hoặc chọn tệp minh chứng" disabled={blocked} onFile={upload} />
    {uploadRetry?.id === achievementDetail.id && <button type="button" className={secondary} disabled={blocked} onClick={() => upload(uploadRetry.file)}>Thử tải lại {uploadRetry.file.name}</button>}
  </section>;
  const proposedLabel = change => (change.detail ? detailLabels[change.key] : primaryLabels[change.key]) || change.key;
  const proposedValue = (change, value) => change.key === 'achievementTypeId'
    ? types.find(item => String(item.id) === String(value))?.name || formatAchievementValue(value)
    : formatAchievementValue(value);
  const customKeys = Object.keys(attributes).filter(key => !basicDetailKeys.includes(key) && !dynamicFields.includes(key));

  const pageActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to="/reports"
        className="inline-flex min-h-11 items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-teal-600/40 text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 hover:border-teal-600 shadow-sm transition-all"
        title="Xem thống kê phân bố thành tích theo năm và loại"
      >
        <BarChart3 size={16} className="text-teal-600 dark:text-teal-400" />
        <span>Thống kê & Báo cáo</span>
      </Link>
      <button type="button" className={button + ' min-h-11'} onClick={() => begin()}>
        <Plus size={16} aria-hidden="true" />
        <span>Thêm thành tích</span>
      </button>
    </div>
  );

  return (
    <Page title="Kho thành tích" description="Lưu những dấu mốc và minh chứng của bạn để khám hồ sơ hoặc tạo CV." actions={pageActions}>
      <ErrorMessage error={error} />
      {archiveNotice && <div className="vault-summary mb-4">
        <p role="status">Đã chuyển {archiveNotice.title || 'thành tích'} vào thùng rác.</p>
        <button type="button" className={secondary} onClick={async () => {
          try {
            await api('/achievements/' + archiveNotice.id + '/restore', 'POST', {});
            setArchiveNotice(null);
            await Promise.all([state.reload(), trash.reload()]);
          } catch (err) { setError(err); }
        }}>Hoàn tác</button>
      </div>}
      <section className={panel}>
        <div className="vault-list-heading flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <VaultTabs
            items={[
              ["all", `Tất cả thành tích (${state.data?.total ?? 0})`],
              ["trash", `Thùng rác (${trash.data?.total ?? 0})`]
            ]}
            value={tab}
            onChange={t => { setTab(t); setPage(1); }}
          />
        </div>

        {/* Toolbar bộ lọc */}
        <div className="vault-toolbar mt-4">
          <Field label="Tìm thành tích">
            <input
              type="search"
              className={input}
              placeholder="Nhập tên thành tích..."
              value={search}
              onChange={e => { setSearchParams(e.target.value ? { search: e.target.value } : {}); setPage(1); }}
            />
          </Field>
          <Field label="Loại thành tích">
            <select className={input} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">Tất cả loại</option>
              {(catalogs.data?.achievementTypes || []).map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </Field>
          <button type="button" className={secondary + ' sm:hidden'} aria-expanded={extraFilters} aria-controls="achievement-extra-filters" onClick={() => setExtraFilters(value => !value)}>Bộ lọc năm và đơn vị</button>
          <div id="achievement-extra-filters" className={extraFilters ? 'grid gap-3 sm:contents' : 'hidden sm:contents'}>
          <Field label="Năm đạt được">
            <select className={input} value={year} onChange={e => { setYear(e.target.value); setPage(1); }}>
              <option value="">Tất cả năm</option>
              {[...new Set(array(source.data).map(item => String(item.achievedAt).slice(0, 4)))].sort().reverse().map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Đơn vị cấp">
            <select className={input} value={issuer} onChange={e => { setIssuer(e.target.value); setPage(1); }}>
              <option value="">Tất cả đơn vị</option>
              {[...new Set(array(source.data).map(item => item.issuer).filter(Boolean))].sort().map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          </div>
        </div>
        {!source.loading && !source.error && <div className="vault-summary mb-4" aria-live="polite">
          <span>{filteredRows.length} kết quả</span>
          {(search || typeFilter || year || issuer) && <button type="button" className={secondary} onClick={() => {
            setSearchParams({}); setTypeFilter(''); setYear(''); setIssuer(''); setPage(1);
          }}>Xóa bộ lọc</button>}
        </div>}

        <Load state={source}>
          {!filteredRows.length ? (
            <Empty action={tab === 'all' && !array(state.data).length ? (
              <button className={button} onClick={() => begin()}><Plus size={16} /> Thêm thành tích đầu tiên</button>
            ) : (
              <button className={secondary} onClick={() => { setSearchParams({}); setTypeFilter(''); setYear(''); setIssuer(''); setPage(1); }}>
                Xóa bộ lọc
              </button>
            )}>
              {tab === 'trash' ? 'Không có thành tích trong thùng rác.' : array(state.data).length ? 'Không tìm thấy thành tích phù hợp.' : 'Chưa có thành tích nào. Hãy thêm dấu mốc đầu tiên của bạn.'}
            </Empty>
          ) : (
            <>
              <div className="vault-table-wrap mt-2">
                <table className="vault-table achievement-table">
                  <caption className="sr-only">{tab === 'trash' ? 'Thành tích trong thùng rác' : 'Thành tích của bạn'}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tên thành tích</th>
                      <th scope="col">Loại</th>
                      <th scope="col">Thông tin bổ sung</th>
                      <th scope="col">Minh chứng</th>
                      <th scope="col" className="text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td>
                          <button type="button" className="min-h-11 text-left font-semibold text-teal-800 hover:underline dark:text-teal-300" onClick={() => view(item)}>{displayAchievementTitle(item.title)}</button>
                          <p className="vault-meta"><DateText value={item.achievedAt} />{item.issuer && <> · {item.issuer}</>}{/^\s*\[DEMO\]/i.test(item.title) && <> · Dữ liệu mẫu</>}</p>
                        </td>
                        <td>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {item.typeName || 'Chưa phân loại'}
                          </span>
                        </td>
                        <td className="vault-meta">{Object.entries(item.attributes || {}).filter(([, value]) => ['string', 'number'].includes(typeof value) && value !== '').slice(0, 2).map(([key, value]) => (detailLabels[key] || key) + ': ' + value).join(' · ') || '—'}</td>
                        <td>
                          <button type="button" className={'achievement-evidence-badge' + (item.evidenceCount ? '' : ' is-empty')}
                            aria-label={'Xem ' + (item.evidenceCount || 0) + ' minh chứng của ' + displayAchievementTitle(item.title)} onClick={() => view(item, true)}>
                            <Paperclip size={14} aria-hidden="true" /> {item.evidenceCount || 0}
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1.5">
                            {tab === 'trash' ? (
                              <button
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 inline-flex items-center gap-1"
                                onClick={async () => {
                                  try {
                                    await api(`/achievements/${item.id}/restore`, 'POST');
                                    await state.reload();
                                    await trash.reload();
                                  } catch(err) {
                                    setError(err);
                                  }
                                }}
                              >
                                <RotateCcw size={13} /> Khôi phục
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  title="Chỉnh sửa thông tin thành tích"
                                  aria-label="Sửa thành tích"
                                  className={secondary + ' !px-3'}
                                  onClick={() => begin(item)}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  title="Chuyển vào thùng rác"
                                  aria-label="Xóa thành tích"
                                  className="soft-btn-danger !px-3"
                                  onClick={() => remove(item.id, item.title)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Numbered Pagination < << 1 2 3 ... >> > */}
              <NumberedPagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </Load>
      </section>

      <Modal drawer open={showForm || !!achievementDetail} onClose={closeDrawer}
        title={showForm ? (editing ? 'Sửa thành tích' : 'Thêm thành tích mới') : displayAchievementTitle(achievementDetail?.title)}>
        <ErrorMessage error={drawerError} />
        {showForm ? <form onSubmit={save} className="space-y-4">
          {addContext && !editing && <p className="vault-meta">Bổ sung cho tiêu chí: <strong>{addContext}</strong></p>}
          {editing && evidenceArea}
          <section className="achievement-section">
            <h3 className="font-semibold">Nhập nhanh từ minh chứng</h3>
            {!attachedFile ? <AchievementDrop prominent label="Kéo thả hoặc chọn tài liệu để AI đọc" disabled={blocked} onFile={attach} /> :
              <div className="achievement-inline-review">
                <p className="break-all font-semibold">{attachedFile.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={secondary} disabled={blocked} onClick={() => extract(attachedFile, true)}><RotateCcw size={14} /> Quét lại</button>
                  <button type="button" className={secondary} disabled={blocked} onClick={() => showPreview(attachedFile, false)}><Eye size={14} /> Xem tệp</button>
                  <button type="button" className="soft-btn-danger" disabled={blocked} onClick={() => {
                    setAttachedFile(null); setExtraction(null); setProposal([]); setPreview(null);
                  }}>Bỏ tệp</button>
                </div>
                <p className="vault-meta mt-2">Tệp sẽ được đính kèm khi lưu thành tích.</p>
              </div>}
            {extracting && <p role="status" className="vault-meta">AI đang đọc tài liệu và tìm thông tin…</p>}
            {!extracting && extraction && <p role="status" className="vault-meta">
              {extraction.fileName} · {extraction.message || (extraction.count ? 'Đã điền ' + extraction.filled + '/' + extraction.count + ' trường tìm được.' : 'Không có giá trị mới để cập nhật.')}
            </p>}
          </section>

          {!!proposal.length && <section className="achievement-inline-review" aria-label="Đề xuất của AI">
            <h3 className="font-semibold">Kiểm tra trước khi áp dụng</h3>
            <p className="vault-meta">Thông tin chỉ thay đổi trong form sau khi bạn áp dụng. Bấm Lưu để ghi vào hồ sơ.</p>
            <dl className="achievement-proposal">{proposal.map(change => <div key={change.key}>
              <dt className="font-semibold">{proposedLabel(change)}</dt>
              <dd className="vault-meta">Hiện tại: {proposedValue(change, (change.detail ? attributes : form)[change.key]) || 'Chưa có'}</dd>
              <dd>Đề xuất: {proposedValue(change, change.next)}</dd>
            </div>)}</dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondary} disabled={blocked} onClick={() => setProposal([])}>Giữ dữ liệu hiện tại</button>
              <button type="button" className={button} disabled={blocked} onClick={() => { applySuggestions(proposal); setExtraction(current => ({ ...current, filled: current.filled + proposal.length })); setProposal([]); }}>Áp dụng đề xuất</button>
            </div>
          </section>}

          <fieldset disabled={blocked} className="space-y-4 min-w-0">
            <section className="achievement-section">
              <h3 className="font-semibold">Thông tin cơ bản</h3>
              <Field label={aiLabel('title', 'Tên thành tích *')}><input required maxLength={300} className={input} value={form.title} onChange={event => edit('title', event.target.value)} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={aiLabel('achievedAt', 'Ngày đạt *')}><input required type="date" className={input} value={form.achievedAt} onChange={event => edit('achievedAt', event.target.value)} /></Field>
                <Field label={aiLabel('achievementTypeId', 'Loại thành tích')}><select className={input} value={form.achievementTypeId} onChange={event => edit('achievementTypeId', event.target.value)}>
                  <option value="">Chưa chọn loại</option>
                  {form.achievementTypeId && !type && <option value={form.achievementTypeId}>Loại đã lưu</option>}
                  {types.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select></Field>
              </div>
              <Field label={aiLabel('issuer', 'Đơn vị cấp / Ban tổ chức')}><input maxLength={300} className={input} value={form.issuer} onChange={event => edit('issuer', event.target.value)} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">{basicDetailKeys.map(key => <div key={key}>{detailField(key)}</div>)}</div>
              <Field label="Mô tả chi tiết"><textarea className={input} rows={3} maxLength={20000} value={form.description} onChange={event => edit('description', event.target.value)} /></Field>
            </section>

            <section className="achievement-section">
              <div><h3 className="font-semibold">Thông tin chi tiết bổ sung</h3><p className="vault-meta">Dùng để đối chiếu quy chế và theo dõi mục tiêu.</p></div>
              {dynamicFields.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{dynamicFields.map(key => <div key={key}>{detailField(key)}</div>)}</div>}
              {customKeys.map(key => <div key={key} className="achievement-detail-row">
                {detailField(key)}
                <button type="button" className="soft-btn-danger !px-3" aria-label={'Bỏ ' + (detailLabels[key] || key)} onClick={() => {
                  setAttributes(current => Object.fromEntries(Object.entries(current).filter(([id]) => id !== key)));
                  setAssisted(current => current.filter(id => id !== key));
                }}><Trash2 size={16} /></button>
              </div>)}
              <div className="flex flex-wrap gap-2">
                {['hours', 'decision_number', 'academic_year', 'contribution_percent'].filter(key => !dynamicFields.includes(key) && !Object.hasOwn(attributes, key)).map(key =>
                  <button type="button" key={key} className={secondary} onClick={() => addDetail(key)}><Plus size={14} />{detailLabels[key]}</button>)}
              </div>
              <div className="achievement-detail-row">
                <Field label="Tên thông tin khác"><input className={input} maxLength={80} value={newDetail} onChange={event => setNewDetail(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addDetail(newDetail); } }} /></Field>
                <button type="button" className={secondary} disabled={!newDetail.trim()} onClick={() => addDetail(newDetail)}>Thêm</button>
              </div>
            </section>
          </fieldset>

          <div className="achievement-form-actions">
            <button type="button" className={secondary} disabled={blocked} onClick={() => {
              if (editing) { setShowForm(false); setPreview(null); setDrawerError(null); } else closeDrawer();
            }}>Hủy</button>
            <button className={button} disabled={blocked || !!proposal.length}>{saving ? 'Đang lưu…' : 'Lưu thành tích'}</button>
          </div>
        </form> : achievementDetail && <>
          <section className="achievement-section">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Tổng quan</h3>
              {tab !== 'trash' && <button type="button" className={secondary} disabled={blocked} onClick={() => begin(achievementDetail)}><Pencil size={16} /> Chỉnh sửa</button>}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div><dt className="vault-meta">Loại</dt><dd>{achievementDetail.typeName || 'Chưa phân loại'}</dd></div>
              <div><dt className="vault-meta">Ngày đạt</dt><dd><DateText value={achievementDetail.achievedAt} /></dd></div>
              <div><dt className="vault-meta">Đơn vị cấp</dt><dd>{achievementDetail.issuer || 'Chưa cập nhật'}</dd></div>
              {Object.entries(achievementDetail.attributes || {}).map(([key, value]) => <div key={key}><dt className="vault-meta">{detailLabels[key] || key}</dt><dd className="break-words">{formatAchievementValue(value)}</dd></div>)}
            </dl>
            <div><h4 className="font-semibold">Mô tả</h4><p className="vault-meta whitespace-pre-wrap">{achievementDetail.description || 'Chưa có mô tả.'}</p></div>
          </section>
          {evidenceArea}
        </>}
        {preview && <section className="achievement-section" ref={previewSection} tabIndex={-1} aria-label="Xem trước tệp">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="break-all font-semibold">{preview.name}</h3><button type="button" className={secondary} onClick={() => setPreview(null)}>Đóng bản xem trước</button></div>
          {preview.pdf ? <iframe src={preview.url} title={'Xem trước ' + preview.name} className="achievement-file-preview" />
            : preview.image ? <img src={preview.url} alt={preview.name} className="achievement-file-preview object-contain" />
              : <p className="vault-meta">Xem trước hỗ trợ PDF và ảnh. Bạn có thể tải tệp đã lưu xuống để mở.</p>}
        </section>}
      </Modal>
    </Page>
  );
}
