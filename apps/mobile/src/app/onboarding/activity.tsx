import type { ActivityLevel } from '@movemeal/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  OptionCard,
  Screen,
  StepIndicator,
  Subtitle,
  Title,
  type IconName,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { onboardingSteps } from '@/state/onboarding-steps';

const LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const LEVEL_ICONS: Record<ActivityLevel, IconName> = {
  sedentary: 'desktop-outline',
  light: 'walk',
  moderate: 'bicycle',
  active: 'football',
  very_active: 'flame',
};

export default function ActivityStep() {
  const { t } = useI18n();
  const { draft, updateDraft } = useAppState();
  const [level, setLevel] = useState<ActivityLevel | undefined>(draft.activityLevel);
  const steps = onboardingSteps(draft.goal);

  function onContinue() {
    if (!level) return;
    updateDraft({ activityLevel: level });
    router.push('/onboarding/summary');
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('common.continue')} onPress={onContinue} disabled={!level} />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <StepIndicator
        label={t('onboarding.step', { current: steps.index('activity'), total: steps.total })}
        current={steps.index('activity')}
        total={steps.total}
      />
      <Title>{t('onboarding.activity.title')}</Title>
      <Subtitle>{t('onboarding.activity.subtitle')}</Subtitle>
      {LEVELS.map((l) => (
        <OptionCard
          key={l}
          title={t(`onboarding.activity.${l}`)}
          hint={t(`onboarding.activity.${l}Hint`)}
          icon={LEVEL_ICONS[l]}
          selected={level === l}
          onPress={() => setLevel(l)}
        />
      ))}
    </Screen>
  );
}
