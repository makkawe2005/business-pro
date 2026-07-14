import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';
import { initials } from '../utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatRange(start, end) {
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function CalendarPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const [weekOffset, setWeekOffset] = useState(0);
  const [appointments, setAppointments] = useState([]);

  const windowStart = startOfDay(new Date(Date.now() + weekOffset * 7 * DAY_MS));
  const days = Array.from({ length: 7 }, (_, i) => new Date(windowStart.getTime() + i * DAY_MS));
  const windowEnd = days[6];
  const todayKey = localDateKey(startOfDay(new Date()));

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(
          `/appointments?from=${localDateKey(windowStart)}&to=${localDateKey(windowEnd)}&status=Scheduled`
        );
        if (!res.ok) throw new Error('Failed to load appointments');
        setAppointments(await res.json());
      } catch (err) {
        console.error(err);
        showToast(t('calendar.loadFailed'), 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  function handleView(appt) {
    navigate(`/${appt.stage}`, { state: { selectClientId: appt.client_id } });
  }

  return (
    <div>
      <div className="calendar-header">
        <div>
          <h2>{t('calendar.title')}</h2>
          <p>{t('calendar.subtitle')}</p>
        </div>
        <div className="calendar-week-nav">
          <button
            className="button neutral"
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label={t('calendar.prevWeek')}
            title={t('calendar.prevWeek')}
            style={{ padding: '4px 10px' }}
          >
            ‹
          </button>
          <span>{formatRange(windowStart, windowEnd)}</span>
          <button
            className="button neutral"
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label={t('calendar.nextWeek')}
            title={t('calendar.nextWeek')}
            style={{ padding: '4px 10px' }}
          >
            ›
          </button>
        </div>
      </div>

      {days.map((day) => {
        const dayKey = localDateKey(day);
        const dayAppointments = appointments.filter((a) => localDateKey(new Date(a.scheduled_at)) === dayKey);
        return (
          <div className="calendar-day-group" key={dayKey}>
            <div className="calendar-day-heading">
              <span className="dow">{day.toLocaleDateString('en-US', { weekday: 'long' })}</span>
              <span className="dom">{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              {dayKey === todayKey && <span className="calendar-today-pill">{t('calendar.today')}</span>}
              <span className="calendar-day-count">
                {dayAppointments.length === 1
                  ? t('calendar.oneAppointment')
                  : t('calendar.appointmentCount').replace('{count}', dayAppointments.length)}
              </span>
            </div>
            {dayAppointments.length === 0 ? (
              <div className="calendar-empty-day">{t('calendar.noAppointments')}</div>
            ) : (
              dayAppointments.map((appt) => (
                <div className="calendar-appt-card" key={appt.id}>
                  <span className="company-avatar">{initials(appt.contact_name)}</span>
                  <div className="calendar-appt-main">
                    <div className="client">{appt.contact_name}</div>
                    <div className="title">{appt.title}</div>
                    <div className="calendar-appt-time">{formatTime(new Date(appt.scheduled_at))}</div>
                    {appt.meeting_type === 'In-Person' && appt.location && (
                      <div className="location">{appt.location}</div>
                    )}
                    {appt.meeting_type === 'Remote' && appt.meeting_link && (
                      <a
                        className="calendar-join-link"
                        href={appt.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('calendar.joinMeeting')}
                      </a>
                    )}
                  </div>
                  <span className={`calendar-meeting-pill ${appt.meeting_type === 'In-Person' ? 'in-person' : 'remote'}`}>
                    {appt.meeting_type === 'In-Person' ? t('appointments.meetingTypeInPerson') : t('appointments.meetingTypeRemote')}
                  </span>
                  <button className="button neutral" type="button" onClick={() => handleView(appt)}>
                    {t('dashboard.viewClient')}
                  </button>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
