import React, {useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Eye, EyeOff, ArrowLeft} from 'lucide-react';
import {
  loginThunk, clearError,
  superAdminLoginThunk, verifySuperAdminOtpThunk, cancelSuperAdminOtp,
} from '../store/slices/authSlice';
import {superAdminAPI} from '../services/apiService';

// FIX (feature gap): this page previously only supported regular
// employee/admin login. Super admin login is a genuinely different,
// two-step flow (email/password → OTP emailed → verify OTP → token), so
// this adds a mode toggle plus the OTP-entry step, rather than trying to
// force it into the same single-step form.
export default function LoginPage() {
  const dispatch = useDispatch();
  const {loading, error, otpPendingEmail} = useSelector(s => s.auth);
  const [mode, setMode] = useState('standard'); // 'standard' | 'superadmin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const handleLogin = e => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    dispatch(clearError());
    if (mode === 'superadmin') {
      dispatch(superAdminLoginThunk({email: email.trim(), password}));
    } else {
      dispatch(loginThunk({email: email.trim(), password}));
    }
  };

  const handleVerifyOtp = e => {
    e.preventDefault();
    if (!otp.trim()) return;
    dispatch(clearError());
    dispatch(verifySuperAdminOtpThunk({email: otpPendingEmail, otp: otp.trim()}));
  };

  const handleResendOtp = async () => {
    setResendMsg('');
    try {
      const res = await superAdminAPI.resendOtp(otpPendingEmail);
      setResendMsg(res.data?.message || 'A new OTP has been sent.');
    } catch (err) {
      setResendMsg(err?.response?.data?.message || 'Could not resend OTP.');
    }
  };

  const backToCredentials = () => {
    dispatch(cancelSuperAdminOtp());
    setOtp('');
    setResendMsg('');
  };

  // ── Step 2: OTP entry (super admin only) ─────────────────────────────────
  if (mode === 'superadmin' && otpPendingEmail) {
    return (
      <div className="login-screen">
        <div className="login-logo">S</div>
        <h1 className="login-title">SkyUp WhatsApp</h1>
        <p className="login-subtitle">Enter the OTP sent to {otpPendingEmail}</p>
        <form className="login-card" onSubmit={handleVerifyOtp}>
          <div className="field">
            <label>OTP Code</label>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              placeholder="6-digit code"
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          {resendMsg && <div className="login-subtitle" style={{marginTop: -8, marginBottom: 8}}>{resendMsg}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Verifying…' : 'Verify & Sign In'}
          </button>
          <button
            type="button"
            onClick={handleResendOtp}
            style={{background: 'none', border: 'none', color: '#00796B', fontSize: 13, marginTop: 10, cursor: 'pointer'}}>
            Resend OTP
          </button>
          <button
            type="button"
            onClick={backToCredentials}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center',
              background: 'none', border: 'none', color: '#667781', fontSize: 13,
              marginTop: 6, cursor: 'pointer',
            }}>
            <ArrowLeft size={14} /> Back
          </button>
        </form>
      </div>
    );
  }

  // ── Step 1: credentials (either mode) ────────────────────────────────────
  return (
    <div className="login-screen">
      <div className="login-logo">S</div>
      <h1 className="login-title">SkyUp WhatsApp</h1>
      <p className="login-subtitle">
        {mode === 'superadmin' ? 'Super Admin Login' : 'Admin Communication App'}
      </p>
      <form className="login-card" onSubmit={handleLogin}>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@company.com"
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label>Password</label>
          <div style={{position: 'relative'}}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{paddingRight: 44}}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', padding: 8,
                color: '#667781', display: 'flex', alignItems: 'center',
              }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading
            ? (mode === 'superadmin' ? 'Sending OTP…' : 'Signing in…')
            : (mode === 'superadmin' ? 'Send OTP' : 'Sign In')}
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch(clearError());
            setMode(m => (m === 'superadmin' ? 'standard' : 'superadmin'));
          }}
          style={{background: 'none', border: 'none', color: '#00796B', fontSize: 13, marginTop: 12, cursor: 'pointer'}}>
          {mode === 'superadmin' ? '← Back to regular login' : 'Login as Super Admin'}
        </button>
      </form>
    </div>
  );
}
