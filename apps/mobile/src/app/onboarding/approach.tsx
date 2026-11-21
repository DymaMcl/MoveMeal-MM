import { calculateEnergyPlan, exerciseMinutes, type LossApproach } from '@movemeal/shared';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Button,
  Notice,
  Screen,
  StepIndicator,
  Subtitle,
  Title,
  type IconName,
} from '@/components/ui';
import { formatNumber, useI18n } from '@/i18n';
import { isCompleteProfile, useAppState } from '@/state/app-state';
import { onboardingSteps } from '@/state/onboarding-steps';
import { useStyles, useTheme } from '@/theme';

const APPROACHES: LossApproach[] = ['diet', 'mixed', 'exercise'];
const ICONS: Record<LossApproach, IconName> = {
  diet: 'restaurant',
  mixed: 'git-merge',
  exercise: 'bicycle',
};

/** Slabire: deficitul vine din alimentatie, din miscare sau din ambele. */
export default function ApproachStep() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { draft, updateDraft } = useAppState();
  const [approach, setApproach] = useState<LossApproach>(draft.lossApproach ?? 'mixed');
  const steps = onboardingSteps(draft.goal);

  const s = useStyles((th) => ({
    card: {
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: th.colors.surface,
      gap: th.spacing.sm,
      ...th.elevation,
    },
    selected: { borderColor: th.colors.primary, backgroundColor: th.colors.primarySoft },
    head: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.primarySoft,
    },
    title: { ...th.font.heading, fontSize: 17 },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: th.colors.primary,
    },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    stats: { flexDirection: 'row', gap: th.spacing.sm },
    stat: {
      flex: 1,
      borderRadius: th.radius.md,
      padding: th.spacing.sm,
      backgroundColor: th.colors.background,
      gap: 2,
    },
    statValue: { ...th.font.heading, fontSize: 17 },
    statLabel: { ...th.font.caption, fontSize: 12 },
  }));

  if (!draft.goal || draft.goal !== 'lose') return <Redirect href="/onboarding/activity" />;
  if (!isCompleteProfile(draft)) return <Redirect href="/onboarding/personal" />;
  const profile = draft;

  function onContinue() {
    updateDraft({ lossApproach: approach });
    router.push('/onboarding/summary');
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
        label={t('onboarding.step', { current: steps.index('approach'), total: steps.total })}
        current={steps.index('approach')}
        total={steps.total}
      />
      <Title>{t('onboarding.approach.title')}</Title>
      <Subtitle>{t('onboarding.approach.subtitle')}</Subtitle>
      {APPROACHES.map((a) => {
        const plan = calculateEnergyPlan({ ...profile, lossApproach: a });
        const minutes = exerciseMinutes(plan.exerciseKcal);
        const selected = approach === a;
        return (
          <Pressable
            key={a}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setApproach(a)}
            style={[s.card, selected && s.selected]}
          >
            <View style={s.head}>
              <View style={s.icon}>
                <Ionicons name={ICONS[a]} size={22} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.title}>{t(`onboarding.approach.${a}`)}</Text>
                {a === 'mixed' ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{t('onboarding.approach.recommended')}</Text>
                  </View>
                ) : null}
              </View>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={selected ? theme.colors.primary : theme.colors.textMuted}
              />
            </View>
            <Text style={theme.font.caption}>{t(`onboarding.approach.${a}Hint`)}</Text>
            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statValue}>
                  {formatNumber(plan.targetCalories, language, 0)} {t('common.kcal')}
                </Text>
                <Text style={s.statLabel}>{t('onboarding.approach.eat')}</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValue}>
                  {plan.exerciseKcal ? `${plan.exerciseKcal} ${t('common.kcal')}` : '—'}
                </Text>
                <Text style={s.statLabel}>
                  {plan.exerciseKcal
                    ? t('onboarding.approach.burn', { minutes: minutes.walking })
                    : t('onboarding.approach.noBurn')}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
      <Notice tone="info">{t('onboarding.approach.note')}</Notice>
    </Screen>
  );
}
