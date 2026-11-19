import { calculateEnergyPlan } from '@movemeal/shared';
import { Redirect, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { errorKey } from '@/api/errors';
import { Button, Notice, Screen, Subtitle, Title } from '@/components/ui';
import { useI18n } from '@/i18n';
import { isCompleteProfile, useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

export default function SummaryStep() {
  const { t } = useI18n();
  const theme = useTheme();
  const { draft, completeOnboarding } = useAppState();
  const s = useStyles((th) => ({
    hero: { borderRadius: th.radius.lg, padding: th.spacing.lg, gap: th.spacing.xs },
    heroLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 14 },
    big: { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1.5 },
    unit: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: th.spacing.sm,
      marginTop: th.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.25)',
    },
    rowLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
    rowValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    macros: { flexDirection: 'row', gap: th.spacing.sm },
    macro: {
      flex: 1,
      backgroundColor: th.colors.surface,
      borderRadius: th.radius.md,
      padding: th.spacing.md,
      alignItems: 'center',
      gap: 4,
      ...th.elevation,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    macroValue: { ...th.font.heading, fontSize: 20 },
  }));

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isCompleteProfile(draft)) return <Redirect href="/onboarding/personal" />;
  const plan = calculateEnergyPlan(draft);

  async function onFinish() {
    setBusy(true);
    setSaveError(null);
    try {
      await completeOnboarding();
      router.replace('/home');
    } catch (error) {
      setSaveError(t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  const macros = [
    {
      label: t('onboarding.summary.protein'),
      value: plan.macros.proteinG,
      color: theme.colors.protein,
    },
    { label: t('onboarding.summary.carbs'), value: plan.macros.carbsG, color: theme.colors.carbs },
    { label: t('onboarding.summary.fat'), value: plan.macros.fatG, color: theme.colors.fat },
  ];

  return (
    <Screen
      footer={
        <>
          <Button
            title={t('onboarding.summary.finish')}
            icon="checkmark-circle"
            onPress={onFinish}
            disabled={busy}
          />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <Title>{t('onboarding.summary.title')}</Title>
      <Subtitle>{t('onboarding.summary.subtitle')}</Subtitle>
      <LinearGradient
        colors={theme.gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <Text style={s.heroLabel}>{t('onboarding.summary.target')}</Text>
        <Text style={s.big}>
          {plan.targetCalories} <Text style={s.unit}>{t('common.kcal')}</Text>
        </Text>
        <View style={s.row}>
          <Text style={s.rowLabel}>{t('onboarding.summary.bmr')}</Text>
          <Text style={s.rowValue}>
            {plan.bmr} {t('common.kcal')}
          </Text>
        </View>
        <View style={s.row}>
          <Text style={s.rowLabel}>{t('onboarding.summary.tdee')}</Text>
          <Text style={s.rowValue}>
            {plan.tdee} {t('common.kcal')}
          </Text>
        </View>
      </LinearGradient>
      <View style={s.macros}>
        {macros.map((m) => (
          <View key={m.label} style={s.macro}>
            <View style={[s.dot, { backgroundColor: m.color }]} />
            <Text style={s.macroValue}>
              {m.value} {t('common.g')}
            </Text>
            <Text style={theme.font.caption}>{m.label}</Text>
          </View>
        ))}
      </View>
      {saveError ? <Notice>{saveError}</Notice> : null}
      <Notice tone="info">{t('common.disclaimer')}</Notice>
    </Screen>
  );
}
