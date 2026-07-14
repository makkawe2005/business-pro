import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';
import { initials } from '../utils/format';
import { countryOptions, countryPhonePrefixes } from '../data/companyOptions';

const emptyInvestorForm = {
  name: '',
  mobile: '',
  email: '',
  investor_type: 'Individual',
  company_name: '',
  nationality: 'Saudi Arabia',
  national_id: '',
  notes: '',
  status: 'Prospect'
};

export function InvestorsPage() {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);

  const [investors, setInvestors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(emptyInvestorForm);

  async function loadInvestors() {
    try {
      const res = await apiFetch('/investors');
      if (!res.ok) throw new Error('Failed to load investors');
      const data = await res.json();
      setInvestors(data);
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  useEffect(() => {
    (async () => {
      const data = await loadInvestors();
      if (data.length) setSelectedId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = investors.find((i) => i.id === selectedId) || null;

  function selectInvestor(id) {
    setSelectedId(id);
    setFormVisible(false);
    setEditingId(null);
    setMobileDetailOpen(true);
  }

  function openAddForm() {
    setFormValues(emptyInvestorForm);
    setEditingId(null);
    setFormVisible(true);
    setMobileDetailOpen(true);
  }

  function openEditForm(inv) {
    setFormValues({
      name: inv.name || '',
      mobile: inv.mobile || '',
      email: inv.email || '',
      investor_type: inv.investor_type || 'Individual',
      company_name: inv.company_name || '',
      nationality: inv.nationality || '',
      national_id: inv.national_id || '',
      notes: inv.notes || '',
      status: inv.status || 'Prospect'
    });
    setEditingId(inv.id);
    setFormVisible(true);
  }

  function cancelForm() {
    setFormVisible(false);
    setEditingId(null);
  }

  async function submitForm() {
    const name = formValues.name.trim();
    if (!name) {
      showToast(t('investors.nameRequired'), 'error');
      return;
    }
    if (!/^[1-9]\d{8}$/.test(formValues.mobile)) {
      showToast(t('investors.mobileInvalid'), 'error');
      return;
    }
    const payload = {
      name,
      mobile: formValues.mobile,
      email: formValues.email.trim(),
      investor_type: formValues.investor_type,
      company_name: formValues.company_name.trim(),
      nationality: formValues.nationality,
      national_id: formValues.national_id.trim(),
      notes: formValues.notes.trim(),
      status: formValues.status
    };
    try {
      const res = editingId !== null
        ? await apiFetch(`/investors/${editingId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await apiFetch('/investors', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
      if (!res.ok) throw new Error('Failed to save investor');
      const saved = await res.json();
      setFormVisible(false);
      setEditingId(null);
      await loadInvestors();
      setSelectedId(saved.id);
      showToast(t('investors.saveSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('investors.saveFailed'), 'error');
    }
  }

  async function removeInvestor(id, name) {
    const confirmed = window.confirm(t('investors.confirmRemove').replace('{name}', name));
    if (!confirmed) return;
    try {
      const res = await apiFetch(`/investors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove investor');
      const data = await loadInvestors();
      setSelectedId(data.length ? data[0].id : null);
      showToast(t('investors.removeSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('investors.removeFailed'), 'error');
    }
  }

  const query = searchQuery.trim().toLowerCase();
  const filteredInvestors = investors.filter(
    (i) => !query || (i.name || '').toLowerCase().includes(query) || (i.mobile || '').includes(query)
  );

  return (
    <>
      <p className="page-intro">{t('investors.pageIntro')}</p>
      <div className={`main-grid${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
        <section className="panel panel-left">
          <div className="panel-header">
            <h2>{t('investors.listTitle')}</h2>
            <button className="button primary" type="button" onClick={openAddForm}>{t('investors.addButton')}</button>
          </div>
          <div className="search-row">
            <input
              type="text"
              className="search-input"
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="client-list-wrapper">
            <ul className="client-list">
              {filteredInvestors.length === 0 ? (
                <li style={{ padding: '16px', color: '#6b7280' }}>{t('investors.empty')}</li>
              ) : (
                filteredInvestors.map((inv) => (
                  <li
                    key={inv.id}
                    className={`client-row${inv.id === selectedId ? ' selected' : ''}`}
                    onClick={() => selectInvestor(inv.id)}
                  >
                    <div className="company-entry">
                      <div className="company-avatar">{initials(inv.name)}</div>
                      <strong>{inv.name}</strong>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        <section className="panel panel-right">
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                className="mobile-back-button"
                onClick={() => setMobileDetailOpen(false)}
              >
                ‹ {t('investors.listTitle')}
              </button>
              <h2 style={{ margin: 0 }}>{t('investors.detailTitle')}</h2>
            </div>
          </div>

          {formVisible ? (
            <div className="detail-scroll">
              <div className="add-client-grid">
                <div className="field-row">
                  <label htmlFor="investor-name">{t('investors.name')}</label>
                  <input
                    id="investor-name"
                    type="text"
                    value={formValues.name}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="investor-mobile">{t('investors.mobile')}</label>
                  <div className="phone-prefix-input">
                    <span className="phone-prefix-badge">{countryPhonePrefixes[formValues.nationality] || '+···'}</span>
                    <input
                      id="investor-mobile"
                      type="tel"
                      dir="ltr"
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="5XXXXXXXX"
                      value={formValues.mobile}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                    />
                  </div>
                </div>
                <div className="field-row">
                  <label htmlFor="investor-email">{t('common.email')}</label>
                  <input
                    id="investor-email"
                    type="email"
                    dir="ltr"
                    value={formValues.email}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="investor-type">{t('investors.type')}</label>
                  <select
                    id="investor-type"
                    value={formValues.investor_type}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, investor_type: e.target.value }))}
                  >
                    <option value="Individual">{t('investors.typeIndividual')}</option>
                    <option value="Corporate">{t('investors.typeCorporate')}</option>
                    <option value="Institutional">{t('investors.typeInstitutional')}</option>
                  </select>
                </div>
                {formValues.investor_type !== 'Individual' && (
                  <div className="field-row">
                    <label htmlFor="investor-company">{t('investors.companyName')}</label>
                    <input
                      id="investor-company"
                      type="text"
                      value={formValues.company_name}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, company_name: e.target.value }))}
                    />
                  </div>
                )}
                <div className="field-row">
                  <label htmlFor="investor-nationality">{t('investors.nationality')}</label>
                  <select
                    id="investor-nationality"
                    value={formValues.nationality}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, nationality: e.target.value }))}
                  >
                    <option value="">{t('investors.nationality')}</option>
                    {countryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
                    ))}
                  </select>
                </div>
                <div className="field-row">
                  <label htmlFor="investor-national-id">{t('investors.nationalId')}</label>
                  <input
                    id="investor-national-id"
                    type="text"
                    dir="ltr"
                    value={formValues.national_id}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, national_id: e.target.value }))}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="investor-status">{t('investors.status')}</label>
                  <select
                    id="investor-status"
                    value={formValues.status}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="Prospect">{t('investors.statusProspect')}</option>
                    <option value="Active">{t('investors.statusActive')}</option>
                    <option value="Inactive">{t('investors.statusInactive')}</option>
                  </select>
                </div>
                <div className="field-row" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="investor-notes">{t('investors.notes')}</label>
                  <textarea
                    id="investor-notes"
                    rows={3}
                    placeholder={t('investors.notesPlaceholder')}
                    value={formValues.notes}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="button neutral" type="button" onClick={cancelForm}>{t('common.cancel')}</button>
                <button className="button primary" type="button" onClick={submitForm}>
                  {editingId !== null ? t('common.saveChanges') : t('investors.addButton')}
                </button>
              </div>
            </div>
          ) : selected ? (
            <div className="detail-scroll">
              <div className="detail-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="avatar-lg">{initials(selected.name)}</div>
                  <div><h3>{selected.name}</h3></div>
                </div>
              </div>
              <div className="info-grid">
                <div className="info-row">
                  <span>{t('investors.mobile')}</span>
                  <strong>
                    {countryPhonePrefixes[selected.nationality] ? `${countryPhonePrefixes[selected.nationality]} ` : ''}
                    {selected.mobile}
                  </strong>
                </div>
                <div className="info-row"><span>{t('common.email')}</span><strong>{selected.email || '–'}</strong></div>
                <div className="info-row"><span>{t('investors.type')}</span><strong>{selected.investor_type}</strong></div>
                {selected.company_name && (
                  <div className="info-row"><span>{t('investors.companyName')}</span><strong>{selected.company_name}</strong></div>
                )}
                <div className="info-row"><span>{t('investors.nationality')}</span><strong>{selected.nationality || '–'}</strong></div>
                <div className="info-row"><span>{t('investors.nationalId')}</span><strong>{selected.national_id || '–'}</strong></div>
                <div className="info-row"><span>{t('investors.status')}</span><strong>{selected.status}</strong></div>
              </div>
              {selected.notes && (
                <div className="briefing-block">
                  <span>{t('investors.notes')}</span>
                  <p>{selected.notes}</p>
                </div>
              )}
              <div className="form-actions" style={{ marginTop: '16px' }}>
                <button className="button neutral" type="button" onClick={() => openEditForm(selected)}>{t('common.editShort')}</button>
                <button className="button danger" type="button" onClick={() => removeInvestor(selected.id, selected.name)}>{t('common.remove')}</button>
              </div>
            </div>
          ) : (
            <div className="detail-scroll"><p>{t('investors.empty')}</p></div>
          )}
        </section>
      </div>
    </>
  );
}
