import PageHeader from '../components/common/PageHeader';
import React, { useEffect, useState } from 'react';
import { applicationsApi as api } from '../services/applicationsApi';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, FileText, Plus } from 'lucide-react';
import { LoadingState } from '../components/common/AsyncState';

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50';
const statuses = { DRAFT: 'Bản nháp', SUBMITTED: 'Đã nộp', COUNCIL_PENDING: 'Chờ Hội đồng', UNDER_REVIEW: 'Đang xét duyệt', NEED_CORRECTION: 'Cần bổ sung', RECOMMENDED: 'Đề nghị khen thưởng', NOT_RECOMMENDED: 'Không đề nghị', CANCELLED: 'Đã hủy' };

export default function AwardApplications() {
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));
  const applicant = roles.some((r) => ['LECTURER', 'UNIT_REPRESENTATIVE'].includes(r));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ subjectType: 'LECTURER' });
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
    api.list().then((out) => { if (active) { setItems(out.items || []); setListLoaded(true); } })
      .catch((e) => { if (active) setMessage(e.message); })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, []);
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
    setItems((await api.list(unit)).items);
  };
  const create = (e) => {
    e.preventDefault();
    run(async () => {
      const ids = (v) =>
        (v || '')
          .split(',')
          .filter((s) => s.trim())
          .map(Number);
      const r = await api.create({
        [form.subjectType === 'LECTURER' ? 'lecturerId' : 'organizationUnitId']: Number(
          form.subjectId
        ),
        cycleId: Number(form.cycleId),
        targetAwardTypeId: Number(form.targetAwardTypeId),
        purpose: form.purpose,
        achievementIds: ids(form.achievementIds),
        awardRecordIds: ids(form.awardRecordIds),
      });
      await refresh(r.application_id);
      setMessage('Đã tạo hồ sơ nháp. Hãy kiểm tra thông tin trước khi nộp xét duyệt.');
    });
  };
  const reloadList = () => run(async () => {
    setListLoading(true);
    try {
      const [out, periods] = await Promise.all([api.list(unit, true), api.cycles(true)]);
      setItems(out.items || []); setListLoaded(true); setCycles(periods);
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
            <select
              className={fieldClass}
              value={form.subjectType}
              onChange={(e) => setForm({ ...form, subjectType: e.target.value })}
            >
              <option value="LECTURER">Cá nhân của tôi</option>
              <option value="UNIT">Tập thể tôi đại diện</option>
            </select>
          </label>
          {input('subjectId', 'Mã giảng viên / đơn vị', 'number')}
          <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Kỳ đề nghị
            <select
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
            </select>
          </label>
          {input('targetAwardTypeId', 'Mã mục tiêu khen thưởng', 'number')}
          {input('purpose', 'Mục đích đề nghị')}
          {input('achievementIds', 'Mã thành tích đã xác nhận, phân cách dấu phẩy')}
          {input('awardRecordIds', 'Mã khen thưởng đã ghi nhận (nếu có)', 'text', false)}
          <button disabled={busy} className={`${buttonClass} self-end justify-self-start`}>
            Tạo hồ sơ nháp
          </button>
        </form>
      )}
      <div className="soft-card p-5 space-y-4">
      <h2 className="text-lg font-bold">Danh sách hồ sơ</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          aria-label="Mã đơn vị xem hồ sơ"
          className={fieldClass}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Mã đơn vị: hàng chờ đơn vị / Hội đồng"
        />

      </div>
      {listLoading && <LoadingState label="Đang tải hồ sơ đề nghị..." rows={3} />}
      {!listLoading && listLoaded && !items.length && <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Chưa có hồ sơ đề nghị trong danh sách này.</p>}
      <ul className="space-y-3">
        {!listLoading && items.map((r) => (
          <li key={r.application_id} className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
            <button
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-teal-50/50 dark:hover:bg-teal-950/20 rounded-2xl transition"
              disabled={busy}
              onClick={() => run(async () => setDetail(await api.detail(r.application_id)))}
            >
              <span><strong>Hồ sơ #{r.application_id}</strong><span className="block mt-1 text-xs text-slate-500">Mục tiêu #{r.target_award_type_id} · Kỳ #{r.award_period_id}</span></span>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">{statuses[r.status] || r.status}</span>
            </button>
          </li>
        ))}
      </ul>
      </div>
      {detail && (
        <article className="soft-card p-6 space-y-5">
          <h2 className="font-bold">
            Đề nghị #{detail.application_id} — {statuses[detail.status] || detail.status} — v{detail.version}
          </h2>
          <p>{detail.purpose}</p>
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
              {roles.includes('COUNCIL') && (
                <input
                  aria-label="Mã người xét"
                  type="number"
                  className={fieldClass}
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                  placeholder="Mã Hội đồng được phân công"
                />
              )}
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
                  className={`${buttonClass} mr-2 mb-2`}
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
          <h3>Phân công và ý kiến</h3>
          {(detail.reviews || []).map((r) => (
            <p key={r.review_id}>
              Người xét #{r.reviewer_id} — giao bởi #{r.assigned_by}
            </p>
          ))}
          {(detail.comments || []).map((c) => (
            <p key={c.comment_id}>
              #{c.actor_id} — {c.action}: {c.content}
            </p>
          ))}

          <h3>Lịch sử</h3>
          <ul>
            {detail.histories.map((h) => (
              <li key={h.history_id}>
                {h.from_status || 'Khởi tạo'} → {h.to_status} — {h.reason} — {h.created_at}
              </li>
            ))}
          </ul>
          {detail.input && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-teal-700 dark:text-teal-300">Dữ liệu hồ sơ tại thời điểm nộp — phiên bản {detail.input.input_version}</summary>
              <pre className="overflow-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(detail.input.snapshot, null, 2)}
              </pre>
            </details>
          )}
        </article>
      )}
    </section>
  );
}
