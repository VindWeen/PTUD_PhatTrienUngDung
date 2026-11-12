import Select from '../components/common/Select';
import PageHeader from '../components/common/PageHeader';
import UnderlineTabs from '../components/common/UnderlineTabs';
import React, { useCallback, useEffect, useState } from 'react';
import { applicationsApi as api } from '../services/applicationsApi';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, FileText, Plus, X, CalendarDays, Award, Clock, MessageSquare, History, UserRound, ArrowRight } from 'lucide-react';
import { LoadingState } from '../components/common/AsyncState';
import { useSelectionOptions, useSelectionSources } from '../hooks/useSelections';
import { EntitySelect, RecordPicker, lecturerLabel } from '../components/common/EntityPicker';
import { selectionsApi } from '../services/selectionsApi';
import ApplicationSnapshot from '../components/ApplicationSnapshot';

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50';
const statusStyles = {
  DRAFT: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  SUBMITTED: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
  COUNCIL_PENDING: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300',
  UNDER_REVIEW: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  NEED_CORRECTION: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  RECOMMENDED: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  NOT_RECOMMENDED: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300',
  CANCELLED: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
};
const statusClass = status => statusStyles[status] || statusStyles.DRAFT;
export function nextApplicationStep(status, roles = []) {
  const has = role => roles.includes(role);
  switch (status) {
    case 'DRAFT': return has('LECTURER') || has('UNIT_REPRESENTATIVE') ? 'Bạn cần hoàn thiện và nộp hồ sơ.' : 'Chờ người lập hoàn thiện và nộp hồ sơ.';
    case 'SUBMITTED': return has('MANAGER') ? 'Bạn cần ghi ý kiến đơn vị và chuyển Hội đồng.' : 'Chờ quản lý đơn vị ghi ý kiến và chuyển Hội đồng.';
    case 'COUNCIL_PENDING': return has('COUNCIL') ? 'Hội đồng cần phân công người xét và xem hồ sơ.' : 'Chờ Hội đồng phân công và xem xét.';
    case 'UNDER_REVIEW': return has('COUNCIL') ? 'Thành viên được phân công ghi ý kiến và kết luận.' : 'Hội đồng đang xem xét hồ sơ.';
    case 'NEED_CORRECTION': return has('LECTURER') || has('UNIT_REPRESENTATIVE') ? 'Người lập cần bổ sung và gửi lại qua đơn vị.' : 'Chờ người lập bổ sung và gửi lại qua đơn vị.';
    case 'RECOMMENDED': return has('RECORDS_OFFICER') ? 'Mở Khen thưởng để chuẩn bị quyết định và ghi nhận.' : 'Hội đồng đã đề nghị; theo dõi quyết định chính thức và kết quả tại sổ khen thưởng.';
    case 'NOT_RECOMMENDED': return 'Đợt xét đã kết thúc: xem căn cứ không đề nghị trong chi tiết.';
    case 'CANCELLED': return 'Hồ sơ đã dừng xử lý.';
    default: return 'Mở chi tiết để xem tiến trình xử lý.';
  }
}

const actionLabels = { assign: 'Phân công', comment: 'Ghi ý kiến', recommend: 'Đề nghị khen thưởng', 'not-recommend': 'Không đề nghị', 'request-correction': 'Yêu cầu bổ sung', resubmit: 'Gửi bổ sung' };
const formatDate = value => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const statuses = { DRAFT: 'Bản nháp', SUBMITTED: 'Đã nộp', COUNCIL_PENDING: 'Chờ Hội đồng', UNDER_REVIEW: 'Đang xét duyệt', NEED_CORRECTION: 'Cần bổ sung', RECOMMENDED: 'Đề nghị khen thưởng', NOT_RECOMMENDED: 'Không đề nghị', CANCELLED: 'Đã hủy' };

