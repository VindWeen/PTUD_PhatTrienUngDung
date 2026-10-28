import React, { useState } from 'react';
import CvDocument from '../components/CvDocument';

export default function CvPreview() {
  const [cv] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ptud-cv-preview') || 'null'); } catch { return null; }
  });
  return <main className="space-y-6 pb-8">
    <div className="soft-card flex flex-wrap items-center justify-between gap-4 p-5 print:hidden"><div><h1 className="text-lg font-bold">Xem trước CV</h1><p className="text-sm text-slate-500">Đây là bản xem trước riêng tư, bao gồm cả nội dung chưa lưu. Quay lại tab chỉnh sửa để tiếp tục.</p></div><div className="flex gap-2"><button type="button" onClick={() => window.print()} className="soft-btn-primary text-sm">In hoặc lưu PDF</button><button type="button" onClick={() => window.close()} className="soft-btn-secondary text-sm">Đóng tab xem trước</button></div></div>
    {cv ? <CvDocument cv={cv} /> : <p className="soft-card p-6">Không có bản xem trước. Hãy mở từ trang chỉnh sửa CV.</p>}
  </main>;
}
