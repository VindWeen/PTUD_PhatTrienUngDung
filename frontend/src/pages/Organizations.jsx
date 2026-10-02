import React, { useCallback, useEffect, useState } from 'react';
import { Building2, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/common/AsyncState';
import { organizationsApi } from '../services/organizationsApi';

export default function Organizations() {
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN');
  const [units, setUnits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await organizationsApi.list();
      setUnits(list || []);
      if (list?.length) setSelected(await organizationsApi.getProfile(list[0].unitId));
    } catch (e) { setError(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const choose = async (id) => {
    setBusy(true); setError(null);
    try { setSelected(await organizationsApi.getProfile(id)); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected || !window.confirm(`Xóa đơn vị ${selected.name}?`)) return;
    setBusy(true); setError(null);
    try { await organizationsApi.remove(selected.unitId); setSelected(null); await load(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const createUnit = async () => {
    const code = window.prompt('Mã đơn vị mới');
    if (!code) return;
    const name = window.prompt('Tên đơn vị mới');
    if (!name) return;
    const type = window.prompt('Loại: FACULTY, DEPARTMENT, DIVISION, OFFICE, CENTER hoặc UNIVERSITY', 'DEPARTMENT');
    if (!type) return;
    setBusy(true); setError(null);
    try { await organizationsApi.create({ code, name, type, parentId: selected?.unitId || null, description: null }); await load(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const editUnit = async () => {
    const name = window.prompt('Tên đơn vị', selected.name);
    if (!name) return;
    const description = window.prompt('Mô tả hồ sơ đơn vị', selected.description || '');
    setBusy(true); setError(null);
    try {
      const updated = await organizationsApi.update(selected.unitId, { code: selected.code, name, type: selected.type,
        parentId: selected.parentUnit?.unitId || null, description: description || null, isActive: selected.isActive, version: selected.version });
      await load(); setSelected(await organizationsApi.getProfile(updated.unitId));
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const appoint = async () => {
    const userId = Number(window.prompt('User ID của đại diện mới'));
    if (!Number.isInteger(userId) || userId <= 0) return;
    const end = window.prompt('Ngày kết thúc đại diện (YYYY-MM-DD); thu hồi phân công cũ ở trang Quản trị nếu bị chồng lấn');
    if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end) || Number.isNaN(Date.parse(end))) return;
    setBusy(true); setError(null);
    try { await organizationsApi.appointRepresentative(selected.unitId, { userId, validFrom: new Date().toISOString(), validTo: new Date(`${end}T23:59:59+07:00`).toISOString() }); setSelected(await organizationsApi.getProfile(selected.unitId)); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const transfer = async () => {
    const lecturerId = Number(window.prompt('Lecturer ID cần chuyển vào đơn vị này'));
    if (!Number.isInteger(lecturerId) || lecturerId <= 0) return;
    setBusy(true); setError(null);
    try { await organizationsApi.transferLecturer(lecturerId, { unitId: selected.unitId, effectiveAt: new Date().toISOString() }); setSelected(await organizationsApi.getProfile(selected.unitId)); } catch (e) { setError(e); } finally { setBusy(false); }
  };

  if (loading) return <LoadingState label="Đang tải cơ cấu tổ chức..." />;
  if (error && !units.length) return <ErrorState error={error} onRetry={load} />;
  if (!units.length) return <EmptyState message="Chưa có đơn vị tổ chức." />;

  return <div className="space-y-6">
    <header className="flex items-center justify-between">
      <div><h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Tổ chức & Tập thể</h1><p className="text-sm text-slate-500 mt-1">Hồ sơ đơn vị, đại diện và cơ cấu trực thuộc</p></div>
      <div className="flex gap-2">{canManage && <button onClick={createUnit} className="px-4 py-2 rounded-xl bg-emerald-600 text-white">Tạo đơn vị</button>}<button onClick={load} className="soft-btn-primary flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Làm mới</button></div>
    </header>
    {error && <ErrorState error={error} onRetry={() => setError(null)} />}
    <div className="grid lg:grid-cols-3 gap-6">
      <section className="soft-card p-5 space-y-2">
        <h2 className="font-bold mb-3">Danh sách đơn vị</h2>
        {units.map((unit) => <button key={unit.unitId} onClick={() => choose(unit.unitId)} className={`w-full text-left p-3 rounded-xl border ${selected?.unitId === unit.unitId ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
          <span className="flex items-center gap-2 font-semibold"><Building2 className="w-4 h-4" />{unit.name}</span><span className="text-xs text-slate-500">{unit.code} · {unit.type}</span>
        </button>)}
      </section>
      <section className="soft-card p-6 lg:col-span-2">
        {busy ? <LoadingState label="Đang tải hồ sơ đơn vị..." /> : selected ? <div className="space-y-5">
          <div className="flex justify-between gap-3"><div><h2 className="text-xl font-bold">{selected.name}</h2><p className="text-sm text-slate-500">{selected.code} · {selected.type}</p></div>{canManage && <div className="flex flex-wrap justify-end gap-2"><button onClick={editUnit} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800">Sửa</button><button onClick={remove} disabled={busy} className="px-3 py-2 rounded-xl text-rose-600 bg-rose-50 flex items-center gap-2"><Trash2 className="w-4 h-4" />Xóa</button></div>}</div>
          <p className="text-sm">{selected.description || 'Chưa có mô tả hồ sơ đơn vị.'}</p>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Đơn vị cha</dt><dd className="font-semibold">{selected.parentUnit?.name || 'Không có'}</dd></div><div><dt className="text-slate-500">Số giảng viên hiện tại</dt><dd className="font-semibold">{selected.lecturersCount ?? 0}</dd></div><div><dt className="text-slate-500">Đại diện hiện tại</dt><dd className="font-semibold">{selected.representative?.displayName || 'Chưa phân công'}</dd></div><div><dt className="text-slate-500">Thành tích xác nhận</dt><dd className="font-semibold">{selected.stats?.verifiedAchievements ?? 0}</dd></div></dl>
          {canManage && <div className="flex flex-wrap gap-2 border-t pt-4"><button onClick={appoint} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700">Phân công đại diện</button><button onClick={transfer} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700">Chuyển giảng viên vào đơn vị</button></div>}
          {!canManage && <p className="text-xs text-slate-500 border-t pt-4">Chỉ quản trị viên được thay đổi cơ cấu, đại diện hoặc điều chuyển công tác.</p>}
        </div> : <EmptyState message="Chọn một đơn vị để xem hồ sơ." />}
      </section>
    </div>
  </div>;
}
