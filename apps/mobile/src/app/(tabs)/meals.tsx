import { Placeholder } from '@/components/placeholder';
import { useI18n } from '@/i18n';

export default function MealsScreen() {
  const { t } = useI18n();
  return <Placeholder title={t('tabs.meals')} icon="restaurant-outline" />;
}
