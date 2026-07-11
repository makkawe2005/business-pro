import { initials } from '../utils/format';

const STATUS_DOT_COLORS = {
  Prospect: 'var(--bp-navy)',
  Reschedule: 'var(--bp-warning)'
};

export function ClientList({ clients, selectedClientId, onSelect }) {
  return (
    <ul className="client-list">
      {clients.map((client) => {
        const dotColor = STATUS_DOT_COLORS[client.status];
        return (
          <li
            key={client.id}
            className={`client-row${client.id === selectedClientId ? ' selected' : ''}`}
            onClick={() => onSelect(client.id)}
          >
            <div className="company-entry">
              <div className="company-avatar">{initials(client.contact_name || '–')}</div>
              <strong>{client.contact_name || '–'}</strong>
            </div>
            {dotColor && (
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
