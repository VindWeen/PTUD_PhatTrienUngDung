import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Award, BriefcaseBusiness, Check, ChevronDown, ChevronUp, Clipboard, Eye, FileText, GraduationCap, Link2, Plus, Save, Sparkles, Trash2, UserRound } from 'lucide-react';
import { request } from '../services/request';

const input = 'soft-input mt-1 w-full';
export default function CvEditor() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    let active = true;
    request({ url: '/me/cv', fresh: true }).then(result => { if (active) { setData(result); setDraft({ education: [], specialties: '', skills: '', certificates: '', projects: '', researchLinks: '', ...result.draft }); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  const update = (key, value) => { setEdited(true); setDraft(previous => ({ ...previous, [key]: value })); };
  const toggle = (key, id) => update(key, draft[key].includes(Number(id)) ? draft[key].filter(v => v !== Number(id)) : [...draft[key], Number(id)]);
  const save = async () => {
    const result = await request({ method: 'PUT', url: '/me/cv', data: draft });
    setDraft(previous => ({ ...previous, version: result.version }));
    setData(previous => ({ ...previous, publicId: result.publicId, unpublishedChanges: previous.isPublished ? (previous.unpublishedChanges || edited) : false }));
    setEdited(false);
    return result;
  };
  const run = async action => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'save') { await save(); setNotice('Đã lưu bản nháp. Bản đang chia sẻ chỉ thay đổi khi bạn công khai lại.'); }
      if (action === 'publish') {
        const saved = await save();
        const result = await request({ method: 'POST', url: '/me/cv/publish', data: { version: saved.version } });
        setDraft(previous => ({ ...previous, version: result.version }));
        setData(previous => ({ ...previous, isPublished: true, publicId: result.publicId, unpublishedChanges: false, publishedAt: result.publishedAt, unavailableAchievements: [] }));
        setNotice('Đã công khai CV. Ai có đường dẫn đều có thể xem.');
      }
      if (action === 'unpublish') {
        const result = await request({ method: 'POST', url: '/me/cv/unpublish', data: { version: draft.version } });
        setDraft(previous => ({ ...previous, version: result.version }));
        setData(previous => ({ ...previous, isPublished: false }));
        setNotice('Đã ngừng chia sẻ CV.');
      }
      if (action === 'rotate') {
        const result = await request({ method: 'POST', url: '/me/cv/rotate-link', data: { version: draft.version } });
        setDraft(previous => ({ ...previous, version: result.version }));
        setData(previous => ({ ...previous, publicId: result.publicId }));
        setNotice('Đã đổi link. Link cũ không còn xem được.');
      }
    } catch (e) { setError(e.message || 'Không thể lưu CV.'); } finally { setBusy(false); }
  };
  if (!data || !draft) return <div className="soft-card p-6">{error ? <p role="alert">{error}</p> : 'Đang tải CV...'}</div>;
  const cv = {
    ...draft, fullName: data.profile.fullName,
    email: draft.showEmail ? data.profile.email : null, phone: draft.showPhone ? data.profile.phone : null,
    workHistory: data.profile.workHistory.filter(item => draft.workHistoryIds.includes(Number(item.assignmentId))),
    achievements: data.achievements.filter(item => draft.achievementIds.includes(Number(item.achievementId))),
  };
  const publicLink = data.publicId ? `${window.location.origin}/cv/${data.publicId}` : '';
  const move = (key, index, direction) => {
    const next = [...draft[key]]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; update(key, next);
  };
  const copyLink = async () => { try { await navigator.clipboard.writeText(publicLink); setNotice('Đã sao chép link CV.'); } catch { setError('Không sao chép được. Hãy chọn và sao chép link bên dưới.'); } };
  const openPreview = () => {
    try {
      sessionStorage.setItem('ptud-cv-preview', JSON.stringify(cv));
      const tab = window.open('/me/cv/preview', '_blank');
      sessionStorage.removeItem('ptud-cv-preview');
      if (!tab) setError('Trình duyệt đã chặn tab xem trước. Hãy cho phép mở cửa sổ mới và thử lại.');
    } catch { setError('Không thể mở bản xem trước. Vui lòng thử lại.'); }
  };
  const fields = [['organization', 'Nơi làm việc'], ['position', 'Vị trí'], ['period', 'Thời gian'], ['description', 'Mô tả']];
  const sections = [
    ['intro', 'Thông tin cơ bản'], ['profile', 'Hồ sơ LHU'], ['education', 'Học vấn'],
    ['experience', 'Kinh nghiệm'], ['details', 'Thông tin bổ sung'], ['sharing', 'Chia sẻ CV'],
  ];
  const card = 'rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7';
  const label = 'block text-sm font-semibold text-slate-700 dark:text-slate-200';
  const textArea = 'soft-input mt-2 min-h-[100px] w-full resize-y text-sm';
  const reorder = (key, index) => <div className="flex items-center gap-1">
    <button type="button" aria-label="Di chuyển lên" title="Di chuyển lên" disabled={index === 0} onClick={() => move(key, index, -1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700"><ChevronUp className="h-4 w-4" /></button>
    <button type="button" aria-label="Di chuyển xuống" title="Di chuyển xuống" disabled={index === draft[key].length - 1} onClick={() => move(key, index, 1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700"><ChevronDown className="h-4 w-4" /></button>
  </div>;
  const heading = (Icon, title, subtitle) => <div className="mb-6 flex items-start gap-3"><span className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><Icon className="h-5 w-5" /></span><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{subtitle}</p></div></div>;
  return <main className="space-y-6 pb-20 text-slate-800 dark:text-slate-100">
    <header className="rounded-[26px] border border-slate-200/70 bg-white px-5 py-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-8">
      <Link to="/me/profile" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-teal-700 dark:text-slate-400"><ArrowLeft className="h-4 w-4" /> Hồ sơ năng lực</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">CV cá nhân</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.isPublished ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{data.isPublished ? 'Đang chia sẻ' : 'Chưa chia sẻ'}</span></div><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Tạo một hồ sơ giới thiệu theo cách riêng của bạn.</p></div><button type="button" disabled={busy} className="soft-btn-secondary text-sm" onClick={openPreview}><Eye className="h-4 w-4" /> Xem trước trong tab mới</button></div>
    </header>
    {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
    {notice && <p role="status" className="rounded-2xl bg-teal-50 p-4 text-sm text-teal-800 dark:bg-teal-950/50 dark:text-teal-200">{notice}</p>}
    {data.isPublished && (edited || data.unpublishedChanges) && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Bạn có thay đổi chưa công khai. Bấm Cập nhật CV công khai để người xem thấy nội dung mới.</p>}
    {!!data.unavailableAchievements?.length && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Một số thành tích đã chọn không còn được xác nhận và đã bị ẩn khỏi CV công khai. <button className="underline" onClick={() => { update('achievementIds', draft.achievementIds.filter(id => !data.unavailableAchievements.includes(id))); setData(previous => ({ ...previous, unavailableAchievements: [] })); }}>Bỏ các thành tích này khỏi bản nháp</button></div>}
    <div className="grid items-start gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden xl:sticky xl:top-6 xl:block"><nav aria-label="Các phần của CV" className="rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><p className="px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-wider text-slate-400">Nội dung CV</p>{sections.map(([id, name], index) => <a key={id} href={`#${id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-teal-50 hover:text-teal-700 dark:text-slate-300 dark:hover:bg-slate-800"><span className="text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</span>{name}</a>)}</nav><p className="px-3 pt-4 text-xs leading-5 text-slate-400">Bản nháp chỉ hiển thị với bạn cho đến khi công khai.</p></aside>
      <div className="min-w-0 space-y-5">
        <section id="intro" className={card}>
          {heading(UserRound, 'Thông tin cơ bản', 'Chọn một mẫu và viết vài dòng để giới thiệu bản thân.')}
          <fieldset><legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mẫu CV</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{[['classic','Tối giản','Gọn gàng, tập trung vào nội dung'],['modern','Hiện đại','Tiêu đề nổi bật, bố cục hai cột']].map(([value,name,description]) => <label key={value} className={`relative flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${draft.template === value ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500 dark:bg-teal-950/30' : 'border-slate-200 hover:border-teal-300 dark:border-slate-700'}`}><input className="sr-only" type="radio" name="template" value={value} checked={draft.template === value} onChange={() => update('template', value)} /><span aria-hidden="true" className={`flex h-16 w-12 shrink-0 flex-col gap-1 overflow-hidden rounded border border-slate-200 bg-white p-1.5 shadow-sm ${value === 'modern' ? 'border-t-[10px] border-t-slate-800' : ''}`}><span className="h-1 w-6 rounded bg-slate-500"/><span className="h-1 w-full rounded bg-slate-200"/><span className="h-1 w-4/5 rounded bg-slate-200"/><span className="mt-1 h-1 w-full rounded bg-slate-200"/></span><span className="min-w-0"><span className="block text-sm font-bold">{name}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span></span>{draft.template === value && <Check aria-hidden="true" className="ml-auto h-5 w-5 shrink-0 text-teal-600" />}</label>)}</div></fieldset>
          <div className="mt-6 grid gap-5"><label className={label}>Chức danh hoặc lĩnh vực<input className={input} maxLength={150} value={draft.headline} onChange={e => update('headline', e.target.value)} placeholder="Ví dụ: Giảng viên Công nghệ thông tin" /></label><label className={label}>Giới thiệu<textarea className={textArea} rows={4} maxLength={2000} value={draft.summary} onChange={e => update('summary', e.target.value)} placeholder="Chia sẻ ngắn về công việc, hướng nghiên cứu hoặc điều bạn quan tâm." /></label><label className={label}>Lĩnh vực chuyên môn<input className={input} maxLength={500} value={draft.specialties} onChange={e => update('specialties', e.target.value)} placeholder="Ví dụ: Kỹ thuật phần mềm, trí tuệ nhân tạo" /></label></div>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70"><p className="text-sm font-semibold">Thông tin liên hệ</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Chỉ những thông tin được chọn mới xuất hiện trên CV chia sẻ.</p><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><label className="flex items-start gap-2"><input className="mt-1 accent-teal-600" type="checkbox" checked={draft.showEmail} onChange={e => update('showEmail', e.target.checked)} /><span>Hiển thị email <span className="block break-all text-xs text-slate-500">{data.profile.email || 'Chưa có email'}</span></span></label><label className="flex items-start gap-2"><input className="mt-1 accent-teal-600" type="checkbox" checked={draft.showPhone} onChange={e => update('showPhone', e.target.checked)} /><span>Hiển thị số điện thoại <span className="block text-xs text-slate-500">{data.profile.phone || 'Chưa có số điện thoại'}</span></span></label></div></div>
        </section>
        <section id="profile" className={card}>
          {heading(Award, 'Chọn từ hồ sơ LHU', 'Thông tin chính thức được lấy từ hồ sơ của bạn. Chọn những mục muốn hiển thị trên CV.')}
          <div className="space-y-6"><div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Công tác tại LHU</h3><span className="text-xs text-slate-400">Đã chọn {draft.workHistoryIds.length}</span></div><p className="mb-3 text-xs text-slate-500">Admin quản lý dữ liệu phân công công tác.</p>{data.profile.workHistory.length ? <div className="space-y-2">{data.profile.workHistory.map(item => <label key={item.assignmentId} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"><input className="accent-teal-600" type="checkbox" checked={draft.workHistoryIds.includes(Number(item.assignmentId))} onChange={() => toggle('workHistoryIds', item.assignmentId)} /><span className="flex-1 font-medium">{item.unitName}</span><span className="text-xs text-slate-500">{item.period}</span></label>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">Chưa có phân công công tác.</p>}</div>
          <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Thành tích đã xác nhận</h3><span className="text-xs text-slate-400">Đã chọn {draft.achievementIds.length}</span></div>{data.achievements.length ? <div className="max-h-64 space-y-2 overflow-y-auto">{data.achievements.map(item => <label key={item.achievementId} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"><input className="accent-teal-600" type="checkbox" checked={draft.achievementIds.includes(Number(item.achievementId))} onChange={() => toggle('achievementIds', item.achievementId)} /><span className="flex-1 font-medium">{item.title}</span><span className="text-xs text-slate-500">{item.recognitionYear}</span></label>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">Chưa có thành tích đã xác nhận.</p>}</div></div>
        </section>
        <section id="education" className={card}>
          {heading(GraduationCap, 'Học vấn', 'Thêm bằng cấp, chuyên ngành và cơ sở đào tạo bạn muốn giới thiệu.')}
          <div className="space-y-4">{draft.education.map((item, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50"><div className="mb-4 flex items-center justify-between"><span className="text-sm font-bold">Học vấn {index + 1}</span><div className="flex items-center">{reorder('education', index)}<button type="button" aria-label="Xóa học vấn" onClick={() => update('education', draft.education.filter((_,i) => i !== index))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"><Trash2 className="h-4 w-4" /></button></div></div><div className="grid gap-4 sm:grid-cols-2">{[['qualification','Bằng cấp / chuyên ngành'],['institution','Cơ sở đào tạo'],['period','Thời gian']].map(([key,name]) => <label key={key} className={label}>{name}<input className={input} maxLength={key === 'period' ? 80 : 150} value={item[key]} onChange={e => update('education', draft.education.map((v,i) => i === index ? { ...v, [key]: e.target.value } : v))} /></label>)}</div></div>)}</div>
          <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-teal-400 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950" disabled={draft.education.length >= 30} onClick={() => update('education', [...draft.education, { institution:'', qualification:'', period:'' }])}><Plus className="h-4 w-4" /> Thêm học vấn</button>
        </section>
        <section id="experience" className={card}>
          {heading(BriefcaseBusiness, 'Kinh nghiệm khác', 'Bổ sung kinh nghiệm ngoài dữ liệu công tác chính thức của trường.')}
          <div className="space-y-4">{draft.experiences.map((item, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50"><div className="mb-4 flex items-center justify-between"><span className="text-sm font-bold">Kinh nghiệm {index + 1}</span><div className="flex items-center">{reorder('experiences', index)}<button type="button" aria-label="Xóa kinh nghiệm" onClick={() => update('experiences', draft.experiences.filter((_,i) => i !== index))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"><Trash2 className="h-4 w-4" /></button></div></div><div className="grid gap-4 sm:grid-cols-2">{fields.map(([key,name]) => <label key={key} className={label}>{name}<input className={input} maxLength={key === 'description' ? 1000 : key === 'period' ? 80 : 150} value={item[key]} onChange={e => update('experiences', draft.experiences.map((v,i) => i === index ? { ...v, [key]: e.target.value } : v))} /></label>)}</div></div>)}</div>
          <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-teal-400 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950" disabled={draft.experiences.length >= 30} onClick={() => update('experiences', [...draft.experiences, { organization:'', position:'', period:'', description:'' }])}><Plus className="h-4 w-4" /> Thêm kinh nghiệm</button>
        </section>
        <section id="details" className={card}>
          {heading(Sparkles, 'Thông tin bổ sung', 'Điền những phần phù hợp với bạn; mục để trống sẽ không xuất hiện trên CV.')}
          <div className="grid gap-5 sm:grid-cols-2">{[['skills','Kỹ năng',500],['certificates','Chứng chỉ',2000],['projects','Dự án',3000],['researchLinks','Liên kết nghiên cứu',2000]].map(([key,name,max]) => <label className={label} key={key}>{name}<textarea className={textArea} rows={3} maxLength={max} value={draft[key]} onChange={e => update(key, e.target.value)} placeholder={key === 'researchLinks' ? 'Mỗi dòng một liên kết hoặc mô tả' : 'Mỗi dòng một nội dung'} /></label>)}</div>
        </section>
        <section id="sharing" className={card}>
          {heading(Link2, 'Chia sẻ CV', 'Xem trước và lưu bản nháp trước khi chia sẻ theo nhu cầu.')}
          <div className="rounded-2xl bg-teal-50/70 p-4 text-sm leading-6 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200">Khi công khai, bất kỳ ai có link đều có thể xem. Thay đổi trong bản nháp cần công khai lại để cập nhật link.</div>
          <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} className="soft-btn-secondary" onClick={() => run('save')}><Save className="h-4 w-4" /> Lưu bản nháp</button><button type="button" disabled={busy} className="soft-btn-primary" onClick={() => run('publish')}><FileText className="h-4 w-4" /> {busy ? 'Đang xử lý...' : data.isPublished ? 'Cập nhật CV công khai' : 'Công khai CV'}</button>{data.isPublished && <button type="button" disabled={busy} className="soft-btn-secondary" onClick={() => run('unpublish')}>Ngừng chia sẻ</button>}</div>
          {data.isPublished && <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm dark:border-slate-700"><p className="text-slate-500">Công khai lần cuối: {data.publishedAt ? new Date(data.publishedAt).toLocaleString('vi-VN') : 'Chưa có thông tin'}</p><div className="break-all"><span className="font-semibold">Link CV: </span><a className="text-teal-700 underline dark:text-teal-300" href={publicLink} target="_blank" rel="noreferrer">{publicLink}</a></div><div className="flex flex-wrap gap-3"><button type="button" className="soft-btn-secondary text-sm" onClick={copyLink}><Clipboard className="h-4 w-4" /> Sao chép link</button><button type="button" className="soft-btn-secondary text-sm" disabled={busy} onClick={() => { if (window.confirm('Đổi link sẽ khiến link cũ không còn truy cập được. Tiếp tục?')) run('rotate'); }}>Đổi link chia sẻ</button></div></div>}
        </section>
      </div>
    </div>
  </main>;
}
