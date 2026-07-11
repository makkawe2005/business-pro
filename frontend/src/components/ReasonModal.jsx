import { useI18n } from '../i18n/useI18n';

export function ReasonModal({ title, description, options, placeholder, reason, onReasonChange, confirmLabel, onConfirm, onCancel }) {
  const { t } = useI18n();

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{description}</p>
        <select value={reason} onChange={(e) => onReasonChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="form-actions">
          <button className="button neutral" type="button" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="button primary" type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
