import { checkWeightGoal, isInRange, LIMITS, minHealthyWeight } from '@movemeal/shared';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Field, Notice, parseNumber, Screen, StepIndicator, Title } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useTheme } from '@/theme';
import { needsTarget, onboardingSteps } from '@/state/onboarding-steps';

export default function TargetStep() {
  const { t, formatNumber: fmt, formatWeeks } = useI18n();
  const theme = useTheme();
  const { draft, updateDraft } = useAppState();
  const [target, setTarget] = useState(draft.targetWeightKg?.toString() ?? '');
  const [weeks, setWeeks] = useState(draft.weeks?.toString() ?? '');
  const [submitted, setSubmitted] = useState(false);

  const { goal, weightKg, heightCm } = draft;
  if (!needsTarget(goal) || weightKg === undefined || heightCm === undefined) {
    return <Redirect href="/onboarding/goal" />;
  }
  const steps = onboardingSteps(goal);

  const targetValue = parseNumber(target);
  const weeksValue = parseNumber(weeks);
  const targetValid = targetValue !== undefined && isInRange('weightKg', targetValue);
  const weeksValid =
    weeksValue !== undefined && Number.isInteger(weeksValue) && isInRange('weeks', weeksValue);

  const check =
    targetValid && weeksValid
      ? checkWeightGoal({
          goal,
          weightKg,
          heightCm,
          targetWeightKg: targetValue,
          weeks: weeksValue,
        })
      : null;

  let targetError: string | null = null;
  if (submitted && !targetValid) {
    targetError =
      targetValue === undefined
        ? t('onboarding.errors.required')
        : t('onboarding.errors.range', LIMITS.weightKg);
  }
  let weeksError: string | null = null;
  if (submitted && !weeksValid) {
    weeksError =
      weeksValue === undefined
        ? t('onboarding.errors.required')
        : t('onboarding.errors.range', LIMITS.weeks);
  }

  /** Mesajul afisat sub campul cu numarul de saptamani. */
  function weeksHint() {
    if (!check) return null;
    switch (check.status) {
      case 'wrong_direction':
        return (
          <Notice>
            {t(
              goal === 'lose'
                ? 'onboarding.target.wrongDirectionLose'
                : 'onboarding.target.wrongDirectionGain',
            )}
          </Notice>
        );
      case 'unhealthy_target':
        return (
          <Notice>{t('onboarding.target.unhealthy', { min: minHealthyWeight(heightCm!) })}</Notice>
        );
      case 'too_fast':
        return (
          <>
            <Notice>
              {t('onboarding.target.tooFast', {
                rate: fmt(check.weeklyRateKg),
                max: fmt(check.maxWeeklyRateKg),
                weeks: formatWeeks(check.recommendedWeeks),
              })}
            </Notice>
            <Button
              variant="secondary"
              title={t('onboarding.target.useSuggested', {
                weeks: formatWeeks(check.recommendedWeeks),
              })}
              onPress={() => setWeeks(String(check.recommendedWeeks))}
            />
          </>
        );
      case 'ok':
        return (
          <Text style={theme.font.caption}>
            {t('onboarding.target.rate', { rate: fmt(check.weeklyRateKg) })}
          </Text>
        );
    }
  }

  function onContinue() {
    setSubmitted(true);
    if (!check || check.status !== 'ok' || targetValue === undefined || weeksValue === undefined) {
      return;
    }
    updateDraft({ targetWeightKg: Math.round(targetValue * 10) / 10, weeks: weeksValue });
    router.push('/onboarding/activity');
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title={t('common.continue')}
            onPress={onContinue}
            disabled={!!check && check.status !== 'ok'}
          />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <StepIndicator
        label={t('onboarding.step', { current: steps.index('target'), total: steps.total })}
        current={steps.index('target')}
        total={steps.total}
      />
      <Title>{t('onboarding.target.title')}</Title>
      <Field
        label={t('onboarding.target.targetWeight')}
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        suffix={t('common.kg')}
        icon="flag-outline"
        error={targetError}
      />
      <Field
        label={t('onboarding.target.weeks')}
        value={weeks}
        onChangeText={setWeeks}
        keyboardType="number-pad"
        suffix={t('common.weeks')}
        icon="time-outline"
        error={weeksError}
        hint={weeksHint()}
      />
    </Screen>
  );
}
