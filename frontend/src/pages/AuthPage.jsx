import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Mail, LockKeyhole } from 'lucide-react';
import { BookLoader } from '../components/auth/BookLoader';
import { ThemeSwitch } from '../components/auth/ThemeSwitch';
import { useTheme } from '../hooks/useTheme';
import { useDemoAuth } from '../hooks/useDemoAuth';
import './auth.css';

export default function AuthPage() {
  const { theme, toggleTheme: onToggleTheme } = useTheme();
  const { signIn } = useDemoAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [transitionStage, setTransitionStage] = useState('idle');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [remember, setRemember] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const timers = useRef([]);
  const registerLoading = false;
  const resetLoading = false;
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const switchMode = next => {
    setMode(next); setError(null); setSuccess(null);
    setEmail(''); setPassword(''); setFullName(''); setShowPassword(false);
  };
  const handleLogin = async (event) => {
    event.preventDefault();
    if (transitionStage !== 'idle') return;
    setError(null);
    setTransitionStage('loading');

    try {
      await signIn({ username: email, password, rememberMe: remember });
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTransitionStage('expanding');
      timers.current.push(
        setTimeout(() => {
          navigate('/', { replace: true });
        }, reduced ? 0 : 500)
      );
    } catch (err) {
      setTransitionStage('idle');
      setError(err.message || 'Tài khoản hoặc mật khẩu không chính xác');
    }
  };

  const fillQuickAccount = (quickUser, quickPass = 'demo1234') => {
    setEmail(quickUser);
    setPassword(quickPass);
    setError(null);
  };
  const handleRegister = event => {
    event.preventDefault();
    if (!fullName.trim()) { setError('Vui lòng nhập họ tên.'); return; }
    setError(null); setPassword('');
    setSuccess('Đã hoàn tất bước đăng ký mô phỏng. Chưa tạo tài khoản hay gửi email. Chọn Sign In để trải nghiệm.');
  };
  const handleForgotPassword = () => {
    setError(null); setSuccess(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Nhập email hợp lệ trước khi dùng quên mật khẩu.'); return;
    }
    setPassword('');
    setSuccess('Đây là mô phỏng quên mật khẩu; chưa gửi email. Bạn có thể quay lại đăng nhập demo.');
  };
  const isLogin = mode === 'login';
  const isPendingTransition = transitionStage !== 'idle';
  return (
    <div className="ptud-auth">
    <div className={`auth-wrapper ${isLogin ? 'login' : 'register'} ${isPendingTransition ? 'stage-loading' : ''} ${transitionStage === 'expanding' ? 'stage-expand' : ''}`}>
      <ThemeSwitch checked={theme === 'dark'} onChange={onToggleTheme} className="auth-theme-switch" />
      <div className="login-card">
        
        {/* --- Background SVG Clouds Container (Slides left and right) --- */}
        <div className={`bg-svg-container ${isLogin ? 'login' : 'register'}`}>
          
          {/* SVG 1: LOGIN (White cloud on the right) */}
          <svg className="bg-svg-item" viewBox="0 0 1000 562" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="white-cloud-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="-8" dy="6" stdDeviation="8" floodOpacity="0.3"/>
              </filter>
              <filter id="blue-cloud-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="6" dy="6" stdDeviation="9" floodOpacity="0.25"/>
              </filter>
            </defs>
            
            <rect width="1000" height="562" fill="#164877"/>
            
            <g className="blue-layer" filter="url(#blue-cloud-shadow)" fill="#113659">
              <circle cx="100" cy="20" r="140" />
              <circle cx="260" cy="-10" r="120" />
              <circle cx="380" cy="-40" r="100" />
            </g>
            
            <g className="blue-layer" filter="url(#blue-cloud-shadow)" fill="#133f67">
              <circle cx="50" cy="60" r="130" />
              <circle cx="190" cy="40" r="120" />
              <circle cx="320" cy="10" r="110" />
            </g>
            
            <g className="blue-layer" filter="url(#blue-cloud-shadow)" fill="#184e82">
              <circle cx="-20" cy="420" r="150" />
              <circle cx="120" cy="490" r="140" />
              <circle cx="280" cy="540" r="120" />
            </g>
            <g className="blue-layer" filter="url(#blue-cloud-shadow)" fill="#1b568f">
              <circle cx="60" cy="510" r="130" />
              <circle cx="210" cy="560" r="120" />
            </g>
            
            <g className="white-layer" filter="url(#white-cloud-shadow)" fill="#ffffff">
              <polygon points="1000,0 720,0 620,150 530,290 420,470 420,562 1000,562" />
              <circle cx="720" cy="30" r="90" />
              <circle cx="620" cy="150" r="100" />
              <circle cx="530" cy="290" r="120" />
              <circle cx="420" cy="470" r="160" />
            </g>
          </svg>

          {/* SVG 2: REGISTER (Mirrored: White cloud on the left) */}
          <svg className="bg-svg-item" viewBox="0 0 1000 562" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="white-cloud-shadow-reg" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="8" dy="6" stdDeviation="8" floodOpacity="0.3"/>
              </filter>
              <filter id="blue-cloud-shadow-reg" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="-6" dy="6" stdDeviation="9" floodOpacity="0.25"/>
              </filter>
            </defs>
            
            <rect width="1000" height="562" fill="#164877"/>
            
            <g className="blue-layer" filter="url(#blue-cloud-shadow-reg)" fill="#113659">
              <circle cx="900" cy="20" r="140" />
              <circle cx="740" cy="-10" r="120" />
              <circle cx="620" cy="-40" r="100" />
            </g>
            
            <g className="blue-layer" filter="url(#blue-cloud-shadow-reg)" fill="#133f67">
              <circle cx="950" cy="60" r="130" />
              <circle cx="810" cy="40" r="120" />
              <circle cx="680" cy="10" r="110" />
            </g>
            
            <g className="blue-layer" filter="url(#blue-cloud-shadow-reg)" fill="#184e82">
              <circle cx="1020" cy="420" r="150" />
              <circle cx="880" cy="490" r="140" />
              <circle cx="740" cy="540" r="120" />
            </g>
            <g className="blue-layer" filter="url(#blue-cloud-shadow-reg)" fill="#1b568f">
              <circle cx="940" cy="510" r="130" />
              <circle cx="810" cy="560" r="120" />
            </g>
            
            <g className="white-layer" filter="url(#white-cloud-shadow-reg)" fill="#ffffff">
              <polygon points="0,0 280,0 380,150 470,290 580,470 580,562 0,562" />
              <circle cx="280" cy="30" r="90" />
              <circle cx="380" cy="150" r="100" />
              <circle cx="470" cy="290" r="120" />
              <circle cx="580" cy="470" r="160" />
            </g>
          </svg>

        </div>

        {/* --- Brand / Logo Container --- */}
        <div className={`brand-logo-container ${isLogin ? 'login' : 'register'}`}>
          <img src="/lhu-logo.png" alt="LHU Logo" className="brand-logo-img" />
        </div>

        {/* --- Form Container --- */}
        <div className={`form-container ${isLogin ? 'login' : 'register'}`}>
          <h1>{isLogin ? 'LOGIN' : 'REGISTER'}</h1>
          <p className="demo-notice">Bản trải nghiệm · Không dùng mật khẩu thật.<br />Nhập email hợp lệ và mật khẩu bất kỳ từ 6 ký tự để vào demo.</p>

          {error && <div role="alert" className="alert-box alert-error">{error}</div>}
          {success && <div role="status" className="alert-box alert-success">{success}<button type="button" className="forgot-password-link" onClick={() => switchMode('login')}>Quay lại đăng nhập</button></div>}

          {!success && (
            <form onSubmit={isLogin ? handleLogin : handleRegister}>
              {/* Full Name field (Register only) */}
              {!isLogin && (
                <div className="input-box">
                  <User size={18} aria-hidden="true" />
                  <input 
                    type="text" 
                    placeholder="Họ và tên" aria-label="Họ và tên" autoComplete="name" 
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    disabled={registerLoading}
                  />
                </div>
              )}

              {/* Email field */}
              <div className="input-box">
                <Mail size={18} aria-hidden="true" />
                <input 
                  type="email" 
                  placeholder="Email" aria-label="Email" autoComplete="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={isPendingTransition || registerLoading}
                />
              </div>

              {/* Password field */}
              <div className="input-box">
                <LockKeyhole size={18} aria-hidden="true" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Mật khẩu demo" aria-label="Mật khẩu demo" minLength={6} autoComplete={isLogin ? "current-password" : "new-password"} 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={isPendingTransition || registerLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(current => !current)}
                  disabled={isPendingTransition || registerLoading}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>

              {isLogin && (
                <label className="remember-row">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    disabled={isPendingTransition || registerLoading}
                  />
                  <span>Ghi nhớ phiên demo</span>
                </label>
              )}

              <button 
                type="submit" 
                className="btn btn-signin"
                disabled={isPendingTransition || registerLoading || resetLoading}
              >
                {registerLoading || resetLoading ? 'Đang xử lý...' : isLogin ? 'Sign In' : 'Sign Up'}
              </button>
              {isLogin && (
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={handleForgotPassword}
                  disabled={isPendingTransition || registerLoading || resetLoading}
                >
                  Quên mật khẩu?
                </button>
              )}

              {isLogin && (
                <div className="quick-accounts-section my-3 text-left">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>Tài khoản thử nghiệm:</span>
                    <span className="text-[10px] text-brand-600 font-mono">pass: demo1234</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => fillQuickAccount('an.nv')}
                      className="px-2 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border border-slate-200 transition-colors"
                    >
                      Giảng viên (an.nv)
                    </button>
                    <button
                      type="button"
                      onClick={() => fillQuickAccount('bich.tt')}
                      className="px-2 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border border-slate-200 transition-colors"
                    >
                      Quản lý FIT (bich.tt)
                    </button>
                    <button
                      type="button"
                      onClick={() => fillQuickAccount('duc.pm')}
                      className="px-2 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border border-slate-200 transition-colors"
                    >
                      Admin (duc.pm)
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          <div className="or-divider">
            <span>Or</span>
          </div>

          <button 
            type="button" 
            className="btn btn-signup"
            onClick={() => !isPendingTransition && !registerLoading && switchMode(isLogin ? 'register' : 'login')}
            disabled={isPendingTransition || registerLoading}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

      </div>

      {/* ================= LOADING OVERLAY ================= */}
      {isPendingTransition && (
        <div className="loading-overlay">
          <BookLoader />
        </div>
      )}
    </div>
    </div>
  )
}
