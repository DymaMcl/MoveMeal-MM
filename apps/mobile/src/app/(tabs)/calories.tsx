import { Placeholder } from '@/components/placeholder';
import { useI18n } from '@/i18n';

export default function CaloriesScreen() {
  const { t } = useI18n();
  return <Placeholder title={t('tabs.calories')} icon="camera-outline" />;
}
