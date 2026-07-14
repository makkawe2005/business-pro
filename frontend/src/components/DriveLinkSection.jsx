import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { FolderIcon, ExternalLinkIcon } from './Icons';

export function DriveLinkSection({ driveLink, canEdit, onSave }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(driveLink || '');

  useEffect(() => {
    setValue(driveLink || '');
    setEditing(false);
  }, [driveLink]);

  function handleSave() {
    onSave(value.trim());
    setEditing(false);
  }

  function handleCancel() {
    setValue(driveLink || '');
    setEditing(false);
  }

  return (
    <div className="drive-link-card">
      <div className="drive-link-icon">
        <FolderIcon />
      </div>

      {editing ? (
        <div className="drive-link-edit-row">
          <input
            type="url"
            className="drive-link-input"
            placeholder={t('driveLink.placeholder')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <div className="form-actions">
            <button className="button neutral" type="button" onClick={handleCancel}>{t('common.cancel')}</button>
            <button className="button primary" type="button" onClick={handleSave}>{t('common.saveChanges')}</button>
          </div>
        </div>
      ) : driveLink ? (
        <div className="drive-link-display">
          <a className="drive-link-open" href={driveLink} target="_blank" rel="noopener noreferrer">
            {t('driveLink.open')} <ExternalLinkIcon />
          </a>
          {canEdit && (
            <button className="button neutral" type="button" onClick={() => setEditing(true)}>
              {t('driveLink.change')}
            </button>
          )}
        </div>
      ) : (
        <div className="drive-link-display">
          <span className="drive-link-empty">{t('driveLink.empty')}</span>
          {canEdit && (
            <button className="button primary" type="button" onClick={() => setEditing(true)}>
              {t('driveLink.add')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
