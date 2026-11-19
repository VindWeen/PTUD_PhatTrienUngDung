import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Modal from '../components/common/VaultDialog';
import NumberedPagination from '../components/common/NumberedPagination';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { api, array } from '../services/vaultApi';
import { useCollection } from '../hooks/useCollection';
import { useLoad } from '../hooks/useLoad';
import { Page } from '../components/common/VaultPage';
import { ErrorMessage, Field, Empty, Load, DateText, StatusBadge, displayLabel } from '../components/common/VaultPrimitives';
import { input, button, secondary, panel } from '../components/common/vaultStyles';
import { localDay } from '../components/calendar/calendarDates';

export function Goals() {
  const [params, setParams] = useSearchParams();
  const requestedGoal = params.get('goal');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const state = useLoad(`/kpi/goals?page=${page}`);
  const [form, setForm] = useState({ title: '', target_value: '1', measure_unit: '', due_date: '' });
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [progress, setProgress] = useState('');
  const [task, setTask] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const detailRequest = useRef(0);

  const lecturerPresets = [
    { label: '01 Bài báo Scopus/WoS', title: 'Xuất bản 01 bài báo quốc tế uy tín (Scopus/WoS Q1-Q4)', target: 1, unit: 'bài báo' },
    { label: '02 Bài báo Tạp chí HĐGSNN', title: 'Xuất bản 02 bài báo tạp chí chuyên ngành tính điểm', target: 2, unit: 'bài báo' },
    { label: '01 Đề tài NCKH cấp Trường', title: 'Chủ nhiệm 01 đề tài NCKH cấp cơ sở nghiệm thu đạt', target: 1, unit: 'đề tài' },
    { label: '350 Giờ chuẩn giảng dạy', title: 'Hoàn thành định mức 350 giờ chuẩn giảng dạy trong năm học', target: 350, unit: 'giờ chuẩn' },
    { label: 'Hướng dẫn 02 Khóa luận TN', title: 'Hướng dẫn 02 sinh viên làm khóa luận tốt nghiệp / NCKH', target: 2, unit: 'sinh viên' },
  ];

  const totalPages = state.data?.total != null
    ? Math.max(1, Math.ceil(state.data.total / (state.data.pageSize || 20)))
    : 1;

  const goalList = array(state.data);
  const today = localDay();
  const dueSoonDays = 30;

  const getDaysLeft = (dueDate) => {
    if (!dueDate) return null;
    const diffTime = new Date(dueDate) - new Date(today);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const dueSoonCount = goalList.filter(g => {
    const d = getDaysLeft(g.due_date);
    return d !== null && d >= 0 && d <= dueSoonDays && !['COMPLETED', 'CANCELLED'].includes(g.status);
  }).length;

  const overdueCount = goalList.filter(g => {
    const d = getDaysLeft(g.due_date);
    return d !== null && d < 0 && !['COMPLETED', 'CANCELLED'].includes(g.status);
  }).length;

  const completedCount = goalList.filter(g => g.status === 'COMPLETED' || (Number(g.completion_percent) >= 100)).length;

  const open = useCallback(async id => {
    const requestId = ++detailRequest.current;
    try {
      setError(null);
      setConfirmDelete(false);
      setDetail(old => String(old?.id) === String(id) ? old : null);
      setSelected(id);
      const goal = await api('/kpi/goals/' + id);
      if (requestId === detailRequest.current) setDetail(goal);
    } catch (err) {
      if (requestId === detailRequest.current) {
        setError(err.status === 404 ? new Error('Mục tiêu này không còn trong danh sách của bạn.') : err);
      }
    }
  }, []);

  function closeGoal() {
    detailRequest.current++;
    setSelected(null); setDetail(null); setConfirmDelete(false); setError(null);
    if (requestedGoal) {
      const next = new URLSearchParams(params);
      next.delete('goal');
      setParams(next, { replace: true });
    }
  }

  async function deleteGoal() {
    if (deleting || !detail || !confirmDelete) return;
    setDeleting(true); setError(null); setNotice('');
    try {
      try { await api('/kpi/goals/' + detail.id, 'DELETE'); }
      catch (err) { if (err.status !== 404) throw err; }
      closeGoal();
      setNotice('Đã xóa mục tiêu KPI.');
      if (page > 1 && goalList.length <= 1) setPage(page - 1);
      else await state.reload();
    } catch (err) { setError(err); }
    finally { setDeleting(false); }
  }

  useEffect(() => {
    if (/^\d+$/.test(requestedGoal || '')) open(requestedGoal);
  }, [requestedGoal, open]);

  async function create(e) {
    e.preventDefault();
    try {
      await api('/kpi/goals', 'POST', {
        ...form,
        target_value: Number(form.target_value),
        due_date: form.due_date || null
      });
      setForm({ title: '', target_value: '1', measure_unit: '', due_date: '' });
      setShowForm(false);
      await state.reload();
    } catch (err) {
      setError(err);
    }
  }

  const addButton = (
    <button type="button" className={button} onClick={() => { setError(null); setShowForm(true); }}>
      <Plus size={16} aria-hidden="true" />
      <span>Tạo mục tiêu mới</span>
    </button>
  );

  return (
    <Page title="Mục tiêu / KPI" description="Theo dõi định mức nghiên cứu khoa học, giờ giảng dạy và nhiệm vụ năm học của giảng viên." actions={addButton}>
      <ErrorMessage error={error} />
      {notice && <p role="status" className="vault-meta">{notice}</p>}

      <div className="vault-summary" aria-label="Tóm tắt mục tiêu">
        <span><strong>{state.data?.total ?? goalList.length}</strong> mục tiêu</span>
        <span className="vault-meta">Trên trang này</span>
        <span><strong>{dueSoonCount}</strong> sắp đến hạn</span>
        <span><strong>{overdueCount}</strong> quá hạn</span>
        <span><strong>{completedCount}</strong> hoàn thành</span>
      </div>

      <section className={panel}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Danh sách mục tiêu cá nhân</h2>
            <p className="text-xs text-slate-500">Tiến độ được cập nhật dựa trên giá trị nhập và các thành tích đã liên kết.</p>
          </div>
        </div>

        <Load state={state}>
          {!array(state.data).length ? (
            <Empty action={addButton}>
              Chưa có mục tiêu. Tạo mục tiêu hoặc bổ sung từ kết quả đối chiếu.
            </Empty>
          ) : (
            <>
              {/* Bảng danh sách mục tiêu có tiêu đề cột rõ ràng */}
              <div className="vault-table-wrap">
                <table className="vault-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '35%' }}>Tên mục tiêu & Nguồn</th>
                      <th scope="col">Thời hạn hoàn thành</th>
                      <th scope="col">Thực tế / Chỉ tiêu</th>
                      <th scope="col" style={{ width: '22%' }}>Tiến độ (%)</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col" className="text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {array(state.data).map(item => {
                      const percent = Math.min(100, Math.max(0, Number(item.completion_percent) || 0));
                      const daysLeft = getDaysLeft(item.due_date);
                      const isOverdue = daysLeft !== null && daysLeft < 0 && !['COMPLETED', 'CANCELLED'].includes(item.status);
                      const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= dueSoonDays && !['COMPLETED', 'CANCELLED'].includes(item.status);

                      return (
                        <tr key={item.id} className="vault-goal-table-row">
                          <td>
                            <button
                              type="button"
                              className="font-bold text-slate-800 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-300 text-left transition-colors"
                              onClick={() => open(item.id)}
                            >
                              {item.title}
                            </button>
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              {item.source_result_id ? 'Tạo từ khoảng trống quy chế AI' : 'Mục tiêu định mức cá nhân'}
                            </span>
                          </td>
                          <td className="text-xs">
                            {item.due_date ? (
                              <div className="space-y-0.5">
                                <span className={isOverdue ? 'text-rose-600 font-bold' : isDueSoon ? 'text-amber-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                                  <DateText value={item.due_date} />
                                </span>
                                {isOverdue && (
                                  <span className="block text-[10px] text-rose-600 font-semibold">Đã quá hạn</span>
                                )}
                                {isDueSoon && (
                                  <span className="block text-[10px] text-amber-600 font-semibold">Còn {daysLeft} ngày</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Không đặt hạn</span>
                            )}
                          </td>
                          <td className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <strong>{item.current_value ?? 0}</strong> / {item.target_value} {item.measure_unit}
                          </td>
                          <td>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                                <span>{percent}%</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-700">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${percent >= 100 ? 'bg-emerald-500' : 'bg-teal-600'}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            <StatusBadge value={item.status} />
                          </td>
                          <td className="text-center">
                            <button
                              className="soft-btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1"
                              onClick={() => open(item.id)}
                            >
                              <span>Chi tiết</span>
                              <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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

      {/* Modal Tạo mục tiêu mới kèm Gợi ý mẫu Giảng viên */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Tạo mục tiêu">
        <form onSubmit={create} className="space-y-4">
          <ErrorMessage error={error} />

          {/* Gợi ý mục tiêu nhanh chuẩn Giảng viên */}
          <div className="p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 space-y-2">
            <span className="text-xs font-bold text-teal-800 dark:text-teal-300 block">
              Gợi ý định mức chuẩn Giảng viên (Bấm để điền nhanh):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {lecturerPresets.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setForm({
                    ...form,
                    title: preset.title,
                    target_value: String(preset.target),
                    measure_unit: preset.unit,
                  })}
                  className="min-h-11 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 hover:border-teal-600 text-teal-900 dark:text-teal-200 hover:bg-teal-50 transition-all shadow-2xs"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Tên mục tiêu *">
            <input required className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ví dụ: Xuất bản 01 bài báo quốc tế (Scopus/WoS), 350 giờ chuẩn giảng dạy..." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Chỉ tiêu cần đạt *">
              <input required type="number" min="0.01" step="any" className={input} value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} />
            </Field>
            <Field label="Đơn vị tính *">
              <input required className={input} value={form.measure_unit} onChange={e => setForm({ ...form, measure_unit: e.target.value })} placeholder="bài báo, giờ chuẩn, đề tài..." />
            </Field>
            <Field label="Hạn hoàn thành">
              <input type="date" className={input} value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" className={secondary} onClick={() => setShowForm(false)}>Hủy</button>
            <button className={button}>Lưu mục tiêu</button>
          </div>
        </form>
      </Modal>

      {/* Modal Chi tiết mục tiêu (Đã phân 3 khu vực rõ ràng) */}
      <Modal open={selected !== null && !!detail} onClose={() => { if (!deleting) closeGoal(); }} title={detail?.title || 'Chi tiết mục tiêu KPI'}>
        <ErrorMessage error={error} />
        {detail && (confirmDelete ? <section className="space-y-4" aria-label="Xác nhận xóa mục tiêu">
          <h3 className="text-lg font-semibold">Xóa mục tiêu này?</h3>
          <p>Tiến độ và việc cần làm sẽ không còn truy cập được từ danh sách KPI. Hiện chưa có nút khôi phục.</p>
          <p className="vault-meta">Thành tích, minh chứng, kết quả đối chiếu và sự kiện lịch vẫn còn. Sự kiện lịch sẽ được gỡ liên kết với KPI này.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} disabled={deleting} onClick={() => { setConfirmDelete(false); setError(null); }}>Giữ mục tiêu</button>
            <button type="button" className="soft-btn-danger" disabled={deleting} onClick={deleteGoal}>{deleting ? 'Đang xóa…' : 'Xóa mục tiêu'}</button>
          </div>
        </section> :
          <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
            {/* Khu vực 1: Tiến độ thực tế & Cập nhật */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    Tiến độ thực hiện
                  </h3>
                  <p className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                    {detail.current_value ?? 0} / {detail.target_value} {detail.measure_unit} ({Math.min(100, Math.round(Number(detail.completion_percent) || 0))}%)
                  </p>
                </div>
                <StatusBadge value={detail.status} />
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, Number(detail.completion_percent) || 0))}%` }}
                />
              </div>

              {/* Form cập nhật số lượng tiến độ */}
              <form
                className="flex items-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700"
                onSubmit={async e => {
                  e.preventDefault();
                  try {
                    await api(`/kpi/goals/${detail.id}/progress`, 'POST', { current_value: Number(progress) });
                    setProgress('');
                    await open(detail.id);
                    await state.reload();
                  } catch (err) {
                    setError(err);
                  }
                }}
              >
                <div className="flex-1">
                  <Field label="Ghi nhận giá trị tiến độ mới">
                    <input
                      required
                      type="number"
                      step="any"
                      className={input}
                      placeholder={`Nhập giá trị (${detail.measure_unit})...`}
                      value={progress}
                      onChange={e => setProgress(e.target.value)}
                    />
                  </Field>
                </div>
                <button className={button}>Lưu tiến độ</button>
              </form>
            </div>

            {/* Khu vực 2: Danh sách việc cần làm (Checklist tương tác) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                Kế hoạch công việc (Checklist)
              </h3>

              <div className="space-y-1.5">
                {!(detail.tasks || []).length ? (
                  <p className="text-xs text-slate-400 italic">Chưa có công việc nào trong danh sách.</p>
                ) : (
                  detail.tasks.map(t => {
                    const isDone = t.status === 'DONE';
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-2.5 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          isDone ? 'bg-slate-50 text-slate-400 line-through' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded text-teal-600"
                          checked={isDone}
                          onChange={async e => {
                            try {
                              await api(`/kpi/goals/${detail.id}/tasks/${t.id}`, 'PATCH', { status: e.target.checked ? 'DONE' : 'TODO' });
                              await open(detail.id);
                            } catch (err) {
                              setError(err);
                            }
                          }}
                        />
                        <span className="flex-1">{t.title}</span>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Form thêm việc cần làm */}
              <form
                className="flex items-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700"
                onSubmit={async e => {
                  e.preventDefault();
                  try {
                    await api(`/kpi/goals/${detail.id}/tasks`, 'POST', { title: task });
                    setTask('');
                    await open(detail.id);
                  } catch (err) {
                    setError(err);
                  }
                }}
              >
                <div className="flex-1">
                  <Field label="Thêm đầu việc mới">
                    <input
                      required
                      className={input}
                      placeholder="Nội dung việc cần làm..."
                      value={task}
                      onChange={e => setTask(e.target.value)}
                    />
                  </Field>
                </div>
                <button className={secondary}>Thêm việc</button>
              </form>
            </div>

            {/* Khu vực 3: Thành tích hỗ trợ liên kết & Trạng thái */}
            <GoalCompletion
              key={detail.id}
              detail={detail}
              onReload={async () => {
                await open(detail.id);
                await state.reload();
              }}
            />
            <button type="button" className="soft-btn-danger" onClick={() => { setConfirmDelete(true); setError(null); }}><Trash2 size={15} aria-hidden="true" /> Xóa mục tiêu</button>
          </div>
        )}
      </Modal>
    </Page>
  );
}

function GoalCompletion({ detail, onReload }) {
  const achievements = useCollection('/achievements');
  const [error, setError] = useState(null), [busy, setBusy] = useState(false);

  async function submit(event, kind) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const fields = new FormData(event.currentTarget);
    try {
      if (kind === 'status') {
        await api('/kpi/goals/' + detail.id, 'PATCH', { status: fields.get('status') });
      } else {
        await api('/kpi/goals/' + detail.id + '/achievements', 'POST', {
          achievement_id: Number(fields.get('achievement')),
          contribution_value: Number(fields.get('contribution'))
        });
      }
      await onReload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
        Liên kết minh chứng & Cập nhật trạng thái
      </h3>
      <ErrorMessage error={error} />

      {/* Form trạng thái */}
      <form onSubmit={event => submit(event, 'status')} className="flex flex-wrap items-end gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex-1 min-w-[200px]">
          <Field label="Trạng thái mục tiêu">
            <select className={input} name="status" defaultValue={detail.status} disabled={busy}>
              {['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(status => (
                <option key={status} value={status}>{displayLabel(status)}</option>
              ))}
            </select>
          </Field>
        </div>
        <button className={secondary} disabled={busy}>Lưu trạng thái</button>
      </form>

      {/* Danh sách thành tích đã liên kết */}
      <div>
        <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          Thành tích đã liên kết làm căn cứ:
        </span>
        {!(detail.achievements || []).length ? (
          <p className="text-xs text-slate-400 italic">Chưa liên kết thành tích nào từ kho.</p>
        ) : (
          <div className="space-y-1 mb-3">
            {detail.achievements.map(item => (
              <div key={item.achievement_id} className="flex items-center justify-between p-2 rounded-lg bg-teal-50/50 text-xs text-teal-900 border border-teal-200/50">
                <span className="font-semibold truncate">{item.title}</span>
                <span className="shrink-0 font-bold ml-2">+{item.contribution_value} {detail.measure_unit}</span>
              </div>
            ))}
          </div>
        )}

        {/* Form liên kết thêm thành tích */}
        <Load state={achievements}>
          <form onSubmit={event => submit(event, 'achievement')} className="flex flex-wrap items-end gap-2 pt-2">
            <div className="flex-1 min-w-[180px]">
              <Field label="Thêm thành tích hỗ trợ">
                <select className={input} name="achievement" required disabled={busy} defaultValue="">
                  <option value="">Chọn thành tích trong kho...</option>
                  {array(achievements.data)
                    .filter(item => !(detail.achievements || []).some(link => link.achievement_id === item.id))
                    .map(item => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                </select>
              </Field>
            </div>
            <div className="w-24">
              <Field label="Đóng góp">
                <input name="contribution" type="number" required min="0.01" step="any" className={input} defaultValue="1" disabled={busy} />
              </Field>
            </div>
            <button className={secondary} disabled={busy}>Gắn kết</button>
          </form>
        </Load>
      </div>
    </div>
  );
}
