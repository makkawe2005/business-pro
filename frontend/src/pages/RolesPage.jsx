import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';

export function RolesPage() {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  const [roles, setRoles] = useState([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  async function loadRoles() {
    try {
      const res = await apiFetch('/roles');
      if (!res.ok) throw new Error('Failed to load roles');
      setRoles(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadRoles();
  }, []);

  async function addRole() {
    const name = newName.trim();
    if (!name) {
      showToast(t('roles.nameRequired'), 'error');
      return;
    }
    try {
      const res = await apiFetch('/roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to add role');
      setNewName('');
      await loadRoles();
      showToast(t('roles.addSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('roles.addFailed'), 'error');
    }
  }

  function startEdit(role) {
    setEditingId(role.id);
    setEditingName(role.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
  }

  async function saveEdit(id) {
    const name = editingName.trim();
    if (!name) {
      showToast(t('roles.nameRequired'), 'error');
      return;
    }
    try {
      const res = await apiFetch(`/roles/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to rename role');
      cancelEdit();
      await loadRoles();
      showToast(t('roles.renameSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('roles.renameFailed'), 'error');
    }
  }

  return (
    <div>
      <h3 className="section-title">{t('roles.addTitle')}</h3>
      <div className="company-form-grid">
        <input
          type="text"
          placeholder={t('roles.nameHeader')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
      </div>
      <div className="form-actions" style={{ marginBottom: '22px' }}>
        <button className="button primary" type="button" onClick={addRole}>{t('roles.addButton')}</button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('roles.nameHeader')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ color: '#6b7280', whiteSpace: 'normal' }}>{t('roles.empty')}</td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    {editingId === role.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                      />
                    ) : (
                      <>
                        {role.name}
                        {role.protected && <span style={{ color: '#6b7280' }}> ({t('roles.protectedBadge')})</span>}
                      </>
                    )}
                  </td>
                  <td>
                    {editingId === role.id ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className="button primary" type="button" onClick={() => saveEdit(role.id)}>
                          {t('common.saveChanges')}
                        </button>
                        <button className="button neutral" type="button" onClick={cancelEdit}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      !role.protected && (
                        <button className="button neutral" type="button" onClick={() => startEdit(role)}>
                          {t('common.editShort')}
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
