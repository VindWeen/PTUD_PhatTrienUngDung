import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, FileText, Plus, X } from 'lucide-react';
import { evidencesApi } from '../services/evidencesApi';
import { LoadingState } from './common/AsyncState';

export default function PortfolioAchievementDialog({ achievement, statusLabel, onClose, onEvidenceSaved }) {
  const dialog = useRef(null);
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [revision, setRevision] = useState(0);
  const [upload, setUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const dirty = upload && Boolean(title || file);

  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      node.close(); document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    evidencesApi.getEvidencesByAchievement(achievement.achievementId)
      .then(rows => { if (active) setEvidences(rows || []); })
      .catch(error => { if (active) setLoadError(error.message || 'Không tải được minh chứng.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [achievement.achievementId, revision]);

  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const allowDiscard = () => !saving && (!dirty || window.confirm('Bạn đang thêm minh chứng chưa lưu. Bỏ nội dung này?'));
  const close = () => { if (allowDiscard()) onClose(); };
  const cancelUpload = () => {
    if (!allowDiscard()) return;
    setUpload(false); setTitle(''); setFile(null); setWriteError('');
  };
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!title.trim()) { setWriteError('Vui lòng nhập tên minh chứng.'); return; }
    setSaving(true); setWriteError(''); setSuccess('');
    try {
      await evidencesApi.createEvidence(achievement.achievementId, { title: title.trim(), file });
      setUpload(false); setTitle(''); setFile(null); setSuccess('Đã thêm minh chứng.');
      setRevision(value => value + 1); onEvidenceSaved();
    } catch (error) { setWriteError(error.message || 'Không lưu được minh chứng.'); }
    finally { setSaving(false); }
  }
  const dateLabel = date => date ? date.slice(0, 10).split('-').reverse().join('/') : '—';
  return <dialog
    ref={dialog}
    aria-labelledby="portfolio-achievement-title"
    aria-describedby="portfolio-achievement-subtitle"
    className="m-auto w-[calc(100vw-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl border-0 bg-white p-0 text-slate-800 shadow-2xl dark:bg-slate-900 dark:text-slate-100 [&::backdrop]:bg-slate-900/50 [&::backdrop]:backdrop-blur-sm"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}
  >
    <div className="flex max-h-[calc(100dvh-2rem)] flex-col" onClick={event => event.stopPropagation()}>
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
        <div className="min-w-0"><p id="portfolio-achievement-subtitle" className="mb-2 flex items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400"><FileText className="h-4 w-4" />Chi tiết thành tích</p><h2 id="portfolio-achievement-title" className="break-words text-lg font-bold sm:text-xl">{achievement.title}</h2></div>
        <button autoFocus type="button" disabled={saving} aria-label="Đóng chi tiết thành tích" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-6">
        <div className="flex flex-wrap gap-2"><span className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">{statusLabel}</span><span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Năm {achievement.recognitionYear || '—'}</span></div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Loại thành tích</dt><dd className="mt-1 font-medium">{achievement.achievementTypeName || 'Chưa phân loại'}</dd></div>
          {achievement.contributionRole && <div><dt className="text-xs text-slate-500">Vai trò đóng góp</dt><dd className="mt-1 break-words font-medium">{achievement.contributionRole}</dd></div>}
          {(achievement.startDate || achievement.endDate) && <div><dt className="text-xs text-slate-500">Thời gian thực hiện</dt><dd className="mt-1 font-medium">{dateLabel(achievement.startDate)} – {dateLabel(achievement.endDate)}</dd></div>}
        </dl>
        <section aria-label="Nội dung thành tích"><h3 className="mb-2 text-sm font-bold">Nội dung thành tích</h3><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{achievement.description || 'Chưa có mô tả cho thành tích này.'}</p></section>
        <section aria-label="Minh chứng số" className="space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Minh chứng số{!loading && !loadError ? ` (${evidences.length})` : ''}</h3>{['DRAFT', 'NEED_CORRECTION'].includes(achievement.status) && !upload && <button type="button" onClick={() => { setUpload(true); setWriteError(''); setSuccess(''); }} className="soft-btn-primary text-xs"><Plus className="h-4 w-4" />Thêm minh chứng</button>}</div>
          {success && <p role="status" className="text-sm text-teal-600 dark:text-teal-300">{success}</p>}
          {writeError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{writeError}</p>}
          {loading ? <LoadingState label="Đang tải minh chứng…" rows={1} /> : loadError ? <div role="alert" className="text-sm text-rose-600 dark:text-rose-400">{loadError}<button type="button" onClick={() => setRevision(value => value + 1)} className="ml-2 underline">Thử lại</button></div> : <div className="space-y-2">
            {evidences.map(evidence => <button type="button" key={evidence.evidenceId} disabled={!evidence.latestFileId || saving} onClick={async () => { setWriteError(''); try { await evidencesApi.downloadEvidenceFile(evidence.latestFileId, evidence.latestFileName); } catch (error) { setWriteError(error.message); } }} className="soft-btn-secondary w-full justify-between gap-3 text-left text-sm disabled:opacity-50"><span className="min-w-0"><strong className="block break-words">{evidence.title}</strong><span className="mt-1 block break-all text-xs text-slate-500">{evidence.latestFileName || 'Chưa có tệp'} · v{evidence.latestVersionNo || 1}</span></span><Download className="h-4 w-4 shrink-0" /></button>)}
            {!evidences.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/50">Chưa có minh chứng.</p>}
          </div>}
          {upload && <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold">Thêm minh chứng</h4><button type="button" disabled={saving} aria-label="Đóng tải minh chứng" onClick={cancelUpload} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
            <label className="block space-y-1.5 text-xs font-semibold"><span>Tên minh chứng</span><input autoFocus required disabled={saving} value={title} onChange={event => setTitle(event.target.value)} placeholder="Nhập tên minh chứng" className="soft-input w-full" /></label>
            <label className="block space-y-1.5 text-xs font-semibold"><span>Tệp minh chứng</span><input required disabled={saving} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={event => setFile(event.target.files[0] || null)} className="block w-full min-w-0 text-xs" /></label>
            <p className="text-xs text-slate-500">PDF, JPG, PNG, DOCX · tối đa 10 MB.</p>
            <div className="flex gap-2"><button type="submit" disabled={saving || !file} className="soft-btn-primary text-xs">{saving ? 'Đang tải…' : 'Lưu minh chứng'}</button><button type="button" disabled={saving} onClick={cancelUpload} className="soft-btn-secondary text-xs">Hủy</button></div>
          </form>}
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800 sm:px-6">
        <button type="button" disabled={saving} onClick={close} className="soft-btn-secondary text-sm">Đóng</button>
        <Link to={`/achievements?id=${achievement.achievementId}`} onClick={event => { if (!allowDiscard()) event.preventDefault(); else onClose(); }} className="soft-btn-primary text-sm"><ExternalLink className="h-4 w-4" />Xem hồ sơ đầy đủ</Link>
      </footer>
    </div>
  </dialog>;
}
