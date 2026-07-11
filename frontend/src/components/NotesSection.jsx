import { useState } from 'react';
import { useI18n } from '../i18n/useI18n';

export function NotesSection({ notes, onAdd }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  }

  return (
    <div>
      <div className="notes-list">
        {notes.length === 0 ? (
          <p style={{ color: '#6b7280', margin: 0 }}>{t('notes.empty')}</p>
        ) : (
          notes.map((note, index) => {
            const when = note.created_at ? new Date(note.created_at).toLocaleString('en-US') : '';
            return (
              <div className="note-item" key={note.id ?? index}>
                <p>{note.text}</p>
                <small>{`${note.author_name || t('notes.unknownAuthor')} · ${when}`}</small>
              </div>
            );
          })
        )}
      </div>
      <div className="note-input-row">
        <input
          type="text"
          placeholder={t('notes.placeholder')}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="button primary" type="button" onClick={submit}>{t('notes.add')}</button>
      </div>
    </div>
  );
}
