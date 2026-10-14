import Select from '../components/common/Select';
import PageHeader from '../components/common/PageHeader';
import React, { useCallback, useEffect, useState } from 'react';
import { applicationsApi as api } from '../services/applicationsApi';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, FileText, Plus, X, Eye, CalendarDays, Award, Clock, MessageSquare, History, UserRound } from 'lucide-react';
import { LoadingState } from '../components/common/AsyncState';
import { useSelectionOptions, useSelectionSources } from '../hooks/useSelections';
import { EntitySelect, RecordPicker, lecturerLabel } from '../components/common/EntityPicker';
import { selectionsApi } from '../services/selectionsApi';

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50';
const statusClass = status => status === 'RECOMMENDED' ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200' : status === 'NEED_CORRECTION' ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'border-teal-100 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300';
const actionLabels = { assign: 'Phân công', comment: 'Ghi ý kiến', recommend: 'Đề nghị khen thưởng', 'not-recommend': 'Không đề nghị', 'request-correction': 'Yêu cầu bổ sung', resubmit: 'Gửi bổ sung' };
const formatDate = value => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const statuses = { DRAFT: 'Bản nháp', SUBMITTED: 'Đã nộp', COUNCIL_PENDING: 'Chờ Hội đồng', UNDER_REVIEW: 'Đang xét duyệt', NEED_CORRECTION: 'Cần bổ sung', RECOMMENDED: 'Đề nghị khen thưởng', NOT_RECOMMENDED: 'Không đề nghị', CANCELLED: 'Đã hủy' };