export default function AwardApplications() {
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));
  const councilView = roles.includes('COUNCIL');
  const managerView = !councilView && roles.includes('MANAGER');
  const lecturerView = !councilView && !managerView && roles.some(r=>['LECTURER','UNIT_REPRESENTATIVE'].includes(r));
  const workflowView = councilView || managerView || lecturerView;
  const councilPending = r => ['COUNCIL_PENDING', 'UNDER_REVIEW'].includes(r.status);
  const managerPending = r => r.status === 'SUBMITTED' && String(r.created_by) !== String(user?.userId) && !(r.lecturer_id && String(r.lecturer_id) === String(user?.lecturerProfile?.lecturerId));
  const [queueFilter, setQueueFilter] = useState('pending');
  const applicant = roles.some((r) => ['LECTURER', 'UNIT_REPRESENTATIVE'].includes(r));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ subjectType: 'LECTURER',achievementIds:[],awardRecordIds:[] });
  const [cycle, setCycle] = useState({});
  const [cycles, setCycles] = useState([]);
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [editForm, setEditForm] = useState({ purpose: '', achievementIds: [], awardRecordIds: [] });
  const [unit, setUnit] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [reason, setReason] = useState('');
  const [councilReasons, setCouncilReasons] = useState({ assign: '', exchange: '', conclusion: '' });
  useEffect(() => { setReason(''); setCouncilReasons({ assign: '', exchange: '', conclusion: '' }); }, [detail?.application_id]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listLoaded, setListLoaded] = useState(false);
  const choices = useSelectionOptions('APPLICATION');
  const sources = useSelectionSources('APPLICATION',form.subjectType,form.subjectId);
  const editSources = useSelectionSources('APPLICATION', detail?.lecturer_id ? 'LECTURER' : 'UNIT', detail?.canEdit ? (detail.lecturer_id || detail.unit_id) : '');
  useEffect(() => {
    setEditForm({ purpose: detail?.purpose || '', achievementIds: detail?.achievement_ids || [], awardRecordIds: detail?.award_record_ids || [] });
  }, [detail]);
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
    const readAll = async id => { const rows=[]; let page=1, more; do { const out=await api.list(id,fresh,page++); rows.push(...(out.items || [])); more=out.hasMore; } while(more); return rows; };
    if(!unit && choices.workflowUnits.length){
      const lists=await Promise.all(choices.workflowUnits.map(u=>readAll(u.id)));
      return [...new Map(lists.flat().map(r=>[r.application_id,r])).values()].sort((a,b)=>Number(b.application_id)-Number(a.application_id));
    }
    return readAll(unit==='mine' ? '' : unit);
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
  const saveEdits = async () => api.update(detail.application_id, {
    version: Number(detail.version),
    purpose: editForm.purpose,
    achievementIds: editForm.achievementIds.map(Number),
    awardRecordIds: editForm.awardRecordIds.map(Number),
  });
  const editInvalid = !editForm.achievementIds.length || editForm.purpose.trim().length < 5 || editForm.purpose.trim().length > 2000 || editSources.loading || !!editSources.error;
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
  const councilInput = (key, label) => <label className="flex flex-col gap-2 text-sm font-semibold">{label}<textarea rows={3} maxLength={1000} className={`${fieldClass} font-normal leading-6`} value={councilReasons[key]} onChange={e=>setCouncilReasons(current=>({...current,[key]:e.target.value}))} placeholder="Nhập nội dung cụ thể (ít nhất 5 ký tự)" /></label>;
  const transitionButton = (action, label, actionReason) => <button type="button" className={`${buttonClass} ${action === 'not-recommend' ? '!bg-rose-700 hover:!bg-rose-800' : action === 'request-correction' ? '!bg-amber-700 hover:!bg-amber-800' : action === 'comment' ? '!bg-slate-600 hover:!bg-slate-700' : ''}`} disabled={busy || actionReason.trim().length < 5 || (action === 'resubmit' && editInvalid) || (action === 'assign' && !reviewerId) || (!['assign','resubmit'].includes(action) && !detail?.canReview)} onClick={()=>run(async()=>{
    const saved = action === 'resubmit' ? await saveEdits() : detail;
    if(action === 'resubmit') setDetail(await api.detail(detail.application_id));
    await api.transition(detail.application_id,action,{version:Number(saved.version),reason:actionReason,...(action==='assign' ? {reviewerId:Number(reviewerId)} : {})});
    await refresh(detail.application_id);setReason('');setCouncilReasons({assign:'',exchange:'',conclusion:''});
  })}>{label}</button>;
  return (
    <section className="award-applications space-y-6 animate-fadeIn pb-12 text-slate-800 dark:text-slate-100">
      <PageHeader title="Đề nghị khen thưởng" description="Chuẩn bị hồ sơ, gửi đơn vị và theo dõi tiến trình xét duyệt." icon={ClipboardList} onRefresh={reloadList} refreshing={busy || listLoading} primaryAction={applicant ? {label: showCreateForm ? 'Đóng biểu mẫu' : 'Tạo hồ sơ đề nghị', onClick: () => setShowCreateForm(v => !v), disabled: busy} : null} />
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
          <button disabled={busy || choices.loading || sources.loading || !!sources.error || !form.subjectId || !form.achievementIds.length} className={`${buttonClass} self-end justify-self-start`}>
            Tạo hồ sơ nháp
          </button>
        </form>
      )}
      <div className="soft-card overflow-hidden">
      <div className="flex flex-col gap-5 px-5 pt-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
      <div><h2 className="text-lg font-bold">{lecturerView ? 'Hồ sơ đề nghị của tôi' : workflowView ? 'Hàng đợi xét duyệt' : 'Danh sách hồ sơ'}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{councilView ? 'Phân công hồ sơ mới và tiếp tục công việc của Hội đồng.' : managerView ? 'Rà soát hồ sơ của đơn vị, ghi ý kiến và chuyển Hội đồng.' : 'Theo dõi tiến trình và mở hồ sơ để xử lý.'}</p></div>
        <label className="w-full space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:max-w-xs">Đơn vị xem hồ sơ
          <Select aria-label="Đơn vị xem hồ sơ" className={fieldClass} value={unit} disabled={choices.loading} onChange={e=>setUnit(e.target.value)}>
            <option value="">{choices.workflowUnits.length ? 'Tất cả đơn vị trong phạm vi' : 'Hồ sơ do tôi tạo'}</option>
            {!!choices.workflowUnits.length && <option value="mine">Hồ sơ do tôi tạo</option>}
            {choices.workflowUnits.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </label>

      </div>
      {workflowView && <div className="mt-5 border-b border-slate-200 px-5 dark:border-slate-700 sm:px-7"><UnderlineTabs label={lecturerView ? 'Lọc tiến trình hồ sơ của tôi' : managerView ? 'Lọc hồ sơ theo công việc của quản lý' : 'Lọc hồ sơ theo công việc của Hội đồng'} value={queueFilter} onChange={setQueueFilter} disabled={listLoading} items={lecturerView ? [
        { id: 'pending', label: `Cần tôi hoàn thiện (${items.filter(r=>['DRAFT','NEED_CORRECTION'].includes(r.status)).length})` },
        { id: 'waiting', label: `Đang xét (${items.filter(r=>['SUBMITTED','COUNCIL_PENDING','UNDER_REVIEW'].includes(r.status)).length})` },
        { id: 'closed', label: `Đã kết luận / dừng (${items.filter(r=>['RECOMMENDED','NOT_RECOMMENDED','CANCELLED'].includes(r.status)).length})` },
        { id: 'all', label: `Tất cả (${items.length})` },
      ] : managerView ? [
        { id: 'pending', label: `Chờ đơn vị xử lý (${items.filter(managerPending).length})` },
        { id: 'waiting', label: `Đã chuyển Hội đồng (${items.filter(councilPending).length})` },
        { id: 'closed', label: `Đã kết luận / dừng (${items.filter(r=>['RECOMMENDED','NOT_RECOMMENDED','CANCELLED'].includes(r.status)).length})` },
        { id: 'all', label: `Tất cả (${items.length})` },
      ] : [
        { id: 'pending', label: `Cần xử lý (${items.filter(councilPending).length})` },
        { id: 'waiting', label: `Chờ bổ sung (${items.filter(r=>r.status === 'NEED_CORRECTION').length})` },
        { id: 'closed', label: `Đã kết luận / dừng (${items.filter(r=>['RECOMMENDED','NOT_RECOMMENDED','CANCELLED'].includes(r.status)).length})` },
        { id: 'all', label: `Tất cả (${items.length})` },
      ]} /></div>}
      {listLoading && <div className="p-5"><LoadingState label="Đang tải hồ sơ đề nghị..." rows={3} /></div>}
      {!workflowView && !listLoading && listLoaded && !items.length && <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chưa có hồ sơ đề nghị trong danh sách này.</p>}
      {!listLoading && (councilView ? [
        { title: 'Hội đồng cần xử lý', description: 'Ưu tiên phân công hồ sơ mới và tiếp tục xét các hồ sơ đang xử lý. Quyền thao tác cụ thể được hiển thị trong chi tiết.', rows: items.filter(councilPending), urgent: true },
        { title: 'Đang chờ bổ sung', description: 'Chờ người lập hoàn thiện và gửi lại qua đơn vị.', rows: items.filter(r => r.status === 'NEED_CORRECTION'), urgent: false },
        { title: 'Đã có kết luận hoặc đã dừng', description: 'Tra cứu kết luận và lịch sử; hồ sơ được đề nghị vẫn cần quyết định chính thức để ghi nhận khen thưởng.', rows: items.filter(r => ['RECOMMENDED', 'NOT_RECOMMENDED', 'CANCELLED'].includes(r.status)), urgent: false },
        { title: 'Hồ sơ ở bước khác', description: 'Chưa đến bước Hội đồng xử lý.', rows: items.filter(r => !['COUNCIL_PENDING', 'UNDER_REVIEW', 'NEED_CORRECTION', 'RECOMMENDED', 'NOT_RECOMMENDED', 'CANCELLED'].includes(r.status)), urgent: false },
      ] : managerView ? [
        { title: 'Chờ đơn vị xử lý', rows: items.filter(managerPending), urgent: true },
        { title: 'Đã chuyển Hội đồng', rows: items.filter(councilPending), urgent: false },
        { title: 'Đã có kết luận hoặc đã dừng', rows: items.filter(r=>['RECOMMENDED','NOT_RECOMMENDED','CANCELLED'].includes(r.status)), urgent: false },
        { title: 'Hồ sơ ở bước khác / hồ sơ của tôi', rows: items.filter(r=>!managerPending(r) && !['COUNCIL_PENDING','UNDER_REVIEW','RECOMMENDED','NOT_RECOMMENDED','CANCELLED'].includes(r.status)), urgent: false },
      ] : lecturerView ? [
        { title: 'Cần tôi hoàn thiện', rows: items.filter(r=>['DRAFT','NEED_CORRECTION'].includes(r.status)), urgent: true },
        { title: 'Đang chờ đơn vị và Hội đồng xét', rows: items.filter(r=>['SUBMITTED','COUNCIL_PENDING','UNDER_REVIEW'].includes(r.status)), urgent: false },
        { title: 'Đã có kết luận hoặc đã dừng', rows: items.filter(r=>['RECOMMENDED','NOT_RECOMMENDED','CANCELLED'].includes(r.status)), urgent: false },
        { title: 'Hồ sơ ở bước khác', rows: items.filter(r=>!['DRAFT','NEED_CORRECTION','SUBMITTED','COUNCIL_PENDING','UNDER_REVIEW','RECOMMENDED','NOT_RECOMMENDED','CANCELLED'].includes(r.status)), urgent: false },
      ] : [{ title: '', rows: items, urgent: false }]).filter((group, index) => (!workflowView || queueFilter === 'all') ? group.rows.length > 0 : index === ({pending:0,waiting:1,closed:2}[queueFilter])).map(group => <section key={group.title}>
      {group.title && <div className="flex items-center justify-between gap-3 bg-slate-50/80 px-5 py-3 dark:bg-slate-900/40 sm:px-7"><h3 className={`text-sm font-semibold ${group.urgent ? 'text-teal-800 dark:text-teal-300' : 'text-slate-600 dark:text-slate-300'}`}>{group.title}</h3><span className="text-xs tabular-nums text-slate-500">{group.rows.length} hồ sơ</span></div>}
      {!group.rows.length && <div className="px-7 py-12 text-center"><p className="text-sm font-semibold">Không có hồ sơ trong nhóm này</p><p className="mt-2 text-sm text-slate-500">Chọn nhóm khác hoặc đổi đơn vị để xem thêm hồ sơ.</p></div>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">
        {group.rows.map((r) => (
          <li key={r.application_id} className="min-w-0">
            <button type="button" aria-label={`Xem chi tiết hồ sơ #${r.application_id}`} disabled={busy} onClick={() => run(async () => setDetail(await api.detail(r.application_id)))} className="group/row grid w-full grid-cols-1 items-center gap-4 px-5 py-5 text-left transition-colors duration-200 hover:bg-teal-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-teal-950/20 sm:grid-cols-[minmax(0,1fr)_10rem_10rem] sm:px-7">
              <div className="min-w-0"><p className="mb-1.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">Hồ sơ #{r.application_id}</p><strong className="block break-words text-sm font-semibold leading-6 text-slate-900 dark:text-white">{r.purpose || 'Hồ sơ đề nghị'}</strong><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{choices.awardTypes.find(t=>String(t.id)===String(r.target_award_type_id))?.name || 'Khen thưởng'} · {cycles.find(c => String(c.award_period_id) === String(r.award_period_id))?.name || 'Kỳ #' + r.award_period_id}</p></div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium ${group.urgent ? 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200' : statusClass(r.status)}`}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${group.urgent ? 'bg-teal-600' : 'bg-current'}`} />{statuses[r.status] || r.status}</span>
              <span className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${group.urgent ? 'bg-teal-700 text-white group-hover/row:bg-teal-800' : 'justify-self-start text-slate-600 group-hover/row:text-teal-700 dark:text-slate-300 dark:group-hover/row:text-teal-300'}`}>{group.urgent ? (lecturerView ? (r.status === 'NEED_CORRECTION' ? 'Bổ sung hồ sơ' : 'Hoàn thiện nháp') : managerView ? 'Rà soát hồ sơ' : r.status === 'COUNCIL_PENDING' ? 'Phân công' : 'Xem xét hồ sơ') : 'Xem chi tiết'}<ArrowRight className="h-4 w-4 shrink-0" /></span>
            </button>
          </li>
        ))}
      </ul>
      </section>)}
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
          <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{nextApplicationStep(detail.status, roles)}</p><section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><h3 className="mb-2 text-sm font-bold">Mục đích đề nghị</h3><p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{detail.purpose || 'Chưa có nội dung đề nghị.'}</p></section>
          {detail.canEdit && (
            <section className="space-y-3 rounded-2xl border border-teal-200 bg-white p-4 dark:border-teal-800 dark:bg-slate-800">
              <h3 className="text-sm font-bold">{detail.status === 'NEED_CORRECTION' ? 'Bổ sung hồ sơ nguồn' : 'Chỉnh sửa bản nháp'}</h3>
              <label className="block space-y-1.5 text-xs font-semibold">Mục đích đề nghị
                <textarea className={fieldClass} value={editForm.purpose} maxLength={2000} onChange={e=>setEditForm({...editForm,purpose:e.target.value})} />
              </label>
              <RecordPicker label="Thành tích đã xác nhận (chọn ít nhất một)" options={editSources.achievements} value={editForm.achievementIds} onChange={achievementIds=>setEditForm({...editForm,achievementIds})} loading={editSources.loading} emptyMessage="Chưa có thành tích đã xác nhận. Hoàn tất xác nhận trước khi nộp." />
              <RecordPicker label="Khen thưởng đã ghi nhận (nếu có)" options={editSources.awardRecords} value={editForm.awardRecordIds} onChange={awardRecordIds=>setEditForm({...editForm,awardRecordIds})} loading={editSources.loading} />
              {editSources.error && <p role="alert" className="text-sm text-rose-600">{editSources.error}</p>}
              <p className="text-xs text-slate-500">Nguồn bị thu hồi không còn trong danh sách. Bỏ chọn nguồn cũ trước khi gửi; mỗi lần gửi lưu một phiên bản dữ liệu mới.</p>
              {(editForm.achievementIds.some(id=>!editSources.achievements.some(a=>String(a.id)===String(id))) || editForm.awardRecordIds.some(id=>!editSources.awardRecords.some(a=>String(a.id)===String(id)))) && !editSources.loading && <button type="button" className="text-sm text-rose-600 underline" onClick={()=>setEditForm({...editForm,achievementIds:editForm.achievementIds.filter(id=>editSources.achievements.some(a=>String(a.id)===String(id))),awardRecordIds:editForm.awardRecordIds.filter(id=>editSources.awardRecords.some(a=>String(a.id)===String(id)))})}>Bỏ các nguồn không còn hợp lệ</button>}
              <button type="button" disabled={busy || editInvalid} className={buttonClass} onClick={()=>run(async()=>{await saveEdits();await refresh(detail.application_id);})}>Lưu chỉnh sửa</button>
            </section>
          )}
          {detail.status === 'DRAFT' && detail.canEdit && (
            <button
              disabled={busy || editInvalid}
              className={buttonClass}
              onClick={() =>
                run(async () => {
                  const saved = await saveEdits();
                  setDetail(await api.detail(detail.application_id));
                  await api.transition(detail.application_id, 'submit', {
                    version: Number(saved.version),
                  });
                  await refresh(detail.application_id);
                })
              }
            >
              Nộp hồ sơ xét duyệt
            </button>
          )}
          {detail.status === 'SUBMITTED' && roles.includes('MANAGER') && (
            <div className="space-y-4 rounded-2xl border border-teal-200 bg-white p-5 dark:border-teal-800 dark:bg-slate-800">
              <h3 className="text-sm font-bold">Kiểm tra và chuyển hồ sơ của đơn vị</h3>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Đơn vị rà soát hồ sơ và ghi nhận xét trước khi chuyển Hội đồng xem xét, kết luận đề nghị khen thưởng.</p>
              <label className="flex flex-col gap-2 text-sm font-semibold">Ý kiến đơn vị
              <input
                aria-label="Ý kiến đơn vị"
                className={fieldClass}
                placeholder="Ý kiến đơn vị bắt buộc"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              </label>
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
          {detail.canEdit && detail.status === 'NEED_CORRECTION' && <section className="space-y-3 rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-slate-800">
            <h3 className="font-bold">Gửi lại hồ sơ đã bổ sung</h3>
            <label className="block space-y-2 text-sm font-semibold">Nội dung đã bổ sung<textarea aria-label="Ý kiến hoặc nội dung bổ sung" className={fieldClass} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Mô tả phần đã chỉnh sửa (ít nhất 5 ký tự)" /></label>
            {transitionButton('resubmit', 'Gửi bổ sung qua đơn vị', reason)}
          </section>}
          {detail.canCouncil && ['COUNCIL_PENDING','UNDER_REVIEW'].includes(detail.status) && roles.includes('COUNCIL') && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="font-bold">Xử lý của Hội đồng</h3>
            <div className="space-y-2 rounded-xl bg-teal-50 p-4 text-sm leading-6 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
              <p><strong>Bước tiếp theo:</strong> {detail.canReview ? 'Bạn đã được giao xét hồ sơ này. Đọc hồ sơ và minh chứng, sau đó ghi ý kiến hoặc kết luận.' : 'Chọn thành viên để giao xét hồ sơ này. Chỉ người đã được giao mới được ghi ý kiến và kết luận.'}</p>
              <p>Phân công áp dụng riêng cho từng hồ sơ, không phải cấp thêm vai trò Hội đồng. Có thể giao nhiều thành viên hoặc giao cho chính bạn nếu đủ điều kiện.</p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Kết luận Hội đồng là đề nghị xét duyệt. Chuyên viên thi đua khen thưởng cần bổ sung quyết định và tệp quyết định trước khi ghi nhận.</p>
            <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><legend className="px-2 text-sm font-bold">1. Phân công người xét</legend>
              <p className="text-sm leading-6 text-slate-500">Chọn người sẽ đọc thành tích, minh chứng và đưa ra ý kiến cho hồ sơ #{detail.application_id}. Người đã được giao hồ sơ này không thể chọn lại.</p>
              <EntitySelect label="Chọn thành viên để giao xét hồ sơ này" options={reviewers.map(r=>({...r,disabled:r.assigned}))} value={reviewerId} onChange={setReviewerId} disabled={reviewersLoading || busy} placeholder={reviewersLoading ? 'Đang tải người xét…' : 'Chọn thành viên Hội đồng'} getLabel={r=>`${r.name} (${r.username})${String(r.id) === String(user?.userId) ? ' · Bạn' : ''}${r.assigned ? ' · Đã được giao hồ sơ này' : ' · Chưa được giao hồ sơ này'}`} className={fieldClass} />
              {reviewersError && <p role="alert" className="text-sm text-rose-600">{reviewersError}</p>}
              {councilInput('assign', 'Nội dung phân công')}
              {transitionButton('assign', 'Lưu phân công', councilReasons.assign)}
            </fieldset>
            <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><legend className="px-2 text-sm font-bold">2. Trao đổi và yêu cầu bổ sung</legend>
              <p className="text-sm leading-6 text-slate-500">Ghi ý kiến để lưu nhận xét. Nếu hồ sơ thiếu thông tin, chọn yêu cầu bổ sung để trả người lập chỉnh sửa và gửi lại qua đơn vị.</p>
              {!detail.canReview && <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Bạn chưa được giao xét hồ sơ này nên chưa thể thực hiện bước 2 và 3.</p>}
              {councilInput('exchange', 'Ý kiến hoặc nội dung yêu cầu bổ sung')}
              <div className="flex flex-wrap gap-2">{transitionButton('comment', 'Ghi ý kiến', councilReasons.exchange)}{transitionButton('request-correction', 'Yêu cầu người lập bổ sung', councilReasons.exchange)}</div>
            </fieldset>
            <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><legend className="px-2 text-sm font-bold">3. Kết luận xét duyệt</legend>
              <p className="text-sm leading-6 text-slate-500">Sau khi xem đủ hồ sơ và minh chứng, ghi căn cứ rồi chọn một kết luận. Bước này kết thúc việc xét của Hội đồng.</p>
              {councilInput('conclusion', 'Căn cứ cho kết luận xét duyệt')}
              <p className="text-xs text-slate-500 dark:text-slate-400">Nội dung này sẽ được lưu cùng kết luận bạn chọn bên dưới.</p>
              <div className="flex flex-wrap gap-2">{transitionButton('recommend', 'Đề nghị khen thưởng', councilReasons.conclusion)}{transitionButton('not-recommend', 'Không đề nghị', councilReasons.conclusion)}</div>
            </fieldset>
          </section>}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><MessageSquare className="h-4 w-4 text-teal-500" />Phân công và ý kiến</h3><div className="space-y-3">{(detail.reviews || []).map(r => <div key={r.review_id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-900/60"><UserRound className="h-4 w-4 text-slate-400" /><p>Người xét <strong>{r.reviewer_name || 'Thành viên Hội đồng'}</strong> · Được giao bởi {r.assigned_by_name || 'Người phân công'}</p></div>)}{(detail.comments || []).map(c => <div key={c.comment_id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60"><p className="mb-1 text-xs text-slate-400">{c.actor_name || 'Người ghi ý kiến'} · {actionLabels[c.action] || c.action}</p><p className="text-sm leading-relaxed">{c.content}</p></div>)}{!detail.reviews?.length && !detail.comments?.length && <p className="text-sm text-slate-400">Chưa có phân công hoặc ý kiến.</p>}</div></section>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><h3 className="mb-4 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4 text-teal-500" />Lịch sử xử lý</h3><ol className="space-y-4">{(detail.histories || []).map(h => <li key={h.history_id} className="flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-500 dark:bg-teal-950/50"><Clock className="h-3.5 w-3.5" /></span><div><p className="text-sm font-semibold">{statuses[h.from_status] || 'Khởi tạo'} → {statuses[h.to_status] || h.to_status}</p>{h.reason && <p className="mt-1 text-sm text-slate-500">{h.reason}</p>}<time className="mt-1 block text-xs text-slate-400">{formatDate(h.created_at)}</time></div></li>)}{!detail.histories?.length && <li className="text-sm text-slate-400">Chưa có lịch sử xử lý.</li>}</ol></section>
          {detail.input && (
            <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <summary className="cursor-pointer text-sm font-semibold text-teal-700 dark:text-teal-300">Dữ liệu hồ sơ tại thời điểm nộp — phiên bản {detail.input.input_version}</summary>
              <ApplicationSnapshot snapshot={detail.input.snapshot}/>
            </details>
          )}
          </div>
        </article>
        </div>
      )}
    </section>
  );
}
