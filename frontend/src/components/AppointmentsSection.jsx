import { useState } from 'react';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';

const statusKeys = {
  Scheduled: 'appointments.statusScheduled',
  Completed: 'appointments.statusCompleted',
  Cancelled: 'appointments.statusCancelled'
};

const meetingTypeKeys = {
  Remote: 'appointments.meetingTypeRemote',
  'In-Person': 'appointments.meetingTypeInPerson'
};

// Chrome's native date picker takes its calendar language from the browser's own
// display-language setting, not the page's `lang` attribute — there's no way to force it to
// stay in English from the page, so this is a plain typed field instead of type="date".
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidDate(match) {
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function AppointmentsSection({ appointments, onAdd, onMarkCompleted, onCancel, onRemove }) {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  const [scheduledAt, setScheduledAt] = useState('');
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [meetingType, setMeetingType] = useState('Remote');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');

  function submit() {
    const trimmedScheduledAt = scheduledAt.trim();
    const trimmedTitle = title.trim();
    if (!trimmedScheduledAt || !trimmedTitle) {
      showToast(t('appointments.fieldsRequired'), 'error');
      return;
    }
    const match = trimmedScheduledAt.match(DATE_PATTERN);
    if (!match || !isValidDate(match)) {
      showToast(t('appointments.invalidDateFormat'), 'error');
      return;
    }
    onAdd(`${trimmedScheduledAt}T00:00`, trimmedTitle, agenda.trim(), meetingType, location.trim(), meetingLink.trim());
    setScheduledAt('');
    setTitle('');
    setAgenda('');
    setMeetingType('Remote');
    setLocation('');
    setMeetingLink('');
  }

  return (
    <div>
      <div className="notes-list">
        {appointments.length === 0 ? (
          <p style={{ color: '#6b7280', margin: 0 }}>{t('appointments.empty')}</p>
        ) : (
          appointments.map((appt) => {
            const when = appt.scheduled_at ? new Date(appt.scheduled_at).toLocaleDateString('en-US') : '';
            return (
              <div className="note-item" key={appt.id}>
                <p><strong>{appt.title}</strong> — {when} · {t(statusKeys[appt.status] || 'appointments.statusScheduled')} · {t(meetingTypeKeys[appt.meeting_type] || 'appointments.meetingTypeRemote')}</p>
                {appt.meeting_type === 'In-Person' && appt.location && <p>{t('appointments.locationLabel')}: {appt.location}</p>}
                {appt.meeting_type === 'Remote' && appt.meeting_link && (
                  <p>
                    {t('appointments.meetingLinkLabel')}:{' '}
                    <a href={appt.meeting_link} target="_blank" rel="noopener noreferrer">{appt.meeting_link}</a>
                  </p>
                )}
                {appt.agenda && <p>{appt.agenda}</p>}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {appt.status === 'Scheduled' && (
                    <>
                      <button className="button neutral" type="button" onClick={() => onMarkCompleted(appt.id)}>
                        {t('appointments.markCompleted')}
                      </button>
                      <button className="button danger" type="button" onClick={() => onCancel(appt.id)}>
                        {t('appointments.cancelAppointment')}
                      </button>
                    </>
                  )}
                  <button className="button danger" type="button" onClick={() => onRemove(appt.id)}>
                    {t('common.remove')}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="company-form-grid">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', gridColumn: '1 / -1' }}>
          <input
            type="text"
            dir="ltr"
            placeholder="YYYY-MM-DD"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <input
            type="text"
            placeholder={t('appointments.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
            <option value="Remote">{t('appointments.meetingTypeRemote')}</option>
            <option value="In-Person">{t('appointments.meetingTypeInPerson')}</option>
          </select>
        </div>
        {meetingType === 'In-Person' ? (
          <input
            type="text"
            placeholder={t('appointments.locationPlaceholder')}
            style={{ gridColumn: '1 / -1' }}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        ) : (
          <input
            type="text"
            dir="ltr"
            placeholder={t('appointments.meetingLinkPlaceholder')}
            style={{ gridColumn: '1 / -1' }}
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
          />
        )}
        <textarea
          placeholder={t('appointments.agendaPlaceholder')}
          rows={3}
          style={{ gridColumn: '1 / -1' }}
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
        />
      </div>
      <div className="form-actions">
        <button className="button primary" type="button" onClick={submit}>{t('appointments.add')}</button>
      </div>
    </div>
  );
}
