import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, ClipboardCheck, FileUser, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { request } from '../services/request';
import DashboardCalendar from '../components/calendar/DashboardCalendar';

function useDashboardData(url) {
  const [data, setData] = useState(null), [error, setError] = useState(null);
  useEffect(() => { let active = true; request({ url, fresh: true }).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err); }); return () => { active = false; }; }, [url]);
  return { data, error };
}
const shortcuts = [
  { title: 'Kho thành tích', subtitle: 'Lưu thành tích và minh chứng', icon: Award, to: '/achievements', tone: 'mint' },
  { title: 'Khám hồ sơ', subtitle: 'Đối chiếu với quy chế', icon: ClipboardCheck, to: '/me/ai-forecast', tone: 'blue' },
  { title: 'Tạo & Chia sẻ CV', subtitle: 'Thiết kế CV từ hồ sơ của bạn', icon: FileUser, to: '/me/profile?tab=cv', tone: 'mint' },
  { title: 'Mục tiêu / KPI', subtitle: 'Theo dõi việc cần làm', icon: Target, to: '/kpi', tone: 'sand' },
];
export default function Dashboard() {
  const { user } = useAuth();
  const summary = useDashboardData('/reports'), goals = useDashboardData('/kpi/goals?pageSize=4');
  const items = goals.data?.items || [];
  const date = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return <main className="dashboard"><header className="dash-header"><div><h1>Chào mừng trở lại, {user?.fullName || 'bạn'}!</h1><p>{date}</p></div></header>
    <section className="dash-intro-grid"><div className="dash-hero"><div className="dash-hero-copy"><h2>Hành trình thành tích của bạn</h2><p>Lưu giữ những dấu mốc, khám phá cơ hội và tiếp tục phát triển hồ sơ cá nhân.</p><Link to="/achievements">Mở kho thành tích <ArrowRight size={16} aria-hidden="true" /></Link></div><img src="/dashboard-student.png" alt="Sinh viên đang học cùng sách" /></div><div className="dash-summary"><h2>Tổng quan hồ sơ</h2><p>Số liệu từ hồ sơ cá nhân của bạn.</p>{summary.error ? <p role="alert">Không tải được tổng quan: {summary.error.message}</p> : !summary.data ? <p>Đang tải tổng quan…</p> : <dl><div><dt>Thành tích đã lưu</dt><dd>{summary.data.summary.achievementCount}</dd></div><div><dt>Mục tiêu đang theo dõi</dt><dd>{summary.data.summary.kpiCount}</dd></div><div><dt>Lần khám hồ sơ</dt><dd>{summary.data.summary.assessmentCount}</dd></div></dl>}<Link to="/reports">Thống kê & Báo cáo <ArrowRight size={15} aria-hidden="true" /></Link></div></section>
    <section className="dash-shortcuts" aria-label="Thao tác nhanh">{shortcuts.map(({ title, subtitle, icon: Icon, to, tone }) => <Link to={to} key={to}><span className={`dash-shortcut-icon ${tone}`}><Icon size={22} aria-hidden="true" /></span><span><strong>{title}</strong><small>{subtitle}</small></span><ArrowRight size={17} aria-hidden="true" /></Link>)}</section><section className="dash-workspace"><DashboardCalendar /><aside className="dash-goals"><div className="dash-section-head"><div><h2>Lộ trình mục tiêu</h2><p>Tiến độ thực hiện cá nhân</p></div><Target size={20} aria-hidden="true" /></div>{goals.error ? <p role="alert">Không tải được mục tiêu: {goals.error.message}</p> : !goals.data ? <p>Đang tải mục tiêu…</p> : !items.length ? <div className="dash-goals-empty"><Target size={26} aria-hidden="true" /><p>Chưa có mục tiêu nào.</p><span>Bắt đầu từ một mục tiêu cá nhân hoặc tiêu chí còn thiếu.</span><Link className="soft-btn-secondary mt-4" to="/kpi">Tạo mục tiêu đầu tiên</Link></div> : <div className="dash-goals-list">{items.map(goal => <Link to="/kpi" key={goal.id}><strong>{goal.title}</strong><span>{goal.current_value ?? 0} / {goal.target_value} {goal.measure_unit} · {goal.completion_percent ?? 0}%</span><span className="dash-progress"><i style={{ width: `${Math.min(100, Math.max(0, goal.completion_percent || 0))}%` }} /></span></Link>)}</div>}<Link className="dash-goals-link" to="/kpi">Xem toàn bộ mục tiêu <ArrowRight size={16} aria-hidden="true" /></Link></aside></section>
  </main>;
}

