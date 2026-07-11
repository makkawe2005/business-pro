import { NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';

export function SystemAdminLayout() {
  const { t } = useI18n();
  const tabClass = ({ isActive }) => `tab-button${isActive ? ' active' : ''}`;

  return (
    <div>
      <div className="tabs">
        <NavLink to="/system-admin/users" className={tabClass}>{t('systemAdmin.usersNav')}</NavLink>
        <NavLink to="/system-admin/clients" className={tabClass}>{t('systemAdmin.clientsNav')}</NavLink>
        <NavLink to="/system-admin/permissions" className={tabClass}>{t('systemAdmin.permissionsNav')}</NavLink>
        <NavLink to="/system-admin/roles" className={tabClass}>{t('systemAdmin.rolesNav')}</NavLink>
      </div>
      <Outlet />
    </div>
  );
}
