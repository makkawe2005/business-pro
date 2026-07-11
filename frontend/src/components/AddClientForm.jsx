import { useI18n } from '../i18n/useI18n';

export function AddClientForm({ title, values, onChange, onCancel, onSave, saveLabel }) {
  const { t } = useI18n();

  return (
    <section className="add-client-form">
      <h3 className="section-title" style={{ marginTop: 0 }}>{title}</h3>
      <div className="add-client-grid">
        <div className="field-row">
          <label htmlFor="new-client-contact">{t('client.contactName')}</label>
          <input
            id="new-client-contact"
            type="text"
            placeholder={t('client.contactName')}
            value={values.contact_name}
            onChange={(e) => onChange('contact_name', e.target.value)}
          />
        </div>
        <div className="field-row">
          <label htmlFor="new-client-email">{t('common.email')}</label>
          <input
            id="new-client-email"
            type="email"
            dir="ltr"
            placeholder={t('common.email')}
            value={values.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
        </div>
        <div className="field-row">
          <label htmlFor="new-client-phone">{t('common.phone')}</label>
          <input
            id="new-client-phone"
            type="tel"
            dir="ltr"
            placeholder="+966-000-000-0000"
            value={values.phone}
            onChange={(e) => onChange('phone', e.target.value)}
          />
        </div>
      </div>
      <div className="form-actions">
        <button className="button neutral" type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="button primary" type="button" onClick={onSave}>{saveLabel}</button>
      </div>
    </section>
  );
}
