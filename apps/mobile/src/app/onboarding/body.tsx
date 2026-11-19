import { isInRange, LIMITS } from '@movemeal/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Field, parseNumber, Screen, StepIndicator, Title } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { onboardingSteps } from '@/state/onboarding-steps';

export default function BodyStep() {
  const { t } = useI18n();
  const { draft, updateDraft } = useAppState();
  const [height, setHeight] = useState(draft.heightCm?.toString() ?? '');
  const [weight, setWeight] = useState(draft.weightKg?.toString() ?? '');
  const [submitted, setSubmitted] = useState(false);
  const steps = onboardingSteps(draft.goal);

  const heightValue = parseNumber(height);
  const weightValue = parseNumber(weight);

  function rangeError(field: 'heightCm' | 'weightKg', value: number | undefined) {
    if (value === undefined) return t('onboarding.errors.required');
    return isInRange(field, value) ? null : t('onboarding.errors.range', LIMITS[field]);
  }
  const errors = {
    height: rangeError('heightCm', heightValue),
    weight: rangeError('weightKg', weightValue),
  };

  function onContinue() {
    setSubmitted(true);
    if (errors.height || errors.weight || heightValue === undefined || weightValue === undefined) {
      return;
    }
    updateDraft({ heightCm: Math.round(heightValue), weightKg: Math.round(weightValue * 10) / 10 });
    router.push('/onboarding/goal');
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('common.continue')} onPress={onContinue} />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <StepIndicator
        label={t('onboarding.step', { current: steps.index('body'), total: steps.total })}
        current={steps.index('body')}
        total={steps.total}
      />
      <Title>{t('onboarding.body.title')}</Title>
      <Field
        label={t('onboarding.body.height')}
        value={height}
        onChangeText={setHeight}
        keyboardType="number-pad"
        suffix={t('common.cm')}
        error={submitted ? errors.height : null}
      />
      <Field
        label={t('onboarding.body.weight')}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        suffix={t('common.kg')}
        error={submitted ? errors.weight : null}
      />
    </Screen>
  );
}
