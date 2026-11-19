import type { Goal } from '@movemeal/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, OptionCard, Screen, StepIndicator, Title, type IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { needsTarget, onboardingSteps } from '@/state/onboarding-steps';

const GOALS: Goal[] = ['lose', 'gain', 'muscle', 'maintain'];
const GOAL_ICONS: Record<Goal, IconName> = {
  lose: 'trending-down',
  gain: 'trending-up',
  muscle: 'barbell',
  maintain: 'pulse',
};

export default function GoalStep() {
  const { t } = useI18n();
  const { draft, updateDraft } = useAppState();
  const [goal, setGoal] = useState<Goal | undefined>(draft.goal);
  const steps = onboardingSteps(goal);

  function onContinue() {
    if (!goal) return;
    updateDraft({ goal });
    router.push(needsTarget(goal) ? '/onboarding/target' : '/onboarding/activity');
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('common.continue')} onPress={onContinue} disabled={!goal} />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <StepIndicator
        label={t('onboarding.step', { current: steps.index('goal'), total: steps.total })}
        current={steps.index('goal')}
        total={steps.total}
      />
      <Title>{t('onboarding.goal.title')}</Title>
      {GOALS.map((g) => (
        <OptionCard
          key={g}
          title={t(`onboarding.goal.${g}`)}
          hint={t(`onboarding.goal.${g}Hint`)}
          icon={GOAL_ICONS[g]}
          selected={goal === g}
          onPress={() => setGoal(g)}
        />
      ))}
    </Screen>
  );
}
