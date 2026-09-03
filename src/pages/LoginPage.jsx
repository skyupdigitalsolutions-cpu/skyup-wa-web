import React, {useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Eye, EyeOff} from 'lucide-react';
import {loginThunk, clearError} from '../store/slices/authSlice';

export default function LoginPage() {
  const dispatch = useDispatch();
  const {loading, error} = useSelector(s => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = e => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    dispatch(clearError());
    dispatch(loginThunk({email: email.trim(), password}));
  };

  return (
    <div className="login-screen">
      <div className="login-logo">S</div>
      <h1 className="login-title">SkyUp WhatsApp</h1>
      <p className="login-subtitle">Admin Communication App</p>
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
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

