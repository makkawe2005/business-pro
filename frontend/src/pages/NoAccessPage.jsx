import { useI18n } from '../i18n/useI18n';

export function NoAccessPage() {
  const { t } = useI18n();
  return <p className="page-intro">{t('noAccess.message')}</p>;
}
