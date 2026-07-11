import { useI18n } from '../i18n/useI18n';

const SERVICE_FIELDS = [
  { field: 'service_consultation', labelKey: 'services.consultation' },
  { field: 'service_investment', labelKey: 'services.investment' },
  { field: 'service_business_solutions', labelKey: 'services.businessSolutions' }
];

export function ServicesSection({ client, onToggle, canEdit = true }) {
  const { t } = useI18n();

  return (
    <div className="company-card">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        {SERVICE_FIELDS.map(({ field, labelKey }) => (
          <label
            key={field}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: canEdit ? 'pointer' : 'default' }}
          >
            <input
              type="checkbox"
              checked={!!client?.[field]}
              disabled={!canEdit}
              onChange={(e) => onToggle(field, e.target.checked)}
            />
            {t(labelKey)}
          </label>
        ))}
      </div>
    </div>
  );
}
