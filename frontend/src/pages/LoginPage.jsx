import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { API_BASE } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n/useI18n';
import { GlobeIcon, EyeIcon, EyeOffIcon } from '../components/Icons';
import logo from '../assets/logo.png';

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const { t, toggleLanguage, nextLangLabel, nextLangCode, translateServerError } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (token) return <Navigate to="/" replace />;

  function showError(message, color) {
    setError({ message, color: color || 'var(--bp-danger)' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password, remember })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showError(body.error ? translateServerError(body.error) : t('auth.loginFailed'));
        return;
      }
      const { token: newToken, user } = await res.json();
      login(newToken, user);
      navigate('/');
    } catch (err) {
      console.error(err);
      showError(t('auth.serverUnreachable'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="login-brand-text">
            <img className="brand-mark" src={logo} alt="Business Pro" />
            <span>Business Pro</span>
          </div>
          <button
            type="button"
            className="login-lang-toggle"
            onClick={toggleLanguage}
            title={nextLangLabel}
            aria-label={nextLangLabel}
          >
            <GlobeIcon /> {nextLangCode}
          </button>
        </div>

        <div>
          <h1>{t('auth.signInTitle')}</h1>
          <p className="subtitle">{t('auth.signInSubtitle')}</p>
        </div>

        {error && <p className="error-message" style={{ color: error.color, display: 'block' }}>{error.message}</p>}

        <div className="field-row">
          <label htmlFor="email-input">{t('auth.emailLabel')}</label>
          <input
            id="email-input"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field-row">
          <label htmlFor="password-input">{t('auth.passwordLabel')}</label>
          <div className="password-input-wrapper">
            <input
              id="password-input"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <label className="remember-me-row">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>{t('auth.rememberMe')}</span>
        </label>

        <button className="button primary" type="submit" disabled={submitting}>
          {t('auth.signInTitle')}
        </button>
      </form>
    </div>
  );
}
