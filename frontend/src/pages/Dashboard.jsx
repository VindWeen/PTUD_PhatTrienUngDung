import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  BellRing,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Microscope,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/common/AsyncState';
import { portfolioApi } from '../services/portfolioApi';

const calendarDays = [
  { day: 28, muted: true }, { day: 29, muted: true }, { day: 30, muted: true }, { day: 31, muted: true },
  { day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 }, { day: 6 }, { day: 7, dot: true },
  { day: 8 }, { day: 9 }, { day: 10 }, { day: 11 }, { day: 12 }, { day: 13 }, { day: 14 },
  { day: 15 }, { day: 16 }, { day: 17 }, { day: 18, dot: true }, { day: 19 }, { day: 20 },
  { day: 21, selected: true, hasEvent: true }, { day: 22 }, { day: 23 }, { day: 24 }, { day: 25 }, { day: 26 }, { day: 27 },
];

const actionCards = [
  { title: 'Khen thưởng', subtitle: 'Danh sách giải thưởng', icon: Award, tone: 'teal', route: '/me/profile' },
  { title: 'Nghiên cứu', subtitle: 'Kho lưu trữ đề tài', icon: Microscope, tone: 'blue', route: '/me/profile' },
  { title: 'Giảng dạy', subtitle: 'Lịch trình & giáo án', icon: GraduationCap, tone: 'amber', route: '/me/profile' },
];

const toneStyles = {
  teal: 'bg-[#dff5f3] text-[#69c9c4]',
  blue: 'bg-[#e7f0fc] text-[#7da8e7]',
  amber: 'bg-[#fff6da] text-[#ffc83d]',
};

