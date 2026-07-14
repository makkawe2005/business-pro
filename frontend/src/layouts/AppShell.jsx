import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissionsStore } from '../store/permissionsStore';
import { useI18n } from '../i18n/useI18n';
import { ToastContainer } from '../components/ToastContainer';
import { GlobeIcon, LogoutIcon } from '../components/Icons';
import logo from '../assets/logo.png';

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const pageKeys = usePermissionsStore((s) => s.pageKeys);
  const navigate = useNavigate();
  const location = useLocation();
  const { t, toggleLanguage, nextLangLabel, nextLangCode } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [systemAdminOpen, setSystemAdminOpen] = useState(false);
  const systemAdminExpanded = systemAdminOpen || location.pathname.startsWith('/system-admin');

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const navClass = ({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`;
  const subNavClass = ({ isActive }) => `sidebar-nav-sublink${isActive ? ' active' : ''}`;

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <button
          type="button"
          className="hamburger-button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={menuOpen}
        >
          ☰
        </button>
        <div className="mobile-topbar-brand">
          <img className="brand-mark" src={logo} alt="Business Pro" />
          <span>Business Pro</span>
        </div>
      </div>

      {menuOpen && <div className="sidebar-backdrop" onClick={closeMenu} />}

      <aside className={`app-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <img className="brand-mark" src={logo} alt="Business Pro" />
          <div className="sidebar-brand-text">
            <strong>Business Pro</strong>
            <small>{t('nav.brandTagline')}</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {pageKeys.includes('dashboard') && (
            <NavLink to="/dashboard" className={navClass} onClick={closeMenu}>{t('nav.dashboard')}</NavLink>
          )}
          {pageKeys.includes('phase1') && (
            <NavLink to="/phase1" className={navClass} onClick={closeMenu}>{t('nav.phase1')}</NavLink>
          )}
          {pageKeys.includes('phase2') && (
            <NavLink to="/phase2" className={navClass} onClick={closeMenu}>{t('nav.phase2')}</NavLink>
          )}
          {pageKeys.includes('phase3') && (
            <NavLink to="/phase3" className={navClass} onClick={closeMenu}>{t('nav.phase3')}</NavLink>
          )}
          {pageKeys.includes('calendar') && (
            <NavLink to="/calendar" className={navClass} onClick={closeMenu}>{t('nav.calendar')}</NavLink>
          )}
          {pageKeys.includes('system_admin') && (
            <div className="sidebar-nav-group">
              <button
                type="button"
                className={`sidebar-nav-group-toggle${systemAdminExpanded ? ' expanded' : ''}`}
                onClick={() => setSystemAdminOpen((v) => !v)}
                aria-expanded={systemAdminExpanded}
              >
                <span>{t('nav.systemAdmin')}</span>
                <span className="sidebar-nav-chevron">›</span>
              </button>
              {systemAdminExpanded && (
                <div className="sidebar-nav-subgroup">
                  <NavLink to="/system-admin/users" className={subNavClass} onClick={closeMenu}>{t('systemAdmin.usersNav')}</NavLink>
                  <NavLink to="/system-admin/clients" className={subNavClass} onClick={closeMenu}>{t('systemAdmin.clientsNav')}</NavLink>
                  <NavLink to="/system-admin/permissions" className={subNavClass} onClick={closeMenu}>{t('systemAdmin.permissionsNav')}</NavLink>
                  <NavLink to="/system-admin/roles" className={subNavClass} onClick={closeMenu}>{t('systemAdmin.rolesNav')}</NavLink>
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-user-greeting">
            {user && user.name ? t('greeting.welcome').replace('{name}', user.name) : ''}
          </span>
          <div className="sidebar-footer-actions">
            <button
              className="button neutral icon-button"
              type="button"
              onClick={toggleLanguage}
              title={nextLangLabel}
              aria-label={nextLangLabel}
            >
              <GlobeIcon /> {nextLangCode}
            </button>
            <button
              className="button neutral icon-button"
              type="button"
              onClick={handleLogout}
              title={t('logout')}
              aria-label={t('logout')}
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-content">
        <div className="page">
          <Outlet />
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
