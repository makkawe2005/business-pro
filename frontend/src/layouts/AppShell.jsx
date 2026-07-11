import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissionsStore } from '../store/permissionsStore';
import { useI18n } from '../i18n/useI18n';
import { ToastContainer } from '../components/ToastContainer';
import logo from '../assets/logo.png';

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const pageKeys = usePermissionsStore((s) => s.pageKeys);
  const navigate = useNavigate();
  const { t, toggleLanguage, nextLangLabel, nextLangCode } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const tabClass = ({ isActive }) => `tab-button${isActive ? ' active' : ''}`;

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <button
              type="button"
              className="hamburger-button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={menuOpen}
            >
              ☰
            </button>
            <img className="brand-mark" src={logo} alt="Business Pro" />
            <div className="brand-text">
              <strong>Business Pro</strong>
            </div>
          </div>
          <div className="actions">
            <span className="user-greeting">
              {user && user.name ? t('greeting.welcome').replace('{name}', user.name) : ''}
            </span>
            <button
              className="button neutral icon-button"
              type="button"
              onClick={toggleLanguage}
              title={nextLangLabel}
              aria-label={nextLangLabel}
            >
              🌐 {nextLangCode}
            </button>
            <button
              className="button neutral icon-button"
              type="button"
              onClick={handleLogout}
              title={t('logout')}
              aria-label={t('logout')}
            >
              🚪
            </button>
          </div>
        </div>
      </header>

      <div className="page">
        <div className={`tabs${menuOpen ? ' open' : ''}`}>
          {pageKeys.includes('dashboard') && (
            <NavLink to="/dashboard" className={tabClass} onClick={() => setMenuOpen(false)}>{t('nav.dashboard')}</NavLink>
          )}
          {pageKeys.includes('phase1') && (
            <NavLink to="/phase1" className={tabClass} onClick={() => setMenuOpen(false)}>{t('nav.phase1')}</NavLink>
          )}
          {pageKeys.includes('phase2') && (
            <NavLink to="/phase2" className={tabClass} onClick={() => setMenuOpen(false)}>{t('nav.phase2')}</NavLink>
          )}
          {pageKeys.includes('phase3') && (
            <NavLink to="/phase3" className={tabClass} onClick={() => setMenuOpen(false)}>{t('nav.phase3')}</NavLink>
          )}
          {pageKeys.includes('calendar') && (
            <NavLink to="/calendar" className={tabClass} onClick={() => setMenuOpen(false)}>{t('nav.calendar')}</NavLink>
          )}
          {pageKeys.includes('system_admin') && (
            <NavLink to="/system-admin" className={tabClass} onClick={() => setMenuOpen(false)}>{t('nav.systemAdmin')}</NavLink>
          )}
        </div>

        <Outlet />
      </div>

      <ToastContainer />
    </>
  );
}
