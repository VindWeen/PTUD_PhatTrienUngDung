import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldAlert,
  Award,
  Mail,
  Phone,
  Building2,
  User,
  GraduationCap,
  ArrowLeft,
  Printer,
  Calendar,
  Sparkles,
  FileCheck2,
} from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';

export default function PublicCv() {
  const { slug, id } = useParams();
  const identifier = slug || id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identifier) return;

    const controller = new AbortController();
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    setLoading(true);
    setError(null);

    fetch(`${API_BASE_URL}/public/cv/${encodeURIComponent(identifier)}`, {
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    })
      .then(async (response) => {
        if (response.status === 404) {
          throw new Error('CV không tồn tại hoặc đã ngừng chia sẻ.');
        }
        if (response.status === 403) {
          return { success: true, data: { isPublic: false } };
        }
        return response.json();
      })
      .then((body) => {
        const cvData = body?.data !== undefined ? body.data : body;
        setData(cvData);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Lỗi khi tải CV.');
        }
      })
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
      meta.remove();
    };
  }, [identifier]);

  // Loading State
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Đang tải hồ sơ CV...</p>
        </div>
      </main>
    );
  }

  // ELEGANT PRIVACY SCREEN (When isPublic === false or is_public = 0)
  if (data && (data.isPublic === false || data.is_public === false || data.is_public === 0)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Hồ sơ này hiện đang được đặt ở chế độ riêng tư
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Chủ sở hữu hồ sơ đã tạm dừng chia sẻ công khai hoặc giới hạn quyền truy cập. Vui lòng liên hệ trực tiếp với giảng viên nếu bạn cần tiếp cận thông tin này.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition shadow-soft-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại trang chủ</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Error State
  if (error || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
          <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            {error || 'Không tìm thấy hồ sơ CV.'}
          </p>
          <div>
            <Link to="/" className="text-xs text-teal-600 dark:text-teal-400 underline font-medium">
              Quay lại trang chủ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const contact = data.contact || {};
  const achievements = Array.isArray(data.achievements) ? data.achievements : [];
  const template = (data.templateId || data.template || 'Modern').toLowerCase();

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 px-4 py-8 sm:py-12 print:bg-white print:p-0">
      {/* Top action bar: Print */}
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 font-semibold transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Trang chủ LHU
        </Link>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-soft-sm transition"
        >
          <Printer className="w-3.5 h-3.5" /> In / Tải PDF
        </button>
      </div>

      {/* ================= TEMPLATE 1: ACADEMIC (HÀN LÂM) ================= */}
      {template === 'academic' && (
        <article className="mx-auto max-w-4xl bg-white text-slate-900 shadow-xl border border-slate-200 rounded-none p-10 sm:p-14 font-serif print:shadow-none print:border-none print:p-0">
          {/* Header */}
          <header className="border-b-2 border-slate-800 pb-6 text-center space-y-2">
            <span className="text-[11px] uppercase tracking-widest text-slate-600 font-sans block">
              Trường Đại học Lạc Hồng • Lac Hong University
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wide">
              {contact.fullName || 'Hồ sơ Giảng viên'}
            </h1>
            <p className="text-base italic text-slate-700">
              {[contact.title, contact.degree].filter(Boolean).join(' • ') || 'Giảng viên / Nhà khoa học'}
            </p>
            {contact.unitName && (
              <p className="text-xs uppercase font-sans tracking-wider text-slate-600">
                {contact.unitName}
              </p>
            )}
            <div className="pt-2 flex flex-wrap justify-center gap-4 text-xs font-sans text-slate-600">
              {contact.email && <span>Email: {contact.email}</span>}
              {contact.phone && <span>Điện thoại: {contact.phone}</span>}
            </div>
          </header>

          <div className="mt-8 space-y-8 text-sm leading-relaxed">
            {/* Headline / Title */}
            {data.headline && (
              <section className="space-y-1">
                <h2 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-800 border-b border-slate-300 pb-1">
                  I. Chức danh & Định hướng Nghiên cứu
                </h2>
                <p className="font-sans text-slate-700 leading-normal">{data.headline}</p>
              </section>
            )}

            {/* Bio */}
            {data.bio && (
              <section className="space-y-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-800 border-b border-slate-300 pb-1">
                  II. Tiểu sử Khoa học
                </h2>
                <p className="whitespace-pre-wrap text-justify text-slate-800">{data.bio}</p>
              </section>
            )}

            {/* Achievements */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-800 border-b border-slate-300 pb-1">
                III. Danh mục Thành tựu & Khen thưởng Tiêu biểu ({achievements.length})
              </h2>
              {achievements.length === 0 ? (
                <p className="italic text-slate-500">Chưa có thành tích nào được công bố.</p>
              ) : (
                <ol className="list-decimal list-outside pl-5 space-y-2">
                  {achievements.map((ach, idx) => (
                    <li key={idx} className="pl-1">
                      <strong className="text-slate-900">{ach.title}</strong>
                      <span className="text-xs text-slate-600 block font-sans">
                        {[
                          ach.recognitionYear ? `Năm công nhận: ${ach.recognitionYear}` : null,
                          ach.type ? `Phân loại: ${ach.type}` : null,
                          ach.issuingAuthority ? `Cơ quan ban hành: ${ach.issuingAuthority}` : null,
                          ach.decisionNumber ? `Số QĐ: ${ach.decisionNumber}` : null,
                        ].filter(Boolean).join(' • ')}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </article>
      )}

      {/* ================= TEMPLATE 2: MODERN (HIỆN ĐẠI) ================= */}
      {template === 'modern' && (
        <article className="mx-auto max-w-4xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xl rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 print:shadow-none print:border-none print:rounded-none">
          {/* Header Banner */}
          <header className="bg-slate-900 text-white p-8 sm:p-12 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">
              Hồ sơ Chuyên gia • Trường Đại học Lạc Hồng
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {contact.fullName || 'Hồ sơ Giảng viên'}
            </h1>
            <p className="text-base text-slate-300 font-medium">
              {[contact.title, contact.degree, contact.unitName].filter(Boolean).join(' • ')}
            </p>
            {data.headline && (
              <p className="text-sm text-teal-200 font-medium pt-1">
                {data.headline}
              </p>
            )}

            <div className="pt-4 flex flex-wrap gap-4 text-xs text-slate-300">
              {contact.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-teal-400" /> {contact.email}
                </span>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-teal-400" /> {contact.phone}
                </span>
              )}
            </div>
          </header>

          <div className="p-8 sm:p-12 grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Main Content (8 Cols) */}
            <div className="md:col-span-8 space-y-8">
              {data.bio && (
                <section className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    Giới thiệu bản thân
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {data.bio}
                  </p>
                </section>
              )}

              <section className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Thành tích & Khen thưởng ({achievements.length})
                </h2>
                {achievements.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa có thành tích nào được chọn hiển thị.</p>
                ) : (
                  <div className="space-y-3">
                    {achievements.map((ach, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                            {ach.title}
                          </h3>
                          {ach.recognitionYear && (
                            <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold text-[10px] shrink-0">
                              {ach.recognitionYear}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          {ach.type && <span>{ach.type}</span>}
                          {ach.issuingAuthority && <span>• {ach.issuingAuthority}</span>}
                          {ach.decisionNumber && <span>• QĐ: {ach.decisionNumber}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Sidebar (4 Cols) */}
            <aside className="md:col-span-4 space-y-6 md:border-l md:border-slate-200 dark:md:border-slate-800 md:pl-6 text-xs">
              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[11px]">
                  Đơn vị công tác
                </h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium">
                  {contact.unitName || 'Trường Đại học Lạc Hồng'}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[11px]">
                  Học vị / Học hàm
                </h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium">
                  {contact.degree || 'Chưa cập nhật'}
                </p>
                <p className="text-slate-600 dark:text-slate-300 font-medium">
                  {contact.title || 'Chưa cập nhật'}
                </p>
              </div>
            </aside>
          </div>
        </article>
      )}

      {/* ================= TEMPLATE 3: MINIMALIST (TỐI GIẢN) ================= */}
      {template !== 'academic' && template !== 'modern' && (
        <article className="mx-auto max-w-3xl bg-white text-slate-900 shadow-xl rounded-2xl p-8 sm:p-14 space-y-8 border border-slate-100 print:shadow-none print:border-none print:p-0">
          <header className="space-y-2 pb-6 border-b border-slate-200">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {contact.fullName || 'Hồ sơ Giảng viên'}
            </h1>
            <p className="text-sm font-medium text-slate-600">
              {[contact.title, contact.degree, contact.unitName].filter(Boolean).join(' — ')}
            </p>
            {data.headline && (
              <p className="text-sm text-slate-500 italic pt-1">
                {data.headline}
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2">
              {contact.email && <span>{contact.email}</span>}
              {contact.phone && <span>{contact.phone}</span>}
            </div>
          </header>

          {data.bio && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Tiểu sử
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {data.bio}
              </p>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Thành tích tiêu biểu ({achievements.length})
            </h2>
            {achievements.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có thành tích nào.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {achievements.map((ach, idx) => (
                  <div key={idx} className="py-3 flex items-start justify-between gap-4 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-800">{ach.title}</p>
                      <p className="text-slate-400 text-[11px]">
                        {[ach.type, ach.issuingAuthority, ach.decisionNumber].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    {ach.recognitionYear && (
                      <span className="font-medium text-slate-500 shrink-0">
                        {ach.recognitionYear}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </article>
      )}
    </main>
  );
}
