import React, { useState } from 'react';
import {
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Target,
  HelpCircle,
  FileText,
  Users,
  GraduationCap,
  Send,
  Check,
  Plus,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function AIForecast() {
  const { isDark, toggleTheme } = useTheme();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actionDone, setActionDone] = useState({});

  // Radar chart points (5 dimensions: Giảng dạy, NCKH, Bài báo, Cộng đồng, Hướng dẫn)
  // Center (150, 150), radius 100
  // Angles: -90° (top), -18° (top-right), 54° (bottom-right), 126° (bottom-left), 198° (top-left)
  // Values normalized 0..1:
  // Giảng dạy: 0.85 -> (150, 65)
  // NCKH: 0.95 -> (150 + 95*cos(-18°), 150 + 95*sin(-18°)) = (150 + 90.3, 150 - 29.3) = (240.3, 120.7)
  // Bài báo: 0.70 -> (150 + 70*cos(54°), 150 + 70*sin(54°)) = (150 + 41.1, 150 + 56.6) = (191.1, 206.6)
  // Cộng đồng: 0.60 -> (150 + 60*cos(126°), 150 + 60*sin(126°)) = (150 - 35.2, 150 + 48.5) = (114.8, 198.5)
  // Hướng dẫn: 0.80 -> (150 + 80*cos(198°), 150 + 80*sin(198°)) = (150 - 76.1, 150 - 24.7) = (73.9, 125.3)
  const radarPolygonPoints = '150,65 240,121 191,207 115,199 74,125';

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      alert('Đã chạy mô phỏng phân tích trên dữ liệu mẫu. Chưa kết nối mô hình AI.');
    }, 800);
  };

  const toggleAction = (idx) => {
    setActionDone((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-7 animate-fadeIn">
      {/* 1. Header Row */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Phân tích & Dự báo AI – Award Validator
            </h1>
            <span className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 tracking-wider">
              SMART ENGINE
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Minh họa phân tích trên bộ dữ liệu mẫu năm 2024
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh Data */}
          <button
            onClick={() => alert('Đã làm mới giao diện dữ liệu mẫu')}
            className="px-4 py-2.5 rounded-2xl bg-white dark:bg-soft-darkCard border border-slate-200/80 dark:border-soft-darkBorder text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-2 shadow-soft-sm hover:bg-slate-50 dark:hover:bg-soft-darkCardHover transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Làm mới dữ liệu</span>
          </button>

          {/* Run AI Analysis */}
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2.5 rounded-2xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs flex items-center gap-2 shadow-sm hover:bg-slate-700 dark:hover:bg-white transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-amber-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Đang phân tích...' : 'Chạy phân tích AI'}</span>
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

      {/* 2. Top Grid: Award Validator (Radar) + KPI Recommender */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Left: Award Validator Agent (6 cols) */}
        <div className="lg:col-span-6 soft-card p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Tác tử Xét duyệt (Award Validator Agent)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dự báo: Đủ điều kiện xét Chiến sĩ thi đua cấp Bộ năm 2024.
              </p>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                Lưu ý: Cần bổ sung minh chứng bài báo Q1.
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-500 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
          </div>

          {/* SVG Radar Spider Chart */}
          <div className="relative w-full max-w-sm mx-auto my-6 flex items-center justify-center">
            <svg viewBox="0 0 300 300" className="w-full h-auto overflow-visible">
              {/* Concentric pentagon/circle grids */}
              {[100, 75, 50, 25].map((r, i) => (
                <circle
                  key={i}
                  cx="150"
                  cy="150"
                  r={r}
                  fill="none"
                  stroke={isDark ? '#334155' : '#e2e8f0'}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              ))}

              {/* Axis lines */}
              <line x1="150" y1="150" x2="150" y2="50" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth="1" />
              <line x1="150" y1="150" x2="245" y2="119" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth="1" />
              <line x1="150" y1="150" x2="209" y2="231" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth="1" />
              <line x1="150" y1="150" x2="91" y2="231" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth="1" />
              <line x1="150" y1="150" x2="55" y2="119" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth="1" />

              {/* Radar Area Polygon */}
              <polygon
                points={radarPolygonPoints}
                fill="#2dd4bf"
                fillOpacity={isDark ? '0.25' : '0.3'}
                stroke="#14b8a6"
                strokeWidth="2.5"
                className="transition-all duration-500 hover:fill-opacity-50"
              />

              {/* Data points */}
              {[
                [150, 65],
                [240, 121],
                [191, 207],
                [115, 199],
                [74, 125],
              ].map(([cx, cy], idx) => (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r="4"
                  fill="#0d9488"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="hover:scale-150 transition-transform"
                />
              ))}

              {/* Axis Labels */}
              <text x="150" y="38" textAnchor="middle" className="text-[11px] font-semibold fill-slate-500 dark:fill-slate-400">
                Giảng dạy
              </text>
              <text x="255" y="123" textAnchor="start" className="text-[11px] font-semibold fill-slate-500 dark:fill-slate-400">
                NCKH
              </text>
              <text x="215" y="248" textAnchor="middle" className="text-[11px] font-semibold fill-slate-500 dark:fill-slate-400">
                Bài báo
              </text>
              <text x="80" y="248" textAnchor="middle" className="text-[11px] font-semibold fill-slate-500 dark:fill-slate-400">
                Cộng đồng
              </text>
              <text x="45" y="123" textAnchor="end" className="text-[11px] font-semibold fill-slate-500 dark:fill-slate-400">
                Hướng dẫn
              </text>
            </svg>
          </div>
        </div>

        {/* Right: KPI Recommender Agent (6 cols) */}
        <div className="lg:col-span-6 soft-card p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Tác tử Gợi ý KPI (KPI Recommender Agent)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Trạng thái: Đang theo dõi tiến độ
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>

          {/* Recommender Progress Items */}
          <div className="space-y-6 my-auto py-4">
            {/* Metric 1 */}
            <div>
              <div className="flex justify-between text-xs sm:text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200">
                <span>Bằng khen cấp Bộ</span>
                <span className="font-bold text-teal-600 dark:text-teal-400">82%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: '82%' }} />
              </div>
            </div>

            {/* Metric 2 */}
            <div>
              <div className="flex justify-between text-xs sm:text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200">
                <span>CSTĐ cấp Quốc gia</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">35%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: '35%' }} />
              </div>
              <div className="text-[11px] text-slate-400 italic mt-1.5">
                * Cần hoàn thiện 2 KPI trọng yếu để tăng lên 70%
              </div>
            </div>

            {/* Metric 3 */}
            <div>
              <div className="flex justify-between text-xs sm:text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200">
                <span>Huân chương Lao động</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">12%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-slate-500 dark:bg-slate-400 transition-all duration-500" style={{ width: '12%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Card: Gợi ý KPI 2024 */}
      <div className="soft-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Gợi ý KPI 2024 (Để đạt CSTĐ cấp Bộ 2025)
          </h2>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              Gấp: 02
            </span>
            <span className="px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-semibold">
              Quan trọng: 05
            </span>
          </div>
        </div>

        {/* Suggestion List */}
        <div className="space-y-4">
          {/* Suggestion 1 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-soft-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-soft-sm transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Gợi ý: Xuất bản thêm 1 bài báo Q2 và hướng dẫn 1 nhóm NCKH sinh viên.
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black uppercase tracking-wider">
                    ƯU TIÊN CAO
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-48 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '65%' }} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">65% Đang thực hiện</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleAction(1)}
              title="Gửi duyệt đề xuất"
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all self-end sm:self-center shrink-0 ${
                actionDone[1]
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Suggestion 2 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-soft-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-soft-sm transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    • Hướng dẫn 01 nhóm Sinh viên NCKH đạt giải
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                    CỐT LÕI
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-48 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '90%' }} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">90% Sắp hoàn thành</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleAction(2)}
              title="Đánh dấu hoàn thành"
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all self-end sm:self-center shrink-0 ${
                actionDone[2]
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              <Check className="w-4 h-4" />
            </button>
          </div>

          {/* Suggestion 3 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-soft-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-soft-sm transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Hướng dẫn 02 Học viên cao học bảo vệ thành công
                </span>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-48 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: '40%' }} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">40% Kế hoạch</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleAction(3)}
              title="Thêm mục tiêu"
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all self-end sm:self-center shrink-0 ${
                actionDone[3]
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

