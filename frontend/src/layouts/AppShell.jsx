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
  const { t, toggleLanguage, nextLangLabel } = useI18n();

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
            <img className="brand-mark" src={logo} alt="Business Pro" />
            <div className="brand-text">
              <strong>Business Pro</strong>
            </div>
          </div>
          <div className="actions">
            <span className="user-greeting">
              {user && user.name ? t('greeting.welcome').replace('{name}', user.name) : ''}
            </span>
            <button className="button neutral" type="button" onClick={toggleLanguage}>
              {nextLangLabel}
            </button>
            <button className="button neutral" type="button" onClick={handleLogout}>
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="page">
        <div className="tabs">
          {pageKeys.includes('dashboard') && <NavLink to="/dashboard" className={tabClass}>{t('nav.dashboard')}</NavLink>}
          {pageKeys.includes('phase1') && <NavLink to="/phase1" className={tabClass}>{t('nav.phase1')}</NavLink>}
          {pageKeys.includes('phase2') && <NavLink to="/phase2" className={tabClass}>{t('nav.phase2')}</NavLink>}
          {pageKeys.includes('phase3') && <NavLink to="/phase3" className={tabClass}>{t('nav.phase3')}</NavLink>}
          {pageKeys.includes('phase1') && <NavLink to="/calendar" className={tabClass}>{t('nav.calendar')}</NavLink>}
          {pageKeys.includes('system_admin') && (
            <NavLink to="/system-admin" className={tabClass}>{t('nav.systemAdmin')}</NavLink>
          )}
        </div>

        <Outlet />
      </div>

      <ToastContainer />
    </>
  );
}
