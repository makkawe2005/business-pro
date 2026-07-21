import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';
import { getTaskUrgency, formatDateOnly } from '../utils/format';

const STATUS_KEY = {
  unassigned: 'tasks.statusUnassigned',
  in_progress: 'tasks.statusInProgress',
  submitted: 'tasks.statusSubmitted',
  sent_back: 'tasks.statusSentBack',
  closed: 'tasks.statusClosed'
};

const PAGE_SIZE = 10;

export function ExecutionDashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const [clientCount, setClientCount] = useState(0);
  const [taskCounts, setTaskCounts] = useState({ open: 0, closed: 0, overdue: 0 });
  const [taskWorkload, setTaskWorkload] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tablePage, setTablePage] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [summaryRes, tasksRes] = await Promise.all([
          apiFetch('/execution/summary'),
          apiFetch('/execution/tasks')
        ]);
        if (!summaryRes.ok) throw new Error('Failed to load execution summary');
        if (!tasksRes.ok) throw new Error('Failed to load execution tasks');
        const summary = await summaryRes.json();
        setClientCount(summary.clientCount || 0);
        setTaskCounts(summary.taskCounts || { open: 0, closed: 0, overdue: 0 });
        setTaskWorkload(summary.taskWorkload || []);
        setTasks(await tasksRes.json());
      } catch (err) {
        console.error(err);
        showToast(t('dashboard.loadFailed'), 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = Math.max(1, taskCounts.open + taskCounts.closed);
  const openPct = (taskCounts.open / total) * 100;
  const closedPct = (taskCounts.closed / total) * 100;

  function handleSearchChange(value) {
    setSearchQuery(value);
    setTablePage(0);
  }

  function toggleStatusFilter(status) {
    setStatusFilter((prev) => (prev === status ? '' : status));
    setTablePage(0);
  }

  function viewTask(task) {
    navigate('/phase4', { state: { selectClientId: task.client_id } });
  }

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter && task.status !== statusFilter) return false;
      if (!q) return true;
      return [task.title, task.contact_name, task.company_name, task.assignee_name]
        .some((field) => (field || '').toLowerCase().includes(q));
    });
  }, [tasks, searchQuery, statusFilter]);

  const tablePageCount = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const currentTablePage = Math.min(tablePage, tablePageCount - 1);
  const pagedTasks = filteredTasks.slice(currentTablePage * PAGE_SIZE, currentTablePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="dashboard-intro">
        <h2>{t('executionDashboard.title')}</h2>
        <p>{t('executionDashboard.subtitle')}</p>
      </div>

      <div className="dashboard-charts-row">
        <div className="dashboard-chart-card">
          <h3 className="section-title">{t('dashboard.taskChartTitle')}</h3>
          <div className="task-stat-row">
            <div className="task-stat-tile" style={{ '--task-stat-color': 'var(--bp-neutral)' }}>
              <strong>{clientCount}</strong>
              <span>{t('executionDashboard.statClients')}</span>
            </div>
            <div className="task-stat-tile" style={{ '--task-stat-color': 'var(--bp-navy)' }}>
              <strong>{taskCounts.open}</strong>
              <span>{t('dashboard.taskOpen')}</span>
            </div>
            <div className="task-stat-tile" style={{ '--task-stat-color': 'var(--bp-danger)' }}>
              <strong>{taskCounts.overdue}</strong>
              <span>{t('myTasks.statOverdue')}</span>
            </div>
          </div>
          <div className="task-stat-bar">
            <div className="task-stat-bar-segment" style={{ width: `${openPct}%`, background: 'var(--bp-navy)' }} />
            <div className="task-stat-bar-segment" style={{ width: `${closedPct}%`, background: 'var(--bp-success)' }} />
          </div>
        </div>
      </div>

      <div className="workload-panel">
        <h3 className="section-title">{t('dashboard.workloadTitle')}</h3>
        {taskWorkload.length === 0 ? (
          <p className="dashboard-empty">{t('dashboard.emptyColumn')}</p>
        ) : (
          <>
            <div className="workload-legend">
              <span className="workload-legend-item">
                <span className="workload-legend-dot" style={{ background: 'var(--bp-navy)' }} />
                {t('dashboard.taskOpen')}
              </span>
              <span className="workload-legend-item">
                <span className="workload-legend-dot" style={{ background: 'var(--bp-danger)' }} />
                {t('myTasks.statOverdue')}
              </span>
              <span className="workload-legend-item">
                <span className="workload-legend-dot" style={{ background: 'var(--bp-success)' }} />
                {t('dashboard.taskClosed')}
              </span>
            </div>
            {(() => {
              const maxTotal = Math.max(1, ...taskWorkload.map((w) => w.open_count + w.overdue_count + w.closed_count));
              return taskWorkload.map((w) => {
                const rowTotal = w.open_count + w.overdue_count + w.closed_count;
                const openBarPct = (w.open_count / maxTotal) * 100;
                const overdueBarPct = (w.overdue_count / maxTotal) * 100;
                const closedBarPct = (w.closed_count / maxTotal) * 100;
                return (
                  <div className="workload-row" key={w.user_id}>
                    <span className="workload-name" title={w.name}>{w.name}</span>
                    <div className="workload-track">
                      <div className="workload-segment" style={{ width: `${openBarPct}%`, background: 'var(--bp-navy)' }} />
                      <div className="workload-segment" style={{ width: `${overdueBarPct}%`, background: 'var(--bp-danger)' }} />
                      <div className="workload-segment" style={{ width: `${closedBarPct}%`, background: 'var(--bp-success)' }} />
                    </div>
                    <span className="workload-counts">
                      {w.open_count} {t('dashboard.taskOpenShort')} · {w.overdue_count} {t('dashboard.taskOverdueShort')} · {w.closed_count} {t('dashboard.taskClosedShort')} · {rowTotal} {t('dashboard.taskTotalShort')}
                    </span>
                  </div>
                );
              });
            })()}
          </>
        )}
      </div>

      <div className="dashboard-chart-card" style={{ marginTop: '18px' }}>
        <h3 className="section-title">{t('executionDashboard.tasksTitle')}</h3>

        <div className="dashboard-search">
          <div className="dashboard-search-input">
            <input
              type="text"
              className="search-input"
              placeholder={t('executionDashboard.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="button"
              type="button"
              onClick={() => toggleStatusFilter('')}
              style={{
                background: statusFilter === '' ? 'var(--bp-navy)' : 'transparent',
                color: statusFilter === '' ? '#ffffff' : 'var(--bp-navy)',
                borderColor: 'var(--bp-navy)'
              }}
            >
              {t('executionDashboard.statusAll')}
            </button>
            {Object.entries(STATUS_KEY).map(([status, labelKey]) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  className="button"
                  type="button"
                  onClick={() => toggleStatusFilter(status)}
                  style={{
                    background: active ? 'var(--bp-navy)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--bp-navy)',
                    borderColor: 'var(--bp-navy)'
                  }}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('executionDashboard.tableTask')}</th>
                <th>{t('executionDashboard.tableClient')}</th>
                <th>{t('executionDashboard.tableAssignee')}</th>
                <th>{t('executionDashboard.tableDue')}</th>
                <th>{t('dashboard.tableStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="dashboard-empty">
                    {tasks.length === 0 ? t('executionDashboard.noTasks') : t('executionDashboard.noSearchMatches')}
                  </td>
                </tr>
              ) : (
                pagedTasks.map((task) => {
                  const urgency = getTaskUrgency(task.due_date, task.status);
                  return (
                    <tr key={task.id} onClick={() => viewTask(task)} style={{ cursor: 'pointer' }}>
                      <td>
                        <strong>{task.title}</strong>
                        {task.parent_task_id !== null && (
                          <div className="service-meta">{t('executionDashboard.subtaskOf').replace('{parent}', task.parent_title)}</div>
                        )}
                      </td>
                      <td>
                        {task.contact_name}
                        <div className="service-meta">{task.company_name || '–'}</div>
                      </td>
                      <td>{task.assignee_name || t('tasks.unassignedOption')}</td>
                      <td className={urgency ? urgency : undefined}>
                        <span className={`task-item-due${urgency ? ` ${urgency}` : ''}`} title={urgency ? t(`tasks.due.${urgency}`) : undefined}>
                          {urgency && <span className="task-due-alert">⚠</span>}
                          {task.due_date ? formatDateOnly(task.due_date) : t('tasks.noDueDate')}
                        </span>
                      </td>
                      <td>
                        <span className={`task-pill ${task.status}`}>{t(STATUS_KEY[task.status])}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {tablePageCount > 1 && (
          <div className="pagination-row" style={{ marginTop: '10px', borderTop: 'none' }}>
            <button
              className="button neutral"
              type="button"
              onClick={() => setTablePage((p) => Math.max(0, p - 1))}
              disabled={currentTablePage === 0}
              title={t('directory.prevPage')}
              aria-label={t('directory.prevPage')}
              style={{ padding: '4px 10px' }}
            >
              ‹
            </button>
            <span>
              {t('directory.pageIndicator').replace('{current}', String(currentTablePage + 1)).replace('{total}', String(tablePageCount))}
            </span>
            <button
              className="button neutral"
              type="button"
              onClick={() => setTablePage((p) => Math.min(tablePageCount - 1, p + 1))}
              disabled={currentTablePage >= tablePageCount - 1}
              title={t('directory.nextPage')}
              aria-label={t('directory.nextPage')}
              style={{ padding: '4px 10px' }}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
