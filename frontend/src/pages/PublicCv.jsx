import React from 'react';
import { useParams } from 'react-router-dom';
import { useLoad } from '../hooks/useLoad';
import { Empty, Load } from '../components/common/VaultPrimitives';

export function PublicCv() {
  const { slug } = useParams(), state = useLoad(`/public/cv/${encodeURIComponent(slug)}`);
  return (
    <main className="public-cv min-h-screen bg-slate-50 p-5 sm:p-10 text-slate-800">
      <div className={`mx-auto max-w-3xl bg-white p-6 sm:p-10 ${
        state.data?.templateId === "Academic"
          ? "font-serif border-t-8 border-slate-800"
          : state.data?.templateId === "Minimalist"
          ? "border border-slate-200"
          : "rounded-xl shadow-lg border-t-8 border-teal-700"
      }`}>
        <Load state={state}>
          <h1 className="text-3xl font-bold">{state.data?.contact?.fullName || 'CV cá nhân'}</h1>
          <p className="mt-2 text-lg text-teal-700 font-semibold">{state.data?.headline}</p>
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">{state.data?.bio}</p>
          {(state.data?.contact?.email || state.data?.contact?.phone) && (
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              {state.data?.contact?.email && <p>Email: {state.data.contact.email}</p>}
              {state.data?.contact?.phone && <p>Điện thoại: {state.data.contact.phone}</p>}
            </div>
          )}
          <h2 className="mt-8 text-xl font-bold border-b border-slate-200 pb-2">Thành tích & Dấu mốc</h2>
          {!state.data?.achievements?.length ? (
            <Empty>Chưa có thành tích được chia sẻ.</Empty>
          ) : (
            <div className="space-y-3 mt-4">
              {state.data.achievements.map(item => (
                <div key={item.id || item.achievementId} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="font-bold text-sm text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{[item.type, item.recognitionYear].filter(Boolean).join(' · ')}</p>
                </div>
              ))}
            </div>
          )}
        </Load>
      </div>
    </main>
  );
}
