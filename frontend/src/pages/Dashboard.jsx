import React, { useState } from 'react';
import {
  Search,
  Sun,
  Moon,
  Trophy,
  Microscope,
  Presentation,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  BookOpen,
  GraduationCap,
  Users,
  Check,
  Building2,
  User,
  BarChart3,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { demoUser, dashboardSummaries } from '../data/demo';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/common/NotificationBell';

export default function Dashboard() {
  const { isDark, toggleTheme } = useTheme();
  const user = demoUser;
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('personal'); // 'personal' | 'unit'
  const summaryData = dashboardSummaries[viewMode];

  // Calendar dates for Month 4 (April)
  const calendarDays = [
    { day: 28, isPrevMonth: true },
    { day: 29, isPrevMonth: true },
    { day: 30, isPrevMonth: true },
    { day: 31, isPrevMonth: true },
    { day: 1 },
    { day: 2 },
    { day: 3 },
    { day: 4 },
    { day: 5 },
    { day: 6 },
    { day: 7, hasDot: true },
    { day: 8 },
    { day: 9 },
    { day: 10 },
    { day: 11 },
    { day: 12 },
    { day: 13 },
    { day: 14 },
    { day: 15 },
    { day: 16 },
    { day: 17 },
    { day: 18, hasDot: true },
    { day: 19 },
    { day: 20 },
    { day: 21, isSelected: true, hasEvent: true },
    { day: 22 },
    { day: 23 },
    { day: 24 },
  ];



  const { achievements, awards, categories } = summaryData;

  return (
    <div className="space-y-7 animate-fadeIn">
      {/* 1. Header Row */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Chào mừng, {user?.fullName || 'Giảng viên LHU'}!
            </h1>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Hệ thống Quản lý Hồ sơ Thành tích Số & Khen thưởng LHU
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle (Personal vs Unit) */}
          <div className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center shadow-soft-sm">
            <button
              onClick={() => setViewMode('personal')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'personal'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Cá nhân
            </button>
            <button
              onClick={() => setViewMode('unit')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'unit'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Đơn vị / Khoa
            </button>
          </div>

          {/* Reports quick button */}
          <button
            onClick={() => navigate('/ai-forecast')}
            title="Xem phân tích & dự báo AI"
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 shadow-soft-sm transition-all"
          >
            <BarChart3 className="w-5 h-5" />
          </button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-soft-sm transition-all"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* 2. Top Hero Grid: Hero Banner + Health Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Hero Banner (8 cols) */}
        <div className="lg:col-span-8 rounded-[28px] bg-gradient-to-br from-[#ebd9c3] to-[#dfc5a7] dark:from-[#2c241c] dark:to-[#3d3226] p-7 sm:p-9 relative overflow-hidden flex flex-col justify-between min-h-[220px] shadow-soft-sm">
          <div className="relative z-10 max-w-md">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 dark:bg-black/30 backdrop-blur-sm text-xs font-bold text-slate-800 dark:text-amber-200 mb-2 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Chế độ {viewMode === 'personal' ? 'Hồ sơ Cá nhân' : 'Tổng hợp Đơn vị'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-amber-100 leading-snug">
              Trung tâm Quản trị <br />
              Thành tích & Thi đua Số
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-amber-200/80 mt-2 leading-relaxed">
              Theo dõi thành tích, hồ sơ năng lực và mục tiêu thi đua trong cùng một giao diện.
            </p>
          </div>

          <div className="relative z-10 mt-6 flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
            >
              Xem Hồ sơ năng lực
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/ai-forecast')}
              className="px-4 py-2.5 rounded-2xl bg-white/50 dark:bg-black/30 backdrop-blur-sm text-slate-900 dark:text-white font-bold text-xs hover:bg-white/70 transition-all"
            >
              Phân tích & Dự báo AI
            </button>
          </div>
        </div>

        {/* Right Health Widget (4 cols) */}
        <div className="lg:col-span-4 rounded-[28px] bg-[#dff1f8] dark:bg-[#1a2c38] p-7 flex flex-col justify-between shadow-soft-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-cyan-100">
              Chỉ số Thành tích Chuẩn hóa
            </h3>
            <p className="text-xs text-slate-500 dark:text-cyan-300/70 mt-0.5">
              Số liệu {viewMode === 'personal' ? 'cá nhân' : 'toàn đơn vị'} năm 2024
            </p>
          </div>

          <div className="space-y-4 my-auto py-2">
            {/* Metric 1 */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-200">
                <span>Thành tích Nghiên cứu (Q1, Q2, Đề tài)</span>
                <span className="font-bold text-slate-800 dark:text-white">{categories.RESEARCH} mục</span>
              </div>
              <div className="w-full h-3 rounded-full bg-white/70 dark:bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#5b86b8] transition-all duration-500"
                  style={{ width: `${Math.min(100, categories.RESEARCH * 20)}%` }}
                />
              </div>
            </div>

            {/* Metric 2 */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-200">
                <span>Danh hiệu Thi đua</span>
                <span className="font-bold text-slate-800 dark:text-white">{awards.RecordedCount} danh hiệu</span>
              </div>
              <div className="w-full h-3 rounded-full bg-white/70 dark:bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#8fa46e] transition-all duration-500"
                  style={{ width: `${Math.min(100, awards.RecordedCount * 25)}%` }}
                />
              </div>
            </div>

            {/* Metric 3 */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-200">
                <span>Hồ sơ đang chờ duyệt</span>
                <span className="font-bold text-slate-800 dark:text-white">{achievements.PendingCount} hồ sơ</span>
              </div>
              <div className="w-full h-3 rounded-full bg-white/70 dark:bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#e58080] transition-all duration-500"
                  style={{ width: `${Math.min(100, achievements.PendingCount * 30)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Real KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: VERIFIED Achievements */}
        <div className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-sm hover:shadow-soft-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Check className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              ĐÃ XÁC NHẬN
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {achievements.VerifiedCount}
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
            Thành tích đã xác nhận
          </div>
        </div>

        {/* Card 2: RECORDED Awards */}
        <div className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-sm hover:shadow-soft-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Trophy className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
              KHEN THƯỞNG
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {awards.RecordedCount}
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
            Danh hiệu khen thưởng chính thức
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-sm hover:shadow-soft-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              CHỜ DUYỆT
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {achievements.PendingCount}
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
            Hồ sơ đang chờ Cán bộ thẩm định
          </div>
        </div>

        {/* Card 4: Revoked Records */}
        <div className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft-sm hover:shadow-soft-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              ĐÃ THU HỒI
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {achievements.RevokedCount + awards.RevokedAwardCount}
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
            Hồ sơ & Danh hiệu bị thu hồi
          </div>
        </div>
      </div>

      {/* 4. Mini Calendar Section */}
      <div className="soft-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-brand-600" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">Lịch Kê khai & Xét duyệt Thi đua (Tháng 4/2024)</span>
          </div>
          <button onClick={() => navigate('/profile')} className="text-xs font-bold text-brand-600 hover:underline">
            Xem hồ sơ năng lực →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, idx) => (
            <div key={idx} className="font-bold text-slate-400 py-1">{d}</div>
          ))}
          {calendarDays.map((item, idx) => (
            <div
              key={idx}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                item.isSelected
                  ? 'bg-brand-600 text-white shadow-md'
                  : item.isPrevMonth
                  ? 'text-slate-300 dark:text-slate-600'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.day}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

