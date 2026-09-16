import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Sun,
  Moon,
  Medal,
  Award,
  Star,
  FileCheck,
  Lightbulb,
  ArrowRight,
  Filter,
  File,
  Image as ImageIcon,
  Plus,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ProfilePortfolio() {
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('nckh');
  const [showUploadModal, setShowUploadModal] = useState(false);

  const tabs = [
    { id: 'nckh', label: 'Nghiên cứu khoa học' },
    { id: 'teaching', label: 'Giảng dạy' },
    { id: 'awards', label: 'Khen thưởng' },
    { id: 'evidences', label: 'Minh chứng' },
  ];

  const handleExportPDF = () => {
    alert('Xuất PDF sẽ được bổ sung ở giai đoạn tiếp theo.');
  };

  const handleExportExcel = () => {
    alert('Xuất Excel sẽ được bổ sung ở giai đoạn tiếp theo.');
  };

  return (
    <div className="space-y-7 animate-fadeIn">
      {/* 1. Header Row */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hồ sơ Năng lực & Thành tích
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Cập nhật lần cuối: 10/04/2024
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 rounded-2xl bg-white dark:bg-soft-darkCard border border-slate-200/80 dark:border-soft-darkBorder text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-2 shadow-soft-sm hover:bg-slate-50 dark:hover:bg-soft-darkCardHover transition-all active:scale-95"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Xuất PDF</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-2xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs flex items-center gap-2 shadow-sm hover:bg-slate-700 dark:hover:bg-white transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Xuất Excel</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            className="p-2.5 rounded-2xl bg-white dark:bg-soft-darkCard border border-slate-200/80 dark:border-soft-darkBorder text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-soft-darkCardHover shadow-soft-sm transition-all"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* 2. Main Two Columns Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* LEFT COLUMN (4 cols): Quá trình công tác + Danh hiệu */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Quá trình công tác */}
          <div className="soft-card p-6 sm:p-7">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="w-1.5 h-6 rounded-full bg-slate-800 dark:bg-slate-300" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Quá trình công tác
              </h2>
            </div>

            {/* Timeline */}
            <div className="relative pl-6 space-y-7 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {/* Timeline Item 1 */}
              <div className="relative">
                {/* Dot */}
                <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-slate-800 dark:bg-slate-200 ring-4 ring-white dark:ring-soft-darkCard" />
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  2020 – Hiện tại
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  Phó Giáo sư, Tiến sĩ
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Khoa Khoa học Máy tính, Đại học Quốc gia
                </div>
              </div>

              {/* Timeline Item 2 */}
              <div className="relative">
                {/* Dot */}
                <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-500 ring-4 ring-white dark:ring-soft-darkCard" />
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  2015 – 2020
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  Giảng viên chính
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Bộ môn Kỹ thuật Phần mềm
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Danh hiệu */}
          <div className="soft-card p-6 sm:p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-1.5 h-6 rounded-full bg-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Danh hiệu</h2>
            </div>

            <div className="space-y-3.5">
              {/* Item 1: CSTĐ 2023 */}
              <div className="p-4 rounded-2xl bg-[#fdf9e8] dark:bg-[#2b271b] border border-amber-200/50 dark:border-amber-900/40 flex items-center gap-3.5 transition-transform hover:-translate-y-0.5">
                <div className="w-11 h-11 rounded-2xl bg-white dark:bg-amber-950/60 text-amber-500 flex items-center justify-center shadow-sm shrink-0">
                  <Medal className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-amber-100">
                    Chiến sĩ thi đua cơ sở (2023)
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5 font-medium">
                    Cấp Trường - Đạt loại Xuất sắc
                  </div>
                </div>
              </div>

              {/* Item 2: CSTĐ 2022 */}
              <div className="p-4 rounded-2xl bg-[#edf4fc] dark:bg-[#1d2736] border border-blue-200/50 dark:border-blue-900/40 flex items-center gap-3.5 transition-transform hover:-translate-y-0.5">
                <div className="w-11 h-11 rounded-2xl bg-white dark:bg-blue-950/60 text-blue-500 flex items-center justify-center shadow-sm shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-blue-100">
                    Chiến sĩ thi đua cơ sở (2022)
                  </div>
                  <div className="text-[11px] text-blue-700 dark:text-blue-300/80 mt-0.5 font-medium">
                    Cấp Trường - Đạt loại Xuất sắc
                  </div>
                </div>
              </div>

              {/* Item 3: Bằng khen cấp Bộ */}
              <div className="p-4 rounded-2xl bg-[#f1f5f9] dark:bg-[#232c3a] border border-slate-200/60 dark:border-slate-800 flex items-center gap-3.5 transition-transform hover:-translate-y-0.5">
                <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 flex items-center justify-center shadow-sm shrink-0">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                    Bằng khen cấp Bộ (Đang phấn đấu)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                    Dự kiến hoàn thành hồ sơ Q4/2024
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (8 cols): Tabs + Danh sách thành tích NCKH + Minh chứng số */}
        <div className="lg:col-span-8 space-y-6">
          {/* Filter Tabs (Pill style as in design) */}
          <div className="flex flex-wrap items-center gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={activeTab === tab.id}
                className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm font-semibold'
                    : 'bg-white dark:bg-soft-darkCard text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-soft-darkCardHover border border-slate-100 dark:border-soft-darkBorder shadow-soft-sm'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Card: Danh sách thành tích NCKH */}
          <div className="soft-card p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {activeTab === 'nckh' ? 'Danh sách thành tích NCKH' : tabs.find(tab => tab.id === activeTab).label}
              </h2>
              <button
                title="Lọc thành tích"
                onClick={() => alert('Bộ lọc thành tích sẽ được bổ sung ở giai đoạn tiếp theo.')}
                className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Achievement Cards Grid */}
            {activeTab === 'nckh' && <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              {/* Card 1 */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-soft-darkBorder flex flex-col justify-between hover:shadow-soft-sm transition-all group">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dcf5ec] dark:bg-emerald-950/60 text-[#0f9268] text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-brand-500 transition-colors">
                    Ứng dụng Deep Learning trong chẩn đoán y tế từ xa
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Tạp chí Q1 IEEE Access · 2024
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                  {/* Contributors Avatars */}
                  <div className="flex items-center -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-amber-400 border-2 border-white dark:border-slate-800 text-[10px] font-bold text-white flex items-center justify-center">
                      AN
                    </div>
                    <div className="w-7 h-7 rounded-full bg-blue-500 border-2 border-white dark:border-slate-800 text-[10px] font-bold text-white flex items-center justify-center">
                      TH
                    </div>
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-800">
                      +3
                    </div>
                  </div>

                  <button aria-label="Xem chi tiết thành tích" onClick={() => alert('Chi tiết thành tích sẽ được bổ sung ở giai đoạn tiếp theo.')} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white group-hover:translate-x-1 transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card 2 */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-soft-darkBorder flex flex-col justify-between hover:shadow-soft-sm transition-all group">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dcf5ec] dark:bg-emerald-950/60 text-[#0f9268] text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-brand-500 transition-colors">
                    Hệ thống IoT giám sát môi trường nuôi trồng thủy sản
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Bằng Sáng chế Giai đoạn 2 · 2023
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Chủ nhiệm đề tài
                  </span>
                  <button aria-label="Xem chi tiết thành tích" onClick={() => alert('Chi tiết thành tích sẽ được bổ sung ở giai đoạn tiếp theo.')} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white group-hover:translate-x-1 transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>}

            {activeTab === 'teaching' && <div className="mb-8 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
              <h3 className="font-bold text-sm">Giảng dạy & Đào tạo</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Hoàn thành 92% mục tiêu giảng dạy năm 2024 (dữ liệu mẫu).</p>
            </div>}
            {activeTab === 'awards' && <div className="mb-8 p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30">
              <h3 className="font-bold text-sm">Chiến sĩ thi đua cơ sở</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Danh hiệu năm 2022 và 2023 · Cấp Trường (dữ liệu mẫu).</p>
            </div>}

            {/* Sub-Section: Minh chứng số */}
            <div className="pt-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                Minh chứng số
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* File 1: Quyết định */}
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col items-center justify-between text-center min-h-[140px] hover:border-brand-400 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center mb-2">
                    <File className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate w-full px-1">
                    Quyết định_dảng.pdf
                  </div>
                  <span className="mt-2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold tracking-wider">
                    ĐANG CHỜ DUYỆT
                  </span>
                </div>

                {/* File 2: Bằng khen */}
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center min-h-[140px] hover:border-brand-400 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mb-2">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate w-full px-1">
                    Bang_khen_2023.jpg
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">1.8 MB</span>
                </div>

                {/* File 3: Hợp đồng NCKH */}
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center min-h-[140px] hover:border-brand-400 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mb-2">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate w-full px-1">
                    Hop_dong_NCKH.pdf
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">3.2 MB</span>
                </div>

                {/* File 4: Thêm mới */}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 flex flex-col items-center justify-center text-center min-h-[140px] transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:scale-110 flex items-center justify-center mb-2 transition-transform">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white">
                    Thêm mới
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal (Triggered by + Thêm mới) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="soft-card max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Tải lên Minh chứng Mới
            </h3>
            <p className="text-xs text-slate-400">
              Chấp nhận file PDF, JPG, PNG, DOCX tối đa 10MB theo quy định bảo mật hệ thống.
            </p>
            <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Khu vực tải minh chứng (sẽ bổ sung sau)
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  alert('Đây là bản xem trước giao diện. Chức năng lưu minh chứng sẽ được bổ sung sau.');
                  setShowUploadModal(false);
                }}
                className="soft-btn-primary text-xs"
              >
                Xác nhận tải lên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