function ProgressMetric({ label, value, percent, color }) {
  return <div>
    <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
      <span>{label}</span><span>{value}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-white/75 dark:bg-slate-700">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(6, Math.min(100, percent))}%` }} />
    </div>
  </div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredEventDay, setHoveredEventDay] = useState(null);
  const [selectedEventDay, setSelectedEventDay] = useState(null);

  const loadSummary = useCallback(async () => {
    setLoading(true); setError(null);
    try { setSummary(await portfolioApi.getDashboardSummary()); }
    catch (loadError) { setSummary(null); setError(loadError); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const todayLabel = useMemo(() => new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: 'long', year: 'numeric', weekday: 'long',
  }).format(new Date()), []);

  if (loading) return <LoadingState label="Đang tải tổng quan..." />;
  if (error) return <ErrorState error={error} onRetry={loadSummary} />;
  if (!summary) return <EmptyState message="Chưa có dữ liệu tổng quan." />;

  const researchCount = summary.categories?.RESEARCH || 0;
  const awardCount = summary.awards?.RecordedCount || 0;
  const pendingCount = summary.achievements?.PendingCount || 0;

  return <div className="animate-fadeIn space-y-6 pb-3">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[25px] font-extrabold leading-tight tracking-tight text-slate-800 dark:text-white sm:text-[30px]">
          Chào mừng trở lại, {user?.displayName || user?.lecturerProfile?.fullName || 'Giảng viên LHU'}!
        </h1>
        <p className="mt-1 text-xs font-medium capitalize text-slate-400">{todayLabel}</p>
      </div>
      <label className="flex h-11 w-full items-center gap-2 rounded-2xl bg-white px-4 shadow-[0_8px_24px_rgba(55,78,107,0.05)] dark:bg-slate-900 sm:w-[290px]">
        <Search className="h-4 w-4 text-slate-300" />
        <input aria-label="Tìm kiếm thành tích" placeholder="Tìm kiếm thành tích..." className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-300 dark:text-white" />
      </label>
    </header>

    <section className="grid gap-6 lg:grid-cols-12">
      <div className="relative min-h-[250px] overflow-hidden rounded-[30px] bg-[#e7ccae] px-7 py-6 dark:bg-[#382f27] sm:px-9 lg:col-span-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[#f1e6d3] via-[#e7ccae] to-[#e7ccae] dark:from-[#382f27] dark:via-[#382f27] dark:to-[#382f27]" />
        <div className="absolute -right-3 -top-20 h-64 w-[62%] rounded-[50%] bg-[#bd8d3d] dark:bg-[#946a2e]" />
        <div className="absolute bottom-[-120px] right-[24%] h-64 w-72 rounded-full bg-[#bd8d3d] dark:bg-[#946a2e]" />
        <div className="relative z-10 max-w-[290px]">
          <h2 className="text-[27px] font-black leading-[1.08] text-slate-800 dark:text-amber-50 sm:text-[31px]">
            Hệ thống Quản lý<br />Thành tích & Dự<br />báo AI
          </h2>
          <p className="mt-3 max-w-[270px] text-[13px] font-medium leading-5 text-slate-600 dark:text-amber-100/75">
            Chúng tôi giúp bạn theo dõi tiến độ nghiên cứu và giảng dạy một cách trực quan nhất.
          </p>
        </div>
        <img src="/dashboard-student.png" alt="Sinh viên áo xanh đang học cùng các chồng sách" className="absolute bottom-0 right-0 z-10 h-full w-[62%] object-cover object-[70%_54%] drop-shadow-xl" />
      </div>

      <div className="flex min-h-[240px] flex-col rounded-[30px] bg-[#d7eff4] p-7 dark:bg-[#19313b] lg:col-span-4">
        <h2 className="text-base font-extrabold text-slate-700 dark:text-cyan-50">Khám sức khỏe thành tích (AI)</h2>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-cyan-100/60">Các tham số cần được cải thiện!</p>
        <div className="mt-6 space-y-4">
          <ProgressMetric label="Nghiên cứu khoa học" value={`${Math.min(100, researchCount * 7)}%`} percent={researchCount * 7} color="bg-[#78a5d1]" />
          <ProgressMetric label="Giảng dạy" value="65%" percent={65} color="bg-[#96aa70]" />
          <ProgressMetric label="Dự báo CSTĐ Cơ sở" value={`${Math.min(100, awardCount * 28)}%`} percent={awardCount * 28} color="bg-[#e28b8c]" />
        </div>
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-9">
        <div className="grid gap-4 sm:grid-cols-3">
          {actionCards.map(({ title, subtitle, icon: Icon, tone, route }) => <button key={title} onClick={() => navigate(route)} className="group flex min-h-[92px] items-center gap-4 rounded-[27px] bg-white p-4 text-left shadow-[0_8px_28px_rgba(55,78,107,0.05)] transition hover:-translate-y-1 hover:shadow-lg dark:bg-slate-900">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneStyles[tone]}`}><Icon className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1"><strong className="block text-base font-extrabold text-slate-700 dark:text-slate-100">{title}</strong><small className="mt-1 block text-xs font-medium text-slate-400">{subtitle}</small></span>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${tone === 'teal' ? 'bg-[#74d0ca]' : tone === 'blue' ? 'bg-[#91b9ed]' : 'bg-[#ffd04e]'}`}><Plus className="h-3 w-3" /></span>
          </button>)}
        </div>

        <div className="relative min-h-[385px] overflow-hidden rounded-[34px] bg-white p-7 shadow-[0_8px_30px_rgba(55,78,107,0.05)] dark:bg-slate-900 sm:p-9" onMouseLeave={() => setHoveredEventDay(null)}>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Lịch xét duyệt - Tháng 4</h2>
            <div className="flex gap-4"><button aria-label="Tháng trước"><ChevronLeft className="h-5 w-5 text-slate-300" /></button><button aria-label="Tháng sau"><ChevronRight className="h-5 w-5 text-slate-700 dark:text-white" /></button></div>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px]">
            {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map((day) => <div key={day} className="pb-4 font-medium text-slate-400">{day}</div>)}
            {calendarDays.map((item, index) => <div
              key={`${item.day}-${index}`}
              className="relative flex h-[53px] items-center justify-center"
              onMouseEnter={() => item.hasEvent && setHoveredEventDay(item.day)}
              onMouseLeave={() => item.hasEvent && setHoveredEventDay(null)}
            >
              <button
                type="button"
                aria-label={item.hasEvent ? `Ngày ${item.day}, có lịch Hội đồng xét duyệt` : `Ngày ${item.day}`}
                aria-expanded={item.hasEvent ? hoveredEventDay === item.day || selectedEventDay === item.day : undefined}
                onFocus={() => item.hasEvent && setHoveredEventDay(item.day)}
                onBlur={() => setHoveredEventDay(null)}
                onClick={() => item.hasEvent ? setSelectedEventDay((value) => value === item.day ? null : item.day) : setSelectedEventDay(null)}
                className={`flex h-10 w-16 items-center justify-center rounded-xl text-xs font-semibold transition ${item.hasEvent ? 'cursor-pointer ring-offset-2 hover:ring-2 hover:ring-[#70d5cf] focus:outline-none focus:ring-2 focus:ring-[#70d5cf]' : 'cursor-default'} ${item.selected ? 'bg-[#ddf2ef] text-[#60cec3]' : item.muted ? 'text-slate-200 dark:text-slate-700' : 'text-slate-700 dark:text-slate-200'}`}
              >{item.day}</button>
              {item.dot && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-amber-400" />}
              {item.hasEvent && (hoveredEventDay === item.day || selectedEventDay === item.day) && <div role="dialog" aria-label="Chi tiết lịch Hội đồng xét duyệt" className="absolute left-[calc(50%+30px)] top-1/2 z-30 w-[230px] -translate-y-1/2 animate-fadeIn rounded-[20px] border border-[#6ed4cf] bg-white/95 p-4 text-left shadow-xl backdrop-blur dark:bg-slate-800/95">
                <div className="flex items-start justify-between"><div><h3 className="text-sm font-extrabold text-slate-700 dark:text-white">Hội đồng xét duyệt</h3><p className="mt-0.5 text-[11px] text-slate-400">Phòng Hội thảo 1</p></div><span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-white"><BellRing className="h-4 w-4" /></span></div>
                <div className="mt-3 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ddf5f3] text-[#6bcfc7]"><CalendarDays className="h-4 w-4" /></span><div><strong className="block text-xs text-slate-700 dark:text-white">11:30 - 12:30</strong><small className="text-[10px] font-medium text-[#58c7be]">Xác nhận tham gia</small></div></div>
              </div>}
            </div>)}
          </div>
        </div>
      </div>

      <aside className="flex min-h-[500px] flex-col rounded-[30px] bg-white p-5 shadow-[0_8px_28px_rgba(55,78,107,0.05)] dark:bg-slate-900 xl:col-span-3">
        <h2 className="mt-2 text-center text-lg font-extrabold text-slate-700 dark:text-white">Gợi ý lộ trình KPI 2026-2027</h2>
        <p className="mt-1.5 text-center text-[11px] font-medium leading-4 text-amber-600">Gợi ý mô phỏng, chưa phải dữ liệu xét thưởng</p>
        <div className="mt-5 space-y-3">
          {[
            { icon: BookOpen, title: 'Xuất bản 02 giáo trình', due: 'Hạn: 02/2027', width: '76%', color: 'bg-[#78a5d1]' },
            { icon: GraduationCap, title: 'Hướng dẫn 03 nghiên cứu sinh', due: 'Hạn: 02/2027', width: '62%', color: 'bg-[#97aa70]' },
            { icon: Users, title: 'Hoàn thiện hồ sơ hội đồng', due: 'Hạn: 02/2027', width: '28%', color: 'bg-[#e28b8c]' },
          ].map(({ icon: Icon, title, due, width, color }) => <div key={title} className="rounded-2xl bg-white p-3.5 shadow-[0_3px_8px_rgba(15,23,42,0.18)] dark:bg-slate-800">
            <div className="flex gap-3"><Icon className="mt-0.5 h-6 w-6 shrink-0 text-slate-500" /><div className="min-w-0 flex-1"><div className="text-[13px] font-extrabold leading-4 text-slate-700 dark:text-slate-200">{title}</div><div className="mt-1 text-[10px] font-medium text-slate-400">{due}</div><div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-full rounded-full ${color}`} style={{ width }} /></div></div></div>
          </div>)}
        </div>
        <button onClick={() => navigate('/me/ai-forecast')} className="mt-auto flex items-center justify-center gap-2 pb-1 text-xs font-bold text-slate-600 dark:text-slate-300">Xem toàn bộ lộ trình <ChevronDown className="h-5 w-5" /></button>
      </aside>
    </section>
  </div>;
}
