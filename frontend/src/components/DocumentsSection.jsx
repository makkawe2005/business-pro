import { useRef } from 'react';
import { useI18n } from '../i18n/useI18n';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsSection({ documents, canUpload, onUpload, onDownload, onRemove }) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);

  function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    onUpload(file);
    event.target.value = '';
  }

  return (
    <div>
      <div className="notes-list">
        {documents.length === 0 ? (
          <p style={{ color: '#6b7280', margin: 0 }}>{t('documents.empty')}</p>
        ) : (
          documents.map((doc) => (
            <div className="note-item" key={doc.id}>
              <p>
                <strong>{doc.file_name}</strong> — {formatFileSize(doc.file_size)} ·{' '}
                {new Date(doc.created_at).toLocaleDateString('en-US')}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="button neutral" type="button" onClick={() => onDownload(doc)}>
                  {t('documents.download')}
                </button>
                {canUpload && (
                  <button className="button danger" type="button" onClick={() => onRemove(doc.id)}>
                    {t('common.remove')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {canUpload && (
        <div className="form-actions">
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
          <button className="button primary" type="button" onClick={() => fileInputRef.current?.click()}>
            {t('documents.upload')}
          </button>
        </div>
      )}
    </div>
  );
}
