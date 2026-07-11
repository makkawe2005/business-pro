import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';

const PAGE_KEYS = ['dashboard', 'phase1', 'phase2', 'phase3', 'system_admin'];

export function PermissionsPage() {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  const [roles, setRoles] = useState([]);
  const [pageKeysByRole, setPageKeysByRole] = useState({});

  async function loadData() {
    try {
      const [rolesRes, permsRes] = await Promise.all([apiFetch('/roles'), apiFetch('/permissions')]);
      if (!rolesRes.ok || !permsRes.ok) throw new Error('Failed to load permissions');
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      setRoles(rolesData);
      const byRole = {};
      for (const role of rolesData) {
        byRole[role.id] = (permsData[role.id] && permsData[role.id].page_keys) || [];
      }
      setPageKeysByRole(byRole);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggle(role, pageKey) {
    if (role.protected && pageKey === 'system_admin') return;
    setPageKeysByRole((prev) => {
      const current = prev[role.id] || [];
      const next = current.includes(pageKey)
        ? current.filter((k) => k !== pageKey)
        : [...current, pageKey];
      return { ...prev, [role.id]: next };
    });
  }

  async function saveRole(role) {
    try {
      const res = await apiFetch('/permissions', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: role.id, page_keys: pageKeysByRole[role.id] || [] })
      });
      if (!res.ok) throw new Error('Failed to save permissions');
      await loadData();
      showToast(t('permissions.saveSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('permissions.saveFailed'), 'error');
    }
  }

  return (
    <div>
      <h3 className="section-title">{t('permissions.title')}</h3>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('permissions.roleHeader')}</th>
              <th>{t('nav.dashboard')}</th>
              <th>{t('nav.phase1')}</th>
              <th>{t('nav.phase2')}</th>
              <th>{t('nav.phase3')}</th>
              <th>{t('nav.systemAdmin')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td>{role.name}</td>
                {PAGE_KEYS.map((pageKey) => (
                  <td key={pageKey}>
                    <input
                      type="checkbox"
                      checked={(pageKeysByRole[role.id] || []).includes(pageKey)}
                      disabled={role.protected && pageKey === 'system_admin'}
                      onChange={() => toggle(role, pageKey)}
                    />
                  </td>
                ))}
                <td>
                  <button className="button neutral" type="button" onClick={() => saveRole(role)}>
                    {t('common.saveChanges')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
