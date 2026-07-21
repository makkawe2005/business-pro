import { initials } from '../utils/format';
import { useI18n } from '../i18n/useI18n';
import { RescheduleIcon } from './Icons';

const STATUS_DOT_COLORS = {
  Prospect: 'var(--bp-navy)'
};

export function ClientList({ clients, selectedClientId, onSelect }) {
  const { t } = useI18n();
  return (
    <ul className="client-list">
      {clients.map((client) => {
        const dotColor = STATUS_DOT_COLORS[client.status];
        const hasTasks = client.total_task_count > 0;
        const isCompleted = hasTasks && client.open_task_count === 0;
        const urgency = client.has_overdue_task ? 'overdue' : (client.has_due_soon_task ? 'soon' : null);
        return (
          <li
            key={client.id}
            className={`client-row${isCompleted ? ' completed' : ''}${client.id === selectedClientId ? ' selected' : ''}`}
            onClick={() => onSelect(client.id)}
          >
            <div className="company-entry">
              <div className="company-avatar">{initials(client.contact_name || '–')}</div>
              <strong>{client.contact_name || '–'}</strong>
            </div>
            {hasTasks ? (
              <span className={`client-row-badge${isCompleted ? ' completed' : ''}`}>
                {isCompleted
                  ? <>✓ {client.open_task_count}/{client.total_task_count}</>
                  : <>{urgency && <span className={`task-due-alert ${urgency}`} title={t(`tasks.due.${urgency}`)}>⚠ </span>}{client.open_task_count}/{client.total_task_count}</>}
              </span>
            ) : client.status === 'Reschedule' ? (
              <span
                className="reschedule-badge"
                title={t('dashboard.columnReschedule')}
                aria-label={t('dashboard.columnReschedule')}
              >
                <RescheduleIcon />
              </span>
            ) : dotColor && (
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
