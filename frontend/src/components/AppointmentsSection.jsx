import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';
import { TimeSlotGrid } from './TimeSlotGrid';
import { formatDateOnly } from '../utils/format';

const statusKeys = {
  Scheduled: 'appointments.statusScheduled',
  Completed: 'appointments.statusCompleted',
  Cancelled: 'appointments.statusCancelled'
};

const meetingTypeKeys = {
  Remote: 'appointments.meetingTypeRemote',
  'In-Person': 'appointments.meetingTypeInPerson'
};

// react-datepicker renders its own calendar UI in English regardless of the browser's display
// language, so no extra handling is needed here (contrast with the native input[type="date"]
// pickers elsewhere, which need an explicit lang="en" to stay off the page's Arabic locale).

export function AppointmentsSection({ appointments, onAdd, onMarkCompleted, onCancel, onRemove }) {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [scheduledTime, setScheduledTime] = useState('');
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [meetingType, setMeetingType] = useState('Remote');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');

  function submit() {
    const trimmedTitle = title.trim();
    if (!scheduledDate || !scheduledTime || !trimmedTitle) {
      showToast(t('appointments.fieldsRequired'), 'error');
      return;
    }
    onAdd(`${formatDateOnly(scheduledDate)}T${scheduledTime}`, trimmedTitle, agenda.trim(), meetingType, location.trim(), meetingLink.trim());
    setScheduledDate(null);
    setScheduledTime('');
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
            const when = appt.scheduled_at
              ? `${new Date(appt.scheduled_at).toLocaleDateString('en-US')} ${new Date(appt.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
              : '';
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
          <DatePicker
            selected={scheduledDate}
            onChange={setScheduledDate}
            dateFormat="yyyy-MM-dd"
            placeholderText="YYYY-MM-DD"
            className="appointment-date-input"
            wrapperClassName="appointment-date-wrapper"
            minDate={new Date()}
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
        <TimeSlotGrid
          date={scheduledDate ? formatDateOnly(scheduledDate) : null}
          value={scheduledTime}
          onChange={setScheduledTime}
        />
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
