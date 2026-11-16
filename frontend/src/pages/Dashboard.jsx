import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, Award, ClipboardCheck, FileUser, Target, Plus, 
  GraduationCap, BookOpen, Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { request } from '../services/request';
import DashboardCalendar from '../components/calendar/DashboardCalendar';

function useDashboardData(url) {
  const [data, setData] = useState(null), [error, setError] = useState(null);
  useEffect(() => { 
    let active = true; 
    request({ url, fresh: true })
      .then(value => { if (active) setData(value); })
      .catch(err => { if (active) setError(err); }); 
    return () => { active = false; }; 
  }, [url]);
  return { data, error };
}

const shortcuts = [
  { 
    title: 'Kho thành tích', 
    subtitle: 'Lưu thành tích và minh chứng', 
    icon: Award, 
    to: '/achievements', 
    tone: 'mint' 
  },
  { 
    title: 'Khám hồ sơ', 
    subtitle: 'Đối chiếu với quy chế', 
    icon: ClipboardCheck, 
    to: '/me/ai-forecast', 
    tone: 'blue' 
  },
  { 
    title: 'Tạo & Chia sẻ CV', 
    subtitle: 'Thiết kế CV từ hồ sơ cá nhân', 
    icon: FileUser, 
    to: '/me/profile?tab=cv', 
    tone: 'teal' 
  },
  { 
    title: 'Mục tiêu / KPI', 
    subtitle: 'Theo dõi việc cần làm', 
    icon: Target, 
    to: '/kpi', 
    tone: 'amber' 
  },
];

const goalIcons = [BookOpen, GraduationCap, Layers, Target];

