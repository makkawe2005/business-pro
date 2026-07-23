import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useI18n } from '../i18n/useI18n';

export function TimeSlotGrid({ date, value, onChange }) {
  const { t } = useI18n();
  const [slots, setSlots] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) {
      setSlots(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    onChange('');
    apiFetch(`/calendar/available-slots?date=${date}`)
      .then((res) => (res.ok ? res.json() : { slots: [] }))
      .then((data) => { if (!cancelled) setSlots(data.slots || []); })
      .catch(() => { if (!cancelled) setSlots([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="slot-field">
      <span className="slot-field-label">{t('appointments.timeLabel')}</span>
      {!date ? (
        <p className="before-select">{t('appointments.pickDateFirst')}</p>
      ) : loading ? (
        <p className="before-select">{t('appointments.loadingSlots')}</p>
      ) : slots && slots.length === 0 ? (
        <div className="slot-empty">{t('appointments.noSlotsAvailable')}</div>
      ) : (
        <>
          <div className="slot-time-grid">
            {(slots || []).map((label) => (
              <button
                key={label}
                type="button"
                className={`slot-time-btn${value === label ? ' selected' : ''}`}
                onClick={() => onChange(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="slot-hint">{t('appointments.slotsHint')}</p>
        </>
      )}
    </div>
  );
}
