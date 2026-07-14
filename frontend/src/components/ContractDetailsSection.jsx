import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/useI18n';

export function ContractDetailsSection({ client, onSave }) {
  const { t } = useI18n();
  const [contractPrice, setContractPrice] = useState(client?.contract_price || '');
  const [paymentType, setPaymentType] = useState(client?.payment_type || '');

  useEffect(() => {
    setContractPrice(client?.contract_price || '');
    setPaymentType(client?.payment_type || '');
  }, [client?.id, client?.contract_price, client?.payment_type]);

  function handleBlur(field, value, original) {
    const trimmed = value.trim();
    if (trimmed === (original || '')) return;
    onSave(field, trimmed);
  }

  return (
    <div className="company-card">
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div className="field-row" style={{ flex: 1, minWidth: '200px' }}>
          <label htmlFor="contract-price-input">{t('contractDetails.price')}</label>
          <input
            id="contract-price-input"
            type="text"
            placeholder={t('contractDetails.pricePlaceholder')}
            value={contractPrice}
            onChange={(e) => setContractPrice(e.target.value)}
            onBlur={(e) => handleBlur('contract_price', e.target.value, client?.contract_price)}
          />
        </div>
        <div className="field-row" style={{ flex: 1, minWidth: '200px' }}>
          <label htmlFor="payment-type-input">{t('contractDetails.paymentType')}</label>
          <input
            id="payment-type-input"
            type="text"
            placeholder={t('contractDetails.paymentTypePlaceholder')}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            onBlur={(e) => handleBlur('payment_type', e.target.value, client?.payment_type)}
          />
        </div>
      </div>
    </div>
  );
}