export default function AwardApplications() {
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));
  const applicant = roles.some((r) => ['LECTURER', 'UNIT_REPRESENTATIVE'].includes(r));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ subjectType: 'LECTURER',achievementIds:[],awardRecordIds:[] });
  const [cycle, setCycle] = useState({});
  const [cycles, setCycles] = useState([]);
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [unit, setUnit] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listLoaded, setListLoaded] = useState(false);
  const choices = useSelectionOptions('APPLICATION');
  const sources = useSelectionSources('APPLICATION',form.subjectType,form.subjectId);
  const subjects = form.subjectType === 'LECTURER' ? choices.lecturers : choices.subjectUnits;
  const [reviewers,setReviewers] = useState([]);
  const [reviewersLoading,setReviewersLoading] = useState(false);
  const [reviewersError,setReviewersError] = useState('');
  useEffect(() => {
    if (choices.loading) return;
    setForm(current => {
      const available = current.subjectType === 'LECTURER' ? choices.lecturers : choices.subjectUnits;
      if (available.some(s=>String(s.id)===String(current.subjectId))) return current;
      return {...current,subjectId:available.length===1 ? String(available[0].id) : '',achievementIds:[],awardRecordIds:[],targetAwardTypeId:''};
    });
  },[choices.loading,choices.lecturers,choices.subjectUnits]);
  useEffect(() => {
    let active=true;
    setReviewers([]);setReviewerId('');setReviewersError('');
    if(!detail?.canCouncil){setReviewersLoading(false);return;}
    setReviewersLoading(true);
    selectionsApi.reviewers(detail.application_id).then(rows=>{if(active)setReviewers(rows);})
      .catch(e=>{if(active)setReviewersError(e.message);})
      .finally(()=>{if(active)setReviewersLoading(false);});
    return ()=>{active=false;};
  },[detail?.application_id,detail?.canCouncil,detail?.version]);
  const loadItems = useCallback(async (fresh=false) => {
    if(!unit && choices.workflowUnits.length){
      const lists=await Promise.all(choices.workflowUnits.map(u=>api.list(u.id,fresh)));
      return [...new Map(lists.flatMap(out=>out.items || []).map(r=>[r.application_id,r])).values()].sort((a,b)=>Number(b.application_id)-Number(a.application_id));
    }
    return (await api.list(unit==='mine' ? '' : unit,fresh)).items || [];
  },[unit,choices.workflowUnits]);
  const run = async (fn) => {
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setMessage(e.message || 'Không thể thực hiện');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    api
      .cycles()
      .then((rows) => {
        if (active) setCycles(rows);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if(choices.loading) return;
    setListLoading(true);setItems([]);
    loadItems().then((rows) => { if (active) { setItems(rows); setListLoaded(true); } })
      .catch((e) => { if (active) setMessage(e.message); })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [choices.loading,loadItems]);
  const input = (name, label, type = 'text', required = true) => (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      {label}
      <input
        className={fieldClass}
        type={type}
        required={required}
        value={form[name] || ''}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
    </label>
  );
  const refresh = async (id) => {
    setDetail(await api.detail(id));
    setItems(await loadItems(true));
  };
  const create = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api.create({
        [form.subjectType === 'LECTURER' ? 'lecturerId' : 'organizationUnitId']: Number(
          form.subjectId
        ),
        cycleId: Number(form.cycleId),
        targetAwardTypeId: Number(form.targetAwardTypeId),
        purpose: form.purpose,
        achievementIds: form.achievementIds.map(Number),
        awardRecordIds: form.awardRecordIds.map(Number),
      });
      await refresh(r.application_id);
      setMessage('Đã tạo hồ sơ nháp. Hãy kiểm tra thông tin trước khi nộp xét duyệt.');
    });
  };
  const reloadList = () => run(async () => {
    setListLoading(true);
    try {
      const [rows, periods] = await Promise.all([loadItems(true), api.cycles(true)]);
      setItems(rows); setListLoaded(true); setCycles(periods); choices.refresh();
    } finally { setListLoading(false); }
  });
  return (
    <section className="award-applications space-y-6 animate-fadeIn pb-12 text-slate-800 dark:text-slate-100">
      <PageHeader title="Hồ sơ đề nghị" description="Chuẩn bị hồ sơ, gửi đơn vị và theo dõi tiến trình xét duyệt." icon={ClipboardList} onRefresh={reloadList} refreshing={busy || listLoading} primaryAction={applicant ? {label: showCreateForm ? 'Đóng biểu mẫu' : 'Tạo hồ sơ đề nghị', onClick: () => setShowCreateForm(v => !v), disabled: busy} : null} />
      {message && (
        <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {message}
        </p>
      )}
      {(choices.error || sources.error) && <p role="alert" className="text-sm text-rose-600">{choices.error || sources.error}</p>}
      {roles.includes('RECORDS_OFFICER') && (
        <form
          className="soft-card p-6 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.cycle(cycle);
              setCycles(await api.cycles());
              setMessage('Đã mở kỳ đề nghị.');
            });
          }}
        >
          <h2 className="sm:col-span-2 flex items-center gap-2 text-lg font-bold"><Plus className="h-5 w-5 text-teal-600" /> Mở kỳ đề nghị</h2>
          {['code', 'name', 'startDate', 'endDate'].map((k, i) => (
            <label key={k} className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {['Mã kỳ', 'Tên kỳ', 'Bắt đầu', 'Kết thúc'][i]}
              <input
                required
                className={fieldClass}
                type={i > 1 ? 'date' : 'text'}
                value={cycle[k] || ''}
                onChange={(e) => setCycle({ ...cycle, [k]: e.target.value })}
              />
            </label>
          ))}
          <button className={buttonClass} disabled={busy}>Mở kỳ</button>
        </form>
      )}
      {applicant && showCreateForm && (
        <form onSubmit={create} className="soft-card p-6 grid md:grid-cols-2 gap-4">
          <h2 className="md:col-span-2 flex items-center gap-2 text-lg font-bold"><FileText className="h-5 w-5 text-teal-600" /> Chuẩn bị hồ sơ mới</h2>
          <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Chủ thể
            <Select
              className={fieldClass}
              value={form.subjectType}
              onChange={(e) => setForm({ ...form, subjectType: e.target.value,subjectId:'',targetAwardTypeId:'',achievementIds:[],awardRecordIds:[] })}
            >
              <option value="LECTURER">Cá nhân của tôi</option>
              <option value="UNIT">Tập thể tôi đại diện</option>
            </Select>
          </label>
          <EntitySelect label={form.subjectType==='LECTURER' ? 'Giảng viên đề nghị' : 'Đơn vị tôi đại diện'} options={subjects} value={form.subjectId} required disabled={choices.loading} getLabel={form.subjectType==='LECTURER' ? lecturerLabel : o=>o.name} placeholder={choices.loading ? 'Đang tải…' : 'Chọn chủ thể'} onChange={subjectId=>setForm({...form,subjectId,achievementIds:[],awardRecordIds:[]})} className={fieldClass} />
          <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Kỳ đề nghị
            <Select
              required
              className={fieldClass}
              value={form.cycleId || ''}
              onChange={(e) => setForm({ ...form, cycleId: e.target.value })}
            >
              <option value="">Chọn kỳ</option>
              {cycles.map((c) => (
                <option key={c.award_period_id} value={c.award_period_id}>
                  {c.name} — {c.status}
                </option>
              ))}
            </Select>
          </label>
          <EntitySelect label="Loại khen thưởng đề nghị" options={choices.awardTypes.filter(t=>['BOTH',form.subjectType].includes(t.subjectType))} value={form.targetAwardTypeId} onChange={targetAwardTypeId=>setForm({...form,targetAwardTypeId})} required disabled={choices.loading} placeholder="Chọn loại khen thưởng" className={fieldClass} />
          {input('purpose', 'Mục đích đề nghị')}
          <RecordPicker label="Thành tích đã xác nhận" options={sources.achievements} value={form.achievementIds} onChange={achievementIds=>setForm({...form,achievementIds})} loading={sources.loading} disabled={!form.subjectId} emptyMessage="Chủ thể này chưa có thành tích đã xác nhận. Hoàn tất xác nhận thành tích trước khi nộp đề nghị." />
          <RecordPicker label="Khen thưởng đã ghi nhận (nếu có)" options={sources.awardRecords} value={form.awardRecordIds} onChange={awardRecordIds=>setForm({...form,awardRecordIds})} loading={sources.loading} disabled={!form.subjectId} emptyMessage="Chưa có khen thưởng đã ghi nhận; có thể để trống mục này." />
          <button disabled={busy || choices.loading || sources.loading || !!sources.error || !form.subjectId || !(form.achievementIds.length || form.awardRecordIds.length)} className={`${buttonClass} self-end justify-self-start`}>
            Tạo hồ sơ nháp
          </button>
        </form>
      )}
      <div className="soft-card p-5 space-y-4">
      <h2 className="text-lg font-bold">Danh sách hồ sơ</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="w-full space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Đơn vị xem hồ sơ
          <Select aria-label="Đơn vị xem hồ sơ" className={fieldClass} value={unit} disabled={choices.loading} onChange={e=>setUnit(e.target.value)}>
            <option value="">{choices.workflowUnits.length ? 'Tất cả đơn vị trong phạm vi' : 'Hồ sơ do tôi tạo'}</option>
            {!!choices.workflowUnits.length && <option value="mine">Hồ sơ do tôi tạo</option>}
            {choices.workflowUnits.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </label>

      </div>
      {listLoading && <LoadingState label="Đang tải hồ sơ đề nghị..." rows={3} />}
      {!listLoading && listLoaded && !items.length && <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Chưa có hồ sơ đề nghị trong danh sách này.</p>}
      <ul className="space-y-3">
        {!listLoading && items.map((r) => (
          <li key={r.application_id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-teal-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/40 sm:p-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400 sm:flex"><FileText className="h-5 w-5" /></span>
              <div className="min-w-0"><strong className="text-sm text-slate-900 dark:text-white">{r.purpose || "Hồ sơ đề nghị"}</strong><p className="mt-1 text-xs text-slate-500">{choices.awardTypes.find(t=>String(t.id)===String(r.target_award_type_id))?.name || 'Khen thưởng'} · {cycles.find(c => String(c.award_period_id) === String(r.award_period_id))?.name || 'Kỳ #' + r.award_period_id}</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:hidden ${statusClass(r.status)}`}>{statuses[r.status] || r.status}</span></div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`hidden rounded-full border px-3 py-1.5 text-xs font-semibold sm:inline-flex ${statusClass(r.status)}`}>{statuses[r.status] || r.status}</span>
              <span className="group/view relative"><button type="button" aria-label={`Xem chi tiết hồ sơ #${r.application_id}`} aria-describedby={`application-view-${r.application_id}`} disabled={busy} onClick={() => run(async () => setDetail(await api.detail(r.application_id)))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-600 transition hover:border-teal-300 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20 disabled:opacity-50 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300"><Eye className="h-4 w-4" /></button><span id={`application-view-${r.application_id}`} role="tooltip" className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover/view:opacity-100 group-focus-within/view:opacity-100 dark:bg-slate-100 dark:text-slate-900">Xem chi tiết</span></span>
            </div>
          </li>
        ))}
      </ul>
      </div>
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={e => { if (e.target === e.currentTarget && !busy) setDetail(null); }}>
        <article role="dialog" aria-modal="true" aria-label={'Chi tiết hồ sơ đề nghị ' + detail.application_id} className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/70 bg-slate-50 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <header className="flex items-start justify-between gap-4 border-b border-teal-100 bg-gradient-to-br from-teal-50 via-white to-white p-5 dark:border-slate-700 dark:from-teal-950/50 dark:via-slate-800 dark:to-slate-800 sm:p-6">
            <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm"><FileText className="h-6 w-6" /></span><div><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">Chi tiết đề nghị</p><h2 className="text-xl font-bold text-slate-900 dark:text-white">Hồ sơ #{detail.application_id}</h2><div className="mt-2 flex items-center gap-2"><span className={'rounded-full border px-2.5 py-1 text-[11px] font-semibold ' + statusClass(detail.status)}>{statuses[detail.status] || detail.status}</span><span className="text-xs text-slate-400">Phiên bản {detail.version}</span></div></div></div>
            <button type="button" aria-label="Đóng hồ sơ" disabled={busy} onClick={() => setDetail(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:hover:text-white"><X className="h-4 w-4" /></button>
          </header>
          <div className="max-h-[65vh] space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><Award className="h-5 w-5 text-teal-500" /><div><p className="text-xs text-slate-400">Mục tiêu khen thưởng</p><p className="mt-1 text-sm font-semibold">{choices.awardTypes.find(t=>String(t.id)===String(detail.target_award_type_id))?.name || 'Khen thưởng'}</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><CalendarDays className="h-5 w-5 text-teal-500" /><div><p className="text-xs text-slate-400">Kỳ đề nghị</p><p className="mt-1 text-sm font-semibold">{cycles.find(c => String(c.award_period_id) === String(detail.award_period_id))?.name || 'Kỳ #' + detail.award_period_id}</p></div></div></div>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><h3 className="mb-2 text-sm font-bold">Mục đích đề nghị</h3><p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{detail.purpose || 'Chưa có nội dung đề nghị.'}</p></section>
          {detail.status === 'DRAFT' && applicant && (
            <button
              disabled={busy}
              className={buttonClass}
              onClick={() =>
                run(async () => {
                  await api.transition(detail.application_id, 'submit', {
                    version: Number(detail.version),
                  });
                  await refresh(detail.application_id);
                })
              }
            >
              Nộp hồ sơ xét duyệt
            </button>
          )}
          {detail.status === 'SUBMITTED' && roles.includes('MANAGER') && (
            <div>
              <input
                aria-label="Ý kiến đơn vị"
                className={fieldClass}
                placeholder="Ý kiến đơn vị bắt buộc"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                className={buttonClass}
                disabled={busy || !reason.trim()}
                onClick={() =>
                  run(async () => {
                    await api.transition(detail.application_id, 'forward', {
                      version: Number(detail.version),
                      reason,
                    });
                    await refresh(detail.application_id);
                  })
                }
              >
                Chuyển Hội đồng
              </button>
            </div>
          )}
          {(detail.canCouncil || (applicant && detail.status === 'NEED_CORRECTION')) && (
            <div className="space-y-2">
              <p>
                Kết luận chỉ là đề nghị. RecordsOfficer cần quyết định và file quyết định để ghi
                nhận khen thưởng.
              </p>
              <textarea
                aria-label="Ý kiến hoặc nội dung bổ sung"
                className={fieldClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ý kiến / bổ sung / căn cứ kết luận (ít nhất 5 ký tự)"
              />
              {detail.canCouncil && <EntitySelect label="Thành viên Hội đồng được phân công" options={reviewers.map(r=>({...r,disabled:r.assigned}))} value={reviewerId} onChange={setReviewerId} disabled={reviewersLoading} placeholder={reviewersLoading ? 'Đang tải người xét…' : 'Chọn người xét đúng phạm vi'} getLabel={r=>`${r.name} (${r.username})${r.assigned ? ' · Đã phân công' : ''}`} className={fieldClass} />}
              {reviewersError && <p role="alert" className="text-sm text-rose-600">{reviewersError}</p>}
              {(detail.status === 'NEED_CORRECTION'
                ? applicant
                  ? [['resubmit', 'Gửi bổ sung qua đơn vị']]
                  : []
                : ['COUNCIL_PENDING', 'UNDER_REVIEW'].includes(detail.status) &&
                    roles.includes('COUNCIL')
                  ? [
                      ['assign', 'Phân công'],
                      ['comment', 'Ghi ý kiến'],
                      ['request-correction', 'Yêu cầu bổ sung'],
                      ['recommend', 'Đề nghị khen thưởng'],
                      ['not-recommend', 'Không đề nghị'],
                    ]
                  : []
              ).map(([action, label]) => (
                <button
                  key={action}
                  className={action === 'recommend' ? 'mr-2 mb-2 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400' : `${buttonClass} mr-2 mb-2`}
                  disabled={
                    busy ||
                    reason.trim().length < 5 ||
                    (action === 'assign' && !reviewerId) ||
                    (!['assign', 'resubmit'].includes(action) && !detail.canReview)
                  }
                  onClick={() =>
                    run(async () => {
                      await api.transition(detail.application_id, action, {
                        version: Number(detail.version),
                        reason,
                        ...(action === 'assign' ? { reviewerId: Number(reviewerId) } : {}),
                      });
                      await refresh(detail.application_id);
                      setReason('');
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><MessageSquare className="h-4 w-4 text-teal-500" />Phân công và ý kiến</h3><div className="space-y-3">{(detail.reviews || []).map(r => <div key={r.review_id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-900/60"><UserRound className="h-4 w-4 text-slate-400" /><p>Người xét <strong>{r.reviewer_name || 'Thành viên Hội đồng'}</strong> · Được giao bởi {r.assigned_by_name || 'Người phân công'}</p></div>)}{(detail.comments || []).map(c => <div key={c.comment_id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60"><p className="mb-1 text-xs text-slate-400">{c.actor_name || 'Người ghi ý kiến'} · {actionLabels[c.action] || c.action}</p><p className="text-sm leading-relaxed">{c.content}</p></div>)}{!detail.reviews?.length && !detail.comments?.length && <p className="text-sm text-slate-400">Chưa có phân công hoặc ý kiến.</p>}</div></section>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><h3 className="mb-4 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4 text-teal-500" />Lịch sử xử lý</h3><ol className="space-y-4">{(detail.histories || []).map(h => <li key={h.history_id} className="flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-500 dark:bg-teal-950/50"><Clock className="h-3.5 w-3.5" /></span><div><p className="text-sm font-semibold">{statuses[h.from_status] || 'Khởi tạo'} → {statuses[h.to_status] || h.to_status}</p>{h.reason && <p className="mt-1 text-sm text-slate-500">{h.reason}</p>}<time className="mt-1 block text-xs text-slate-400">{formatDate(h.created_at)}</time></div></li>)}{!detail.histories?.length && <li className="text-sm text-slate-400">Chưa có lịch sử xử lý.</li>}</ol></section>
          {detail.input && (
            <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <summary className="cursor-pointer text-sm font-semibold text-teal-700 dark:text-teal-300">Dữ liệu hồ sơ tại thời điểm nộp — phiên bản {detail.input.input_version}</summary>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 whitespace-pre-wrap text-xs text-slate-500 dark:bg-slate-900">
                {JSON.stringify(detail.input.snapshot, null, 2)}
              </pre>
            </details>
          )}
          </div>
        </article>
        </div>
      )}
    </section>
  );
}
