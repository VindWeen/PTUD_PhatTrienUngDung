import React, { useEffect, useState } from 'react';
import { applicationsApi as api } from '../services/applicationsApi';
import { useAuth } from '../context/AuthContext';

export default function AwardApplications() {
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));
  const applicant = roles.some((r) => ['LECTURER', 'UNIT_REPRESENTATIVE'].includes(r));
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
  const input = (name, label, type = 'text', required = true) => (
    <label className="flex flex-col gap-1">
      {label}
      <input
        className="border rounded p-2 text-slate-900"
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
      setMessage('Đã tạo nháp. Khi nộp, hệ thống kiểm tra input và đóng băng phiên bản.');
    });
  };
  return (
    <section className="p-4 space-y-5">
      <h1 className="text-2xl font-bold">Hồ sơ đề nghị khen thưởng</h1>
      <p>
        Đơn vị → Hội đồng. Hồ sơ đề nghị không tạo quyết định khen thưởng. Trang này dùng API thật;
        chưa đánh giá tiêu chí hay KPI bằng AI.
      </p>
      {message && (
        <p role="status" className="bg-amber-100 text-slate-900 rounded p-3">
          {message}
        </p>
      )}
      {roles.includes('RECORDS_OFFICER') && (
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.cycle(cycle);
              setCycles(await api.cycles());
              setMessage('Đã mở kỳ đề nghị.');
            });
          }}
        >
          {['code', 'name', 'startDate', 'endDate'].map((k, i) => (
            <label key={k}>
              {['Mã kỳ', 'Tên kỳ', 'Bắt đầu', 'Kết thúc'][i]}
              <input
                required
                className="block border p-2 text-slate-900"
                type={i > 1 ? 'date' : 'text'}
                value={cycle[k] || ''}
                onChange={(e) => setCycle({ ...cycle, [k]: e.target.value })}
              />
            </label>
          ))}
          <button disabled={busy}>Mở kỳ</button>
        </form>
      )}
      {applicant && (
        <form onSubmit={create} className="grid md:grid-cols-2 gap-4">
          <label>
            Chủ thể
            <select
              className="block border p-2 text-slate-900"
              value={form.subjectType}
              onChange={(e) => setForm({ ...form, subjectType: e.target.value })}
            >
              <option value="LECTURER">Cá nhân của tôi</option>
              <option value="UNIT">Tập thể tôi đại diện</option>
            </select>
          </label>
          {input('subjectId', 'Mã giảng viên / đơn vị', 'number')}
          <label>
            Kỳ đề nghị
            <select
              required
              className="block border p-2 text-slate-900"
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
          {input('achievementIds', 'Mã thành tích VERIFIED, phân cách dấu phẩy')}
          {input('awardRecordIds', 'Mã khen thưởng RECORDED (nếu có)', 'text', false)}
          <button disabled={busy} className="rounded bg-blue-700 text-white p-2">
            Tạo hồ sơ nháp
          </button>
        </form>
      )}
      <div className="flex gap-3">
        <input
          aria-label="Mã đơn vị xem hồ sơ"
          className="border p-2 text-slate-900"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Mã đơn vị: hàng chờ đơn vị / Hội đồng"
        />
        <button
          disabled={busy}
          onClick={() => run(async () => setItems((await api.list(unit)).items))}
        >
          Tải danh sách
        </button>
      </div>
      <ul>
        {items.map((r) => (
          <li key={r.application_id}>
            <button
              disabled={busy}
              onClick={() => run(async () => setDetail(await api.detail(r.application_id)))}
            >
              #{r.application_id} — mục tiêu {r.target_award_type_id} — kỳ {r.award_period_id} —{' '}
              {r.status}
            </button>
          </li>
        ))}
      </ul>
      {detail && (
        <article className="border rounded p-4 space-y-3">
          <h2 className="font-bold">
            Đề nghị #{detail.application_id} — {detail.status} — v{detail.version}
          </h2>
          <p>{detail.purpose}</p>
          {detail.status === 'DRAFT' && applicant && (
            <button
              disabled={busy}
              className="bg-blue-700 text-white p-2 rounded"
              onClick={() =>
                run(async () => {
                  await api.transition(detail.application_id, 'submit', {
                    version: Number(detail.version),
                  });
                  await refresh(detail.application_id);
                })
              }
            >
              Nộp và đóng băng input
            </button>
          )}
          {detail.status === 'SUBMITTED' && roles.includes('MANAGER') && (
            <div>
              <input
                aria-label="Ý kiến đơn vị"
                className="border p-2 text-slate-900"
                placeholder="Ý kiến đơn vị bắt buộc"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
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
                className="border p-2 text-slate-900 w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ý kiến / bổ sung / căn cứ kết luận (ít nhất 5 ký tự)"
              />
              {roles.includes('COUNCIL') && (
                <input
                  aria-label="Mã người xét"
                  type="number"
                  className="border p-2 text-slate-900"
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
                  className="border rounded p-2 mr-2"
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
              <summary>Input đã đóng băng — phiên bản {detail.input.input_version}</summary>
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
