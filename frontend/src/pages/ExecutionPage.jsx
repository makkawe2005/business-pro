import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';
import { ClientList } from '../components/ClientList';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { initials, getTaskUrgency, formatDateOnly } from '../utils/format';

const STATUS_KEY = {
  unassigned: 'tasks.statusUnassigned',
  in_progress: 'tasks.statusInProgress',
  submitted: 'tasks.statusSubmitted',
  sent_back: 'tasks.statusSentBack',
  closed: 'tasks.statusClosed'
};

export function ExecutionPage() {
  const { t } = useI18n();
  const location = useLocation();
  const showToast = useToastStore((s) => s.showToast);

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubAssignee, setNewSubAssignee] = useState('');
  const [newSubDueDate, setNewSubDueDate] = useState('');
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const loadClients = useCallback(async () => {
    const res = await apiFetch('/clients?stage=phase4');
    if (!res.ok) return [];
    return res.json();
  }, []);

  const selectClient = useCallback(async (id) => {
    setSelectedClientId(id);
    try {
      const res = await apiFetch(`/clients/${id}`);
      if (!res.ok) throw new Error('Failed to load client');
      const data = await res.json();
      setDetail(data);
      // Open tasks that need a PM decision by default; leave the rest collapsed.
      const needsAttention = (data.tasks || []).filter((tk) => tk.status === 'submitted').map((tk) => tk.id);
      setExpandedIds(new Set(needsAttention));
    } catch (err) {
      console.error(err);
      showToast(t('tasks.loadFailed'), 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const list = await loadClients();
      setClients(list);
      const wantedId = location.state?.selectClientId;
      if (wantedId && list.some((c) => c.id === wantedId)) {
        await selectClient(wantedId);
      } else if (list.length) {
        await selectClient(list[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const res = await apiFetch('/task-assignable-users');
      if (res.ok) setAssignableUsers(await res.json());
    })();
  }, []);

  function toggleExpanded(taskId) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  async function refreshTasksOnly() {
    if (selectedClientId === null) return;
    try {
      const res = await apiFetch(`/clients/${selectedClientId}`);
      if (!res.ok) throw new Error('Failed to load client');
      setDetail(await res.json());
    } catch (err) {
      console.error(err);
      showToast(t('tasks.loadFailed'), 'error');
    }
  }

  async function refreshAfterChange() {
    const list = await loadClients();
    setClients(list);
    await refreshTasksOnly();
  }

  async function assignTask(taskId, userId) {
    try {
      const res = await apiFetch(`/tasks/${taskId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: userId ? Number(userId) : null })
      });
      if (!res.ok) throw new Error('Failed to update task');
      await refreshTasksOnly();
    } catch (err) {
      console.error(err);
      showToast(t('tasks.updateFailed'), 'error');
    }
  }

  async function setDueDate(taskId, value) {
    try {
      const res = await apiFetch(`/tasks/${taskId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: value || null })
      });
      if (!res.ok) throw new Error('Failed to update due date');
      await refreshTasksOnly();
    } catch (err) {
      console.error(err);
      showToast(t('tasks.updateFailed'), 'error');
    }
  }

  async function addSubtask() {
    if (!newSubTitle.trim() || selectedClientId === null) return;
    if (newSubAssignee && !newSubDueDate) {
      showToast(t('tasks.dueDateRequiredForAssignee'), 'error');
      return;
    }
    try {
      const res = await apiFetch(`/clients/${selectedClientId}/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSubTitle.trim(),
          assigned_to: newSubAssignee ? Number(newSubAssignee) : null,
          due_date: newSubDueDate || null
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error || t('tasks.addSubtaskFailed'), 'error');
        return;
      }
      setNewSubTitle('');
      setNewSubAssignee('');
      setNewSubDueDate('');
      await refreshAfterChange();
    } catch (err) {
      console.error(err);
      showToast(t('tasks.addSubtaskFailed'), 'error');
    }
  }

  async function removeSubtask(taskId) {
    if (!window.confirm(t('tasks.confirmRemoveSubtask'))) return;
    try {
      const res = await apiFetch(`/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove sub-task');
      await refreshAfterChange();
    } catch (err) {
      console.error(err);
      showToast(t('tasks.removeSubtaskFailed'), 'error');
    }
  }

  async function reviewTask(taskId, decision) {
    let comment = null;
    if (decision === 'send_back') {
      comment = window.prompt(t('tasks.sendBackPrompt'));
      if (!comment || !comment.trim()) return;
    }
    try {
      const res = await apiFetch(`/tasks/${taskId}/review`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error || t('tasks.reviewFailed'), 'error');
        return;
      }
      await refreshAfterChange();
      showToast(t('tasks.reviewSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('tasks.reviewFailed'), 'error');
    }
  }

  async function markCompleted() {
    if (selectedClientId === null) return;
    try {
      const res = await apiFetch(`/clients/${selectedClientId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error || t('tasks.completeFailed'), 'error');
        return;
      }
      await refreshAfterChange();
      showToast(t('tasks.completeSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('tasks.completeFailed'), 'error');
    }
  }

  const filteredClients = clients.filter((c) => (c.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const client = detail?.client;
  const tasks = detail?.tasks || [];
  const directTasks = tasks.filter((tk) => tk.parent_task_id === null && tk.service !== 'business_solutions');
  const parentTask = tasks.find((tk) => tk.parent_task_id === null && tk.service === 'business_solutions');
  const subtasks = parentTask ? tasks.filter((tk) => tk.parent_task_id === parentTask.id) : [];
  const leafTasks = [...directTasks, ...subtasks];
  const closedCount = leafTasks.filter((tk) => tk.status === 'closed').length;
  const allClosed = leafTasks.length > 0 && closedCount === leafTasks.length;

  function renderTaskRow(task) {
    const isOpen = expandedIds.has(task.id);
    const lastSentBack = task.status === 'sent_back'
      ? [...(task.events || [])].reverse().find((e) => e.event_type === 'sent_back')
      : null;
    const assigneeName = assignableUsers.find((u) => u.id === task.assigned_to)?.name;
    const urgency = getTaskUrgency(task.due_date, task.status);

    return (
      <div className={`task-item${isOpen ? ' expanded' : ''}`} key={task.id}>
        <button type="button" className="task-item-summary" onClick={() => toggleExpanded(task.id)}>
          <span className="task-item-chevron">{isOpen ? '▾' : '▸'}</span>
          <span className="task-item-title">{task.title}</span>
          <span className="task-item-assignee">{assigneeName || t('tasks.unassignedOption')}</span>
          <span className={`task-pill ${task.status}`}>{t(STATUS_KEY[task.status])}</span>
          <span className={`task-item-due${urgency ? ` ${urgency}` : ''}`} title={urgency ? t(`tasks.due.${urgency}`) : undefined}>
            {urgency && <span className="task-due-alert">⚠</span>}
            {task.due_date ? formatDateOnly(task.due_date) : '–'}
          </span>
        </button>

        {isOpen && (
          <div className="task-item-detail">
            <div className="task-item-controls">
              <label>
                <span>{t('tasks.assignTo')}</span>
                <select
                  value={task.assigned_to || ''}
                  onChange={(e) => assignTask(task.id, e.target.value)}
                  disabled={task.status === 'submitted' || task.status === 'closed'}
                >
                  <option value="">{t('tasks.unassignedOption')}</option>
                  {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <label>
                <span>{t('tasks.due')}</span>
                <input
                  type="date"
                  lang="en"
                  value={formatDateOnly(task.due_date)}
                  onChange={(e) => setDueDate(task.id, e.target.value)}
                  disabled={task.status === 'closed'}
                />
              </label>
              <div className="task-item-controls-actions">
                {task.status === 'submitted' && (
                  <>
                    <button className="button success" type="button" onClick={() => reviewTask(task.id, 'approve')}>{t('tasks.approve')}</button>
                    <button className="button danger" type="button" onClick={() => reviewTask(task.id, 'send_back')}>{t('tasks.sendBack')}</button>
                  </>
                )}
                {task.parent_task_id !== null && ['unassigned', 'in_progress'].includes(task.status) && (
                  <button className="button neutral" type="button" onClick={() => removeSubtask(task.id)}>{t('common.remove')}</button>
                )}
              </div>
            </div>
            {task.deliverable_note && (
              <div className="task-note-preview"><span>{t('tasks.deliverableNote')}</span>{task.deliverable_note}</div>
            )}
            {lastSentBack?.comment && (
              <div className="task-note-preview task-note-danger"><span>{t('tasks.pmComment')}</span>{lastSentBack.comment}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
    <div className="main-grid">
      <section className="panel panel-left">
        <div className="panel-header">
          <h2>{t('directory.title')}</h2>
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
          <ClientList clients={filteredClients} selectedClientId={selectedClientId} onSelect={selectClient} />
        </div>
      </section>

      <section className="panel panel-right">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>{t('tasks.title')}</h2>
        </div>
        {!client ? (
          <div className="detail-scroll">
            <div className="calendar-empty-day" style={{ textAlign: 'center', margin: '24px 0' }}>{t('details.noClients')}</div>
          </div>
        ) : (
          <div className="detail-scroll">
            <div className="detail-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="avatar-lg">{initials(client.contact_name)}</div>
                <div>
                  <h3>{client.contact_name}</h3>
                  {leafTasks.length > 0 && (
                    <span className="service-meta">{closedCount}/{leafTasks.length} {t('tasks.closedCount')}</span>
                  )}
                </div>
              </div>
              {client.status === 'Completed' ? (
                <span className="task-pill closed" style={{ marginTop: '14px', display: 'inline-block' }}>{t('tasks.completedLabel')}</span>
              ) : (
                <button
                  className="button primary"
                  type="button"
                  onClick={markCompleted}
                  disabled={!allClosed}
                  title={allClosed ? '' : t('tasks.completeDisabledHint')}
                  style={{ marginTop: '14px' }}
                >
                  {t('tasks.markCompleted')}
                </button>
              )}
            </div>

            <div className="task-list">
              {directTasks.map((task) => renderTaskRow(task))}
            </div>

            {parentTask && (
              <CollapsibleSection title={`${parentTask.title} (${subtasks.filter((s) => s.status === 'closed').length}/${subtasks.length})`}>
                {subtasks.length === 0 && <div className="empty-sub">{t('tasks.noSubtasks')}</div>}
                <div className="task-list">
                  {subtasks.map((s) => renderTaskRow(s))}
                </div>
                <div className="add-subtask-row">
                  <input
                    type="text"
                    placeholder={t('tasks.newSubtaskPlaceholder')}
                    value={newSubTitle}
                    onChange={(e) => setNewSubTitle(e.target.value)}
                  />
                  <select value={newSubAssignee} onChange={(e) => setNewSubAssignee(e.target.value)}>
                    <option value="">{t('tasks.unassignedOption')}</option>
                    {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input
                    type="date"
                    lang="en"
                    value={newSubDueDate}
                    onChange={(e) => setNewSubDueDate(e.target.value)}
                    title={t('tasks.due')}
                    required={!!newSubAssignee}
                  />
                  <button className="button primary" type="button" onClick={addSubtask}>{t('tasks.addSubtask')}</button>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}
      </section>
    </div>
    </div>
  );
}
