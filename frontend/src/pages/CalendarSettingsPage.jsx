import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/useI18n';
import { formatDateOnly } from '../utils/format';

const DAY_KEYS = [
  'calendarSettings.daySun',
  'calendarSettings.dayMon',
  'calendarSettings.dayTue',
  'calendarSettings.dayWed',
  'calendarSettings.dayThu',
  'calendarSettings.dayFri',
  'calendarSettings.daySat'
];

export function CalendarSettingsPage() {
  const { t } = useI18n();
  const showToast = useToastStore((s) => s.showToast);
  const [hours, setHours] = useState([]);
  const [closures, setClosures] = useState([]);
  const [closureRange, setClosureRange] = useState([null, null]);
  const [newClosureLabel, setNewClosureLabel] = useState('');
  const [closureStart, closureEnd] = closureRange;

  async function loadHours() {
    try {
      const res = await apiFetch('/calendar/business-hours');
      if (!res.ok) throw new Error('Failed to load business hours');
      setHours(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  async function loadClosures() {
    try {
      const res = await apiFetch('/calendar/closures');
      if (!res.ok) throw new Error('Failed to load closures');
      setClosures(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadHours();
    loadClosures();
  }, []);

  function updateDay(dayOfWeek, field, value) {
    setHours((prev) => prev.map((h) => (h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h)));
  }

  async function saveHours() {
    try {
      const res = await apiFetch('/calendar/business-hours', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: hours.map((h) => ({
            day_of_week: h.day_of_week,
            is_open: h.is_open,
            start_time: h.start_time ? h.start_time.slice(0, 5) : null,
            end_time: h.end_time ? h.end_time.slice(0, 5) : null
          }))
        })
      });
      if (!res.ok) throw new Error('Failed to save business hours');
      setHours(await res.json());
      showToast(t('calendarSettings.hoursSaveSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('calendarSettings.hoursSaveFailed'), 'error');
    }
  }

  async function addClosure() {
    if (!closureStart) {
      showToast(t('calendarSettings.dateRequired'), 'error');
      return;
    }
    try {
      const res = await apiFetch('/calendar/closures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formatDateOnly(closureStart),
          end_date: formatDateOnly(closureEnd || closureStart),
          label: newClosureLabel.trim()
        })
      });
      if (!res.ok) throw new Error('Failed to add closure');
      setClosureRange([null, null]);
      setNewClosureLabel('');
      await loadClosures();
      showToast(t('calendarSettings.closureAddSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('calendarSettings.closureAddFailed'), 'error');
    }
  }

  async function removeClosure(id) {
    try {
      const res = await apiFetch(`/calendar/closures/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove closure');
      await loadClosures();
      showToast(t('calendarSettings.closureRemoveSuccess'));
    } catch (err) {
      console.error(err);
      showToast(t('calendarSettings.closureRemoveFailed'), 'error');
    }
  }

  return (
    <div>
      <h3 className="section-title">{t('calendarSettings.hoursTitle')}</h3>
      <p style={{ color: 'var(--bp-muted)', marginTop: '-8px', fontSize: '0.88rem' }}>
        {t('calendarSettings.hoursSubtitle')}
      </p>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('calendarSettings.dayHeader')}</th>
              <th>{t('calendarSettings.openHeader')}</th>
              <th>{t('calendarSettings.startHeader')}</th>
              <th>{t('calendarSettings.endHeader')}</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h.day_of_week}>
                <td>{t(DAY_KEYS[h.day_of_week])}</td>
                <td>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={h.is_open}
                      onChange={(e) => updateDay(h.day_of_week, 'is_open', e.target.checked)}
                    />
                    {h.is_open ? t('calendarSettings.open') : t('calendarSettings.closed')}
                  </label>
                </td>
                <td>
                  <input
                    type="time"
                    lang="en"
                    value={h.start_time ? h.start_time.slice(0, 5) : ''}
                    onChange={(e) => updateDay(h.day_of_week, 'start_time', e.target.value)}
                    disabled={!h.is_open}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    lang="en"
                    value={h.end_time ? h.end_time.slice(0, 5) : ''}
                    onChange={(e) => updateDay(h.day_of_week, 'end_time', e.target.value)}
                    disabled={!h.is_open}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-actions" style={{ marginTop: '14px', marginBottom: '30px' }}>
        <button className="button primary" type="button" onClick={saveHours}>{t('calendarSettings.saveHours')}</button>
      </div>

      <h3 className="section-title">{t('calendarSettings.closuresTitle')}</h3>
      <p style={{ color: 'var(--bp-muted)', marginTop: '-8px', fontSize: '0.88rem' }}>
        {t('calendarSettings.closuresSubtitle')}
      </p>

      <div className="company-form-grid">
        <DatePicker
          selectsRange
          startDate={closureStart}
          endDate={closureEnd}
          onChange={(update) => setClosureRange(update)}
          dateFormat="yyyy-MM-dd"
          placeholderText={t('calendarSettings.rangePlaceholder')}
          className="appointment-date-input"
          wrapperClassName="appointment-date-wrapper"
          isClearable
        />
        <input
          type="text"
          placeholder={t('calendarSettings.labelPlaceholder')}
          value={newClosureLabel}
          onChange={(e) => setNewClosureLabel(e.target.value)}
        />
      </div>
      <div className="form-actions" style={{ marginBottom: '22px' }}>
        <button className="button primary" type="button" onClick={addClosure}>{t('calendarSettings.addClosure')}</button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('calendarSettings.dateHeader')}</th>
              <th>{t('calendarSettings.labelHeader')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {closures.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: '#6b7280', whiteSpace: 'normal' }}>{t('calendarSettings.noClosures')}</td>
              </tr>
            ) : (
              closures.map((c) => {
                const start = formatDateOnly(c.closure_date);
                const end = c.end_date ? formatDateOnly(c.end_date) : start;
                return (
                <tr key={c.id}>
                  <td>{end !== start ? `${start} → ${end}` : start}</td>
                  <td>{c.label || '–'}</td>
                  <td>
                    <button className="button danger" type="button" onClick={() => removeClosure(c.id)}>
                      {t('common.remove')}
                    </button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
