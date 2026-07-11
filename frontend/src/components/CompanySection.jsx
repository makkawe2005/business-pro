import { useI18n } from '../i18n/useI18n';
import { regionOptions, cityOptions, countryOptions, industryOptions } from '../data/companyOptions';

function CompanyFieldRow({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <div>{value || '–'}</div>
    </div>
  );
}

function CompanyCard({ company, onEdit, onRemove, canEdit }) {
  const { t } = useI18n();
  return (
    <div className="company-card">
      <div className="company-card-header">
        <strong>{company.name}</strong>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="button neutral" type="button" onClick={() => onEdit(company)}>{t('common.editShort')}</button>
            <button className="button danger" type="button" onClick={() => onRemove(company.id, company.name)}>{t('common.remove')}</button>
          </div>
        )}
      </div>
      <div className="company-fields">
        <CompanyFieldRow label={t('companies.industry')} value={company.industry} />
        <CompanyFieldRow label={t('companies.region')} value={company.region} />
        <CompanyFieldRow label={t('companies.city')} value={company.city} />
        <CompanyFieldRow label={t('companies.country')} value={company.country} />
        <CompanyFieldRow label={t('companies.crLabel')} value={company.commercial_registration_number} />
        <CompanyFieldRow label={t('companies.vat')} value={company.vat_number} />
        <CompanyFieldRow label={t('companies.contactPersonLabel')} value={company.contact_person_name} />
        <CompanyFieldRow label={t('companies.additionalPhoneLabel')} value={company.additional_phone_number} />
        <CompanyFieldRow label={t('companies.address')} value={company.national_address} />
      </div>
      {company.briefing && (
        <div className="briefing-block">
          <span>{t('companies.briefingLabel')}</span>
          <p>{company.briefing}</p>
        </div>
      )}
    </div>
  );
}

export function CompanySection({
  companies,
  formVisible,
  isEditing,
  values,
  onFieldChange,
  onStartEdit,
  onRemove,
  onSubmit,
  onCancel,
  canEdit = true
}) {
  const { t } = useI18n();

  return (
    <div>
      {(!formVisible || !canEdit) && (
        <div className="companies-list">
          {companies.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>{t('companies.empty')}</p>
          ) : (
            companies.map((company) => (
              <CompanyCard key={company.id} company={company} onEdit={onStartEdit} onRemove={onRemove} canEdit={canEdit} />
            ))
          )}
        </div>
      )}

      {formVisible && canEdit && (
        <div>
          <div className="company-form-grid">
            <input
              placeholder={t('companies.namePlaceholder')}
              value={values.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
            />
            <select value={values.region} onChange={(e) => onFieldChange('region', e.target.value)}>
              <option value="">{t('companies.region')}</option>
              {regionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
              ))}
            </select>
            <select value={values.city} onChange={(e) => onFieldChange('city', e.target.value)}>
              <option value="">{t('companies.city')}</option>
              {cityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
              ))}
            </select>
            <select value={values.country} onChange={(e) => onFieldChange('country', e.target.value)}>
              <option value="">{t('companies.country')}</option>
              {countryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
              ))}
            </select>
            <input
              placeholder={t('companies.crPlaceholder')}
              value={values.commercial_registration_number}
              onChange={(e) => onFieldChange('commercial_registration_number', e.target.value)}
            />
            <input
              placeholder={t('companies.vat')}
              value={values.vat_number}
              onChange={(e) => onFieldChange('vat_number', e.target.value)}
            />
            <input
              placeholder={t('companies.contactPersonPlaceholder')}
              value={values.contact_person_name}
              onChange={(e) => onFieldChange('contact_person_name', e.target.value)}
            />
            <input
              placeholder={t('companies.additionalPhonePlaceholder')}
              value={values.additional_phone_number}
              onChange={(e) => onFieldChange('additional_phone_number', e.target.value)}
            />
            <select value={values.industry} onChange={(e) => onFieldChange('industry', e.target.value)}>
              <option value="">{t('companies.industry')}</option>
              {industryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
              ))}
            </select>
            <input
              placeholder={t('companies.address')}
              value={values.national_address}
              onChange={(e) => onFieldChange('national_address', e.target.value)}
            />
            <textarea
              placeholder={t('companies.briefingPlaceholder')}
              rows={3}
              style={{ gridColumn: '1 / -1' }}
              value={values.briefing}
              onChange={(e) => onFieldChange('briefing', e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button className="button neutral" type="button" onClick={onCancel}>{t('common.cancel')}</button>
            <button className="button primary" type="button" onClick={onSubmit}>
              {isEditing ? t('common.saveChanges') : t('companies.add')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
