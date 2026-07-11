import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { API_BASE } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n/useI18n';
import logo from '../assets/logo.png';

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const { t, toggleLanguage, nextLangLabel, translateServerError } = useI18n();

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      if (mode === 'register') {
        const trimmedName = name.trim();
        if (!trimmedName) {
          showError(t('auth.nameRequired'));
          return;
        }
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedName, email: trimmedEmail, password })
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          showError(body.error ? translateServerError(body.error) : t('auth.createFailed'));
          return;
        }
        setMode('login');
        showError(t('auth.accountCreated'), 'var(--bp-success)');
        return;
      }

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password })
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

  const isRegister = mode === 'register';

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="login-brand-text">
            <img className="brand-mark" src={logo} alt="Business Pro" />
            <span>Business Pro</span>
          </div>
          <button type="button" className="login-lang-toggle" onClick={toggleLanguage}>
            {nextLangLabel}
          </button>
        </div>

        <div>
          <h1>{isRegister ? t('auth.createTitle') : t('auth.signInTitle')}</h1>
          <p className="subtitle">{isRegister ? t('auth.createSubtitle') : t('auth.signInSubtitle')}</p>
        </div>

        {error && <p className="error-message" style={{ color: error.color, display: 'block' }}>{error.message}</p>}

        {isRegister && (
          <div className="field-row">
            <label htmlFor="name-input">{t('auth.nameLabel')}</label>
            <input
              id="name-input"
              type="text"
              placeholder={t('auth.namePlaceholder')}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

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
          <input
            id="password-input"
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="button primary" type="submit" disabled={submitting}>
          {isRegister ? t('auth.createTitle') : t('auth.signInTitle')}
        </button>

        <div className="toggle-row">
          <span>{isRegister ? t('auth.haveAccount') : t('auth.needAccount')}</span>{' '}
          <button type="button" onClick={() => setMode(isRegister ? 'login' : 'register')}>
            {isRegister ? t('auth.signInTitle') : t('auth.createOne')}
          </button>
        </div>
      </form>
    </div>
  );
}
