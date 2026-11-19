import { isInRange, LIMITS, type Sex } from '@movemeal/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Field,
  OptionCard,
  parseNumber,
  Screen,
  StepIndicator,
  Subtitle,
  Title,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { font, spacing } from '@/theme';
import { onboardingSteps } from '@/state/onboarding-steps';

export default function PersonalStep() {
  const { t } = useI18n();
  const { draft, updateDraft } = useAppState();
  const [name, setName] = useState(draft.name ?? '');
  const [age, setAge] = useState(draft.age?.toString() ?? '');
  const [sex, setSex] = useState<Sex | undefined>(draft.sex);
  const [submitted, setSubmitted] = useState(false);
  const steps = onboardingSteps(draft.goal);

  const ageValue = parseNumber(age);
  const errors = {
    name: name.trim().length < 2 ? t('onboarding.errors.required') : null,
    age:
      ageValue === undefined
        ? t('onboarding.errors.required')
        : !isInRange('age', ageValue)
          ? t('onboarding.errors.range', LIMITS.age)
          : null,
    sex: !sex ? t('onboarding.errors.required') : null,
  };
  const valid = !errors.name && !errors.age && !errors.sex;
  const show = (e: string | null) => (submitted ? e : null);

  function onContinue() {
    setSubmitted(true);
    if (!valid || ageValue === undefined || !sex) return;
    updateDraft({ name: name.trim(), age: Math.round(ageValue), sex });
    router.push('/onboarding/start');
  }

  return (
    <Screen footer={<Button title={t('common.continue')} onPress={onContinue} />}>
      <StepIndicator
        label={t('onboarding.step', { current: steps.index('personal'), total: steps.total })}
        current={steps.index('personal')}
        total={steps.total}
      />
      <Title>{t('onboarding.personal.title')}</Title>
      <Subtitle>{t('onboarding.personal.subtitle')}</Subtitle>
      <Field
        label={t('onboarding.personal.name')}
        value={name}
        onChangeText={setName}
        autoComplete="given-name"
        error={show(errors.name)}
      />
      <Field
        label={t('onboarding.personal.age')}
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        suffix={t('common.years')}
        error={show(errors.age)}
      />
      <View style={styles.group}>
        <Text style={styles.label}>{t('onboarding.personal.sex')}</Text>
        <OptionCard
          title={t('onboarding.personal.male')}
          selected={sex === 'male'}
          onPress={() => setSex('male')}
        />
        <OptionCard
          title={t('onboarding.personal.female')}
          selected={sex === 'female'}
          onPress={() => setSex('female')}
        />
        {show(errors.sex) ? <Text style={styles.error}>{errors.sex}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  label: { ...font.body, fontWeight: '600' },
  error: { fontSize: 13, color: '#D92D20' },
});