export default function Dashboard() {
  const { user } = useAuth();
  const summary = useDashboardData('/reports');
  const goals = useDashboardData('/kpi/goals?pageSize=4');
  const items = goals.data?.items || [];
  
  const dateFormatted = new Intl.DateTimeFormat('vi-VN', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric', 
    weekday: 'long' 
  }).format(new Date());

  const achievementCount = summary.data?.summary?.achievementCount ?? 0;
  const kpiCount = summary.data?.summary?.kpiCount ?? 0;
  const assessmentCount = summary.data?.summary?.assessmentCount ?? 0;

  return (
    <main className="dashboard">
      {/* Header chào mừng */}
      <header className="dash-header">
        <div>
          <h1>Chào mừng trở lại, {user?.fullName || 'bạn'}!</h1>
          <p>{dateFormatted}</p>
        </div>
      </header>

      {/* Hero Banner + Thẻ Tổng quan hồ sơ (AI metrics) */}
      <section className="dash-intro-grid">
        {/* Banner Bạn Chibi 3D với backdrop caramel ấm */}
        <div className="dash-hero">
          <div className="dash-hero-backdrop" aria-hidden="true" />
          <div className="dash-hero-copy">
            <h2>Hệ thống Quản lý Thành tích & Dự báo AI</h2>
            <p>
              Theo dõi tiến độ, lưu trữ minh chứng và phát triển hồ sơ cá nhân một cách trực quan nhất.
            </p>
            <Link to="/achievements" className="dash-hero-btn">
              Khám phá thành tích <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="dash-hero-art">
            <img 
              src="/dashboard-student.png" 
              alt="Minh họa sinh viên đang học tập và nghiên cứu" 
            />
          </div>
        </div>

        {/* Thẻ Tổng quan chỉ số hồ sơ (Soft Ice Blue Card) */}
        <div className="dash-summary">
          <div className="dash-summary-header">
            <h2>Tổng quan hồ sơ</h2>
            <p>Các chỉ số hoạt động cá nhân của bạn</p>
          </div>

          {summary.error ? (
            <p role="alert" className="text-sm text-rose-600 mt-4">
              Không tải được số liệu: {summary.error.message}
            </p>
          ) : !summary.data ? (
            <div className="dash-summary-loading">Đang tải số liệu tổng quan…</div>
          ) : (
            <div className="dash-summary-bars">
              <div className="metric-item">
                <div className="metric-header">
                  <span>Thành tích & Minh chứng</span>
                  <span className="metric-val">{achievementCount} mục</span>
                </div>
                <div className="metric-track">
                  <div 
                    className="metric-fill metric-blue" 
                    style={{ width: `${Math.min(100, Math.max(12, achievementCount * 14))}%` }} 
                  />
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-header">
                  <span>Mục tiêu đang theo dõi</span>
                  <span className="metric-val">{kpiCount} mục</span>
                </div>
                <div className="metric-track">
                  <div 
                    className="metric-fill metric-green" 
                    style={{ width: `${Math.min(100, Math.max(15, kpiCount * 30))}%` }} 
                  />
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-header">
                  <span>Lần khám & Đối chiếu quy chế</span>
                  <span className="metric-val">{assessmentCount} lượt</span>
                </div>
                <div className="metric-track">
                  <div 
                    className="metric-fill metric-coral" 
                    style={{ width: `${Math.min(100, Math.max(15, assessmentCount * 25))}%` }} 
                  />
                </div>
              </div>
            </div>
          )}

          <Link to="/reports" className="dash-summary-footer">
            <span>Xem báo cáo chi tiết</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* 4 Thẻ lối tắt nhanh (Soft UI Cards) */}
      <section className="dash-shortcuts" aria-label="Thao tác nhanh">
        {shortcuts.map(({ title, subtitle, icon: Icon, to, tone }) => (
          <Link to={to} key={to} className="dash-shortcut-card">
            <span className={`dash-shortcut-badge ${tone}`}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <span className="dash-shortcut-content">
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </span>
            <span className={`dash-shortcut-plus ${tone}`} aria-hidden="true">
              <Plus size={16} />
            </span>
          </Link>
        ))}
      </section>

      {/* Workspace: Lịch cá nhân (Trái) & Lộ trình mục tiêu (Phải) */}
      <section className="dash-workspace">
        <DashboardCalendar />

        {/* Cột Lộ trình mục tiêu */}
        <aside className="dash-goals" aria-labelledby="goals-heading">
          <div className="dash-section-head">
            <div>
              <h2 id="goals-heading">Lộ trình mục tiêu</h2>
              <p>Tiến độ thực hiện cá nhân</p>
            </div>
            <Link to="/kpi" className="dash-goals-add" aria-label="Tạo mục tiêu mới">
              <Plus size={18} />
            </Link>
          </div>

          {goals.error ? (
            <p role="alert" className="text-sm text-rose-600 mt-4">
              Không tải được mục tiêu: {goals.error.message}
            </p>
          ) : !goals.data ? (
            <p className="text-sm text-slate-500 mt-4">Đang tải mục tiêu…</p>
          ) : !items.length ? (
            <div className="dash-goals-empty">
              <Target size={28} aria-hidden="true" />
              <p>Chưa có mục tiêu nào.</p>
              <span>Bắt đầu từ một mục tiêu cá nhân hoặc tiêu chí còn thiếu của quy chế.</span>
              <Link className="soft-btn-primary mt-4" to="/kpi">
                <Plus size={16} /> Tạo mục tiêu đầu tiên
              </Link>
            </div>
          ) : (
            <div className="dash-goals-cards">
              {items.map((goal, index) => {
                const GoalIcon = goalIcons[index % goalIcons.length];
                const percent = Math.min(100, Math.max(0, goal.completion_percent || 0));
                const colors = ['progress-blue', 'progress-green', 'progress-coral', 'progress-amber'];
                const colorClass = colors[index % colors.length];

                return (
                  <Link to="/kpi" key={goal.id} className="dash-goal-card">
                    <div className="dash-goal-head">
                      <span className={`dash-goal-icon ${colorClass}`} aria-hidden="true">
                        <GoalIcon size={18} />
                      </span>
                      <div className="dash-goal-title">
                        <strong>{goal.title}</strong>
                        {goal.due_date && (
                          <small>Hạn: {String(goal.due_date).slice(0, 10)}</small>
                        )}
                      </div>
                    </div>
                    <div className="dash-goal-progress-wrap">
                      <div className="dash-goal-meta">
                        <span>{goal.current_value ?? 0}/{goal.target_value} {goal.measure_unit}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="dash-goal-track">
                        <div 
                          className={`dash-goal-bar ${colorClass}`} 
                          style={{ width: `${percent}%` }} 
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <Link className="dash-goals-link" to="/kpi">
            <span>Xem toàn bộ lộ trình</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </section>
    </main>
  );
}
