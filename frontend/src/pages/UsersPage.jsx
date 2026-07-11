import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';

function emptyForm(defaultRoleId) {
  return { name: '', email: '', password: '', role_id: defaultRoleId };
}

export function UsersPage() {
  const { t, translateServerError } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(emptyForm(''));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function loadRoles() {
    try {
      const res = await apiFetch('/roles');
      if (!res.ok) throw new Error('Failed to load roles');
      const data = await res.json();
      setRoles(data);
      setForm((prev) => (prev.role_id ? prev : emptyForm(data[0] ? data[0].id : '')));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadUsers() {
    try {
      const res = await apiFetch('/users');
      if (!res.ok) throw new Error('Failed to load users');
      setUsers(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadRoles();
    loadUsers();
  }, []);

  async function addUser() {
    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password;
    if (!name || !email || !password) {
      showToast(t('users.fieldsRequired'), 'error');
      return;
    }
    try {
      const res = await apiFetch('/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role_id: form.role_id })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error ? translateServerError(body.error) : t('users.addFailed'), 'error');
        return;
      }
      setForm((prev) => emptyForm(prev.role_id));
      await loadUsers();
      showToast(t('users.addSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('users.addFailed'), 'error');
    }
  }

  async function changeRole(id, roleId) {
    try {
      const res = await apiFetch(`/users/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: Number(roleId) })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error ? translateServerError(body.error) : t('users.roleUpdateFailed'), 'error');
        return;
      }
      await loadUsers();
      showToast(t('users.roleUpdateSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('users.roleUpdateFailed'), 'error');
    }
  }

  async function toggleActive(id, isActive) {
    try {
      const res = await apiFetch(`/users/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error ? translateServerError(body.error) : t('users.statusUpdateFailed'), 'error');
        return;
      }
      await loadUsers();
      showToast(t('users.statusUpdateSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('users.statusUpdateFailed'), 'error');
    }
  }

  async function resetPassword(id) {
    const newPassword = window.prompt(t('users.resetPasswordPrompt'));
    if (newPassword === null) return;
    if (newPassword.length < 8) {
      showToast(t('users.resetPasswordTooShort'), 'error');
      return;
    }
    try {
      const res = await apiFetch(`/users/${id}/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error ? translateServerError(body.error) : t('users.resetPasswordFailed'), 'error');
        return;
      }
      showToast(t('users.resetPasswordSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('users.resetPasswordFailed'), 'error');
    }
  }

  const query = searchQuery.trim().toLowerCase();
  const filteredUsers = users
    .filter((u) =>
      !query || (u.name || '').toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query)
    )
    .filter((u) => {
      if (statusFilter === 'active') return u.is_active;
      if (statusFilter === 'inactive') return !u.is_active;
      return true;
    });

  return (
    <div>
      <h3 className="section-title">{t('users.addTitle')}</h3>
      <div className="company-form-grid">
        <input
          type="text"
          placeholder={t('auth.namePlaceholder')}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <input
          type="email"
          dir="ltr"
          placeholder={t('common.email')}
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
        />
        <input
          type="password"
          placeholder={t('auth.passwordPlaceholder')}
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
        />
        <select value={form.role_id} onChange={(e) => setForm((prev) => ({ ...prev, role_id: Number(e.target.value) }))}>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1, minWidth: '220px' }}>
          <div style={{ maxWidth: '320px', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              className="search-input"
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className="select-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t('users.statusAll')}</option>
            <option value="active">{t('users.statusActive')}</option>
            <option value="inactive">{t('users.statusInactive')}</option>
          </select>
        </div>
        <button className="button primary" type="button" onClick={addUser}>{t('users.addButton')}</button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('users.nameHeader')}</th>
              <th>{t('users.emailHeader')}</th>
              <th>{t('users.roleHeader')}</th>
              <th>{t('users.statusHeader')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: '#6b7280', whiteSpace: 'normal' }}>{t('users.empty')}</td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select className="select-input" value={u.role_id} onChange={(e) => changeRole(u.id, e.target.value)}>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>{u.is_active ? t('users.statusActive') : t('users.statusInactive')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="button neutral" type="button" onClick={() => toggleActive(u.id, u.is_active)}>
                        {u.is_active ? t('users.deactivate') : t('users.activate')}
                      </button>
                      <button className="button neutral" type="button" onClick={() => resetPassword(u.id)}>
                        {t('users.resetPassword')}
                      </button>
                    </div>
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
