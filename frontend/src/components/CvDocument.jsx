import React from 'react';

function Section({ title, children, modern }) {
  return <section className="space-y-4"><h2 className={`text-xs font-bold uppercase tracking-[0.18em] ${modern ? 'text-teal-700' : 'border-b border-slate-300 pb-2 text-slate-600'}`}>{title}</h2>{children}</section>;
}
export default function CvDocument({ cv }) {
  const modern = cv.template === 'modern';
  return <article className={`mx-auto max-w-4xl overflow-hidden bg-white text-slate-800 shadow-xl ${modern ? 'rounded-2xl' : 'border border-slate-200'}`}>
    <header className={`px-8 py-10 sm:px-12 sm:py-12 ${modern ? 'bg-slate-900 text-white' : 'border-b-4 border-slate-800'}`}>
      <p className={`text-xs font-bold uppercase tracking-[0.24em] ${modern ? 'text-teal-300' : 'text-slate-500'}`}>Hồ sơ giảng viên · LHU</p>
      <h1 className={`mt-4 text-3xl font-bold leading-tight sm:text-5xl ${modern ? '' : 'font-serif'}`}>{cv.fullName}</h1>
      {cv.headline && <p className={`mt-3 text-lg ${modern ? 'text-slate-300' : 'text-slate-600'}`}>{cv.headline}</p>}
      {(cv.email || cv.phone) && <div className={`mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm ${modern ? 'text-slate-300' : 'text-slate-500'}`}>{cv.email && <span>{cv.email}</span>}{cv.phone && <span>{cv.phone}</span>}</div>}
    </header>
    <div className={`px-8 py-10 sm:px-12 ${modern ? 'grid gap-10 md:grid-cols-[minmax(0,1fr)_15rem]' : 'space-y-9'}`}>
      <div className="space-y-9">
        {cv.summary && <Section title="Giới thiệu" modern={modern}><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{cv.summary}</p></Section>}
        {!!cv.workHistory?.length && <Section title="Công tác tại LHU" modern={modern}><div className="space-y-5">{cv.workHistory.map((item, i) => <div key={i} className="sm:flex sm:justify-between sm:gap-6"><div><p className="font-semibold">{item.unitName}</p>{item.parentUnitName && <p className="mt-1 text-sm text-slate-500">{item.parentUnitName}</p>}</div><p className="mt-1 shrink-0 text-sm text-slate-500">{item.period}</p></div>)}</div></Section>}
        {!!cv.experiences?.length && <Section title="Kinh nghiệm khác" modern={modern}><div className="space-y-5">{cv.experiences.map((item, i) => <div key={i}><div className="sm:flex sm:justify-between sm:gap-6"><div><p className="font-semibold">{item.position}</p><p className="mt-1 text-sm text-slate-500">{item.organization}</p></div><p className="mt-1 shrink-0 text-sm text-slate-500">{item.period}</p></div>{item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.description}</p>}</div>)}</div></Section>}
        {!!cv.achievements?.length && <Section title="Thành tích đã xác nhận" modern={modern}><ul className="space-y-3">{cv.achievements.map((item, i) => <li key={i} className="flex gap-3 text-sm leading-6"><span aria-hidden="true" className="text-teal-600">•</span><span>{item.title}{item.recognitionYear ? ` · ${item.recognitionYear}` : ''}</span></li>)}</ul></Section>}
        {cv.projects && <Section title="Dự án" modern={modern}><p className="whitespace-pre-wrap text-sm leading-7">{cv.projects}</p></Section>}
        {cv.researchLinks && <Section title="Liên kết nghiên cứu" modern={modern}><p className="whitespace-pre-wrap break-all text-sm leading-7">{cv.researchLinks}</p></Section>}
      </div>
      <aside className={`space-y-9 ${modern ? 'md:border-l md:border-slate-200 md:pl-7' : ''}`}>
        {!!cv.education?.length && <Section title="Học vấn" modern={modern}><div className="space-y-4">{cv.education.map((item, i) => <div key={i}><p className="text-sm font-semibold">{item.qualification}</p><p className="mt-1 text-sm text-slate-600">{item.institution}</p><p className="mt-1 text-xs text-slate-500">{item.period}</p></div>)}</div></Section>}
        {cv.specialties && <Section title="Lĩnh vực chuyên môn" modern={modern}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{cv.specialties}</p></Section>}
        {cv.skills && <Section title="Kỹ năng" modern={modern}><p className="whitespace-pre-wrap text-sm leading-6">{cv.skills}</p></Section>}
        {cv.certificates && <Section title="Chứng chỉ" modern={modern}><p className="whitespace-pre-wrap text-sm leading-6">{cv.certificates}</p></Section>}
      </aside>
    </div>
  </article>;
}
