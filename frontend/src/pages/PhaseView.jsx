import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';
import { initials } from '../utils/format';
import { emptyCompanyForm } from '../data/companyOptions';
import { ClientList } from '../components/ClientList';
import { AddClientForm } from '../components/AddClientForm';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { ReasonModal } from '../components/ReasonModal';
import { CompanySection } from '../components/CompanySection';
import { ServicesSection } from '../components/ServicesSection';
import { NotesSection } from '../components/NotesSection';
import { AppointmentsSection } from '../components/AppointmentsSection';
import { PipelineCard } from '../components/PipelineCard';

const emptyClientForm = { contact_name: '', email: '', phone: '' };

const STATUS_FILTER_LABEL_KEYS = {
  Prospect: 'summary.prospects',
  Reschedule: 'summary.reschedule',
  Active: 'summary.active'
};

export function PhaseView({ stage, listStatusFilter, graduateToStage, graduateStatus = 'Active', deleteLabelKey, canEditClient = true, canAddClient = true, useAppointments = false, rescheduleTargetStage, requireCancelReason = false }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.showToast);

  const CLIENTS_PAGE_SIZE = 5;

  const [clients, setClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusSubFilter, setStatusSubFilter] = useState(null);
  const [clientsPage, setClientsPage] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [detail, setDetail] = useState(null); // { client, notes, companies }

  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState(null);
  const [clientFormValues, setClientFormValues] = useState(emptyClientForm);

  const [companyFormVisible, setCompanyFormVisible] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [companyFormValues, setCompanyFormValues] = useState(emptyCompanyForm);

  const [pendingReschedule, setPendingReschedule] = useState(null); // { id, name }
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [pendingCancel, setPendingCancel] = useState(null); // { id, name }
  const [cancelReason, setCancelReason] = useState('');

  const clientsListPath = useCallback(() => {
    const statusParam = Array.isArray(listStatusFilter) ? listStatusFilter.join(',') : listStatusFilter;
    return `/clients?stage=${stage}` + (statusParam ? `&status=${statusParam}` : '');
  }, [stage, listStatusFilter]);

  const loadClients = useCallback(async () => {
    try {
      const res = await apiFetch(clientsListPath());
      if (!res.ok) throw new Error('Failed to load clients');
      const data = await res.json();
      setClients(data);
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [clientsListPath]);

  const selectClient = useCallback(async (id) => {
    setSelectedClientId(id);
    try {
      const res = await apiFetch(`/clients/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setDetail(data);
      setEditingCompanyId(null);
      setCompanyFormValues(emptyCompanyForm);
      setCompanyFormVisible((data.companies || []).length === 0);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const resetDetailPanel = useCallback(() => {
    setSelectedClientId(null);
    setDetail(null);
    setEditingCompanyId(null);
    setCompanyFormValues(emptyCompanyForm);
    setCompanyFormVisible(true);
  }, []);

  // Initial load; if navigated here after a pipeline graduation, auto-select the graduated client.
  useEffect(() => {
    (async () => {
      const data = await loadClients();
      const wantedId = location.state?.selectClientId;
      if (wantedId && data.some((c) => c.id === wantedId)) {
        await selectClient(wantedId);
      } else if (data.length) {
        await selectClient(data[0].id);
      } else {
        resetDetailPanel();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function openAddClientForm() {
    setEditingClientId(null);
    setClientFormValues(emptyClientForm);
    setShowAddClientForm(true);
  }

  function openEditClientForm() {
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) {
      showToast(t('client.noneSelectedEdit'), 'error');
      return;
    }
    setClientFormValues({ contact_name: client.contact_name, email: client.email, phone: client.phone });
    setEditingClientId(client.id);
    setShowAddClientForm(true);
  }

  async function saveClient() {
    const contact = clientFormValues.contact_name.trim();
    if (!contact) {
      showToast(t('client.contactRequired'), 'error');
      return;
    }
    const payload = {
      contact_name: contact,
      email: clientFormValues.email.trim() || 'unknown@example.com',
      phone: clientFormValues.phone.trim() || '-000-000-0000',
      stage
    };
    try {
      if (editingClientId !== null) {
        const res = await apiFetch(`/clients/${editingClientId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to update');
      } else {
        const res = await apiFetch('/clients', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to create');
      }
      setEditingClientId(null);
      setClientFormValues(emptyClientForm);
      setShowAddClientForm(false);
      await loadClients();
      showToast(t('client.saveSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('client.saveFailed'), 'error');
    }
  }

  async function cancelClient(id, name, reason) {
    if (reason === undefined) {
      const confirmed = window.confirm(t('client.confirmCancel').replace('{name}', name));
      if (!confirmed) return;
    }
    try {
      if (reason) {
        const noteRes = await apiFetch(`/clients/${id}/notes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author_id: currentUser ? currentUser.id : null,
            author_name: currentUser && currentUser.name ? currentUser.name : 'Unknown user',
            text: `${t('pipeline.dealCancelReasonNoteLabel')}: ${reason}`
          })
        });
        if (!noteRes.ok) throw new Error('Failed to record cancellation reason');
      }
      const res = await apiFetch(`/clients/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Inactive' })
      });
      if (!res.ok) throw new Error('Failed to update client');
      const remaining = await loadClients();
      const stillPresent = remaining.some((c) => c.id === id);
      if (!stillPresent && selectedClientId === id) {
        if (remaining.length) {
          await selectClient(remaining[0].id);
        } else {
          resetDetailPanel();
        }
      } else if (stillPresent && selectedClientId === id) {
        await selectClient(id);
      }
      showToast(t('client.cancelSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('client.updateFailed'), 'error');
    }
  }

  async function toggleService(field, value) {
    if (selectedClientId === null) return;
    try {
      const res = await apiFetch(`/clients/${selectedClientId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (!res.ok) throw new Error('Failed to update services');
      await selectClient(selectedClientId);
      showToast(t('services.updateSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('services.updateFailed'), 'error');
    }
  }

  async function rescheduleClient(id, name, reason) {
    try {
      const noteRes = await apiFetch(`/clients/${id}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: currentUser ? currentUser.id : null,
          author_name: currentUser && currentUser.name ? currentUser.name : 'Unknown user',
          text: `${t('pipeline.rescheduleReasonNoteLabel')}: ${reason}`
        })
      });
      if (!noteRes.ok) throw new Error('Failed to record reschedule reason');
      const res = await apiFetch(`/clients/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: rescheduleTargetStage, status: 'Reschedule' })
      });
      if (!res.ok) throw new Error('Failed to reschedule client');
      const remaining = await loadClients();
      if (!remaining.some((c) => c.id === id) && selectedClientId === id) {
        if (remaining.length) {
          await selectClient(remaining[0].id);
        } else {
          resetDetailPanel();
        }
      }
      showToast(t('pipeline.rescheduleSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('pipeline.rescheduleFailed'), 'error');
    }
  }

  function handleRescheduleClient() {
    const clientToReschedule = clients.find((c) => c.id === selectedClientId);
    if (!clientToReschedule) {
      showToast(t('client.noneSelected'), 'error');
      return;
    }
    setRescheduleReason('');
    setPendingReschedule({ id: clientToReschedule.id, name: clientToReschedule.contact_name });
  }

  function cancelRescheduleModal() {
    setPendingReschedule(null);
    setRescheduleReason('');
  }

  async function confirmRescheduleModal() {
    if (!rescheduleReason) {
      showToast(t('pipeline.rescheduleReasonRequired'), 'error');
      return;
    }
    const { id, name } = pendingReschedule;
    await rescheduleClient(id, name, rescheduleReason);
    setPendingReschedule(null);
    setRescheduleReason('');
  }

  async function handleAddNote(text) {
    if (selectedClientId === null) {
      showToast(t('common.selectClientFirst'), 'error');
      return;
    }
    try {
      const res = await apiFetch(`/clients/${selectedClientId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: currentUser ? currentUser.id : null,
          author_name: currentUser && currentUser.name ? currentUser.name : 'Unknown user',
          text
        })
      });
      if (!res.ok) throw new Error('Failed to add note');
      await selectClient(selectedClientId);
      showToast(t('notes.addSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('notes.addFailed'), 'error');
    }
  }

  async function handleAddAppointment(scheduledAtLocal, title, agenda, meetingType, location, meetingLink) {
    if (selectedClientId === null) {
      showToast(t('common.selectClientFirst'), 'error');
      return;
    }
    if (!scheduledAtLocal || !title) {
      showToast(t('appointments.fieldsRequired'), 'error');
      return;
    }
    try {
      const res = await apiFetch(`/clients/${selectedClientId}/appointments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_at: new Date(scheduledAtLocal).toISOString(),
          title,
          agenda,
          meeting_type: meetingType,
          location,
          meeting_link: meetingLink
        })
      });
      if (!res.ok) throw new Error('Failed to add appointment');
      await selectClient(selectedClientId);
      showToast(t('appointments.saveSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('appointments.saveFailed'), 'error');
    }
  }

  async function updateAppointmentStatus(id, status, successKey, failureKey) {
    try {
      const res = await apiFetch(`/appointments/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update appointment');
      if (selectedClientId !== null) await selectClient(selectedClientId);
      showToast(t(successKey));
    } catch (err) {
      console.error(err);
      showToast(t(failureKey), 'error');
    }
  }

  function handleMarkAppointmentCompleted(id) {
    updateAppointmentStatus(id, 'Completed', 'appointments.completedSuccess', 'appointments.updateFailed');
  }

  function handleCancelAppointment(id) {
    updateAppointmentStatus(id, 'Cancelled', 'appointments.cancelledSuccess', 'appointments.updateFailed');
  }

  async function handleRemoveAppointment(id) {
    const confirmed = window.confirm(t('appointments.confirmRemove'));
    if (!confirmed) return;
    try {
      const res = await apiFetch(`/appointments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove appointment');
      if (selectedClientId !== null) await selectClient(selectedClientId);
      showToast(t('appointments.removeSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('appointments.removeFailed'), 'error');
    }
  }

  function handleCompanyFieldChange(field, value) {
    setCompanyFormValues((prev) => ({ ...prev, [field]: value }));
  }

  function startEditCompany(company) {
    setCompanyFormValues({
      name: company.name || '',
      region: company.region || '',
      city: company.city || '',
      country: company.country || '',
      commercial_registration_number: company.commercial_registration_number || '',
      vat_number: company.vat_number || '',
      national_address: company.national_address || '',
      industry: company.industry || '',
      briefing: company.briefing || '',
      contact_person_name: company.contact_person_name || '',
      additional_phone_number: company.additional_phone_number || ''
    });
    setEditingCompanyId(company.id);
    setCompanyFormVisible(true);
  }

  function cancelCompanyForm() {
    setCompanyFormValues(emptyCompanyForm);
    setEditingCompanyId(null);
    setCompanyFormVisible((detail?.companies || []).length === 0);
  }

  async function submitCompany() {
    const name = companyFormValues.name.trim();
    if (!name) {
      showToast(t('companies.nameRequired'), 'error');
      return;
    }
    if (selectedClientId === null) {
      showToast(t('common.selectClientFirst'), 'error');
      return;
    }
    const payload = {
      name,
      region: companyFormValues.region.trim(),
      city: companyFormValues.city.trim(),
      country: companyFormValues.country.trim(),
      commercial_registration_number: companyFormValues.commercial_registration_number.trim(),
      vat_number: companyFormValues.vat_number.trim(),
      national_address: companyFormValues.national_address.trim(),
      industry: companyFormValues.industry,
      briefing: companyFormValues.briefing.trim(),
      contact_person_name: companyFormValues.contact_person_name.trim(),
      additional_phone_number: companyFormValues.additional_phone_number.trim()
    };
    try {
      const res = editingCompanyId !== null
        ? await apiFetch(`/companies/${editingCompanyId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await apiFetch(`/clients/${selectedClientId}/companies`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
      if (!res.ok) throw new Error('Failed to save company');
      setEditingCompanyId(null);
      setCompanyFormValues(emptyCompanyForm);
      await selectClient(selectedClientId);
      showToast(t('companies.saveSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('companies.saveFailed'), 'error');
    }
  }

  async function removeCompany(companyId, name) {
    const confirmed = window.confirm(t('companies.confirmRemove').replace('{name}', name));
    if (!confirmed) return;
    try {
      const res = await apiFetch(`/companies/${companyId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove company');
      if (selectedClientId !== null) await selectClient(selectedClientId);
      showToast(t('companies.removeSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('companies.removeFailed'), 'error');
    }
  }

  async function handlePipelineNextPhase() {
    if (selectedClientId === null) {
      showToast(t('common.selectClientFirst'), 'error');
      return;
    }
    const id = selectedClientId;
    try {
      const res = await apiFetch(`/clients/${id}/engagements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New engagement', description: 'Created from UI' })
      });
      if (!res.ok) throw new Error('Failed to create engagement');

      if (graduateToStage) {
        await apiFetch(`/clients/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: graduateToStage, status: graduateStatus })
        });
        const remaining = await loadClients();
        if (remaining.length) {
          await selectClient(remaining[0].id);
        } else {
          resetDetailPanel();
        }
        showToast(t('pipeline.nextPhaseSuccess'));
        navigate(`/${graduateToStage}`, { state: { selectClientId: id } });
      } else {
        await selectClient(id);
        await loadClients();
        showToast(t('pipeline.nextPhaseSuccess'));
      }
    } catch (err) {
      console.error(err);
      showToast(t('pipeline.createFailed'), 'error');
    }
  }

  function handleDeleteClient() {
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) {
      showToast(t('client.noneSelected'), 'error');
      return;
    }
    if (requireCancelReason) {
      setCancelReason('');
      setPendingCancel({ id: client.id, name: client.contact_name });
    } else {
      cancelClient(client.id, client.contact_name);
    }
  }

  function cancelCancelModal() {
    setPendingCancel(null);
    setCancelReason('');
  }

  async function confirmCancelModal() {
    if (!cancelReason) {
      showToast(t('pipeline.dealCancelReasonRequired'), 'error');
      return;
    }
    const { id, name } = pendingCancel;
    await cancelClient(id, name, cancelReason);
    setPendingCancel(null);
    setCancelReason('');
  }

  const statusFilterOptions = Array.isArray(listStatusFilter) ? listStatusFilter : [];

  const filteredClients = (() => {
    const query = searchQuery.trim().toLowerCase();
    return clients
      .filter((c) => !statusSubFilter || c.status === statusSubFilter)
      .filter((c) =>
        !query || (c.contact_name || '').toLowerCase().includes(query) || (c.phone || '').toLowerCase().includes(query)
      );
  })();

  const clientsPageCount = Math.max(1, Math.ceil(filteredClients.length / CLIENTS_PAGE_SIZE));
  const currentClientsPage = Math.min(clientsPage, clientsPageCount - 1);
  const pagedClients = filteredClients.slice(
    currentClientsPage * CLIENTS_PAGE_SIZE,
    currentClientsPage * CLIENTS_PAGE_SIZE + CLIENTS_PAGE_SIZE
  );

  function handleSearchChange(value) {
    setSearchQuery(value);
    setClientsPage(0);
  }

  function toggleStatusSubFilter(status) {
    setStatusSubFilter((prev) => (prev === status ? null : status));
    setClientsPage(0);
  }

  const client = detail?.client;
  const notes = detail?.notes || [];
  const companies = detail?.companies || [];
  const appointments = detail?.appointments || [];

  return (
    <>
      <div className="main-grid">
        <section className="panel panel-left">
          <div className="panel-header">
            <h2>{t('directory.title')}</h2>
            {canAddClient && (
              <button className="button primary" type="button" onClick={openAddClientForm}>{t('directory.addClient')}</button>
            )}
          </div>
          {statusFilterOptions.length > 0 && (
            <div className="filter-row">
              {statusFilterOptions.map((status) => {
                const color = status === 'Reschedule' ? 'var(--bp-warning)' : 'var(--bp-navy)';
                const active = statusSubFilter === status;
                const labelKey = STATUS_FILTER_LABEL_KEYS[status] || 'summary.prospects';
                return (
                  <button
                    key={status}
                    className="button"
                    type="button"
                    onClick={() => toggleStatusSubFilter(status)}
                    style={{
                      background: active ? color : 'transparent',
                      color: active ? '#ffffff' : color,
                      borderColor: color
                    }}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
          )}
          <div className="search-row">
            <input
              type="text"
              className="search-input"
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="client-list-wrapper">
            <ClientList clients={pagedClients} selectedClientId={selectedClientId} onSelect={selectClient} />
          </div>
          {clientsPageCount > 1 && (
            <div className="pagination-row">
              <button
                className="button neutral"
                type="button"
                onClick={() => setClientsPage((p) => Math.max(0, p - 1))}
                disabled={currentClientsPage === 0}
                title={t('directory.prevPage')}
                aria-label={t('directory.prevPage')}
                style={{ padding: '4px 10px' }}
              >
                ‹
              </button>
              <span>
                {t('directory.pageIndicator').replace('{current}', String(currentClientsPage + 1)).replace('{total}', String(clientsPageCount))}
              </span>
              <button
                className="button neutral"
                type="button"
                onClick={() => setClientsPage((p) => Math.min(clientsPageCount - 1, p + 1))}
                disabled={currentClientsPage >= clientsPageCount - 1}
                title={t('directory.nextPage')}
                aria-label={t('directory.nextPage')}
                style={{ padding: '4px 10px' }}
              >
                ›
              </button>
            </div>
          )}
        </section>

        <section className="panel panel-right">
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ margin: 0 }}>{t('details.title')}</h2>
            </div>
          </div>

          {showAddClientForm && (
            <AddClientForm
              title={editingClientId !== null ? t('client.editTitle') : t('client.addTitle')}
              values={clientFormValues}
              onChange={(field, value) => setClientFormValues((prev) => ({ ...prev, [field]: value }))}
              onCancel={() => { setClientFormValues(emptyClientForm); setEditingClientId(null); setShowAddClientForm(false); }}
              onSave={saveClient}
              saveLabel={editingClientId !== null ? t('common.saveChanges') : t('client.save')}
            />
          )}

          {!showAddClientForm && (
            <div className="detail-scroll">
              <div className="detail-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="avatar-lg">{client ? initials(client.contact_name) : '–'}</div>
                  <div>
                    <h3>{client ? client.contact_name : t('details.selectClient')}</h3>
                  </div>
                </div>
              </div>

              <CollapsibleSection
                title={t('details.contactInfo')}
                headerExtra={canEditClient && (
                  <button className="button neutral" type="button" onClick={openEditClientForm}>{t('client.editButton')}</button>
                )}
              >
                <div className="info-grid">
                  <div className="info-row">
                    <span>{t('details.clientNameLabel')}</span>
                    <strong>{client?.contact_name || '–'}</strong>
                  </div>
                  <div className="info-row">
                    <span>{t('common.email')}</span>
                    <strong>{client?.email || '–'}</strong>
                  </div>
                  <div className="info-row">
                    <span>{t('common.phone')}</span>
                    <strong>{client?.phone || '–'}</strong>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title={t('services.title')} defaultCollapsed>
                <ServicesSection client={client} onToggle={toggleService} canEdit={canEditClient} />
              </CollapsibleSection>

              <CollapsibleSection title={t('companies.title')} defaultCollapsed>
                <CompanySection
                  companies={companies}
                  formVisible={companyFormVisible}
                  isEditing={editingCompanyId !== null}
                  values={companyFormValues}
                  onFieldChange={handleCompanyFieldChange}
                  onStartEdit={startEditCompany}
                  onRemove={removeCompany}
                  onSubmit={submitCompany}
                  onCancel={cancelCompanyForm}
                  canEdit={canEditClient}
                />
              </CollapsibleSection>

              <CollapsibleSection title={t('notes.title')} defaultCollapsed>
                <NotesSection notes={notes} onAdd={handleAddNote} />
              </CollapsibleSection>

              {useAppointments && (
                <CollapsibleSection title={t('appointments.title')} defaultCollapsed>
                  <AppointmentsSection
                    appointments={appointments}
                    onAdd={handleAddAppointment}
                    onMarkCompleted={handleMarkAppointmentCompleted}
                    onCancel={handleCancelAppointment}
                    onRemove={handleRemoveAppointment}
                  />
                </CollapsibleSection>
              )}

              <PipelineCard
                visible={!!client && client.status !== 'Inactive'}
                deleteLabelKey={deleteLabelKey}
                onNextPhase={handlePipelineNextPhase}
                onDelete={handleDeleteClient}
                onReschedule={rescheduleTargetStage ? handleRescheduleClient : undefined}
              />
            </div>
          )}
        </section>
      </div>

      {pendingReschedule && (
        <ReasonModal
          title={t('pipeline.reschedule')}
          description={t('pipeline.confirmReschedule').replace('{name}', pendingReschedule.name)}
          options={[
            { value: 'Missing Documents', label: t('pipeline.rescheduleReasonMissingDocuments') },
            { value: 'Other', label: t('common.other') }
          ]}
          placeholder={t('common.selectReasonPlaceholder')}
          reason={rescheduleReason}
          onReasonChange={setRescheduleReason}
          confirmLabel={t('pipeline.reschedule')}
          onConfirm={confirmRescheduleModal}
          onCancel={cancelRescheduleModal}
        />
      )}

      {pendingCancel && (
        <ReasonModal
          title={t(deleteLabelKey)}
          description={t('client.confirmCancel').replace('{name}', pendingCancel.name)}
          options={[{ value: 'Other', label: t('common.other') }]}
          placeholder={t('common.selectReasonPlaceholder')}
          reason={cancelReason}
          onReasonChange={setCancelReason}
          confirmLabel={t(deleteLabelKey)}
          onConfirm={confirmCancelModal}
          onCancel={cancelCancelModal}
        />
      )}
    </>
  );
}
