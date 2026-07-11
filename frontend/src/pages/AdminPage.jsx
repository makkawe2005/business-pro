import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';
import { parseCsvRows, escapeCsvCell } from '../utils/format';

export function AdminPage() {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  const [inactiveClients, setInactiveClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [importState, setImportState] = useState(null);
  const fileInputRef = useRef(null);

  async function loadInactiveClients() {
    try {
      const res = await apiFetch('/clients?status=Inactive');
      if (!res.ok) throw new Error('Failed to load inactive clients');
      setInactiveClients(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadInactiveClients();
  }, []);

  async function reactivateClient(id, name) {
    const confirmed = window.confirm(t('admin.confirmReactivate').replace('{name}', name));
    if (!confirmed) return;
    try {
      const res = await apiFetch(`/clients/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Prospect', stage: 'phase1' })
      });
      if (!res.ok) throw new Error('Failed to reactivate client');
      await loadInactiveClients();
      showToast(t('admin.reactivateSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('admin.reactivateFailed'), 'error');
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsvRows(reader.result || '');
      if (rows.length < 2) {
        showToast(t('csv.emptyFile'), 'error');
        event.target.value = '';
        return;
      }

      const headerRow = rows.shift().map((header) => header.toLowerCase());
      const expected = ['contact', 'email', 'phone', 'status', 'engagements'];
      const missing = expected.filter((key) => !headerRow.includes(key));
      if (missing.length) {
        showToast(t('csv.missingColumns').replace('{columns}', expected.join(', ')), 'error');
        event.target.value = '';
        return;
      }

      const imported = rows.map((row) => {
        const record = Object.fromEntries(headerRow.map((key, index) => [key, row[index] || '']));
        return {
          contact_name: record.contact || 'Unknown contact',
          email: record.email || 'unknown@example.com',
          phone: record.phone || '-000-000-0000',
          status: ['Prospect', 'Active', 'Inactive'].includes(record.status) ? record.status : 'Prospect',
          stage: 'phase1'
        };
      });

      if (!imported.length) {
        showToast(t('csv.noneImported'), 'error');
        event.target.value = '';
        return;
      }

      (async () => {
        const total = imported.length;
        let failed = 0;
        setImportState({ total, done: 0, failed: 0 });
        try {
          for (const rec of imported) {
            const res = await apiFetch('/clients', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(rec)
            });
            if (!res.ok) {
              failed += 1;
              console.warn('Failed to import row', rec);
            }
            setImportState((prev) => (prev ? { ...prev, done: prev.done + 1, failed } : prev));
          }
          if (failed === 0) {
            showToast(t('csv.importSuccess').replace('{count}', String(total)));
          } else {
            showToast(t('csv.importPartial')
              .replace('{success}', String(total - failed))
              .replace('{total}', String(total))
              .replace('{failed}', String(failed)), 'error');
          }
        } catch (err) {
          console.error(err);
          showToast(t('csv.importFailed'), 'error');
        } finally {
          event.target.value = '';
          setImportState(null);
        }
      })();
    };

    reader.readAsText(file);
  }

  async function exportClientsCsv() {
    try {
      const res = await apiFetch('/clients?stage=phase1&status=Prospect');
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      const headers = ['contact', 'email', 'phone', 'status', 'engagements'];
      const rows = data.map((c) => [
        escapeCsvCell(c.contact_name || ''),
        escapeCsvCell(c.email || ''),
        escapeCsvCell(c.phone || ''),
        escapeCsvCell(c.status || ''),
        escapeCsvCell(c.engagements_count || 0)
      ].join(','));
      const csv = headers.join(',') + '\n' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clients.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(t('csv.exportSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('csv.exportFailed'), 'error');
    }
  }

  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? inactiveClients.filter((c) =>
        (c.contact_name || '').toLowerCase().includes(query) || (c.phone || '').toLowerCase().includes(query)
      )
    : inactiveClients;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ maxWidth: '320px', flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            className="search-input"
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="button neutral" type="button" onClick={handleImportClick} disabled={!!importState}>{t('directory.import')}</button>
          <button className="button neutral" type="button" onClick={exportClientsCsv} disabled={!!importState}>{t('directory.export')}</button>
          <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportFile} />
        </div>
      </div>

      {importState && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '8px', background: 'var(--bp-border)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.round((importState.done / importState.total) * 100)}%`,
                height: '100%',
                background: 'var(--bp-navy)',
                transition: 'width 0.2s ease'
              }}
            />
          </div>
          <span style={{ fontSize: '13px', color: 'var(--bp-muted)', whiteSpace: 'nowrap' }}>
            {t('csv.importingProgress').replace('{done}', String(importState.done)).replace('{total}', String(importState.total))}
          </span>
        </div>
      )}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('client.contactName')}</th>
              <th>{t('admin.companyNameHeader')}</th>
              <th>{t('common.email')}</th>
              <th>{t('common.phone')}</th>
              <th>{t('admin.stageHeader')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: '#6b7280', whiteSpace: 'normal' }}>{t('admin.empty')}</td>
              </tr>
            ) : (
              filtered.map((client) => (
                <tr key={client.id}>
                  <td>{client.contact_name || '–'}</td>
                  <td>{client.company_name || '–'}</td>
                  <td>{client.email || '–'}</td>
                  <td>{client.phone || '–'}</td>
                  <td>{client.stage === 'phase2' ? t('nav.phase2') : t('nav.phase1')}</td>
                  <td>
                    <button className="button primary" type="button" onClick={() => reactivateClient(client.id, client.contact_name)}>
                      {t('admin.reactivate')}
                    </button>
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
