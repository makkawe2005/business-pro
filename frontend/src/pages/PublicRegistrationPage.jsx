import { useState } from 'react';
import { API_BASE } from '../api/client';
import { useI18n } from '../i18n/useI18n';
import { GlobeIcon } from '../components/Icons';
import logo from '../assets/logo.png';

const emptyForm = {
  contact_name: '',
  phone: '',
  email: '',
  company_name: '',
  company_city: '',
  company_industry: '',
  company_website: '',
  company_briefing: '',
  hp_field: ''
};

export function PublicRegistrationPage() {
  const { t, toggleLanguage, nextLangLabel, nextLangCode } = useI18n();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const requiredFields = [
    'contact_name', 'phone', 'email',
    'company_name', 'company_city', 'company_industry', 'company_website', 'company_briefing'
  ];

  async function handleSubmit(event) {
    event.preventDefault();
    const missing = requiredFields.some((field) => !form[field].trim());
    if (missing) {
      setError(t('publicRegistration.fieldsRequired'));
      return;
    }
    if (!/^[1-9]\d{8}$/.test(form.phone.trim())) {
      setError(t('publicRegistration.phoneInvalid'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/public/client-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, phone: `+966${form.phone.trim()}` })
      });
      if (!res.ok) {
        setError(t('publicRegistration.submitFailed'));
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(t('publicRegistration.serverUnreachable'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: '560px' }}>
        <div className="login-brand">
          <div className="login-brand-text">
            <img className="brand-mark" src={logo} alt="Business Pro" />
            <span>Business Pro</span>
          </div>
          <button
            type="button"
            className="login-lang-toggle"
            onClick={toggleLanguage}
            title={nextLangLabel}
            aria-label={nextLangLabel}
          >
            <GlobeIcon /> {nextLangCode}
          </button>
        </div>

        <div>
          <h1>{t('publicRegistration.title')}</h1>
          <p className="subtitle">{t('publicRegistration.subtitle')}</p>
        </div>

        {submitted ? (
          <p className="error-message" style={{ color: 'var(--bp-success)', display: 'block' }}>
            {t('publicRegistration.success')}
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '18px' }}>
            {error && <p className="error-message" style={{ display: 'block' }}>{error}</p>}

            <div className="field-row">
              <label htmlFor="contact_name">{t('publicRegistration.contactName')}</label>
              <input
                id="contact_name"
                type="text"
                value={form.contact_name}
                onChange={(e) => setField('contact_name', e.target.value)}
              />
            </div>

            <div className="field-row">
              <label htmlFor="phone">{t('common.phone')}</label>
              <div className="phone-prefix-input">
                <span className="phone-prefix-badge">+966</span>
                <input
                  id="phone"
                  type="tel"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="5XXXXXXXX"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 9))}
                />
              </div>
            </div>

            <div className="field-row">
              <label htmlFor="email">{t('common.email')}</label>
              <input
                id="email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
            </div>

            <div className="field-row">
              <label htmlFor="company_name">{t('publicRegistration.companyName')}</label>
              <input
                id="company_name"
                type="text"
                value={form.company_name}
                onChange={(e) => setField('company_name', e.target.value)}
              />
            </div>

            <div className="field-row">
              <label htmlFor="company_city">{t('publicRegistration.companyCity')}</label>
              <input
                id="company_city"
                type="text"
                value={form.company_city}
                onChange={(e) => setField('company_city', e.target.value)}
              />
            </div>

            <div className="field-row">
              <label htmlFor="company_industry">{t('publicRegistration.companyIndustry')}</label>
              <input
                id="company_industry"
                type="text"
                value={form.company_industry}
                onChange={(e) => setField('company_industry', e.target.value)}
              />
            </div>

            <div className="field-row">
              <label htmlFor="company_website">{t('publicRegistration.companyWebsite')}</label>
              <input
                id="company_website"
                type="text"
                dir="ltr"
                value={form.company_website}
                onChange={(e) => setField('company_website', e.target.value)}
              />
            </div>

            <div className="field-row">
              <label htmlFor="company_briefing">{t('publicRegistration.companyBriefing')}</label>
              <textarea
                id="company_briefing"
                rows={4}
                value={form.company_briefing}
                onChange={(e) => setField('company_briefing', e.target.value)}
              />
            </div>

            {/* Honeypot: real users never see or fill this. Bots that auto-fill every field trip it. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
              <label htmlFor="company_url">Company URL</label>
              <input
                id="company_url"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.hp_field}
                onChange={(e) => setField('hp_field', e.target.value)}
              />
            </div>

            <button className="button primary" type="submit" disabled={submitting}>
              {t('publicRegistration.submitButton')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
