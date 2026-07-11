import { useI18n } from '../i18n/useI18n';

export function PipelineCard({ visible, deleteLabelKey, onNextPhase, onDelete, onReschedule }) {
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <div className="engagement-card">
      <div>
        <h4>{t('pipeline.title')}</h4>
        <p>{t('pipeline.description')}</p>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button className="button primary" type="button" onClick={onNextPhase}>{t('pipeline.nextPhase')}</button>
        {onReschedule && (
          <button className="button reschedule" type="button" onClick={onReschedule}>{t('pipeline.reschedule')}</button>
        )}
        <button className="button danger" type="button" onClick={onDelete}>{t(deleteLabelKey)}</button>
      </div>
    </div>
  );
}
