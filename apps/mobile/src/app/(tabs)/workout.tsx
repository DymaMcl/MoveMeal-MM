import { Placeholder } from '@/components/placeholder';
import { useI18n } from '@/i18n';

export default function WorkoutScreen() {
  const { t } = useI18n();
  return <Placeholder title={t('tabs.workout')} icon="barbell-outline" />;
}
