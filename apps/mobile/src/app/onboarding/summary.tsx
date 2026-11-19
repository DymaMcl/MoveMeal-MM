import { calculateEnergyPlan } from '@movemeal/shared';
import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Notice, Screen, Subtitle, Title } from '@/components/ui';
import { useI18n } from '@/i18n';
import { isCompleteProfile, useAppState } from '@/state/app-state';
import { colors, font, spacing } from '@/theme';

export default function SummaryStep() {
  const { t } = useI18n();
  const { draft, completeOnboarding } = useAppState();

  if (!isCompleteProfile(draft)) return <Redirect href="/onboarding/personal" />;
  const plan = calculateEnergyPlan(draft);

  async function onFinish() {
    await completeOnboarding();
    router.replace('/home');
  }

  const macros = [
    { label: t('onboarding.summary.protein'), value: plan.macros.proteinG, color: colors.protein },
    { label: t('onboarding.summary.carbs'), value: plan.macros.carbsG, color: colors.carbs },
    { label: t('onboarding.summary.fat'), value: plan.macros.fatG, color: colors.fat },
  ];

  return (
    <Screen
      footer={
        <>
          <Button title={t('onboarding.summary.finish')} onPress={onFinish} />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <Title>{t('onboarding.summary.title')}</Title>
      <Subtitle>{t('onboarding.summary.subtitle')}</Subtitle>
      <Card>
        <Text style={font.caption}>{t('onboarding.summary.target')}</Text>
        <Text style={styles.big}>
          {plan.targetCalories} <Text style={font.heading}>{t('common.kcal')}</Text>
        </Text>
        <View style={styles.row}>
          <Text style={font.caption}>{t('onboarding.summary.bmr')}</Text>
          <Text style={font.body}>
            {plan.bmr} {t('common.kcal')}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={font.caption}>{t('onboarding.summary.tdee')}</Text>
          <Text style={font.body}>
            {plan.tdee} {t('common.kcal')}
          </Text>
        </View>
      </Card>
      <View style={styles.macros}>
        {macros.map((m) => (
          <View key={m.label} style={[styles.macro, { borderTopColor: m.color }]}>
            <Text style={font.heading}>
              {m.value} {t('common.g')}
            </Text>
            <Text style={font.caption}>{m.label}</Text>
          </View>
        ))}
      </View>
      <Notice tone="info">{t('common.disclaimer')}</Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 40, fontWeight: '800', color: colors.primary },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  macros: { flexDirection: 'row', gap: spacing.sm },
  macro: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderTopWidth: 4,
    alignItems: 'center',
    gap: 2,
  },
});
