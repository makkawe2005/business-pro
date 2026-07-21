import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';
import { initials, getTaskUrgency, formatDateOnly } from '../utils/format';

const STATUS_KEY = {
  unassigned: 'tasks.statusUnassigned',
  in_progress: 'tasks.statusInProgress',
  submitted: 'tasks.statusSubmitted',
  sent_back: 'tasks.statusSentBack',
  closed: 'tasks.statusClosed'
};

const STAGE_KEY = {
  phase1: 'nav.phase1',
  phase2: 'nav.phase2',
  phase3: 'nav.phase3',
  phase4: 'nav.phase4'
};

export function MyTasksPage() {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [expandedIds, setExpandedIds] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientFilter, setClientFilter] = useState('all');

  async function load({ resetExpanded } = {}) {
    try {
      const res = await apiFetch('/my-tasks');
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = await res.json();
      setTasks(data);
      setNotes((prev) => {
        const next = { ...prev };
        data.forEach((task) => {
          if (next[task.id] === undefined) next[task.id] = task.deliverable_note || '';
        });
        return next;
      });
      if (resetExpanded || expandedIds === null) {
        // Needs-your-action tasks open by default; already-submitted/closed ones collapse out of the way.
        const actionable = data.filter((task) => ['unassigned', 'in_progress', 'sent_back'].includes(task.status)).map((task) => task.id);
        setExpandedIds(new Set(actionable));
      }
      setSelectedClientId((prev) => {
        if (prev !== null && data.some((task) => task.client_id === prev)) return prev;
        return data[0]?.client_id ?? null;
      });
    } catch (err) {
      console.error(err);
      showToast(t('tasks.loadFailed'), 'error');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load({ resetExpanded: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleExpanded(taskId) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  async function submitTask(taskId) {
    const note = (notes[taskId] || '').trim();
    if (!note) {
      showToast(t('tasks.noteRequired'), 'error');
      return;
    }
    try {
      const res = await apiFetch(`/tasks/${taskId}/submit`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverable_note: note })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error || t('tasks.submitFailed'), 'error');
        return;
      }
      await load();
      showToast(t('tasks.submitSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('tasks.submitFailed'), 'error');
    }
  }

  if (!loaded) return null;

  // Only the clients this person actually has a task on — built entirely from their own
  // tasks, not the real client directory, so it needs no phase/page permission to show.
  const myClients = [];
  const seenClientIds = new Set();
  for (const task of tasks) {
    if (seenClientIds.has(task.client_id)) continue;
    seenClientIds.add(task.client_id);
    const clientTasks = tasks.filter((tk) => tk.client_id === task.client_id);
    const clientUrgencies = clientTasks.map((tk) => getTaskUrgency(tk.due_date, tk.status));
    myClients.push({
      id: task.client_id,
      contact_name: task.contact_name,
      company_name: task.company_name,
      stage: task.stage,
      openCount: clientTasks.filter((tk) => tk.status !== 'closed').length,
      totalCount: clientTasks.length,
      urgency: clientUrgencies.includes('overdue') ? 'overdue' : (clientUrgencies.includes('soon') ? 'soon' : null)
    });
  }

  const pendingCount = myClients.filter((c) => c.openCount > 0).length;
  const completedCount = myClients.filter((c) => c.openCount === 0).length;
  const filteredClients = myClients.filter((c) => {
    if (clientFilter === 'pending') return c.openCount > 0;
    if (clientFilter === 'completed') return c.openCount === 0;
    return true;
  });

  const selectedClient = myClients.find((c) => c.id === selectedClientId) || null;
  const clientTasks = selectedClientId === null ? [] : tasks.filter((task) => task.client_id === selectedClientId);

  return (
    <div>
    <div className="main-grid">
      <section className="panel panel-left">
        <div className="panel-header">
          <h2>{t('myTasks.clientsTitle')}</h2>
        </div>
        {myClients.length > 0 && (
          <div className="filter-row">
            {[
              ['all', t('myTasks.filterAll'), myClients.length],
              ['pending', t('myTasks.pendingClients'), pendingCount],
              ['completed', t('myTasks.completedClients'), completedCount]
            ].map(([key, label, count]) => {
              const active = clientFilter === key;
              return (
                <button
                  key={key}
                  className="button"
                  type="button"
                  onClick={() => setClientFilter(key)}
                  style={{
                    background: active ? 'var(--bp-navy)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--bp-navy)',
                    borderColor: 'var(--bp-navy)'
                  }}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        )}
        <div className="client-list-wrapper">
          {filteredClients.length === 0 ? (
            <div className="calendar-empty-day" style={{ margin: '16px 22px' }}>
              {myClients.length === 0 ? t('myTasks.empty') : t('myTasks.filterEmpty')}
            </div>
          ) : (
            <ul className="client-list">
              {filteredClients.map((c) => {
                const isCompleted = c.openCount === 0;
                return (
                  <li
                    key={c.id}
                    className={`client-row${isCompleted ? ' completed' : ''}${c.id === selectedClientId ? ' selected' : ''}`}
                    onClick={() => setSelectedClientId(c.id)}
                  >
                    <div className="company-entry">
                      <div className="company-avatar">{initials(c.contact_name || '–')}</div>
                      <div style={{ minWidth: 0 }}>
                        <strong>{c.contact_name}</strong>
                        <div className="service-meta">{c.company_name || '–'}</div>
                      </div>
                    </div>
                    <span className={`client-row-badge${isCompleted ? ' completed' : ''}`}>
                      {isCompleted
                        ? <>✓ {c.openCount}/{c.totalCount}</>
                        : <>{c.urgency && <span className={`task-due-alert ${c.urgency}`} title={t(`tasks.due.${c.urgency}`)}>⚠ </span>}{c.openCount}/{c.totalCount}</>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="panel panel-right">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>{t('myTasks.title')}</h2>
        </div>
        {!selectedClient ? (
          <div className="detail-scroll">
            <div className="calendar-empty-day" style={{ textAlign: 'center', margin: '24px 0' }}>{t('myTasks.empty')}</div>
          </div>
        ) : (
          <div className="detail-scroll">
            <div className="detail-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="avatar-lg">{initials(selectedClient.contact_name)}</div>
                <div>
                  <h3>{selectedClient.contact_name}</h3>
                  <span className="service-meta">
                    {selectedClient.company_name || '–'}
                    {STAGE_KEY[selectedClient.stage] ? ` — ${t(STAGE_KEY[selectedClient.stage])}` : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="task-list">
              {clientTasks.map((task) => {
                const isOpen = expandedIds?.has(task.id);
                const editable = ['unassigned', 'in_progress', 'sent_back'].includes(task.status);
                const lastSentBack = task.status === 'sent_back'
                  ? [...(task.events || [])].reverse().find((e) => e.event_type === 'sent_back')
                  : null;
                const urgency = getTaskUrgency(task.due_date, task.status);
                return (
                  <div className={`task-item${isOpen ? ' expanded' : ''}`} key={task.id}>
                    <button type="button" className="task-item-summary compact" onClick={() => toggleExpanded(task.id)}>
                      <span className="task-item-chevron">{isOpen ? '▾' : '▸'}</span>
                      <span className="task-item-title">{task.title}</span>
                      <span className={`task-pill ${task.status}`}>{t(STATUS_KEY[task.status])}</span>
                      <span className={`task-item-due${urgency ? ` ${urgency}` : ''}`} title={urgency ? t(`tasks.due.${urgency}`) : undefined}>
                        {urgency && <span className="task-due-alert">⚠</span>}
                        {task.due_date ? formatDateOnly(task.due_date) : t('tasks.noDueDate')}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="task-item-detail">
                        {lastSentBack?.comment && (
                          <div className="task-note-preview task-note-danger">
                            <span>{t('tasks.pmComment')}</span>{lastSentBack.comment}
                          </div>
                        )}
                        <textarea
                          className="deliverable"
                          placeholder={t('tasks.notePlaceholder')}
                          value={notes[task.id] ?? ''}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          disabled={!editable}
                        />
                        <div className="submit-row">
                          <span className="status-note">
                            {editable ? t('myTasks.privateHint') : t('myTasks.awaitingReviewHint')}
                          </span>
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => submitTask(task.id)}
                            disabled={!editable}
                          >
                            {t('tasks.submitForReview')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
    </div>
  );
}
